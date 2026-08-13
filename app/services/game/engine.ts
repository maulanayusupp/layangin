import {
  COUNTDOWN_SECONDS,
  CRASH_GRACE,
  FIXED_TIMESTEP,
  MAX_FRAME_TIME,
  PLAYER_ANCHOR_X,
  RIVAL_ANCHOR_X,
} from './constants'
import { getKite } from '~/data/kites'
import { createRandom } from './math/random'
import { resolveLoadout } from './loadout'
import { applyAbrasion, detectClashes } from './physics/combat'
import { createFighter, driftCutKite, hasCrashed, stepFighter } from './physics/fighter'
import {
  applyCableWear,
  findCableContacts,
  findCollision,
  windFactorAt,
  type CableContact,
} from './physics/obstacles'
import { createWindField } from './physics/wind'
import { createAiInput, scaleAiProfile } from './input/ai'
import type { InputSource } from './input/source'
import {
  NEUTRAL_COMMAND,
  type ClashPoint,
  type FighterSide,
  type FighterState,
  type MatchConfig,
  type MatchOutcome,
  type MatchSnapshot,
  type WindSample,
} from './types'

/**
 * Match engine.
 *
 * ## Fixed timestep
 * The simulation always advances in exact `FIXED_TIMESTEP` (1/120 s) slices,
 * accumulating real elapsed time and draining it in whole steps. Two reasons:
 *
 * 1. **Stability** — a stiff line constraint integrated with a variable step
 *    misbehaves the moment a frame is slow.
 * 2. **Determinism** — identical seed plus identical command stream gives an
 *    identical result on any machine, which is what makes replays and the
 *    planned lockstep netcode possible.
 *
 * ## Snapshot
 * `snapshot` is a long-lived, mutated-in-place object. The renderer and the HUD
 * read it directly. It is deliberately *not* reactive: pushing 120 updates a
 * second through Vue's reactivity would dominate the frame budget. The HUD
 * instead samples it on a `requestAnimationFrame` tick — see `useMatch`.
 */
export interface MatchEngine {
  readonly snapshot: MatchSnapshot
  /** Advance by real elapsed seconds. Safe to call with any value. */
  advance(realSeconds: number): void
  /** Leave the countdown early. */
  skipCountdown(): void
  /** Total simulation steps executed — the replay clock. */
  readonly step: number
  dispose(): void
}

export interface MatchEngineOptions {
  config: MatchConfig
  /** Input for the human (or, in a replay, a recorded stream). */
  playerInput: InputSource
  /** Defaults to an AI built from the opponent definition. */
  rivalInput?: InputSource
}

export function createMatchEngine({
  config,
  playerInput,
  rivalInput,
}: MatchEngineOptions): MatchEngine {
  const { opponent, arena } = config

  // Two independent streams so the AI's decisions cannot be shifted by a change
  // in how many gust samples the wind field happens to draw.
  const windRandom = createRandom(config.seed)
  const aiRandom = createRandom(config.seed ^ 0x5bf03635)

  // The arena shapes the air: a beach is windier and gustier than a rice field,
  // and an alley between buildings is slower but choppier.
  const wind = createWindField({
    referenceSpeed: opponent.windSpeed * arena.windMultiplier,
    gustiness: opponent.gustiness * arena.gustMultiplier,
    seed: windRandom.int(0, 0xffffff),
  })

  const playerLoadout = resolveLoadout(config.player.kiteId, config.player.upgrades)
  const rivalLoadout = resolveLoadout(opponent.kiteId, opponent.upgrades)

  const player = createFighter({
    side: 'player',
    anchorX: PLAYER_ANCHOR_X,
    stats: playerLoadout.stats,
    reelSpeed: playerLoadout.reelSpeed,
    staminaEfficiency: playerLoadout.staminaEfficiency,
    kiteId: config.player.kiteId,
    paletteId: config.player.paletteId,
    patternId: config.player.patternId,
    effectId: config.player.effectId,
  })

  const rival = createFighter({
    side: 'rival',
    anchorX: RIVAL_ANCHOR_X,
    stats: rivalLoadout.stats,
    reelSpeed: rivalLoadout.reelSpeed,
    staminaEfficiency: rivalLoadout.staminaEfficiency,
    kiteId: opponent.kiteId,
    paletteId: opponent.paletteId,
    patternId: opponent.patternId,
    effectId: opponent.effectId,
  })

  const rivalSource
    = rivalInput
      ?? createAiInput(scaleAiProfile(opponent.ai, config.difficultyScale), aiRandom)

  /** Collision margin: roughly the kite's own half-span. */
  const playerMargin = getKite(config.player.kiteId).size / 2
  const rivalMargin = getKite(opponent.kiteId).size / 2

  const clashes: ClashPoint[] = []
  const lineClashes: ClashPoint[] = []
  const playerCables: CableContact[] = []
  const rivalCables: CableContact[] = []

  const snapshot: MatchSnapshot = {
    phase: 'countdown',
    outcome: { kind: 'pending' },
    arena,
    elapsed: 0,
    timeLimit: config.timeLimit,
    countdown: COUNTDOWN_SECONDS,
    player,
    rival,
    wind: wind.sample(player.position.y),
    windSpeed: opponent.windSpeed * arena.windMultiplier,
    clashes,
    stats: {
      durationSeconds: 0,
      clashSeconds: 0,
      peakTension: 0,
      snapsUsed: 0,
      peakAltitude: 0,
    },
  }

  let accumulator = 0
  let countdown = COUNTDOWN_SECONDS
  let stepCount = 0
  let playerSnapWasActive = false

  const resolve = (outcome: MatchOutcome): void => {
    if (snapshot.phase === 'resolved') return
    snapshot.outcome = outcome
    snapshot.phase = 'resolved'
    snapshot.stats.durationSeconds = snapshot.elapsed
  }

  /** Wind blows along +x, so the sag of every line bows the same way. */
  const windDirection = 1

  /**
   * Wind at a fighter's kite, with the arena's wind shadows applied. Behind a
   * tall building the air genuinely slows, and lift collapses with it.
   */
  const windFor = (fighter: FighterState): WindSample => {
    const sample = wind.sample(fighter.position.y)
    const factor = windFactorAt(arena, fighter.position)
    if (factor >= 1) return sample

    return {
      velocity: { x: sample.velocity.x * factor, y: sample.velocity.y * factor },
      speed: sample.speed * factor,
    }
  }

  const simulate = (dt: number): void => {
    wind.update(dt)

    const playerWind = windFor(player)
    const rivalWind = windFor(rival)
    snapshot.wind = playerWind
    snapshot.windSpeed = wind.currentReferenceSpeed()

    if (snapshot.phase === 'resolved') {
      // Let the losing kite tumble away downwind so the result reads visually.
      if (!player.alive) driftCutKite(player, playerWind, dt)
      if (!rival.alive) driftCutKite(rival, rivalWind, dt)
      return
    }

    const playerCommand = player.alive
      ? playerInput.sample({ self: player, opponent: rival, wind: playerWind, elapsed: snapshot.elapsed, dt })
      : NEUTRAL_COMMAND

    const rivalCommand = rival.alive
      ? rivalSource.sample({ self: rival, opponent: player, wind: rivalWind, elapsed: snapshot.elapsed, dt })
      : NEUTRAL_COMMAND

    stepFighter(player, playerCommand, playerWind, windDirection, dt)
    stepFighter(rival, rivalCommand, rivalWind, windDirection, dt)

    // --- Contacts -----------------------------------------------------------
    clashes.length = 0

    detectClashes(player, rival, lineClashes)
    for (const clash of lineClashes) clashes.push(clash)
    const abrasion = applyAbrasion(player, rival, lineClashes, dt)

    // Arena cables cut without being cut back.
    playerCables.length = 0
    rivalCables.length = 0
    findCableContacts(arena, player, playerCables)
    findCableContacts(arena, rival, rivalCables)
    applyCableWear(player, playerCables, dt, clashes)
    applyCableWear(rival, rivalCables, dt, clashes)

    snapshot.elapsed += dt

    // --- Telemetry for the result screen ------------------------------------
    if (abrasion.engaged) snapshot.stats.clashSeconds += dt
    if (player.tension > snapshot.stats.peakTension) snapshot.stats.peakTension = player.tension
    if (player.position.y > snapshot.stats.peakAltitude) {
      snapshot.stats.peakAltitude = player.position.y
    }
    if (player.snapActive > 0 && !playerSnapWasActive) snapshot.stats.snapsUsed += 1
    playerSnapWasActive = player.snapActive > 0

    // --- Win conditions -----------------------------------------------------
    // A cut line is checked first: it is the decisive outcome.
    if (!player.alive && !rival.alive) {
      resolve({ kind: 'timeout', winner: 'draw' })
      return
    }
    if (!rival.alive) {
      resolve({ kind: 'cut', winner: 'player' })
      return
    }
    if (!player.alive) {
      resolve({ kind: 'cut', winner: 'rival' })
      return
    }

    // Hitting a structure, or the ground, loses the round — but only after a
    // grace period so the opening seconds cannot be lost to the launch attitude.
    if (snapshot.elapsed > CRASH_GRACE) {
      if (findCollision(arena, player.position, playerMargin)) {
        player.alive = false
        resolve({ kind: 'obstacle', winner: 'rival' })
        return
      }
      if (findCollision(arena, rival.position, rivalMargin)) {
        rival.alive = false
        resolve({ kind: 'obstacle', winner: 'player' })
        return
      }
      if (hasCrashed(player)) {
        player.alive = false
        resolve({ kind: 'crash', winner: 'rival' })
        return
      }
      if (hasCrashed(rival)) {
        rival.alive = false
        resolve({ kind: 'crash', winner: 'player' })
        return
      }
    }

    if (snapshot.elapsed >= snapshot.timeLimit) {
      // Time out: the healthier line takes it. A dead heat is a draw.
      const difference = player.lineIntegrity - rival.lineIntegrity
      const winner: FighterSide | 'draw'
        = Math.abs(difference) < 0.02 ? 'draw' : difference > 0 ? 'player' : 'rival'
      resolve({ kind: 'timeout', winner })
    }
  }

  return {
    snapshot,

    get step(): number {
      return stepCount
    },

    advance(realSeconds: number): void {
      // Guard against a tab that was backgrounded for a minute.
      accumulator += Math.min(realSeconds, MAX_FRAME_TIME)

      if (snapshot.phase === 'countdown') {
        countdown -= Math.min(realSeconds, MAX_FRAME_TIME)
        snapshot.countdown = Math.max(0, countdown)
        if (countdown <= 0) {
          snapshot.phase = 'flying'
        }
        else {
          // Hold the kites in trim during the countdown so the arena is alive,
          // but do not accrue match time or allow damage.
          const holdSteps = Math.floor(accumulator / FIXED_TIMESTEP)
          accumulator -= holdSteps * FIXED_TIMESTEP
          for (let i = 0; i < holdSteps; i += 1) {
            wind.update(FIXED_TIMESTEP)
            stepFighter(player, NEUTRAL_COMMAND, windFor(player), windDirection, FIXED_TIMESTEP)
            stepFighter(rival, NEUTRAL_COMMAND, windFor(rival), windDirection, FIXED_TIMESTEP)
            stepCount += 1
          }
          snapshot.wind = windFor(player)
          return
        }
      }

      while (accumulator >= FIXED_TIMESTEP) {
        simulate(FIXED_TIMESTEP)
        accumulator -= FIXED_TIMESTEP
        stepCount += 1
      }
    },

    skipCountdown(): void {
      if (snapshot.phase === 'countdown') {
        countdown = 0
        snapshot.countdown = 0
        snapshot.phase = 'flying'
      }
    },

    dispose(): void {
      playerInput.dispose?.()
      rivalSource.dispose?.()
    },
  }
}

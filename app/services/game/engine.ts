import {
  COUNTDOWN_SECONDS,
  CRASH_GRACE,
  FIXED_TIMESTEP,
  MAX_FRAME_TIME,
  PLAYER_ANCHOR_X,
  RIVAL_ANCHOR_X,
  ROUND_BREAK,
  START_LINE_LENGTH,
} from './constants'
import { getKite } from '~/data/kites'
import { createRandom } from './math/random'
import { resolveLoadout } from './loadout'
import { applyAbrasion, detectClashes } from './physics/combat'
import {
  createFighter,
  driftCutKite,
  hasCrashed,
  relaunchFighter,
  stepFighter,
} from './physics/fighter'
import {
  applyCableWear,
  findCableContacts,
  findCollision,
  hazardCeiling,
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
  type RoundEndReason,
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

  /**
   * Launch altitude that clears every hazard between the anchor and where the
   * kite starts. Without this, an arena with a tall tower can begin a round with
   * a kite already inside it.
   */
  const safeLaunchAltitude = (anchorX: number): number => {
    const startX = anchorX + START_LINE_LENGTH * 0.55
    const ceiling = hazardCeiling(arena, anchorX, startX)
    return ceiling === 0 ? 0 : ceiling + 12
  }

  /** Clearance the AI must keep above arena hazards, in metres. */
  const clearanceFor = (fromX: number, toX: number): number => {
    const ceiling = hazardCeiling(arena, fromX, toX)
    return ceiling === 0 ? 0 : ceiling + 10
  }

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
    minAltitude: safeLaunchAltitude(PLAYER_ANCHOR_X),
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
    minAltitude: safeLaunchAltitude(RIVAL_ANCHOR_X),
  })

  const rivalSource
    = rivalInput
      ?? createAiInput({
        profile: scaleAiProfile(opponent.ai, config.difficultyScale),
        random: aiRandom,
        clearance: clearanceFor,
      })

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
    round: 1,
    lastRound: null,
    roundBreak: 0,
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
      roundsWon: 0,
      roundsLost: 0,
    },
  }

  let accumulator = 0
  let countdown = COUNTDOWN_SECONDS
  let stepCount = 0
  let playerSnapWasActive = false
  /** Seconds since the current round launched, for the crash grace period. */
  let roundAge = 0

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

    if (snapshot.phase === 'roundOver') {
      // The cut kite tumbles away while the survivor keeps flying, so the pause
      // shows the consequence instead of freezing the arena.
      if (player.alive) stepFighter(player, NEUTRAL_COMMAND, playerWind, windDirection, dt)
      else driftCutKite(player, playerWind, dt)

      if (rival.alive) stepFighter(rival, NEUTRAL_COMMAND, rivalWind, windDirection, dt)
      else driftCutKite(rival, rivalWind, dt)

      // The match clock does not run during the break.
      snapshot.roundBreak = Math.max(0, snapshot.roundBreak - dt)
      if (snapshot.roundBreak === 0) startNextRound()
      return
    }

    // Contact from the previous step: this step's clashes are not known until the
    // fighters have moved, and one step of latency is imperceptible.
    const inContact = clashes.some(clash => clash.kind === 'line')

    const playerCommand = player.alive
      ? playerInput.sample({
          self: player, opponent: rival, wind: playerWind,
          contact: inContact, elapsed: snapshot.elapsed, dt,
        })
      : NEUTRAL_COMMAND

    const rivalCommand = rival.alive
      ? rivalSource.sample({
          self: rival, opponent: player, wind: rivalWind,
          contact: inContact, elapsed: snapshot.elapsed, dt,
        })
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
    roundAge += dt

    // --- Telemetry for the result screen ------------------------------------
    if (abrasion.engaged) snapshot.stats.clashSeconds += dt
    if (player.tension > snapshot.stats.peakTension) snapshot.stats.peakTension = player.tension
    if (player.position.y > snapshot.stats.peakAltitude) {
      snapshot.stats.peakAltitude = player.position.y
    }
    if (player.snapActive > 0 && !playerSnapWasActive) snapshot.stats.snapsUsed += 1
    playerSnapWasActive = player.snapActive > 0

    // --- Round conditions ---------------------------------------------------
    // Losing a line costs one life, not the match. Both going at once costs
    // both a life, which is the fair reading of a simultaneous cut.
    if (!player.alive || !rival.alive) {
      const cableCut
        = (!player.alive && playerCables.length > 0)
          || (!rival.alive && rivalCables.length > 0)
      endRound(!player.alive, !rival.alive, cableCut ? 'cable' : 'cut')
      return
    }

    // Hitting a structure or the ground also costs a life, but only after the
    // grace period so a round is never lost to the launch attitude.
    if (roundAge > CRASH_GRACE) {
      const playerHitStructure = findCollision(arena, player.position, playerMargin) !== null
      const rivalHitStructure = findCollision(arena, rival.position, rivalMargin) !== null

      if (playerHitStructure || rivalHitStructure) {
        endRound(playerHitStructure, rivalHitStructure, 'obstacle')
        return
      }

      const playerDown = hasCrashed(player)
      const rivalDown = hasCrashed(rival)
      if (playerDown || rivalDown) {
        endRound(playerDown, rivalDown, 'crash')
        return
      }
    }

    if (snapshot.elapsed >= snapshot.timeLimit) {
      // Time out: more lives wins, then the healthier line. A dead heat draws.
      const hpDifference = player.hp - rival.hp
      const lineDifference = player.lineIntegrity - rival.lineIntegrity
      const winner: FighterSide | 'draw'
        = hpDifference !== 0
          ? hpDifference > 0 ? 'player' : 'rival'
          : Math.abs(lineDifference) < 0.02
            ? 'draw'
            : lineDifference > 0 ? 'player' : 'rival'
      resolve({ kind: 'timeout', winner })
    }
  }

  /**
   * Score a lost round.
   *
   * Deducts a life from whoever went out, records what happened for the banner,
   * and either resolves the match or opens the between-rounds pause. Nothing is
   * relaunched here — that happens when the pause expires, so the cut kite has
   * time to tumble away on screen.
   */
  const endRound = (playerOut: boolean, rivalOut: boolean, reason: RoundEndReason): void => {
    if (playerOut) {
      player.hp -= 1
      player.alive = false
      snapshot.stats.roundsLost += 1
    }
    if (rivalOut) {
      rival.hp -= 1
      rival.alive = false
      snapshot.stats.roundsWon += 1
    }

    // The banner names one loser; when both go out, the player's own loss is the
    // one they need to see.
    snapshot.lastRound = {
      loser: playerOut ? 'player' : 'rival',
      reason,
      round: snapshot.round,
    }

    if (player.hp <= 0 || rival.hp <= 0) {
      const winner: FighterSide | 'draw'
        = player.hp <= 0 && rival.hp <= 0
          ? 'draw'
          : player.hp <= 0 ? 'rival' : 'player'

      // A draw has no single cause, so it is reported as a timeout-style result.
      resolve(
        winner === 'draw'
          ? { kind: 'timeout', winner: 'draw' }
          : reason === 'crash'
            ? { kind: 'crash', winner }
            : reason === 'obstacle'
              ? { kind: 'obstacle', winner }
              : { kind: 'cut', winner },
      )
      return
    }

    snapshot.phase = 'roundOver'
    snapshot.roundBreak = ROUND_BREAK
  }

  /** Launch the next round after the pause. */
  const startNextRound = (): void => {
    snapshot.round += 1
    snapshot.roundBreak = 0
    snapshot.phase = 'flying'
    roundAge = 0
    playerSnapWasActive = false

    relaunchFighter(player, PLAYER_ANCHOR_X, safeLaunchAltitude(PLAYER_ANCHOR_X))
    relaunchFighter(rival, RIVAL_ANCHOR_X, safeLaunchAltitude(RIVAL_ANCHOR_X))

    clashes.length = 0
    lineClashes.length = 0
    playerCables.length = 0
    rivalCables.length = 0
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

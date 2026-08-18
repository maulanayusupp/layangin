import {
  anchorsFor,
  COUNTDOWN_SECONDS,
  CRASH_ALTITUDE,
  CRASH_GRACE,
  FALL_TIMEOUT,
  FIXED_TIMESTEP,
  MAX_FIGHTERS,
  MAX_FRAME_TIME,
  livesFor,
  ROUND_BREAK,
  START_LINE_LENGTH,
  walkBoundFor,
} from './constants'
import { getKite } from '~/data/kites'
import { createRandom } from './math/random'
import * as V from './math/vector'
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
  type CableContact as Contact,
} from './physics/obstacles'
import { createWindField } from './physics/wind'
import { createAiInput, scaleAiProfile } from './input/ai'
import type { InputSource } from './input/source'
import {
  NEUTRAL_COMMAND,
  type ClashPoint,
  type FighterIndex,
  type FighterState,
  type MatchConfig,
  type MatchOutcome,
  type MatchSnapshot,
  type OpponentDefinition,
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
 * ## Two fighters or four
 * Everything is written against `snapshot.fighters`, with the human at index 0.
 * A duel is simply the two-element case. In a free-for-all every pair of lines is
 * tested against every other, so an opponent can cut another opponent — and the
 * round ends when the player goes out or only one line is left intact.
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
  /**
   * Overrides for the opponents' inputs, in `config.opponents` order. Any slot left
   * empty gets an AI built from that opponent's definition. Tests use this to drive
   * an opponent deterministically.
   */
  rivalInputs?: readonly (InputSource | undefined)[]
}

export function createMatchEngine({
  config,
  playerInput,
  rivalInputs,
}: MatchEngineOptions): MatchEngine {
  const { arena } = config

  // At least one opponent, at most a four-way sky.
  const opponents = config.opponents.slice(0, MAX_FIGHTERS - 1)
  if (opponents.length === 0) throw new Error('a match needs at least one opponent')

  /** The one the player chose on the ladder. It sets the conditions. */
  const primary = opponents[0] as OpponentDefinition
  const count = opponents.length + 1

  // Two independent streams so the AI's decisions cannot be shifted by a change
  // in how many gust samples the wind field happens to draw.
  const windRandom = createRandom(config.seed)

  // The arena shapes the air: a beach is windier and gustier than a rice field,
  // and an alley between buildings is slower but choppier.
  const wind = createWindField({
    referenceSpeed: primary.windSpeed * arena.windMultiplier,
    gustiness: primary.gustiness * arena.gustMultiplier,
    seed: windRandom.int(0, 0xffffff),
  })

  /**
   * Ground positions, player leftmost — that is, furthest upwind, since the wind
   * blows along +x. A duel therefore still stands at −7/+7 exactly as before.
   */
  const anchors = anchorsFor(count)
  const walkBound = walkBoundFor(count)
  // Fewer lives the more fighters there are — see `livesFor`.
  const lives = livesFor(count)

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

  const playerLoadout = resolveLoadout(config.player.kiteId, config.player.upgrades)

  const player = createFighter({
    side: 'player',
    index: 0,
    anchorX: anchors[0] as number,
    stats: playerLoadout.stats,
    reelSpeed: playerLoadout.reelSpeed,
    staminaEfficiency: playerLoadout.staminaEfficiency,
    kiteId: config.player.kiteId,
    paletteId: config.player.paletteId,
    patternId: config.player.patternId,
    effectId: config.player.effectId,
    minAltitude: safeLaunchAltitude(anchors[0] as number),
    walkBound,
    lives,
  })

  const fighters: FighterState[] = [player]
  const inputs: InputSource[] = [playerInput]

  opponents.forEach((opponent, slot) => {
    const anchorX = anchors[slot + 1] as number
    const loadout = resolveLoadout(opponent.kiteId, opponent.upgrades)

    fighters.push(createFighter({
      side: 'rival',
      index: slot + 1,
      opponentId: opponent.id,
      anchorX,
      stats: loadout.stats,
      reelSpeed: loadout.reelSpeed,
      staminaEfficiency: loadout.staminaEfficiency,
      kiteId: opponent.kiteId,
      paletteId: opponent.paletteId,
      patternId: opponent.patternId,
      effectId: opponent.effectId,
      minAltitude: safeLaunchAltitude(anchorX),
      walkBound,
      lives,
    }))

    inputs.push(
      rivalInputs?.[slot]
      ?? createAiInput({
        profile: scaleAiProfile(opponent.ai, config.difficultyScale),
        // Derived per slot so each opponent draws its own decisions rather than
        // marching in step with the others.
        random: createRandom(config.seed ^ (0x5bf03635 + slot * 0x9e3779b9)),
        clearance: clearanceFor,
        bounds: walkBound,
        windFactor: position => windFactorAt(arena, position),
      }),
    )
  })

  /** Collision margin per fighter: roughly the kite's own half-span. */
  const margins = fighters.map(fighter => getKite(fighter.kiteId).size / 2)

  const clashes: ClashPoint[] = []
  const lineClashes: ClashPoint[] = []
  const cables: Contact[][] = fighters.map(() => [])
  /** Whether each fighter's line is touching another's, from the previous step. */
  const contact: boolean[] = fighters.map(() => false)
  /** Who has already lost their line this round, so a life is deducted once. */
  const roundOut: boolean[] = fighters.map(() => false)

  /**
   * The opponent the HUD calls "them": the nearest kite still in the match. In a
   * duel that is simply the other fighter.
   */
  /** Scratch buffers, one per fighter, so the per-step sort allocates nothing. */
  const rivalLists: FighterState[][] = fighters.map(() => [])

  /**
   * Everyone else, nearest first. A downed or eliminated kite is pushed to the back
   * rather than dropped, so the list is never empty and callers always have someone
   * to read.
   */
  const rivalsOf = (self: FighterState): FighterState[] => {
    const list = rivalLists[self.index] as FighterState[]
    list.length = 0

    for (const other of fighters) {
      if (other !== self) list.push(other)
    }

    const rank = (other: FighterState): number =>
      V.distance(self.position, other.position)
      + (other.alive ? 0 : 1e4)
      + (other.eliminated ? 1e6 : 0)

    return list.sort((a, b) => rank(a) - rank(b))
  }

  const nearestRival = (self: FighterState): FighterState =>
    rivalsOf(self)[0] as FighterState

  const snapshot: MatchSnapshot = {
    startingHp: lives,
    phase: 'countdown',
    outcome: { kind: 'pending' },
    arena,
    fighters,
    elapsed: 0,
    timeLimit: config.timeLimit,
    countdown: COUNTDOWN_SECONDS,
    round: 1,
    lastRound: null,
    roundBreak: 0,
    player,
    rival: fighters[1] as FighterState,
    wind: wind.sample(player.position.y),
    windSpeed: primary.windSpeed * arena.windMultiplier,
    clashes,
    stats: {
      durationSeconds: 0,
      clashSeconds: 0,
      peakTension: 0,
      snapsUsed: 0,
      peakAltitude: 0,
      roundsWon: 0,
      roundsLost: 0,
      opponentsBeaten: 0,
    },
  }

  let accumulator = 0
  let countdown = COUNTDOWN_SECONDS
  let stepCount = 0
  let playerSnapWasActive = false
  /** Seconds since the current round launched, for the crash grace period. */
  let roundAge = 0
  /** Outcome held back while the deciding kite is still falling. */
  let pendingOutcome: MatchOutcome | null = null
  let fallTimer = 0
  /** Why the most recent fighter went out, for the result kind. */
  let lastReason: RoundEndReason = 'cut'

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

  /** Advance every kite in a non-playing phase: survivors fly, cut kites tumble. */
  const coast = (dt: number, winds: readonly WindSample[]): void => {
    for (const fighter of fighters) {
      const fighterWind = winds[fighter.index] as WindSample
      if (fighter.alive) stepFighter(fighter, NEUTRAL_COMMAND, fighterWind, windDirection, dt)
      else driftCutKite(fighter, fighterWind, dt)
    }
  }

  const simulate = (dt: number): void => {
    wind.update(dt)

    const winds = fighters.map(windFor)
    snapshot.wind = winds[0] as WindSample
    snapshot.windSpeed = wind.currentReferenceSpeed()
    snapshot.rival = nearestRival(player)

    if (snapshot.phase === 'resolved') {
      // Let the losing kites tumble away downwind so the result reads visually.
      for (const fighter of fighters) {
        if (!fighter.alive) driftCutKite(fighter, winds[fighter.index] as WindSample, dt)
      }
      return
    }

    if (snapshot.phase === 'falling') {
      // Everything keeps moving: the cut kites tumble down, survivors fly on.
      coast(dt, winds)
      fallTimer -= dt

      // Resolve once every cut kite has reached the ground, or the wind has carried
      // one sideways for long enough that waiting stops being interesting.
      const grounded = fighters.every(
        fighter => fighter.alive || fighter.position.y <= CRASH_ALTITUDE,
      )

      if ((grounded || fallTimer <= 0) && pendingOutcome) {
        resolve(pendingOutcome)
        pendingOutcome = null
      }
      return
    }

    if (snapshot.phase === 'roundOver') {
      // The cut kite tumbles away while the survivors keep flying, so the pause
      // shows the consequence instead of freezing the arena.
      coast(dt, winds)

      // The match clock does not run during the break.
      snapshot.roundBreak = Math.max(0, snapshot.roundBreak - dt)
      if (snapshot.roundBreak === 0) startNextRound()
      return
    }

    for (const fighter of fighters) {
      const fighterWind = winds[fighter.index] as WindSample

      /**
       * A fighter cut earlier in this round keeps tumbling while the others fight on.
       *
       * In a duel this never came up — a cut ended the round immediately. With three
       * or four in the air the round carries on without whoever went out, and their
       * kite has to keep falling; left on `stepFighter` alone it would hang frozen
       * in the sky for the rest of the round.
       */
      if (!fighter.alive) {
        driftCutKite(fighter, fighterWind, dt)
        continue
      }

      const rivals = rivalsOf(fighter)

      const command = (inputs[fighter.index] as InputSource).sample({
        self: fighter,
        opponent: rivals[0] as FighterState,
        others: rivals,
        wind: fighterWind,
        // Contact from the previous step: this step's clashes are not known
        // until the fighters have moved, and one step of latency is imperceptible.
        contact: contact[fighter.index] as boolean,
        elapsed: snapshot.elapsed,
        dt,
      })

      stepFighter(fighter, command, fighterWind, windDirection, dt)
    }

    // --- Contacts -----------------------------------------------------------
    clashes.length = 0

    detectClashes(fighters, lineClashes)
    for (const clash of lineClashes) clashes.push(clash)
    const abrasion = applyAbrasion(fighters, lineClashes, dt)

    for (let i = 0; i < contact.length; i += 1) contact[i] = false
    for (const clash of lineClashes) {
      contact[clash.a] = true
      contact[clash.b] = true
    }

    // Arena cables cut without being cut back.
    for (const fighter of fighters) {
      const own = cables[fighter.index] as Contact[]
      own.length = 0
      findCableContacts(arena, fighter, own)
      applyCableWear(fighter, own, dt, clashes)
    }

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
    // Losing a line costs one life, not the match. Everyone who goes out on the
    // same step pays, which is the fair reading of a simultaneous cut.
    for (const fighter of fighters) {
      if (fighter.alive || roundOut[fighter.index]) continue
      markOut(fighter, (cables[fighter.index] as Contact[]).length > 0 ? 'cable' : 'cut')
    }

    // Hitting a structure or the ground also costs a life, but only after the
    // grace period so a round is never lost to the launch attitude.
    if (roundAge > CRASH_GRACE) {
      for (const fighter of fighters) {
        if (roundOut[fighter.index]) continue

        if (findCollision(arena, fighter.position, margins[fighter.index] as number) !== null) {
          fighter.alive = false
          markOut(fighter, 'obstacle')
        }
        else if (hasCrashed(fighter)) {
          fighter.alive = false
          markOut(fighter, 'crash')
        }
      }
    }

    /**
     * The round is over when the player goes out, or when only one line is left.
     *
     * The player's own cut ends it even with opponents still flying: watching two
     * AI flyers finish a duel you are no longer in is not a game. The other way
     * round, the player is welcome to stand back and let the opponents cut each
     * other — which is exactly the tactic a free-for-all should reward.
     */
    const contenders = fighters.filter(fighter => !roundOut[fighter.index]).length
    if (roundOut[0] || contenders <= 1) {
      closeRound()
      return
    }

    if (snapshot.elapsed >= snapshot.timeLimit) resolveOnTime()
  }

  /**
   * Deduct a life and record what happened.
   *
   * Called at most once per fighter per round. A fighter out of lives is out of the
   * match — in a free-for-all the sky thins out as the rounds go by.
   */
  const markOut = (fighter: FighterState, reason: RoundEndReason): void => {
    roundOut[fighter.index] = true
    fighter.hp -= 1
    lastReason = reason

    if (fighter.hp <= 0) {
      fighter.hp = 0
      fighter.eliminated = true
      if (fighter.side === 'rival') snapshot.stats.opponentsBeaten += 1
    }

    if (fighter.side === 'player') snapshot.stats.roundsLost += 1
    else snapshot.stats.roundsWon += 1

    // The banner names one loser, and the player's own loss is the one they need
    // to see, so it is never overwritten by an opponent's.
    if (!snapshot.lastRound || snapshot.lastRound.round !== snapshot.round
      || (fighter.side === 'player' && !snapshot.lastRound.loserIsPlayer)) {
      snapshot.lastRound = {
        loser: fighter.index,
        loserIsPlayer: fighter.side === 'player',
        reason,
        round: snapshot.round,
      }
    }
  }

  /** 0..1 score used to rank fighters when nobody has been cut out. */
  const standing = (fighter: FighterState): number =>
    fighter.hp * 10 + fighter.lineIntegrity

  /** Time out: more lives wins, then the healthier line. A dead heat draws. */
  const resolveOnTime = (): void => {
    const ranked = fighters
      .filter(fighter => !fighter.eliminated)
      .sort((a, b) => standing(b) - standing(a))

    const leader = ranked[0]
    if (!leader) {
      resolve({ kind: 'timeout', winner: 'draw' })
      return
    }

    const runnerUp = ranked[1]
    const tied = runnerUp !== undefined
      && runnerUp.hp === leader.hp
      && Math.abs(runnerUp.lineIntegrity - leader.lineIntegrity) < 0.02

    resolve({ kind: 'timeout', winner: tied ? 'draw' : leader.index })
  }

  /**
   * Close a round.
   *
   * Either resolves the match or opens the between-rounds pause. Nothing is
   * relaunched here — that happens when the pause expires, so the cut kite has
   * time to tumble away on screen.
   */
  const closeRound = (): void => {
    const rivalsLeft = fighters.filter(
      fighter => fighter.side === 'rival' && !fighter.eliminated,
    ).length

    if (player.eliminated || rivalsLeft === 0) {
      const winner: FighterIndex | 'draw'
        = player.eliminated && rivalsLeft === 0
          ? 'draw'
          : player.eliminated
            ? nearestRival(player).index
            : 0

      // A draw has no single cause, so it is reported as a timeout-style result.
      pendingOutcome
        = winner === 'draw'
          ? { kind: 'timeout', winner: 'draw' }
          : lastReason === 'crash'
            ? { kind: 'crash', winner }
            : lastReason === 'obstacle'
              ? { kind: 'obstacle', winner }
              : { kind: 'cut', winner }

      // Hold the result back until the kite is down — see the `falling` phase.
      snapshot.phase = 'falling'
      fallTimer = FALL_TIMEOUT
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

    for (const fighter of fighters) {
      // An eliminated fighter stays out. Its kite is put on the ground so the
      // arena shows who is finished rather than leaving it hanging mid-air.
      if (fighter.eliminated) {
        roundOut[fighter.index] = true
        fighter.alive = false
        fighter.position.y = 0
        fighter.velocity.x = 0
        fighter.velocity.y = 0
        fighter.linePoints.length = 0
        continue
      }

      roundOut[fighter.index] = false
      relaunchFighter(
        fighter,
        anchors[fighter.index] as number,
        safeLaunchAltitude(anchors[fighter.index] as number),
      )
    }

    clashes.length = 0
    lineClashes.length = 0
    for (let i = 0; i < contact.length; i += 1) contact[i] = false
    for (const own of cables) own.length = 0
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
            for (const fighter of fighters) {
              stepFighter(
                fighter, NEUTRAL_COMMAND, windFor(fighter), windDirection, FIXED_TIMESTEP,
              )
            }
            stepCount += 1
          }
          snapshot.wind = windFor(player)
          snapshot.rival = nearestRival(player)
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
      for (const input of inputs) input.dispose?.()
    },
  }
}

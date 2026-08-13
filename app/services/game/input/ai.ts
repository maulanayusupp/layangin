import { MAX_LINE_LENGTH, MIN_LINE_LENGTH, SNAP_STAMINA_COST } from '../constants'
import { clamp, clamp01, lerp } from '../math/scalar'
import type { RandomSource } from '../math/random'
import * as V from '../math/vector'
import type { AiProfile, FighterCommand, FighterState } from '../types'
import type { InputContext, InputSource } from './source'

/**
 * AI fighter.
 *
 * The AI plays the game the same way a person does: it looks at where both
 * kites are, decides on a plan, and then holds that plan for its reaction time
 * before reconsidering. It reads only `self`, `opponent` and `wind` — the same
 * information the HUD shows the player — and every difficulty knob is a human
 * limitation:
 *
 * - `reactionTime` — how long a stale plan is held.
 * - `precision` — how much noise is added to the target it aims for.
 * - `discipline` — whether it husbands stamina and spends snaps well.
 * - `mistakeRate` — chance of committing to an actively bad plan.
 * - `caution` — how readily it breaks off a losing exchange.
 *
 * A boss is not given extra grip or a stronger line; it simply behaves like
 * someone who has flown for twenty years.
 */

interface AiPlan {
  /** Line length the AI is trying to settle at, metres. */
  targetLineLength: number
  /** Ground position it wants to stand at, metres. */
  targetAnchorX: number
  /** True while it is actively trying to saw through the player's line. */
  engaging: boolean
  /** True when it wants to fire a snap as soon as it is allowed. */
  wantsSnap: boolean
  /** Deliberate blunder: hold a plan that loses ground. */
  blundering: boolean
}

export interface AiOptions {
  profile: AiProfile
  random: RandomSource
  /**
   * Height the AI must stay above, in metres — the tallest hazard between its
   * anchor and its kite, plus a margin. Without this the reel controller happily
   * hauls its own kite straight into a building, which is exactly what it used
   * to do: an arena obstacle would end a round two seconds in.
   */
  clearance: (fromX: number, toX: number) => number
}

export function createAiInput({ profile, random, clearance }: AiOptions): InputSource {
  const command: FighterCommand = { reel: 0, walk: 0, snap: false }

  let plan: AiPlan = {
    targetLineLength: 70,
    targetAnchorX: 9,
    engaging: false,
    wantsSnap: false,
    blundering: false,
  }
  let timeUntilRethink = 0

  /** Noise scaled by how imprecise this fighter is. */
  const jitter = (magnitude: number): number =>
    random.gaussian() * magnitude * (1 - profile.precision)

  const decide = (context: InputContext): AiPlan => {
    const { self, opponent } = context

    const opponentAltitude = opponent.position.y
    const losing = self.lineIntegrity < opponent.lineIntegrity - 0.12
    const winning = self.lineIntegrity > opponent.lineIntegrity + 0.12

    // Break off when the exchange is going badly and this fighter is careful.
    const shouldRetreat = losing && random.next() < profile.caution

    // Height is the currency of a kite duel: get above the other line and your
    // own line presses down on theirs.
    const wanted = shouldRetreat
      ? Math.max(28, opponentAltitude - 18)
      : opponentAltitude + lerp(6, 26, profile.aggression)

    // Never aim below the hazards in between. A careless flyer would clip them,
    // but that is a mistake the mistake system should choose deliberately —
    // not something the controller does on every single arena with a building.
    const floor = clearance(self.anchor.x, self.position.x)
    const desiredAltitude = Math.max(wanted, floor)

    // Approximate the line length needed to sit at that altitude, given the line
    // typically flies at 40–70° depending on wind.
    const targetLineLength = clamp(
      desiredAltitude / 0.72 + jitter(14),
      // The lower bound has to respect the clearance too, or the reel controller
      // undoes the altitude decision the moment it saturates.
      Math.max(MIN_LINE_LENGTH + 6, floor / 0.72),
      MAX_LINE_LENGTH - 10,
    )

    // Stand so the lines cross: move under the opponent's kite when attacking,
    // and away from it when retreating.
    const attackAnchor = opponent.position.x - Math.sign(opponent.position.x - self.anchor.x) * 6
    const retreatAnchor = self.anchor.x - Math.sign(opponent.position.x - self.anchor.x) * 14
    const targetAnchorX = (shouldRetreat ? retreatAnchor : attackAnchor) + jitter(7)

    const engaging = !shouldRetreat && random.next() < 0.35 + profile.aggression * 0.6

    // A disciplined fighter saves the snap for a real crossing and keeps enough
    // stamina in reserve; an undisciplined one yanks whenever it can.
    const staminaFloor = lerp(SNAP_STAMINA_COST, 0.45, profile.discipline)
    const wantsSnap
      = self.stamina > staminaFloor
        && (winning || engaging)
        && random.next() < lerp(0.25, 0.85, profile.aggression) * (0.4 + profile.discipline * 0.6)

    return {
      targetLineLength,
      targetAnchorX: clamp(targetAnchorX, -24, 24),
      engaging,
      wantsSnap,
      blundering: random.next() < profile.mistakeRate,
    }
  }

  const reelToward = (self: FighterState, target: number): number => {
    const error = V.distance(self.anchor, self.position) - target
    // Proportional controller, saturating at full haul/pay-out.
    return clamp(error * 0.06, -1, 1)
  }

  return {
    kind: 'ai',

    sample(context: InputContext): FighterCommand {
      timeUntilRethink -= context.dt

      if (timeUntilRethink <= 0) {
        plan = decide(context)
        // Vary the interval a little so the AI does not feel metronomic.
        timeUntilRethink = profile.reactionTime * (0.75 + random.next() * 0.5)
      }

      const { self } = context

      // Hauling in shortens the line; the controller wants a *longer* line when
      // the error is negative, so the sign is inverted here.
      let reel = -reelToward(self, plan.targetLineLength)

      // Keeping the line tauter than the opponent's is what wins the exchange,
      // so an engaging fighter biases toward haul.
      if (plan.engaging) {
        reel = clamp(reel + lerp(0.15, 0.55, profile.aggression), -1, 1)
      }

      // Out of breath: ease off rather than hauling ineffectively.
      if (self.stamina < 0.18 && profile.discipline > 0.5) {
        reel = Math.min(reel, 0)
      }

      let walk = clamp((plan.targetAnchorX - self.anchor.x) * 0.18, -1, 1)

      if (plan.blundering) {
        // A real mistake: pay line out at the worst moment, or walk the wrong way.
        if (random.next() < 0.5) reel = -Math.abs(reel)
        else walk = -walk
      }

      // Hard floor: whatever the plan said, do not haul the kite down into a
      // hazard. Paying out is still allowed — that is how it climbs away.
      const floor = clearance(self.anchor.x, self.position.x)
      if (floor > 0 && self.position.y < floor + 6) {
        reel = Math.min(reel, 0)
      }

      command.reel = clamp(reel + jitter(0.08), -1, 1)
      command.walk = clamp(walk + jitter(0.1), -1, 1)
      command.snap = plan.wantsSnap && self.snapCooldown === 0

      // Consume the intent so one plan fires at most one snap.
      if (command.snap) plan.wantsSnap = false

      return command
    },
  }
}

/**
 * Difficulty scaling for repeat runs of the ladder. Sharpens reactions and
 * precision only — never gear — so the fight stays winnable with skill.
 */
export function scaleAiProfile(profile: AiProfile, scale: number): AiProfile {
  if (scale <= 1) return profile
  const tighten = clamp01((scale - 1) * 0.35)

  return {
    reactionTime: Math.max(0.16, profile.reactionTime * (1 - tighten * 0.5)),
    aggression: clamp01(profile.aggression + tighten * 0.15),
    precision: clamp01(profile.precision + tighten * 0.2),
    discipline: clamp01(profile.discipline + tighten * 0.2),
    mistakeRate: Math.max(0.01, profile.mistakeRate * (1 - tighten)),
    caution: profile.caution,
  }
}

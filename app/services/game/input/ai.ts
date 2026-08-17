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
 *
 * In a free-for-all each opponent gets its own instance and its own random stream,
 * and `context.opponent` is whichever kite is nearest — so they fight each other as
 * readily as they fight the player, with no notion that the human is special.
 */

/**
 * How far to the side of the opponent the AI stands when contesting, metres.
 * This is the separation that sets the crossing altitude — see PLAYER_ANCHOR_X.
 */
const CONTEST_OFFSET = 13

/** How far to walk away when breaking off, metres. */
const RETREAT_OFFSET = 20

/**
 * Altitude below which the AI drops its plan and just flies, metres.
 * Comfortably above `CRASH_ALTITUDE` so there is room to recover.
 */
const RECOVERY_ALTITUDE = 16

/**
 * How long the AI commits to a chosen side before reconsidering, seconds.
 *
 * The side decision compares its own line's elevation against the opponent's —
 * but acting on that decision *changes* its own elevation, so re-deciding every
 * reaction interval made the AI oscillate between sides and never settle into a
 * geometry where the lines actually cross. The sharper the fighter, the tighter
 * the oscillation: contact time collapsed to a second or two at the top tiers.
 *
 * Committing for several seconds is both the fix and the more human behaviour —
 * a flyer picks a side and works it.
 */
const SIDE_COMMITMENT = 5.5

/**
 * How long the AI stays on one target before reconsidering, seconds.
 *
 * Longer than the side commitment on purpose: switching target invalidates the side
 * decision, and a fighter that re-picks every few seconds spends the whole match
 * walking between two opponents instead of fighting either.
 */
const TARGET_COMMITMENT = 7.5

/**
 * How much more attractive the human is than another AI, before distance.
 *
 * Not flavour — balance. With purely nearest-target selection a passive player
 * standing at the end of a widened field was ignored: measured over six seeds a
 * player giving no input at all won 6 of 6 four-way matches against the top tier,
 * because the AI flyers cut each other and left the human alone. Weighting the
 * human above another AI restores the pressure while still leaving room for
 * opponent-versus-opponent cuts, which are the point of a free-for-all.
 */
const PLAYER_APPEAL = 2.6

/**
 * How much of its reaction time the AI takes to answer a contact, 0..1.
 *
 * Below 1 because feeling the other line is a reflex, not a decision — you know it
 * is there before you have worked out what to do about it. Not 0, because that was
 * the bug: the response fired 8 ms after the lines touched for every opponent on
 * the ladder, including the beginner whose reaction time is nominally 0.95 s.
 *
 * Swept against a scripted player that hauls, yanks and walks (win rate out of 48):
 *
 * ```
 * share 0.35   26   share 0.7   34
 * share 0.5    29   share 1.0   37
 * ```
 *
 * Half keeps a passive player at 0/48 — doing nothing must still lose — while
 * leaving the first three tiers winnable with active play and the last two a wall.
 */
const CONTACT_REACTION_SHARE = 0.5

interface AiPlan {
  /** Fighter index this plan is aimed at. */
  target: number
  /** Line length the AI is trying to settle at, metres. */
  targetLineLength: number
  /** Ground position it wants to stand at, metres. */
  targetAnchorX: number
  /** True while it is actively trying to saw through the player's line. */
  engaging: boolean
  /** True when it wants to fire a snap as soon as it is allowed. */
  wantsSnap: boolean
  /** True when the plan is to be the flatter of the two lines. */
  flyShallower: boolean
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
  /**
   * How far from centre the AI may plan to stand, metres. Matches the fighter's own
   * walk bound, which widens with the number of fighters — a hard 24 m would pin the
   * outer flyers of a four-way against the edge.
   */
  bounds: number
}

export function createAiInput({ profile, random, clearance, bounds }: AiOptions): InputSource {
  const command: FighterCommand = { reel: 0, walk: 0, snap: false }

  let plan: AiPlan = {
    target: 0,
    targetLineLength: 70,
    targetAnchorX: 9,
    engaging: false,
    flyShallower: false,
    wantsSnap: false,
    blundering: false,
  }
  let timeUntilRethink = 0
  /**
   * How long the lines have been touching, seconds. Reset the moment they part.
   *
   * The contact response is gated on this rather than firing immediately — see the
   * note where it is applied.
   */
  let contactFor = 0
  /** Seconds left on the current side commitment. */
  let sideCommitment = 0
  /** Seconds left before the target is reconsidered. */
  let targetCommitment = 0

  /** Noise scaled by how imprecise this fighter is. */
  const jitter = (magnitude: number): number =>
    random.gaussian() * magnitude * (1 - profile.precision)

  /**
   * Pick who to fight.
   *
   * Weighted by how appealing each kite is and how far away it is — a nearby line is
   * easier to reach than a distant one, and the human's line is the prize. A fighter
   * already out of the match is never chosen.
   */
  const chooseTarget = (context: InputContext): FighterState => {
    const candidates = context.others.filter(other => other.alive && !other.eliminated)
    if (candidates.length <= 1) return candidates[0] ?? context.opponent

    const weights = candidates.map((other) => {
      const appeal = other.side === 'player' ? PLAYER_APPEAL : 1
      const reach = V.distance(self0(context).position, other.position)
      // Inverse-distance falloff, floored so a far opponent is unlikely, not impossible.
      return appeal / (1 + reach / 30)
    })

    const total = weights.reduce((sum, weight) => sum + weight, 0)
    let roll = random.next() * total

    for (let i = 0; i < candidates.length; i += 1) {
      roll -= weights[i] as number
      if (roll <= 0) return candidates[i] as FighterState
    }

    return candidates[candidates.length - 1] as FighterState
  }

  /** Tiny helper so `chooseTarget` reads without destructuring twice. */
  const self0 = (context: InputContext): FighterState => context.self

  const decide = (context: InputContext): AiPlan => {
    const { self } = context

    /**
     * Hold the current target while the commitment lasts, and only then re-pick.
     * If the held target has gone out, re-pick immediately — there is nothing left
     * to fight there.
     */
    const held = context.others.find(other => other.index === plan.target)
    const keepTarget = targetCommitment > 0 && held?.alive === true && !held.eliminated

    const opponent = keepTarget ? held : chooseTarget(context)
    if (!keepTarget) targetCommitment = TARGET_COMMITMENT

    const losing = self.lineIntegrity < opponent.lineIntegrity - 0.12
    const winning = self.lineIntegrity > opponent.lineIntegrity + 0.12

    // Break off when the exchange is going badly and this fighter is careful.
    const shouldRetreat = losing && random.next() < profile.caution
    const engaging = !shouldRetreat && random.next() < 0.35 + profile.aggression * 0.6

    /**
     * Seek a crossing, not just altitude.
     *
     * Two lines only cross when their elevations differ, and the crossing only
     * exists if the *shallower* line belongs to the fighter standing further
     * upwind. So a crossing is a two-part decision: which side to stand on, and
     * whether to fly shallower or steeper than the opponent.
     *
     * Reeling — in either direction — always costs elevation, because the line
     * drags the kite off its equilibrium arc. A fighter holding neutral therefore
     * flies the steepest line available, and one that reels can only ever be the
     * shallower of the two. That asymmetry is what the plan below works with:
     * whichever side of the opponent it is on, it aims for the elevation that side
     * requires, rather than blindly climbing.
     *
     * Aiming purely for "above the opponent" was the old behaviour, and it paid
     * line out until the kite hung 90 m downwind on a slack line, stalled, and
     * sank — which read on screen as an AI that refused to fight.
     */
    const elevationOf = (fighter: FighterState): number => {
      const offset = V.subtract(fighter.position, fighter.anchor)
      return Math.atan2(Math.max(0, offset.y), Math.abs(offset.x) + 1e-6)
    }

    const opponentSpan = V.distance(opponent.anchor, opponent.position)
    const opponentElevation = elevationOf(opponent)
    const selfElevation = elevationOf(self)

    /**
     * Play to the hand we have: if we are already the flatter line, take the
     * upwind side; if we are the steeper one, take the downwind side.
     *
     * Held for `SIDE_COMMITMENT` once chosen — see the note there. Retreating
     * always re-decides, because the point of retreating is to change the plan.
     */
    const flyShallower = sideCommitment > 0 && !shouldRetreat
      ? plan.flyShallower
      : selfElevation <= opponentElevation

    if (sideCommitment <= 0 || shouldRetreat) sideCommitment = SIDE_COMMITMENT
    const attackAnchor = opponent.anchor.x + (flyShallower ? -CONTEST_OFFSET : CONTEST_OFFSET)

    // Shallower wants a longer line and active reeling; steeper wants to be left
    // alone near the equilibrium arc.
    const contestSpan = flyShallower ? opponentSpan * 1.15 : opponentSpan * 0.95

    const floor = clearance(self.anchor.x, self.position.x)

    const targetLineLength = clamp(
      (shouldRetreat ? opponentSpan * 1.4 : contestSpan) + jitter(9),
      // Respect the arena's hazards, and never wind in so far that the kite ends
      // up in the weak air near the ground.
      Math.max(MIN_LINE_LENGTH + 12, floor / 0.72),
      // Well short of the maximum: a very long line is slack line, and slack line
      // is a stalled kite.
      Math.min(MAX_LINE_LENGTH - 10, 130),
    )

    const retreatAnchor
      = self.anchor.x + (self.anchor.x > opponent.anchor.x ? RETREAT_OFFSET : -RETREAT_OFFSET)
    const targetAnchorX = (shouldRetreat ? retreatAnchor : attackAnchor) + jitter(5)

    // A disciplined fighter saves the snap for a real crossing and keeps enough
    // stamina in reserve; an undisciplined one yanks whenever it can.
    const staminaFloor = lerp(SNAP_STAMINA_COST, 0.45, profile.discipline)
    const wantsSnap
      = self.stamina > staminaFloor
        && (winning || engaging)
        && random.next() < lerp(0.25, 0.85, profile.aggression) * (0.4 + profile.discipline * 0.6)

    return {
      target: opponent.index,
      targetLineLength,
      targetAnchorX: clamp(targetAnchorX, -bounds, bounds),
      engaging,
      flyShallower,
      wantsSnap,
      blundering: random.next() < profile.mistakeRate,
    }
  }

  /**
   * Proportional controller on line length, saturating at full haul/pay-out.
   *
   * A positive result means haul in. When the kite is further out than the plan
   * wants, `error` is positive and hauling is exactly the correction needed — so
   * the result is used directly. Negating it (as this once did) drove the line
   * length *away* from the target until it saturated at the minimum, which
   * dragged the AI's own kite down to the ground and made it look like it was
   * refusing to fight.
   */
  const reelToward = (self: FighterState, target: number): number => {
    const error = V.distance(self.anchor, self.position) - target
    return clamp(error * 0.06, -1, 1)
  }

  return {
    kind: 'ai',

    sample(context: InputContext): FighterCommand {
      timeUntilRethink -= context.dt
      sideCommitment -= context.dt
      targetCommitment -= context.dt
      contactFor = context.contact ? contactFor + context.dt : 0

      if (timeUntilRethink <= 0) {
        plan = decide(context)
        // Vary the interval a little so the AI does not feel metronomic.
        timeUntilRethink = profile.reactionTime * (0.75 + random.next() * 0.5)
      }

      const { self } = context

      let reel = reelToward(self, plan.targetLineLength)

      /**
       * Reeling costs elevation, so it is only wanted by the fighter that needs to
       * be the flatter line. The steeper one holds still and lets the kite settle
       * on its equilibrium arc — a standing haul here would flatten exactly the
       * line it is trying to keep steep.
       */
      if (plan.engaging && plan.flyShallower) {
        reel = Math.min(reel, -lerp(0.15, 0.5, profile.aggression))
      }

      /**
       * Once the lines are touching, geometry no longer matters — tension does.
       *
       * Hauling is what wins an exchange, because the taut line is the blade. So
       * on contact the AI abandons its positioning plan and pulls, exactly as a
       * flyer does the moment they feel the other line. Without this the AI spent
       * every exchange as the slacker line and could not win a single one: a player
       * who did nothing at all beat every opponent.
       *
       * **It has to wait for its own reaction time first.** This override lived
       * outside the reaction gate, so the single most decisive action in the game
       * fired 8 ms after the lines touched — for *every* opponent, including the
       * first one on the ladder whose reaction time is nominally 0.95 s. Difficulty
       * here is supposed to come only from human-shaped limits, and `/compliance`
       * says so; an instant reflex is not one. Measured, the gap it created is
       * large: a scripted player reacting in 0.25 s won 18 of 48, and the same
       * player reacting instantly won 26.
       */
      if (contactFor >= profile.reactionTime * CONTACT_REACTION_SHARE) {
        reel = Math.max(reel, lerp(0.2, 0.65, profile.aggression))
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

      /**
       * Self-preservation, above every other consideration.
       *
       * Reeling costs elevation, so a fighter committed to being the flatter line
       * will fly itself into the ground if nothing stops it. Below this altitude it
       * abandons the plan and holds neutral, which is the only input that lets the
       * kite climb back to its equilibrium arc.
       */
      if (self.position.y < RECOVERY_ALTITUDE) {
        // A gentle haul, not neutral: a sinking kite is usually on a slack line,
        // and taking that slack up is what restores the airspeed it needs to fly.
        reel = 0.35
        walk = 0
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

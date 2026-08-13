import { ABRASION_COEFFICIENT, SNAP_FORCE_MULTIPLIER } from '../constants'
import { clamp01 } from '../math/scalar'
import * as V from '../math/vector'
import { breakingTension } from './fighter'
import type { ClashPoint, FighterState } from '../types'

/**
 * Line-vs-line combat — *sangkutan*.
 *
 * A kite duel is won by abrading the opponent's line where the two cross. Three
 * things decide how fast that happens, and all three are under player control:
 *
 * 1. **Slip speed** — line only cuts while it is sliding. Standing still with
 *    the lines merely touching does nothing; hauling, paying out, or yanking
 *    (*sentak*) drags abrasive line across the contact point.
 *
 * 2. **Normal force** — how hard the two lines press together. This peaks when
 *    both lines are taut *and* they cross near a right angle; a glancing
 *    contact barely bites.
 *
 * 3. **Tension share** — the tauter line behaves like the blade and the slacker
 *    one like the workpiece. Keeping your line tighter than theirs is the core
 *    skill of the whole game, and it is the reason `aShare` below is a
 *    ratio of tensions rather than a constant.
 *
 * All of it is **pairwise**. In a free-for-all every pair of fighters is tested
 * against every other, so a third flyer's line can cut yours while you are busy
 * with the second — and two opponents can just as easily take each other out.
 *
 * Abrasion is then divided by the defender's `lineStrength` (gear and upgrades)
 * and multiplied by the attacker's `cutPower` (their *gelasan*, the abrasive
 * coating traditionally made from crushed glass and glue).
 */

/** Squared distance beyond which two crossings are treated as the same contact. */
const CLASH_MERGE_DISTANCE_SQ = 4

/**
 * Divisor turning the compressed contact figure into the 0..1 intensity the
 * renderer and the sound engine use. See `clashIntensity`.
 */
const CLASH_INTENSITY_SCALE = 0.95

/**
 * Floor for a contact that is actually happening.
 *
 * Sliding line makes a noise the moment it slides, and it throws visible dust.
 * Whether the flyers happen to be holding 2% or 15% of breaking tension changes
 * *how loud*, not *whether*. Without a floor the presentation inherited the raw
 * force spread and the first fight in the game was effectively silent — measured
 * mean intensity 0.027 at tier 1 against 0.509 at tier 4, which is an absolute
 * gain of about 0.003 once the mixer has had its say.
 *
 * This is a presentation decision and deliberately not a physical claim. Damage
 * still comes from `applyAbrasion`, which reads pressure and slip directly.
 */
const CLASH_PRESENCE_FLOOR = 0.28

/** Below this sliding speed there is no contact sound at all, in m/s. */
const SILENT_SLIP = 0.05

/**
 * 0..1 figure the renderer and the mixer use for one crossing.
 *
 * Compressed with square roots for the same reason `applyAbrasion` is: the raw
 * product `pressure × slip` spans about twenty-seven times across the ladder,
 * because tension goes as the square of wind speed and the boss fights are windy.
 * Linear response therefore meant tier 1 was inaudible and invisible while tier 4
 * saturated. Measured after compression the mean sits between 0.41 and 0.70 at
 * every tier — see TODO.md.
 */
export function clashIntensity(pressure: number, slip: number, bite: number): number {
  if (slip < SILENT_SLIP) return 0

  const compressed = (Math.sqrt(pressure) * Math.sqrt(slip) * bite) / CLASH_INTENSITY_SCALE
  return clamp01(CLASH_PRESENCE_FLOOR + (1 - CLASH_PRESENCE_FLOOR) * compressed)
}

/**
 * How hard the two lines press together, as a 0..1-ish figure.
 *
 * Deliberately expressed as each line's load **relative to its own breaking
 * tension**, not in newtons. Absolute tension scales with the square of wind
 * speed and with sail area, so it runs about eleven times higher in the final
 * boss's windy afternoon than in the first fight. Calibrating abrasion against
 * newtons therefore made a first-tier duel take longer than the three-minute time
 * limit while a top-tier one was decided in seconds.
 *
 * Using relative load keeps a duel the same length at every tier, and keeps the
 * thing that decides it the same too: whoever holds the tauter line for their
 * gear. Physically it is also the better measure — what frays a line is the force
 * it carries compared to what it can take.
 */
export function contactPressure(player: FighterState, rival: FighterState): number {
  const playerLoad = player.tension / breakingTension(player.stats)
  const rivalLoad = rival.tension / breakingTension(rival.stats)

  // Harmonic-style mean: two taut lines press hard, one slack line does not.
  const total = playerLoad + rivalLoad
  return total < 1e-6 ? 0 : (2 * playerLoad * rivalLoad) / total
}

export interface AbrasionResult {
  /** Integrity removed this step, indexed like `fighters`. */
  damage: number[]
  /** True while at least one line-on-line crossing exists. */
  engaged: boolean
}

/**
 * Find every point where two given flying lines cross, **appending** to `out`.
 *
 * Appends rather than replaces so the caller can sweep every pair into one list.
 * With 24 segments per line this is 576 segment pairs per pair of fighters,
 * pre-filtered by bounding box — cheap enough to run at the full 120 Hz rate even
 * for the six pairs a four-way free-for-all produces.
 */
export function detectPairClashes(
  player: FighterState,
  rival: FighterState,
  out: ClashPoint[],
): ClashPoint[] {
  const a = player.linePoints
  const b = rival.linePoints
  if (a.length < 2 || b.length < 2) return out
  if (!player.alive || !rival.alive) return out

  // Only merge duplicates found for *this* pair. Two different pairs can legitimately
  // cross within a couple of metres of each other in a crowded sky.
  const pairStart = out.length

  const snapMultiplier
    = player.snapActive > 0 || rival.snapActive > 0 ? SNAP_FORCE_MULTIPLIER : 1

  // Line material slides past the contact point when either fighter is reeling,
  // and the kites' own motion drags the line as well.
  const slip
    = (Math.abs(player.reelRate) + Math.abs(rival.reelRate)
      + 0.35 * (V.length(player.velocity) + V.length(rival.velocity)))
    * snapMultiplier

  const totalTension = player.tension + rival.tension
  const aShare = totalTension < 1e-3 ? 0.5 : clamp01(player.tension / totalTension)

  const pressure = contactPressure(player, rival)

  for (let i = 0; i < a.length - 1; i += 1) {
    const a1 = a[i] as V.Vec2
    const a2 = a[i + 1] as V.Vec2

    const aMinX = Math.min(a1.x, a2.x)
    const aMaxX = Math.max(a1.x, a2.x)
    const aMinY = Math.min(a1.y, a2.y)
    const aMaxY = Math.max(a1.y, a2.y)

    for (let j = 0; j < b.length - 1; j += 1) {
      const b1 = b[j] as V.Vec2
      const b2 = b[j + 1] as V.Vec2

      // Bounding-box reject before the exact test.
      if (Math.min(b1.x, b2.x) > aMaxX || Math.max(b1.x, b2.x) < aMinX) continue
      if (Math.min(b1.y, b2.y) > aMaxY || Math.max(b1.y, b2.y) < aMinY) continue

      const hit = V.segmentIntersection(a1, a2, b1, b2)
      if (!hit) continue

      // Adjacent segments can both report the same physical crossing.
      let duplicate = false
      for (let k = pairStart; k < out.length; k += 1) {
        const existing = out[k] as ClashPoint
        if (
          (existing.position.x - hit.point.x) ** 2 + (existing.position.y - hit.point.y) ** 2
          < CLASH_MERGE_DISTANCE_SQ
        ) {
          duplicate = true
          break
        }
      }
      if (duplicate) continue

      const dirA = V.subtract(a2, a1)
      const dirB = V.subtract(b2, b1)
      const angle = Math.abs(
        Math.atan2(V.cross(dirA, dirB), V.dot(dirA, dirB)),
      )

      // Perpendicular crossings bite hardest; near-parallel ones slide off.
      const bite = Math.abs(Math.sin(angle))

      out.push({
        position: hit.point,
        angle,
        slip,
        intensity: clashIntensity(pressure, slip, bite),
        kind: 'line',
        a: player.index,
        b: rival.index,
        aShare,
      })
    }
  }

  return out
}

/**
 * Sweep every pair of fighters for crossings, replacing `out`.
 *
 * Every pair is tested, including opponent-versus-opponent: in a free-for-all the
 * AI flyers cut each other's lines, and the player can profit by staying out of it.
 */
export function detectClashes(
  fighters: readonly FighterState[],
  out: ClashPoint[],
): ClashPoint[] {
  out.length = 0

  for (let i = 0; i < fighters.length; i += 1) {
    for (let j = i + 1; j < fighters.length; j += 1) {
      detectPairClashes(fighters[i] as FighterState, fighters[j] as FighterState, out)
    }
  }

  return out
}

/**
 * Apply this step's abrasion to every fighter. Mutates `lineIntegrity` and clears
 * `alive` when a line parts.
 *
 * Damage is accumulated for all fighters first and applied at the end, so the order
 * fighters appear in cannot change the outcome — with three or four in the air, a
 * simultaneous double cut has to stay simultaneous.
 */
export function applyAbrasion(
  fighters: readonly FighterState[],
  clashes: readonly ClashPoint[],
  dt: number,
): AbrasionResult {
  const damage = fighters.map(() => 0)

  // Arena cables are handled by `applyCableWear`; only line-on-line contacts
  // exchange damage in both directions.
  let engaged = false

  for (const clash of clashes) {
    if (clash.kind !== 'line') continue
    engaged = true

    const player = fighters[clash.a] as FighterState
    const rival = fighters[clash.b] as FighterState
    const pressure = contactPressure(player, rival)
    const bite = Math.abs(Math.sin(clash.angle))

    /**
     * Compressed response to pressure and slip.
     *
     * Abrasion is linear in contact force and sliding distance in principle, and
     * the model keeps that ordering — more tension and more slip always cut faster.
     * But the *inputs* span an order of magnitude across the ladder, because
     * tension goes as the square of wind speed and the boss fights are windy: the
     * measured damage rate ran 0.005/s in the first fight against 0.045/s in the
     * last. Linear response meant a first-tier duel could not finish inside the
     * three-minute limit while a top-tier one was over in seconds.
     *
     * Taking the square root of each is a deliberate gameplay compression, not a
     * physical claim. It keeps a duel roughly comparable in length at every tier
     * while leaving the skill that decides it untouched — `aShare` below is
     * still the tension ratio, so holding the tauter line still wins the exchange.
     */
    const base
      = ABRASION_COEFFICIENT * Math.sqrt(clash.slip) * Math.sqrt(pressure) * bite * dt

    damage[clash.b] = (damage[clash.b] as number)
      + (base * player.stats.cutPower * clash.aShare) / rival.stats.lineStrength
    damage[clash.a] = (damage[clash.a] as number)
      + (base * rival.stats.cutPower * (1 - clash.aShare)) / player.stats.lineStrength
  }

  if (!engaged) return { damage, engaged: false }

  for (let i = 0; i < fighters.length; i += 1) {
    const fighter = fighters[i] as FighterState
    fighter.lineIntegrity = clamp01(fighter.lineIntegrity - (damage[i] as number))
    if (fighter.lineIntegrity <= 0) fighter.alive = false
  }

  return { damage, engaged: true }
}

/**
 * 0..1 read-out of who is winning the current exchange, for the HUD.
 * Above 0.5 means the player's line is doing more damage than it is taking.
 */
export function exchangeAdvantage(player: FighterState, rival: FighterState): number {
  const total = player.tension + rival.tension
  if (total < 1e-3) return 0.5

  const tensionEdge = player.tension / total
  const gearEdge
    = (player.stats.cutPower * rival.stats.lineStrength)
      / (player.stats.cutPower * rival.stats.lineStrength
        + rival.stats.cutPower * player.stats.lineStrength)

  return clamp01(tensionEdge * 0.6 + gearEdge * 0.4)
}

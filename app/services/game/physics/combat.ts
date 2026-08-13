import { ABRASION_COEFFICIENT, SNAP_FORCE_MULTIPLIER } from '../constants'
import { clamp01 } from '../math/scalar'
import * as V from '../math/vector'
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
 *    skill of the whole game, and it is the reason `playerShare` below is a
 *    ratio of tensions rather than a constant.
 *
 * Abrasion is then divided by the defender's `lineStrength` (gear and upgrades)
 * and multiplied by the attacker's `cutPower` (their *gelasan*, the abrasive
 * coating traditionally made from crushed glass and glue).
 */

/** Squared distance beyond which two crossings are treated as the same contact. */
const CLASH_MERGE_DISTANCE_SQ = 4

export interface AbrasionResult {
  /** Integrity removed from the player this step. */
  playerDamage: number
  /** Integrity removed from the rival this step. */
  rivalDamage: number
  /** True while at least one crossing exists. */
  engaged: boolean
}

/**
 * Find every point where the two flying lines cross.
 *
 * Writes into `out` in place. With 24 segments per line this is 576 segment
 * pairs, pre-filtered by bounding box, which is cheap enough to run at the full
 * 120 Hz simulation rate.
 */
export function detectClashes(
  player: FighterState,
  rival: FighterState,
  out: ClashPoint[],
): ClashPoint[] {
  out.length = 0

  const a = player.linePoints
  const b = rival.linePoints
  if (a.length < 2 || b.length < 2) return out
  if (!player.alive || !rival.alive) return out

  const snapMultiplier
    = player.snapActive > 0 || rival.snapActive > 0 ? SNAP_FORCE_MULTIPLIER : 1

  // Line material slides past the contact point when either fighter is reeling,
  // and the kites' own motion drags the line as well.
  const slip
    = (Math.abs(player.reelRate) + Math.abs(rival.reelRate)
      + 0.35 * (V.length(player.velocity) + V.length(rival.velocity)))
    * snapMultiplier

  const totalTension = player.tension + rival.tension
  const playerShare = totalTension < 1e-3 ? 0.5 : clamp01(player.tension / totalTension)

  // Hertzian-style contact: two taut lines press hard, one slack line does not.
  const pressure = (2 * player.tension * rival.tension) / (totalTension + 1)

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
      const duplicate = out.some(
        existing =>
          (existing.position.x - hit.point.x) ** 2 + (existing.position.y - hit.point.y) ** 2
          < CLASH_MERGE_DISTANCE_SQ,
      )
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
        playerShare,
        intensity: clamp01((pressure * bite * slip) / 4000),
        kind: 'line',
      })
    }
  }

  return out
}

/**
 * Apply this step's abrasion to both fighters. Mutates `lineIntegrity` and
 * clears `alive` when a line parts.
 */
export function applyAbrasion(
  player: FighterState,
  rival: FighterState,
  clashes: readonly ClashPoint[],
  dt: number,
): AbrasionResult {
  // Arena cables are handled by `applyCableWear`; only line-on-line contacts
  // exchange damage in both directions.
  const duelClashes = clashes.filter(clash => clash.kind === 'line')

  if (duelClashes.length === 0) {
    return { playerDamage: 0, rivalDamage: 0, engaged: false }
  }

  const totalTension = player.tension + rival.tension
  const pressure = (2 * player.tension * rival.tension) / (totalTension + 1)

  let playerDamage = 0
  let rivalDamage = 0

  for (const clash of duelClashes) {
    const bite = Math.abs(Math.sin(clash.angle))
    const base = ABRASION_COEFFICIENT * clash.slip * pressure * bite * dt

    rivalDamage += (base * player.stats.cutPower * clash.playerShare) / rival.stats.lineStrength
    playerDamage
      += (base * rival.stats.cutPower * (1 - clash.playerShare)) / player.stats.lineStrength
  }

  player.lineIntegrity = clamp01(player.lineIntegrity - playerDamage)
  rival.lineIntegrity = clamp01(rival.lineIntegrity - rivalDamage)

  if (player.lineIntegrity <= 0) player.alive = false
  if (rival.lineIntegrity <= 0) rival.alive = false

  return { playerDamage, rivalDamage, engaged: true }
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

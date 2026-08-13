import { clamp01 } from '../math/scalar'
import * as V from '../math/vector'
import type { ArenaDefinition, ArenaObstacle, ClashPoint, FighterState } from '../types'

/**
 * Arena hazards.
 *
 * Three distinct interactions, each modelling something that genuinely happens
 * on a real field:
 *
 * 1. **Solid bodies** — fly into a wall, a tower or a tree and the kite is down.
 *    This is the main reason a city arena plays differently from a rice field:
 *    the flyable volume has holes in it.
 *
 * 2. **Cables** — power lines and tram catenary. A steel cable saws through a
 *    kite line dragged across it, and unlike an opponent it takes no damage in
 *    return. This is the arena hazard players have to actively fly around, and it
 *    is why the neighbourhood arena is the hardest one.
 *
 * 3. **Wind shadows** — a tall building steals the wind from the volume behind
 *    it. Drift into that pocket and lift collapses, exactly as it does downwind
 *    of a real building. Recovering means getting back out into clean air.
 */

/** Cable abrasion per second at unit slip. Far harsher than line-on-line. */
const CABLE_ABRASION = 0.055

/** Half-width of a cable's contact zone, metres. */
const CABLE_THICKNESS = 0.4

/**
 * How far downwind a shadow reaches, as a multiple of the obstacle's height.
 * Real building wakes extend several heights; 2.2 keeps the pocket findable
 * rather than covering the whole arena.
 */
const SHADOW_LENGTH_FACTOR = 2.2

/** Fraction of the wind that survives deep inside a shadow. */
const SHADOW_MIN_FACTOR = 0.28

function withinBody(obstacle: ArenaObstacle, point: V.Vec2, margin = 0): boolean {
  const halfWidth = obstacle.width / 2 + margin
  return (
    point.x >= obstacle.x - halfWidth
    && point.x <= obstacle.x + halfWidth
    && point.y >= obstacle.y - margin
    && point.y <= obstacle.y + obstacle.height + margin
  )
}

/**
 * The first solid obstacle the kite is inside, or `null`.
 *
 * `margin` accounts for the kite's own size — the sail hits the wall before its
 * centre point does.
 */
export function findCollision(
  arena: ArenaDefinition,
  position: V.Vec2,
  margin: number,
): ArenaObstacle | null {
  for (const obstacle of arena.obstacles) {
    if (!obstacle.behaviour.solid) continue
    if (withinBody(obstacle, position, margin)) return obstacle
  }
  return null
}

/**
 * Wind factor at a point, 0..1.
 *
 * Multiplies the wind field's own output, so shear and gusts still apply inside
 * a shadow — the air there is slower, not still.
 */
export function windFactorAt(arena: ArenaDefinition, position: V.Vec2): number {
  let factor = 1

  for (const obstacle of arena.obstacles) {
    if (!obstacle.behaviour.windShadow) continue

    // Wind blows along +x, so the shadow lies downwind: at greater x.
    const downwindEdge = obstacle.x + obstacle.width / 2
    const distance = position.x - downwindEdge
    if (distance < 0) continue

    const reach = obstacle.height * SHADOW_LENGTH_FACTOR
    if (distance > reach) continue

    // Only below roof height, with the wake spreading slightly as it travels.
    const wakeTop = obstacle.height * (1 + distance / (reach * 3))
    if (position.y > wakeTop) continue

    // Strongest right behind the obstacle, recovering with distance.
    const depth = 1 - distance / reach
    const shadow = 1 - (1 - SHADOW_MIN_FACTOR) * depth
    factor = Math.min(factor, shadow)
  }

  return factor
}

/**
 * Height of the tallest hazard a kite would meet flying between `fromX` and
 * `toX`, in metres. Cables count — flying a line across one is as bad as hitting
 * a wall, just slower.
 *
 * The AI uses this to pick a target altitude with real clearance instead of
 * hauling its own kite into a building, and the launch code uses it to make sure
 * a round never starts inside a structure.
 */
export function hazardCeiling(arena: ArenaDefinition, fromX: number, toX: number): number {
  const minX = Math.min(fromX, toX)
  const maxX = Math.max(fromX, toX)
  let ceiling = 0

  for (const obstacle of arena.obstacles) {
    const halfWidth = obstacle.width / 2
    if (obstacle.x + halfWidth < minX || obstacle.x - halfWidth > maxX) continue

    const top = obstacle.span
      ? Math.max(obstacle.span.y1, obstacle.span.y2)
      : obstacle.y + obstacle.height

    if (top > ceiling) ceiling = top
  }

  return ceiling
}

export interface CableContact {
  obstacle: ArenaObstacle
  point: V.Vec2
  /** Crossing angle between line and cable, radians. */
  angle: number
}

/**
 * Every point where a fighter's line crosses an arena cable.
 *
 * Appends to `out` so both fighters can be tested into one buffer.
 */
export function findCableContacts(
  arena: ArenaDefinition,
  fighter: FighterState,
  out: CableContact[],
): CableContact[] {
  const points = fighter.linePoints
  if (points.length < 2 || !fighter.alive) return out

  for (const obstacle of arena.obstacles) {
    if (!obstacle.behaviour.snag || !obstacle.span) continue

    const cableStart = V.vec2(obstacle.span.x1, obstacle.span.y1)
    const cableEnd = V.vec2(obstacle.span.x2, obstacle.span.y2)

    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i] as V.Vec2
      const b = points[i + 1] as V.Vec2

      // Cheap reject before the exact test.
      const segMinY = Math.min(a.y, b.y) - CABLE_THICKNESS
      const segMaxY = Math.max(a.y, b.y) + CABLE_THICKNESS
      if (segMaxY < obstacle.y || segMinY > obstacle.y + obstacle.height) continue

      const hit = V.segmentIntersection(a, b, cableStart, cableEnd)
      if (!hit) continue

      const lineDir = V.subtract(b, a)
      const cableDir = V.subtract(cableEnd, cableStart)
      const angle = Math.abs(Math.atan2(V.cross(lineDir, cableDir), V.dot(lineDir, cableDir)))

      out.push({ obstacle, point: hit.point, angle })
      // One contact per cable is enough; adjacent segments would double-count.
      break
    }
  }

  return out
}

/**
 * Apply cable abrasion to a fighter and describe the contacts for the renderer.
 *
 * Returns the integrity removed this step. Sets `snagged` so the HUD can warn,
 * because a line on a cable is losing a duel it is not even fighting.
 */
export function applyCableWear(
  fighter: FighterState,
  contacts: readonly CableContact[],
  dt: number,
  out: ClashPoint[],
): number {
  fighter.snagged = contacts.length > 0
  if (contacts.length === 0) return 0

  // Cable wear needs relative motion just like line-on-line: a line resting on a
  // cable in dead air is not being cut.
  const slip = Math.abs(fighter.reelRate) + 0.4 * V.length(fighter.velocity)
  if (slip < 0.05) return 0

  let damage = 0

  for (const contact of contacts) {
    const bite = Math.abs(Math.sin(contact.angle))
    // Tension presses the line into the cable; steel does not yield.
    const pressure = Math.min(1, fighter.tension / 140)
    const wear
      = (CABLE_ABRASION * slip * bite * (0.35 + pressure) * dt) / fighter.stats.lineStrength

    damage += wear

    out.push({
      position: contact.point,
      angle: contact.angle,
      slip,
      // Cables do all the cutting; nothing flows back the other way.
      playerShare: fighter.side === 'player' ? 0 : 1,
      intensity: clamp01(slip * bite * 0.12),
      kind: 'obstacle',
      victim: fighter.side,
    })
  }

  fighter.lineIntegrity = clamp01(fighter.lineIntegrity - damage)
  if (fighter.lineIntegrity <= 0) fighter.alive = false

  return damage
}

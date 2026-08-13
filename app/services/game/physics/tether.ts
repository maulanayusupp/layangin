import { LINE_MASS_DENSITY, LINE_SEGMENTS } from '../constants'
import * as V from '../math/vector'
import type { Vec2 } from '../math/vector'
import { clamp } from '../math/scalar'

/**
 * The flying line.
 *
 * The line is not simulated as a chain of particles — that is expensive and
 * prone to jitter. Instead it is solved analytically each step:
 *
 * - **Shape**: a cable of arc length `s` spanning a straight distance `S` hangs
 *   with a mid-span sag of about `sqrt(3·S·(s − S) / 8)` (the standard shallow
 *   catenary approximation). Paying line out therefore makes the belly drop
 *   visibly, and hauling in snaps it straight — which is the visual cue players
 *   read tension from.
 *
 * - **Constraint**: the kite may never sit further from the anchor than the
 *   deployed length. Excess distance is projected away and the outward part of
 *   the velocity is cancelled; the impulse that took is reported as tension.
 *
 * Both matter for combat: the sampled polyline is what the clash detector
 * intersects, so a slack, sagging line presents a different target than a taut
 * one.
 */

export interface TensionResult {
  /** Total line tension in newtons. */
  tension: number
  /** True when the constraint had to pull the kite back this step. */
  taut: boolean
}

/**
 * Mid-span sag depth in metres for the given span and deployed length.
 * Returns 0 when the line is straight or over-extended.
 */
export function catenarySag(span: number, deployedLength: number): number {
  const slack = deployedLength - span
  if (slack <= 0 || span <= 0) return 0
  return Math.sqrt((3 * span * slack) / 8)
}

/**
 * Sample the line into a polyline from anchor to kite.
 *
 * Writes into `out` in place: this runs every frame for both fighters, so the
 * points array is reused rather than reallocated.
 */
export function sampleLine(
  anchor: Vec2,
  kite: Vec2,
  deployedLength: number,
  windDirection: number,
  out: Vec2[],
  segments = LINE_SEGMENTS,
): Vec2[] {
  const span = V.distance(anchor, kite)
  const sag = catenarySag(span, deployedLength)

  // A quadratic Bézier deviates from the chord by a quarter of the control
  // offset at mid-span, so offset by 4× the sag we want.
  const bowDown = sag * 4
  // Slack line is also blown downwind, not only down.
  const bowDownwind = sag * 1.6 * windDirection

  const midX = (anchor.x + kite.x) / 2 + bowDownwind
  const midY = (anchor.y + kite.y) / 2 - bowDown

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    const inverse = 1 - t
    const weightStart = inverse * inverse
    const weightMid = 2 * inverse * t
    const weightEnd = t * t

    const point = out[i] ?? (out[i] = V.vec2())
    point.x = weightStart * anchor.x + weightMid * midX + weightEnd * kite.x
    // The line can sag below the sampling curve but never through the ground.
    point.y = Math.max(0, weightStart * anchor.y + weightMid * midY + weightEnd * kite.y)
  }

  out.length = segments + 1
  return out
}

/**
 * Enforce the length constraint and report the tension it required.
 *
 * `position` and `velocity` are mutated in place.
 */
export function applyLineConstraint(
  anchor: Vec2,
  position: Vec2,
  velocity: Vec2,
  deployedLength: number,
  mass: number,
  externalForce: Vec2,
  dt: number,
): TensionResult {
  const offset = V.subtract(position, anchor)
  const distance = V.length(offset)

  if (distance < 1e-6) {
    return { tension: 0, taut: false }
  }

  const direction = V.scale(offset, 1 / distance)

  // Weight of the deployed line itself always hangs on the fighter's hand.
  const lineWeight = deployedLength * LINE_MASS_DENSITY * 9.81

  if (distance <= deployedLength) {
    // Slack: the line carries only its own weight.
    return { tension: lineWeight, taut: false }
  }

  // Project the kite back onto the sphere of allowed positions.
  position.x = anchor.x + direction.x * deployedLength
  position.y = anchor.y + direction.y * deployedLength

  // Cancel the outward component of velocity; the impulse is the tension.
  const radialSpeed = V.dot(velocity, direction)
  let impulseTension = 0

  if (radialSpeed > 0) {
    velocity.x -= direction.x * radialSpeed
    velocity.y -= direction.y * radialSpeed
    impulseTension = (mass * radialSpeed) / Math.max(dt, 1e-6)
  }

  // Steady-state tension: the outward part of the applied force plus the
  // centripetal term from the kite swinging on the line.
  const forceAlongLine = Math.max(0, V.dot(externalForce, direction))
  const tangentialSpeed = Math.abs(V.cross(direction, velocity))
  const centripetal = (mass * tangentialSpeed * tangentialSpeed) / deployedLength

  return {
    // Cap the impulse contribution: a single stiff step must not spike the
    // reading into the thousands and trigger a spurious overload break.
    tension: lineWeight + forceAlongLine + centripetal + clamp(impulseTension, 0, 400),
    taut: true,
  }
}

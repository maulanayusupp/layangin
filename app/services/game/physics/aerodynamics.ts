import { AIR_DENSITY, FLAT_PLATE_DRAG } from '../constants'
import * as V from '../math/vector'
import type { Vec2 } from '../math/vector'
import type { KiteStats } from '../types'

export interface AeroResult {
  /** Aerodynamic force in newtons, world space. */
  force: Vec2
  /** Angle of attack in radians, signed. */
  angleOfAttack: number
  /** Dynamic pressure, Pa — useful for effect intensity. */
  dynamicPressure: number
  /** Apparent wind speed over the sail, m/s. */
  apparentSpeed: number
  lift: number
  drag: number
}

/**
 * Thin-plate aerodynamics for a kite sail.
 *
 * The sail is treated as a flat plate at angle of attack α to the apparent
 * wind, which is the standard first-order model for a kite and reproduces the
 * behaviour players expect:
 *
 * - `Cl = Cl_max · sin(2α)` — lift peaks near 45° and collapses past it, so a
 *   kite held at too steep an angle stalls and falls out of the sky.
 * - `Cd = Cd0 + 1.28 · sin²(α) + tailDrag` — drag grows toward the flat-plate
 *   value as the sail turns broadside. Tails add a constant penalty, which is
 *   why a long-tailed *janggan* is rock-steady but slow to answer the line.
 *
 * Both forces scale with dynamic pressure `q = ½ρV²`, so doubling the apparent
 * wind quadruples the pull — the reason a gust can snap a line.
 */
export function computeAerodynamics(
  stats: KiteStats,
  velocity: Vec2,
  wind: Vec2,
  /** Sail heading in radians: the direction the chord line points. */
  heading: number,
): AeroResult {
  // Apparent wind is what the sail actually feels.
  const apparent = V.subtract(wind, velocity)
  const apparentSpeed = V.length(apparent)

  if (apparentSpeed < 0.05) {
    return {
      force: V.vec2(0, 0),
      angleOfAttack: 0,
      dynamicPressure: 0,
      apparentSpeed,
      lift: 0,
      drag: 0,
    }
  }

  const flowDirection = V.scale(apparent, 1 / apparentSpeed)
  const chord = V.fromAngle(heading)

  // Signed angle between the chord and the flow, in (-PI, PI].
  const angleOfAttack = Math.atan2(V.cross(chord, flowDirection), V.dot(chord, flowDirection))
  const alpha = angleOfAttack

  const liftCoefficient = stats.liftCoefficient * Math.sin(2 * alpha)
  const dragCoefficient
    = stats.dragCoefficient + FLAT_PLATE_DRAG * Math.sin(alpha) ** 2 + stats.tailDrag

  const dynamicPressure = 0.5 * AIR_DENSITY * apparentSpeed * apparentSpeed
  const scale = dynamicPressure * stats.area

  const drag = scale * dragCoefficient
  const lift = scale * liftCoefficient

  // Drag acts along the flow; lift acts perpendicular to it.
  const liftDirection = V.perpendicular(flowDirection)

  const force = V.vec2(
    flowDirection.x * drag + liftDirection.x * lift,
    flowDirection.y * drag + liftDirection.y * lift,
  )

  return { force, angleOfAttack, dynamicPressure, apparentSpeed, lift, drag }
}

/**
 * Heading the sail settles at.
 *
 * A kite does not choose its own attitude: the bridle holds the sail at a fixed
 * angle to the flying line, so the line direction sets the heading and the
 * player steers only by changing that geometry. `trim` is the bridle's built-in
 * angle of attack and `bank` is the fighter's steering input.
 */
export function trimmedHeading(anchor: Vec2, kite: Vec2, trim: number, bank: number): number {
  const lineAngle = V.angleOf(V.subtract(kite, anchor))
  // The chord sits a quarter turn off the line, offset by trim and steering.
  return lineAngle - Math.PI / 2 + trim + bank
}

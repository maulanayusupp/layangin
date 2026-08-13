/**
 * Scalar maths helpers. Pure, dependency-free and unit-tested
 * (see tests/unit/math.spec.ts) because the whole simulation leans on them.
 */

export const TAU = Math.PI * 2

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/** Clamp to 0..1 — the range used by every normalised gauge and meter. */
export function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/**
 * Frame-rate independent exponential smoothing.
 *
 * `smoothing` is the fraction of the remaining distance left after one second,
 * so the result is identical at 30fps and 144fps.
 */
export function damp(current: number, target: number, smoothing: number, dt: number): number {
  return lerp(target, current, smoothing ** dt)
}

/** Map a value from one range to another, clamped to the output range. */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (inMax === inMin) return outMin
  const t = clamp01((value - inMin) / (inMax - inMin))
  return lerp(outMin, outMax, t)
}

/** Smoothstep easing on the 0..1 interval. */
export function smoothstep(t: number): number {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

/** Shortest signed angular difference in radians, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % TAU
  if (d > Math.PI) d -= TAU
  if (d <= -Math.PI) d += TAU
  return d
}

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI
}

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Deadzone for analogue/touch input so a resting thumb reads as zero. */
export function applyDeadzone(value: number, threshold = 0.12): number {
  const magnitude = Math.abs(value)
  if (magnitude < threshold) return 0
  return Math.sign(value) * ((magnitude - threshold) / (1 - threshold))
}

export function roundTo(value: number, decimals = 0): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length
}

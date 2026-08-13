/**
 * 2D vector helpers.
 *
 * The simulation runs thousands of vector operations per frame, so the hot paths
 * (`addScaled`, `setFrom`) mutate a target in place to avoid per-frame garbage.
 * Allocating variants are provided for readability in cold code.
 */

export interface Vec2 {
  x: number
  y: number
}

export function vec2(x = 0, y = 0): Vec2 {
  return { x, y }
}

export function setFrom(target: Vec2, source: Vec2): Vec2 {
  target.x = source.x
  target.y = source.y
  return target
}

export function set(target: Vec2, x: number, y: number): Vec2 {
  target.x = x
  target.y = y
  return target
}

export function clone(v: Vec2): Vec2 {
  return { x: v.x, y: v.y }
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function subtract(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function scale(v: Vec2, factor: number): Vec2 {
  return { x: v.x * factor, y: v.y * factor }
}

/** In-place `target += source * factor`. Allocation-free. */
export function addScaled(target: Vec2, source: Vec2, factor: number): Vec2 {
  target.x += source.x * factor
  target.y += source.y * factor
  return target
}

export function length(v: Vec2): number {
  return Math.hypot(v.x, v.y)
}

export function lengthSquared(v: Vec2): number {
  return v.x * v.x + v.y * v.y
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function normalize(v: Vec2): Vec2 {
  const len = length(v)
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len }
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y
}

/** 2D scalar cross product (z of the 3D cross) — sign tells which side. */
export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x
}

/** Rotate 90° counter-clockwise. Used to turn drag direction into lift. */
export function perpendicular(v: Vec2): Vec2 {
  return { x: -v.y, y: v.x }
}

export function rotate(v: Vec2, radians: number): Vec2 {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos }
}

export function fromAngle(radians: number, magnitude = 1): Vec2 {
  return { x: Math.cos(radians) * magnitude, y: Math.sin(radians) * magnitude }
}

export function angleOf(v: Vec2): number {
  return Math.atan2(v.y, v.x)
}

export function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/**
 * Intersection of segments A1→A2 and B1→B2.
 *
 * Returns the intersection point plus each segment's parametric position, or
 * `null` when the segments are parallel or do not overlap. This is the primitive
 * the line-clash detector runs over every line segment pair.
 */
export function segmentIntersection(
  a1: Vec2,
  a2: Vec2,
  b1: Vec2,
  b2: Vec2,
): { point: Vec2, tA: number, tB: number } | null {
  const dax = a2.x - a1.x
  const day = a2.y - a1.y
  const dbx = b2.x - b1.x
  const dby = b2.y - b1.y

  const denominator = dax * dby - day * dbx
  if (Math.abs(denominator) < 1e-9) return null

  const tA = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / denominator
  const tB = ((b1.x - a1.x) * day - (b1.y - a1.y) * dax) / denominator

  if (tA < 0 || tA > 1 || tB < 0 || tB > 1) return null

  return {
    point: { x: a1.x + dax * tA, y: a1.y + day * tA },
    tA,
    tB,
  }
}

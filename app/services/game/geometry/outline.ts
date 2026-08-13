import type { Vec2 } from '../math/vector'

/**
 * Airframe silhouette generator.
 *
 * Fifty hand-drawn polygon soups would be unmaintainable and would drift out of
 * step with the stats attached to them. Instead a silhouette is described by what
 * a kite maker would actually vary — how wide the shoulder is, where the widest
 * point sits, how far the nose runs past it, how deep the tail is forked, how far
 * the wings sweep back — and this module turns that into an outline.
 *
 * Two things follow from that:
 *
 * 1. Every shape is genuinely different, not a recolour, because the outline
 *    really is different geometry.
 * 2. The aerodynamic stats can be **derived from the polygon** rather than typed
 *    in by hand, so a wider sail automatically has more area and more drag. See
 *    `deriveStats`.
 *
 * All outlines are produced in the same local space the renderer expects:
 * x spans −1..1 (span), y spans −1..1 (chord, up positive).
 */

export type OutlineKind
  = | 'diamond'
    | 'leaf'
    | 'fish'
    | 'delta'
    | 'box'
    | 'bird'
    | 'star'
    | 'shield'
    | 'crescent'
    | 'hex'
    | 'arrow'
    | 'flame'
    | 'butterfly'
    | 'lantern'
    | 'cross'

export interface OutlineSpec {
  kind: OutlineKind
  /** Half-width at the widest point, 0.3..1. */
  shoulder: number
  /** Height of the widest point, −0.6..0.6. Negative puts the bulk low. */
  waist: number
  /** How far the nose runs above the shoulder, 0.2..1. */
  nose: number
  /** How far the tail runs below the shoulder, 0.2..1. */
  tail: number
  /** Backward sweep of the wing tips, 0..1. Only used by winged kinds. */
  sweep: number
  /** Points, spikes or cells, 3..12. Used by star, flame, box, cross. */
  lobes: number
  /** Depth of the tail notch, 0..0.8. */
  fork: number
}

const point = (x: number, y: number): Vec2 => ({ x, y })

/** Mirror the right-hand profile into a closed, symmetric outline. */
function mirrorProfile(right: readonly Vec2[], noseY: number, tailY: number): Vec2[] {
  const points: Vec2[] = [point(0, noseY)]
  for (const p of right) points.push(point(p.x, p.y))
  points.push(point(0, tailY))
  for (let i = right.length - 1; i >= 0; i -= 1) {
    const p = right[i] as Vec2
    points.push(point(-p.x, p.y))
  }
  return points
}

export function buildOutline(spec: OutlineSpec): Vec2[] {
  const { kind, shoulder, waist, nose, tail, sweep, lobes, fork } = spec

  const noseY = Math.min(1, waist + nose)
  const tailY = Math.max(-1, waist - tail)
  const forkY = tailY + fork * (waist - tailY)

  switch (kind) {
    case 'diamond':
      return mirrorProfile([point(shoulder, waist)], noseY, tailY)

    case 'leaf':
      // Rounded shoulders: sample a half-ellipse down each flank.
      return mirrorProfile(
        Array.from({ length: 5 }, (_, i) => {
          const t = (i + 1) / 6
          const angle = t * Math.PI
          return point(Math.sin(angle) * shoulder, waist + Math.cos(angle) * nose * 0.9)
        }),
        noseY,
        tailY,
      )

    case 'fish':
      // Broad belly, pinched waist, forked tail.
      return mirrorProfile(
        [
          point(shoulder * 0.62, waist + nose * 0.45),
          point(shoulder, waist),
          point(shoulder * 0.7, waist - tail * 0.45),
          point(shoulder * 0.34, forkY),
        ],
        noseY,
        tailY,
      )

    case 'delta':
      // Straight leading edges to swept tips.
      return mirrorProfile([point(shoulder, tailY + sweep * 0.18)], noseY, tailY + fork * 0.5)

    case 'box': {
      // Stacked cells: a rectangle with the corners stepped in, so it reads as a
      // three-dimensional frame rather than a flat panel.
      const step = shoulder * 0.18
      return [
        point(-shoulder + step, noseY),
        point(shoulder - step, noseY),
        point(shoulder, noseY - step),
        point(shoulder, tailY + step),
        point(shoulder - step, tailY),
        point(-shoulder + step, tailY),
        point(-shoulder, tailY + step),
        point(-shoulder, noseY - step),
      ]
    }

    case 'bird':
      // Swept wings with a notched tail and a distinct head.
      return mirrorProfile(
        [
          point(shoulder * 0.3, waist + nose * 0.5),
          point(shoulder, waist - sweep * 0.3),
          point(shoulder * 0.6, waist - sweep * 0.45),
          point(shoulder * 0.28, waist - tail * 0.2),
          point(shoulder * 0.34, forkY),
        ],
        noseY,
        tailY,
      )

    case 'star': {
      // Alternating outer and inner radii around the full circle.
      const points: Vec2[] = []
      const count = Math.max(4, Math.round(lobes))
      const inner = shoulder * (0.36 + fork * 0.2)
      for (let i = 0; i < count * 2; i += 1) {
        const angle = (i / (count * 2)) * Math.PI * 2 - Math.PI / 2
        const radius = i % 2 === 0 ? 1 : inner / shoulder
        points.push(point(Math.cos(angle) * shoulder * radius, waist + Math.sin(angle) * nose * radius))
      }
      return points
    }

    case 'shield':
      // Flat top, straight flanks, tapering to a point.
      return mirrorProfile(
        [
          point(shoulder, noseY - nose * 0.14),
          point(shoulder, waist - tail * 0.3),
          point(shoulder * 0.6, waist - tail * 0.7),
        ],
        noseY,
        tailY,
      )

    case 'crescent':
      // Concave trailing edge: the horns reach further back than the middle.
      return mirrorProfile(
        [
          point(shoulder * 0.7, waist + nose * 0.55),
          point(shoulder, waist - tail * 0.1),
          point(shoulder * 0.86, tailY),
          point(shoulder * 0.44, waist - tail * 0.35),
        ],
        noseY,
        waist - tail * 0.22,
      )

    case 'hex': {
      // Regular polygon, flattened to the shoulder width.
      const points: Vec2[] = []
      const count = Math.max(5, Math.round(lobes))
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2
        points.push(point(Math.cos(angle) * shoulder, waist + Math.sin(angle) * nose))
      }
      return points
    }

    case 'arrow':
      // Barbed: the tips flare out behind the shoulder.
      return mirrorProfile(
        [
          point(shoulder * 0.42, waist + nose * 0.3),
          point(shoulder, waist - tail * 0.55),
          point(shoulder * 0.5, waist - tail * 0.35),
          point(shoulder * 0.3, forkY),
        ],
        noseY,
        tailY,
      )

    case 'flame': {
      // Ragged trailing edge with an odd number of tongues.
      const tongues = Math.max(3, Math.round(lobes))
      const right: Vec2[] = [point(shoulder, waist)]
      for (let i = 0; i < tongues; i += 1) {
        const t = (i + 1) / (tongues + 1)
        const depth = i % 2 === 0 ? 0.55 : 1
        right.push(point(shoulder * (1 - t) * 0.9, waist - tail * t * depth))
      }
      return mirrorProfile(right, noseY, tailY)
    }

    case 'butterfly':
      // Two lobes each side, pinched at the waist.
      return mirrorProfile(
        [
          point(shoulder * 0.9, waist + nose * 0.6),
          point(shoulder * 0.5, waist + nose * 0.1),
          point(shoulder, waist - tail * 0.45),
          point(shoulder * 0.4, waist - tail * 0.6),
        ],
        noseY,
        tailY,
      )

    case 'lantern':
      // Barrel: bulges at the middle, flat at both ends.
      return mirrorProfile(
        [
          point(shoulder * 0.68, noseY),
          point(shoulder, waist + nose * 0.2),
          point(shoulder, waist - tail * 0.2),
          point(shoulder * 0.68, tailY),
        ],
        noseY,
        tailY,
      )

    case 'cross': {
      // Four arms; `lobes` sets how thick they are.
      const arm = shoulder
      const thick = arm * (0.2 + (12 - Math.min(12, lobes)) * 0.03)
      return [
        point(-thick, noseY),
        point(thick, noseY),
        point(thick, waist + thick),
        point(arm, waist + thick),
        point(arm, waist - thick),
        point(thick, waist - thick),
        point(thick, tailY),
        point(-thick, tailY),
        point(-thick, waist - thick),
        point(-arm, waist - thick),
        point(-arm, waist + thick),
        point(-thick, waist + thick),
      ]
    }
  }
}

/** Signed polygon area via the shoelace formula; always returned positive. */
export function polygonArea(points: readonly Vec2[]): number {
  let total = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i] as Vec2
    const b = points[(i + 1) % points.length] as Vec2
    total += a.x * b.y - b.x * a.y
  }
  return Math.abs(total) / 2
}

/** Widest horizontal extent of an outline, in local units. */
export function outlineSpan(points: readonly Vec2[]): number {
  let min = Infinity
  let max = -Infinity
  for (const p of points) {
    if (p.x < min) min = p.x
    if (p.x > max) max = p.x
  }
  return max - min
}

/** Tallest vertical extent of an outline, in local units. */
export function outlineChord(points: readonly Vec2[]): number {
  let min = Infinity
  let max = -Infinity
  for (const p of points) {
    if (p.y < min) min = p.y
    if (p.y > max) max = p.y
  }
  return max - min
}

/**
 * Inset copy of an outline, used to draw a panel inside the sail (the darker
 * lower half, a belly band, a keel) without authoring a second polygon.
 */
export function insetOutline(points: readonly Vec2[], factor: number): Vec2[] {
  return points.map(p => point(p.x * factor, p.y * factor))
}

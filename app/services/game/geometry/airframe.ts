import type { Vec2 } from '../math/vector'
import type { KiteGeometry, KitePanel, KiteStats, KiteTail, Rarity } from '../types'
import {
  buildOutline,
  insetOutline,
  outlineChord,
  outlineSpan,
  polygonArea,
  type OutlineSpec,
} from './outline'

/**
 * Turns an outline specification into a full airframe: geometry the renderer can
 * draw, and stats the simulation can fly.
 *
 * The important property is that **the stats come from the shape**. Sail area is
 * the actual polygon area; the lift coefficient follows the aspect ratio; drag
 * follows how blunt the outline is and how much tail it drags. A wider sail is
 * therefore automatically draggier, and nobody can accidentally ship a tiny kite
 * with a huge area because the two numbers cannot disagree.
 *
 * Only the two *gear* stats — line resistance and cutting power — are set by
 * tier rather than derived, because they describe the line and its abrasive
 * coating, which have nothing to do with the sail's shape.
 */

export interface TailRig {
  kind: KiteTail['kind']
  /** Length as a multiple of the kite's own size. */
  length: number
  width: number
  /** Where along the trailing edge it attaches, −1 (left) .. 1 (right). */
  offset?: number
}

export interface AirframeSpec {
  outline: OutlineSpec
  tails: readonly TailRig[]
  /** Longest dimension in metres. Drives real area and the collision margin. */
  size: number
  /** Adds a humming bow above the sail, as on a sawangan. */
  bow?: boolean
  /** Gear tier: sets line resistance and cutting power. */
  rarity: Rarity
  /** Extra spars beyond the spine and the cross member. */
  extraSpars?: number
}

/** Areal density of a bamboo-and-paper sail, kg/m². */
const SAIL_DENSITY = 0.085

/** Mass of one metre of tail ribbon, kg. */
const TAIL_DENSITY = 0.012

/** Gear quality by tier: the line and its gelasan, not the sail. */
const GEAR: Record<Rarity, { lineStrength: number, cutPower: number }> = {
  common: { lineStrength: 1, cutPower: 1 },
  uncommon: { lineStrength: 1.05, cutPower: 1.06 },
  rare: { lineStrength: 1.14, cutPower: 1.12 },
  epic: { lineStrength: 1.28, cutPower: 1.22 },
  legend: { lineStrength: 1.44, cutPower: 1.36 },
}

export interface DerivedAirframe {
  geometry: KiteGeometry
  stats: KiteStats
  /** Local-space polygon, so callers can build extra panels from it. */
  outline: Vec2[]
}

export function buildAirframe(spec: AirframeSpec): DerivedAirframe {
  const outline = buildOutline(spec.outline)

  // --- Geometry -------------------------------------------------------------
  const localArea = polygonArea(outline)
  const span = outlineSpan(outline)
  const chord = outlineChord(outline)

  const waist = spec.outline.waist
  const bridle: Vec2 = { x: 0, y: waist * 0.6 }

  const panels: KitePanel[] = ([
    { paint: 'primary', points: outline },
    // Lower half in the secondary colour: the two-tone look almost every real
    // fighting kite has, produced by clipping rather than a second polygon.
    {
      paint: 'secondary',
      points: outline
        .filter(p => p.y <= waist)
        .concat([{ x: 0, y: waist }]),
    },
    // A small inset centre panel gives the sail a visible spine region.
    { paint: 'shade', points: insetOutline(outline, 0.34) },
  ] satisfies KitePanel[]).filter(panel => panel.points.length >= 3)

  const halfSpan = span / 2
  const top = waist + spec.outline.nose
  const bottom = waist - spec.outline.tail

  const spars: [Vec2, Vec2][] = [
    [{ x: 0, y: Math.min(1, top) }, { x: 0, y: Math.max(-1, bottom) }],
    [{ x: -halfSpan, y: waist }, { x: halfSpan, y: waist }],
  ]

  for (let i = 0; i < (spec.extraSpars ?? 0); i += 1) {
    const t = (i + 1) / ((spec.extraSpars ?? 0) + 1)
    const y = waist + (top - waist) * t
    spars.push([{ x: -halfSpan * (1 - t) * 0.9, y }, { x: halfSpan * (1 - t) * 0.9, y }])
  }

  const tails: KiteTail[] = spec.tails.map((rig, index) => ({
    anchor: {
      x: (rig.offset ?? 0) * halfSpan * 0.7,
      y: Math.max(-1, bottom),
    },
    length: rig.length,
    width: rig.width,
    kind: rig.kind,
    // Alternate the accent so a multi-tail rig reads as separate ribbons.
    paint: index % 2 === 0 ? 'accent' : 'secondary',
  }))

  const geometry: KiteGeometry = {
    panels,
    spars,
    tails,
    bridle,
    ...(spec.bow
      ? {
          bow: {
            from: { x: -halfSpan * 0.96, y: waist + 0.1 },
            to: { x: halfSpan * 0.96, y: waist + 0.1 },
            depth: 0.42,
          },
        }
      : {}),
  }

  // --- Stats ----------------------------------------------------------------
  // The unit square is 2×2, so a local area of 4 would be a full square. Scaling
  // by size² converts to real square metres.
  const area = (localArea / 4) * spec.size * spec.size * 1.35

  const tailLength = spec.tails.reduce((total, rig) => total + rig.length, 0)
  const tailArea = spec.tails.reduce((total, rig) => total + rig.length * rig.width, 0)

  const mass
    = area * SAIL_DENSITY
      + tailLength * spec.size * TAIL_DENSITY
      // Frame mass scales with the perimeter the spars have to span.
      + (span + chord) * spec.size * 0.035

  // Aspect ratio: a wide, shallow sail is a more efficient lifting surface, the
  // same reason a glider wing is long and thin.
  const aspect = (span * span) / Math.max(0.05, localArea)
  const liftCoefficient = 0.95 + Math.min(0.62, aspect * 0.16)

  // Bluntness: how much of the bounding box the outline actually fills. A solid
  // hexagon pushes far more air than a slender delta of the same span.
  const fill = localArea / Math.max(0.05, span * chord)
  const dragCoefficient = 0.06 + fill * 0.2

  const tailDrag = Math.min(0.55, tailArea * 0.26)

  // Light, low-drag airframes answer the line quickly.
  const agility = Math.max(1.3, Math.min(5, 4.6 - mass * 2.6 - tailDrag * 4.2))
  // Tails and a low centre of area are what steady a kite.
  const stability = Math.max(0.5, Math.min(3, 0.7 + tailDrag * 4 + Math.max(0, -waist) * 1.6))

  const gear = GEAR[spec.rarity]

  return {
    outline,
    geometry,
    stats: {
      area: round(area, 2),
      mass: round(mass, 3),
      liftCoefficient: round(liftCoefficient, 2),
      dragCoefficient: round(dragCoefficient, 2),
      tailDrag: round(tailDrag, 2),
      agility: round(agility, 1),
      stability: round(stability, 2),
      lineStrength: gear.lineStrength,
      cutPower: gear.cutPower,
    },
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Coin price from the derived stats, so a stronger airframe always costs more.
 * Keeps the shop's pricing honest without a hand-maintained table.
 */
export function priceFor(stats: KiteStats, rarity: Rarity): number {
  const tierFloor: Record<Rarity, number> = {
    common: 0,
    uncommon: 260,
    rare: 700,
    epic: 1600,
    legend: 3200,
  }

  const power
    = stats.area * stats.liftCoefficient * 0.6
      + stats.agility * 0.1
      + stats.cutPower * 0.5
      + stats.lineStrength * 0.5

  return tierFloor[rarity] + Math.round((power * 120) / 10) * 10
}

/** Ladder wins required, spread across the tiers. */
export function unlockWinsFor(rarity: Rarity, indexWithinTier: number): number {
  const base: Record<Rarity, number> = {
    common: 0,
    uncommon: 1,
    rare: 4,
    epic: 9,
    legend: 15,
  }
  return base[rarity] + indexWithinTier
}

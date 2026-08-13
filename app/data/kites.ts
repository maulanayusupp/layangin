import type { Vec2 } from '~/services/game/math/vector'
import {
  buildAirframe,
  priceFor,
  unlockWinsFor,
} from '~/services/game/geometry/airframe'
import type { KiteDefinition, KiteId, Rarity } from '~/services/game/types'
import { GENERATED_AIRFRAMES } from './airframes'

/**
 * Kite catalog — fifty airframes, from two sources.
 *
 * Each entry is a genuinely different **airframe**, not a recolour: the outline
 * polygons, spar layout and tail rig all differ, and so do the aerodynamic
 * stats that follow from that shape. A long-tailed *janggan* really does carry
 * far more tail drag than a bare delta, and the numbers below say so.
 *
 * ## Why two sources
 * The eight **signature** airframes below are hand-authored, because their
 * outlines carry detail no generator models — the box kite's twin cells, the
 * janggan's crowned head, the naga's jagged flame edge.
 *
 * The other forty-two are **generated** from outline parameters in
 * `airframes.ts`, with their stats derived from the resulting polygon. Fifty
 * hand-drawn shapes would drift out of step with fifty hand-typed stat blocks;
 * deriving the numbers from the geometry makes that impossible.
 *
 * Both end up as the same `KiteDefinition`, so nothing downstream knows or cares
 * which list a kite came from.
 *
 * ## Local coordinate space
 * `x` spans −1 (left) to +1 (right), `y` spans −1 (bottom) to +1 (top).
 * The renderer scales this unit square by `size` (metres) and rotates it by the
 * sail heading, so geometry never needs to know about pixels.
 *
 * Colour is deliberately absent — it comes from the equipped palette, which is
 * why adding a skin never touches this file.
 */

/** Shorthand for readable polygon literals. */
const p = (x: number, y: number): Vec2 => ({ x, y })

const SIGNATURE_KITES: readonly KiteDefinition[] = [
  // -------------------------------------------------------------------------
  // Pecut — the plain Javanese fighting diamond every kid starts with.
  // -------------------------------------------------------------------------
  {
    id: 'pecut',
    i18nKey: 'pecut',
    rarity: 'common',
    price: 0,
    origin: 'java',
    size: 1.1,
    unlockWins: 0,
    stats: {
      area: 0.62,
      mass: 0.24,
      liftCoefficient: 1.15,
      dragCoefficient: 0.10,
      tailDrag: 0.06,
      agility: 3.2,
      stability: 1.0,
      lineStrength: 1.0,
      cutPower: 1.0,
    },
    geometry: {
      panels: [
        { paint: 'primary', points: [p(0, 1), p(0.64, 0.08), p(0, -1), p(-0.64, 0.08)] },
        // Lower half in the secondary colour — the classic two-tone pecut.
        { paint: 'secondary', points: [p(-0.64, 0.08), p(0, -1), p(0.64, 0.08), p(0, 0.08)] },
      ],
      spars: [
        [p(0, 1), p(0, -1)],
        [p(-0.64, 0.08), p(0.64, 0.08)],
      ],
      tails: [
        { anchor: p(-0.5, -0.32), length: 0.6, width: 0.07, kind: 'tassel', paint: 'accent' },
        { anchor: p(0.5, -0.32), length: 0.6, width: 0.07, kind: 'tassel', paint: 'accent' },
      ],
      bridle: p(0, 0.08),
    },
  },

  // -------------------------------------------------------------------------
  // Delta — modern triangle with a keel. Quick, slippery, unforgiving.
  // -------------------------------------------------------------------------
  {
    id: 'delta',
    i18nKey: 'delta',
    rarity: 'uncommon',
    price: 320,
    origin: 'modern',
    size: 1.5,
    unlockWins: 1,
    stats: {
      area: 0.72,
      mass: 0.22,
      liftCoefficient: 1.32,
      dragCoefficient: 0.08,
      tailDrag: 0.02,
      agility: 4.4,
      stability: 0.6,
      lineStrength: 0.95,
      cutPower: 1.08,
    },
    geometry: {
      panels: [
        { paint: 'primary', points: [p(0, 1), p(0.94, -0.58), p(0, -0.34)] },
        { paint: 'secondary', points: [p(0, 1), p(0, -0.34), p(-0.94, -0.58)] },
        // Keel hanging below the spine — a delta's defining feature.
        { paint: 'shade', points: [p(0, 0.86), p(0.04, -0.34), p(-0.3, -0.1)] },
      ],
      spars: [
        [p(0, 1), p(0.94, -0.58)],
        [p(0, 1), p(-0.94, -0.58)],
        [p(-0.5, -0.05), p(0.5, -0.05)],
      ],
      tails: [],
      bridle: p(-0.12, -0.08),
    },
  },

  // -------------------------------------------------------------------------
  // Bebean — the Balinese fish. Broad sail, huge lift, lazy in a turn.
  // -------------------------------------------------------------------------
  {
    id: 'bebean',
    i18nKey: 'bebean',
    rarity: 'rare',
    price: 850,
    origin: 'bali',
    size: 1.7,
    unlockWins: 3,
    stats: {
      area: 1.05,
      mass: 0.38,
      liftCoefficient: 1.28,
      dragCoefficient: 0.12,
      tailDrag: 0.10,
      agility: 2.6,
      stability: 1.3,
      lineStrength: 1.12,
      cutPower: 1.0,
    },
    geometry: {
      panels: [
        {
          paint: 'primary',
          points: [
            p(0, 0.96), p(0.56, 0.58), p(0.88, -0.04), p(0.54, -0.52),
            p(0.22, -0.74), p(0, -0.58), p(-0.22, -0.74), p(-0.54, -0.52),
            p(-0.88, -0.04), p(-0.56, 0.58),
          ],
        },
        // Belly band.
        {
          paint: 'secondary',
          points: [p(-0.78, -0.16), p(0.78, -0.16), p(0.54, -0.52), p(-0.54, -0.52)],
        },
        // Eyes, as small rhombi so the fish reads at HUD scale.
        {
          paint: 'accent',
          points: [p(-0.4, 0.3), p(-0.28, 0.4), p(-0.16, 0.3), p(-0.28, 0.2)],
        },
        {
          paint: 'accent',
          points: [p(0.16, 0.3), p(0.28, 0.4), p(0.4, 0.3), p(0.28, 0.2)],
        },
      ],
      spars: [
        [p(0, 0.96), p(0, -0.58)],
        [p(-0.88, -0.04), p(0.88, -0.04)],
      ],
      // Forked tail.
      tails: [
        { anchor: p(-0.22, -0.74), length: 1.5, width: 0.12, kind: 'streamer', paint: 'accent' },
        { anchor: p(0.22, -0.74), length: 1.5, width: 0.12, kind: 'streamer', paint: 'accent' },
      ],
      bridle: p(0, -0.04),
    },
  },

  // -------------------------------------------------------------------------
  // Kotak — box kite. Two cells, no tail, near-impossible to upset.
  // -------------------------------------------------------------------------
  {
    id: 'kotak',
    i18nKey: 'kotak',
    rarity: 'rare',
    price: 1100,
    origin: 'modern',
    size: 1.3,
    unlockWins: 5,
    stats: {
      area: 0.90,
      mass: 0.46,
      liftCoefficient: 1.05,
      dragCoefficient: 0.20,
      tailDrag: 0.04,
      agility: 1.9,
      stability: 2.1,
      lineStrength: 1.30,
      cutPower: 0.95,
    },
    geometry: {
      panels: [
        // Far cell, shaded — gives the silhouette its boxy depth.
        { paint: 'shade', points: [p(-0.78, 0.88), p(-0.06, 0.7), p(-0.06, -0.7), p(-0.78, -0.88)] },
        // Near cell.
        { paint: 'primary', points: [p(0.06, 0.7), p(0.78, 0.88), p(0.78, -0.88), p(0.06, -0.7)] },
        // Top and bottom sail bands.
        { paint: 'secondary', points: [p(-0.78, 0.88), p(0.78, 0.88), p(0.78, 0.4), p(-0.78, 0.34)] },
        {
          paint: 'secondary',
          points: [p(-0.78, -0.34), p(0.78, -0.4), p(0.78, -0.88), p(-0.78, -0.88)],
        },
      ],
      spars: [
        [p(-0.78, 0.88), p(-0.78, -0.88)],
        [p(-0.06, 0.7), p(-0.06, -0.7)],
        [p(0.06, 0.7), p(0.06, -0.7)],
        [p(0.78, 0.88), p(0.78, -0.88)],
        [p(-0.78, 0.88), p(0.78, 0.88)],
        [p(-0.78, -0.88), p(0.78, -0.88)],
      ],
      tails: [],
      bridle: p(0, 0.1),
    },
  },

  // -------------------------------------------------------------------------
  // Sawangan — the big bowed kite with a humming bow. Heavy, relentless pull.
  // -------------------------------------------------------------------------
  {
    id: 'sawangan',
    i18nKey: 'sawangan',
    rarity: 'epic',
    price: 1900,
    origin: 'java',
    size: 2.2,
    unlockWins: 8,
    stats: {
      area: 1.35,
      mass: 0.62,
      liftCoefficient: 1.22,
      dragCoefficient: 0.16,
      tailDrag: 0.18,
      agility: 2.0,
      stability: 1.9,
      lineStrength: 1.38,
      cutPower: 1.05,
    },
    geometry: {
      panels: [
        {
          paint: 'primary',
          points: [
            p(0, 0.84), p(0.52, 0.6), p(0.8, 0.08), p(0.44, -0.6),
            p(0, -0.9), p(-0.44, -0.6), p(-0.8, 0.08), p(-0.52, 0.6),
          ],
        },
        { paint: 'secondary', points: [p(-0.8, 0.08), p(0.8, 0.08), p(0.44, -0.6), p(-0.44, -0.6)] },
        { paint: 'accent', points: [p(0, 0.84), p(0.2, 0.08), p(0, -0.2), p(-0.2, 0.08)] },
      ],
      spars: [
        [p(0, 0.84), p(0, -0.9)],
        [p(-0.8, 0.08), p(0.8, 0.08)],
      ],
      // The bow that hums in the wind — the reason the kite is named at all.
      bow: { from: p(-0.84, 0.3), to: p(0.84, 0.3), depth: 0.46 },
      tails: [
        { anchor: p(0, -0.9), length: 3.2, width: 0.16, kind: 'ribbon', paint: 'accent' },
      ],
      bridle: p(0, 0.08),
    },
  },

  // -------------------------------------------------------------------------
  // Elang — swept-wing eagle. Sharp gelasan, very quick, thin margins.
  // -------------------------------------------------------------------------
  {
    id: 'elang',
    i18nKey: 'elang',
    rarity: 'epic',
    price: 2400,
    origin: 'sumatra',
    size: 1.9,
    unlockWins: 12,
    stats: {
      area: 0.88,
      mass: 0.30,
      liftCoefficient: 1.40,
      dragCoefficient: 0.09,
      tailDrag: 0.05,
      agility: 4.0,
      stability: 0.9,
      lineStrength: 1.05,
      cutPower: 1.25,
    },
    geometry: {
      panels: [
        {
          paint: 'primary',
          points: [
            p(0, 0.6), p(0.36, 0.46), p(0.98, -0.08), p(0.62, -0.2),
            p(0.3, -0.04), p(0.24, -0.66), p(0, -0.5),
            p(-0.24, -0.66), p(-0.3, -0.04), p(-0.62, -0.2),
            p(-0.98, -0.08), p(-0.36, 0.46),
          ],
        },
        // Wing bars.
        { paint: 'secondary', points: [p(-0.98, -0.08), p(-0.46, 0.2), p(-0.4, 0.02), p(-0.9, -0.16)] },
        { paint: 'secondary', points: [p(0.98, -0.08), p(0.46, 0.2), p(0.4, 0.02), p(0.9, -0.16)] },
        // Head.
        { paint: 'accent', points: [p(0, 0.98), p(0.18, 0.56), p(-0.18, 0.56)] },
      ],
      spars: [
        [p(-0.98, -0.08), p(0.98, -0.08)],
        [p(0, 0.98), p(0, -0.5)],
      ],
      tails: [
        { anchor: p(-0.24, -0.66), length: 0.9, width: 0.1, kind: 'streamer', paint: 'secondary' },
        { anchor: p(0.24, -0.66), length: 0.9, width: 0.1, kind: 'streamer', paint: 'secondary' },
      ],
      bridle: p(0, -0.06),
    },
  },

  // -------------------------------------------------------------------------
  // Janggan — Balinese dragon. Small sail, colossal tail, immovable in the air.
  // -------------------------------------------------------------------------
  {
    id: 'janggan',
    i18nKey: 'janggan',
    rarity: 'legend',
    price: 3600,
    origin: 'bali',
    size: 1.4,
    unlockWins: 16,
    stats: {
      area: 0.70,
      mass: 0.34,
      liftCoefficient: 1.18,
      dragCoefficient: 0.11,
      // A tail tens of metres long dominates the drag budget entirely.
      tailDrag: 0.42,
      agility: 1.6,
      stability: 2.6,
      lineStrength: 1.45,
      cutPower: 1.15,
    },
    geometry: {
      panels: [
        {
          paint: 'primary',
          points: [p(0, 1), p(0.44, 0.56), p(0.32, 0.0), p(0, -0.22), p(-0.32, 0.0), p(-0.44, 0.56)],
        },
        // Crown crest.
        { paint: 'accent', points: [p(0, 1), p(0.2, 0.62), p(0, 0.5), p(-0.2, 0.62)] },
        // Side fins.
        { paint: 'secondary', points: [p(-0.44, 0.56), p(-0.86, 0.24), p(-0.32, 0.0)] },
        { paint: 'secondary', points: [p(0.44, 0.56), p(0.86, 0.24), p(0.32, 0.0)] },
      ],
      spars: [
        [p(0, 1), p(0, -0.22)],
        [p(-0.86, 0.24), p(0.86, 0.24)],
      ],
      tails: [
        { anchor: p(0, -0.22), length: 9, width: 0.3, kind: 'dragon', paint: 'accent' },
      ],
      bridle: p(0, 0.2),
    },
  },

  // -------------------------------------------------------------------------
  // Naga Senja — the final boss's kite, unlocked by beating them.
  // -------------------------------------------------------------------------
  {
    id: 'naga',
    i18nKey: 'naga',
    rarity: 'legend',
    price: 5200,
    origin: 'legend',
    size: 2.0,
    unlockWins: 22,
    stats: {
      area: 1.15,
      mass: 0.42,
      liftCoefficient: 1.45,
      dragCoefficient: 0.13,
      tailDrag: 0.20,
      agility: 3.4,
      stability: 1.5,
      lineStrength: 1.50,
      cutPower: 1.42,
    },
    geometry: {
      panels: [
        {
          paint: 'primary',
          points: [
            p(0, 1), p(0.28, 0.62), p(0.64, 0.72), p(0.5, 0.24),
            p(0.92, -0.04), p(0.46, -0.3), p(0.6, -0.76), p(0.18, -0.52),
            p(0, -1), p(-0.18, -0.52), p(-0.6, -0.76), p(-0.46, -0.3),
            p(-0.92, -0.04), p(-0.5, 0.24), p(-0.64, 0.72), p(-0.28, 0.62),
          ],
        },
        // Inner flame.
        {
          paint: 'accent',
          points: [p(0, 0.7), p(0.3, 0.1), p(0.14, -0.3), p(0, -0.62), p(-0.14, -0.3), p(-0.3, 0.1)],
        },
        { paint: 'shade', points: [p(-0.5, 0.24), p(0.5, 0.24), p(0.46, -0.3), p(-0.46, -0.3)] },
      ],
      spars: [
        [p(0, 1), p(0, -1)],
        [p(-0.92, -0.04), p(0.92, -0.04)],
        [p(-0.64, 0.72), p(0.64, 0.72)],
      ],
      tails: [
        { anchor: p(-0.6, -0.76), length: 2.6, width: 0.14, kind: 'streamer', paint: 'accent' },
        { anchor: p(0.6, -0.76), length: 2.6, width: 0.14, kind: 'streamer', paint: 'accent' },
        { anchor: p(0, -1), length: 4.2, width: 0.22, kind: 'dragon', paint: 'primary' },
      ],
      bridle: p(0, 0.04),
    },
  },
] as const

/**
 * Build the generated half of the catalog.
 *
 * Price and unlock threshold are computed from the derived stats and the tier, so
 * a stronger airframe is always dearer and no hand-maintained price table can
 * fall out of step with a shape change.
 */
const GENERATED_KITES: readonly KiteDefinition[] = (() => {
  const tierCounts = new Map<Rarity, number>()

  return GENERATED_AIRFRAMES.map((spec) => {
    const { geometry, stats } = buildAirframe(spec)
    const indexWithinTier = tierCounts.get(spec.rarity) ?? 0
    tierCounts.set(spec.rarity, indexWithinTier + 1)

    return {
      id: spec.id,
      i18nKey: spec.id,
      rarity: spec.rarity,
      // Never free: `pecut` is the one airframe granted in a fresh save, and a
      // second free kite would be visible in the shop but unowned.
      price: Math.max(40, priceFor(stats, spec.rarity)),
      origin: spec.origin,
      stats,
      geometry,
      size: spec.size,
      unlockWins: unlockWinsFor(spec.rarity, indexWithinTier),
    } satisfies KiteDefinition
  })
})()

export const KITES: readonly KiteDefinition[] = [...SIGNATURE_KITES, ...GENERATED_KITES]

const KITE_INDEX = new Map<KiteId, KiteDefinition>(KITES.map(kite => [kite.id, kite]))

export const DEFAULT_KITE_ID: KiteId = 'pecut'

export function getKite(id: KiteId): KiteDefinition {
  const kite = KITE_INDEX.get(id)
  if (!kite) throw new Error(`Unknown kite id: ${id}`)
  return kite
}

/** Safe lookup for values coming out of persisted storage. */
export function findKite(id: string | undefined): KiteDefinition | undefined {
  return id ? KITE_INDEX.get(id as KiteId) : undefined
}

export function kitesByRarity(): readonly KiteDefinition[] {
  const order: Record<KiteDefinition['rarity'], number> = {
    common: 0,
    uncommon: 1,
    rare: 2,
    epic: 3,
    legend: 4,
  }
  return [...KITES].sort((a, b) => order[a.rarity] - order[b.rarity] || a.price - b.price)
}

import type { AirframeSpec } from '~/services/game/geometry/airframe'
import type { KiteDefinition, KiteId } from '~/services/game/types'

/**
 * Generated airframes.
 *
 * These 42 shapes are described by their **outline parameters** rather than by
 * hand-drawn polygons, and their aerodynamic stats are derived from the resulting
 * geometry (see `services/game/geometry/airframe.ts`). That is what makes fifty
 * airframes maintainable: a shape and its numbers cannot disagree, because the
 * numbers are computed from the shape.
 *
 * The eight signature airframes in `kites.ts` stay hand-authored — their outlines
 * carry detail the generator does not model, such as the box kite's twin cells
 * and the janggan's crowned head.
 *
 * Adding one here means adding its `name`/`lore` to **both** locales under
 * `kites.items.<id>` — `pnpm lint:i18n` will fail until you do.
 */
export interface GeneratedAirframe extends AirframeSpec {
  id: KiteId
  origin: KiteDefinition['origin']
}

export const GENERATED_AIRFRAMES: readonly GeneratedAirframe[] = [
  {
    id: 'wajik',
    origin: 'java',
    rarity: 'common',
    size: 1.05,
    outline: {
      kind: 'diamond', shoulder: 0.58, waist: 0.05, nose: 0.9,
      tail: 0.95, sweep: 0, lobes: 5, fork: 0,
    },
    tails: [{ kind: 'tassel', length: 0.5, width: 0.07, offset: -0.6 }, { kind: 'tassel', length: 0.5, width: 0.07, offset: 0.6 }],
  },
  {
    id: 'ketupat',
    origin: 'java',
    rarity: 'common',
    size: 1.1,
    outline: {
      kind: 'diamond', shoulder: 0.7, waist: 0, nose: 0.8,
      tail: 0.8, sweep: 0, lobes: 5, fork: 0,
    },
    tails: [{ kind: 'ribbon', length: 1.1, width: 0.1 }],
  },
  {
    id: 'daun',
    origin: 'java',
    rarity: 'common',
    size: 1.15,
    outline: {
      kind: 'leaf', shoulder: 0.5, waist: -0.05, nose: 0.85,
      tail: 0.85, sweep: 0, lobes: 5, fork: 0,
    },
    tails: [{ kind: 'streamer', length: 0.9, width: 0.09 }],
  },
  {
    id: 'panji',
    origin: 'modern',
    rarity: 'common',
    size: 1.2,
    outline: {
      kind: 'shield', shoulder: 0.46, waist: 0, nose: 0.9,
      tail: 0.9, sweep: 0, lobes: 5, fork: 0.1,
    },
    tails: [{ kind: 'ribbon', length: 1.6, width: 0.12 }],
  },
  {
    id: 'sirip',
    origin: 'modern',
    rarity: 'common',
    size: 1.3,
    outline: {
      kind: 'delta', shoulder: 0.72, waist: -0.1, nose: 0.95,
      tail: 0.6, sweep: 0.3, lobes: 5, fork: 0.2,
    },
    tails: [],
  },
  {
    id: 'gapangan',
    origin: 'java',
    rarity: 'common',
    size: 1.15,
    outline: {
      kind: 'diamond', shoulder: 0.64, waist: -0.12, nose: 0.85,
      tail: 0.95, sweep: 0, lobes: 5, fork: 0,
    },
    tails: [{ kind: 'tassel', length: 0.45, width: 0.08, offset: -0.55 }, { kind: 'tassel', length: 0.45, width: 0.08, offset: 0.55 }],
  },
  {
    id: 'pethetan',
    origin: 'java',
    rarity: 'common',
    size: 1.0,
    outline: {
      kind: 'leaf', shoulder: 0.44, waist: 0.1, nose: 0.8,
      tail: 0.7, sweep: 0, lobes: 5, fork: 0,
    },
    tails: [{ kind: 'streamer', length: 1.2, width: 0.08 }],
  },
  {
    id: 'aduan',
    origin: 'java',
    rarity: 'common',
    size: 0.95,
    outline: {
      kind: 'diamond', shoulder: 0.52, waist: 0.02, nose: 0.95,
      tail: 0.9, sweep: 0, lobes: 5, fork: 0,
    },
    tails: [],
  },
  {
    id: 'koang',
    origin: 'java',
    rarity: 'uncommon',
    size: 1.5,
    outline: {
      kind: 'bird', shoulder: 0.78, waist: 0.05, nose: 0.7,
      tail: 0.8, sweep: 0.5, lobes: 5, fork: 0.35,
    },
    tails: [{ kind: 'streamer', length: 0.8, width: 0.1, offset: -0.35 }, { kind: 'streamer', length: 0.8, width: 0.1, offset: 0.35 }],
  },
  {
    id: 'kupu',
    origin: 'bali',
    rarity: 'uncommon',
    size: 1.55,
    outline: {
      kind: 'butterfly', shoulder: 0.82, waist: 0, nose: 0.75,
      tail: 0.8, sweep: 0, lobes: 5, fork: 0.25,
    },
    tails: [{ kind: 'tassel', length: 0.6, width: 0.09, offset: -0.5 }, { kind: 'tassel', length: 0.6, width: 0.09, offset: 0.5 }],
  },
  {
    id: 'capung',
    origin: 'modern',
    rarity: 'uncommon',
    size: 1.45,
    outline: {
      kind: 'cross', shoulder: 0.8, waist: 0.05, nose: 0.9,
      tail: 0.85, sweep: 0, lobes: 10, fork: 0,
    },
    tails: [{ kind: 'streamer', length: 1.4, width: 0.07 }],
  },
  {
    id: 'rokkaku',
    origin: 'modern',
    rarity: 'uncommon',
    size: 1.4,
    extraSpars: 2,
    outline: {
      kind: 'hex', shoulder: 0.7, waist: 0, nose: 0.85,
      tail: 0.85, sweep: 0, lobes: 6, fork: 0,
    },
    tails: [{ kind: 'ribbon', length: 1.3, width: 0.11 }],
  },
  {
    id: 'bulan',
    origin: 'sumatra',
    rarity: 'uncommon',
    size: 1.35,
    outline: {
      kind: 'crescent', shoulder: 0.72, waist: 0.05, nose: 0.8,
      tail: 0.8, sweep: 0, lobes: 5, fork: 0.2,
    },
    tails: [{ kind: 'streamer', length: 1.1, width: 0.1 }],
  },
  {
    id: 'tameng',
    origin: 'java',
    rarity: 'uncommon',
    size: 1.3,
    extraSpars: 1,
    outline: {
      kind: 'shield', shoulder: 0.62, waist: -0.05, nose: 0.85,
      tail: 0.9, sweep: 0, lobes: 5, fork: 0.15,
    },
    tails: [{ kind: 'tassel', length: 0.5, width: 0.1 }],
  },
  {
    id: 'lampion',
    origin: 'modern',
    rarity: 'uncommon',
    size: 1.25,
    extraSpars: 2,
    outline: {
      kind: 'lantern', shoulder: 0.6, waist: 0, nose: 0.85,
      tail: 0.85, sweep: 0, lobes: 5, fork: 0,
    },
    tails: [{ kind: 'ribbon', length: 1.2, width: 0.12 }],
  },
  {
    id: 'terbang',
    origin: 'bali',
    rarity: 'uncommon',
    size: 1.5,
    outline: {
      kind: 'fish', shoulder: 0.74, waist: -0.05, nose: 0.8,
      tail: 0.85, sweep: 0, lobes: 5, fork: 0.4,
    },
    tails: [{ kind: 'streamer', length: 1.2, width: 0.1, offset: -0.3 }, { kind: 'streamer', length: 1.2, width: 0.1, offset: 0.3 }],
  },
  {
    id: 'gasing',
    origin: 'modern',
    rarity: 'uncommon',
    size: 1.2,
    extraSpars: 1,
    outline: {
      kind: 'hex', shoulder: 0.66, waist: 0, nose: 0.8,
      tail: 0.8, sweep: 0, lobes: 8, fork: 0,
    },
    tails: [{ kind: 'tassel', length: 0.6, width: 0.1 }],
  },
  {
    id: 'kembang',
    origin: 'java',
    rarity: 'uncommon',
    size: 1.4,
    outline: {
      kind: 'star', shoulder: 0.8, waist: 0, nose: 0.85,
      tail: 0.85, sweep: 0, lobes: 6, fork: 0.5,
    },
    tails: [{ kind: 'tassel', length: 0.5, width: 0.08 }],
  },
  {
    id: 'pari',
    origin: 'bali',
    rarity: 'rare',
    size: 1.8,
    outline: {
      kind: 'delta', shoulder: 0.95, waist: -0.2, nose: 0.9,
      tail: 0.55, sweep: 0.6, lobes: 5, fork: 0.15,
    },
    tails: [{ kind: 'streamer', length: 2.2, width: 0.09, offset: -0.5 }, { kind: 'streamer', length: 2.2, width: 0.09, offset: 0.5 }],
  },
  {
    id: 'kelelawar',
    origin: 'sumatra',
    rarity: 'rare',
    size: 1.7,
    outline: {
      kind: 'bird', shoulder: 0.92, waist: 0, nose: 0.6,
      tail: 0.85, sweep: 0.75, lobes: 5, fork: 0.5,
    },
    tails: [{ kind: 'streamer', length: 0.9, width: 0.1, offset: -0.4 }, { kind: 'streamer', length: 0.9, width: 0.1, offset: 0.4 }],
  },
  {
    id: 'hiu',
    origin: 'bali',
    rarity: 'rare',
    size: 1.65,
    outline: {
      kind: 'fish', shoulder: 0.62, waist: -0.1, nose: 0.9,
      tail: 0.9, sweep: 0, lobes: 5, fork: 0.5,
    },
    tails: [{ kind: 'streamer', length: 1.6, width: 0.11 }],
  },
  {
    id: 'keris',
    origin: 'java',
    rarity: 'rare',
    size: 1.5,
    outline: {
      kind: 'arrow', shoulder: 0.5, waist: -0.15, nose: 0.95,
      tail: 0.95, sweep: 0, lobes: 5, fork: 0.3,
    },
    tails: [{ kind: 'streamer', length: 1.5, width: 0.08 }],
  },
  {
    id: 'tombak',
    origin: 'java',
    rarity: 'rare',
    size: 1.6,
    outline: {
      kind: 'arrow', shoulder: 0.42, waist: -0.2, nose: 1,
      tail: 0.95, sweep: 0, lobes: 5, fork: 0.2,
    },
    tails: [{ kind: 'ribbon', length: 1.9, width: 0.09 }],
  },
  {
    id: 'sendaren',
    origin: 'java',
    rarity: 'rare',
    size: 1.9,
    bow: true,
    outline: {
      kind: 'leaf', shoulder: 0.66, waist: 0.08, nose: 0.85,
      tail: 0.9, sweep: 0, lobes: 5, fork: 0,
    },
    tails: [{ kind: 'ribbon', length: 2.4, width: 0.14 }],
  },
  {
    id: 'wau-bulan',
    origin: 'sumatra',
    rarity: 'rare',
    size: 1.85,
    bow: true,
    extraSpars: 1,
    outline: {
      kind: 'crescent', shoulder: 0.86, waist: 0, nose: 0.85,
      tail: 0.85, sweep: 0, lobes: 5, fork: 0.25,
    },
    tails: [{ kind: 'ribbon', length: 1.6, width: 0.13 }],
  },
  {
    id: 'dandang',
    origin: 'java',
    rarity: 'rare',
    size: 2.0,
    bow: true,
    extraSpars: 2,
    outline: {
      kind: 'lantern', shoulder: 0.72, waist: -0.05, nose: 0.9,
      tail: 0.9, sweep: 0, lobes: 5, fork: 0,
    },
    tails: [{ kind: 'ribbon', length: 2.6, width: 0.15 }],
  },
  {
    id: 'kepiting',
    origin: 'modern',
    rarity: 'rare',
    size: 1.55,
    outline: {
      kind: 'cross', shoulder: 0.9, waist: -0.1, nose: 0.7,
      tail: 0.75, sweep: 0, lobes: 6, fork: 0,
    },
    tails: [{ kind: 'tassel', length: 0.7, width: 0.12, offset: -0.6 }, { kind: 'tassel', length: 0.7, width: 0.12, offset: 0.6 }],
  },
  {
    id: 'bintang-laut',
    origin: 'modern',
    rarity: 'rare',
    size: 1.6,
    outline: {
      kind: 'star', shoulder: 0.86, waist: 0, nose: 0.9,
      tail: 0.9, sweep: 0, lobes: 5, fork: 0.55,
    },
    tails: [{ kind: 'tassel', length: 0.6, width: 0.1 }],
  },
  {
    id: 'merak',
    origin: 'bali',
    rarity: 'epic',
    size: 2.0,
    extraSpars: 1,
    outline: {
      kind: 'butterfly', shoulder: 0.94, waist: 0.05, nose: 0.8,
      tail: 0.9, sweep: 0, lobes: 5, fork: 0.3,
    },
    tails: [{ kind: 'dragon', length: 3.2, width: 0.2 }, { kind: 'streamer', length: 1.4, width: 0.09, offset: -0.6 }, { kind: 'streamer', length: 1.4, width: 0.09, offset: 0.6 }],
  },
  {
    id: 'garuda',
    origin: 'java',
    rarity: 'epic',
    size: 2.1,
    extraSpars: 1,
    outline: {
      kind: 'bird', shoulder: 0.98, waist: 0.05, nose: 0.75,
      tail: 0.9, sweep: 0.55, lobes: 5, fork: 0.45,
    },
    tails: [{ kind: 'streamer', length: 1.8, width: 0.12, offset: -0.45 }, { kind: 'streamer', length: 1.8, width: 0.12, offset: 0.45 }],
  },
  {
    id: 'gurita',
    origin: 'modern',
    rarity: 'epic',
    size: 1.9,
    outline: {
      kind: 'flame', shoulder: 0.8, waist: -0.05, nose: 0.85,
      tail: 0.95, sweep: 0, lobes: 8, fork: 0,
    },
    tails: [{ kind: 'streamer', length: 1.6, width: 0.08, offset: -0.5 }, { kind: 'streamer', length: 1.6, width: 0.08 }, { kind: 'streamer', length: 1.6, width: 0.08, offset: 0.5 }],
  },
  {
    id: 'mahkota',
    origin: 'bali',
    rarity: 'epic',
    size: 1.85,
    extraSpars: 1,
    outline: {
      kind: 'star', shoulder: 0.8, waist: 0.1, nose: 0.95,
      tail: 0.85, sweep: 0, lobes: 7, fork: 0.45,
    },
    tails: [{ kind: 'ribbon', length: 2.2, width: 0.14 }],
  },
  {
    id: 'kalajengking',
    origin: 'sumatra',
    rarity: 'epic',
    size: 1.95,
    outline: {
      kind: 'arrow', shoulder: 0.72, waist: -0.15, nose: 0.9,
      tail: 0.95, sweep: 0, lobes: 5, fork: 0.35,
    },
    tails: [{ kind: 'dragon', length: 4.0, width: 0.16 }],
  },
  {
    id: 'sayap',
    origin: 'modern',
    rarity: 'epic',
    size: 2.05,
    extraSpars: 1,
    outline: {
      kind: 'delta', shoulder: 1.0, waist: -0.25, nose: 0.95,
      tail: 0.5, sweep: 0.8, lobes: 5, fork: 0.1,
    },
    tails: [{ kind: 'streamer', length: 1.2, width: 0.1, offset: -0.6 }, { kind: 'streamer', length: 1.2, width: 0.1, offset: 0.6 }],
  },
  {
    id: 'wau-kucing',
    origin: 'sumatra',
    rarity: 'epic',
    size: 2.1,
    bow: true,
    extraSpars: 2,
    outline: {
      kind: 'leaf', shoulder: 0.9, waist: 0, nose: 0.9,
      tail: 0.9, sweep: 0, lobes: 5, fork: 0,
    },
    tails: [{ kind: 'ribbon', length: 2.8, width: 0.16 }],
  },
  {
    id: 'taring',
    origin: 'legend',
    rarity: 'epic',
    size: 1.8,
    outline: {
      kind: 'flame', shoulder: 0.6, waist: -0.1, nose: 0.95,
      tail: 0.95, sweep: 0, lobes: 5, fork: 0,
    },
    tails: [{ kind: 'streamer', length: 1.8, width: 0.1, offset: -0.35 }, { kind: 'streamer', length: 1.8, width: 0.1, offset: 0.35 }],
  },
  {
    id: 'matahari',
    origin: 'legend',
    rarity: 'legend',
    size: 2.2,
    extraSpars: 2,
    outline: {
      kind: 'star', shoulder: 0.95, waist: 0, nose: 0.95,
      tail: 0.95, sweep: 0, lobes: 12, fork: 0.4,
    },
    tails: [{ kind: 'ribbon', length: 2.4, width: 0.13 }],
  },
  {
    id: 'puyuh',
    origin: 'legend',
    rarity: 'legend',
    size: 2.15,
    extraSpars: 1,
    outline: {
      kind: 'flame', shoulder: 0.88, waist: -0.05, nose: 0.9,
      tail: 0.95, sweep: 0, lobes: 10, fork: 0,
    },
    tails: [{ kind: 'dragon', length: 5.0, width: 0.2 }],
  },
  {
    id: 'jangkar',
    origin: 'legend',
    rarity: 'legend',
    size: 2.1,
    extraSpars: 1,
    outline: {
      kind: 'cross', shoulder: 0.86, waist: -0.15, nose: 0.9,
      tail: 0.95, sweep: 0, lobes: 5, fork: 0,
    },
    tails: [{ kind: 'dragon', length: 4.4, width: 0.18 }, { kind: 'streamer', length: 1.6, width: 0.1, offset: -0.7 }, { kind: 'streamer', length: 1.6, width: 0.1, offset: 0.7 }],
  },
  {
    id: 'tapak',
    origin: 'bali',
    rarity: 'legend',
    size: 2.2,
    bow: true,
    extraSpars: 1,
    outline: {
      kind: 'butterfly', shoulder: 0.98, waist: -0.05, nose: 0.85,
      tail: 0.9, sweep: 0, lobes: 5, fork: 0.35,
    },
    tails: [{ kind: 'dragon', length: 4.6, width: 0.2 }],
  },
  {
    id: 'kanggokan',
    origin: 'java',
    rarity: 'legend',
    size: 2.3,
    bow: true,
    extraSpars: 3,
    outline: {
      kind: 'lantern', shoulder: 0.78, waist: 0, nose: 0.95,
      tail: 0.95, sweep: 0, lobes: 5, fork: 0,
    },
    tails: [{ kind: 'ribbon', length: 3.2, width: 0.18 }, { kind: 'streamer', length: 1.4, width: 0.1, offset: -0.6 }, { kind: 'streamer', length: 1.4, width: 0.1, offset: 0.6 }],
  },
  {
    id: 'sultan',
    origin: 'legend',
    rarity: 'legend',
    size: 2.35,
    bow: true,
    extraSpars: 2,
    outline: {
      kind: 'bird', shoulder: 1.0, waist: 0.05, nose: 0.9,
      tail: 0.95, sweep: 0.6, lobes: 5, fork: 0.4,
    },
    tails: [{ kind: 'dragon', length: 5.4, width: 0.22 }, { kind: 'streamer', length: 2.0, width: 0.12, offset: -0.5 }, { kind: 'streamer', length: 2.0, width: 0.12, offset: 0.5 }],
  },
] as const

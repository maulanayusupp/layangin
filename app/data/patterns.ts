import type { KitePattern, PatternId } from '~/services/game/types'

/**
 * Sail graphics — *corak*.
 *
 * Real fighting kites are mostly a handful of airframes wearing an enormous
 * variety of paper liveries, and that is exactly how this is modelled: the
 * airframe carries the physics, the pattern carries the look. Every pattern is
 * drawn procedurally inside the sail outline, so it works on all eight airframes
 * without a single image asset — and a new airframe automatically supports all
 * of them.
 *
 * Cosmetic only. Nothing here reaches the simulation; `/compliance` states that.
 */
export const PATTERNS: readonly KitePattern[] = [
  {
    id: 'plain',
    i18nKey: 'plain',
    rarity: 'common',
    price: 0,
    kind: 'plain',
    count: 0,
    paints: ['primary', 'secondary'],
  },
  {
    id: 'belang',
    i18nKey: 'belang',
    rarity: 'common',
    price: 60,
    kind: 'stripes',
    count: 7,
    paints: ['secondary', 'accent'],
    angle: 0,
  },
  {
    id: 'palang',
    i18nKey: 'palang',
    rarity: 'common',
    price: 60,
    kind: 'stripes',
    count: 5,
    paints: ['accent', 'shade'],
    angle: Math.PI / 2,
  },
  {
    id: 'seperempat',
    i18nKey: 'seperempat',
    rarity: 'common',
    price: 90,
    kind: 'quarters',
    count: 0,
    paints: ['accent', 'shade'],
  },
  {
    id: 'panah',
    i18nKey: 'panah',
    rarity: 'uncommon',
    price: 180,
    kind: 'chevron',
    count: 5,
    paints: ['accent', 'secondary'],
  },
  {
    id: 'sasaran',
    i18nKey: 'sasaran',
    rarity: 'uncommon',
    price: 180,
    kind: 'rings',
    count: 4,
    paints: ['accent', 'shade'],
  },
  {
    id: 'bintang',
    i18nKey: 'bintang',
    rarity: 'uncommon',
    price: 240,
    kind: 'star',
    count: 5,
    paints: ['accent', 'secondary'],
  },
  {
    id: 'papan',
    i18nKey: 'papan',
    rarity: 'rare',
    price: 380,
    kind: 'checker',
    count: 5,
    paints: ['accent', 'shade'],
  },
  {
    id: 'lidah-api',
    i18nKey: 'lidah-api',
    rarity: 'rare',
    price: 460,
    kind: 'flame',
    count: 6,
    paints: ['accent', 'secondary'],
  },
  {
    id: 'kawung',
    i18nKey: 'kawung',
    rarity: 'rare',
    price: 460,
    kind: 'lattice',
    count: 4,
    paints: ['accent', 'shade'],
  },
  {
    id: 'mata',
    i18nKey: 'mata',
    rarity: 'epic',
    price: 720,
    kind: 'eye',
    count: 2,
    paints: ['accent', 'shade'],
  },
  {
    id: 'sinar',
    i18nKey: 'sinar',
    rarity: 'legend',
    price: 1400,
    kind: 'rays',
    count: 12,
    paints: ['accent', 'secondary'],
  },
] as const

const PATTERN_INDEX = new Map<PatternId, KitePattern>(
  PATTERNS.map(pattern => [pattern.id, pattern]),
)

export const DEFAULT_PATTERN_ID: PatternId = 'plain'

export function getPattern(id: PatternId): KitePattern {
  const pattern = PATTERN_INDEX.get(id)
  if (!pattern) throw new Error(`Unknown pattern id: ${id}`)
  return pattern
}

export function findPattern(id: string | undefined): KitePattern | undefined {
  return id ? PATTERN_INDEX.get(id as PatternId) : undefined
}

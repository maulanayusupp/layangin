import type { OpponentDefinition, OpponentId } from '~/services/game/types'

/**
 * The ladder.
 *
 * Difficulty is expressed entirely through `ai` (human limitations: reaction
 * time, precision, discipline) plus the gear the opponent flies. No opponent
 * gets hidden stat bonuses, and none of them can see anything the player cannot
 * — a boss is hard because it reacts in a fifth of a second and rarely wastes
 * stamina, not because the rules bend for it.
 *
 * Wind is part of the fight design: an early opponent gets steady air, later
 * ones pick gusty afternoons where a careless haul parts your own line.
 */
export const OPPONENTS: readonly OpponentDefinition[] = [
  {
    id: 'bocah-sawah',
    i18nKey: 'bocah-sawah',
    tier: 1,
    isBoss: false,
    kiteId: 'pecut',
    paletteId: 'pandan',
    patternId: 'plain',
    effectId: 'none',
    reward: 60,
    windSpeed: 4.2,
    gustiness: 0.18,
    upgrades: {},
    ai: {
      reactionTime: 0.95,
      aggression: 0.35,
      precision: 0.42,
      discipline: 0.3,
      mistakeRate: 0.3,
      caution: 0.25,
    },
  },
  {
    id: 'anak-kampung',
    i18nKey: 'anak-kampung',
    tier: 2,
    isBoss: false,
    kiteId: 'pecut',
    paletteId: 'gula-kelapa',
    patternId: 'belang',
    effectId: 'debu',
    reward: 95,
    windSpeed: 5.0,
    gustiness: 0.26,
    upgrades: { 'line-strength': 1 },
    ai: {
      reactionTime: 0.75,
      aggression: 0.48,
      precision: 0.54,
      discipline: 0.4,
      mistakeRate: 0.22,
      caution: 0.32,
    },
  },
  {
    id: 'juara-lorong',
    i18nKey: 'juara-lorong',
    tier: 3,
    isBoss: false,
    kiteId: 'delta',
    paletteId: 'samudra',
    patternId: 'panah',
    effectId: 'debu',
    reward: 135,
    windSpeed: 5.6,
    gustiness: 0.34,
    upgrades: { 'line-strength': 1, 'gelasan': 1, 'reel-speed': 1 },
    ai: {
      reactionTime: 0.58,
      aggression: 0.6,
      precision: 0.63,
      discipline: 0.5,
      mistakeRate: 0.16,
      caution: 0.38,
    },
  },
  {
    id: 'bos-pasar',
    i18nKey: 'bos-pasar',
    tier: 4,
    isBoss: true,
    kiteId: 'bebean',
    paletteId: 'mercusuar',
    patternId: 'papan',
    effectId: 'asap',
    reward: 280,
    windSpeed: 6.4,
    gustiness: 0.42,
    upgrades: { 'line-strength': 2, 'gelasan': 2, 'stamina': 1 },
    ai: {
      reactionTime: 0.44,
      aggression: 0.72,
      precision: 0.72,
      discipline: 0.62,
      mistakeRate: 0.1,
      caution: 0.34,
    },
  },
  {
    id: 'si-gelasan',
    i18nKey: 'si-gelasan',
    tier: 5,
    isBoss: false,
    kiteId: 'kotak',
    paletteId: 'arang',
    patternId: 'palang',
    effectId: 'kunang',
    reward: 220,
    windSpeed: 6.0,
    gustiness: 0.3,
    // Specialises in line abrasion: all coins went into gelasan.
    upgrades: { 'gelasan': 4, 'line-strength': 1 },
    ai: {
      reactionTime: 0.42,
      aggression: 0.85,
      precision: 0.7,
      discipline: 0.5,
      mistakeRate: 0.12,
      caution: 0.15,
    },
  },
  {
    id: 'sultan-angin',
    i18nKey: 'sultan-angin',
    tier: 6,
    isBoss: false,
    kiteId: 'elang',
    paletteId: 'batik-indigo',
    patternId: 'kawung',
    effectId: 'pelangi',
    reward: 300,
    windSpeed: 7.4,
    gustiness: 0.52,
    upgrades: { 'control': 3, 'reel-speed': 3, 'gelasan': 2, 'line-strength': 2 },
    ai: {
      reactionTime: 0.32,
      aggression: 0.68,
      precision: 0.82,
      discipline: 0.78,
      mistakeRate: 0.07,
      caution: 0.45,
    },
  },
  {
    id: 'raja-sawangan',
    i18nKey: 'raja-sawangan',
    tier: 7,
    isBoss: true,
    kiteId: 'sawangan',
    paletteId: 'nusantara',
    patternId: 'bintang',
    effectId: 'bara',
    reward: 480,
    windSpeed: 8.2,
    gustiness: 0.46,
    upgrades: { 'line-strength': 4, 'gelasan': 3, 'stamina': 3, 'control': 2 },
    ai: {
      reactionTime: 0.26,
      aggression: 0.8,
      precision: 0.87,
      discipline: 0.85,
      mistakeRate: 0.05,
      caution: 0.4,
    },
  },
  {
    id: 'naga-senja',
    i18nKey: 'naga-senja',
    tier: 8,
    isBoss: true,
    kiteId: 'naga',
    paletteId: 'arang',
    patternId: 'lidah-api',
    effectId: 'bara',
    reward: 850,
    windSpeed: 9.0,
    gustiness: 0.6,
    upgrades: { 'line-strength': 5, 'gelasan': 5, 'reel-speed': 4, 'control': 4, 'stamina': 4 },
    ai: {
      reactionTime: 0.2,
      aggression: 0.9,
      precision: 0.93,
      discipline: 0.92,
      mistakeRate: 0.03,
      caution: 0.35,
    },
  },
] as const

const OPPONENT_INDEX = new Map<OpponentId, OpponentDefinition>(
  OPPONENTS.map(opponent => [opponent.id, opponent]),
)

export function getOpponent(id: OpponentId): OpponentDefinition {
  const opponent = OPPONENT_INDEX.get(id)
  if (!opponent) throw new Error(`Unknown opponent id: ${id}`)
  return opponent
}

export function findOpponent(id: string | undefined): OpponentDefinition | undefined {
  return id ? OPPONENT_INDEX.get(id as OpponentId) : undefined
}

export const FIRST_OPPONENT_ID: OpponentId = 'bocah-sawah'

/**
 * Opponents unlocked for a player who has beaten `defeated`.
 * The ladder always leaves the next rung visible so progress is legible.
 */
export function availableOpponents(defeated: readonly OpponentId[]): readonly OpponentDefinition[] {
  const beaten = new Set(defeated)
  const highestBeatenTier = OPPONENTS.reduce(
    (tier, opponent) => (beaten.has(opponent.id) ? Math.max(tier, opponent.tier) : tier),
    0,
  )
  return OPPONENTS.filter(opponent => opponent.tier <= highestBeatenTier + 1)
}

export function isOpponentUnlocked(
  opponent: OpponentDefinition,
  defeated: readonly OpponentId[],
): boolean {
  return availableOpponents(defeated).some(candidate => candidate.id === opponent.id)
}

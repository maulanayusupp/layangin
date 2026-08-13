import type { TrailEffect, TrailEffectId } from '~/services/game/types'

/**
 * Trail effects — the particle plume a kite leaves behind.
 *
 * Purely cosmetic by design: none of these values feed the physics or combat
 * model, so buying an effect can never be pay-to-win. The `/shop` page states
 * this, and the `/compliance` page repeats it.
 */
export const TRAIL_EFFECTS: readonly TrailEffect[] = [
  {
    id: 'none',
    i18nKey: 'none',
    rarity: 'common',
    price: 0,
    emissionRate: 0,
    lifetime: 0,
    tint: 'palette',
    size: 0,
    buoyancy: 0,
  },
  {
    id: 'debu',
    i18nKey: 'debu',
    rarity: 'common',
    price: 90,
    emissionRate: 26,
    lifetime: 0.7,
    tint: 'palette',
    size: 1.6,
    buoyancy: 0.4,
  },
  {
    id: 'kunang',
    i18nKey: 'kunang',
    rarity: 'uncommon',
    price: 240,
    emissionRate: 14,
    lifetime: 1.6,
    tint: '#ffe07a',
    size: 2.4,
    buoyancy: 1.5,
  },
  {
    id: 'asap',
    i18nKey: 'asap',
    rarity: 'uncommon',
    price: 240,
    emissionRate: 34,
    lifetime: 1.9,
    tint: '#c9d3ef',
    size: 4.2,
    buoyancy: 0.9,
  },
  {
    id: 'pelangi',
    i18nKey: 'pelangi',
    rarity: 'rare',
    price: 620,
    emissionRate: 44,
    lifetime: 1.1,
    tint: 'palette',
    size: 2.8,
    buoyancy: 0.2,
  },
  {
    id: 'bara',
    i18nKey: 'bara',
    rarity: 'epic',
    price: 1200,
    emissionRate: 52,
    lifetime: 1.3,
    tint: '#ff7a1a',
    size: 3.2,
    buoyancy: 2.2,
  },
] as const

const EFFECT_INDEX = new Map<TrailEffectId, TrailEffect>(
  TRAIL_EFFECTS.map(effect => [effect.id, effect]),
)

export const DEFAULT_EFFECT_ID: TrailEffectId = 'debu'

export function getTrailEffect(id: TrailEffectId): TrailEffect {
  const effect = EFFECT_INDEX.get(id)
  if (!effect) throw new Error(`Unknown trail effect id: ${id}`)
  return effect
}

export function findTrailEffect(id: string | undefined): TrailEffect | undefined {
  return id ? EFFECT_INDEX.get(id as TrailEffectId) : undefined
}

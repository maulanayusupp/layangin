import { getKite } from '~/data/kites'
import { getUpgrade, normaliseUpgradeLevels } from '~/data/upgrades'
import { BASE_REEL_SPEED } from './constants'
import type { KiteId, KiteStats, UpgradeLevels } from './types'

/**
 * Turns "what the player owns" into "what the simulation flies".
 *
 * This is the single place upgrades are applied. Keeping it in one pure function
 * means the shop preview, the codex comparison and the match itself can never
 * disagree about what a loadout is worth.
 */
export interface ResolvedLoadout {
  stats: KiteStats
  /** Metres of line per second at full haul. */
  reelSpeed: number
  /** Divides stamina drain. >1 means the fighter tires more slowly. */
  staminaEfficiency: number
  /** Multiplies coin rewards. */
  rewardMultiplier: number
}

export function resolveLoadout(kiteId: KiteId, upgradeLevels: Partial<UpgradeLevels>): ResolvedLoadout {
  const kite = getKite(kiteId)
  const levels = normaliseUpgradeLevels(upgradeLevels)

  const multiplier = (id: keyof UpgradeLevels): number =>
    getUpgrade(id).multiplierAt(levels[id])

  return {
    stats: {
      ...kite.stats,
      lineStrength: kite.stats.lineStrength * multiplier('line-strength'),
      cutPower: kite.stats.cutPower * multiplier('gelasan'),
      agility: kite.stats.agility * multiplier('control'),
    },
    reelSpeed: BASE_REEL_SPEED * multiplier('reel-speed'),
    staminaEfficiency: multiplier('stamina'),
    rewardMultiplier: multiplier('luck'),
  }
}

/**
 * Comparison figures for the codex and shop, normalised to 0..1 so a bar chart
 * can render them side by side. The divisors are the ceilings across the whole
 * catalog plus upgrade headroom, so a full-bar stat genuinely means best-in-class.
 */
export interface LoadoutRating {
  lift: number
  speed: number
  control: number
  toughness: number
  bite: number
  stability: number
}

export function rateLoadout(kiteId: KiteId, upgradeLevels: Partial<UpgradeLevels> = {}): LoadoutRating {
  const { stats } = resolveLoadout(kiteId, upgradeLevels)
  const clampRatio = (value: number): number => Math.max(0, Math.min(1, value))

  return {
    // Lift capacity scales with sail area and lift coefficient together.
    lift: clampRatio((stats.area * stats.liftCoefficient) / 2.0),
    // Light and low-drag means fast.
    speed: clampRatio(1 - (stats.mass * 1.1 + stats.dragCoefficient + stats.tailDrag) / 1.4),
    control: clampRatio(stats.agility / 5.5),
    toughness: clampRatio(stats.lineStrength / 2.4),
    bite: clampRatio(stats.cutPower / 2.4),
    stability: clampRatio(stats.stability / 3.0),
  }
}

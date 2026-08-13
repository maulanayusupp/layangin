import type { UpgradeDefinition, UpgradeId, UpgradeLevels } from '~/services/game/types'

/**
 * Upgrade tree.
 *
 * Every upgrade multiplies a stat that already exists in the physics model, so
 * the effect is legible in the simulation rather than being an opaque bonus.
 * Levels are capped and cost grows geometrically, which keeps the last level a
 * genuine goal without making it unreachable.
 */

/** Cost curve: `base · growth^level`, rounded to a readable number. */
function geometricCost(base: number, growth: number) {
  return (level: number): number => Math.round((base * growth ** level) / 10) * 10
}

/** Linear multiplier: level 0 → 1, each level adds `step`. */
function linearMultiplier(step: number) {
  return (level: number): number => 1 + step * level
}

export const UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: 'line-strength',
    i18nKey: 'line-strength',
    maxLevel: 6,
    affects: 'lineStrength',
    costAt: geometricCost(180, 1.72),
    multiplierAt: linearMultiplier(0.11),
  },
  {
    id: 'gelasan',
    i18nKey: 'gelasan',
    maxLevel: 6,
    affects: 'cutPower',
    costAt: geometricCost(200, 1.78),
    multiplierAt: linearMultiplier(0.12),
  },
  {
    id: 'reel-speed',
    i18nKey: 'reel-speed',
    maxLevel: 5,
    affects: 'reelSpeed',
    costAt: geometricCost(150, 1.68),
    multiplierAt: linearMultiplier(0.10),
  },
  {
    id: 'control',
    i18nKey: 'control',
    maxLevel: 5,
    affects: 'agility',
    costAt: geometricCost(160, 1.66),
    multiplierAt: linearMultiplier(0.09),
  },
  {
    id: 'stamina',
    i18nKey: 'stamina',
    maxLevel: 5,
    affects: 'stamina',
    costAt: geometricCost(140, 1.62),
    multiplierAt: linearMultiplier(0.13),
  },
  {
    id: 'luck',
    i18nKey: 'luck',
    maxLevel: 4,
    affects: 'rewards',
    costAt: geometricCost(320, 1.9),
    multiplierAt: linearMultiplier(0.08),
  },
] as const

const UPGRADE_INDEX = new Map<UpgradeId, UpgradeDefinition>(
  UPGRADES.map(upgrade => [upgrade.id, upgrade]),
)

export function getUpgrade(id: UpgradeId): UpgradeDefinition {
  const upgrade = UPGRADE_INDEX.get(id)
  if (!upgrade) throw new Error(`Unknown upgrade id: ${id}`)
  return upgrade
}

export function emptyUpgradeLevels(): UpgradeLevels {
  return {
    'line-strength': 0,
    'gelasan': 0,
    'reel-speed': 0,
    'control': 0,
    'stamina': 0,
    'luck': 0,
  }
}

/** Fill any missing key so persisted saves from an older version still load. */
export function normaliseUpgradeLevels(levels: Partial<UpgradeLevels> | undefined): UpgradeLevels {
  const base = emptyUpgradeLevels()
  if (!levels) return base

  for (const upgrade of UPGRADES) {
    const raw = levels[upgrade.id]
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      base[upgrade.id] = Math.max(0, Math.min(upgrade.maxLevel, Math.floor(raw)))
    }
  }

  return base
}

/** Cost of the next level, or `null` when already maxed. */
export function nextUpgradeCost(id: UpgradeId, currentLevel: number): number | null {
  const upgrade = getUpgrade(id)
  if (currentLevel >= upgrade.maxLevel) return null
  return upgrade.costAt(currentLevel)
}

/** Total coins spent to reach a level — used by the "total invested" read-out. */
export function upgradeInvestment(id: UpgradeId, level: number): number {
  const upgrade = getUpgrade(id)
  let total = 0
  for (let i = 0; i < level; i += 1) total += upgrade.costAt(i)
  return total
}

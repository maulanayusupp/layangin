import { describe, expect, it } from 'vitest'
import { computeReward, difficultyForClears } from '~/services/economy/rewards'
import { isPlayerWin, PLAYER_INDEX } from '~/services/game/types'
import { checkPurchase } from '~/services/economy/shop'
import { resolveLoadout, rateLoadout } from '~/services/game/loadout'
import { getOpponent, availableOpponents } from '~/data/opponents'
import { KITES } from '~/data/kites'
import { UPGRADES, normaliseUpgradeLevels, nextUpgradeCost, upgradeInvestment } from '~/data/upgrades'
import { migrateSave } from '~/services/persistence/migrations'
import { createDefaultSave } from '~/services/persistence/schema'
import type { MatchStats } from '~/services/game/types'

const stats: MatchStats = {
  durationSeconds: 40,
  clashSeconds: 8,
  peakTension: 120,
  snapsUsed: 3,
  peakAltitude: 70,
  roundsWon: 1,
  roundsLost: 0,
  opponentsBeaten: 1,
}

describe('rewards', () => {
  const opponent = getOpponent('anak-kampung')

  it('pays the full base reward for a clean cut', () => {
    const reward = computeReward({ kind: 'cut', winner: PLAYER_INDEX }, [opponent], stats, 1, [true])
    expect(reward.coins).toBe(opponent.reward)
  })

  it('pays less for a scrappier win', () => {
    const cut = computeReward({ kind: 'cut', winner: PLAYER_INDEX }, [opponent], stats, 1, [true])
    const crash = computeReward({ kind: 'crash', winner: PLAYER_INDEX }, [opponent], stats, 1, [true])
    const timeout = computeReward({ kind: 'timeout', winner: PLAYER_INDEX }, [opponent], stats, 1, [true])

    expect(crash.coins).toBeLessThan(cut.coins)
    expect(timeout.coins).toBeLessThan(crash.coins)
  })

  it('still pays something on a loss, so progress never fully stalls', () => {
    const reward = computeReward({ kind: 'cut', winner: 1 }, [opponent], stats, 1, [true])
    expect(reward.coins).toBeGreaterThan(0)
    expect(reward.coins).toBeLessThan(opponent.reward)
  })

  it('adds a first-win bounty only the first time', () => {
    const first = computeReward({ kind: 'cut', winner: PLAYER_INDEX }, [opponent], stats, 1, [false])
    const repeat = computeReward({ kind: 'cut', winner: PLAYER_INDEX }, [opponent], stats, 1, [true])

    expect(first.isFirstWin).toBe(true)
    expect(repeat.isFirstWin).toBe(false)
    expect(first.bonusCoins).toBeGreaterThan(repeat.bonusCoins)
  })

  it('pays a larger first-win bounty for a boss', () => {
    const boss = getOpponent('bos-pasar')
    const normal = computeReward({ kind: 'cut', winner: PLAYER_INDEX }, [opponent], stats, 1, [false])
    const bossReward = computeReward({ kind: 'cut', winner: PLAYER_INDEX }, [boss], stats, 1, [false])

    // Relative to their own base reward, the boss bounty is the bigger share.
    expect(bossReward.bonusCoins / boss.reward).toBeGreaterThan(normal.bonusCoins / opponent.reward)
  })

  it('applies the reputation multiplier', () => {
    const plain = computeReward({ kind: 'cut', winner: PLAYER_INDEX }, [opponent], stats, 1, [true])
    const lucky = computeReward({ kind: 'cut', winner: PLAYER_INDEX }, [opponent], stats, 1.5, [true])

    expect(lucky.coins).toBeGreaterThan(plain.coins)
  })

  it('pays nothing for an unfinished match', () => {
    const reward = computeReward({ kind: 'pending' }, [opponent], stats, 1, [false])
    expect(reward.coins).toBe(0)
    expect(reward.bonusCoins).toBe(0)
  })

  it('identifies a player win regardless of how it was won', () => {
    expect(isPlayerWin({ kind: 'cut', winner: PLAYER_INDEX })).toBe(true)
    expect(isPlayerWin({ kind: 'crash', winner: PLAYER_INDEX })).toBe(true)
    expect(isPlayerWin({ kind: 'timeout', winner: 'draw' })).toBe(false)
    expect(isPlayerWin({ kind: 'pending' })).toBe(false)
  })

  it('raises difficulty with each ladder clear, but caps it', () => {
    expect(difficultyForClears(0)).toBe(1)
    expect(difficultyForClears(2)).toBeGreaterThan(1)
    expect(difficultyForClears(100)).toBeLessThanOrEqual(2.5)
  })
})

describe('purchases', () => {
  it('reports owned items as owned', () => {
    expect(checkPurchase({ price: 100, coins: 0, owned: true }).state).toBe('owned')
  })

  it('reports the exact shortfall when coins are short', () => {
    const check = checkPurchase({ price: 500, coins: 320, owned: false })
    expect(check.state).toBe('too-expensive')
    expect(check.shortfall).toBe(180)
  })

  it('reports a win requirement before a price requirement', () => {
    const check = checkPurchase({ price: 100, coins: 0, owned: false, unlockWins: 5, wins: 2 })
    expect(check.state).toBe('locked')
    expect(check.winsNeeded).toBe(3)
  })

  it('is affordable when unlocked and paid for', () => {
    const check = checkPurchase({ price: 100, coins: 100, owned: false, unlockWins: 1, wins: 1 })
    expect(check.state).toBe('affordable')
  })
})

describe('upgrades', () => {
  it('is neutral at level zero', () => {
    for (const upgrade of UPGRADES) {
      expect(upgrade.multiplierAt(0)).toBe(1)
    }
  })

  it('increases monotonically and costs more each level', () => {
    for (const upgrade of UPGRADES) {
      for (let level = 0; level < upgrade.maxLevel; level += 1) {
        expect(upgrade.multiplierAt(level + 1)).toBeGreaterThan(upgrade.multiplierAt(level))
        expect(upgrade.costAt(level + 1)).toBeGreaterThan(upgrade.costAt(level))
      }
    }
  })

  it('has no next cost once maxed', () => {
    for (const upgrade of UPGRADES) {
      expect(nextUpgradeCost(upgrade.id, upgrade.maxLevel)).toBeNull()
    }
  })

  it('sums investment across levels', () => {
    const upgrade = UPGRADES[0]!
    const expected = upgrade.costAt(0) + upgrade.costAt(1)
    expect(upgradeInvestment(upgrade.id, 2)).toBe(expected)
  })

  it('clamps out-of-range persisted levels', () => {
    const levels = normaliseUpgradeLevels({ 'line-strength': 999, 'gelasan': -4 })
    expect(levels['line-strength']).toBe(UPGRADES[0]!.maxLevel)
    expect(levels.gelasan).toBe(0)
  })
})

describe('loadout resolution', () => {
  it('leaves stats untouched with no upgrades', () => {
    const base = KITES[0]!
    const resolved = resolveLoadout(base.id, {})
    expect(resolved.stats.lineStrength).toBeCloseTo(base.stats.lineStrength, 6)
    expect(resolved.stats.cutPower).toBeCloseTo(base.stats.cutPower, 6)
  })

  it('applies each upgrade to the stat it claims to affect', () => {
    const base = resolveLoadout('pecut', {})
    const upgraded = resolveLoadout('pecut', {
      'line-strength': 3,
      'gelasan': 3,
      'control': 3,
      'reel-speed': 3,
    })

    expect(upgraded.stats.lineStrength).toBeGreaterThan(base.stats.lineStrength)
    expect(upgraded.stats.cutPower).toBeGreaterThan(base.stats.cutPower)
    expect(upgraded.stats.agility).toBeGreaterThan(base.stats.agility)
    expect(upgraded.reelSpeed).toBeGreaterThan(base.reelSpeed)
  })

  it('keeps every rating inside 0..1 for every kite', () => {
    for (const kite of KITES) {
      const rating = rateLoadout(kite.id)
      for (const [key, value] of Object.entries(rating)) {
        expect(value, `${kite.id}.${key}`).toBeGreaterThanOrEqual(0)
        expect(value, `${kite.id}.${key}`).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('ladder unlocks', () => {
  it('shows only the first rung to a new player', () => {
    expect(availableOpponents([])).toHaveLength(1)
  })

  it('reveals the next rung after each win', () => {
    expect(availableOpponents(['bocah-sawah'])).toHaveLength(2)
    expect(availableOpponents(['bocah-sawah', 'anak-kampung'])).toHaveLength(3)
  })
})

describe('save migration', () => {
  it('returns defaults for junk input', () => {
    expect(migrateSave(null).coins).toBe(createDefaultSave().coins)
    expect(migrateSave('nonsense').ownedKites).toContain('pecut')
    expect(migrateSave({ coins: Number.NaN }).coins).toBe(createDefaultSave().coins)
  })

  it('drops content ids the build no longer knows about', () => {
    const migrated = migrateSave({
      version: 1,
      ownedKites: ['pecut', 'kite-that-was-removed'],
      defeated: ['bocah-sawah', 'someone-deleted'],
    })

    expect(migrated.ownedKites).toEqual(['pecut'])
    expect(migrated.defeated).toEqual(['bocah-sawah'])
  })

  it('never leaves the player equipped with something they do not own', () => {
    const migrated = migrateSave({
      version: 1,
      ownedKites: ['pecut'],
      loadout: { kiteId: 'naga', paletteId: 'nusantara', effectId: 'bara' },
    })

    expect(migrated.loadout.kiteId).toBe('pecut')
    expect(migrated.loadout.paletteId).toBe('senja')
  })

  it('always restores the starter kite', () => {
    const migrated = migrateSave({ version: 1, ownedKites: [] })
    expect(migrated.ownedKites).toContain('pecut')
  })

  it('preserves valid progress', () => {
    const migrated = migrateSave({
      version: 1,
      coins: 4321,
      wins: 12,
      losses: 3,
      bestStreak: 5,
      ownedKites: ['pecut', 'delta'],
    })

    expect(migrated.coins).toBe(4321)
    expect(migrated.wins).toBe(12)
    expect(migrated.ownedKites).toContain('delta')
  })
})

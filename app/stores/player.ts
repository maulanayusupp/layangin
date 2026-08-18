import { KITES, findKite } from '~/data/kites'
import { PALETTES } from '~/data/palettes'
import { PATTERNS } from '~/data/patterns'
import { TRAIL_EFFECTS } from '~/data/effects'
import { ARENAS, getArena, isArenaUnlocked } from '~/data/arenas'
import { UPGRADES, getUpgrade, nextUpgradeCost } from '~/data/upgrades'
import { OPPONENTS, availableOpponents } from '~/data/opponents'
import { CHALLENGES } from '~/data/challenges'
import { challengeDay, challengesFor, type ChallengeAward } from '~/services/economy/challenges'
import { checkPurchase } from '~/services/economy/shop'
import { difficultyForClears } from '~/services/economy/rewards'
import { resolveLoadout } from '~/services/game/loadout'
import type {
  ArenaId,
  ChallengeId,
  KiteId,
  MatchLoadout,
  MatchReward,
  OpponentId,
  PaletteId,
  PatternId,
  TrailEffectId,
  UpgradeId,
} from '~/services/game/types'
import { migrateSave } from '~/services/persistence/migrations'
import { SAVE_STORAGE_KEY, createDefaultSave, type SaveData } from '~/services/persistence/schema'
import { readJson, removeKey, writeJson } from '~/services/persistence/storage'

/**
 * Progress, wallet and inventory.
 *
 * Every mutation persists immediately. There is no server: the save lives only in
 * the player's browser, which is a deliberate trade — nothing to sign up for and
 * no data collected, at the cost of progress being per-device. Both halves of
 * that trade are stated on `/legal/privacy` and `/compliance`.
 */
export const usePlayerStore = defineStore('player', () => {
  const save = ref<SaveData>(createDefaultSave())
  const hydrated = ref(false)
  /** Set when the browser refuses storage, so the UI can warn once. */
  const storageBlocked = ref(false)

  // --- Derived ---------------------------------------------------------------

  const coins = computed(() => save.value.coins)
  const wins = computed(() => save.value.wins)
  const losses = computed(() => save.value.losses)

  const loadout = computed<MatchLoadout>(() => ({
    kiteId: save.value.loadout.kiteId,
    paletteId: save.value.loadout.paletteId,
    patternId: save.value.loadout.patternId,
    effectId: save.value.loadout.effectId,
    upgrades: save.value.upgrades,
  }))

  const equippedKite = computed(() => findKite(save.value.loadout.kiteId) ?? KITES[0]!)

  /** Stats the player currently flies with, upgrades included. */
  const resolved = computed(() => resolveLoadout(save.value.loadout.kiteId, save.value.upgrades))

  const ladder = computed(() => availableOpponents(save.value.defeated))

  const difficultyScale = computed(() => difficultyForClears(save.value.ladderClears))

  const ladderProgress = computed(() => ({
    beaten: save.value.defeated.length,
    total: OPPONENTS.length,
    ratio: OPPONENTS.length === 0 ? 0 : save.value.defeated.length / OPPONENTS.length,
  }))

  /** The next opponent to fight: lowest tier not yet beaten. */
  const nextOpponent = computed(() => {
    const beaten = new Set(save.value.defeated)
    return OPPONENTS.find(opponent => !beaten.has(opponent.id)) ?? OPPONENTS[OPPONENTS.length - 1]!
  })

  function owns(kind: 'kite' | 'palette' | 'pattern' | 'effect', id: string): boolean {
    if (kind === 'kite') return save.value.ownedKites.includes(id as KiteId)
    if (kind === 'palette') return save.value.ownedPalettes.includes(id as PaletteId)
    if (kind === 'pattern') return save.value.ownedPatterns.includes(id as PatternId)
    return save.value.ownedEffects.includes(id as TrailEffectId)
  }

  /** Arenas the player has earned access to, plus the next one as a teaser. */
  const arenas = computed(() =>
    ARENAS.map(arena => ({
      arena,
      unlocked: isArenaUnlocked(arena, save.value.wins),
      winsNeeded: Math.max(0, arena.unlockWins - save.value.wins),
    })),
  )

  const activeArena = computed(() => {
    const chosen = getArena(save.value.arenaId)
    // A save can carry an arena that a progress reset has re-locked.
    return isArenaUnlocked(chosen, save.value.wins) ? chosen : getArena(ARENAS[0]!.id)
  })

  function selectArena(id: ArenaId): boolean {
    const arena = getArena(id)
    if (!isArenaUnlocked(arena, save.value.wins)) return false
    save.value.arenaId = id
    persist()
    return true
  }

  function hasDefeated(id: OpponentId): boolean {
    return save.value.defeated.includes(id)
  }

  // --- Persistence -----------------------------------------------------------

  function persist(): void {
    save.value.updatedAt = new Date().toISOString()
    const written = writeJson(SAVE_STORAGE_KEY, save.value)
    storageBlocked.value = !written
  }

  function load(): void {
    if (hydrated.value) return
    const raw = readJson(SAVE_STORAGE_KEY)
    save.value = migrateSave(raw)
    hydrated.value = true
    // Write the migrated shape straight back so the next load is a clean read.
    if (raw) persist()
  }

  function resetProgress(): void {
    save.value = createDefaultSave()
    removeKey(SAVE_STORAGE_KEY)
    persist()
  }

  // --- Shop ------------------------------------------------------------------

  function kitePurchase(id: KiteId) {
    const kite = findKite(id)
    if (!kite) return checkPurchase({ price: 0, coins: 0, owned: true })
    return checkPurchase({
      price: kite.price,
      coins: save.value.coins,
      owned: owns('kite', id),
      unlockWins: kite.unlockWins,
      wins: save.value.wins,
    })
  }

  function buyKite(id: KiteId): boolean {
    const kite = findKite(id)
    if (!kite) return false
    if (kitePurchase(id).state !== 'affordable') return false

    save.value.coins -= kite.price
    save.value.ownedKites.push(id)
    save.value.loadout.kiteId = id
    persist()
    return true
  }

  function buyPalette(id: PaletteId): boolean {
    const palette = PALETTES.find(item => item.id === id)
    if (!palette || owns('palette', id) || save.value.coins < palette.price) return false

    save.value.coins -= palette.price
    save.value.ownedPalettes.push(id)
    save.value.loadout.paletteId = id
    persist()
    return true
  }

  function buyPattern(id: PatternId): boolean {
    const pattern = PATTERNS.find(item => item.id === id)
    if (!pattern || owns('pattern', id) || save.value.coins < pattern.price) return false

    save.value.coins -= pattern.price
    save.value.ownedPatterns.push(id)
    save.value.loadout.patternId = id
    persist()
    return true
  }

  function buyEffect(id: TrailEffectId): boolean {
    const effect = TRAIL_EFFECTS.find(item => item.id === id)
    if (!effect || owns('effect', id) || save.value.coins < effect.price) return false

    save.value.coins -= effect.price
    save.value.ownedEffects.push(id)
    save.value.loadout.effectId = id
    persist()
    return true
  }

  function equipKite(id: KiteId): boolean {
    if (!owns('kite', id)) return false
    save.value.loadout.kiteId = id
    persist()
    return true
  }

  function equipPalette(id: PaletteId): boolean {
    if (!owns('palette', id)) return false
    save.value.loadout.paletteId = id
    persist()
    return true
  }

  function equipPattern(id: PatternId): boolean {
    if (!owns('pattern', id)) return false
    save.value.loadout.patternId = id
    persist()
    return true
  }

  function equipEffect(id: TrailEffectId): boolean {
    if (!owns('effect', id)) return false
    save.value.loadout.effectId = id
    persist()
    return true
  }

  /**
   * Equip an airframe and a pattern together.
   *
   * The picker grid presents a kite as one thing — a shape wearing a livery — so
   * selecting a cell has to set both halves in a single persisted write, rather
   * than two that could half-apply.
   */
  function equipDesign(kiteId: KiteId, patternId: PatternId): boolean {
    if (!owns('kite', kiteId) || !owns('pattern', patternId)) return false
    save.value.loadout.kiteId = kiteId
    save.value.loadout.patternId = patternId
    persist()
    return true
  }

  // --- Upgrades --------------------------------------------------------------

  function upgradeLevel(id: UpgradeId): number {
    return save.value.upgrades[id]
  }

  function upgradeCost(id: UpgradeId): number | null {
    return nextUpgradeCost(id, save.value.upgrades[id])
  }

  function canUpgrade(id: UpgradeId): boolean {
    const cost = upgradeCost(id)
    return cost !== null && save.value.coins >= cost
  }

  function buyUpgrade(id: UpgradeId): boolean {
    const cost = upgradeCost(id)
    if (cost === null || save.value.coins < cost) return false

    const definition = getUpgrade(id)
    if (save.value.upgrades[id] >= definition.maxLevel) return false

    save.value.coins -= cost
    save.value.upgrades[id] += 1
    persist()
    return true
  }

  /** Coins the player could still usefully spend — drives the shop badge. */
  const affordableCount = computed(() => {
    let count = 0
    for (const kite of KITES) if (kitePurchase(kite.id).state === 'affordable') count += 1
    for (const palette of PALETTES) {
      if (!owns('palette', palette.id) && save.value.coins >= palette.price) count += 1
    }
    for (const pattern of PATTERNS) {
      if (!owns('pattern', pattern.id) && save.value.coins >= pattern.price) count += 1
    }
    for (const effect of TRAIL_EFFECTS) {
      if (!owns('effect', effect.id) && save.value.coins >= effect.price) count += 1
    }
    for (const upgrade of UPGRADES) if (canUpgrade(upgrade.id)) count += 1
    return count
  })

  // --- Match results ---------------------------------------------------------

  /**
   * Record a finished match. Returns the coins actually granted so the result
   * screen can show the same number that was banked.
   */
  /**
   * Bank a finished match.
   *
   * Takes every opponent who was in it: winning a free-for-all marks all of them
   * beaten, which is the whole appeal of taking on three at once.
   */
  /**
   * Today's challenges, and whether each is done.
   *
   * Derived rather than stored: the trio comes from the date, so there is nothing to
   * keep in sync and nothing to expire. See `services/economy/challenges.ts`.
   */
  const challenges = computed(() =>
    challengesFor(challengeDay(new Date()), save.value.completedChallenges),
  )

  const challengesCleared = computed(
    () => save.value.completedChallenges.length >= CHALLENGES.length,
  )

  function hasCompletedChallenge(id: ChallengeId): boolean {
    return save.value.completedChallenges.includes(id)
  }

  /**
   * Bank completed challenges and pay for them. Returns the coins granted.
   *
   * Each one pays once, ever — the caller has already filtered by that, and the
   * `includes` guard here makes it true even if it has not.
   */
  function completeChallenges(awards: readonly ChallengeAward[]): number {
    let granted = 0

    for (const award of awards) {
      if (save.value.completedChallenges.includes(award.challenge.id)) continue
      save.value.completedChallenges.push(award.challenge.id)
      granted += award.coins
    }

    if (granted > 0) {
      save.value.coins += granted
      save.value.lifetimeCoins += granted
      persist()
    }

    return granted
  }

  function recordMatch(
    opponentIds: readonly OpponentId[],
    reward: MatchReward,
    playerWon: boolean,
  ): number {
    const granted = reward.coins + reward.bonusCoins

    save.value.coins += granted
    save.value.lifetimeCoins += granted

    if (playerWon) {
      save.value.wins += 1
      save.value.currentStreak += 1
      save.value.bestStreak = Math.max(save.value.bestStreak, save.value.currentStreak)

      for (const opponentId of opponentIds) {
        if (save.value.defeated.includes(opponentId)) continue
        save.value.defeated.push(opponentId)
      }

      // Clearing the final rung counts as a ladder completion and raises the
      // AI's skill on the next run through.
      if (save.value.defeated.length >= OPPONENTS.length) {
        save.value.ladderClears += 1
        save.value.defeated = []
      }
    }
    else {
      save.value.losses += 1
      save.value.currentStreak = 0
    }

    persist()
    return granted
  }

  return {
    save,
    hydrated,
    storageBlocked,
    coins,
    wins,
    losses,
    loadout,
    equippedKite,
    resolved,
    ladder,
    ladderProgress,
    difficultyScale,
    nextOpponent,
    arenas,
    activeArena,
    selectArena,
    owns,
    hasDefeated,
    load,
    persist,
    resetProgress,
    kitePurchase,
    buyKite,
    buyPalette,
    buyPattern,
    buyEffect,
    equipKite,
    equipPalette,
    equipPattern,
    equipEffect,
    equipDesign,
    upgradeLevel,
    upgradeCost,
    canUpgrade,
    buyUpgrade,
    affordableCount,
    recordMatch,
    challenges,
    challengesCleared,
    hasCompletedChallenge,
    completeChallenges,
  }
})

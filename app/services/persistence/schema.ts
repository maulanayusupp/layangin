import { DEFAULT_KITE_ID } from '~/data/kites'
import { DEFAULT_PALETTE_ID } from '~/data/palettes'
import { DEFAULT_PATTERN_ID } from '~/data/patterns'
import { DEFAULT_EFFECT_ID } from '~/data/effects'
import { DEFAULT_ARENA_ID } from '~/data/arenas'
import { emptyUpgradeLevels } from '~/data/upgrades'
import type {
  ArenaId,
  KiteId,
  OpponentId,
  PaletteId,
  PatternId,
  TrailEffectId,
  UpgradeLevels,
} from '~/services/game/types'

/**
 * Persisted save format.
 *
 * ## Why it is versioned
 * The save lives in the player's own browser storage, so an update cannot
 * migrate it server-side — the app has to be able to read whatever an older
 * version wrote. `version` plus the migration chain in `migrations.ts` is what
 * makes shipping a balance change safe.
 *
 * ## What is deliberately NOT stored
 * No personal data of any kind: no name, no email, no identifier, no analytics.
 * This is stated on `/legal/privacy` and `/compliance`, and those pages must be
 * updated together with this file (see CLAUDE.md → "Change workflow").
 */
export const CURRENT_SAVE_VERSION = 1

export const SAVE_STORAGE_KEY = 'layangin:save'
export const SETTINGS_STORAGE_KEY = 'layangin:settings'

export interface SaveDataV1 {
  version: 1
  coins: number
  ownedKites: KiteId[]
  ownedPalettes: PaletteId[]
  ownedPatterns: PatternId[]
  ownedEffects: TrailEffectId[]
  loadout: {
    kiteId: KiteId
    paletteId: PaletteId
    patternId: PatternId
    effectId: TrailEffectId
  }
  /** Last arena the player chose. Arenas unlock by win count, not purchase. */
  arenaId: ArenaId
  upgrades: UpgradeLevels
  /** Opponents beaten at least once. Drives ladder unlocks. */
  defeated: OpponentId[]
  wins: number
  losses: number
  currentStreak: number
  bestStreak: number
  /** How many times the whole ladder has been cleared; scales difficulty. */
  ladderClears: number
  /** Total coins ever earned, for the profile read-out. */
  lifetimeCoins: number
  updatedAt: string
}

export type SaveData = SaveDataV1

export interface SettingsData {
  version: 1
  /** Empty means "follow the browser / route". */
  locale: string
  /** Skip particles and gradients. Also forced on by prefers-reduced-motion. */
  reducedEffects: boolean
  sound: boolean
  /** Hint ids the player has dismissed, so a tip is not shown forever. */
  dismissedHints: string[]
}

export function createDefaultSave(): SaveData {
  return {
    version: CURRENT_SAVE_VERSION,
    coins: 250,
    ownedKites: [DEFAULT_KITE_ID],
    ownedPalettes: [DEFAULT_PALETTE_ID],
    ownedPatterns: [DEFAULT_PATTERN_ID],
    ownedEffects: ['none', DEFAULT_EFFECT_ID],
    loadout: {
      kiteId: DEFAULT_KITE_ID,
      paletteId: DEFAULT_PALETTE_ID,
      patternId: DEFAULT_PATTERN_ID,
      effectId: DEFAULT_EFFECT_ID,
    },
    arenaId: DEFAULT_ARENA_ID,
    upgrades: emptyUpgradeLevels(),
    defeated: [],
    wins: 0,
    losses: 0,
    currentStreak: 0,
    bestStreak: 0,
    ladderClears: 0,
    lifetimeCoins: 0,
    updatedAt: new Date().toISOString(),
  }
}

export function createDefaultSettings(): SettingsData {
  return {
    version: 1,
    locale: '',
    reducedEffects: false,
    sound: true,
    dismissedHints: [],
  }
}

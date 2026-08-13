import { findKite } from '~/data/kites'
import { findPalette } from '~/data/palettes'
import { findPattern } from '~/data/patterns'
import { findTrailEffect } from '~/data/effects'
import { findArena } from '~/data/arenas'
import { normaliseUpgradeLevels } from '~/data/upgrades'
import { findOpponent } from '~/data/opponents'
import type {
  KiteId,
  OpponentId,
  PaletteId,
  PatternId,
  TrailEffectId,
} from '~/services/game/types'
import {
  CURRENT_SAVE_VERSION,
  createDefaultSave,
  createDefaultSettings,
  type SaveData,
  type SettingsData,
} from './schema'

/**
 * Load-time repair.
 *
 * A save can be older than the running build, hand-edited, or reference content
 * that was renamed. Rather than trusting it or discarding it, every field is
 * validated against the live catalogs and anything unrecognised is dropped. The
 * player keeps their coins and progress even if one kite id no longer exists.
 */

function toFiniteNumber(value: unknown, fallback: number, min = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, value) : fallback
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/** Keep only ids the current build still knows about, without duplicates. */
function keepKnown<T extends string>(
  ids: string[],
  resolve: (id: string) => { id: T } | undefined,
): T[] {
  const seen = new Set<T>()
  for (const id of ids) {
    const known = resolve(id)
    if (known) seen.add(known.id)
  }
  return [...seen]
}

export function migrateSave(raw: unknown): SaveData {
  const defaults = createDefaultSave()
  if (!raw || typeof raw !== 'object') return defaults

  const input = raw as Record<string, unknown>

  // Only version 1 exists so far. When version 2 lands, chain the upgrade here
  // (v1 → v2) instead of falling through to defaults, so nobody loses progress.
  const version = toFiniteNumber(input.version, 0)
  if (version > CURRENT_SAVE_VERSION) {
    // A newer build wrote this. Reading it optimistically is safer than wiping
    // it: unknown fields are ignored and the validated ones still load.
    // Nothing to do beyond the field-by-field validation below.
  }

  const loadoutInput = (input.loadout ?? {}) as Record<string, unknown>

  const ownedKites = keepKnown<KiteId>(toStringArray(input.ownedKites), findKite)
  const ownedPalettes = keepKnown<PaletteId>(toStringArray(input.ownedPalettes), findPalette)
  const ownedPatterns = keepKnown<PatternId>(toStringArray(input.ownedPatterns), findPattern)
  const ownedEffects = keepKnown<TrailEffectId>(toStringArray(input.ownedEffects), findTrailEffect)
  const defeated = keepKnown<OpponentId>(toStringArray(input.defeated), findOpponent)

  // The starter kite can never be missing, or the player would be unable to fly.
  for (const id of defaults.ownedKites) if (!ownedKites.includes(id)) ownedKites.push(id)
  for (const id of defaults.ownedPalettes) if (!ownedPalettes.includes(id)) ownedPalettes.push(id)
  for (const id of defaults.ownedPatterns) if (!ownedPatterns.includes(id)) ownedPatterns.push(id)
  for (const id of defaults.ownedEffects) if (!ownedEffects.includes(id)) ownedEffects.push(id)

  const equippedKite = findKite(loadoutInput.kiteId as string | undefined)?.id
  const equippedPalette = findPalette(loadoutInput.paletteId as string | undefined)?.id
  const equippedPattern = findPattern(loadoutInput.patternId as string | undefined)?.id
  const equippedEffect = findTrailEffect(loadoutInput.effectId as string | undefined)?.id

  return {
    version: CURRENT_SAVE_VERSION,
    coins: Math.floor(toFiniteNumber(input.coins, defaults.coins)),
    ownedKites,
    ownedPalettes,
    ownedPatterns,
    ownedEffects,
    loadout: {
      // Never leave the player equipped with something they do not own.
      kiteId: equippedKite && ownedKites.includes(equippedKite) ? equippedKite : defaults.loadout.kiteId,
      paletteId:
        equippedPalette && ownedPalettes.includes(equippedPalette)
          ? equippedPalette
          : defaults.loadout.paletteId,
      patternId:
        equippedPattern && ownedPatterns.includes(equippedPattern)
          ? equippedPattern
          : defaults.loadout.patternId,
      effectId:
        equippedEffect && ownedEffects.includes(equippedEffect)
          ? equippedEffect
          : defaults.loadout.effectId,
    },
    // Arenas unlock by wins, so an unknown id just falls back to the first one.
    arenaId: findArena(input.arenaId as string | undefined)?.id ?? defaults.arenaId,
    upgrades: normaliseUpgradeLevels(input.upgrades as never),
    defeated,
    wins: Math.floor(toFiniteNumber(input.wins, 0)),
    losses: Math.floor(toFiniteNumber(input.losses, 0)),
    currentStreak: Math.floor(toFiniteNumber(input.currentStreak, 0)),
    bestStreak: Math.floor(toFiniteNumber(input.bestStreak, 0)),
    ladderClears: Math.floor(toFiniteNumber(input.ladderClears, 0)),
    lifetimeCoins: Math.floor(toFiniteNumber(input.lifetimeCoins, 0)),
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date().toISOString(),
  }
}

export function migrateSettings(raw: unknown): SettingsData {
  const defaults = createDefaultSettings()
  if (!raw || typeof raw !== 'object') return defaults

  const input = raw as Record<string, unknown>

  return {
    version: 1,
    locale: typeof input.locale === 'string' ? input.locale : defaults.locale,
    reducedEffects:
      typeof input.reducedEffects === 'boolean' ? input.reducedEffects : defaults.reducedEffects,
    sound: typeof input.sound === 'boolean' ? input.sound : defaults.sound,
    dismissedHints: toStringArray(input.dismissedHints),
  }
}

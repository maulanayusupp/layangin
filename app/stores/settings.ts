import {
  SETTINGS_STORAGE_KEY,
  createDefaultSettings,
  type SettingsData,
} from '~/services/persistence/schema'
import { migrateSettings } from '~/services/persistence/migrations'
import { readJson, writeJson } from '~/services/persistence/storage'

/**
 * Player preferences.
 *
 * Separate from the progress store on purpose: settings are read during the very
 * first render (reduced effects gates the particle system) while progress is
 * only needed once the player opens the shop or starts a match.
 */
export const useSettingsStore = defineStore('settings', () => {
  const state = ref<SettingsData>(createDefaultSettings())
  const hydrated = ref(false)

  /** True when the OS asks for less motion, or the player switched effects off. */
  const reducedEffects = computed(() => state.value.reducedEffects)
  const sound = computed(() => state.value.sound)

  function load(): void {
    if (hydrated.value) return
    state.value = migrateSettings(readJson(SETTINGS_STORAGE_KEY))
    hydrated.value = true
  }

  function persist(): void {
    writeJson(SETTINGS_STORAGE_KEY, state.value)
  }

  function setReducedEffects(value: boolean): void {
    state.value.reducedEffects = value
    persist()
  }

  function setSound(value: boolean): void {
    state.value.sound = value
    persist()
  }

  function setLocale(locale: string): void {
    state.value.locale = locale
    persist()
  }

  function isHintDismissed(id: string): boolean {
    return state.value.dismissedHints.includes(id)
  }

  function dismissHint(id: string): void {
    if (state.value.dismissedHints.includes(id)) return
    state.value.dismissedHints.push(id)
    persist()
  }

  function restoreHints(): void {
    state.value.dismissedHints = []
    persist()
  }

  return {
    state,
    hydrated,
    reducedEffects,
    sound,
    load,
    setReducedEffects,
    setSound,
    setLocale,
    isHintDismissed,
    dismissHint,
    restoreHints,
  }
})

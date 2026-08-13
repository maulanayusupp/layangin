/**
 * Hydrates persisted state on the client.
 *
 * Client-only by design: the save lives in `localStorage`, which does not exist
 * during prerender. Loading it here — before the app mounts — means components
 * read real values on their first client render instead of the defaults.
 *
 * Also folds the OS reduced-motion preference into the effects setting, so a
 * player who has asked the system for less motion does not have to ask again.
 */
export default defineNuxtPlugin(() => {
  const player = usePlayerStore()
  const settings = useSettingsStore()

  player.load()
  settings.load()

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    settings.setReducedEffects(true)
  }
})

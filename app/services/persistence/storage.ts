/**
 * Guarded `localStorage` access.
 *
 * Three failure modes are handled, all of them real:
 *
 * 1. **No window** — this code also runs during SSR/prerender.
 * 2. **Access throws** — Safari private browsing and locked-down enterprise
 *    profiles throw on the *first property read*, not on `setItem`.
 * 3. **Quota exceeded** — writing can fail even when reading works.
 *
 * In every case the app must keep working with in-memory state rather than
 * crashing, which is why nothing here throws.
 */

let cachedAvailability: boolean | null = null

export function isStorageAvailable(): boolean {
  if (cachedAvailability !== null) return cachedAvailability

  if (typeof window === 'undefined') {
    cachedAvailability = false
    return false
  }

  try {
    const probe = '__layangin_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    cachedAvailability = true
  }
  catch {
    cachedAvailability = false
  }

  return cachedAvailability
}

export function readJson<T>(key: string): T | null {
  if (!isStorageAvailable()) return null

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  }
  catch {
    // Corrupt or hand-edited value: treat as absent rather than breaking boot.
    return null
  }
}

export function writeJson(key: string, value: unknown): boolean {
  if (!isStorageAvailable()) return false

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  }
  catch {
    return false
  }
}

export function removeKey(key: string): void {
  if (!isStorageAvailable()) return

  try {
    window.localStorage.removeItem(key)
  }
  catch {
    // Nothing useful to do; the caller has already reset its in-memory state.
  }
}

/**
 * Small DOM helpers. Auto-imported by Nuxt.
 */

let idCounter = 0

/**
 * Stable unique id for `aria-describedby` / `for` pairings.
 *
 * Prefixed per call site so ids are debuggable in the inspector. Vue's `useId()`
 * covers SSR-safe ids for components; this is for the imperative cases (a
 * tooltip created on demand) where no component instance is available.
 */
export function nextDomId(prefix = 'lyg'): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

/**
 * Device pixel ratio, capped.
 *
 * Rendering a full-screen canvas at a phone's native 3× costs nine times the
 * fill rate of 1× for a difference almost nobody can see on a moving image, so
 * the arena caps at 2.
 */
export function canvasPixelRatio(cap = 2): number {
  if (typeof window === 'undefined') return 1
  return Math.min(cap, window.devicePixelRatio || 1)
}

/** True when the primary input is coarse — used to show touch controls. */
export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches
}

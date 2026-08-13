/**
 * Display formatting helpers. Auto-imported by Nuxt.
 *
 * Every function takes an explicit locale so output follows the page language
 * rather than the browser's — a page rendered in Indonesian must show
 * `1.250`, not `1,250`. Callers pass `locale.value` from `useI18n()`.
 */

/** Coin amounts. Thousands separated, never fractional. */
export function formatCoins(amount: number, locale = 'en'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(amount))
}

/** Compact form for tight spaces: 12.4k. */
export function formatCompact(amount: number, locale = 'en'): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)
}

/** Seconds → `m:ss`, for the match clock. */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

/** 0..1 → whole percent. */
export function formatPercent(ratio: number, locale = 'en'): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.min(1, ratio)))
}

/**
 * Physical read-outs for the HUD and codex. The unit is appended literally
 * because SI symbols are the same in both supported languages.
 */
export function formatMetres(value: number, locale = 'en'): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} m`
}

export function formatSpeed(value: number, locale = 'en'): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} m/s`
}

export function formatNewtons(value: number, locale = 'en'): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} N`
}

export function formatKilograms(value: number, locale = 'en'): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} kg`
}

export function formatArea(value: number, locale = 'en'): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)} m²`
}

/** Signed multiplier, e.g. `+12%`, used on upgrade rows. */
export function formatBonus(multiplier: number, locale = 'en'): string {
  const delta = multiplier - 1
  const formatted = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
    signDisplay: 'exceptZero',
  }).format(delta)
  return formatted
}

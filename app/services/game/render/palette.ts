/**
 * Canvas colour constants for the arena itself (sky, ground, lines, sparks).
 *
 * These mirror the SCSS design tokens in `assets/styles/base/_tokens.scss` but
 * must be literal strings: a `<canvas>` cannot read CSS custom properties.
 * When a token changes, change its twin here — the pairing is listed in
 * CLAUDE.md → "Styling rules" so it does not drift silently.
 */
export const ARENA = {
  /** Dusk sky, top to horizon. Twin of `--g-dusk`. */
  skyStops: [
    [0, '#06090f'],
    [0.34, '#0d1430'],
    [0.58, '#241f4d'],
    [0.78, '#5d2f4e'],
    [0.92, '#a9503a'],
    [1, '#d9723c'],
  ] as const,

  sun: '#ffcf8a',
  sunGlow: 'rgba(255, 158, 74, 0.42)',

  cloud: 'rgba(255, 226, 198, 0.10)',
  cloudLit: 'rgba(255, 196, 148, 0.16)',

  /** Distant hills, nearest last. */
  hills: ['#1b1c3a', '#141531', '#0c0d22'] as const,
  ground: '#080a15',
  groundLine: 'rgba(255, 194, 75, 0.22)',
  village: '#05060e',

  line: 'rgba(238, 241, 255, 0.55)',
  lineTaut: 'rgba(255, 255, 255, 0.85)',
  lineFrayed: '#ff4d5e',

  spark: '#ffd98a',
  sparkHot: '#fff4d6',

  fighter: '#04060d',
  fighterTrim: '#ff6a2b',

  playerMarker: '#35dfc7',
  rivalMarker: '#ff4d5e',
} as const

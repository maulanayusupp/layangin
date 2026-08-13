import type { Palette, PaletteId } from '~/services/game/types'

/**
 * Kite colourways.
 *
 * Each palette fills the paint roles a kite's geometry references, so any
 * palette works on any airframe. Names come from what the colours actually are:
 * *senja* is dusk, *pandan* is the green of pandan leaf, *gula kelapa* is palm
 * sugar.
 *
 * Colours are plain hex because they are painted onto a `<canvas>` where CSS
 * custom properties are not available. The site chrome uses the design tokens
 * in `assets/styles/base/_tokens.scss` instead — these two sets are intentionally
 * separate concerns.
 */
export const PALETTES: readonly Palette[] = [
  {
    id: 'senja',
    i18nKey: 'senja',
    rarity: 'common',
    price: 0,
    colors: {
      primary: '#ff6a2b',
      secondary: '#ffc24b',
      accent: '#fff1d0',
      shade: '#c03e10',
      outline: '#2a1206',
    },
  },
  {
    id: 'pandan',
    i18nKey: 'pandan',
    rarity: 'common',
    price: 120,
    colors: {
      primary: '#3ed27f',
      secondary: '#d7f36b',
      accent: '#f2fff0',
      shade: '#1c8a4d',
      outline: '#0a2a18',
    },
  },
  {
    id: 'samudra',
    i18nKey: 'samudra',
    rarity: 'uncommon',
    price: 260,
    colors: {
      primary: '#2f7cf6',
      secondary: '#35dfc7',
      accent: '#eaf6ff',
      shade: '#1a4aa8',
      outline: '#07173a',
    },
  },
  {
    id: 'gula-kelapa',
    i18nKey: 'gula-kelapa',
    rarity: 'uncommon',
    price: 260,
    colors: {
      primary: '#f5f7ff',
      secondary: '#e8384f',
      accent: '#ffd9a0',
      shade: '#a01528',
      outline: '#2b0810',
    },
  },
  {
    id: 'batik-indigo',
    i18nKey: 'batik-indigo',
    rarity: 'rare',
    price: 520,
    colors: {
      primary: '#2b3a8f',
      secondary: '#8fa3ff',
      accent: '#f0e6c8',
      shade: '#141c52',
      outline: '#080b24',
    },
  },
  {
    id: 'mercusuar',
    i18nKey: 'mercusuar',
    rarity: 'rare',
    price: 520,
    colors: {
      primary: '#ffd60a',
      secondary: '#ff3d6e',
      accent: '#fffbe6',
      shade: '#c48a00',
      outline: '#2a1c00',
    },
  },
  {
    id: 'arang',
    i18nKey: 'arang',
    rarity: 'epic',
    price: 900,
    colors: {
      primary: '#1d2233',
      secondary: '#3b4666',
      accent: '#ff6a2b',
      shade: '#0c0f19',
      outline: '#000000',
    },
  },
  {
    id: 'nusantara',
    i18nKey: 'nusantara',
    rarity: 'legend',
    price: 1600,
    colors: {
      primary: '#8b6bff',
      secondary: '#ffc24b',
      accent: '#35dfc7',
      shade: '#4a2ca8',
      outline: '#160a34',
    },
  },
] as const

const PALETTE_INDEX = new Map<PaletteId, Palette>(PALETTES.map(palette => [palette.id, palette]))

export const DEFAULT_PALETTE_ID: PaletteId = 'senja'

export function getPalette(id: PaletteId): Palette {
  const palette = PALETTE_INDEX.get(id)
  if (!palette) throw new Error(`Unknown palette id: ${id}`)
  return palette
}

export function findPalette(id: string | undefined): Palette | undefined {
  return id ? PALETTE_INDEX.get(id as PaletteId) : undefined
}

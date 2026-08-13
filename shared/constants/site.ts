/**
 * Single source of truth for site-wide, non-translatable identity values.
 *
 * Lives in `shared/` so it is importable from `nuxt.config.ts`, Nitro server
 * routes and the Vue app alike. Anything user-visible and translatable belongs
 * in `i18n/locales/**` instead — never here.
 */
export const SITE = {
  name: 'Layangin',
  tagline: 'Kite-fighting arena',
  url: 'https://layangin.vercel.app',
  defaultLocale: 'en',
  themeColor: '#0A0F1F',
  /** Only channel we publish. No phone number is collected or shown anywhere. */
  contactEmail: 'maulanayusupp@gmail.com',
  contactName: 'Maulana Yusup A',
  repository: 'https://github.com/maulanayusupp/layangin',
  /** Bumped when the persisted save schema changes — see services/persistence. */
  saveVersion: 1,
} as const

export type SiteConstants = typeof SITE

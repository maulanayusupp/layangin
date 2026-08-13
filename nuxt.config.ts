import { fileURLToPath } from 'node:url'
import { SITE } from './shared/constants/site'

const styleRoot = fileURLToPath(new URL('./app/assets/styles', import.meta.url))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxtjs/i18n',
    '@pinia/nuxt',
    '@vueuse/nuxt',
  ],

  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: SITE.defaultLocale },
      titleTemplate: `%s · ${SITE.name}`,
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/icons/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icons/favicon-32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/icons/favicon-16.png' },
        { rel: 'shortcut icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/icons/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: SITE.themeColor },
        { name: 'color-scheme', content: 'dark' },
        { name: 'apple-mobile-web-app-title', content: SITE.name },
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },

  css: ['~/assets/styles/main.scss'],

  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || SITE.url,
    },
  },

  routeRules: {
    '/play': { ssr: false }, // canvas-only view: no SSR payload to hydrate
    '/id/play': { ssr: false },
  },

  future: {
    compatibilityVersion: 4,
  },
  compatibilityDate: '2025-11-01',

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/sitemap.xml', '/robots.txt'],
    },
  },

  /**
   * Every stylesheet is compiled with the design-token layer pre-injected so a
   * component's <style lang="scss"> block can use tokens/mixins without repeating
   * an @use line. See CLAUDE.md → "Styling rules".
   */
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          loadPaths: [styleRoot],
          additionalData: '@use "abstracts" as *;\n',
          quietDeps: true,
        },
      },
    },
  },

  typescript: {
    strict: true,
    typeCheck: false, // run explicitly via `pnpm typecheck` to keep dev server fast
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },

  fonts: {
    families: [
      { name: 'Bricolage Grotesque', provider: 'google', weights: [500, 700, 800] },
      { name: 'Plus Jakarta Sans', provider: 'google', weights: [400, 500, 600, 700] },
      { name: 'JetBrains Mono', provider: 'google', weights: [500, 700] },
    ],
    defaults: { fallbacks: { 'sans-serif': ['Segoe UI', 'Helvetica Neue', 'Arial'] } },
  },

  // https://i18n.nuxtjs.org — locale files live in i18n/locales/<code>/*.json
  i18n: {
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    // Locale files are lazy-loaded by default in @nuxtjs/i18n v10.
    langDir: 'locales',
    locales: [
      {
        code: 'en',
        language: 'en-US',
        name: 'English',
        dir: 'ltr',
        files: [
          'en/common.json',
          'en/nav.json',
          'en/home.json',
          'en/game.json',
          'en/kites.json',
          'en/shop.json',
          'en/howto.json',
          'en/pages.json',
          'en/legal.json',
        ],
      },
      {
        code: 'id',
        language: 'id-ID',
        name: 'Bahasa Indonesia',
        dir: 'ltr',
        files: [
          'id/common.json',
          'id/nav.json',
          'id/home.json',
          'id/game.json',
          'id/kites.json',
          'id/shop.json',
          'id/howto.json',
          'id/pages.json',
          'id/legal.json',
        ],
      },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'layangin_locale',
      redirectOn: 'root',
      alwaysRedirect: false,
      fallbackLocale: 'en',
    },
  },

  // @pinia/nuxt resolves these against the layer's app dir, so `stores` means
  // `app/stores` under Nuxt 4's layout. (The module README's `app/stores` example
  // is for an older resolution path and would resolve to `app/app/stores` here.)
  pinia: {
    storesDirs: ['stores'],
  },
})

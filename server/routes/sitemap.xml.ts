import { SITE } from '../../shared/constants/site'

/**
 * Sitemap.
 *
 * Written by hand from a route list rather than crawled, so it stays correct
 * during prerender (when there is no running server to crawl) and so each URL
 * carries the `hreflang` alternates that tell search engines the two languages
 * are translations of one page rather than duplicates.
 *
 * `/play` is excluded: it is a client-rendered application view whose content is
 * a canvas, so there is nothing there for a crawler to index.
 */
const ROUTES: readonly { path: string, priority: string, changefreq: string }[] = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/kites', priority: '0.8', changefreq: 'monthly' },
  { path: '/shop', priority: '0.7', changefreq: 'monthly' },
  { path: '/how-to-play', priority: '0.8', changefreq: 'monthly' },
  { path: '/about', priority: '0.6', changefreq: 'monthly' },
  { path: '/contact', priority: '0.5', changefreq: 'yearly' },
  { path: '/compliance', priority: '0.5', changefreq: 'yearly' },
  { path: '/legal/privacy', priority: '0.4', changefreq: 'yearly' },
  { path: '/legal/terms', priority: '0.4', changefreq: 'yearly' },
  { path: '/legal/cookies', priority: '0.4', changefreq: 'yearly' },
]

/** `en` is the default locale and has no prefix; `id` is served under `/id`. */
const LOCALES = [
  { code: 'en', language: 'en-US', prefix: '' },
  { code: 'id', language: 'id-ID', prefix: '/id' },
] as const

export default defineEventHandler((event) => {
  const base = (
    (useRuntimeConfig(event).public.siteUrl as string) || SITE.url
  ).replace(/\/$/, '')

  const entries = ROUTES.flatMap(route =>
    LOCALES.map((locale) => {
      const path = `${locale.prefix}${route.path === '/' ? '' : route.path}` || '/'
      const alternates = LOCALES.map((alt) => {
        const altPath = `${alt.prefix}${route.path === '/' ? '' : route.path}` || '/'
        return `    <xhtml:link rel="alternate" hreflang="${alt.language}" href="${base}${altPath}" />`
      }).join('\n')

      return [
        '  <url>',
        `    <loc>${base}${path}</loc>`,
        alternates,
        `    <changefreq>${route.changefreq}</changefreq>`,
        `    <priority>${route.priority}</priority>`,
        '  </url>',
      ].join('\n')
    }),
  ).join('\n')

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
>
${entries}
</urlset>
`
})

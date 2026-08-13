import { SITE } from '../../shared/constants/site'

/**
 * robots.txt.
 *
 * Served from a route rather than `public/` so the sitemap URL follows
 * `NUXT_PUBLIC_SITE_URL` instead of being hardcoded to one deployment.
 *
 * `/play` is disallowed for crawling because it is a canvas application view with
 * no indexable content — not because it is private.
 */
export default defineEventHandler((event) => {
  const base = (
    (useRuntimeConfig(event).public.siteUrl as string) || SITE.url
  ).replace(/\/$/, '')

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /play',
    'Disallow: /id/play',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n')
})

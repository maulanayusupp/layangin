import { SITE } from '~~/shared/constants/site'

/**
 * Per-page metadata.
 *
 * Every page calls this with its own translation keys, so titles, descriptions
 * and social cards are all localised rather than English-only. Canonical and
 * `hreflang` links are emitted by `useLocaleHead` in `app.vue`; this handles the
 * page-level tags.
 */
export interface PageSeoOptions {
  /** Already-translated title, without the site-name suffix. */
  title: string
  description: string
  /** Absolute or root-relative OG image. Defaults to the generated card. */
  image?: string
  /** `website` for content pages, `game` reads oddly in most crawlers. */
  type?: 'website' | 'article'
  /** Ask crawlers not to index this page. */
  noindex?: boolean
}

export function usePageSeo(options: MaybeRefOrGetter<PageSeoOptions>) {
  const config = useRuntimeConfig()
  const { locale } = useI18n()
  const route = useRoute()

  const resolved = computed(() => toValue(options))

  const siteUrl = (config.public.siteUrl as string).replace(/\/$/, '')
  const url = computed(() => `${siteUrl}${route.path}`)
  const image = computed(() => {
    const path = resolved.value.image ?? '/og-image.png'
    return path.startsWith('http') ? path : `${siteUrl}${path}`
  })

  useSeoMeta({
    title: () => resolved.value.title,
    description: () => resolved.value.description,
    ogTitle: () => `${resolved.value.title} · ${SITE.name}`,
    ogDescription: () => resolved.value.description,
    ogType: () => resolved.value.type ?? 'website',
    ogUrl: () => url.value,
    ogImage: () => image.value,
    ogImageAlt: () => `${SITE.name} — ${SITE.tagline}`,
    ogSiteName: SITE.name,
    ogLocale: () => (locale.value === 'id' ? 'id_ID' : 'en_US'),
    twitterCard: 'summary_large_image',
    twitterTitle: () => resolved.value.title,
    twitterDescription: () => resolved.value.description,
    twitterImage: () => image.value,
    robots: () => (resolved.value.noindex ? 'noindex, nofollow' : 'index, follow'),
  })
}

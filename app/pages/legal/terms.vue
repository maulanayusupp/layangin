<script setup lang="ts">
import { SITE } from '~~/shared/constants/site'
import { TERMS_UPDATED } from '~~/shared/constants/legal'

/**
 * Terms of use.
 */
const { t } = useI18n()

const sections = [
  'what',
  'use',
  'progress',
  'availability',
  'warranty',
  'safety',
  'ip',
] as const

usePageSeo(() => ({
  title: t('legal.terms.meta.title'),
  description: t('legal.terms.meta.description'),
}))
</script>

<template>
  <LayoutLegalPage
    :eyebrow="t('legal.terms.header.eyebrow')"
    :title="t('legal.terms.header.title')"
    :lead="t('legal.terms.header.lead')"
    :updated="TERMS_UPDATED"
  >
    <template
      v-for="section in sections"
      :key="section"
    >
      <h2>{{ t(`legal.terms.sections.${section}.title`) }}</h2>
      <p>{{ t(`legal.terms.sections.${section}.body`) }}</p>
    </template>

    <h2>{{ t('legal.terms.sections.contact.title') }}</h2>
    <p>
      <i18n-t
        keypath="legal.terms.sections.contact.body"
        tag="span"
        scope="global"
      >
        <template #email>
          <a :href="`mailto:${SITE.contactEmail}`">{{ SITE.contactEmail }}</a>
        </template>
      </i18n-t>
    </p>
  </LayoutLegalPage>
</template>

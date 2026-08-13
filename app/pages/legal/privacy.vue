<script setup lang="ts">
import { PRIVACY_UPDATED } from '~~/shared/constants/legal'

/**
 * Privacy page.
 *
 * Every claim maps to something checkable in the repository: the storage keys in
 * `services/persistence/schema.ts`, the single i18n cookie configured in
 * `nuxt.config.ts`, and the absence of any analytics module in that same config.
 */
const { t, tm, rt } = useI18n()

const deviceItems = computed(() =>
  (tm('legal.privacy.sections.device.items') as unknown[]).map(item => rt(item as string)),
)

const sections = [
  'collect',
  'server',
  'third',
  'email',
  'delete',
  'children',
  'changes',
] as const

usePageSeo(() => ({
  title: t('legal.privacy.meta.title'),
  description: t('legal.privacy.meta.description'),
}))
</script>

<template>
  <LayoutLegalPage
    :eyebrow="t('legal.privacy.header.eyebrow')"
    :title="t('legal.privacy.header.title')"
    :lead="t('legal.privacy.header.lead')"
    :updated="PRIVACY_UPDATED"
  >
    <h2>{{ t('legal.privacy.sections.collect.title') }}</h2>
    <p>{{ t('legal.privacy.sections.collect.body') }}</p>

    <h2>{{ t('legal.privacy.sections.device.title') }}</h2>
    <p>{{ t('legal.privacy.sections.device.body') }}</p>
    <ul>
      <li
        v-for="(item, index) in deviceItems"
        :key="index"
      >
        {{ item }}
      </li>
    </ul>

    <template
      v-for="section in sections.slice(1)"
      :key="section"
    >
      <h2>{{ t(`legal.privacy.sections.${section}.title`) }}</h2>
      <p>{{ t(`legal.privacy.sections.${section}.body`) }}</p>
    </template>
  </LayoutLegalPage>
</template>

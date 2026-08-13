<script setup lang="ts">
/**
 * Landing page. Sections are separate components so each can be reordered or
 * A/B'd without touching a monolithic template.
 */
const { t } = useI18n()

usePageSeo(() => ({
  title: t('home.meta.title'),
  description: t('home.meta.description'),
}))
</script>

<template>
  <div>
    <HomeHero />
    <HomePhysics />
    <UiRule />
    <HomeKites />
    <HomeLadder />
    <HomeProgress />
    <UiRule />
    <HomeFaq />
    <HomeCta />
  </div>
</template>

<script setup lang="ts">
/**
 * Application root.
 *
 * `useLocaleHead` supplies the `lang`/`dir` attributes plus the canonical and
 * `hreflang` alternate links for the active route. Passing its output straight to
 * `useHead` is both simpler and better typed than rebuilding the tags in the
 * template.
 */
const head = useLocaleHead({ lang: true, dir: true, seo: true })

useHead(head)
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

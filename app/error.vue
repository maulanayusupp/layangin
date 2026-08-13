<script setup lang="ts">
import type { NuxtError } from '#app'

/**
 * Error page for both 404 and unexpected failures.
 *
 * Deliberately shows no stack or internal message to the visitor — that belongs
 * in the console, not on the page — and always offers a way back.
 */
const props = defineProps<{ error: Partial<NuxtError> }>()

const { t } = useI18n()
const localePath = useLocalePath()

const isNotFound = computed(() => props.error.statusCode === 404)

const title = computed(() => (isNotFound.value ? t('notFound.title') : t('error.title')))
const body = computed(() => (isNotFound.value ? t('notFound.body') : t('error.body')))

useHead({ title: () => title.value })
</script>

<template>
  <div class="error bg-grain">
    <div
      class="error__glow bg-glow-brand"
      aria-hidden="true"
    />

    <div class="error__inner l-container">
      <BrandLogo size="lg" />

      <p class="error__code t-num">
        {{ error.statusCode ?? 500 }}
      </p>
      <h1 class="error__title">
        {{ title }}
      </h1>
      <p class="error__body">
        {{ body }}
      </p>

      <div class="error__actions">
        <UiButton :to="localePath('/')">
          {{ t('notFound.action') }}
        </UiButton>
        <UiButton
          v-if="!isNotFound"
          variant="ghost"
          @click="clearError({ redirect: '/' })"
        >
          {{ t('error.reload') }}
        </UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.error {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 100dvh;
  overflow: hidden;
  background: var(--g-dusk);
}

.error__glow {
  position: absolute;
  inset: 0;
}

.error__inner {
  position: relative;
  display: grid;
  gap: var(--sp-3);
  justify-items: center;
  max-width: rem(560);
  text-align: center;
}

.error__code {
  font-family: var(--font-display);
  font-size: fluid(64, 132);
  line-height: 1;

  @include gradient-text;
}

.error__title {
  @include display-type(fluid(26, 40));
}

.error__body {
  max-width: 46ch;
  color: var(--c-text-soft);
}

.error__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  justify-content: center;
  margin-block-start: var(--sp-3);
}
</style>

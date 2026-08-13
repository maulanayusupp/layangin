<script setup lang="ts">
/**
 * Closing call to action.
 */
const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <section class="cta l-section--tight">
    <div class="l-container">
      <div class="cta__panel bg-grain">
        <div
          class="cta__strings bg-strings"
          aria-hidden="true"
        />

        <div class="cta__body">
          <h2 class="cta__title">
            {{ t('home.cta.title') }}
          </h2>
          <p class="cta__text">
            {{ t('home.cta.body') }}
          </p>
        </div>

        <UiButton
          size="lg"
          :to="localePath('/play')"
        >
          {{ t('home.cta.action') }}
        </UiButton>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.cta__panel {
  position: relative;
  display: grid;
  gap: var(--sp-4);
  align-items: center;
  overflow: hidden;
  padding: var(--sp-6);
  border: 1px solid color-mix(in srgb, var(--c-brand) 32%, transparent);
  background:
    radial-gradient(120% 160% at 100% 0%, rgb(255 106 43 / 22%), transparent 60%),
    var(--c-ink-700);

  @include notched(28px, 'tr-bl');

  @include mq('md') {
    grid-template-columns: 1fr auto;
    padding: var(--sp-7);
  }
}

.cta__strings {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.6;
}

.cta__body {
  position: relative;
  display: grid;
  gap: var(--sp-2);
}

.cta__title {
  @include display-type(fluid(26, 40));
}

.cta__text {
  font-size: var(--fs-md);
  color: var(--c-text-soft);
}
</style>

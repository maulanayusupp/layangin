<script setup lang="ts">
import { PALETTES } from '~/data/palettes'
import { TRAIL_EFFECTS } from '~/data/effects'
import { UPGRADES } from '~/data/upgrades'

/**
 * Progression section. Counts are read from the catalogs so the copy cannot claim
 * more content than exists.
 */
const { t } = useI18n()
const localePath = useLocalePath()

const items = computed(() => [
  { key: 'kites', count: null },
  { key: 'upgrades', count: UPGRADES.length },
  { key: 'cosmetics', count: PALETTES.length + TRAIL_EFFECTS.length },
] as const)
</script>

<template>
  <section class="progress l-section">
    <div class="l-container--wide">
      <UiSectionHeading
        :eyebrow="t('home.progress.eyebrow')"
        :title="t('home.progress.title')"
        :lead="t('home.progress.lead')"
      />

      <ul class="progress__grid">
        <UiPanel
          v-for="item in items"
          :key="item.key"
          as="li"
          interactive
          tone="sunken"
          class="progress__card"
        >
          <p
            v-if="item.count"
            class="progress__count t-num"
          >
            {{ item.count }}
          </p>
          <h3 class="progress__title">
            {{ t(`home.progress.items.${item.key}.title`) }}
          </h3>
          <p class="progress__body">
            {{ t(`home.progress.items.${item.key}.body`) }}
          </p>
        </UiPanel>
      </ul>

      <div class="progress__cta">
        <UiButton
          variant="secondary"
          :to="localePath('/shop')"
        >
          {{ t('actions.openShop') }}
        </UiButton>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.progress__grid {
  display: grid;
  gap: var(--sp-4);
  margin-block-start: var(--sp-6);

  @include mq('md') {
    grid-template-columns: repeat(3, 1fr);
  }
}

.progress__card {
  display: grid;
  gap: var(--sp-2);
  align-content: start;
}

.progress__count {
  font-family: var(--font-display);
  font-size: var(--fs-2xl);
  line-height: 1;

  @include gradient-text(var(--g-gold));
}

.progress__title {
  font-size: var(--fs-md);
}

.progress__body {
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.progress__cta {
  margin-block-start: var(--sp-5);
}
</style>

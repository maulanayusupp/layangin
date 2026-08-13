<script setup lang="ts">
import { KITES } from '~/data/kites'
import { DEFAULT_PALETTE_ID } from '~/data/palettes'
import { rateLoadout } from '~/services/game/loadout'

/**
 * Airframe showcase.
 *
 * Renders live previews of every kite in the catalog, so the claim "eight
 * different shapes" is checkable on the spot rather than taken on trust. On small
 * screens it becomes a horizontal snap rail instead of shrinking to thumbnails.
 */
const { t } = useI18n()
const localePath = useLocalePath()

const kites = computed(() =>
  KITES.map(kite => ({
    kite,
    name: t(`kites.items.${kite.i18nKey}.name`),
    rating: rateLoadout(kite.id),
  })),
)
</script>

<template>
  <section class="showcase l-section">
    <div class="l-container--wide">
      <div class="showcase__head">
        <UiSectionHeading
          :eyebrow="t('home.kites.eyebrow')"
          :title="t('home.kites.title')"
          :lead="t('home.kites.lead')"
        />
        <UiButton
          variant="ghost"
          :to="localePath('/kites')"
        >
          {{ t('home.kites.cta') }}
        </UiButton>
      </div>

      <ul class="showcase__rail">
        <li
          v-for="entry in kites"
          :key="entry.kite.id"
          class="showcase__item"
        >
          <UiPanel
            interactive
            class="showcase__card"
          >
            <KitePreview
              :kite-id="entry.kite.id"
              :palette-id="DEFAULT_PALETTE_ID"
              :name="entry.name"
              :tails="false"
              ratio="1"
            />
            <div class="showcase__meta">
              <h3 class="showcase__name">
                {{ entry.name }}
              </h3>
              <UiBadge :tone="entry.kite.rarity">
                {{ t(`rarity.${entry.kite.rarity}`) }}
              </UiBadge>
            </div>
            <p class="showcase__origin">
              {{ t(`origin.${entry.kite.origin}`) }}
            </p>
          </UiPanel>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped lang="scss">
.showcase__head {
  display: grid;
  gap: var(--sp-4);
  align-items: end;

  @include mq('md') {
    grid-template-columns: 1fr auto;
  }
}

.showcase__rail {
  margin-block-start: var(--sp-6);

  // Mobile: a snap rail keeps every kite at a readable size.
  @include snap-rail;

  padding-block-end: var(--sp-3);

  @include mq('lg') {
    display: grid;
    grid-auto-flow: row;
    grid-template-columns: repeat(4, 1fr);
    overflow: visible;
  }
}

.showcase__card {
  display: grid;
  gap: var(--sp-2);
  height: 100%;
  align-content: start;
}

.showcase__meta {
  display: flex;
  gap: var(--sp-2);
  align-items: center;
  justify-content: space-between;
}

.showcase__name {
  font-size: var(--fs-md);
}

.showcase__origin {
  font-family: var(--font-mono);
  font-size: rem(10);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}
</style>

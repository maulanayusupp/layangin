<script setup lang="ts">
import { rateLoadout } from '~/services/game/loadout'
import { DEFAULT_PATTERN_ID } from '~/data/patterns'
import type { KiteDefinition, PaletteId, PatternId } from '~/services/game/types'

/**
 * Kite card, used by both the codex and the shop.
 *
 * The two contexts differ only in the action slot, so the card itself stays one
 * component and cannot drift between the two views.
 */
const props = withDefaults(
  defineProps<{
    kite: KiteDefinition
    /** Palette to paint the preview in. */
    paletteId: PaletteId
    /** Livery to paint the preview in. */
    patternId?: PatternId
    owned?: boolean
    equipped?: boolean
    /** Show the six-bar rating chart. */
    showRating?: boolean
  }>(),
  { patternId: DEFAULT_PATTERN_ID, owned: false, equipped: false, showRating: true },
)

const { t, locale } = useI18n()

const rating = computed(() => rateLoadout(props.kite.id))
const name = computed(() => t(`kites.items.${props.kite.i18nKey}.name`))
</script>

<template>
  <UiPanel
    as="article"
    interactive
    :accent="equipped ? 'brand' : 'none'"
    class="kite-card"
  >
    <KitePreview
      :kite-id="kite.id"
      :palette-id="paletteId"
      :pattern-id="patternId"
      :name="name"
      :tails="false"
      ratio="4/3"
    />

    <div class="kite-card__head">
      <div class="kite-card__titles">
        <h3 class="kite-card__name">
          {{ name }}
        </h3>
        <p class="kite-card__origin">
          {{ t(`origin.${kite.origin}`) }}
        </p>
      </div>
      <UiBadge
        :tone="kite.rarity"
        marker
      >
        {{ t(`rarity.${kite.rarity}`) }}
      </UiBadge>
    </div>

    <p class="kite-card__lore">
      {{ t(`kites.items.${kite.i18nKey}.lore`) }}
    </p>

    <KiteRating
      v-if="showRating"
      :rating="rating"
      size="sm"
    />

    <dl class="kite-card__specs">
      <UiStat
        as="row"
        :label="t('kites.stat.area')"
        :value="formatArea(kite.stats.area, locale)"
        :tooltip="t('kites.tooltip.area')"
      />
      <UiStat
        as="row"
        :label="t('kites.stat.mass')"
        :value="formatKilograms(kite.stats.mass, locale)"
        :tooltip="t('kites.tooltip.mass')"
      />
      <UiStat
        as="row"
        :label="t('kites.stat.tailDrag')"
        :value="kite.stats.tailDrag.toFixed(2)"
        :tooltip="t('kites.tooltip.tailDrag')"
      />
    </dl>

    <p
      v-if="equipped"
      class="kite-card__flag"
    >
      {{ t('kites.equippedNote') }}
    </p>
    <p
      v-else-if="!owned && kite.unlockWins > 0"
      class="kite-card__flag kite-card__flag--muted"
    >
      {{ t('kites.unlockNote', { wins: kite.unlockWins }) }}
    </p>

    <div
      v-if="$slots.action"
      class="kite-card__action"
    >
      <slot name="action" />
    </div>
  </UiPanel>
</template>

<style scoped lang="scss">
.kite-card {
  display: grid;
  gap: var(--sp-3);
  align-content: start;
}

.kite-card__head {
  display: flex;
  gap: var(--sp-3);
  align-items: start;
  justify-content: space-between;
}

.kite-card__name {
  font-size: var(--fs-lg);
  line-height: 1.1;
}

.kite-card__origin {
  font-family: var(--font-mono);
  font-size: rem(10.5);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

.kite-card__lore {
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.kite-card__specs {
  display: grid;
  grid-template-columns: 1fr auto;
  column-gap: var(--sp-3);
}

.kite-card__flag {
  font-family: var(--font-mono);
  font-size: rem(10.5);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--c-brand-soft);
}

.kite-card__flag--muted {
  color: var(--c-text-mute);
}

.kite-card__action {
  display: grid;
  gap: var(--sp-2);
  margin-block-start: auto;
}
</style>

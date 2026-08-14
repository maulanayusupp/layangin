<script setup lang="ts">
import type { Palette } from '~/services/game/types'

/**
 * Colourway card.
 *
 * Shows the palette on the player's currently equipped airframe rather than on a
 * fixed sample kite, so the preview answers the question actually being asked:
 * how will this look on *my* kite?
 */
const props = defineProps<{
  palette: Palette
  owned: boolean
  equipped: boolean
}>()

const { t, locale } = useI18n()
const player = usePlayerStore()

const affordable = computed(() => player.coins >= props.palette.price)
const swatches = computed(() => [
  props.palette.colors.primary,
  props.palette.colors.secondary,
  props.palette.colors.accent,
  props.palette.colors.shade,
])
</script>

<template>
  <UiPanel
    as="article"
    interactive
    :accent="equipped ? 'brand' : 'none'"
    class="palette"
  >
    <KitePreview
      :kite-id="player.save.loadout.kiteId"
      :palette-id="palette.id"
      :pattern-id="player.save.loadout.patternId"
      :name="t(`shop.palettes.${palette.i18nKey}.name`)"
      :tails="false"
      ratio="4/3"
    />

    <div class="palette__head">
      <h3 class="palette__name">
        {{ t(`shop.palettes.${palette.i18nKey}.name`) }}
      </h3>
      <UiBadge
        :tone="palette.rarity"
        marker
      >
        {{ t(`rarity.${palette.rarity}`) }}
      </UiBadge>
    </div>

    <ul class="palette__swatches">
      <li
        v-for="(color, index) in swatches"
        :key="index"
        v-css-vars="{ swatch: color }"
        class="palette__swatch"
        aria-hidden="true"
      />
    </ul>

    <p class="palette__description">
      {{ t(`shop.palettes.${palette.i18nKey}.description`) }}
    </p>

    <div class="palette__action">
      <UiButton
        v-if="equipped"
        size="sm"
        variant="ghost"
        block
        disabled
      >
        {{ t('actions.equipped') }}
      </UiButton>
      <UiButton
        v-else-if="owned"
        size="sm"
        variant="secondary"
        block
        @click="player.equipPalette(palette.id)"
      >
        {{ t('actions.equip') }}
      </UiButton>
      <UiButton
        v-else
        size="sm"
        variant="gold"
        block
        :disabled="!affordable"
        @click="player.buyPalette(palette.id)"
      >
        {{ t('actions.buy') }} · {{ formatCoins(palette.price, locale) }}
      </UiButton>

      <p
        v-if="!owned && !affordable"
        class="palette__reason"
      >
        {{ t('shop.reason.too-expensive', { shortfall: formatCoins(palette.price - player.coins, locale) }) }}
      </p>
    </div>
  </UiPanel>
</template>

<style scoped lang="scss">
/**
 * A flex column, not a grid: the card's action is pushed to the foot with an auto
 * margin, and under `display: grid` with `align-content: start` that margin is
 * inert. Every card in a row would then end wherever its own text ended, which is
 * what made the grids look ragged.
 */
.palette {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  height: 100%;
}

.palette__head {
  display: flex;
  gap: var(--sp-3);
  align-items: center;
  justify-content: space-between;
}

.palette__name {
  font-size: var(--fs-md);
}

.palette__swatches {
  display: flex;
  gap: rem(5);
}

.palette__swatch {
  width: rem(22);
  height: rem(22);
  border: 1px solid rgb(0 0 0 / 40%);
  // `--swatch` comes from the palette data via v-css-vars.
  background: var(--swatch);
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
}

.palette__description {
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.palette__action {
  display: grid;
  gap: var(--sp-2);
  margin-block-start: auto;
}

.palette__reason {
  font-size: var(--fs-xs);
  text-align: center;
  color: var(--c-text-mute);
}
</style>

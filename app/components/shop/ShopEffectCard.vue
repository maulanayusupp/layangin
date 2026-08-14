<script setup lang="ts">
import type { TrailEffect } from '~/services/game/types'

/**
 * Trail effect card.
 *
 * Cosmetic-only, and the card says so: the note under the grid is a compliance
 * statement as much as a design one, and it is repeated on `/compliance`.
 */
const props = defineProps<{
  effect: TrailEffect
  owned: boolean
  equipped: boolean
}>()

const { t, locale } = useI18n()
const player = usePlayerStore()

const affordable = computed(() => player.coins >= props.effect.price)
const tint = computed(() =>
  props.effect.tint === 'palette' ? 'var(--c-brand)' : props.effect.tint,
)
</script>

<template>
  <UiPanel
    as="article"
    interactive
    :accent="equipped ? 'brand' : 'none'"
    class="effect"
  >
    <div class="effect__head">
      <h3 class="effect__name">
        {{ t(`shop.effects.${effect.i18nKey}.name`) }}
      </h3>
      <UiBadge
        :tone="effect.rarity"
        marker
      >
        {{ t(`rarity.${effect.rarity}`) }}
      </UiBadge>
    </div>

    <!-- Static swatch of the particle colour and density: honest about being a
         sample, and far cheaper than running six particle systems in a grid. -->
    <div
      v-css-vars="{ tint }"
      class="effect__sample"
      aria-hidden="true"
    >
      <span
        v-for="i in 9"
        :key="i"
        v-css-vars="{ i, size: effect.size || 1 }"
        class="effect__mote"
      />
    </div>

    <p class="effect__description">
      {{ t(`shop.effects.${effect.i18nKey}.description`) }}
    </p>

    <div class="effect__action">
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
        @click="player.equipEffect(effect.id)"
      >
        {{ t('actions.equip') }}
      </UiButton>
      <UiButton
        v-else
        size="sm"
        variant="gold"
        block
        :disabled="!affordable"
        @click="player.buyEffect(effect.id)"
      >
        {{ t('actions.buy') }} · {{ formatCoins(effect.price, locale) }}
      </UiButton>
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
.effect {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  height: 100%;
}

.effect__head {
  display: flex;
  gap: var(--sp-3);
  align-items: center;
  justify-content: space-between;
}

.effect__name {
  font-size: var(--fs-md);
}

.effect__sample {
  position: relative;
  height: rem(64);
  overflow: hidden;
  border-radius: var(--r-sm);
  background:
    linear-gradient(90deg, transparent, color-mix(in srgb, var(--tint) 10%, transparent)),
    var(--c-surface-sunken);
}

.effect__mote {
  position: absolute;
  // Nine motes fanned out along a diagonal, sized from the effect's own value.
  inset-block-start: calc(18% + var(--i) * 7%);
  inset-inline-start: calc(var(--i) * 10%);
  width: calc(var(--size) * #{rem(2)} + #{rem(2)});
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--tint);
  opacity: calc(1 - var(--i) * 0.09);
}

.effect__description {
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.effect__action {
  margin-block-start: auto;
}
</style>

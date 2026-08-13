<script setup lang="ts">
import type { KitePattern } from '~/services/game/types'

/**
 * Livery (*corak*) card.
 *
 * Previewed on the player's own equipped airframe and palette, so the card shows
 * the actual result of buying it rather than a generic sample. Cosmetic only.
 */
const props = defineProps<{
  pattern: KitePattern
  owned: boolean
  equipped: boolean
}>()

const { t, locale } = useI18n()
const player = usePlayerStore()

const affordable = computed(() => player.coins >= props.pattern.price)
</script>

<template>
  <UiPanel
    as="article"
    interactive
    :accent="equipped ? 'brand' : 'none'"
    class="corak"
  >
    <KitePreview
      :kite-id="player.save.loadout.kiteId"
      :palette-id="player.save.loadout.paletteId"
      :pattern-id="pattern.id"
      :name="t(`shop.patterns.${pattern.i18nKey}.name`)"
      :tails="false"
      ratio="4/3"
    />

    <div class="corak__head">
      <h3 class="corak__name">
        {{ t(`shop.patterns.${pattern.i18nKey}.name`) }}
      </h3>
      <UiBadge
        :tone="pattern.rarity"
        marker
      >
        {{ t(`rarity.${pattern.rarity}`) }}
      </UiBadge>
    </div>

    <p class="corak__description">
      {{ t(`shop.patterns.${pattern.i18nKey}.description`) }}
    </p>

    <div class="corak__action">
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
        @click="player.equipPattern(pattern.id)"
      >
        {{ t('actions.equip') }}
      </UiButton>
      <UiButton
        v-else
        size="sm"
        variant="gold"
        block
        :disabled="!affordable"
        @click="player.buyPattern(pattern.id)"
      >
        {{ t('actions.buy') }} · {{ formatCoins(pattern.price, locale) }}
      </UiButton>

      <p
        v-if="!owned && !affordable"
        class="corak__reason"
      >
        {{ t('shop.reason.too-expensive', {
          shortfall: formatCoins(pattern.price - player.coins, locale),
        }) }}
      </p>
    </div>
  </UiPanel>
</template>

<style scoped lang="scss">
.corak {
  display: grid;
  gap: var(--sp-3);
  align-content: start;
}

.corak__head {
  display: flex;
  gap: var(--sp-3);
  align-items: center;
  justify-content: space-between;
}

.corak__name {
  font-size: var(--fs-md);
}

.corak__description {
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.corak__action {
  display: grid;
  gap: var(--sp-2);
  margin-block-start: auto;
}

.corak__reason {
  font-size: var(--fs-xs);
  text-align: center;
  color: var(--c-text-mute);
}
</style>

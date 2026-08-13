<script setup lang="ts">
import { upgradeInvestment } from '~/data/upgrades'
import type { UpgradeDefinition } from '~/services/game/types'

/**
 * One upgrade row: current level, what the next level does, and the price.
 *
 * The current and next multipliers are both shown before purchase, so the player
 * can decide whether a level is worth it instead of buying blind.
 */
const props = defineProps<{ upgrade: UpgradeDefinition }>()

const { t, locale } = useI18n()
const player = usePlayerStore()

const level = computed(() => player.upgradeLevel(props.upgrade.id))
const maxed = computed(() => level.value >= props.upgrade.maxLevel)
const cost = computed(() => player.upgradeCost(props.upgrade.id))
const canBuy = computed(() => player.canUpgrade(props.upgrade.id))

const currentBonus = computed(() => formatBonus(props.upgrade.multiplierAt(level.value), locale.value))
const nextBonus = computed(() =>
  maxed.value ? null : formatBonus(props.upgrade.multiplierAt(level.value + 1), locale.value),
)
const invested = computed(() => upgradeInvestment(props.upgrade.id, level.value))
</script>

<template>
  <UiPanel
    as="li"
    tone="sunken"
    notch="none"
    class="upgrade"
  >
    <div class="upgrade__main">
      <div class="upgrade__titles">
        <h3 class="upgrade__name">
          {{ t(`shop.upgrades.${upgrade.i18nKey}.name`) }}
        </h3>
        <p class="upgrade__description">
          {{ t(`shop.upgrades.${upgrade.i18nKey}.description`) }}
        </p>
      </div>

      <div class="upgrade__buy">
        <UiButton
          v-if="!maxed"
          size="sm"
          variant="gold"
          :disabled="!canBuy"
          @click="player.buyUpgrade(upgrade.id)"
        >
          {{ formatCoins(cost ?? 0, locale) }}
        </UiButton>
        <UiBadge
          v-else
          tone="success"
          marker
        >
          {{ t('shop.maxed') }}
        </UiBadge>
      </div>
    </div>

    <!-- Pips read faster than a number when comparing six upgrades at a glance. -->
    <div class="upgrade__track">
      <ul
        class="upgrade__pips"
        :aria-label="`${t('labels.level')} ${level} / ${upgrade.maxLevel}`"
      >
        <li
          v-for="pip in upgrade.maxLevel"
          :key="pip"
          class="upgrade__pip"
          :class="{ 'is-filled': pip <= level }"
        />
      </ul>

      <p class="upgrade__numbers t-num">
        {{ t('shop.currentEffect', { value: currentBonus }) }}
        <template v-if="nextBonus">
          · <span class="upgrade__next">{{ t('shop.nextEffect', { value: nextBonus }) }}</span>
        </template>
      </p>
    </div>

    <p
      v-if="invested > 0"
      class="upgrade__invested"
    >
      {{ t('shop.invested') }}: {{ formatCoins(invested, locale) }}
    </p>
  </UiPanel>
</template>

<style scoped lang="scss">
.upgrade {
  display: grid;
  gap: var(--sp-3);
}

.upgrade__main {
  display: flex;
  gap: var(--sp-4);
  align-items: start;
  justify-content: space-between;
}

.upgrade__name {
  font-size: var(--fs-md);
}

.upgrade__description {
  max-width: 56ch;
  margin-block-start: rem(3);
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
}

.upgrade__buy {
  flex: none;
}

.upgrade__track {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-3);
  align-items: center;
}

.upgrade__pips {
  display: flex;
  gap: rem(4);
}

.upgrade__pip {
  width: rem(16);
  height: rem(6);
  border-radius: var(--r-pill);
  background: var(--c-ink-500);

  &.is-filled {
    background: var(--g-gold);
  }
}

.upgrade__numbers {
  font-size: var(--fs-xs);
  color: var(--c-text-mute);
}

.upgrade__next {
  color: var(--c-gold);
}

.upgrade__invested {
  font-size: var(--fs-xs);
  color: var(--c-text-mute);
}
</style>

<script setup lang="ts">
/**
 * Coin wallet read-out.
 *
 * Renders only after hydration: the balance comes from localStorage, so
 * server-rendering the default value would flash the wrong number.
 */
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const player = usePlayerStore()
const { t, locale } = useI18n()
</script>

<template>
  <ClientOnly>
    <p
      class="wallet"
      :class="{ 'wallet--compact': compact }"
    >
      <span
        class="wallet__coin"
        aria-hidden="true"
      />
      <span class="visually-hidden">{{ t('labels.coins') }}: </span>
      <span class="wallet__value t-num">{{ formatCoins(player.coins, locale) }}</span>
    </p>
  </ClientOnly>
</template>

<style scoped lang="scss">
.wallet {
  display: inline-flex;
  gap: rem(7);
  align-items: center;
  padding: rem(5) rem(11) rem(5) rem(8);
  border: 1px solid color-mix(in srgb, var(--c-gold) 30%, transparent);
  border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--c-gold) 10%, transparent);
}

.wallet__coin {
  width: rem(13);
  height: rem(13);
  border-radius: 50%;
  background: var(--g-gold);
  box-shadow: 0 0 0 1px rgb(0 0 0 / 30%) inset;
}

.wallet__value {
  font-size: var(--fs-sm);
  color: var(--c-gold);
}

.wallet--compact {
  padding: rem(3) rem(9) rem(3) rem(6);

  .wallet__value {
    font-size: var(--fs-xs);
  }
}
</style>

<script setup lang="ts">
import type { LoadoutRating } from '~/services/game/loadout'

/**
 * Six-bar comparison chart for an airframe.
 *
 * Ratings are normalised against the whole catalog, so a full bar genuinely means
 * best-in-class rather than "good for this kite".
 */
const props = withDefaults(
  defineProps<{
    rating: LoadoutRating
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' },
)

const { t } = useI18n()

const rows = computed(() =>
  (
    [
      ['lift', 'brand'],
      ['speed', 'sky'],
      ['control', 'sky'],
      ['toughness', 'gold'],
      ['bite', 'danger'],
      ['stability', 'success'],
    ] as const
  ).map(([key, tone]) => ({
    key,
    tone,
    label: t(`kites.rating.${key}`),
    value: props.rating[key],
  })),
)
</script>

<template>
  <div
    class="rating"
    :class="`rating--${size}`"
  >
    <UiMeter
      v-for="row in rows"
      :key="row.key"
      :value="row.value"
      :label="row.label"
      :tone="row.tone"
      :size="size"
    />
  </div>
</template>

<style scoped lang="scss">
.rating {
  display: grid;
  gap: var(--sp-3);
}

.rating--sm {
  gap: rem(7);
}
</style>

<script setup lang="ts">
import type { Rarity } from '~/services/game/types'

/**
 * Small status pill: rarity, boss marker, ownership, tier.
 *
 * Rarity tone is looked up from a token, never hardcoded, so a palette change
 * propagates everywhere at once.
 */
withDefaults(
  defineProps<{
    tone?: Rarity | 'neutral' | 'brand' | 'boss' | 'success' | 'danger'
    /** Adds the rhombus marker used throughout the interface. */
    marker?: boolean
  }>(),
  { tone: 'neutral', marker: false },
)
</script>

<template>
  <span
    class="badge"
    :class="`badge--${tone}`"
  >
    <span
      v-if="marker"
      class="badge__marker"
      aria-hidden="true"
    />
    <slot />
  </span>
</template>

<style scoped lang="scss">
.badge {
  --badge-tone: var(--c-text-mute);

  display: inline-flex;
  gap: rem(6);
  align-items: center;
  padding: rem(3) rem(9);
  font-family: var(--font-mono);
  font-size: rem(10.5);
  font-weight: 700;
  letter-spacing: 0.1em;
  line-height: 1.5;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--badge-tone);
  border: 1px solid color-mix(in srgb, var(--badge-tone) 35%, transparent);
  border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--badge-tone) 12%, transparent);
}

.badge__marker {
  width: rem(6);
  height: rem(6);
  background: currentcolor;
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
}

.badge--common {
  --badge-tone: var(--c-rarity-common);
}

.badge--uncommon {
  --badge-tone: var(--c-rarity-uncommon);
}

.badge--rare {
  --badge-tone: var(--c-rarity-rare);
}

.badge--epic {
  --badge-tone: var(--c-rarity-epic);
}

.badge--legend {
  --badge-tone: var(--c-rarity-legend);
}

.badge--brand {
  --badge-tone: var(--c-brand-soft);
}

.badge--success {
  --badge-tone: var(--c-success);
}

.badge--danger {
  --badge-tone: var(--c-danger);
}

.badge--boss {
  --badge-tone: var(--c-danger);

  // Bosses get a solid fill so they are unmistakable in a list of eight.
  color: #fff;
  background: color-mix(in srgb, var(--c-danger) 82%, black);
  border-color: transparent;
}
</style>

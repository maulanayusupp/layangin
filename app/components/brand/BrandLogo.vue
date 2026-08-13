<script setup lang="ts">
import { SITE } from '~~/shared/constants/site'

/**
 * Wordmark plus kite mark.
 *
 * The SVG is inlined rather than loaded from `/brand/mark.svg` so it inherits the
 * current colour, needs no extra request, and cannot flash unstyled. It is the
 * same geometry as the file the icon generator rasterises — when one changes,
 * change both (noted in CLAUDE.md).
 */
withDefaults(
  defineProps<{
    /** Hide the wordmark and show only the kite. */
    markOnly?: boolean
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { markOnly: false, size: 'md' },
)
</script>

<template>
  <span
    class="logo"
    :class="[`logo--${size}`, { 'logo--mark-only': markOnly }]"
  >
    <svg
      class="logo__mark"
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="brand-sail"
          x1="0.15"
          y1="0"
          x2="0.85"
          y2="1"
        >
          <stop
            offset="0"
            stop-color="#FFD98A"
          />
          <stop
            offset="0.38"
            stop-color="#FFC24B"
          />
          <stop
            offset="0.72"
            stop-color="#FF6A2B"
          />
          <stop
            offset="1"
            stop-color="#D1400F"
          />
        </linearGradient>
      </defs>
      <path
        d="M256 396 C 268 428, 300 434, 312 458 C 322 478, 350 480, 362 466"
        fill="none"
        stroke="#FF6A2B"
        stroke-width="16"
        stroke-linecap="round"
      />
      <path
        d="M256 64 L 396 236 L 256 396 L 116 236 Z"
        fill="url(#brand-sail)"
      />
      <path
        d="M256 64 L 256 396 M116 236 L 396 236"
        stroke="#2A1206"
        stroke-width="14"
        stroke-linecap="round"
      />
      <path
        d="M150 300 l 22 -22 l 22 22 l -22 22 Z"
        fill="#35DFC7"
      />
      <path
        d="M318 300 l 22 -22 l 22 22 l -22 22 Z"
        fill="#35DFC7"
      />
    </svg>

    <span
      v-if="!markOnly"
      class="logo__word"
    >{{ SITE.name }}</span>
  </span>
</template>

<style scoped lang="scss">
.logo {
  display: inline-flex;
  gap: rem(9);
  align-items: center;
}

.logo__mark {
  flex: none;
  width: var(--logo-size, #{rem(30)});
  height: var(--logo-size, #{rem(30)});
}

.logo__word {
  font-family: var(--font-display);
  font-size: var(--logo-word-size, #{rem(20)});
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
  color: var(--c-text);
}

.logo--sm {
  --logo-size: #{rem(24)};
  --logo-word-size: #{rem(17)};
}

.logo--lg {
  --logo-size: #{rem(48)};
  --logo-word-size: #{rem(32)};
}
</style>

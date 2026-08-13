<script setup lang="ts">
/**
 * Base surface for cards, HUD blocks and content boxes.
 *
 * `tone` picks the elevation and `notch` picks which corners are cut — the kite
 * silhouette repeated at panel scale, and the thing that keeps the layout from
 * reading as a generic grid of rounded rectangles.
 */
withDefaults(
  defineProps<{
    tone?: 'raised' | 'sunken' | 'flat'
    notch?: 'tr-bl' | 'tl-br' | 'none'
    /** Interactive panels get hover and focus affordances. */
    interactive?: boolean
    /** Renders as a different element, e.g. `li` inside a list. */
    as?: string
    /** Accent hairline along the top edge. */
    accent?: 'none' | 'brand' | 'gold' | 'sky' | 'danger'
  }>(),
  {
    tone: 'raised',
    notch: 'tr-bl',
    interactive: false,
    as: 'div',
    accent: 'none',
  },
)
</script>

<template>
  <component
    :is="as"
    class="panel"
    :class="[
      `panel--${tone}`,
      `panel--notch-${notch}`,
      `panel--accent-${accent}`,
      { 'panel--interactive': interactive },
    ]"
  >
    <slot />
  </component>
</template>

<style scoped lang="scss">
.panel {
  position: relative;
  padding: var(--sp-4);

  @include panel('raised');
}

.panel--sunken {
  @include panel('sunken');
}

.panel--flat {
  @include panel('flat');
}

.panel--notch-tr-bl {
  @include notched(var(--notch), 'tr-bl');
}

.panel--notch-tl-br {
  @include notched(var(--notch), 'tl-br');
}

.panel--notch-none {
  border-radius: var(--r-lg);
}

.panel--interactive {
  transition:
    border-color var(--dur-fast) var(--ease-out),
    translate var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out);

  @include hover {
    translate: 0 rem(-3);
    border-color: var(--c-border-strong);
    box-shadow: var(--sh-3);
  }

  &:focus-within {
    border-color: color-mix(in srgb, var(--c-focus) 60%, transparent);
  }
}

/// Accent bar. Drawn as a pseudo-element so it follows the notched clip path.
.panel--accent-brand::before,
.panel--accent-gold::before,
.panel--accent-sky::before,
.panel--accent-danger::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: rem(3);
  pointer-events: none;
}

.panel--accent-brand::before {
  background: var(--g-brand);
}

.panel--accent-gold::before {
  background: var(--g-gold);
}

.panel--accent-sky::before {
  background: var(--g-sky);
}

.panel--accent-danger::before {
  background: var(--c-danger);
}
</style>

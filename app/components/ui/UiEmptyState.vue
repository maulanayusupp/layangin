<script setup lang="ts">
/**
 * Placeholder for an empty list or a state with nothing to show yet.
 */
defineProps<{
  title: string
  body?: string
}>()
</script>

<template>
  <div class="empty">
    <span
      class="empty__marker"
      aria-hidden="true"
    />
    <p class="empty__title">
      {{ title }}
    </p>
    <p
      v-if="body"
      class="empty__body"
    >
      {{ body }}
    </p>
    <slot />
  </div>
</template>

<style scoped lang="scss">
.empty {
  display: grid;
  gap: var(--sp-2);
  justify-items: center;
  padding: var(--sp-7) var(--sp-4);
  text-align: center;
  border: 1px dashed var(--c-border);
  border-radius: var(--r-lg);
  background: var(--c-surface-sunken);
}

.empty__marker {
  width: rem(14);
  height: rem(14);
  margin-block-end: var(--sp-2);
  background: var(--c-text-mute);
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
}

.empty__title {
  font-family: var(--font-display);
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--c-text);
}

.empty__body {
  max-width: 44ch;
  font-size: var(--fs-sm);
  color: var(--c-text-mute);
}
</style>

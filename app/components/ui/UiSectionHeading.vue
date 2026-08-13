<script setup lang="ts">
/**
 * Eyebrow + title + lead. Every section on the site uses this so the vertical
 * rhythm and the heading scale stay identical across pages.
 */
withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    lead?: string
    /** Heading level, so document outline stays correct per page. */
    level?: 1 | 2 | 3
    align?: 'start' | 'center'
  }>(),
  { eyebrow: undefined, lead: undefined, level: 2, align: 'start' },
)
</script>

<template>
  <header
    class="heading"
    :class="`heading--${align}`"
  >
    <p
      v-if="eyebrow"
      class="heading__eyebrow"
    >
      <span
        class="heading__marker"
        aria-hidden="true"
      />
      {{ eyebrow }}
    </p>

    <component
      :is="`h${level}`"
      class="heading__title"
    >
      {{ title }}
      <slot name="titleSuffix" />
    </component>

    <p
      v-if="lead"
      class="heading__lead t-lead"
    >
      {{ lead }}
    </p>
    <slot />
  </header>
</template>

<style scoped lang="scss">
.heading {
  display: grid;
  gap: var(--sp-3);
  max-width: rem(720);
}

.heading--center {
  justify-items: center;
  margin-inline: auto;
  text-align: center;
}

.heading__eyebrow {
  @include eyebrow;
}

.heading__marker {
  width: rem(7);
  height: rem(7);
  background: currentcolor;
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
}

.heading__title {
  @include display-type(fluid(28, 46));
}

.heading__lead {
  margin: 0;
}
</style>

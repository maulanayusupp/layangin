<script setup lang="ts">
/**
 * Label/value pair used in the HUD, codex and result screen.
 *
 * Renders as a `<div>` by default but can be a `<dt>/<dd>` pair inside a `<dl>`
 * via `as="row"`, which is the correct markup for a table of readings.
 */
withDefaults(
  defineProps<{
    label: string
    value: string
    /** Optional explanation shown behind a "?" trigger. */
    tooltip?: string
    tone?: 'default' | 'brand' | 'gold' | 'danger' | 'success'
    size?: 'sm' | 'md' | 'lg'
    as?: 'block' | 'row'
  }>(),
  { tooltip: undefined, tone: 'default', size: 'md', as: 'block' },
)
</script>

<template>
  <div
    v-if="as === 'block'"
    class="stat"
    :class="[`stat--${tone}`, `stat--${size}`]"
  >
    <p class="stat__label">
      {{ label }}
      <UiTooltip
        v-if="tooltip"
        :text="tooltip"
        :label="label"
      />
    </p>
    <p class="stat__value t-num">
      {{ value }}
    </p>
  </div>

  <template v-else>
    <dt class="stat__label stat__label--row">
      {{ label }}
      <UiTooltip
        v-if="tooltip"
        :text="tooltip"
        :label="label"
      />
    </dt>
    <dd
      class="stat__value stat__value--row t-num"
      :class="`stat--${tone}`"
    >
      {{ value }}
    </dd>
  </template>
</template>

<style scoped lang="scss">
.stat {
  --stat-tone: var(--c-text);

  display: grid;
  gap: rem(2);
}

.stat__label {
  display: flex;
  gap: rem(6);
  align-items: center;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--c-text-mute);
}

.stat__value {
  font-size: var(--fs-md);
  color: var(--stat-tone);
}

.stat--sm .stat__value {
  font-size: var(--fs-sm);
}

.stat--lg .stat__value {
  font-size: var(--fs-xl);
}

.stat--brand {
  --stat-tone: var(--c-brand-soft);
}

.stat--gold {
  --stat-tone: var(--c-gold);
}

.stat--danger {
  --stat-tone: var(--c-danger);
}

.stat--success {
  --stat-tone: var(--c-success);
}

/// Row form, for use inside a definition list.
.stat__label--row {
  display: flex;
  gap: rem(6);
  align-items: center;
  padding-block: rem(7);
  border-block-end: 1px solid var(--c-hairline);
}

.stat__value--row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-block: rem(7);
  font-size: var(--fs-sm);
  text-align: end;
  color: var(--stat-tone, var(--c-text));
  border-block-end: 1px solid var(--c-hairline);
}
</style>

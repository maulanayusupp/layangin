<script setup lang="ts">
/**
 * Tab bar following the ARIA tabs pattern: arrow keys move between tabs, Home
 * and End jump to the ends, and only the selected tab is in the tab order.
 *
 * Panels are rendered by the parent; this component owns the tab list and the
 * `aria-controls`/`aria-labelledby` wiring via a shared `idBase`.
 */
export interface TabItem {
  value: string
  label: string
  /** Optional count badge, e.g. affordable items in that category. */
  count?: number
}

const props = defineProps<{
  items: TabItem[]
  modelValue: string
  /** Accessible name for the tab list. */
  label: string
  /** Prefix for generated tab/panel ids. */
  idBase: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const buttons = ref<HTMLButtonElement[]>([])

const activeIndex = computed(() =>
  Math.max(0, props.items.findIndex(item => item.value === props.modelValue)),
)

function select(index: number): void {
  const item = props.items[index]
  if (!item) return
  emit('update:modelValue', item.value)
  // Follow focus, as the ARIA pattern expects for automatic activation.
  buttons.value[index]?.focus()
}

function onKeydown(event: KeyboardEvent): void {
  const last = props.items.length - 1
  const current = activeIndex.value

  switch (event.key) {
    case 'ArrowRight':
      select(current === last ? 0 : current + 1)
      break
    case 'ArrowLeft':
      select(current === 0 ? last : current - 1)
      break
    case 'Home':
      select(0)
      break
    case 'End':
      select(last)
      break
    default:
      return
  }

  event.preventDefault()
}
</script>

<template>
  <div
    class="tabs"
    role="tablist"
    :aria-label="label"
    @keydown="onKeydown"
  >
    <button
      v-for="item in items"
      :id="`${idBase}-tab-${item.value}`"
      :key="item.value"
      ref="buttons"
      type="button"
      role="tab"
      class="tabs__tab"
      :class="{ 'is-active': item.value === modelValue }"
      :aria-selected="item.value === modelValue"
      :aria-controls="`${idBase}-panel-${item.value}`"
      :tabindex="item.value === modelValue ? 0 : -1"
      @click="emit('update:modelValue', item.value)"
    >
      {{ item.label }}
      <span
        v-if="item.count"
        class="tabs__count"
      >{{ item.count }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
.tabs {
  display: flex;
  gap: rem(4);
  padding: rem(4);
  overflow-x: auto;
  border: 1px solid var(--c-hairline);
  border-radius: var(--r-pill);
  background: var(--c-surface-sunken);

  @include custom-scrollbar;
}

.tabs__tab {
  display: inline-flex;
  gap: rem(6);
  flex: 1 0 auto;
  align-items: center;
  justify-content: center;
  min-height: rem(40);
  padding: rem(8) var(--sp-4);
  font-family: var(--font-display);
  font-size: var(--fs-sm);
  font-weight: 700;
  white-space: nowrap;
  color: var(--c-text-mute);
  border-radius: var(--r-pill);
  transition:
    color var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);

  @include focus-visible(-2px);

  @include hover {
    color: var(--c-text);
  }

  &.is-active {
    color: var(--c-text-on-brand);
    background: var(--g-brand);
  }
}

.tabs__count {
  padding: 0 rem(6);
  font-family: var(--font-mono);
  font-size: rem(10);
  font-weight: 700;
  line-height: rem(16);
  border-radius: var(--r-pill);
  background: rgb(0 0 0 / 22%);
}

.tabs__tab:not(.is-active) .tabs__count {
  color: var(--c-gold);
  background: color-mix(in srgb, var(--c-gold) 16%, transparent);
}
</style>

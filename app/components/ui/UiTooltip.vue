<script setup lang="ts">
/**
 * Explanatory tooltip attached to a small "?" trigger.
 *
 * Built as a **disclosure**, not a hover tooltip: it toggles on click/Enter and
 * closes on Escape or outside click. Hover merely previews it. That combination
 * is what makes it usable on a touch screen, where there is no hover at all, and
 * keeps it operable from the keyboard.
 *
 * The panel is linked to the trigger with `aria-describedby`, so screen readers
 * read the explanation as part of the control rather than as loose text.
 */
const props = withDefaults(
  defineProps<{
    /** Explanation text. Always comes from a translation key. */
    text: string
    /** Accessible name for the trigger, e.g. "What is tail drag?". */
    label?: string
    placement?: 'top' | 'bottom'
  }>(),
  { label: undefined, placement: 'top' },
)

const { t } = useI18n()

const open = ref(false)
const hovering = ref(false)
const root = ref<HTMLElement | null>(null)
const id = useId()

const visible = computed(() => open.value || hovering.value)
const triggerLabel = computed(() => props.label ?? t('hint.toggle'))

onClickOutside(root, () => {
  open.value = false
})

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    open.value = false
    event.stopPropagation()
  }
}
</script>

<template>
  <span
    ref="root"
    class="tip"
    @keydown="onKeydown"
  >
    <button
      type="button"
      class="tip__trigger"
      :aria-expanded="open"
      :aria-describedby="visible ? id : undefined"
      :aria-label="triggerLabel"
      @click="open = !open"
      @mouseenter="hovering = true"
      @mouseleave="hovering = false"
      @focus="hovering = true"
      @blur="hovering = false"
    >
      <span aria-hidden="true">?</span>
    </button>

    <span
      v-show="visible"
      :id="id"
      class="tip__panel"
      :class="`tip__panel--${placement}`"
      role="note"
    >
      {{ text }}
    </span>
  </span>
</template>

<style scoped lang="scss">
.tip {
  position: relative;
  display: inline-flex;
  vertical-align: middle;
}

.tip__trigger {
  display: grid;
  place-items: center;
  width: rem(18);
  height: rem(18);
  font-family: var(--font-mono);
  font-size: rem(11);
  font-weight: 700;
  line-height: 1;
  color: var(--c-text-mute);
  border: 1px solid var(--c-border);
  border-radius: 50%;
  transition:
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);

  @include focus-visible(2px);

  @include hover {
    color: var(--c-sky);
    border-color: color-mix(in srgb, var(--c-sky) 55%, transparent);
  }

  // The circle itself is small, so an invisible pad gives it a real tap target
  // without disturbing the layout around it.
  &::after {
    content: '';
    position: absolute;
    inset: rem(-13);
  }
}

.tip__panel {
  position: absolute;
  z-index: var(--z-tooltip);
  inset-inline-start: 50%;
  width: max-content;
  max-width: min(rem(260), 70vw);
  padding: var(--sp-3);
  font-family: var(--font-body);
  font-size: var(--fs-xs);
  font-weight: 400;
  line-height: 1.55;
  letter-spacing: 0;
  text-transform: none;
  text-align: start;
  color: var(--c-text-soft);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--r-md);
  background: var(--c-ink-700);
  box-shadow: var(--sh-3);
  translate: -50% 0;
}

.tip__panel--top {
  inset-block-end: calc(100% + var(--sp-2));
}

.tip__panel--bottom {
  inset-block-start: calc(100% + var(--sp-2));
}
</style>

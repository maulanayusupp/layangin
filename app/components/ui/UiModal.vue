<script setup lang="ts">
/**
 * Modal dialog built on the native `<dialog>` element.
 *
 * Using the platform dialog gets focus trapping, the top layer, inert background
 * content and Escape-to-close from the browser instead of reimplementing them —
 * all four are easy to get subtly wrong by hand.
 *
 * `dismissible: false` blocks Escape and backdrop clicks, for a result screen
 * that must be acknowledged.
 */
const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    /** Allow Escape and backdrop click to close. */
    dismissible?: boolean
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { dismissible: true, size: 'md' },
)

const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()

watch(
  () => props.open,
  (open) => {
    const element = dialog.value
    if (!element) return

    if (open && !element.open) element.showModal()
    else if (!open && element.open) element.close()
  },
  { flush: 'post' },
)

function onCancel(event: Event): void {
  // `cancel` fires for Escape. Prevent it when the dialog must be acknowledged.
  if (!props.dismissible) {
    event.preventDefault()
    return
  }
  event.preventDefault()
  emit('close')
}

function onBackdropClick(event: MouseEvent): void {
  if (!props.dismissible) return
  // A click that lands on the dialog element itself is a backdrop click; clicks
  // inside the content hit a child instead.
  if (event.target === dialog.value) emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="modal"
    :class="`modal--${size}`"
    :aria-labelledby="titleId"
    @cancel="onCancel"
    @click="onBackdropClick"
  >
    <div class="modal__panel">
      <header class="modal__head">
        <h2
          :id="titleId"
          class="modal__title"
        >
          {{ title }}
        </h2>
        <button
          v-if="dismissible"
          type="button"
          class="modal__close"
          :aria-label="$t('actions.close')"
          @click="emit('close')"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div class="modal__body">
        <slot />
      </div>

      <footer
        v-if="$slots.footer"
        class="modal__foot"
      >
        <slot name="footer" />
      </footer>
    </div>
  </dialog>
</template>

<style scoped lang="scss">
.modal {
  width: min(rem(560), calc(100vw - var(--sp-4) * 2));
  max-height: calc(100dvh - var(--sp-6));
  // The UA centres a modal `<dialog>` with `margin: auto`, which the global
  // `* { margin: 0 }` reset strips. Restore it explicitly, or the dialog pins
  // itself to the top-left corner.
  margin: auto;
  padding: 0;
  color: var(--c-text);
  border: 0;
  background: transparent;

  &::backdrop {
    background: rgb(3 5 12 / 72%);
    backdrop-filter: blur(rem(6));
  }

  &[open] {
    @include animate(pop-in, var(--dur-base), var(--ease-spring));
  }
}

.modal--sm {
  width: min(rem(420), calc(100vw - var(--sp-4) * 2));
}

.modal--lg {
  width: min(rem(760), calc(100vw - var(--sp-4) * 2));
}

.modal__panel {
  display: grid;
  grid-template-rows: auto 1fr auto;
  max-height: calc(100dvh - var(--sp-6));
  border: 1px solid var(--c-border-strong);
  background: var(--c-ink-700);
  box-shadow: var(--sh-3);

  @include notched(22px, 'tr-bl');
}

.modal__head {
  display: flex;
  gap: var(--sp-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-4) var(--sp-5);
  border-block-end: 1px solid var(--c-hairline);
}

.modal__title {
  font-size: var(--fs-lg);
}

.modal__close {
  display: grid;
  place-items: center;
  font-size: rem(22);
  line-height: 1;
  color: var(--c-text-mute);
  border-radius: var(--r-sm);

  @include tap-target(40px);
  @include focus-visible(2px);

  @include hover {
    color: var(--c-text);
  }
}

.modal__body {
  padding: var(--sp-5);
  overflow-y: auto;

  @include custom-scrollbar;
}

.modal__foot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  justify-content: flex-end;
  padding: var(--sp-4) var(--sp-5);
  border-block-start: 1px solid var(--c-hairline);
}
</style>

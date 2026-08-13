<script setup lang="ts">
/**
 * Touch controls: a two-axis spool pad and a yank button.
 *
 * The pad maps a drag directly onto the two control axes — up/down is haul/pay
 * out, left/right is walking — which mirrors what your hands do with a real
 * spool, and needs no on-screen buttons to fight for thumb space.
 *
 * Pointer Events are used rather than touch events so a stylus and a mouse work
 * identically, and `touch-action: none` stops the browser from turning a drag
 * into a page scroll. `setPointerCapture` keeps tracking a thumb that slides off
 * the pad mid-duel.
 *
 * The component reports intent through events rather than writing into a shared
 * control object: the owner of that buffer is `GameArena`, and keeping the write
 * there means there is exactly one place inputs are applied.
 */
const props = defineProps<{
  disabled?: boolean
  snapReady: boolean
  snapLabel: string
}>()

const emit = defineEmits<{
  /** Both axes at once: `walk` −1..1, `reel` −1..1. */
  axis: [walk: number, reel: number]
  snap: []
}>()

const { t } = useI18n()

const pad = ref<HTMLElement | null>(null)
const active = ref(false)
const knob = ref({ x: 0, y: 0 })

/** Radius in pixels at which the axis reads full deflection. */
const RANGE = 56

function updateFromPointer(event: PointerEvent): void {
  const element = pad.value
  if (!element) return

  const rect = element.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  const dx = (event.clientX - centerX) / RANGE
  // Screen y grows downward; hauling in is upward, so the sign flips.
  const dy = -(event.clientY - centerY) / RANGE

  const clampedX = Math.max(-1, Math.min(1, dx))
  const clampedY = Math.max(-1, Math.min(1, dy))

  emit('axis', clampedX, clampedY)
  knob.value = { x: clampedX, y: clampedY }
}

function onPointerDown(event: PointerEvent): void {
  if (props.disabled) return
  active.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  updateFromPointer(event)
}

function onPointerMove(event: PointerEvent): void {
  if (!active.value) return
  updateFromPointer(event)
}

function release(): void {
  active.value = false
  // Lifting a thumb must centre the spool, not leave it locked in a haul.
  emit('axis', 0, 0)
  knob.value = { x: 0, y: 0 }
}

function fireSnap(): void {
  if (props.disabled) return
  emit('snap')
}
</script>

<template>
  <div
    class="touch"
    :class="{ 'is-disabled': disabled }"
  >
    <div
      ref="pad"
      class="touch__pad"
      :class="{ 'is-active': active }"
      role="application"
      :aria-label="`${t('game.controls.spool')}. ${t('game.controls.spoolHint')}. ${t('game.controls.walkHint')}`"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="release"
      @pointercancel="release"
      @lostpointercapture="release"
    >
      <span
        class="touch__axis touch__axis--y"
        aria-hidden="true"
      />
      <span
        class="touch__axis touch__axis--x"
        aria-hidden="true"
      />

      <span
        class="touch__hint touch__hint--up"
        aria-hidden="true"
      >{{ t('game.controls.haul') }}</span>
      <span
        class="touch__hint touch__hint--down"
        aria-hidden="true"
      >{{ t('game.controls.release') }}</span>

      <span
        v-css-vars="{ kx: knob.x, ky: knob.y }"
        class="touch__knob"
        aria-hidden="true"
      />
    </div>

    <button
      type="button"
      class="touch__snap"
      :class="{ 'is-ready': snapReady }"
      :disabled="disabled"
      :aria-label="`${t('game.controls.snap')}. ${t('game.controls.snapHint')}`"
      @pointerdown.prevent="fireSnap"
    >
      <span class="touch__snap-text">{{ snapLabel }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
.touch {
  display: flex;
  gap: var(--sp-4);
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-3) var(--sp-4) var(--sp-4);
  // Keep clear of an iPhone's home indicator.
  padding-block-end: max(var(--sp-4), env(safe-area-inset-bottom));

  &.is-disabled {
    opacity: 0.4;
    pointer-events: none;
  }
}

.touch__pad {
  position: relative;
  width: rem(132);
  height: rem(132);
  // Without this the browser claims the drag as a scroll gesture.
  touch-action: none;
  border: 1px solid var(--c-border);
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 50%, rgb(255 255 255 / 5%), transparent 62%),
    var(--c-surface-sunken);
  transition: border-color var(--dur-fast) var(--ease-out);

  &.is-active {
    border-color: color-mix(in srgb, var(--c-sky) 65%, transparent);
  }
}

.touch__axis {
  position: absolute;
  background: var(--c-hairline);
}

.touch__axis--y {
  inset-block: rem(14);
  inset-inline-start: 50%;
  width: 1px;
}

.touch__axis--x {
  inset-inline: rem(14);
  inset-block-start: 50%;
  height: 1px;
}

.touch__hint {
  position: absolute;
  inset-inline: 0;
  font-family: var(--font-mono);
  font-size: rem(8.5);
  letter-spacing: 0.1em;
  text-align: center;
  text-transform: uppercase;
  color: var(--c-text-mute);
}

.touch__hint--up {
  inset-block-start: rem(8);
}

.touch__hint--down {
  inset-block-end: rem(8);
}

.touch__knob {
  position: absolute;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  width: rem(44);
  height: rem(44);
  border-radius: 50%;
  background: var(--g-sky);
  box-shadow: var(--sh-2);
  // `--kx` / `--ky` are the −1..1 axis values; 34px is the visual travel.
  translate: calc(-50% + var(--kx, 0) * #{rem(34)}) calc(-50% - var(--ky, 0) * #{rem(34)});
}

.touch__snap {
  display: grid;
  place-items: center;
  width: rem(84);
  height: rem(84);
  font-family: var(--font-display);
  font-size: var(--fs-sm);
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--c-text-mute);
  border: 1px solid var(--c-border);
  border-radius: 50%;
  background: var(--c-surface-sunken);
  touch-action: none;
  transition:
    scale var(--dur-instant) var(--ease-out),
    color var(--dur-fast) var(--ease-out),
    border-color var(--dur-fast) var(--ease-out);

  @include focus-visible(3px);

  &.is-ready {
    color: var(--c-text-on-brand);
    border-color: transparent;
    background: var(--g-brand);
  }

  &:active {
    scale: 0.93;
  }
}
</style>

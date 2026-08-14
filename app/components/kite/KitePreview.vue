<script setup lang="ts">
import { DEFAULT_PATTERN_ID } from '~/data/patterns'
import type { KiteId, PaletteId, PatternId } from '~/services/game/types'

/**
 * Canvas preview of a kite, drawn with the same renderer the arena uses.
 *
 * The canvas carries a text alternative naming the kite, since the image itself
 * conveys which airframe is shown.
 */
const props = withDefaults(
  defineProps<{
    kiteId: KiteId
    paletteId: PaletteId
    patternId?: PatternId
    /** Kite display name, used for the accessible label. */
    name: string
    tails?: boolean
    animate?: boolean
    ratio?: '1' | '16/9' | '4/3' | '3/4'
  }>(),
  { patternId: DEFAULT_PATTERN_ID, tails: true, animate: true, ratio: '1' },
)

const { t } = useI18n()
const canvas = ref<HTMLCanvasElement | null>(null)

useKitePreview({
  canvas,
  kiteId: computed(() => props.kiteId),
  paletteId: computed(() => props.paletteId),
  patternId: computed(() => props.patternId),
  tails: props.tails,
  animate: props.animate,
})
</script>

<template>
  <div
    class="preview"
    :class="`preview--ratio-${ratio.replace('/', '-')}`"
  >
    <div
      class="preview__glow"
      aria-hidden="true"
    />
    <canvas
      ref="canvas"
      class="preview__canvas"
      role="img"
      :aria-label="t('a11y.kitePreview', { kite: name })"
    />
  </div>
</template>

<style scoped lang="scss">
.preview {
  position: relative;
  overflow: hidden;
  border-radius: var(--r-md);
  background:
    radial-gradient(120% 90% at 50% 100%, rgb(255 106 43 / 12%), transparent 62%),
    var(--c-surface-sunken);
}

.preview--ratio-1 {
  aspect-ratio: 1;
}

.preview--ratio-16-9 {
  aspect-ratio: 16 / 9;
}

.preview--ratio-4-3 {
  aspect-ratio: 4 / 3;
}

.preview--ratio-3-4 {
  aspect-ratio: 3 / 4;
}

.preview__glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(60% 50% at 50% 42%, rgb(255 226 198 / 8%), transparent 70%);
}

.preview__canvas {
  width: 100%;
  height: 100%;
}
</style>

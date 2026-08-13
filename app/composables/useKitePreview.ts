import { getKite } from '~/data/kites'
import { getPalette } from '~/data/palettes'
import { DEFAULT_PATTERN_ID, getPattern } from '~/data/patterns'
import { drawKite, previewScale } from '~/services/game/render/kite'
import type { KiteId, PaletteId, PatternId } from '~/services/game/types'

/**
 * Renders a kite into a small canvas for the codex and shop.
 *
 * Uses the same `drawKite` the arena uses, so a preview is the real thing rather
 * than an illustration of it — buy a kite and it looks exactly as it did in the
 * shop. The gentle sway is what makes a static card feel like a kite; it stops
 * entirely under `prefers-reduced-motion`.
 */
export interface UseKitePreviewOptions {
  canvas: Ref<HTMLCanvasElement | null>
  kiteId: Ref<KiteId> | ComputedRef<KiteId>
  paletteId: Ref<PaletteId> | ComputedRef<PaletteId>
  patternId?: Ref<PatternId> | ComputedRef<PatternId>
  /** Include tails. Off for dense grids where a long tail adds nothing. */
  tails?: boolean
  /** Animate the sway. Ignored when the user asks for reduced motion. */
  animate?: boolean
}

export function useKitePreview({
  canvas,
  kiteId,
  paletteId,
  patternId,
  tails = true,
  animate = true,
}: UseKitePreviewOptions) {
  const reducedMotion = usePreferredReducedMotion()
  const shouldAnimate = computed(() => animate && reducedMotion.value !== 'reduce')

  let frame = 0
  let start = 0

  const paint = (time: number): void => {
    const element = canvas.value
    if (!element) return

    const ctx = element.getContext('2d')
    if (!ctx) return

    const ratio = canvasPixelRatio()
    const width = element.clientWidth
    const height = element.clientHeight
    if (width === 0 || height === 0) return

    if (element.width !== Math.round(width * ratio)) {
      element.width = Math.round(width * ratio)
      element.height = Math.round(height * ratio)
    }

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const kite = getKite(kiteId.value)
    const palette = getPalette(paletteId.value)
    const box = Math.min(width, height)

    // Slow figure-of-eight sway, as a kite parked in steady air actually behaves.
    const sway = shouldAnimate.value ? Math.sin(time * 0.9) * 0.09 : 0
    const bob = shouldAnimate.value ? Math.sin(time * 1.4) * box * 0.015 : 0

    drawKite(ctx, {
      geometry: kite.geometry,
      palette,
      pattern: getPattern(patternId?.value ?? DEFAULT_PATTERN_ID),
      x: width / 2,
      // Sit slightly above centre so a tail has room to hang.
      y: height * (tails && kite.geometry.tails.length > 0 ? 0.4 : 0.5) + bob,
      size: previewScale(box, tails && kite.geometry.tails.length > 0),
      angle: Math.PI / 2 + sway,
      time,
      sway: 0.4,
      tails,
    })
  }

  const loop = (timestamp: number): void => {
    if (start === 0) start = timestamp
    paint((timestamp - start) / 1000)
    if (shouldAnimate.value) frame = requestAnimationFrame(loop)
  }

  const restart = (): void => {
    if (frame) cancelAnimationFrame(frame)
    start = 0
    frame = requestAnimationFrame(loop)
  }

  onMounted(restart)

  onBeforeUnmount(() => {
    if (frame) cancelAnimationFrame(frame)
  })

  // Repaint when the shown kite or its colours change.
  watch([kiteId, paletteId, shouldAnimate], restart)

  return { repaint: restart }
}

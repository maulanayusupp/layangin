import { clamp, damp } from '../math/scalar'
import type { MatchSnapshot } from '../types'

/**
 * Camera.
 *
 * Frames both kites and both fighters at all times, because a duel is unreadable
 * if you cannot see where the other line is. The zoom and centre are smoothed so
 * a gust does not jolt the view, and the scale is clamped so a low kite does not
 * fill the screen.
 *
 * Converts world metres (y-up) to canvas pixels (y-down).
 */
export interface Camera {
  /** Pixels per metre. */
  scale: number
  /** World-space centre of the view. */
  centerX: number
  centerY: number
  readonly width: number
  readonly height: number
  resize(width: number, height: number, devicePixelRatio: number): void
  follow(snapshot: MatchSnapshot, dt: number): void
  x(worldX: number): number
  y(worldY: number): number
  /** Metres → pixels for sizes. */
  m(metres: number): number
  /** Pixels → metres, for pointer input. */
  toWorldX(screenX: number): number
  toWorldY(screenY: number): number
}

const MIN_SCALE = 1.6
const MAX_SCALE = 9
/** World-space padding kept around the tracked points, metres. */
const PADDING = 16

export function createCamera(): Camera {
  let width = 1
  let height = 1
  let dpr = 1

  const camera: Camera = {
    scale: 4,
    centerX: 0,
    centerY: 40,

    get width() {
      return width
    },

    get height() {
      return height
    },

    resize(nextWidth: number, nextHeight: number, devicePixelRatio: number): void {
      width = Math.max(1, nextWidth)
      height = Math.max(1, nextHeight)
      dpr = devicePixelRatio
    },

    follow(snapshot: MatchSnapshot, dt: number): void {
      const { player, rival } = snapshot

      const minX = Math.min(player.position.x, rival.position.x, player.anchor.x, rival.anchor.x)
      const maxX = Math.max(player.position.x, rival.position.x, player.anchor.x, rival.anchor.x)
      // Always keep the ground in frame: it is the horizon players orient against.
      const maxY = Math.max(player.position.y, rival.position.y, 24)

      const spanX = maxX - minX + PADDING * 2
      const spanY = maxY + PADDING

      const targetScale = clamp(
        Math.min(width / spanX, height / spanY),
        MIN_SCALE,
        MAX_SCALE,
      )

      // Smoothing constants chosen so the view settles in roughly a third of a
      // second — fast enough to keep up, slow enough not to feel jittery.
      camera.scale = damp(camera.scale, targetScale, 0.0002, dt)
      camera.centerX = damp(camera.centerX, (minX + maxX) / 2, 0.0002, dt)
      camera.centerY = damp(camera.centerY, spanY / 2 - PADDING * 0.25, 0.0002, dt)
    },

    x(worldX: number): number {
      return width / 2 + (worldX - camera.centerX) * camera.scale
    },

    y(worldY: number): number {
      // Ground sits below centre; y is inverted because canvas grows downward.
      return height / 2 - (worldY - camera.centerY) * camera.scale
    },

    m(metres: number): number {
      return metres * camera.scale
    },

    toWorldX(screenX: number): number {
      return (screenX / dpr - width / 2) / camera.scale + camera.centerX
    },

    toWorldY(screenY: number): number {
      return camera.centerY - (screenY / dpr - height / 2) / camera.scale
    },
  }

  return camera
}

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
  /**
   * `insetBottom` reserves pixels at the foot of the canvas for the HUD, so the
   * ground line and the two fighters standing on it are drawn above the overlay
   * instead of underneath it.
   */
  resize(width: number, height: number, devicePixelRatio: number, insetBottom?: number): void
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
  let insetBottom = 0

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

    resize(
      nextWidth: number,
      nextHeight: number,
      devicePixelRatio: number,
      nextInsetBottom = 0,
    ): void {
      width = Math.max(1, nextWidth)
      height = Math.max(1, nextHeight)
      dpr = devicePixelRatio
      // Never reserve so much that there is no sky left to fly in.
      insetBottom = Math.max(0, Math.min(nextInsetBottom, height * 0.4))
    },

    follow(snapshot: MatchSnapshot, dt: number): void {
      /**
       * Frame everyone who is still part of the match.
       *
       * An eliminated fighter is skipped: with their kite lying on the ground at the
       * edge of the field, including them would keep the view zoomed out around
       * something nobody is watching. If somehow nobody is left, the whole list is
       * used so the camera always has a subject.
       */
      const inPlay = snapshot.fighters.filter(fighter => !fighter.eliminated)
      const framed = inPlay.length > 0 ? inPlay : snapshot.fighters

      let minX = Infinity
      let maxX = -Infinity
      // Always keep the ground in frame: it is the horizon players orient against.
      let maxY = 24

      for (const fighter of framed) {
        minX = Math.min(minX, fighter.position.x, fighter.anchor.x)
        maxX = Math.max(maxX, fighter.position.x, fighter.anchor.x)
        maxY = Math.max(maxY, fighter.position.y)
      }

      const spanX = maxX - minX + PADDING * 2
      const spanY = maxY + PADDING

      // The world has to fit in the canvas *minus* the band reserved for the HUD.
      const usableHeight = Math.max(1, height - insetBottom)

      const targetScale = clamp(
        Math.min(width / spanX, usableHeight / spanY),
        MIN_SCALE,
        MAX_SCALE,
      )

      // Smoothing constants chosen so the view settles in roughly a third of a
      // second — fast enough to keep up, slow enough not to feel jittery.
      camera.scale = damp(camera.scale, targetScale, 0.0002, dt)
      camera.centerX = damp(camera.centerX, (minX + maxX) / 2, 0.0002, dt)

      /**
       * Place the ground line just above the reserved band.
       *
       * `y(0)` must land at `height − insetBottom`. Since
       * `y(w) = height/2 − (w − centerY)·scale`, that gives
       * `centerY = (height/2 − insetBottom) / scale`.
       *
       * Set directly rather than damped: the target already moves smoothly because
       * the scale it depends on is damped, and damping it twice made the horizon lag
       * behind the kites during a fast zoom.
       */
      camera.centerY = (height / 2 - insetBottom) / camera.scale
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

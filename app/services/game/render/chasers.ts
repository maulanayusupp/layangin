import type { RandomSource } from '../math/random'
import { clamp01 } from '../math/scalar'
import type { Camera } from './camera'

/**
 * The crowd that runs after a cut kite.
 *
 * When a line parts in real life, the kite drifts off and whoever is nearby sprints
 * after it — *ngejar layangan* is half the point of a kite fight, and a free kite
 * belongs to whoever catches it. So a cut is followed by two to four runners
 * converging on wherever the kite is going to come down.
 *
 * Purely decorative: they exist only in the renderer, never touch the simulation,
 * and cannot influence a result. Their motion is deliberately crude — bodies as
 * ellipses, legs as a two-phase scissor — because at arena scale a runner is a few
 * pixels tall and detail would be wasted.
 */
export interface Chaser {
  x: number
  /** Metres per second along the ground. */
  speed: number
  /** Where they are heading, updated as the kite drifts. */
  targetX: number
  /** Phase of the running cycle, radians. */
  stride: number
  /** 0..1 body scale, so the group does not look cloned. */
  size: number
  active: boolean
}

export interface ChaserCrowd {
  readonly chasers: readonly Chaser[]
  /**
   * Send the crowd after a kite. Called once, when a line is cut.
   * `fromX` is where the kite was cut, so they start from plausible places.
   */
  release(fromX: number, random: RandomSource): void
  /** Steer them toward the kite and advance the run. */
  update(targetX: number, dt: number): void
  /** Stop and hide them. */
  clear(): void
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void
}

/** Running speed range, m/s — a child sprinting across a field. */
const MIN_SPEED = 4.2
const MAX_SPEED = 6.4

export function createChaserCrowd(): ChaserCrowd {
  // Fixed pool: at most four runners are ever on screen at once.
  const chasers: Chaser[] = Array.from({ length: 4 }, () => ({
    x: 0,
    speed: 0,
    targetX: 0,
    stride: 0,
    size: 1,
    active: false,
  }))

  return {
    chasers,

    release(fromX: number, random: RandomSource): void {
      const count = random.int(2, 4)

      for (let i = 0; i < chasers.length; i += 1) {
        const chaser = chasers[i] as Chaser
        chaser.active = i < count
        if (!chaser.active) continue

        // Scattered around the field, not queued up at one spot.
        chaser.x = fromX + random.range(-38, 26)
        chaser.speed = random.range(MIN_SPEED, MAX_SPEED)
        chaser.targetX = fromX
        chaser.stride = random.range(0, Math.PI * 2)
        chaser.size = random.range(0.72, 1.05)
      }
    },

    update(targetX: number, dt: number): void {
      for (const chaser of chasers) {
        if (!chaser.active) continue

        chaser.targetX = targetX
        const gap = chaser.targetX - chaser.x

        // Ease off at the last couple of metres so they gather rather than
        // overshooting and jittering around the landing point.
        if (Math.abs(gap) < 1.5) {
          chaser.stride += dt * 3
          continue
        }

        const direction = Math.sign(gap)
        chaser.x += direction * chaser.speed * dt
        // Stride rate follows speed, so a faster runner's legs move faster.
        chaser.stride += dt * chaser.speed * 2.6
      }
    },

    clear(): void {
      for (const chaser of chasers) chaser.active = false
    },

    draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
      const groundY = camera.y(0)

      for (const chaser of chasers) {
        if (!chaser.active) continue

        const x = camera.x(chaser.x)
        // Slightly smaller than a standing fighter: they are further back.
        const height = Math.max(6, camera.m(1.5 * chaser.size))
        if (x < -height * 4 || x > camera.width + height * 4) continue

        const swing = Math.sin(chaser.stride)
        const lean = Math.sign(chaser.targetX - chaser.x) * height * 0.1

        ctx.fillStyle = 'rgba(4, 6, 13, 0.82)'

        // Torso, pitched forward in the direction of travel.
        ctx.beginPath()
        ctx.ellipse(
          x + lean * 0.5,
          groundY - height * 0.58,
          height * 0.14,
          height * 0.28,
          lean * 0.12,
          0,
          Math.PI * 2,
        )
        ctx.fill()

        // Head.
        ctx.beginPath()
        ctx.arc(x + lean, groundY - height * 0.92, height * 0.12, 0, Math.PI * 2)
        ctx.fill()

        ctx.strokeStyle = 'rgba(4, 6, 13, 0.82)'
        ctx.lineWidth = Math.max(1, height * 0.075)

        // Legs: a two-phase scissor. Enough to read as running at this size.
        ctx.beginPath()
        ctx.moveTo(x, groundY - height * 0.34)
        ctx.lineTo(x + swing * height * 0.24, groundY)
        ctx.moveTo(x, groundY - height * 0.34)
        ctx.lineTo(x - swing * height * 0.24, groundY)
        ctx.stroke()

        // One arm reaching, because they are trying to catch something.
        ctx.beginPath()
        ctx.moveTo(x, groundY - height * 0.66)
        ctx.lineTo(x + lean * 2.2, groundY - height * (0.86 + swing * 0.06))
        ctx.stroke()
      }
    },
  }
}

/** 0..1 how gathered the crowd is around the target — for a cheer cue. */
export function crowdClosing(crowd: ChaserCrowd, targetX: number): number {
  let closest = Infinity
  let any = false

  for (const chaser of crowd.chasers) {
    if (!chaser.active) continue
    any = true
    closest = Math.min(closest, Math.abs(chaser.x - targetX))
  }

  return any ? clamp01(1 - closest / 30) : 0
}

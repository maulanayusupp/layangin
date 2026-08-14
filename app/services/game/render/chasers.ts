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
 * The chase ends when someone reaches the kite once it is down. That runner claims
 * it, holds it up, and the kite is gone from the field — which is exactly how it
 * ends in a real one, and it gives a cut a proper full stop instead of leaving a
 * dead kite lying in the grass for the rest of the match.
 *
 * Purely decorative: they exist only in the renderer, never touch the simulation,
 * and cannot influence a result. Their motion is deliberately crude — bodies as
 * ellipses, legs as a two-phase scissor — because even drawn larger than life a
 * runner is a small figure and detail would be wasted.
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
  /** True for the one who got there first. */
  holder: boolean
}

export interface ChaserCrowd {
  readonly chasers: readonly Chaser[]
  /**
   * True once a runner has reached the downed kite. The renderer stops drawing
   * that kite: someone has taken it home.
   */
  readonly captured: boolean
  /**
   * Send the crowd after a kite. Called once, when a line is cut.
   * `fromX` is where the kite was cut, so they start from plausible places.
   */
  release(fromX: number, random: RandomSource): void
  /**
   * Steer them toward the kite and advance the run.
   *
   * `grounded` says the kite has actually landed — the crowd converges on it while
   * it is still coming down, but nobody can grab it out of the air.
   */
  update(targetX: number, dt: number, grounded: boolean): void
  /** Stop and hide them. */
  clear(): void
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void
}

/** Running speed range, m/s — a child sprinting across a field. */
const MIN_SPEED = 4.2
const MAX_SPEED = 6.4

/** How close a runner must get to a downed kite to claim it, metres. */
const CLAIM_DISTANCE = 1.6

/**
 * Drawn larger than life, matching the flyers on the ground.
 *
 * Slightly under them so the crowd still reads as further back — see
 * `PERSON_RENDER_SCALE` in the renderer for why anyone is exaggerated at all.
 */
const CHASER_RENDER_SCALE = 2

/** Floor in pixels, so a runner stays visible at the widest zoom. */
const MIN_CHASER_PX = 11

export function createChaserCrowd(): ChaserCrowd {
  // Fixed pool: at most four runners are ever on screen at once.
  const chasers: Chaser[] = Array.from({ length: 4 }, () => ({
    x: 0,
    speed: 0,
    targetX: 0,
    stride: 0,
    size: 1,
    active: false,
    holder: false,
  }))

  let captured = false

  return {
    chasers,

    get captured(): boolean {
      return captured
    },

    release(fromX: number, random: RandomSource): void {
      const count = random.int(2, 4)
      captured = false

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
        chaser.holder = false
      }
    },

    update(targetX: number, dt: number, grounded: boolean): void {
      for (const chaser of chasers) {
        if (!chaser.active) continue

        // Once it is claimed the crowd stops chasing: the one holding it stands
        // still, the rest gather where it landed.
        if (captured) {
          chaser.stride += dt * (chaser.holder ? 1.2 : 2)
          if (!chaser.holder) {
            const gap = chaser.targetX - chaser.x
            if (Math.abs(gap) > 2.4) chaser.x += Math.sign(gap) * chaser.speed * 0.45 * dt
          }
          continue
        }

        chaser.targetX = targetX
        const gap = chaser.targetX - chaser.x

        // First to reach a kite that is actually on the ground takes it.
        if (grounded && Math.abs(gap) < CLAIM_DISTANCE) {
          captured = true
          chaser.holder = true
          chaser.x = targetX
          continue
        }

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
      for (const chaser of chasers) {
        chaser.active = false
        chaser.holder = false
      }
      captured = false
    },

    draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
      const groundY = camera.y(0)

      for (const chaser of chasers) {
        if (!chaser.active) continue

        const x = camera.x(chaser.x)
        const height = Math.max(MIN_CHASER_PX, camera.m(1.5 * chaser.size) * CHASER_RENDER_SCALE)
        if (x < -height * 4 || x > camera.width + height * 4) continue

        const swing = Math.sin(chaser.stride)
        // The one holding it stands still and turns to face out.
        const lean = chaser.holder
          ? 0
          : Math.sign(chaser.targetX - chaser.x) * height * 0.1

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

        // Legs: a two-phase scissor while running, planted once the chase is over.
        const stride = chaser.holder ? 0.35 : swing
        ctx.beginPath()
        ctx.moveTo(x, groundY - height * 0.34)
        ctx.lineTo(x + stride * height * 0.24, groundY)
        ctx.moveTo(x, groundY - height * 0.34)
        ctx.lineTo(x - stride * height * 0.24, groundY)
        ctx.stroke()

        if (chaser.holder) {
          drawHolder(ctx, x, groundY, height, chaser.stride)
          continue
        }

        // One arm reaching, because they are trying to catch something.
        ctx.beginPath()
        ctx.moveTo(x, groundY - height * 0.66)
        ctx.lineTo(x + lean * 2.2, groundY - height * (0.86 + swing * 0.06))
        ctx.stroke()
      }
    },
  }
}

/**
 * The runner who got there first, holding the kite up.
 *
 * Both arms raised with a small diamond above them, in the warm marker colour the
 * arena uses for a prize rather than the flat silhouette black — it has to be
 * obvious at a glance which one of four figures came away with it.
 */
function drawHolder(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  height: number,
  phase: number,
): void {
  // A slow bob, so the winner reads as celebrating rather than frozen.
  const bob = Math.sin(phase) * height * 0.04
  const handY = groundY - height * (1.18) + bob
  const spread = height * 0.26

  ctx.strokeStyle = 'rgba(4, 6, 13, 0.82)'
  ctx.lineWidth = Math.max(1, height * 0.075)
  ctx.beginPath()
  ctx.moveTo(x, groundY - height * 0.66)
  ctx.lineTo(x - spread * 0.6, handY)
  ctx.moveTo(x, groundY - height * 0.66)
  ctx.lineTo(x + spread * 0.6, handY)
  ctx.stroke()

  // The prize itself: a small kite diamond held between the hands.
  const size = height * 0.3
  ctx.fillStyle = '#ffc75c'
  ctx.beginPath()
  ctx.moveTo(x, handY - size * 0.7)
  ctx.lineTo(x + size * 0.45, handY)
  ctx.lineTo(x, handY + size * 0.7)
  ctx.lineTo(x - size * 0.45, handY)
  ctx.closePath()
  ctx.fill()

  ctx.strokeStyle = 'rgba(4, 6, 13, 0.55)'
  ctx.lineWidth = Math.max(1, height * 0.03)
  ctx.stroke()
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

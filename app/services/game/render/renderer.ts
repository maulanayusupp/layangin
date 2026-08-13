import { getKite } from '~/data/kites'
import { getPalette } from '~/data/palettes'
import { getPattern } from '~/data/patterns'
import { getTrailEffect } from '~/data/effects'
import { createRandom } from '../math/random'
import { clamp01 } from '../math/scalar'
import { breakingTension } from '../physics/fighter'
import type { ArenaDefinition, FighterState, MatchSnapshot } from '../types'
import { createArenaLayer, type ArenaLayer } from './arena'
import { createCamera, type Camera } from './camera'
import { drawKite } from './kite'
import { ARENA } from './palette'
import { createParticleSystem, particleAlpha, type ParticleSystem } from './particles'

/**
 * Arena renderer.
 *
 * Owns the canvas 2D context and draws one frame from a `MatchSnapshot`. It is
 * strictly read-only with respect to the simulation: nothing here can change the
 * outcome of a match, which keeps the "renderer is optional" property that a
 * headless replay or a physics test relies on.
 *
 * Draw order is back to front: sky → far line → sparks → kites → near line
 * overlays → fighters on the ground → particles.
 */
export interface ArenaRenderer {
  readonly camera: Camera
  /** Match the backing store to the element's CSS size and the device DPR. */
  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void
  /** Draw one frame. `dt` is real seconds since the previous frame. */
  render(snapshot: MatchSnapshot, dt: number): void
  /** Reset transient visual state between matches. */
  reset(): void
}

/**
 * How much larger than life a kite is drawn. Purely visual — see the note at the
 * call site. Tuned so the largest airframe still fits comfortably in frame.
 */
const KITE_RENDER_SCALE = 4.5

/** Floor on the drawn half-extent, so a kite stays readable when zoomed out. */
const MIN_KITE_PIXELS = 13

export interface RendererOptions {
  ctx: CanvasRenderingContext2D
  /** Backdrop and obstacles to draw. */
  arena: ArenaDefinition
  /** Seeded so trail particles are reproducible alongside the simulation. */
  seed: number
  /** Skip particles and gradients on low-end devices. */
  reducedEffects?: boolean
}

export function createArenaRenderer({
  ctx,
  arena,
  seed,
  reducedEffects = false,
}: RendererOptions): ArenaRenderer {
  const camera = createCamera()
  const backdrop: ArenaLayer = createArenaLayer(arena)
  const particles: ParticleSystem = createParticleSystem(createRandom(seed ^ 0x2f9a))

  let time = 0

  /** Line colour shifts toward red as integrity is worn away. */
  const lineColor = (fighter: FighterState): string => {
    if (fighter.lineIntegrity > 0.62) {
      return fighter.tension > breakingTension(fighter.stats) * 0.8
        ? ARENA.lineTaut
        : ARENA.line
    }
    // Blend toward the frayed colour over the last 62% of integrity.
    const worn = clamp01((0.62 - fighter.lineIntegrity) / 0.62)
    const alpha = 0.5 + worn * 0.45
    return `rgba(255, ${Math.round(77 + (1 - worn) * 160)}, ${Math.round(94 + (1 - worn) * 140)}, ${alpha.toFixed(2)})`
  }

  const drawLine = (fighter: FighterState): void => {
    const points = fighter.linePoints
    if (points.length < 2) return

    ctx.strokeStyle = lineColor(fighter)
    // A taut line reads thicker. Kept at least 1px so it never disappears.
    const load = clamp01(fighter.tension / breakingTension(fighter.stats))
    ctx.lineWidth = Math.max(1, 0.8 + load * 1.8)
    ctx.beginPath()

    const first = points[0]!
    ctx.moveTo(camera.x(first.x), camera.y(first.y))
    for (let i = 1; i < points.length; i += 1) {
      const point = points[i]!
      ctx.lineTo(camera.x(point.x), camera.y(point.y))
    }
    ctx.stroke()
  }

  /** The fighter on the ground: a small silhouette holding a spool. */
  const drawFighter = (fighter: FighterState): void => {
    const groundY = camera.y(0)
    const x = camera.x(fighter.anchor.x)
    const height = Math.max(8, camera.m(1.7))

    ctx.fillStyle = ARENA.fighter
    ctx.beginPath()
    // Torso.
    ctx.ellipse(x, groundY - height * 0.55, height * 0.16, height * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
    // Head.
    ctx.beginPath()
    ctx.arc(x, groundY - height * 0.92, height * 0.13, 0, Math.PI * 2)
    ctx.fill()
    // Legs.
    ctx.lineWidth = Math.max(1, height * 0.07)
    ctx.strokeStyle = ARENA.fighter
    ctx.beginPath()
    ctx.moveTo(x, groundY - height * 0.3)
    ctx.lineTo(x - height * 0.12, groundY)
    ctx.moveTo(x, groundY - height * 0.3)
    ctx.lineTo(x + height * 0.14, groundY)
    ctx.stroke()

    // Side marker so the player can always tell which fighter is theirs.
    ctx.fillStyle = fighter.side === 'player' ? ARENA.playerMarker : ARENA.rivalMarker
    ctx.beginPath()
    const markerY = groundY - height * 1.22
    const markerSize = Math.max(3, height * 0.11)
    ctx.moveTo(x, markerY - markerSize)
    ctx.lineTo(x + markerSize, markerY)
    ctx.lineTo(x, markerY + markerSize)
    ctx.lineTo(x - markerSize, markerY)
    ctx.closePath()
    ctx.fill()
  }

  const drawFighterKite = (fighter: FighterState): void => {
    const kite = getKite(fighter.kiteId)
    const palette = getPalette(fighter.paletteId)

    // The nose points away from the fighter along the line while it is attached;
    // a cut kite tumbles, so its own heading takes over.
    const angle = fighter.alive
      ? Math.atan2(
          fighter.position.y - fighter.anchor.y,
          fighter.position.x - fighter.anchor.x,
        )
      : fighter.heading

    drawKite(ctx, {
      geometry: kite.geometry,
      palette,
      pattern: getPattern(fighter.patternId),
      x: camera.x(fighter.position.x),
      y: camera.y(fighter.position.y),
      // Drawn larger than life. A 1.1 m sail on a 60 m line is a couple of pixels
      // at true scale — accurate, and useless: you cannot tell which kite you are
      // flying, let alone read its livery. Collision and aerodynamics still use
      // the real `kite.size`; only the drawing is exaggerated.
      size: Math.max(MIN_KITE_PIXELS, camera.m((kite.size / 2) * KITE_RENDER_SCALE)),
      angle,
      time,
      sway: clamp01(fighter.tension / 140),
      tails: true,
      alpha: fighter.alive ? 1 : 0.75,
    })
  }

  const drawParticles = (): void => {
    for (const particle of particles.particles) {
      if (particle.life <= 0) continue

      const alpha = particleAlpha(particle)
      const x = camera.x(particle.x)
      const y = camera.y(particle.y)
      const radius = Math.max(0.5, camera.m(particle.size * 0.06))

      ctx.globalAlpha = particle.spark ? alpha : alpha * 0.6
      ctx.fillStyle = particle.color

      if (particle.spark) {
        // Streak along the direction of travel: reads as a hot fragment.
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x - particle.vx * 0.014 * camera.scale, y + particle.vy * 0.014 * camera.scale)
        ctx.lineWidth = radius
        ctx.strokeStyle = particle.color
        ctx.stroke()
      }
      else {
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  const drawClashGlow = (snapshot: MatchSnapshot): void => {
    for (const clash of snapshot.clashes) {
      const x = camera.x(clash.position.x)
      const y = camera.y(clash.position.y)
      const radius = Math.max(6, camera.m(1.6)) * (0.6 + clash.intensity)

      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
      // Cable contacts glow cold blue-white: a different, one-sided hazard.
      const core = clash.kind === 'obstacle'
        ? `rgba(214, 240, 255, ${(0.4 + clash.intensity * 0.5).toFixed(2)})`
        : `rgba(255, 244, 214, ${(0.35 + clash.intensity * 0.5).toFixed(2)})`
      glow.addColorStop(0, core)
      glow.addColorStop(1, 'rgba(255, 158, 74, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  return {
    camera,

    resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void {
      camera.resize(cssWidth, cssHeight, devicePixelRatio)
    },

    render(snapshot: MatchSnapshot, dt: number): void {
      time += dt
      camera.follow(snapshot, dt)

      backdrop.draw(ctx, camera, time)

      // Lines first so the kites sit on top of their own strings.
      drawLine(snapshot.rival)
      drawLine(snapshot.player)

      if (!reducedEffects) {
        drawClashGlow(snapshot)

        for (const clash of snapshot.clashes) {
          particles.emitSparks(clash.position, clash.intensity, dt)
        }

        for (const fighter of [snapshot.player, snapshot.rival]) {
          if (!fighter.alive) continue
          const effect = getTrailEffect(fighter.effectId)
          const palette = getPalette(fighter.paletteId)
          const color = effect.tint === 'palette' ? palette.colors.accent : effect.tint
          particles.emitTrail(
            effect,
            fighter.position,
            fighter.velocity,
            color,
            dt,
            fighter.side === 'player' ? 'player' : 'rival',
          )
        }

        particles.update(dt, snapshot.wind.velocity.x)
        drawParticles()
      }

      drawFighterKite(snapshot.rival)
      drawFighterKite(snapshot.player)

      drawFighter(snapshot.rival)
      drawFighter(snapshot.player)
    },

    reset(): void {
      particles.clear()
      time = 0
    },
  }
}

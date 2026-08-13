import { createRandom } from '../math/random'
import type { ArenaDefinition, ArenaObstacle, ArenaProp } from '../types'
import type { Camera } from './camera'

/**
 * Arena backdrop and obstacles.
 *
 * Replaces the old fixed sky: every visual here is driven by the
 * `ArenaDefinition`, so adding an arena is a data change rather than a renderer
 * change.
 *
 * The obstacles are drawn from the same geometry the physics uses. That is the
 * important property — what you see is exactly what the kite will hit, rather
 * than art with a separate hidden collision box.
 */
export interface ArenaLayer {
  draw(ctx: CanvasRenderingContext2D, camera: Camera, time: number): void
}

interface Cloud {
  x: number
  y: number
  scale: number
  drift: number
  lit: boolean
}

interface Ridge {
  heights: number[]
  parallax: number
  color: string
}

const RIDGE_SAMPLES = 26
const RIDGE_SPREAD = 340

/** Lighten or darken a hex colour by a signed amount. Cheap, no colour lib. */
function shift(hex: string, amount: number): string {
  const value = hex.replace('#', '')
  const full = value.length === 3
    ? value.split('').map(channel => channel + channel).join('')
    : value

  const clampChannel = (channel: number): number => Math.max(0, Math.min(255, Math.round(channel)))
  const r = clampChannel(Number.parseInt(full.slice(0, 2), 16) + amount)
  const g = clampChannel(Number.parseInt(full.slice(2, 4), 16) + amount)
  const b = clampChannel(Number.parseInt(full.slice(4, 6), 16) + amount)

  return `rgb(${r}, ${g}, ${b})`
}

export function createArenaLayer(arena: ArenaDefinition): ArenaLayer {
  // Seeded from the arena id so a given arena always looks the same: it should
  // read as a place, not as fresh noise on every match.
  const seed = arena.id.split('').reduce((hash, char) => hash * 31 + char.charCodeAt(0), 7) >>> 0
  const random = createRandom(seed)

  const clouds: Cloud[] = Array.from({ length: 12 }, () => ({
    x: random.range(-220, 220),
    y: random.range(48, 160),
    scale: random.range(0.6, 2.6),
    drift: random.range(0.12, 0.5),
    lit: random.chance(0.4),
  }))

  const ridges: Ridge[] = arena.ridges.map((color, index) => {
    const baseHeight = 26 - index * 7
    const heights: number[] = []
    let height = baseHeight

    for (let i = 0; i < RIDGE_SAMPLES; i += 1) {
      height += random.range(-baseHeight * 0.3, baseHeight * 0.3)
      height = Math.max(baseHeight * 0.45, Math.min(baseHeight * 1.6, height))
      heights.push(height)
    }

    return { heights, parallax: 0.06 + index * 0.1, color }
  })

  const drawSky = (ctx: CanvasRenderingContext2D, camera: Camera): void => {
    const gradient = ctx.createLinearGradient(0, 0, 0, camera.height)
    for (const [stop, color] of arena.sky) gradient.addColorStop(stop, color)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, camera.width, camera.height)
  }

  const drawSun = (ctx: CanvasRenderingContext2D, camera: Camera): void => {
    const { sun } = arena
    const x = camera.x(sun.x)
    const y = camera.y(sun.y)
    const radius = camera.m(sun.radius)

    const glow = ctx.createRadialGradient(x, y, radius * 0.3, x, y, radius * 9)
    glow.addColorStop(0, sun.glow)
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, radius * 9, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = sun.color
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawClouds = (ctx: CanvasRenderingContext2D, camera: Camera, time: number): void => {
    for (const cloud of clouds) {
      const worldX = cloud.x + time * cloud.drift
      const screenX = camera.x(camera.centerX * 0.82 + (worldX - camera.centerX * 0.82) * 0.35)
      const screenY = camera.y(cloud.y)
      const size = camera.m(cloud.scale * 6)

      if (screenX < -size * 3 || screenX > camera.width + size * 3) continue

      ctx.fillStyle = cloud.lit ? 'rgba(255, 226, 198, 0.18)' : 'rgba(255, 255, 255, 0.10)'
      ctx.beginPath()
      ctx.ellipse(screenX, screenY, size * 1.9, size * 0.52, 0, 0, Math.PI * 2)
      ctx.ellipse(screenX - size * 0.8, screenY + size * 0.16, size * 1.1, size * 0.4, 0, 0, Math.PI * 2)
      ctx.ellipse(screenX + size * 0.9, screenY + size * 0.2, size * 1.2, size * 0.36, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const drawRidges = (ctx: CanvasRenderingContext2D, camera: Camera): void => {
    for (const ridge of ridges) {
      ctx.fillStyle = ridge.color
      ctx.beginPath()
      ctx.moveTo(0, camera.height)

      for (let i = 0; i < ridge.heights.length; i += 1) {
        const t = i / (ridge.heights.length - 1)
        const worldX = -RIDGE_SPREAD / 2 + RIDGE_SPREAD * t
        const screenX = camera.x(worldX + camera.centerX * (1 - ridge.parallax))
        ctx.lineTo(screenX, camera.y(ridge.heights[i] as number))
      }

      ctx.lineTo(camera.width, camera.height)
      ctx.closePath()
      ctx.fill()
    }

    if (arena.haze) {
      // Aerial perspective: a wash over the far layers only.
      const horizon = camera.y(0)
      const gradient = ctx.createLinearGradient(0, horizon - camera.m(40), 0, horizon)
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
      gradient.addColorStop(1, arena.haze)
      ctx.fillStyle = gradient
      ctx.fillRect(0, horizon - camera.m(40), camera.width, camera.m(40))
    }
  }

  const drawGround = (ctx: CanvasRenderingContext2D, camera: Camera): void => {
    const groundY = camera.y(0)
    ctx.fillStyle = arena.ground
    ctx.fillRect(0, groundY, camera.width, camera.height - groundY)

    ctx.strokeStyle = arena.groundAccent
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, groundY)
    ctx.lineTo(camera.width, groundY)
    ctx.stroke()
  }

  // -------------------------------------------------------------------------
  // Obstacles
  // -------------------------------------------------------------------------

  const drawObstacle = (
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    obstacle: ArenaObstacle,
  ): void => {
    const shade = obstacle.shade ?? 0.3
    const left = camera.x(obstacle.x - obstacle.width / 2)
    const right = camera.x(obstacle.x + obstacle.width / 2)
    const base = camera.y(obstacle.y)
    const top = camera.y(obstacle.y + obstacle.height)
    const width = right - left
    const height = base - top

    switch (obstacle.kind) {
      case 'powerline': {
        if (!obstacle.span) return
        const { x1, y1, x2, y2 } = obstacle.span
        // Cables sag under their own weight, same as a kite line does.
        const sag = camera.m(Math.abs(x2 - x1) * 0.03)
        ctx.strokeStyle = 'rgba(12, 14, 20, 0.85)'
        ctx.lineWidth = Math.max(1.2, camera.m(0.12))
        ctx.beginPath()
        ctx.moveTo(camera.x(x1), camera.y(y1))
        ctx.quadraticCurveTo(
          camera.x((x1 + x2) / 2),
          camera.y((y1 + y2) / 2) + sag,
          camera.x(x2),
          camera.y(y2),
        )
        ctx.stroke()
        return
      }

      case 'tree': {
        const trunkWidth = Math.max(2, width * 0.16)
        ctx.fillStyle = shift('#4a3a26', shade * 40)
        ctx.fillRect(left + width / 2 - trunkWidth / 2, base - height * 0.45, trunkWidth, height * 0.45)

        // Faceted canopy: three overlapping polygons read as low-poly foliage.
        ctx.fillStyle = shift('#2f6b3d', shade * 46)
        ctx.beginPath()
        ctx.moveTo(left + width / 2, top)
        ctx.lineTo(right, base - height * 0.42)
        ctx.lineTo(left, base - height * 0.42)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = shift('#3d8a4e', shade * 30)
        ctx.beginPath()
        ctx.moveTo(left + width / 2, top + height * 0.16)
        ctx.lineTo(right - width * 0.12, base - height * 0.5)
        ctx.lineTo(left + width * 0.12, base - height * 0.5)
        ctx.closePath()
        ctx.fill()
        return
      }

      case 'rock': {
        ctx.fillStyle = shift('#7a6448', shade * 60)
        ctx.beginPath()
        ctx.moveTo(left, base)
        ctx.lineTo(left + width * 0.22, top + height * 0.22)
        ctx.lineTo(left + width * 0.56, top)
        ctx.lineTo(right, base - height * 0.12)
        ctx.lineTo(right, base)
        ctx.closePath()
        ctx.fill()

        // Lit face, so the mass reads in one flat colour scene.
        ctx.fillStyle = shift('#94795a', shade * 60)
        ctx.beginPath()
        ctx.moveTo(left + width * 0.56, top)
        ctx.lineTo(right, base - height * 0.12)
        ctx.lineTo(left + width * 0.6, base)
        ctx.closePath()
        ctx.fill()
        return
      }

      case 'pole': {
        ctx.fillStyle = 'rgba(20, 22, 30, 0.9)'
        ctx.fillRect(left, top, Math.max(1.5, width), height)
        // Crossarm, so a bare pole still reads as carrying cables.
        ctx.fillRect(left - camera.m(1.2), top + height * 0.06, camera.m(2.6), Math.max(1.5, camera.m(0.16)))
        return
      }

      case 'arch': {
        // Viaduct: a deck on a row of arches.
        const arches = Math.max(3, Math.round(obstacle.width / 6))
        const archWidth = width / arches
        ctx.fillStyle = shift('#b9bcc2', shade * 48)
        ctx.fillRect(left, top, width, height)

        // Punch the arch openings out of the wall.
        ctx.save()
        ctx.globalCompositeOperation = 'destination-out'
        for (let i = 0; i < arches; i += 1) {
          const cx = left + archWidth * (i + 0.5)
          const openingWidth = archWidth * 0.58
          const openingHeight = height * 0.6
          ctx.beginPath()
          ctx.moveTo(cx - openingWidth / 2, base)
          ctx.lineTo(cx - openingWidth / 2, base - openingHeight * 0.55)
          ctx.arc(cx, base - openingHeight * 0.55, openingWidth / 2, Math.PI, 0)
          ctx.lineTo(cx + openingWidth / 2, base)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()

        // Deck cap on top.
        ctx.fillStyle = shift('#d6d9dd', shade * 30)
        ctx.fillRect(left, top, width, Math.max(2, height * 0.08))
        return
      }

      case 'tower':
      case 'building':
      default: {
        ctx.fillStyle = shift('#8d9199', shade * 70)
        ctx.fillRect(left, top, width, height)

        // Shaded right face for depth.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
        ctx.fillRect(left + width * 0.68, top, width * 0.32, height)

        // Windows, only when the drawn size makes them legible.
        const cell = camera.m(2.4)
        if (cell > 5) {
          ctx.fillStyle = 'rgba(255, 236, 190, 0.20)'
          for (let wy = top + cell * 0.6; wy < base - cell; wy += cell * 1.5) {
            for (let wx = left + cell * 0.5; wx < right - cell * 0.8; wx += cell * 1.5) {
              ctx.fillRect(wx, wy, cell * 0.5, cell * 0.7)
            }
          }
        }
        return
      }
    }
  }

  const drawProp = (ctx: CanvasRenderingContext2D, camera: Camera, prop: ArenaProp): void => {
    const x = camera.x(prop.x)
    const groundY = camera.y(prop.y)
    const size = camera.m(prop.scale * 2)
    if (x < -size * 4 || x > camera.width + size * 4) return

    switch (prop.kind) {
      case 'umbrella': {
        ctx.strokeStyle = 'rgba(30, 30, 36, 0.7)'
        ctx.lineWidth = Math.max(1, size * 0.06)
        ctx.beginPath()
        ctx.moveTo(x, groundY)
        ctx.lineTo(x, groundY - size)
        ctx.stroke()
        // Alternating panels: the classic beach parasol.
        for (let i = 0; i < 4; i += 1) {
          ctx.fillStyle = i % 2 === 0 ? '#e8503f' : '#f5f0e4'
          ctx.beginPath()
          ctx.moveTo(x, groundY - size)
          ctx.arc(x, groundY - size, size * 0.8, Math.PI + (i * Math.PI) / 4, Math.PI + ((i + 1) * Math.PI) / 4)
          ctx.closePath()
          ctx.fill()
        }
        return
      }

      case 'boat': {
        ctx.fillStyle = '#3f5a7a'
        ctx.beginPath()
        ctx.moveTo(x - size, groundY)
        ctx.lineTo(x + size, groundY)
        ctx.lineTo(x + size * 0.6, groundY + size * 0.35)
        ctx.lineTo(x - size * 0.6, groundY + size * 0.35)
        ctx.closePath()
        ctx.fill()
        return
      }

      case 'goalpost': {
        ctx.strokeStyle = 'rgba(240, 244, 255, 0.5)'
        ctx.lineWidth = Math.max(1, size * 0.07)
        ctx.beginPath()
        ctx.moveTo(x - size * 0.7, groundY)
        ctx.lineTo(x - size * 0.7, groundY - size * 1.1)
        ctx.lineTo(x + size * 0.7, groundY - size * 1.1)
        ctx.lineTo(x + size * 0.7, groundY)
        ctx.stroke()
        return
      }

      case 'flag': {
        ctx.strokeStyle = 'rgba(240, 244, 255, 0.6)'
        ctx.lineWidth = Math.max(1, size * 0.05)
        ctx.beginPath()
        ctx.moveTo(x, groundY)
        ctx.lineTo(x, groundY - size * 2.4)
        ctx.stroke()
        ctx.fillStyle = '#e8384f'
        ctx.fillRect(x, groundY - size * 2.4, size * 0.9, size * 0.3)
        ctx.fillStyle = '#f5f0e4'
        ctx.fillRect(x, groundY - size * 2.1, size * 0.9, size * 0.3)
        return
      }

      case 'tram': {
        ctx.fillStyle = '#e8b53f'
        ctx.fillRect(x - size, groundY - size * 0.9, size * 2, size * 0.9)
        ctx.fillStyle = 'rgba(20, 22, 30, 0.55)'
        for (let i = 0; i < 5; i += 1) {
          ctx.fillRect(x - size * 0.85 + i * size * 0.36, groundY - size * 0.72, size * 0.22, size * 0.4)
        }
        return
      }

      case 'fountain': {
        ctx.fillStyle = 'rgba(180, 190, 200, 0.55)'
        ctx.fillRect(x - size, groundY - size * 0.22, size * 2, size * 0.22)
        ctx.fillStyle = 'rgba(120, 190, 210, 0.5)'
        ctx.fillRect(x - size * 0.7, groundY - size * 0.4, size * 1.4, size * 0.2)
        return
      }

      case 'bush':
      default: {
        ctx.fillStyle = 'rgba(46, 92, 56, 0.75)'
        ctx.beginPath()
        ctx.ellipse(x, groundY - size * 0.22, size * 0.7, size * 0.35, 0, 0, Math.PI * 2)
        ctx.fill()
        return
      }
    }
  }

  return {
    draw(ctx: CanvasRenderingContext2D, camera: Camera, time: number): void {
      drawSky(ctx, camera)
      drawSun(ctx, camera)
      drawClouds(ctx, camera, time)
      drawRidges(ctx, camera)

      // Props behind obstacles, obstacles in front: a bush should not cover a wall.
      for (const prop of arena.props) drawProp(ctx, camera, prop)

      drawGround(ctx, camera)

      // Cables last so they sit over the structures that carry them.
      for (const obstacle of arena.obstacles) {
        if (obstacle.kind !== 'powerline') drawObstacle(ctx, camera, obstacle)
      }
      for (const obstacle of arena.obstacles) {
        if (obstacle.kind === 'powerline') drawObstacle(ctx, camera, obstacle)
      }
    },
  }
}

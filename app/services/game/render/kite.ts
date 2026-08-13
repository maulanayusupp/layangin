import type { KiteGeometry, KitePattern, KiteTail, Palette, PaintRole } from '../types'

/**
 * Draws a kite from its geometry and a palette.
 *
 * Shared by the arena and by the codex/shop previews, so a kite always looks the
 * same wherever it appears — the preview is the real renderer, not an
 * illustration of it.
 *
 * ## Transform
 * Geometry is authored in a unit square with **y up**; canvas y grows downward.
 * The transform below maps the kite's local +y axis onto the world direction
 * `angle` (the flying line, pointing away from the fighter), which is why a kite
 * leans over as it moves across the wind window:
 *
 *   `translate(cx, cy) · rotate(π/2 − angle) · scale(size, −size)`
 */
export interface DrawKiteOptions {
  geometry: KiteGeometry
  palette: Palette
  /** Sail graphics. Omitted or `plain` draws the bare panels. */
  pattern?: KitePattern
  /** Canvas position of the kite's centre. */
  x: number
  y: number
  /** Half-extent in pixels — the unit square is scaled by this. */
  size: number
  /** World-space direction of the kite's nose, radians, y-up. */
  angle: number
  /** Seconds since start; drives tail motion. */
  time: number
  /** Extra sway amplitude, 0..1. Higher in strong wind. */
  sway?: number
  /** Draw tails. Disabled in tight previews where a 9 m tail will not fit. */
  tails?: boolean
  /** 0..1 opacity, used to fade a cut kite out. */
  alpha?: number
}

function paintOf(palette: Palette, role: PaintRole): string {
  return palette.colors[role]
}

/**
 * A tail is a tapering ribbon that streams back along the kite's local −y axis
 * with a travelling sine wave, so it lags the kite rather than moving rigidly
 * with it. Longer tails carry a lower-frequency, higher-amplitude wave, which is
 * what makes a *janggan*'s tail read as heavy.
 */
function drawTail(
  ctx: CanvasRenderingContext2D,
  tail: KiteTail,
  palette: Palette,
  time: number,
  sway: number,
): void {
  const segments = tail.kind === 'dragon' ? 40 : 16
  const amplitude = (tail.kind === 'tassel' ? 0.05 : 0.16) * (0.6 + sway)
  const frequency = tail.kind === 'dragon' ? 1.6 : 3.2
  const speed = tail.kind === 'dragon' ? 2.2 : 4.4

  ctx.beginPath()

  // Walk down one side of the ribbon and back up the other so it can be filled
  // with a taper instead of stroked at a constant width.
  for (let side = 0; side < 2; side += 1) {
    const direction = side === 0 ? 1 : -1
    for (let i = 0; i <= segments; i += 1) {
      const t = side === 0 ? i / segments : 1 - i / segments
      const along = tail.anchor.y - t * tail.length
      const wave = Math.sin(t * Math.PI * frequency - time * speed) * amplitude * t
      const halfWidth = (tail.width / 2) * (1 - t * 0.75) * direction

      const x = tail.anchor.x + wave + halfWidth
      if (side === 0 && i === 0) ctx.moveTo(x, along)
      else ctx.lineTo(x, along)
    }
  }

  ctx.closePath()
  ctx.fillStyle = paintOf(palette, tail.paint)
  ctx.fill()

  // Dragon tails get rungs, like the bamboo hoops on a real janggan.
  if (tail.kind === 'dragon') {
    ctx.strokeStyle = paintOf(palette, 'outline')
    ctx.lineWidth = 0.012
    for (let i = 1; i < segments; i += 2) {
      const t = i / segments
      const along = tail.anchor.y - t * tail.length
      const wave = Math.sin(t * Math.PI * frequency - time * speed) * amplitude * t
      const halfWidth = (tail.width / 2) * (1 - t * 0.75)
      ctx.beginPath()
      ctx.moveTo(tail.anchor.x + wave - halfWidth, along)
      ctx.lineTo(tail.anchor.x + wave + halfWidth, along)
      ctx.stroke()
    }
  }
}

/** Trace an outline into the current path, without stroking or filling it. */
function tracePolygon(ctx: CanvasRenderingContext2D, points: readonly { x: number, y: number }[]): void {
  if (points.length < 3) return
  const first = points[0]!
  ctx.moveTo(first.x, first.y)
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i]!
    ctx.lineTo(point.x, point.y)
  }
  ctx.closePath()
}

/**
 * Paints a pattern inside the sail.
 *
 * The caller has already clipped to the airframe's outline, so each motif can be
 * drawn as if the sail were a full unit square and the clip does the shaping.
 * That is what lets twelve patterns work on eight very different silhouettes
 * without a single special case.
 */
function drawPattern(
  ctx: CanvasRenderingContext2D,
  pattern: KitePattern,
  palette: Palette,
): void {
  const [paintA, paintB] = pattern.paints
  const colorA = paintOf(palette, paintA)
  const colorB = paintOf(palette, paintB)
  const count = Math.max(1, pattern.count)

  switch (pattern.kind) {
    case 'plain':
      return

    case 'stripes': {
      // Bands across the sail, rotated by the pattern's angle.
      ctx.save()
      ctx.rotate(pattern.angle ?? 0)
      const bandWidth = 2.4 / count
      for (let i = 0; i < count; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? colorA : colorB
        ctx.fillRect(-1.2 + i * bandWidth, -1.4, bandWidth, 2.8)
      }
      ctx.restore()
      return
    }

    case 'quarters': {
      // Opposing quadrants, the classic two-tone fighting kite.
      ctx.fillStyle = colorA
      ctx.fillRect(-1.2, -1.2, 1.2, 1.2)
      ctx.fillRect(0, 0, 1.2, 1.2)
      ctx.fillStyle = colorB
      ctx.fillRect(0, -1.2, 1.2, 1.2)
      ctx.fillRect(-1.2, 0, 1.2, 1.2)
      return
    }

    case 'chevron': {
      // Nested arrows pointing at the nose.
      const step = 2.4 / count
      for (let i = 0; i < count; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? colorA : colorB
        const y = 1.2 - i * step
        ctx.beginPath()
        ctx.moveTo(-1.2, y - step * 1.6)
        ctx.lineTo(0, y)
        ctx.lineTo(1.2, y - step * 1.6)
        ctx.lineTo(1.2, y - step * 2.6)
        ctx.lineTo(0, y - step)
        ctx.lineTo(-1.2, y - step * 2.6)
        ctx.closePath()
        ctx.fill()
      }
      return
    }

    case 'rings': {
      // Concentric target, largest first so smaller rings sit on top.
      for (let i = count; i > 0; i -= 1) {
        ctx.fillStyle = i % 2 === 0 ? colorA : colorB
        ctx.beginPath()
        ctx.arc(0, 0, (i / count) * 1.15, 0, Math.PI * 2)
        ctx.fill()
      }
      return
    }

    case 'star': {
      ctx.fillStyle = colorA
      ctx.beginPath()
      const points = Math.max(4, count)
      for (let i = 0; i < points * 2; i += 1) {
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
        const radius = i % 2 === 0 ? 1.05 : 0.44
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = colorB
      ctx.beginPath()
      ctx.arc(0, 0, 0.2, 0, Math.PI * 2)
      ctx.fill()
      return
    }

    case 'checker': {
      const cell = 2.4 / count
      for (let row = 0; row < count; row += 1) {
        for (let column = 0; column < count; column += 1) {
          if ((row + column) % 2 !== 0) continue
          ctx.fillStyle = colorA
          ctx.fillRect(-1.2 + column * cell, -1.2 + row * cell, cell, cell)
        }
      }
      // A single contrasting cell keeps the grid from reading as a texture.
      ctx.fillStyle = colorB
      ctx.fillRect(-cell / 2, -cell / 2, cell, cell)
      return
    }

    case 'flame': {
      // Tongues licking up from the tail edge.
      const width = 2.4 / count
      for (let i = 0; i < count; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? colorA : colorB
        const x = -1.2 + i * width
        const height = 0.9 + (i % 3) * 0.35
        ctx.beginPath()
        ctx.moveTo(x, -1.2)
        ctx.quadraticCurveTo(x + width * 0.5, -1.2 + height * 0.5, x + width * 0.5, -1.2 + height)
        ctx.quadraticCurveTo(x + width * 0.5, -1.2 + height * 0.5, x + width, -1.2)
        ctx.closePath()
        ctx.fill()
      }
      return
    }

    case 'lattice': {
      // Kawung: four-petal batik motif on a grid.
      const step = 2.4 / count
      const radius = step * 0.42
      ctx.fillStyle = colorA
      for (let row = 0; row <= count; row += 1) {
        for (let column = 0; column <= count; column += 1) {
          const cx = -1.2 + column * step
          const cy = -1.2 + row * step
          for (const [ox, oy] of [
            [-radius, 0],
            [radius, 0],
            [0, -radius],
            [0, radius],
          ] as const) {
            ctx.beginPath()
            ctx.ellipse(cx + ox, cy + oy, radius * 0.8, radius * 0.55, ox === 0 ? Math.PI / 2 : 0, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
      ctx.fillStyle = colorB
      for (let row = 0; row <= count; row += 1) {
        for (let column = 0; column <= count; column += 1) {
          ctx.beginPath()
          ctx.arc(-1.2 + column * step, -1.2 + row * step, radius * 0.22, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      return
    }

    case 'eye': {
      // Paired eyes, the way a bebean or an owl kite is painted.
      const offset = 0.42
      for (const side of [-1, 1]) {
        ctx.fillStyle = colorA
        ctx.beginPath()
        ctx.ellipse(side * offset, 0.22, 0.3, 0.38, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = colorB
        ctx.beginPath()
        ctx.arc(side * offset, 0.22, 0.13, 0, Math.PI * 2)
        ctx.fill()
      }
      return
    }

    case 'rays': {
      // Sunburst from the bridle point outward.
      for (let i = 0; i < count; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? colorA : colorB
        const from = (i / count) * Math.PI * 2
        const to = ((i + 1) / count) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.arc(0, 0, 1.8, from, to)
        ctx.closePath()
        ctx.fill()
      }
      return
    }
  }
}

export function drawKite(ctx: CanvasRenderingContext2D, options: DrawKiteOptions): void {
  const {
    geometry,
    palette,
    pattern,
    x,
    y,
    size,
    angle,
    time,
    sway = 0.3,
    tails = true,
    alpha = 1,
  } = options

  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.translate(x, y)
  ctx.rotate(Math.PI / 2 - angle)
  ctx.scale(size, -size)

  // Line widths are in local units from here on, hence the small values.
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  if (tails) {
    for (const tail of geometry.tails) {
      drawTail(ctx, tail, palette, time, sway)
    }
  }

  // Panels, in declaration order: later panels overlay earlier ones.
  for (const panel of geometry.panels) {
    if (panel.points.length < 3) continue

    ctx.beginPath()
    tracePolygon(ctx, panel.points)
    ctx.fillStyle = paintOf(palette, panel.paint)
    ctx.fill()
  }

  const hull = geometry.panels[0]

  // Sail graphics, clipped to the airframe's own outline. This is what lets one
  // pattern work on every shape without special cases.
  if (pattern && pattern.kind !== 'plain' && hull && hull.points.length >= 3) {
    ctx.save()
    ctx.beginPath()
    tracePolygon(ctx, hull.points)
    ctx.clip()
    drawPattern(ctx, pattern, palette)
    ctx.restore()
  }

  // Sail outline last so panel seams and pattern edges do not show through it.
  const outline = paintOf(palette, 'outline')
  ctx.strokeStyle = outline
  ctx.lineWidth = 0.035

  if (hull && hull.points.length >= 3) {
    ctx.beginPath()
    tracePolygon(ctx, hull.points)
    ctx.stroke()
  }

  // Spars.
  ctx.lineWidth = 0.026
  ctx.strokeStyle = outline
  for (const [from, to] of geometry.spars) {
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }

  // Humming bow, drawn as an arc bulging away from the sail.
  if (geometry.bow) {
    const { from, to, depth } = geometry.bow
    ctx.lineWidth = 0.03
    ctx.strokeStyle = paintOf(palette, 'accent')
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.quadraticCurveTo((from.x + to.x) / 2, (from.y + to.y) / 2 + depth * 2, to.x, to.y)
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Fits a kite into a preview box.
 *
 * Tails are excluded from the fit — a 9 m dragon tail would shrink the sail to a
 * speck — so previews show the airframe at a comparable scale and the tail simply
 * runs out of frame, which is honest about what the kite is.
 */
export function previewScale(boxSize: number, tails: boolean): number {
  return boxSize * (tails ? 0.3 : 0.42)
}

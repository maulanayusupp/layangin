import { describe, expect, it } from 'vitest'
import { createCamera } from '~/services/game/render/camera'
import { createMatchEngine } from '~/services/game/engine'
import { getArena } from '~/data/arenas'
import { getOpponent } from '~/data/opponents'
import { emptyUpgradeLevels } from '~/data/upgrades'
import { DEFAULT_TIME_LIMIT, FIXED_TIMESTEP } from '~/services/game/constants'
import { NEUTRAL_COMMAND } from '~/services/game/types'

/**
 * Camera framing.
 *
 * The HUD sits on top of the canvas, so the camera reserves a band at the foot of
 * the view for it. Getting that arithmetic wrong is easy and invisible in code
 * review — the first attempt inverted the sign and drew the ground at the *top* of
 * the canvas — so the relationship is asserted here instead.
 */
function framedCamera(width: number, height: number, insetBottom: number) {
  const engine = createMatchEngine({
    config: {
      seed: 5,
      opponent: getOpponent('bocah-sawah'),
      player: {
        kiteId: 'pecut',
        paletteId: 'senja',
        patternId: 'plain',
        effectId: 'none',
        upgrades: emptyUpgradeLevels(),
      },
      arena: getArena('sawah'),
      timeLimit: DEFAULT_TIME_LIMIT,
      difficultyScale: 1,
    },
    playerInput: { kind: 'local', sample: () => NEUTRAL_COMMAND },
  })
  engine.skipCountdown()

  const camera = createCamera()
  camera.resize(width, height, 1, insetBottom)

  for (let i = 0; i < Math.round(20 / FIXED_TIMESTEP); i += 1) {
    engine.advance(FIXED_TIMESTEP)
    camera.follow(engine.snapshot, FIXED_TIMESTEP)
  }

  return { camera, snapshot: engine.snapshot }
}

describe('camera', () => {
  const sizes = [
    { label: 'desktop', width: 1440, height: 620 },
    { label: 'mobile', width: 390, height: 470 },
  ] as const

  it('puts the ground at the bottom edge when nothing is reserved', () => {
    for (const size of sizes) {
      const { camera } = framedCamera(size.width, size.height, 0)
      expect(camera.y(0), size.label).toBeCloseTo(size.height, 0)
    }
  })

  it('lifts the ground to sit exactly above the reserved band', () => {
    for (const size of sizes) {
      for (const inset of [60, 110, 150]) {
        const { camera } = framedCamera(size.width, size.height, inset)
        // The regression: this used to come out at `inset` instead, drawing the
        // ground near the top of the canvas and the sky below it.
        expect(camera.y(0), `${size.label} inset ${inset}`).toBeCloseTo(size.height - inset, 0)
      }
    }
  })

  it('keeps both kites on screen above the reserved band', () => {
    for (const size of sizes) {
      const { camera, snapshot } = framedCamera(size.width, size.height, 140)

      for (const fighter of [snapshot.player, snapshot.rival]) {
        const screenY = camera.y(fighter.position.y)
        expect(screenY, `${size.label} ${fighter.side} off the top`).toBeGreaterThan(0)
        expect(screenY, `${size.label} ${fighter.side} behind the HUD`).toBeLessThan(
          size.height - 140,
        )
      }
    }
  })

  it('refuses to reserve more than 40% of the view', () => {
    // A HUD taller than the arena would otherwise leave no sky at all.
    const { camera } = framedCamera(390, 470, 400)
    expect(camera.y(0)).toBeGreaterThan(470 * 0.6 - 1)
  })

  it('zooms out rather than cropping when the reserved band grows', () => {
    const roomy = framedCamera(1440, 620, 0)
    const tight = framedCamera(1440, 620, 200)

    expect(tight.camera.scale).toBeLessThan(roomy.camera.scale)
  })
})

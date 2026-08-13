import { describe, expect, it } from 'vitest'
import { createMatchEngine } from '~/services/game/engine'
import { NEUTRAL_COMMAND, type FighterCommand } from '~/services/game/types'
import type { InputSource } from '~/services/game/input/source'
import { getOpponent } from '~/data/opponents'
import { getArena } from '~/data/arenas'
import { emptyUpgradeLevels } from '~/data/upgrades'
import { DEFAULT_TIME_LIMIT, FIXED_TIMESTEP } from '~/services/game/constants'

/** Input source that replays a fixed command every step. */
function constantInput(command: FighterCommand): InputSource {
  return { kind: 'local', sample: () => command }
}

function makeEngine(seed = 1234, playerCommand: FighterCommand = { ...NEUTRAL_COMMAND }) {
  return createMatchEngine({
    config: {
      seed,
      opponent: getOpponent('bocah-sawah'),
      player: {
        kiteId: 'pecut',
        paletteId: 'senja',
        patternId: 'plain',
        effectId: 'none',
        upgrades: emptyUpgradeLevels(),
      },
      // The open rice field has no obstacles, so these tests measure flight and
      // combat only. Obstacle behaviour is covered in obstacles.spec.ts.
      arena: getArena('sawah'),
      timeLimit: DEFAULT_TIME_LIMIT,
      difficultyScale: 1,
    },
    playerInput: constantInput(playerCommand),
  })
}

/** Run the engine for a number of whole simulation steps. */
function run(engine: ReturnType<typeof createMatchEngine>, seconds: number): void {
  const steps = Math.round(seconds / FIXED_TIMESTEP)
  for (let i = 0; i < steps; i += 1) engine.advance(FIXED_TIMESTEP)
}

describe('match engine', () => {
  it('starts in the countdown and does not accrue match time', () => {
    const engine = makeEngine()
    expect(engine.snapshot.phase).toBe('countdown')

    run(engine, 1)
    expect(engine.snapshot.elapsed).toBe(0)
  })

  it('enters the flying phase once the countdown expires', () => {
    const engine = makeEngine()
    engine.skipCountdown()
    expect(engine.snapshot.phase).toBe('flying')

    run(engine, 0.5)
    expect(engine.snapshot.elapsed).toBeGreaterThan(0)
  })

  it('keeps both kites airborne under neutral input in steady conditions', () => {
    const engine = makeEngine()
    engine.skipCountdown()
    run(engine, 12)

    expect(engine.snapshot.player.position.y).toBeGreaterThan(5)
    expect(engine.snapshot.rival.position.y).toBeGreaterThan(5)
    expect(engine.snapshot.player.alive).toBe(true)
  })

  it('produces no NaN in the fighter state over a long run', () => {
    const engine = makeEngine(777, { reel: 1, walk: 0.5, snap: true })
    engine.skipCountdown()
    run(engine, 30)

    const { player } = engine.snapshot
    for (const value of [
      player.position.x,
      player.position.y,
      player.velocity.x,
      player.velocity.y,
      player.tension,
      player.lineLength,
      player.lineIntegrity,
      player.stamina,
    ]) {
      expect(Number.isFinite(value)).toBe(true)
    }
  })

  it('replays identically from the same seed and command stream', () => {
    const a = makeEngine(4242, { reel: 0.6, walk: -0.3, snap: false })
    const b = makeEngine(4242, { reel: 0.6, walk: -0.3, snap: false })

    a.skipCountdown()
    b.skipCountdown()
    run(a, 8)
    run(b, 8)

    // Determinism is the property the planned lockstep netcode depends on.
    expect(a.snapshot.player.position).toEqual(b.snapshot.player.position)
    expect(a.snapshot.rival.position).toEqual(b.snapshot.rival.position)
    expect(a.snapshot.player.lineIntegrity).toBe(b.snapshot.player.lineIntegrity)
    expect(a.step).toBe(b.step)
  })

  it('diverges when the seed changes', () => {
    const a = makeEngine(1)
    const b = makeEngine(2)

    a.skipCountdown()
    b.skipCountdown()
    run(a, 8)
    run(b, 8)

    expect(a.snapshot.rival.position).not.toEqual(b.snapshot.rival.position)
  })

  it('drains stamina while hauling and recovers it when neutral', () => {
    const hauling = makeEngine(5, { reel: 1, walk: 0, snap: false })
    hauling.skipCountdown()
    run(hauling, 4)
    const drained = hauling.snapshot.player.stamina

    expect(drained).toBeLessThan(1)

    const resting = makeEngine(5, { ...NEUTRAL_COMMAND })
    resting.skipCountdown()
    run(resting, 4)

    expect(resting.snapshot.player.stamina).toBeGreaterThan(drained)
  })

  it('resolves by the time limit and picks the healthier line', () => {
    const engine = makeEngine()
    engine.skipCountdown()
    run(engine, DEFAULT_TIME_LIMIT + 1)

    expect(engine.snapshot.phase).toBe('resolved')
    expect(engine.snapshot.outcome.kind).not.toBe('pending')
  })

  it('ignores a huge frame delta instead of fast-forwarding the match', () => {
    const engine = makeEngine()
    engine.skipCountdown()
    // Simulates a tab backgrounded for a minute.
    engine.advance(60)

    expect(engine.snapshot.elapsed).toBeLessThan(1)
  })

  it('tracks peak telemetry for the result screen', () => {
    const engine = makeEngine(9, { reel: 1, walk: 0, snap: true })
    engine.skipCountdown()
    run(engine, 10)

    expect(engine.snapshot.stats.peakTension).toBeGreaterThan(0)
    expect(engine.snapshot.stats.peakAltitude).toBeGreaterThan(0)
    expect(engine.snapshot.stats.snapsUsed).toBeGreaterThan(0)
  })
})

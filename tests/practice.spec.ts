import { describe, expect, it } from 'vitest'
import { createMatchEngine } from '~/services/game/engine'
import { getArena } from '~/data/arenas'
import { getOpponent } from '~/data/opponents'
import { emptyUpgradeLevels } from '~/data/upgrades'
import { FIXED_TIMESTEP, timeLimitFor } from '~/services/game/constants'
import { NEUTRAL_COMMAND, type MatchLoadout } from '~/services/game/types'
import type { InputSource } from '~/services/game/input/source'

/**
 * Practice mode.
 *
 * Learning the three things that decide a duel used to require losing real matches
 * to find out what they were. Practice is the classroom: a cut still costs the round
 * so the consequence is visible, but nothing ends the session and nothing is scored.
 *
 * These tests pin the two properties that make it a classroom rather than a match —
 * it never resolves, and it never runs out of lives.
 */

const LOADOUT: MatchLoadout = {
  kiteId: 'pecut',
  paletteId: 'senja',
  patternId: 'plain',
  effectId: 'none',
  upgrades: emptyUpgradeLevels(),
}

const passive: InputSource = { kind: 'local', sample: () => NEUTRAL_COMMAND }

function makeEngine(practice: boolean, seed = 4242) {
  return createMatchEngine({
    config: {
      seed,
      opponents: [getOpponent('bocah-sawah')],
      player: LOADOUT,
      arena: getArena('sawah'),
      timeLimit: timeLimitFor(2),
      difficultyScale: 1,
      practice,
    },
    playerInput: passive,
  })
}

function run(engine: ReturnType<typeof makeEngine>, seconds: number): void {
  const steps = Math.round(seconds / FIXED_TIMESTEP)
  for (let i = 0; i < steps; i += 1) engine.advance(FIXED_TIMESTEP)
}

describe('a practice session never ends', () => {
  it('flies past the time limit without resolving', () => {
    const engine = makeEngine(true)
    engine.skipCountdown()

    // Twice the clock a real match would have.
    run(engine, timeLimitFor(2) * 2)

    expect(engine.snapshot.phase).not.toBe('resolved')
    expect(engine.snapshot.outcome.kind).toBe('pending')
    expect(engine.snapshot.elapsed).toBeGreaterThan(timeLimitFor(2))
  })

  it('resolves in the same time when practice is off', () => {
    const engine = makeEngine(false)
    engine.skipCountdown()
    run(engine, timeLimitFor(2) * 2)

    // The control: the same seed and setup does finish a real match.
    expect(engine.snapshot.phase).toBe('resolved')
  })

  it('keeps the fighters alive through many lost rounds', () => {
    const engine = makeEngine(true)
    engine.skipCountdown()

    // Cut the player down repeatedly: far more times than they have lives.
    for (let round = 0; round < engine.snapshot.startingHp * 3; round += 1) {
      for (let i = 0; i < 600 && engine.snapshot.phase !== 'flying'; i += 1) {
        engine.advance(FIXED_TIMESTEP)
      }

      engine.snapshot.player.lineIntegrity = 0
      engine.snapshot.player.alive = false
      engine.advance(FIXED_TIMESTEP)

      expect(engine.snapshot.player.eliminated).toBe(false)
      expect(engine.snapshot.player.hp).toBeGreaterThan(0)
      expect(engine.snapshot.phase).not.toBe('resolved')
    }
  })

  it('still ends the round, so a mistake visibly costs something', () => {
    const engine = makeEngine(true)
    engine.skipCountdown()
    engine.advance(FIXED_TIMESTEP)

    const roundBefore = engine.snapshot.round
    engine.snapshot.player.lineIntegrity = 0
    engine.snapshot.player.alive = false
    engine.advance(FIXED_TIMESTEP)

    // The pause opens and the banner has something to say.
    expect(engine.snapshot.phase).toBe('roundOver')
    expect(engine.snapshot.lastRound?.loserIsPlayer).toBe(true)
    expect(engine.snapshot.lastRound?.round).toBe(roundBefore)
  })

  it('flags itself on the snapshot so the HUD can drop the clock', () => {
    expect(makeEngine(true).snapshot.practice).toBe(true)
    expect(makeEngine(false).snapshot.practice).toBe(false)
  })
})

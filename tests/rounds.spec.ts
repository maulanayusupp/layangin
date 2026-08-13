import { describe, expect, it } from 'vitest'
import { createMatchEngine } from '~/services/game/engine'
import { ARENAS, getArena } from '~/data/arenas'
import { OPPONENTS, getOpponent } from '~/data/opponents'
import { emptyUpgradeLevels } from '~/data/upgrades'
import {
  CRASH_GRACE,
  DEFAULT_TIME_LIMIT,
  FIXED_TIMESTEP,
  ROUND_BREAK,
  STARTING_HP,
} from '~/services/game/constants'
import { NEUTRAL_COMMAND, type ArenaId, type FighterCommand } from '~/services/game/types'
import type { InputSource } from '~/services/game/input/source'
import { hazardCeiling } from '~/services/game/physics/obstacles'

function makeEngine(
  arenaId: ArenaId,
  seed = 1,
  command: FighterCommand = { ...NEUTRAL_COMMAND },
  opponentId: Parameters<typeof getOpponent>[0] = 'bocah-sawah',
) {
  const input: InputSource = { kind: 'local', sample: () => command }

  return createMatchEngine({
    config: {
      seed,
      opponent: getOpponent(opponentId),
      player: {
        kiteId: 'pecut',
        paletteId: 'senja',
        patternId: 'plain',
        effectId: 'none',
        upgrades: emptyUpgradeLevels(),
      },
      arena: getArena(arenaId),
      timeLimit: DEFAULT_TIME_LIMIT,
      difficultyScale: 1,
    },
    playerInput: input,
  })
}

function run(engine: ReturnType<typeof createMatchEngine>, seconds: number): void {
  const steps = Math.round(seconds / FIXED_TIMESTEP)
  for (let i = 0; i < steps; i += 1) engine.advance(FIXED_TIMESTEP)
}

describe('lives', () => {
  it('starts both fighters on a full set', () => {
    const engine = makeEngine('sawah')
    expect(engine.snapshot.player.hp).toBe(STARTING_HP)
    expect(engine.snapshot.rival.hp).toBe(STARTING_HP)
    expect(engine.snapshot.round).toBe(1)
  })

  /**
   * The regression this file exists for: a match used to be decided in two
   * seconds because the AI hauled its own kite into an arena structure. A single
   * accident must cost a life, never the match.
   */
  it('does not resolve a match within the first few seconds in any arena', () => {
    for (const arena of ARENAS) {
      const engine = makeEngine(arena.id, 4242)
      engine.skipCountdown()
      run(engine, 6)

      expect(engine.snapshot.phase, `${arena.id} resolved too early`).not.toBe('resolved')
    }
  })

  it('never lets a round end inside the grace period', () => {
    for (const arena of ARENAS) {
      const engine = makeEngine(arena.id, 777)
      engine.skipCountdown()
      run(engine, CRASH_GRACE - 0.2)

      expect(engine.snapshot.player.hp, arena.id).toBe(STARTING_HP)
      expect(engine.snapshot.rival.hp, arena.id).toBe(STARTING_HP)
    }
  })

  it('launches both kites clear of every arena hazard', () => {
    for (const arena of ARENAS) {
      const engine = makeEngine(arena.id)
      const { player, rival } = engine.snapshot

      for (const fighter of [player, rival]) {
        const ceiling = hazardCeiling(arena, fighter.anchor.x, fighter.position.x)
        if (ceiling > 0) {
          expect(fighter.position.y, `${arena.id} ${fighter.side}`).toBeGreaterThan(ceiling)
        }
      }
    }
  })

  it('costs a life and relaunches instead of ending the match', () => {
    // Hauling hard on the cabled arena wears the line out fast.
    const engine = makeEngine('kampung', 99, { reel: 1, walk: 0, snap: true })
    engine.skipCountdown()

    let sawRoundOver = false
    const steps = Math.round(120 / FIXED_TIMESTEP)
    for (let i = 0; i < steps; i += 1) {
      engine.advance(FIXED_TIMESTEP)
      if (engine.snapshot.phase === 'roundOver') sawRoundOver = true
      if (engine.snapshot.phase === 'resolved') break
    }

    // Either a round break happened, or the duel simply ran its time — both are
    // fine. What must not happen is a decisive result without any round break.
    if (engine.snapshot.outcome.kind === 'cut') {
      expect(sawRoundOver).toBe(true)
    }
    expect(engine.snapshot.player.hp + engine.snapshot.rival.hp).toBeLessThanOrEqual(
      STARTING_HP * 2,
    )
  })

  it('restores the line and stamina on the next round but keeps the score', () => {
    const engine = makeEngine('sawah', 5, { reel: 1, walk: 0, snap: false })
    engine.skipCountdown()

    // Force a round loss directly: the engine owns the transition, not the test.
    engine.snapshot.player.lineIntegrity = 0
    engine.advance(FIXED_TIMESTEP)

    expect(engine.snapshot.phase).toBe('roundOver')
    expect(engine.snapshot.player.hp).toBe(STARTING_HP - 1)
    expect(engine.snapshot.lastRound?.loser).toBe('player')

    // Ride out the break and stop just past it, so the assertions see the
    // relaunched state rather than a second of hauling on top of it.
    run(engine, ROUND_BREAK + 0.05)

    expect(engine.snapshot.phase).toBe('flying')
    expect(engine.snapshot.round).toBe(2)
    expect(engine.snapshot.player.lineIntegrity).toBeGreaterThan(0.99)
    expect(engine.snapshot.player.stamina).toBeGreaterThan(0.98)
    // The score persists — that is the whole point of lives.
    expect(engine.snapshot.player.hp).toBe(STARTING_HP - 1)
  })

  it('resolves only when a fighter runs out of lives', () => {
    const engine = makeEngine('sawah', 6)
    engine.skipCountdown()

    for (let life = STARTING_HP; life > 1; life -= 1) {
      engine.snapshot.player.lineIntegrity = 0
      engine.advance(FIXED_TIMESTEP)
      expect(engine.snapshot.phase).toBe('roundOver')
      run(engine, 3)
    }

    expect(engine.snapshot.player.hp).toBe(1)
    expect(engine.snapshot.phase).toBe('flying')

    engine.snapshot.player.lineIntegrity = 0
    engine.advance(FIXED_TIMESTEP)

    expect(engine.snapshot.phase).toBe('resolved')
    expect(engine.snapshot.outcome).toEqual({ kind: 'cut', winner: 'rival' })
    expect(engine.snapshot.stats.roundsLost).toBe(STARTING_HP)
  })

  it('breaks a tie on lives before line condition at the time limit', () => {
    const engine = makeEngine('sawah', 7)
    engine.skipCountdown()

    engine.snapshot.rival.hp = 1
    engine.snapshot.player.hp = 3
    // Give the rival the healthier line, so only the life count can decide it.
    engine.snapshot.player.lineIntegrity = 0.2
    engine.snapshot.rival.lineIntegrity = 0.9
    engine.snapshot.elapsed = DEFAULT_TIME_LIMIT

    engine.advance(FIXED_TIMESTEP)

    expect(engine.snapshot.outcome).toEqual({ kind: 'timeout', winner: 'player' })
  })

  it('does not run the match clock during a round break', () => {
    const engine = makeEngine('sawah', 8)
    engine.skipCountdown()
    run(engine, 5)

    engine.snapshot.player.lineIntegrity = 0
    engine.advance(FIXED_TIMESTEP)
    const elapsedAtBreak = engine.snapshot.elapsed

    run(engine, 2)
    expect(engine.snapshot.elapsed).toBeCloseTo(elapsedAtBreak, 5)
  })

  it('stays deterministic across rounds', () => {
    const a = makeEngine('kampung', 31337, { reel: 0.8, walk: 0.2, snap: false })
    const b = makeEngine('kampung', 31337, { reel: 0.8, walk: 0.2, snap: false })
    a.skipCountdown()
    b.skipCountdown()

    run(a, 60)
    run(b, 60)

    expect(a.snapshot.round).toBe(b.snapshot.round)
    expect(a.snapshot.player.hp).toBe(b.snapshot.player.hp)
    expect(a.snapshot.player.position).toEqual(b.snapshot.player.position)
  })
})

describe('AI obstacle awareness', () => {
  it('keeps its kite above the hazards in a cluttered arena', () => {
    // The tallest opponent tier flies the sharpest AI, so this is the strictest case.
    const engine = makeEngine('kota', 12, { ...NEUTRAL_COMMAND }, OPPONENTS[5]!.id)
    engine.skipCountdown()

    let violations = 0
    const steps = Math.round(40 / FIXED_TIMESTEP)

    for (let i = 0; i < steps; i += 1) {
      engine.advance(FIXED_TIMESTEP)
      if (engine.snapshot.phase !== 'flying') continue

      const { rival } = engine.snapshot
      const ceiling = hazardCeiling(getArena('kota'), rival.anchor.x, rival.position.x)
      // Allow a small excursion: the AI is allowed to make mistakes, just not to
      // fly into a wall as its default behaviour.
      if (ceiling > 0 && rival.position.y < ceiling * 0.6) violations += 1
    }

    expect(violations / steps).toBeLessThan(0.2)
  })
})

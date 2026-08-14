import { describe, expect, it } from 'vitest'
import { createMatchEngine } from '~/services/game/engine'
import { getArena } from '~/data/arenas'
import { getOpponent } from '~/data/opponents'
import { emptyUpgradeLevels, normaliseUpgradeLevels } from '~/data/upgrades'
import {
  createRecorder,
  createReplayInput,
  decodeReplay,
  encodeReplay,
  ReplayFormatError,
  REPLAY_VERSION,
  type Replay,
} from '~/services/game/replay'
import { DEFAULT_TIME_LIMIT, FIXED_TIMESTEP } from '~/services/game/constants'
import type { InputSource } from '~/services/game/input/source'
import type { FighterCommand, MatchLoadout, OpponentId } from '~/services/game/types'

/**
 * Replays.
 *
 * The whole feature rests on one claim: a match is a pure function of its seed,
 * its setup and its command stream. These tests are what makes that claim
 * enforceable rather than aspirational — if anything in the engine starts reading
 * the clock or `Math.random()`, the round-trip test below goes red.
 */

const LOADOUT: MatchLoadout = {
  kiteId: 'pecut',
  paletteId: 'senja',
  patternId: 'plain',
  effectId: 'none',
  upgrades: emptyUpgradeLevels(),
}

/**
 * A scripted player that actually does something.
 *
 * A neutral stream would record a single run-length entry and prove nothing about
 * the encoding. This one hauls, walks, yanks and pauses on a fixed schedule, so the
 * recording has hundreds of changes across both axes.
 */
function scriptedPlayer(): InputSource {
  let step = 0
  const command: FighterCommand = { reel: 0, walk: 0, snap: false }

  return {
    kind: 'local',
    sample(): FighterCommand {
      step += 1
      const phase = Math.floor(step / 45) % 6

      command.reel = phase === 0 ? 1 : phase === 2 ? -0.6 : phase === 4 ? 0.3 : 0
      command.walk = phase === 1 ? -1 : phase === 3 ? 0.7 : 0
      command.snap = step % 600 === 0

      return command
    },
  }
}

interface RunOptions {
  seed?: number
  opponents?: OpponentId[]
  arenaId?: 'sawah' | 'kampung'
  input: InputSource
}

function runMatch({ seed = 20260814, opponents = ['bocah-sawah'], arenaId = 'sawah', input }: RunOptions) {
  const engine = createMatchEngine({
    config: {
      seed,
      opponents: opponents.map(getOpponent),
      player: LOADOUT,
      arena: getArena(arenaId),
      timeLimit: DEFAULT_TIME_LIMIT,
      difficultyScale: 1,
    },
    playerInput: input,
  })

  engine.skipCountdown()

  const limit = Math.round(200 / FIXED_TIMESTEP)
  let steps = 0
  while (engine.snapshot.phase !== 'resolved' && steps < limit) {
    engine.advance(FIXED_TIMESTEP)
    steps += 1
  }

  return engine.snapshot
}

function replayOf(seed: number, recorder: ReturnType<typeof createRecorder>, snapshot: ReturnType<typeof runMatch>): Replay {
  return {
    version: REPLAY_VERSION,
    seed,
    arenaId: 'sawah',
    opponentIds: ['bocah-sawah'],
    loadout: LOADOUT,
    difficultyScale: 1,
    timeLimit: DEFAULT_TIME_LIMIT,
    commands: recorder.commands.map(entry => [...entry] as [number, number, number, 0 | 1]),
    result: {
      kind: snapshot.outcome.kind,
      winner: snapshot.outcome.kind === 'pending' ? 'draw' : snapshot.outcome.winner,
      durationSeconds: snapshot.stats.durationSeconds,
      roundsWon: snapshot.stats.roundsWon,
      roundsLost: snapshot.stats.roundsLost,
    },
  }
}

describe('recording', () => {
  it('writes an entry only when the command changes', () => {
    const held: FighterCommand = { reel: 1, walk: 0, snap: false }
    const recorder = createRecorder({ kind: 'local', sample: () => held })

    for (let i = 0; i < 500; i += 1) recorder.sample({} as never)

    // Five hundred identical samples, one row.
    expect(recorder.commands).toHaveLength(1)
    expect(recorder.commands[0]).toEqual([0, 1, 0, 0])
    expect(recorder.length).toBe(500)
  })

  it('records the first sample even when it is neutral', () => {
    const recorder = createRecorder({ kind: 'local', sample: () => ({ reel: 0, walk: 0, snap: false }) })
    recorder.sample({} as never)

    // The stream has to start from something explicit, or playback before the
    // first entry would be undefined.
    expect(recorder.commands).toHaveLength(1)
  })

  it('passes the inner command through untouched', () => {
    const recorder = createRecorder({ kind: 'local', sample: () => ({ reel: 0.37, walk: -1, snap: true }) })
    // Quantisation is for storage; the live match must see the real value.
    expect(recorder.sample({} as never)).toEqual({ reel: 0.37, walk: -1, snap: true })
  })
})

describe('playback', () => {
  it('holds each command until the next change', () => {
    const replay = {
      commands: [[0, 1, 0, 0], [3, -1, 0.5, 1]],
    } as Replay
    const input = createReplayInput(replay)

    expect(input.sample({} as never)).toEqual({ reel: 1, walk: 0, snap: false })
    expect(input.sample({} as never)).toEqual({ reel: 1, walk: 0, snap: false })
    expect(input.sample({} as never)).toEqual({ reel: 1, walk: 0, snap: false })
    expect(input.sample({} as never)).toEqual({ reel: -1, walk: 0.5, snap: true })
    expect(input.sample({} as never)).toEqual({ reel: -1, walk: 0.5, snap: true })
  })

  it('holds the last command rather than throwing past the end', () => {
    const input = createReplayInput({ commands: [[0, 0.5, 0, 0]] } as Replay)
    for (let i = 0; i < 100; i += 1) input.sample({} as never)
    expect(input.sample({} as never)).toEqual({ reel: 0.5, walk: 0, snap: false })
  })
})

describe('a replay reproduces its match', () => {
  /**
   * The load-bearing test. Record a real match, replay the recorded stream through
   * a fresh engine, and require the same result down to the duration. This is what
   * a clock read or a stray `Math.random()` inside a step would break.
   */
  it('produces an identical outcome, duration and score', () => {
    const seed = 987654
    const recorder = createRecorder(scriptedPlayer())
    const original = runMatch({ seed, input: recorder })

    const replay = replayOf(seed, recorder, original)
    const replayed = runMatch({ seed, input: createReplayInput(replay) })

    expect(replayed.outcome).toEqual(original.outcome)
    expect(replayed.stats.durationSeconds).toBe(original.stats.durationSeconds)
    expect(replayed.stats.roundsWon).toBe(original.stats.roundsWon)
    expect(replayed.stats.roundsLost).toBe(original.stats.roundsLost)
    expect(replayed.round).toBe(original.round)
  })

  it('reproduces the kite down to its final position', () => {
    const seed = 555
    const recorder = createRecorder(scriptedPlayer())
    const original = runMatch({ seed, input: recorder })
    const expected = { ...original.player.position }

    const replayed = runMatch({ seed, input: createReplayInput(replayOf(seed, recorder, original)) })

    expect(replayed.player.position.x).toBeCloseTo(expected.x, 9)
    expect(replayed.player.position.y).toBeCloseTo(expected.y, 9)
  })

  it('survives the encode/decode round trip', () => {
    const seed = 42424
    const recorder = createRecorder(scriptedPlayer())
    const original = runMatch({ seed, input: recorder })

    const text = encodeReplay(replayOf(seed, recorder, original))
    const decoded = decodeReplay(text)
    const replayed = runMatch({ seed: decoded.seed, input: createReplayInput(decoded) })

    expect(replayed.outcome).toEqual(original.outcome)
    expect(replayed.stats.durationSeconds).toBe(original.stats.durationSeconds)
  })

  it('stays short enough to paste into a message', () => {
    const recorder = createRecorder(scriptedPlayer())
    const original = runMatch({ seed: 7, input: recorder })
    const text = encodeReplay(replayOf(7, recorder, original))

    // A scripted player changes command every 45 steps, which is far busier than
    // a person. Even so it has to stay in the low kilobytes.
    expect(text.length).toBeLessThan(8000)
  })
})

describe('encoding', () => {
  const sample: Replay = {
    version: REPLAY_VERSION,
    seed: 123456789,
    arenaId: 'kampung',
    opponentIds: ['bos-pasar', 'si-gelasan'],
    loadout: {
      kiteId: 'naga',
      paletteId: 'batik-indigo',
      patternId: 'kawung',
      effectId: 'bara',
      upgrades: normaliseUpgradeLevels({ 'line-strength': 3, 'gelasan': 2 }),
    },
    difficultyScale: 1.35,
    timeLimit: 45,
    commands: [[0, 0, 0, 0], [12, 1, -0.4, 1], [900, -1, 0.9, 0]],
    result: { kind: 'cut', winner: 0, durationSeconds: 31.25, roundsWon: 2, roundsLost: 1 },
  }

  it('round-trips every field', () => {
    const decoded = decodeReplay(encodeReplay(sample))

    expect(decoded.seed).toBe(sample.seed)
    expect(decoded.arenaId).toBe(sample.arenaId)
    expect(decoded.opponentIds).toEqual(sample.opponentIds)
    expect(decoded.loadout).toEqual(sample.loadout)
    expect(decoded.difficultyScale).toBe(sample.difficultyScale)
    expect(decoded.timeLimit).toBe(sample.timeLimit)
    expect(decoded.commands).toEqual(sample.commands)
    expect(decoded.result).toEqual(sample.result)
  })

  it('round-trips every quantised axis value', () => {
    const commands: [number, number, number, 0 | 1][] = []
    for (let reel = -10; reel <= 10; reel += 1) {
      // `+ 0` keeps -0 out of the expectation: it round-trips as 0, which is the
      // same value, but `toEqual` treats the two as different.
      commands.push([commands.length, reel / 10 + 0, -reel / 10 + 0, (reel % 2 === 0 ? 0 : 1)])
    }

    const decoded = decodeReplay(encodeReplay({ ...sample, commands }))
    expect(decoded.commands).toEqual(commands)
  })

  it('keeps the setup readable at the front of the string', () => {
    const text = encodeReplay(sample)
    // Someone looking at a pasted replay should be able to see what it is without
    // running anything.
    expect(text.startsWith('LYG1|')).toBe(true)
    expect(text).toContain('kampung')
    expect(text).toContain('bos-pasar,si-gelasan')
  })

  it('rejects a draw winner without mangling it', () => {
    const drawn = { ...sample, result: { ...sample.result!, winner: 'draw' as const } }
    expect(decodeReplay(encodeReplay(drawn)).result?.winner).toBe('draw')
  })

  it('clamps an upgrade level that a hand-edited string tried to inflate', () => {
    const text = encodeReplay(sample).replace('line-strength:3', 'line-strength:99')
    // The normaliser owns the ceiling, so a forged replay cannot grant a level
    // the shop does not sell.
    expect(decodeReplay(text).loadout.upgrades['line-strength']).toBeLessThan(99)
  })

  it('names the reason it refuses a string', () => {
    expect(() => decodeReplay('hello')).toThrow(ReplayFormatError)
    expect(() => decodeReplay('hello')).toThrow('not-a-replay')

    expect(() => decodeReplay('LYG99|a|b')).toThrow('wrong-version')
    expect(() => decodeReplay('LYG1|nonsense')).toThrow('malformed')
  })

  it('accepts a replay with no recorded result', () => {
    const decoded = decodeReplay(encodeReplay({ ...sample, result: null }))
    expect(decoded.result).toBeNull()
    expect(decoded.commands).toEqual(sample.commands)
  })
})

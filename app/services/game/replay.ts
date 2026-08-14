import { normaliseUpgradeLevels } from '~/data/upgrades'
import {
  NEUTRAL_COMMAND,
  type ArenaId,
  type FighterCommand,
  type MatchLoadout,
  type OpponentId,
  type UpgradeLevels,
} from './types'
import type { InputContext, InputSource } from './input/source'

/**
 * Match recording and playback.
 *
 * A match is already a pure function of `(seed, arena, loadout, opponents,
 * command stream)` — fixed 120 Hz steps, every random draw through
 * `createRandom(seed)`, and no wall-clock or `Math.random()` reads inside a step.
 * So a replay does not need to store any state at all: store those five things and
 * the match reconstructs itself exactly, including every decision the AI made.
 *
 * ## Why this is worth having
 * Two reasons, and the second is the real one:
 *
 * 1. Watching a match back.
 * 2. **It is the cheapest possible bug report.** A player who says "I keep losing"
 *    is describing a feeling; a replay string is the match itself. Paste it into a
 *    headless harness and the exact duel runs again, with every tension, crossing
 *    and command inspectable. Balance can then be argued from what happened rather
 *    than from what someone remembers happening.
 *
 * ## Counting steps
 * Commands are indexed by **how many times the input source has been sampled**,
 * not by the engine's step counter. The engine only samples inputs during the
 * `flying` phase, so the two differ — but a recorder and a player wrapped around
 * the same seam are called the same number of times in the same order, so they
 * align by construction. Nothing has to know how the engine schedules phases.
 *
 * ## Format
 * Run-length: an entry is written only when the command actually changes. A human
 * holds a key for hundreds of steps, so a 45-second match compresses from ~5,400
 * entries to a few hundred. Analogue values are quantised to one decimal, which is
 * finer than a person can hold a touch control anyway.
 */

/** Bumped whenever the encoding changes shape. Old strings are then rejected. */
export const REPLAY_VERSION = 1

/** Marker so a pasted string can be recognised before it is parsed. */
const MAGIC = 'LYG'

/** Analogue axes are stored to one decimal: 21 steps across −1..1. */
const AXIS_STEPS = 21

export interface ReplayResult {
  /** Outcome kind, as `MatchOutcome['kind']`. */
  kind: string
  /** Fighter index, or 'draw'. */
  winner: number | 'draw'
  durationSeconds: number
  roundsWon: number
  roundsLost: number
}

export interface Replay {
  version: number
  seed: number
  arenaId: ArenaId
  opponentIds: OpponentId[]
  loadout: MatchLoadout
  difficultyScale: number
  timeLimit: number
  /**
   * Command changes as `[sampleIndex, reel, walk, snap]`, ascending. The command
   * at any index is the last entry at or before it.
   */
  commands: [number, number, number, 0 | 1][]
  /**
   * What the match produced when it was recorded. Playback compares against this
   * — a mismatch means the replay is broken or the simulation has changed, and
   * either is worth knowing loudly.
   */
  result: ReplayResult | null
}

export interface ReplayRecorder extends InputSource {
  /** Everything recorded so far. Safe to read mid-match. */
  readonly commands: [number, number, number, 0 | 1][]
  /** How many samples have been taken. */
  readonly length: number
}

/**
 * Quantise an axis to one decimal in −1..1.
 *
 * The `+ 0` normalises `-0` to `0`. They compare equal, so nothing misbehaves
 * either way, but a recorded `-0` decodes back as `0` and the difference shows up
 * as a baffling diff the first time anyone compares a replay against its source.
 */
function quantise(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value))
  return Math.round(clamped * 10) / 10 + 0
}

/**
 * Wrap an input source and record what it produces.
 *
 * Recording wraps rather than replaces, so the thing being recorded is exactly the
 * thing the match is being played with — there is no second code path that could
 * drift from the real one.
 */
export function createRecorder(inner: InputSource): ReplayRecorder {
  const commands: [number, number, number, 0 | 1][] = []
  let index = 0
  let lastReel = 0
  let lastWalk = 0
  let lastSnap: 0 | 1 = 0

  return {
    kind: inner.kind,
    commands,

    get length(): number {
      return index
    },

    sample(context: InputContext): FighterCommand {
      const command = inner.sample(context)

      const reel = quantise(command.reel)
      const walk = quantise(command.walk)
      const snap: 0 | 1 = command.snap ? 1 : 0

      // Run-length: only a change is worth a row. The first sample always is one,
      // because the stream has to start from something explicit.
      if (index === 0 || reel !== lastReel || walk !== lastWalk || snap !== lastSnap) {
        commands.push([index, reel, walk, snap])
        lastReel = reel
        lastWalk = walk
        lastSnap = snap
      }

      index += 1
      return command
    },

    dispose(): void {
      inner.dispose?.()
    },
  }
}

/**
 * Play a recorded command stream back.
 *
 * Runs out gracefully: past the end of the recording the fighter holds neutral
 * rather than throwing, so a truncated replay still shows what it has.
 */
export function createReplayInput(replay: Replay): InputSource {
  const command: FighterCommand = { ...NEUTRAL_COMMAND }
  let index = 0
  let cursor = 0

  return {
    kind: 'local',

    sample(): FighterCommand {
      // Advance to the last entry at or before this sample.
      while (
        cursor < replay.commands.length
        && (replay.commands[cursor] as [number, number, number, 0 | 1])[0] <= index
      ) {
        const entry = replay.commands[cursor] as [number, number, number, 0 | 1]
        command.reel = entry[1]
        command.walk = entry[2]
        command.snap = entry[3] === 1
        cursor += 1
      }

      index += 1
      return command
    },
  }
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/**
 * Pack a command into a single integer.
 *
 * 21 reel positions × 21 walk positions × 2 snap states = 882 values, which is
 * three base-36 digits at most and usually two.
 */
function packCommand(reel: number, walk: number, snap: 0 | 1): number {
  const reelIndex = Math.round(reel * 10) + 10
  const walkIndex = Math.round(walk * 10) + 10
  return (reelIndex * AXIS_STEPS + walkIndex) * 2 + snap
}

function unpackCommand(packed: number): [number, number, 0 | 1] {
  const snap = (packed % 2) as 0 | 1
  const axes = (packed - snap) / 2
  const walkIndex = axes % AXIS_STEPS
  const reelIndex = (axes - walkIndex) / AXIS_STEPS
  return [(reelIndex - 10) / 10, (walkIndex - 10) / 10, snap]
}

/** Upgrade levels as `id:level` pairs, omitting zeroes. */
function packUpgrades(upgrades: UpgradeLevels): string {
  return Object.entries(upgrades)
    .filter(([, level]) => typeof level === 'number' && level > 0)
    .map(([id, level]) => `${id}:${level}`)
    .join(',')
}

function unpackUpgrades(text: string): UpgradeLevels {
  const levels: Partial<UpgradeLevels> = {}

  if (text.length > 0) {
    for (const pair of text.split(',')) {
      const [id, level] = pair.split(':')
      if (id && level) levels[id as keyof UpgradeLevels] = Number(level)
    }
  }

  // Through the real normaliser rather than a cast: it fills every missing slot
  // and clamps to each upgrade's own maximum, so a hand-edited replay string
  // cannot smuggle in a level the shop would never sell.
  return normaliseUpgradeLevels(levels)
}

/**
 * Encode a replay as a single pasteable line.
 *
 * Deliberately plain text rather than compressed base64: a replay is something a
 * player copies out of a dialog and pastes into a message, and text that a human
 * can eyeball — the seed, the arena, the opponents are all readable at the front —
 * is easier to trust and far easier to debug than an opaque blob. The command
 * stream is the only dense part, and run-length keeps it to a few hundred entries.
 */
export function encodeReplay(replay: Replay): string {
  const commands = replay.commands
    .map(([index, reel, walk, snap]) =>
      `${index.toString(36)}.${packCommand(reel, walk, snap).toString(36)}`)
    .join('-')

  const result = replay.result
    ? [
        replay.result.kind,
        String(replay.result.winner),
        replay.result.durationSeconds.toFixed(2),
        String(replay.result.roundsWon),
        String(replay.result.roundsLost),
      ].join(',')
    : ''

  return [
    `${MAGIC}${replay.version}`,
    replay.seed.toString(36),
    replay.arenaId,
    replay.opponentIds.join(','),
    [
      replay.loadout.kiteId,
      replay.loadout.paletteId,
      replay.loadout.patternId,
      replay.loadout.effectId,
    ].join(','),
    packUpgrades(replay.loadout.upgrades),
    replay.difficultyScale.toFixed(2),
    replay.timeLimit.toFixed(0),
    result,
    commands,
  ].join('|')
}

export class ReplayFormatError extends Error {}

/**
 * Parse an encoded replay.
 *
 * Throws `ReplayFormatError` with a specific reason rather than returning null:
 * the caller shows the reason to whoever pasted it, and "this is from a newer
 * version" is a very different message from "this is not a replay".
 */
export function decodeReplay(text: string): Replay {
  const trimmed = text.trim()
  if (!trimmed.startsWith(MAGIC)) throw new ReplayFormatError('not-a-replay')

  const parts = trimmed.split('|')

  // Version before shape. A replay from another version very likely has a
  // different number of fields, and telling someone their replay is "malformed"
  // when it is simply from a newer build sends them looking for the wrong problem.
  const version = Number((parts[0] as string).slice(MAGIC.length))
  if (!Number.isFinite(version)) throw new ReplayFormatError('not-a-replay')
  if (version !== REPLAY_VERSION) throw new ReplayFormatError('wrong-version')

  if (parts.length !== 10) throw new ReplayFormatError('malformed')

  const seed = Number.parseInt(parts[1] as string, 36)
  if (!Number.isFinite(seed)) throw new ReplayFormatError('malformed')

  const opponentIds = (parts[3] as string).split(',').filter(Boolean) as OpponentId[]
  if (opponentIds.length === 0) throw new ReplayFormatError('malformed')

  const [kiteId, paletteId, patternId, effectId] = (parts[4] as string).split(',')
  if (!kiteId || !paletteId || !patternId || !effectId) {
    throw new ReplayFormatError('malformed')
  }

  const resultText = parts[8] as string
  let result: ReplayResult | null = null
  if (resultText.length > 0) {
    const [kind, winner, duration, won, lost] = resultText.split(',')
    result = {
      kind: kind ?? 'pending',
      winner: winner === 'draw' ? 'draw' : Number(winner),
      durationSeconds: Number(duration),
      roundsWon: Number(won),
      roundsLost: Number(lost),
    }
  }

  const commandText = parts[9] as string
  const commands: [number, number, number, 0 | 1][] = []
  if (commandText.length > 0) {
    for (const entry of commandText.split('-')) {
      const [indexText, packedText] = entry.split('.')
      if (indexText === undefined || packedText === undefined) {
        throw new ReplayFormatError('malformed')
      }

      const index = Number.parseInt(indexText, 36)
      const packed = Number.parseInt(packedText, 36)
      if (!Number.isFinite(index) || !Number.isFinite(packed)) {
        throw new ReplayFormatError('malformed')
      }

      const [reel, walk, snap] = unpackCommand(packed)
      commands.push([index, reel, walk, snap])
    }
  }

  return {
    version,
    seed,
    arenaId: parts[2] as ArenaId,
    opponentIds,
    loadout: {
      kiteId: kiteId as MatchLoadout['kiteId'],
      paletteId: paletteId as MatchLoadout['paletteId'],
      patternId: patternId as MatchLoadout['patternId'],
      effectId: effectId as MatchLoadout['effectId'],
      upgrades: unpackUpgrades(parts[5] as string),
    },
    difficultyScale: Number(parts[6]),
    timeLimit: Number(parts[7]),
    commands,
    result,
  }
}

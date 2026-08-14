import { describe, expect, it } from 'vitest'
import { createMatchEngine } from '~/services/game/engine'
import { getArena } from '~/data/arenas'
import { OPPONENTS } from '~/data/opponents'
import { createReplayInput, decodeReplay } from '~/services/game/replay'
import { contactPressure, exchangeAdvantage } from '~/services/game/physics/combat'
import { breakingTension } from '~/services/game/physics/fighter'
import { FIXED_TIMESTEP } from '~/services/game/constants'
import type { OpponentDefinition } from '~/services/game/types'

/**
 * Replay inspector.
 *
 * Not part of the suite — it lives outside `tests/` and is run on demand:
 *
 *     REPLAY='LYG1|…' pnpm replay
 *
 * Feed it a string a player copied out of the result screen and it replays that
 * exact match headlessly, printing what actually happened second by second. This
 * is the tool that turns "I keep losing" into something answerable: the duel
 * itself, with every tension, crossing and command visible, rather than a memory
 * of it.
 *
 * Skips silently when `REPLAY` is unset, so it is harmless if it ever gets swept
 * into a wider run.
 */

const source = process.env.REPLAY ?? ''

describe.skipIf(source.trim().length === 0)('replay inspector', () => {
  it('replays and reports', () => {
    const replay = decodeReplay(source)

    const cast = replay.opponentIds
      .map(id => OPPONENTS.find(entry => entry.id === id))
      .filter((entry): entry is OpponentDefinition => entry !== undefined)

    expect(cast, 'every opponent in the replay must exist in this build').toHaveLength(
      replay.opponentIds.length,
    )

    const engine = createMatchEngine({
      config: {
        seed: replay.seed,
        opponents: cast,
        player: replay.loadout,
        arena: getArena(replay.arenaId),
        timeLimit: replay.timeLimit,
        difficultyScale: replay.difficultyScale,
      },
      playerInput: createReplayInput(replay),
    })

    engine.skipCountdown()

    const lines: string[] = []
    lines.push('=== setup ===')
    lines.push(`seed        ${replay.seed}`)
    lines.push(`field       ${replay.arenaId}`)
    lines.push(`opponents   ${replay.opponentIds.join(', ')}`)
    lines.push(`kite        ${replay.loadout.kiteId}`)
    lines.push(`upgrades    ${JSON.stringify(replay.loadout.upgrades)}`)
    lines.push(`difficulty  ${replay.difficultyScale}`)
    lines.push(`commands    ${replay.commands.length} change(s)`)
    if (replay.result) lines.push(`recorded    ${JSON.stringify(replay.result)}`)

    const { player } = engine.snapshot
    const breaking = breakingTension(player.stats)

    /** Per-second aggregates, which is the resolution a person can reason about. */
    let bucket = 0
    let steps = 0
    let contactSteps = 0
    let loadSum = 0
    let advantageSum = 0
    let pressureSum = 0
    let overloadSteps = 0
    let snagSteps = 0
    let haulSteps = 0
    let walkSteps = 0

    lines.push('')
    lines.push('=== second by second ===')
    // `snag` is here because the first replay this tool ever read lost both lives
    // to arena cables with zero opponent contact — without the column that is
    // invisible, and the report looks like a duel that simply never happened.
    lines.push('  t  round  hp  line  load  adv  contact  press  overload  snag  haul  walk')

    const flush = (): void => {
      if (steps === 0) return
      lines.push(
        [
          String(bucket).padStart(3),
          String(engine.snapshot.round).padStart(6),
          `${player.hp}/${engine.snapshot.rival.hp}`.padStart(4),
          player.lineIntegrity.toFixed(2).padStart(5),
          (loadSum / steps).toFixed(2).padStart(5),
          (advantageSum / steps).toFixed(2).padStart(4),
          `${Math.round((contactSteps / steps) * 100)}%`.padStart(8),
          (contactSteps > 0 ? pressureSum / contactSteps : 0).toFixed(3).padStart(6),
          `${Math.round((overloadSteps / steps) * 100)}%`.padStart(9),
          `${Math.round((snagSteps / steps) * 100)}%`.padStart(5),
          `${Math.round((haulSteps / steps) * 100)}%`.padStart(5),
          `${Math.round((walkSteps / steps) * 100)}%`.padStart(5),
        ].join(' '),
      )

      steps = 0
      contactSteps = 0
      loadSum = 0
      advantageSum = 0
      pressureSum = 0
      overloadSteps = 0
      snagSteps = 0
      haulSteps = 0
      walkSteps = 0
    }

    const limit = Math.round(300 / FIXED_TIMESTEP)
    let executed = 0
    const events: string[] = []
    let lastRound = 1
    let lastPlayerHp = player.hp

    while (engine.snapshot.phase !== 'resolved' && executed < limit) {
      engine.advance(FIXED_TIMESTEP)
      executed += 1

      const second = Math.floor(engine.snapshot.elapsed)
      if (second !== bucket) {
        flush()
        bucket = second
      }

      if (engine.snapshot.phase !== 'flying') continue

      steps += 1
      loadSum += player.tension / breaking
      advantageSum += exchangeAdvantage(player, engine.snapshot.rival)
      if (player.tension / breaking >= 1) overloadSteps += 1
      if (player.snagged) snagSteps += 1
      if (player.reelRate > 0.2) haulSteps += 1
      if (Math.abs(player.velocity.x) > 0.01) walkSteps += 1

      const contact = engine.snapshot.clashes.filter(clash => clash.kind === 'line')
      if (contact.length > 0) {
        contactSteps += 1
        pressureSum += contactPressure(player, engine.snapshot.rival)
      }

      if (engine.snapshot.round !== lastRound) {
        events.push(
          `t=${engine.snapshot.elapsed.toFixed(1)}s  round ${lastRound} ended: `
          + `${engine.snapshot.lastRound?.loserIsPlayer ? 'you lost it' : 'you won it'} `
          + `(${engine.snapshot.lastRound?.reason})`,
        )
        lastRound = engine.snapshot.round
      }

      if (player.hp !== lastPlayerHp) {
        events.push(`t=${engine.snapshot.elapsed.toFixed(1)}s  your lives: ${player.hp}`)
        lastPlayerHp = player.hp
      }
    }

    flush()

    lines.push('')
    lines.push('=== events ===')
    for (const event of events) lines.push(event)

    lines.push('')
    lines.push('=== result ===')
    lines.push(`outcome     ${JSON.stringify(engine.snapshot.outcome)}`)
    lines.push(`duration    ${engine.snapshot.stats.durationSeconds.toFixed(2)}s`)
    lines.push(`rounds      won ${engine.snapshot.stats.roundsWon}, lost ${engine.snapshot.stats.roundsLost}`)
    lines.push(`contact     ${engine.snapshot.stats.clashSeconds.toFixed(1)}s`)
    lines.push(`peak load   ${(engine.snapshot.stats.peakTension / breaking).toFixed(2)} of breaking`)
    lines.push(`peak alt    ${engine.snapshot.stats.peakAltitude.toFixed(1)} m`)
    lines.push(`yanks       ${engine.snapshot.stats.snapsUsed}`)

    if (replay.result) {
      const matched
        = replay.result.kind === engine.snapshot.outcome.kind
          && Math.abs(replay.result.durationSeconds - engine.snapshot.stats.durationSeconds) <= 0.01
      lines.push(`reproduced  ${matched ? 'yes' : 'NO — the simulation has changed since'}`)
    }

    console.log(`\n${lines.join('\n')}\n`)
  }, 120_000)
})

import { describe, expect, it } from 'vitest'
import { betterKiteFor, buildBriefing, isOutgeared } from '~/services/game/briefing'
import { getArena } from '~/data/arenas'
import { getOpponent } from '~/data/opponents'
import { normaliseUpgradeLevels } from '~/data/upgrades'
import type { MatchLoadout } from '~/services/game/types'

/**
 * The pre-match brief.
 *
 * Its whole value is that it is derived rather than written, so it can never claim
 * something the simulation does not do — and it changes when the player's gear
 * changes, which is what makes it an answer to "how do I beat someone stronger than
 * me" rather than a page of general advice.
 *
 * These tests hold the two properties that matter: the advice must follow the
 * numbers, and the two fundamentals must always be there.
 */

function loadout(kiteId: MatchLoadout['kiteId'], upgrades: Record<string, number> = {}): MatchLoadout {
  return {
    kiteId,
    paletteId: 'senja',
    patternId: 'plain',
    effectId: 'none',
    upgrades: normaliseUpgradeLevels(upgrades),
  }
}

const OPEN_FIELD = getArena('sawah')

function brief(player: MatchLoadout, opponentId: Parameters<typeof getOpponent>[0]) {
  return buildBriefing({
    player,
    opponent: getOpponent(opponentId),
    windMultiplier: OPEN_FIELD.windMultiplier,
    gustMultiplier: OPEN_FIELD.gustMultiplier,
  })
}

const keysOf = (points: ReturnType<typeof brief>): string[] => points.map(point => point.key)

describe('the fundamentals are never left out', () => {
  it('leads with walking, then hauling, then the yank, for every opponent', () => {
    for (const id of ['bocah-sawah', 'juara-lorong', 'bos-pasar', 'naga-senja'] as const) {
      const keys = keysOf(brief(loadout('pecut'), id))

      /**
       * The order is measured. Isolated against the first three opponents with no
       * upgrades: walking alone wins 9 of 10 at tier 1, hauling alone wins 0, and
       * tier 2 needs all three (9 of 10 with the yank, 0 without). An earlier version
       * led with hauling, from a cumulative table that could not separate the two.
       */
      expect(keys.slice(0, 3), id).toEqual(['walk', 'haul', 'yank'])
    }
  })

  it('marks all three as core advice rather than as matchup detail', () => {
    const points = brief(loadout('pecut'), 'bos-pasar')
    expect(points.filter(point => point.kind === 'core').map(point => point.key))
      .toEqual(['walk', 'haul', 'yank'])
  })
})

describe('the advice follows the gear', () => {
  it('warns about a weaker line, and stops once the line is upgraded', () => {
    const bare = keysOf(brief(loadout('pecut'), 'naga-senja'))
    expect(bare).toContain('weakerLine')

    // The same fight after buying the line upgrades out: the warning has to go,
    // or the brief is telling a lie about gear the player now has.
    const kitted = keysOf(brief(loadout('naga', { 'line-strength': 5, 'gelasan': 5 }), 'naga-senja'))
    expect(kitted).not.toContain('weakerLine')
  })

  it('tells a better-equipped player that a grind is now theirs to win', () => {
    const keys = keysOf(brief(loadout('naga', { 'line-strength': 5 }), 'bocah-sawah'))
    expect(keys).toContain('strongerLine')
    expect(keys).not.toContain('weakerLine')
  })

  it('never claims both sides of the same comparison', () => {
    for (const id of ['bocah-sawah', 'anak-kampung', 'juara-lorong', 'bos-pasar', 'si-gelasan', 'sultan-angin', 'raja-sawangan', 'naga-senja'] as const) {
      for (const player of [loadout('pecut'), loadout('naga', { 'line-strength': 5, 'gelasan': 5 })]) {
        const keys = keysOf(brief(player, id))

        for (const [a, b] of [
          ['weakerLine', 'strongerLine'],
          ['weakerGelasan', 'strongerGelasan'],
          ['nimbler', 'slower'],
        ]) {
          expect(keys.includes(a as string) && keys.includes(b as string), `${id}: ${a} + ${b}`)
            .toBe(false)
        }
      }
    }
  })

  it('reads the steering rates off the airframes', () => {
    // A delta steers at 4.4; the bebean the tier-4 boss flies steers at 2.6.
    const points = brief(loadout('delta'), 'bos-pasar')
    const nimbler = points.find(point => point.key === 'nimbler')

    expect(nimbler).toBeDefined()
    expect(nimbler?.values?.mine).toBe('4.4')
    expect(nimbler?.values?.theirs).toBe('2.6')
  })

  it('warns about gusty air where the arena and the opponent make it gusty', () => {
    // The last boss flies the gustiest afternoon on the ladder.
    expect(keysOf(brief(loadout('pecut'), 'naga-senja'))).toContain('gusty')
    // The first fight is deliberately steady air.
    expect(keysOf(brief(loadout('pecut'), 'bocah-sawah'))).not.toContain('gusty')
  })

  it('describes how the opponent fights from its own profile', () => {
    // si-gelasan is aggression 0.85, caution 0.15: it commits and does not retreat.
    const reckless = keysOf(brief(loadout('pecut'), 'si-gelasan'))
    expect(reckless).toContain('committed')
    expect(reckless).not.toContain('cagey')

    // sultan-angin is caution 0.45: it breaks off when it is losing.
    expect(keysOf(brief(loadout('pecut'), 'sultan-angin'))).toContain('cagey')
  })

  it('says a beginner makes mistakes and a boss does not', () => {
    expect(keysOf(brief(loadout('pecut'), 'bocah-sawah'))).toContain('sloppy')
    expect(keysOf(brief(loadout('pecut'), 'naga-senja'))).not.toContain('sloppy')
  })
})

describe('pointing at a better airframe', () => {
  /**
   * The measurement that motivated this: a player flying a sawangan against the
   * tier-7 boss — same airframe, comparable upgrades — lost 0 of 6, and the same
   * player on a naga won 8 of 8. Nothing in the game said the kite was the problem.
   */
  it('suggests a kite already owned when it is a better matchup', () => {
    const suggestion = betterKiteFor({
      player: loadout('sawangan', { 'line-strength': 4, 'gelasan': 3 }),
      opponent: getOpponent('raja-sawangan'),
      windMultiplier: 1,
      gustMultiplier: 1,
      ownedKiteIds: ['pecut', 'sawangan', 'naga'],
    })

    expect(suggestion).toBe('naga')
  })

  it('stays quiet when the equipped kite is already the best owned', () => {
    expect(betterKiteFor({
      player: loadout('naga'),
      opponent: getOpponent('raja-sawangan'),
      windMultiplier: 1,
      gustMultiplier: 1,
      ownedKiteIds: ['pecut', 'sawangan', 'naga'],
    })).toBeNull()
  })

  it('never suggests a kite the player does not own', () => {
    const suggestion = betterKiteFor({
      player: loadout('pecut'),
      opponent: getOpponent('naga-senja'),
      windMultiplier: 1,
      gustMultiplier: 1,
      ownedKiteIds: ['pecut'],
    })

    expect(suggestion).toBeNull()
  })
})

describe('gear parity against a sharper flyer', () => {
  it('warns that level gear loses to a boss', () => {
    // Mirror match against the tier-7 boss: the stat comparisons find nothing, so
    // without this the brief would read as "evenly matched" on a fight measured at
    // 0 wins in 6.
    const keys = keysOf(brief(loadout('sawangan', { 'line-strength': 4, 'gelasan': 3 }), 'raja-sawangan'))
    expect(keys).toContain('needEdge')
  })

  it('does not warn once the player has a real edge', () => {
    const keys = keysOf(brief(loadout('naga', { 'line-strength': 6, 'gelasan': 6 }), 'raja-sawangan'))
    expect(keys).not.toContain('needEdge')
  })

  it('does not warn about a beginner, whose reactions are slow', () => {
    expect(keysOf(brief(loadout('pecut'), 'bocah-sawah'))).not.toContain('needEdge')
  })
})

describe('being out-geared', () => {
  it('is true for a starter kite against the last boss', () => {
    expect(isOutgeared({
      player: loadout('pecut'),
      opponent: getOpponent('naga-senja'),
      windMultiplier: 1,
      gustMultiplier: 1,
    })).toBe(true)
  })

  it('is false once the player has bought their way up', () => {
    expect(isOutgeared({
      player: loadout('naga', { 'line-strength': 5, 'gelasan': 5 }),
      opponent: getOpponent('bocah-sawah'),
      windMultiplier: 1,
      gustMultiplier: 1,
    })).toBe(false)
  })
})

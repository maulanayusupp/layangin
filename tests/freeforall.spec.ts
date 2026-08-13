import { describe, expect, it } from 'vitest'
import { createMatchEngine } from '~/services/game/engine'
import { getArena } from '~/data/arenas'
import { OPPONENTS, getOpponent } from '~/data/opponents'
import { emptyUpgradeLevels } from '~/data/upgrades'
import { availableLineupSizes, lineupFor } from '~/services/game/lineup'
import {
  ANCHOR_SPACING,
  DEFAULT_TIME_LIMIT,
  FIXED_TIMESTEP,
  MAX_FIGHTERS,
  ROUND_BREAK,
  STARTING_HP,
  anchorsFor,
  walkBoundFor,
} from '~/services/game/constants'
import { NEUTRAL_COMMAND, PLAYER_INDEX, type OpponentId } from '~/services/game/types'
import type { InputSource } from '~/services/game/input/source'

/**
 * Free-for-all matches — three or four flyers in one sky.
 *
 * The engine is written against a fighter list rather than a player/rival pair, so
 * these tests pin the parts of that generalisation a duel cannot exercise: the
 * anchor spread, opponents cutting *each other*, elimination, and the rule that the
 * player's own cut ends the round even with opponents still flying.
 */

const passive: InputSource = { kind: 'local', sample: () => NEUTRAL_COMMAND }

function makeEngine(opponentIds: readonly OpponentId[], seed = 7) {
  return createMatchEngine({
    config: {
      seed,
      opponents: opponentIds.map(getOpponent),
      player: {
        kiteId: 'pecut',
        paletteId: 'senja',
        patternId: 'plain',
        effectId: 'none',
        upgrades: emptyUpgradeLevels(),
      },
      // Open field: isolates the crowd from arena hazards.
      arena: getArena('sawah'),
      timeLimit: DEFAULT_TIME_LIMIT,
      difficultyScale: 1,
    },
    playerInput: passive,
  })
}

describe('anchor spread', () => {
  it('keeps a duel exactly where it always stood', () => {
    expect(anchorsFor(2)).toEqual([-7, 7])
  })

  it('widens the field rather than crowding the same span', () => {
    expect(anchorsFor(3)).toEqual([-ANCHOR_SPACING, 0, ANCHOR_SPACING])
    expect(anchorsFor(4)).toEqual([-21, -7, 7, 21])
  })

  it('gives the outer flyers room to walk past each other', () => {
    // A four-way anchors at ±21, so the duel's 26 m bound would pin them.
    expect(walkBoundFor(4)).toBeGreaterThan(21)
    expect(walkBoundFor(4)).toBeGreaterThan(walkBoundFor(2))
  })
})

describe('a crowded sky', () => {
  it('puts every fighter in the air with the player first', () => {
    const engine = makeEngine(['bocah-sawah', 'anak-kampung', 'juara-lorong'])
    const { fighters } = engine.snapshot

    expect(fighters).toHaveLength(4)
    expect(fighters[0]).toBe(engine.snapshot.player)
    expect(fighters[0]!.side).toBe('player')
    expect(fighters.slice(1).every(fighter => fighter.side === 'rival')).toBe(true)
    expect(fighters.map(fighter => fighter.index)).toEqual([0, 1, 2, 3])
  })

  it('names each opponent so the HUD can label them', () => {
    const engine = makeEngine(['bocah-sawah', 'anak-kampung'])
    expect(engine.snapshot.fighters.map(fighter => fighter.opponentId))
      .toEqual([null, 'bocah-sawah', 'anak-kampung'])
  })

  it('refuses to run without an opponent', () => {
    expect(() => makeEngine([])).toThrow()
  })

  it('never fields more than the sky holds', () => {
    // Five requested, four allowed — the extra is dropped rather than crammed in.
    const engine = makeEngine([
      'bocah-sawah', 'anak-kampung', 'juara-lorong', 'bos-pasar', 'si-gelasan',
    ])
    expect(engine.snapshot.fighters).toHaveLength(MAX_FIGHTERS)
  })

  it('keeps everyone flying through a whole match under neutral input', () => {
    const engine = makeEngine(['bocah-sawah', 'anak-kampung'])
    engine.skipCountdown()

    let lowest = Infinity
    const steps = Math.round(20 / FIXED_TIMESTEP)

    for (let i = 0; i < steps; i += 1) {
      engine.advance(FIXED_TIMESTEP)
      if (engine.snapshot.phase !== 'flying') continue
      for (const fighter of engine.snapshot.fighters) {
        if (fighter.alive) lowest = Math.min(lowest, fighter.position.y)
      }
    }

    // Nobody sank into the ground: the launch and the AI both scale past two.
    expect(lowest).toBeGreaterThan(5)
  })
})

describe('rivals fight each other', () => {
  it('lets an opponent be cut by someone other than the player', () => {
    const engine = makeEngine(['juara-lorong', 'bos-pasar', 'si-gelasan'], 11)
    engine.skipCountdown()

    // Cut opponent 1 down to nothing: whoever is nearest will finish it, and it is
    // not the player, who is standing at the far end doing nothing.
    const victim = engine.snapshot.fighters[1]!
    engine.snapshot.fighters[2]!.lineIntegrity = 1

    victim.lineIntegrity = 0.0005

    const steps = Math.round(6 / FIXED_TIMESTEP)
    for (let i = 0; i < steps; i += 1) {
      engine.advance(FIXED_TIMESTEP)
      if (victim.hp < STARTING_HP) break
    }

    expect(victim.hp).toBeLessThan(STARTING_HP)
    // The player kept both lives: the loss was not theirs.
    expect(engine.snapshot.player.hp).toBe(STARTING_HP)
    expect(engine.snapshot.stats.roundsWon).toBeGreaterThan(0)
  })

  it('ends the round when the player goes out, even with opponents still flying', () => {
    const engine = makeEngine(['bocah-sawah', 'anak-kampung'])
    engine.skipCountdown()
    engine.advance(FIXED_TIMESTEP)

    engine.snapshot.player.lineIntegrity = 0
    engine.snapshot.player.alive = false
    engine.advance(FIXED_TIMESTEP)

    // A life gone, a pause opened — not a match spent watching two AI flyers.
    expect(engine.snapshot.player.hp).toBe(STARTING_HP - 1)
    expect(engine.snapshot.phase).toBe('roundOver')
  })
})

describe('elimination', () => {
  it('takes an opponent out of the match once its lives are gone, and relaunches the rest', () => {
    const engine = makeEngine(['bocah-sawah', 'anak-kampung'])
    engine.skipCountdown()
    engine.advance(FIXED_TIMESTEP)

    const doomed = engine.snapshot.fighters[1]!
    doomed.hp = 1
    doomed.lineIntegrity = 0
    doomed.alive = false

    engine.advance(FIXED_TIMESTEP)
    expect(doomed.eliminated).toBe(true)

    /**
     * The round carries on: the player and the other opponent are both still flying,
     * so there is a fight left to have. Only the player's own cut, or running out of
     * contenders, closes a round.
     */
    expect(engine.snapshot.phase).toBe('flying')

    // The eliminated kite keeps falling instead of hanging frozen in the sky.
    const startedAt = doomed.position.y
    for (let i = 0; i < Math.round(1 / FIXED_TIMESTEP); i += 1) {
      engine.advance(FIXED_TIMESTEP)
    }
    expect(doomed.position.y).toBeLessThan(startedAt)

    // Force the round to close, then run out the pause: the survivors relaunch.
    engine.snapshot.player.lineIntegrity = 0
    engine.snapshot.player.alive = false
    engine.advance(FIXED_TIMESTEP)
    expect(engine.snapshot.phase).toBe('roundOver')

    const steps = Math.round((ROUND_BREAK + 0.1) / FIXED_TIMESTEP)
    for (let i = 0; i < steps; i += 1) engine.advance(FIXED_TIMESTEP)

    expect(engine.snapshot.phase).toBe('flying')
    expect(engine.snapshot.player.alive).toBe(true)
    expect(engine.snapshot.fighters[2]!.alive).toBe(true)
    expect(doomed.alive).toBe(false)
    expect(doomed.position.y).toBe(0)
  })

  it('resolves in the player\'s favour only once every opponent is out', () => {
    const engine = makeEngine(['bocah-sawah', 'anak-kampung'])
    engine.skipCountdown()
    engine.advance(FIXED_TIMESTEP)

    for (const fighter of engine.snapshot.fighters.slice(1)) {
      fighter.hp = 1
      fighter.lineIntegrity = 0
      fighter.alive = false
    }

    engine.advance(FIXED_TIMESTEP)
    expect(engine.snapshot.phase).toBe('falling')

    // Let the cut kites come down; the result is held back until they land.
    const steps = Math.round(8 / FIXED_TIMESTEP)
    for (let i = 0; i < steps; i += 1) {
      engine.advance(FIXED_TIMESTEP)
      if (engine.snapshot.phase === 'resolved') break
    }

    expect(engine.snapshot.outcome).toEqual({ kind: 'cut', winner: PLAYER_INDEX })
    expect(engine.snapshot.stats.opponentsBeaten).toBe(2)
  })
})

describe('lineups', () => {
  const unlocked = OPPONENTS.slice(0, 4)

  it('returns just the chosen opponent for a duel', () => {
    const primary = getOpponent('anak-kampung')
    expect(lineupFor(primary, 1, unlocked)).toEqual([primary])
  })

  it('drafts the nearest tiers, so a boss does not turn up beside a beginner', () => {
    const primary = getOpponent('anak-kampung')
    const lineup = lineupFor(primary, 3, OPPONENTS)

    expect(lineup[0]).toBe(primary)
    expect(lineup).toHaveLength(3)
    for (const extra of lineup.slice(1)) {
      expect(Math.abs(extra.tier - primary.tier)).toBeLessThanOrEqual(2)
    }
  })

  it('never drafts the same opponent twice', () => {
    const primary = getOpponent('bocah-sawah')
    const ids = lineupFor(primary, 3, OPPONENTS).map(opponent => opponent.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('falls back to what is unlocked rather than padding the field', () => {
    const primary = getOpponent('bocah-sawah')
    // Only the first rung is unlocked: a three-way cannot be filled.
    expect(lineupFor(primary, 3, [primary])).toEqual([primary])
  })

  it('only offers formats the unlocked ladder can fill', () => {
    expect(availableLineupSizes(null, OPPONENTS.slice(0, 1))).toEqual([1])
    expect(availableLineupSizes(null, OPPONENTS.slice(0, 2))).toEqual([1, 2])
    expect(availableLineupSizes(null, OPPONENTS.slice(0, 3))).toEqual([1, 2, 3])
  })
})

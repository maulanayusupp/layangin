import { describe, expect, it } from 'vitest'
import { CHALLENGES, CHALLENGES_PER_DAY, getChallenge, type ChallengeContext } from '~/data/challenges'
import { challengeDay, challengesFor, evaluateChallenges } from '~/services/economy/challenges'
import { getArena } from '~/data/arenas'
import { getOpponent } from '~/data/opponents'
import { PLAYER_INDEX, type ChallengeId, type MatchStats } from '~/services/game/types'

/**
 * Challenges.
 *
 * Two properties carry the whole feature, and both are promises to the player that
 * the code has to actually keep:
 *
 * 1. **Nothing expires.** The trio rotates by date, which looks exactly like a daily
 *    quest — and daily quests punish you for having a life. These must not.
 * 2. **Everything is checked, never claimed.** Each one is a predicate over what the
 *    engine recorded, so a losing match cannot satisfy one and neither can a UI bug.
 */

const STATS: MatchStats = {
  durationSeconds: 30,
  clashSeconds: 8,
  peakTension: 100,
  snapsUsed: 2,
  peakAltitude: 55,
  roundsWon: 3,
  roundsLost: 1,
  opponentsBeaten: 1,
}

function context(overrides: Partial<ChallengeContext> = {}): ChallengeContext {
  return {
    outcome: { kind: 'cut', winner: PLAYER_INDEX },
    stats: { ...STATS },
    arena: getArena('sawah'),
    opponents: [getOpponent('bocah-sawah')],
    peakLoad: 0.6,
    ...overrides,
  }
}

describe('nothing expires', () => {
  it('offers a stable trio for a given day', () => {
    const first = challengesFor('2026-08-18', []).map(entry => entry.id)
    const again = challengesFor('2026-08-18', []).map(entry => entry.id)

    expect(first).toEqual(again)
    expect(first).toHaveLength(CHALLENGES_PER_DAY)
  })

  it('offers a different trio on a different day', () => {
    const days = ['2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21']
    const sets = days.map(day => challengesFor(day, []).map(entry => entry.id).join(','))

    // Not all identical: the point of rotating is variety.
    expect(new Set(sets).size).toBeGreaterThan(1)
  })

  it('never offers one already completed', () => {
    const done: ChallengeId[] = ['no-yank', 'flawless', 'quick-work']

    for (const day of ['2026-01-01', '2026-06-15', '2026-12-31']) {
      const offered = challengesFor(day, done).map(entry => entry.id)
      for (const id of done) expect(offered, day).not.toContain(id)
    }
  })

  it('brings an unfinished one round again rather than retiring it', () => {
    // Sweep a year: every challenge must be offered at some point, or one could be
    // permanently unreachable through no fault of the player.
    const seen = new Set<string>()
    for (let day = 1; day <= 366; day += 1) {
      const date = new Date(2026, 0, day)
      for (const entry of challengesFor(challengeDay(date), [])) seen.add(entry.id)
    }

    expect(seen.size).toBe(CHALLENGES.length)
  })

  it('runs out gracefully once every one is done', () => {
    const all = CHALLENGES.map(entry => entry.id)
    expect(challengesFor('2026-08-18', all)).toEqual([])
  })

  it('offers what is left when fewer than a full trio remain', () => {
    const all = CHALLENGES.map(entry => entry.id)
    const remaining = challengesFor('2026-08-18', all.slice(2))

    expect(remaining.map(entry => entry.id)).toEqual(all.slice(0, 2))
  })
})

describe('challenges are checked, not claimed', () => {
  it('awards nothing for a lost match, however well it was played', () => {
    const lost = context({
      outcome: { kind: 'cut', winner: 1 },
      stats: { ...STATS, snapsUsed: 0, roundsLost: 0, clashSeconds: 30 },
      peakLoad: 0.2,
    })

    for (const challenge of CHALLENGES) {
      expect(challenge.isMet(lost), challenge.id).toBe(false)
    }
  })

  it('awards nothing for an unfinished match', () => {
    const pending = context({ outcome: { kind: 'pending' } })
    for (const challenge of CHALLENGES) {
      expect(challenge.isMet(pending), challenge.id).toBe(false)
    }
  })

  it('reads the yank count off the recorded stats', () => {
    const challenge = getChallenge('no-yank')
    expect(challenge.isMet(context({ stats: { ...STATS, snapsUsed: 0 } }))).toBe(true)
    expect(challenge.isMet(context({ stats: { ...STATS, snapsUsed: 1 } }))).toBe(false)
  })

  it('reads the overload mark off the peak load', () => {
    const challenge = getChallenge('clean-line')
    expect(challenge.isMet(context({ peakLoad: 0.99 }))).toBe(true)
    expect(challenge.isMet(context({ peakLoad: 1.01 }))).toBe(false)
  })

  it('knows a cabled field from an open one', () => {
    const challenge = getChallenge('cabled-field')
    expect(challenge.isMet(context({ arena: getArena('kampung') }))).toBe(true)
    expect(challenge.isMet(context({ arena: getArena('sawah') }))).toBe(false)
  })

  it('knows a free-for-all from a duel', () => {
    const challenge = getChallenge('outnumbered')
    const crowd = [getOpponent('bocah-sawah'), getOpponent('anak-kampung')]

    expect(challenge.isMet(context({ opponents: crowd }))).toBe(true)
    expect(challenge.isMet(context())).toBe(false)
  })

  it('knows a boss from a regular opponent', () => {
    const challenge = getChallenge('boss-hunter')
    expect(challenge.isMet(context({ opponents: [getOpponent('bos-pasar')] }))).toBe(true)
    expect(challenge.isMet(context())).toBe(false)
  })
})

describe('awarding', () => {
  it('pays only what was on offer', () => {
    // `no-yank` is satisfied but was not offered today, so it must not pay.
    const offered = [getChallenge('flawless')]
    const awards = evaluateChallenges(offered, [], context({
      stats: { ...STATS, snapsUsed: 0, roundsLost: 0 },
    }))

    expect(awards.map(award => award.challenge.id)).toEqual(['flawless'])
  })

  it('pays nothing twice', () => {
    const offered = [getChallenge('flawless')]
    const met = context({ stats: { ...STATS, roundsLost: 0 } })

    expect(evaluateChallenges(offered, [], met)).toHaveLength(1)
    expect(evaluateChallenges(offered, ['flawless'], met)).toHaveLength(0)
  })

  it('can complete more than one in a single match', () => {
    const offered = [getChallenge('flawless'), getChallenge('no-yank')]
    const awards = evaluateChallenges(offered, [], context({
      stats: { ...STATS, roundsLost: 0, snapsUsed: 0 },
    }))

    expect(awards).toHaveLength(2)
    expect(awards.every(award => award.coins > 0)).toBe(true)
  })
})

describe('the day boundary', () => {
  it('uses local calendar dates', () => {
    expect(challengeDay(new Date(2026, 7, 18, 23, 59))).toBe('2026-08-18')
    expect(challengeDay(new Date(2026, 7, 19, 0, 1))).toBe('2026-08-19')
  })

  it('pads single digits so the seed is stable', () => {
    expect(challengeDay(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

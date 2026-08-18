import { arenaHazards } from './arenas'
import {
  isPlayerWin,
  type ArenaDefinition,
  type ChallengeId,
  type MatchOutcome,
  type MatchStats,
  type OpponentDefinition,
} from '~/services/game/types'

/**
 * Challenges.
 *
 * Short-term goals, because the ladder is the only thing to aim at and it is a long
 * way between rungs. A challenge gives a reason to play *this* session that is not
 * "beat someone harder than last time".
 *
 * Three rules, and the first two are the reason this is a checklist rather than a
 * live-service feature:
 *
 * 1. **Nothing expires.** A trio is picked from the date for variety, but an
 *    uncompleted challenge simply comes round again and a completed one stays
 *    completed forever. Not playing for a week costs nothing — which is the point of
 *    an offline game with no account.
 * 2. **Everything is checked, never claimed.** Each one is a predicate over the
 *    match's own recorded `MatchStats` and outcome, so it cannot be satisfied by
 *    asserting it. `snapsUsed`, `clashSeconds`, `peakTension` and the rest are all
 *    written by the engine.
 * 3. **They teach.** Most of them name a technique the measurements say decides
 *    matches — winning without the yank, winning while keeping the line off the red
 *    mark, winning a crossing-heavy duel. A challenge that only asks for repetition
 *    would add grind rather than skill.
 */

export interface ChallengeContext {
  outcome: MatchOutcome
  stats: MatchStats
  arena: ArenaDefinition
  opponents: readonly OpponentDefinition[]
  /** Peak line tension as a share of the player's breaking tension, 0..1-ish. */
  peakLoad: number
}

export interface ChallengeDefinition {
  id: ChallengeId
  i18nKey: ChallengeId
  /** Coins paid the first time it is met. */
  reward: number
  /**
   * True when this match satisfies it. Pure, and reads only what the engine
   * recorded — see rule 2 above.
   */
  isMet: (context: ChallengeContext) => boolean
}

/** Every challenge must be won; none of them reward losing well. */
const won = (context: ChallengeContext): boolean => isPlayerWin(context.outcome)

export const CHALLENGES: readonly ChallengeDefinition[] = [
  {
    id: 'no-yank',
    i18nKey: 'no-yank',
    reward: 120,
    // The yank is the strongest single tool; winning without it means the crossing
    // angle and the tension share were done properly instead.
    isMet: context => won(context) && context.stats.snapsUsed === 0,
  },
  {
    id: 'clean-line',
    i18nKey: 'clean-line',
    reward: 140,
    // Never crossed the overload mark: the line was never being destroyed by the
    // player's own hauling.
    isMet: context => won(context) && context.peakLoad < 1,
  },
  {
    id: 'stay-in-it',
    i18nKey: 'stay-in-it',
    reward: 130,
    // Twelve seconds of contact is a duel fought rather than avoided.
    isMet: context => won(context) && context.stats.clashSeconds >= 12,
  },
  {
    id: 'flawless',
    i18nKey: 'flawless',
    reward: 200,
    // Not one round lost: no cut, no crash, no cable, the whole match.
    isMet: context => won(context) && context.stats.roundsLost === 0,
  },
  {
    id: 'cabled-field',
    i18nKey: 'cabled-field',
    reward: 160,
    // Won somewhere with cables in it, which punish a sinking kite without mercy.
    isMet: context => won(context) && arenaHazards(context.arena).cableCount > 0,
  },
  {
    id: 'high-flyer',
    i18nKey: 'high-flyer',
    reward: 110,
    // Height is free power: wind strengthens with altitude.
    isMet: context => won(context) && context.stats.peakAltitude >= 70,
  },
  {
    id: 'quick-work',
    i18nKey: 'quick-work',
    reward: 150,
    // Inside twenty seconds. Only reachable by winning exchanges outright.
    isMet: context => won(context) && context.stats.durationSeconds <= 20,
  },
  {
    id: 'outnumbered',
    i18nKey: 'outnumbered',
    reward: 240,
    // A free-for-all, where every opponent has to be cut down.
    isMet: context => won(context) && context.opponents.length >= 2,
  },
  {
    id: 'boss-hunter',
    i18nKey: 'boss-hunter',
    reward: 220,
    isMet: context => won(context) && context.opponents.some(opponent => opponent.isBoss),
  },
]

const INDEX = new Map<ChallengeId, ChallengeDefinition>(
  CHALLENGES.map(challenge => [challenge.id, challenge]),
)

export function getChallenge(id: ChallengeId): ChallengeDefinition {
  const challenge = INDEX.get(id)
  if (!challenge) throw new Error(`Unknown challenge: ${id}`)
  return challenge
}

export function findChallenge(id: string | undefined): ChallengeDefinition | undefined {
  return id === undefined ? undefined : INDEX.get(id as ChallengeId)
}

/** How many are offered at a time. Three is enough to pick from, few enough to read. */
export const CHALLENGES_PER_DAY = 3

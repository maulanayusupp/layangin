import {
  CHALLENGES,
  CHALLENGES_PER_DAY,
  type ChallengeContext,
  type ChallengeDefinition,
} from '~/data/challenges'
import { createRandom } from '~/services/game/math/random'
import type { ChallengeId } from '~/services/game/types'

/**
 * Which challenges are offered, and which a match just completed.
 *
 * ## Rotation without expiry
 * The trio is drawn from the calendar date, so it changes daily and everyone playing
 * on the same day sees the same three. But **nothing expires**: a challenge left
 * undone simply comes round again, and a completed one is completed for good. That
 * is the whole difference between "here is something to aim at today" and a
 * live-service treadmill that punishes a week away — and this game has no account
 * and no server to punish anyone with.
 *
 * Already-completed challenges are excluded from the draw, so the offer is always
 * three things the player has not done yet. When they run out, the list is finished
 * and the panel says so rather than repeating itself forever.
 *
 * ## The seed
 * `createRandom` is the same seeded PRNG the simulation uses, keyed on the date, so
 * the draw is deterministic and testable — no `Math.random()`, and no dependence on
 * the order the definitions happen to be written in.
 */

/** `YYYY-MM-DD` in local time: the day the player is actually having. */
export function challengeDay(now: Date): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Stable integer seed for a day string. */
function seedFor(day: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < day.length; i += 1) {
    hash ^= day.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

/**
 * The challenges on offer for a given day, excluding anything already completed.
 *
 * Returns fewer than `CHALLENGES_PER_DAY` — possibly none — once the player has
 * worked through the list. That is a finished checklist, not an error.
 */
export function challengesFor(
  day: string,
  completed: readonly ChallengeId[],
): ChallengeDefinition[] {
  const done = new Set(completed)
  const pool = CHALLENGES.filter(challenge => !done.has(challenge.id))
  if (pool.length <= CHALLENGES_PER_DAY) return [...pool]

  const random = createRandom(seedFor(day))
  const remaining = [...pool]
  const picked: ChallengeDefinition[] = []

  while (picked.length < CHALLENGES_PER_DAY && remaining.length > 0) {
    const index = random.int(0, remaining.length - 1)
    picked.push(remaining[index] as ChallengeDefinition)
    remaining.splice(index, 1)
  }

  return picked
}

export interface ChallengeAward {
  challenge: ChallengeDefinition
  coins: number
}

/**
 * Which of the offered challenges this match satisfied, and what they pay.
 *
 * Only the ones on offer count. Checking every challenge on every match would mean a
 * player sweeping the whole list in one lucky duel, which empties the feature in an
 * afternoon; and only ever paying once is what keeps it a goal rather than a wage.
 */
export function evaluateChallenges(
  offered: readonly ChallengeDefinition[],
  completed: readonly ChallengeId[],
  context: ChallengeContext,
): ChallengeAward[] {
  const done = new Set(completed)

  return offered
    .filter(challenge => !done.has(challenge.id) && challenge.isMet(context))
    .map(challenge => ({ challenge, coins: challenge.reward }))
}

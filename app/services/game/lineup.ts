import { MAX_FIGHTERS } from './constants'
import type { OpponentDefinition } from './types'

/**
 * Who else is in the sky.
 *
 * A duel is one opponent. A free-for-all (*rame-rame*, the way a field actually
 * looks on a windy afternoon) adds one or two more, and they fight each other as
 * readily as they fight the player — so standing back and letting two of them saw
 * through each other is a real tactic.
 *
 * The extras are chosen by **tier proximity** to the opponent the player picked.
 * Filling the field with whoever happens to be unlocked would mean a tier-1
 * opponent regularly turning up alongside a boss, which makes the match neither a
 * fair fight nor a readable one. Nearest tiers first keeps the difficulty roughly
 * where the player aimed it, and ties break toward the lower tier so the surprise
 * is never harder than the fight that was chosen.
 */

/** Fighters a match can hold, minus the player. */
export const MAX_OPPONENTS = MAX_FIGHTERS - 1

/** How many opponents a match format puts in the air. */
export type LineupSize = 1 | 2 | 3

export function lineupFor(
  primary: OpponentDefinition,
  size: LineupSize,
  /** Opponents the player has unlocked. Locked rungs are never drafted in. */
  available: readonly OpponentDefinition[],
): OpponentDefinition[] {
  const extras = available
    .filter(candidate => candidate.id !== primary.id)
    .sort((a, b) => {
      const distance = Math.abs(a.tier - primary.tier) - Math.abs(b.tier - primary.tier)
      return distance !== 0 ? distance : a.tier - b.tier
    })
    // Never more than the format asks for, and never more than the sky holds.
    .slice(0, Math.min(size, MAX_OPPONENTS) - 1)

  return [primary, ...extras]
}

/**
 * Formats the player can actually pick right now.
 *
 * A three-way needs two unlocked opponents besides the one being fought, so early
 * on the list is short. Offering a format that silently falls back to a duel would
 * be worse than not offering it.
 */
export function availableLineupSizes(
  primary: OpponentDefinition | null,
  available: readonly OpponentDefinition[],
): LineupSize[] {
  const others = primary
    ? available.filter(candidate => candidate.id !== primary.id).length
    : Math.max(0, available.length - 1)

  const sizes: LineupSize[] = [1]
  if (others >= 1) sizes.push(2)
  if (others >= 2) sizes.push(3)

  return sizes
}

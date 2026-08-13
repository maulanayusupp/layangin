import { LINE_BREAK_TENSION } from './constants'
import type { MatchOutcome, MatchSnapshot, MatchStats } from './types'

/**
 * Post-match coaching.
 *
 * Returns an i18n key suffix (resolved under `game.result.advice.*`) rather than
 * a sentence, so the advice is translated like everything else.
 *
 * The point is to name the *specific* mistake. "You lost" teaches nothing; "your
 * line parted under its own load" points at the load bar and the fix.
 */
export type AdviceKey
  = 'tension' | 'overload' | 'crash' | 'obstacle' | 'cable' | 'close' | 'solid'

export interface AdviceInput {
  outcome: MatchOutcome
  /** How the deciding round ended, when it was not the opponent's doing. */
  lastReason?: 'cut' | 'crash' | 'obstacle' | 'cable'
  stats: MatchStats
  /** Player's line condition when the match ended, 0..1. */
  playerIntegrity: number
  rivalIntegrity: number
  /** Breaking tension of the line the player flew, in newtons. */
  breakingTension: number
}

export function selectAdvice(input: AdviceInput): AdviceKey {
  const { outcome, stats, playerIntegrity, rivalIntegrity, breakingTension } = input

  if (outcome.kind === 'crash' && outcome.winner === 'rival') return 'crash'
  if (outcome.kind === 'obstacle' && outcome.winner === 'rival') return 'obstacle'
  // A cable cut is not a lost duel, and the advice for it is different.
  if (input.lastReason === 'cable' && outcome.kind === 'cut' && outcome.winner === 'rival') {
    return 'cable'
  }

  const playerLost
    = outcome.kind !== 'pending' && 'winner' in outcome && outcome.winner === 'rival'

  if (playerLost) {
    // Peaking above the breaking point means the line was being destroyed by the
    // player's own hauling, not by the opponent.
    if (stats.peakTension > breakingTension * 0.98) return 'overload'
    return 'tension'
  }

  // A win decided by less than a tenth of the line was genuinely close.
  if (Math.abs(playerIntegrity - rivalIntegrity) < 0.1) return 'close'

  return 'solid'
}

/** Convenience wrapper for a finished match snapshot. */
export function adviceForSnapshot(snapshot: MatchSnapshot): AdviceKey {
  return selectAdvice({
    outcome: snapshot.outcome,
    stats: snapshot.stats,
    playerIntegrity: snapshot.player.lineIntegrity,
    rivalIntegrity: snapshot.rival.lineIntegrity,
    breakingTension: LINE_BREAK_TENSION * snapshot.player.stats.lineStrength,
  })
}

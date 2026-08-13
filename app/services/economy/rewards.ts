import type {
  MatchOutcome,
  MatchReward,
  MatchStats,
  OpponentDefinition,
} from '~/services/game/types'

/**
 * Coin rewards.
 *
 * The shape of the curve is the design: a clean cut pays full, scrappier wins pay
 * less, and a loss still pays a little so a losing streak never leaves a player
 * unable to afford the upgrade that would break it. First wins pay a bounty so
 * working down the ladder feels like progress rather than grinding one opponent.
 */

/** Share of the base reward paid for each kind of win. */
const WIN_MULTIPLIER: Record<'cut' | 'crash' | 'timeout', number> = {
  cut: 1,
  crash: 0.8,
  timeout: 0.6,
}

/** Consolation share paid on a loss, so progress never fully stalls. */
const LOSS_SHARE = 0.12
const DRAW_SHARE = 0.3

/** First-time-beaten bounty, as a share of the base reward. */
const FIRST_WIN_BONUS = 0.5
const FIRST_BOSS_BONUS = 1

export function computeReward(
  outcome: MatchOutcome,
  opponent: OpponentDefinition,
  stats: MatchStats,
  rewardMultiplier: number,
  alreadyDefeated: boolean,
): MatchReward {
  const base = opponent.reward

  if (outcome.kind === 'pending') {
    return { coins: 0, bonusCoins: 0, isFirstWin: false, outcome }
  }

  const playerWon
    = (outcome.kind === 'cut' && outcome.winner === 'player')
      || (outcome.kind === 'crash' && outcome.winner === 'player')
      || (outcome.kind === 'timeout' && outcome.winner === 'player')

  const isDraw = outcome.kind === 'timeout' && outcome.winner === 'draw'

  let coins: number
  if (isDraw) {
    coins = base * DRAW_SHARE
  }
  else if (playerWon) {
    coins = base * WIN_MULTIPLIER[outcome.kind]
  }
  else {
    coins = base * LOSS_SHARE
  }

  let bonusCoins = 0
  const isFirstWin = playerWon && !alreadyDefeated

  if (isFirstWin) {
    bonusCoins += base * (opponent.isBoss ? FIRST_BOSS_BONUS : FIRST_WIN_BONUS)
  }

  if (playerWon) {
    // Small performance bonus: rewards fighting rather than stalling for time.
    // Capped so it never dwarfs the base reward.
    const engagement = Math.min(1, stats.clashSeconds / 12)
    const altitude = Math.min(1, stats.peakAltitude / 110)
    bonusCoins += base * 0.2 * (engagement * 0.6 + altitude * 0.4)
  }

  return {
    coins: Math.round(coins * rewardMultiplier),
    bonusCoins: Math.round(bonusCoins * rewardMultiplier),
    isFirstWin,
    outcome,
  }
}

/** Did the player win, whatever the manner? */
export function isPlayerWin(outcome: MatchOutcome): boolean {
  return outcome.kind !== 'pending' && 'winner' in outcome && outcome.winner === 'player'
}

/**
 * Difficulty multiplier for repeat runs. Applied to the AI only — see
 * `scaleAiProfile` — never to the opponent's gear.
 */
export function difficultyForClears(ladderClears: number): number {
  return 1 + Math.min(1.5, ladderClears * 0.25)
}

import type { Rarity } from '~/services/game/types'

/**
 * Purchase rules, kept pure so both the UI (to disable a button and explain why)
 * and the store (to actually spend coins) reason from the same source.
 */

export type PurchaseState = 'owned' | 'affordable' | 'too-expensive' | 'locked'

export interface PurchaseCheck {
  state: PurchaseState
  /** i18n key suffix explaining the state, resolved under `shop.reason.*`. */
  reasonKey: PurchaseState
  /** Coins still needed. 0 unless `state` is `too-expensive`. */
  shortfall: number
  /** Wins still needed. 0 unless `state` is `locked`. */
  winsNeeded: number
}

export interface PurchaseInput {
  price: number
  coins: number
  owned: boolean
  /** Ladder wins required before the item appears for sale. */
  unlockWins?: number
  wins?: number
}

export function checkPurchase({
  price,
  coins,
  owned,
  unlockWins = 0,
  wins = 0,
}: PurchaseInput): PurchaseCheck {
  if (owned) {
    return { state: 'owned', reasonKey: 'owned', shortfall: 0, winsNeeded: 0 }
  }

  if (wins < unlockWins) {
    return {
      state: 'locked',
      reasonKey: 'locked',
      shortfall: 0,
      winsNeeded: unlockWins - wins,
    }
  }

  if (coins < price) {
    return {
      state: 'too-expensive',
      reasonKey: 'too-expensive',
      shortfall: price - coins,
      winsNeeded: 0,
    }
  }

  return { state: 'affordable', reasonKey: 'affordable', shortfall: 0, winsNeeded: 0 }
}

/** Display order for rarity, lowest first. */
export const RARITY_ORDER: readonly Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legend',
] as const

export function rarityRank(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity)
}

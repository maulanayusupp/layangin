import { resolveLoadout } from './loadout'
import { describeWind } from './physics/wind'
import { getKite } from '~/data/kites'
import type { KiteStats, MatchLoadout, OpponentDefinition } from './types'

/**
 * "How do I beat this one?", answered from the numbers.
 *
 * The three hand-written boss briefs in `game.tactics` are good but they only
 * cover three opponents, and they cannot know what the player is flying. This
 * derives a brief for *any* matchup by comparing the loadout the player actually
 * has against the opponent's — which is the real question behind "how do I beat
 * someone stronger than me". A player who has just bought a tougher line should be
 * told that a grind is now on the table; the same player last week should not.
 *
 * Every point is read off a stat the simulation uses. Nothing here is flavour, and
 * nothing may claim an effect the model does not have:
 *
 * - `cutPower` and `lineStrength` decide `applyAbrasion`'s exchange.
 * - `agility` is the steering rate, so it decides who picks the crossing angle.
 * - Gust and wind decide how close to the red mark a haul puts you.
 * - `aggression` and `caution` are how the AI behaves on contact and when losing.
 *
 * The two fundamentals are always included, and deliberately first: measured
 * against real per-tier loadouts, a scripted player that only holds neutral wins 0
 * of 48, and the same player hauling on contact and walking to contest wins 29.
 * Nothing else in this list is worth as much as those two.
 */

/** A single line of advice. `key` indexes `game.brief.points.*`. */
export interface BriefingPoint {
  key: string
  /** `core` is always shown first; `edge` is in your favour, `risk` against you. */
  kind: 'core' | 'edge' | 'risk'
  /** Interpolation values for the message, already rounded for display. */
  values?: Record<string, string | number>
}

/** Ratio above which a stat gap is worth mentioning at all. */
const NOTABLE = 1.15

/** Gust level above which the air is the thing most likely to part your line. */
const GUSTY = 0.4

function ratio(mine: number, theirs: number): number {
  return theirs === 0 ? Infinity : mine / theirs
}

export interface BriefingInput {
  player: MatchLoadout
  opponent: OpponentDefinition
  /** Arena multipliers, so the brief describes the air actually being flown in. */
  windMultiplier: number
  gustMultiplier: number
}

export function buildBriefing(input: BriefingInput): BriefingPoint[] {
  const { opponent } = input

  const mine: KiteStats = resolveLoadout(input.player.kiteId, input.player.upgrades).stats
  const theirs: KiteStats = resolveLoadout(opponent.kiteId, opponent.upgrades).stats

  const myAgility = getKite(input.player.kiteId).stats.agility
  const theirAgility = getKite(opponent.kiteId).stats.agility

  const wind = opponent.windSpeed * input.windMultiplier
  const gust = opponent.gustiness * input.gustMultiplier

  const points: BriefingPoint[] = [
    // Always, and always first. These are worth more than everything below.
    { key: 'haul', kind: 'core' },
    { key: 'walk', kind: 'core' },
  ]

  // --- Whose line survives a grind ----------------------------------------
  const lineEdge = ratio(mine.lineStrength, theirs.lineStrength)
  const cutEdge = ratio(mine.cutPower, theirs.cutPower)

  if (lineEdge < 1 / NOTABLE) {
    points.push({
      key: 'weakerLine',
      kind: 'risk',
      values: { percent: Math.round((1 / lineEdge - 1) * 100) },
    })
  }
  else if (lineEdge > NOTABLE) {
    points.push({
      key: 'strongerLine',
      kind: 'edge',
      values: { percent: Math.round((lineEdge - 1) * 100) },
    })
  }

  if (cutEdge < 1 / NOTABLE) {
    points.push({ key: 'weakerGelasan', kind: 'risk' })
  }
  else if (cutEdge > NOTABLE) {
    points.push({ key: 'strongerGelasan', kind: 'edge' })
  }

  // --- Who chooses the geometry -------------------------------------------
  if (myAgility > theirAgility * NOTABLE) {
    points.push({
      key: 'nimbler',
      kind: 'edge',
      values: { mine: myAgility.toFixed(1), theirs: theirAgility.toFixed(1) },
    })
  }
  else if (theirAgility > myAgility * NOTABLE) {
    points.push({
      key: 'slower',
      kind: 'risk',
      values: { mine: myAgility.toFixed(1), theirs: theirAgility.toFixed(1) },
    })
  }

  // --- The air ------------------------------------------------------------
  if (gust >= GUSTY) {
    points.push({ key: 'gusty', kind: 'risk' })
  }
  if (describeWind(wind) === 'wild' || describeWind(wind) === 'strong') {
    points.push({ key: 'strongWind', kind: 'risk' })
  }

  // --- How they fight -----------------------------------------------------
  if (opponent.ai.aggression >= 0.75) {
    points.push({ key: 'committed', kind: 'edge' })
  }
  if (opponent.ai.caution >= 0.4) {
    points.push({ key: 'cagey', kind: 'risk' })
  }
  if (opponent.ai.mistakeRate >= 0.2) {
    points.push({ key: 'sloppy', kind: 'edge' })
  }

  return points
}

/**
 * Is this fight an uphill one on gear alone?
 *
 * Used to decide whether to lead with the "you are out-gunned, here is how that is
 * survivable" framing rather than a neutral brief. Compares the product of the two
 * stats that decide an exchange, because being out-cut is survivable if your line
 * is tougher and vice versa.
 */
export function isOutgeared(input: BriefingInput): boolean {
  const mine = resolveLoadout(input.player.kiteId, input.player.upgrades).stats
  const theirs = resolveLoadout(input.opponent.kiteId, input.opponent.upgrades).stats

  return mine.lineStrength * mine.cutPower < theirs.lineStrength * theirs.cutPower / NOTABLE
}

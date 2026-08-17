import { describe, expect, it } from 'vitest'
import { createAiInput } from '~/services/game/input/ai'
import { createFighter } from '~/services/game/physics/fighter'
import { resolveLoadout } from '~/services/game/loadout'
import { createRandom } from '~/services/game/math/random'
import { FIXED_TIMESTEP } from '~/services/game/constants'
import type { InputContext } from '~/services/game/input/source'
import type { AiProfile, FighterState, WindSample } from '~/services/game/types'

/**
 * AI fairness.
 *
 * Every difficulty knob in this game is meant to be a human limitation — reaction
 * time, aim precision, stamina discipline, mistake rate — and `/compliance` says so
 * in as many words. These tests hold that claim to account.
 *
 * The one that shipped broken: the haul-on-contact response lived outside the
 * reaction gate, so the single most decisive action in a duel fired one simulation
 * step after the lines touched, for *every* opponent including the first rung.
 * Measured, a scripted player went from 18 wins in 48 to 37 once it was gated.
 */

function fighter(side: 'player' | 'rival', anchorX: number, x: number): FighterState {
  const loadout = resolveLoadout('pecut', {})
  const state = createFighter({
    side,
    index: side === 'player' ? 0 : 1,
    anchorX,
    stats: loadout.stats,
    reelSpeed: loadout.reelSpeed,
    staminaEfficiency: loadout.staminaEfficiency,
    kiteId: 'pecut',
    paletteId: 'senja',
    patternId: 'plain',
    effectId: 'none',
  })

  state.position = { x, y: 40 }
  state.tension = 60
  return state
}

const WIND: WindSample = { velocity: { x: 6, y: 0 }, speed: 6 }

/** A profile with one knob turned up, everything else neutral. */
function profileWith(reactionTime: number): AiProfile {
  return {
    reactionTime,
    aggression: 0.9,
    precision: 1,
    discipline: 0.5,
    mistakeRate: 0,
    caution: 0,
  }
}

/**
 * Drive an AI with the lines permanently crossed and report the reel command at
 * each step, so the moment it starts hauling can be read off directly.
 */
function reelWhileTouching(reactionTime: number, seconds: number): number[] {
  const self = fighter('rival', 7, -20)
  const opponent = fighter('player', -7, 20)

  const ai = createAiInput({
    profile: profileWith(reactionTime),
    random: createRandom(4242),
    clearance: () => 0,
    bounds: 26,
  })

  const context: InputContext = {
    self,
    opponent,
    others: [opponent],
    wind: WIND,
    contact: true,
    elapsed: 0,
    dt: FIXED_TIMESTEP,
  }

  const reels: number[] = []
  const steps = Math.round(seconds / FIXED_TIMESTEP)
  for (let i = 0; i < steps; i += 1) {
    context.elapsed += FIXED_TIMESTEP
    reels.push(ai.sample(context).reel)
  }

  return reels
}

describe('the contact response waits for the reaction time', () => {
  it('does not haul on the step the lines touch', () => {
    const slow = reelWhileTouching(0.9, 0.2)

    // Half of 0.9 s is 0.45 s; nothing in the first 0.2 s may be a contact haul.
    // The plan can still ask for a small reel, so this is a bound rather than zero.
    expect(Math.max(...slow)).toBeLessThan(0.5)
  })

  it('hauls once its own reaction time has passed', () => {
    const reels = reelWhileTouching(0.9, 1.5)
    expect(Math.max(...reels)).toBeGreaterThan(0.5)
  })

  it('gives a sharper opponent a faster reflex than a slower one', () => {
    const firstHaul = (reactionTime: number): number => {
      const reels = reelWhileTouching(reactionTime, 2)
      const index = reels.findIndex(reel => reel > 0.5)
      return index < 0 ? Infinity : index * FIXED_TIMESTEP
    }

    const beginner = firstHaul(0.95)
    const boss = firstHaul(0.2)

    expect(boss).toBeLessThan(beginner)
    // And the beginner's delay is a real fraction of a second, not a formality.
    expect(beginner).toBeGreaterThan(0.3)
  })

  it('forgets the contact once the lines part', () => {
    const self = fighter('rival', 7, -20)
    const opponent = fighter('player', -7, 20)

    const ai = createAiInput({
      profile: profileWith(0.9),
      random: createRandom(11),
      clearance: () => 0,
      bounds: 26,
    })

    const context: InputContext = {
      self,
      opponent,
      others: [opponent],
      wind: WIND,
      contact: true,
      elapsed: 0,
      dt: FIXED_TIMESTEP,
    }

    // Touch for a third of a second — not long enough — then part.
    for (let i = 0; i < Math.round(0.3 / FIXED_TIMESTEP); i += 1) {
      context.elapsed += FIXED_TIMESTEP
      ai.sample(context)
    }

    context.contact = false
    for (let i = 0; i < Math.round(0.3 / FIXED_TIMESTEP); i += 1) {
      context.elapsed += FIXED_TIMESTEP
      ai.sample(context)
    }

    // Touching again starts the clock over: two brief brushes do not add up to a
    // reaction, or a fighter could be goaded into reacting instantly.
    context.contact = true
    const reels: number[] = []
    for (let i = 0; i < Math.round(0.2 / FIXED_TIMESTEP); i += 1) {
      context.elapsed += FIXED_TIMESTEP
      reels.push(ai.sample(context).reel)
    }

    expect(Math.max(...reels)).toBeLessThan(0.5)
  })
})

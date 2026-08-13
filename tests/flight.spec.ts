import { describe, expect, it } from 'vitest'
import { createFighter, stepFighter } from '~/services/game/physics/fighter'
import { computeAerodynamics } from '~/services/game/physics/aerodynamics'
import { resolveLoadout } from '~/services/game/loadout'
import { createWindField } from '~/services/game/physics/wind'
import { createMatchEngine } from '~/services/game/engine'
import { getArena } from '~/data/arenas'
import { OPPONENTS, getOpponent } from '~/data/opponents'
import { emptyUpgradeLevels } from '~/data/upgrades'
import { KITES } from '~/data/kites'
import {
  DEFAULT_TIME_LIMIT,
  FIXED_TIMESTEP,
  PLAYER_ANCHOR_X,
  START_LINE_LENGTH,
} from '~/services/game/constants'
import { NEUTRAL_COMMAND, type FighterCommand, type KiteId } from '~/services/game/types'
import * as V from '~/services/game/math/vector'

/**
 * Flight regressions.
 *
 * Every test here pins down a bug that actually shipped and made the game
 * unplayable:
 *
 * - kites launched on a slack line, drifted with the wind until the sail had no
 *   airspeed, stalled, and sank;
 * - a stalled sail produced *reversed* lift, so a stall could never be recovered;
 * - the AI's line-length controller had an inverted sign and wound itself down to
 *   the ground;
 * - the two lines flew parallel and never crossed, so the duel never happened.
 */

function makeFighter(kiteId: KiteId = 'pecut') {
  const loadout = resolveLoadout(kiteId, {})
  return createFighter({
    side: 'player',
    anchorX: PLAYER_ANCHOR_X,
    stats: loadout.stats,
    reelSpeed: loadout.reelSpeed,
    staminaEfficiency: loadout.staminaEfficiency,
    kiteId,
    paletteId: 'senja',
    patternId: 'plain',
    effectId: 'none',
  })
}

/** Fly one fighter in steady air and report where it settles. */
function flySolo(kiteId: KiteId, seconds: number, command = NEUTRAL_COMMAND) {
  const fighter = makeFighter(kiteId)
  // Gustiness 0 isolates the aerodynamics from the gust generator.
  const wind = createWindField({ referenceSpeed: 4.6, gustiness: 0, seed: 1 })

  const steps = Math.round(seconds / FIXED_TIMESTEP)
  let minAltitude = Infinity

  for (let i = 0; i < steps; i += 1) {
    wind.update(FIXED_TIMESTEP)
    stepFighter(fighter, command, wind.sample(fighter.position.y), 1, FIXED_TIMESTEP)
    minAltitude = Math.min(minAltitude, fighter.position.y)
  }

  return { fighter, minAltitude }
}

describe('launch', () => {
  it('starts on a taut line, not a slack one', () => {
    const fighter = makeFighter()
    const span = V.distance(fighter.anchor, fighter.position)

    // A slack launch is what caused the original sink-on-spawn bug: the kite is
    // pushed downwind, matches the wind, and loses all airspeed.
    expect(span).toBeCloseTo(START_LINE_LENGTH, 3)
  })

  it('launches every airframe taut', () => {
    for (const kite of KITES) {
      const fighter = makeFighter(kite.id)
      expect(V.distance(fighter.anchor, fighter.position), kite.id).toBeCloseTo(
        START_LINE_LENGTH,
        3,
      )
    }
  })
})

describe('steady flight', () => {
  it('holds altitude under neutral input instead of sinking', () => {
    const { fighter, minAltitude } = flySolo('pecut', 30)

    // The bug: it fell to the ground within eight seconds.
    expect(minAltitude).toBeGreaterThan(20)
    expect(fighter.position.y).toBeGreaterThan(35)
    expect(fighter.alive).toBe(true)
  })

  it('settles at a plausible kite elevation', () => {
    const { fighter } = flySolo('pecut', 30)
    const offset = V.subtract(fighter.position, fighter.anchor)
    const elevation = (Math.atan2(offset.y, offset.x) * 180) / Math.PI

    // Real fighting kites sit somewhere around 50–70° of elevation.
    expect(elevation).toBeGreaterThan(40)
    expect(elevation).toBeLessThan(80)
  })

  it('keeps every airframe in the air under neutral input', () => {
    for (const kite of KITES) {
      const { fighter } = flySolo(kite.id, 20)
      expect(fighter.position.y, `${kite.id} sank`).toBeGreaterThan(10)
    }
  })

  it('keeps the line under tension in steady air', () => {
    const { fighter } = flySolo('pecut', 20)
    expect(fighter.tension).toBeGreaterThan(0)
  })
})

describe('stall behaviour', () => {
  it('produces no lift when the sail luffs, never reversed lift', () => {
    const stats = resolveLoadout('pecut', {}).stats
    const wind = V.vec2(6, 0)

    // Sail presented backwards to the flow: past 90° of angle of attack.
    const luffing = computeAerodynamics(stats, V.vec2(0, 0), wind, Math.PI * 0.75)

    // The bug: this returned a large negative lift, which pushed a stalled kite
    // into the ground with no way to recover.
    expect(luffing.lift).toBe(0)
    // Drag is still present — a luffing sail is still a bluff body in the wind.
    expect(luffing.drag).toBeGreaterThan(0)
  })

  it('still produces positive lift inside the normal range', () => {
    const stats = resolveLoadout('pecut', {}).stats
    const flying = computeAerodynamics(stats, V.vec2(0, 0), V.vec2(6, 0), -0.4)

    expect(flying.lift).toBeGreaterThan(0)
  })

  it('recovers from being shoved downward rather than diving', () => {
    const fighter = makeFighter()
    const wind = createWindField({ referenceSpeed: 4.6, gustiness: 0, seed: 3 })

    // A hard downward shove, as a gust collapse would give.
    fighter.velocity = V.vec2(0, -14)

    const steps = Math.round(25 / FIXED_TIMESTEP)
    for (let i = 0; i < steps; i += 1) {
      wind.update(FIXED_TIMESTEP)
      stepFighter(fighter, NEUTRAL_COMMAND, wind.sample(fighter.position.y), 1, FIXED_TIMESTEP)
    }

    expect(fighter.position.y).toBeGreaterThan(20)
  })
})

describe('the duel actually happens', () => {
  function makeEngine(seed: number, command: FighterCommand) {
    return createMatchEngine({
      config: {
        seed,
        opponent: getOpponent('bocah-sawah'),
        player: {
          kiteId: 'pecut',
          paletteId: 'senja',
          patternId: 'plain',
          effectId: 'none',
          upgrades: emptyUpgradeLevels(),
        },
        // Open field: isolates the duel from arena hazards.
        arena: getArena('sawah'),
        timeLimit: DEFAULT_TIME_LIMIT,
        difficultyScale: 1,
      },
      playerInput: { kind: 'local', sample: () => command },
    })
  }

  /** Fraction of steps in which the two flying lines are crossed. */
  function crossingRate(seed: number, command: FighterCommand, seconds = 45): number {
    const engine = makeEngine(seed, command)
    engine.skipCountdown()

    const steps = Math.round(seconds / FIXED_TIMESTEP)
    let crossed = 0

    for (let i = 0; i < steps; i += 1) {
      engine.advance(FIXED_TIMESTEP)
      if (engine.snapshot.clashes.some(clash => clash.kind === 'line')) crossed += 1
    }

    return crossed / steps
  }

  it('crosses lines for a passive player, so the AI brings the fight', () => {
    // The bug: both lines flew parallel and this was exactly 0.
    for (const seed of [1, 2, 3]) {
      expect(crossingRate(seed, { ...NEUTRAL_COMMAND }), `seed ${seed}`).toBeGreaterThan(0.25)
    }
  })

  it('still crosses lines when the player pays line out', () => {
    expect(crossingRate(7, { reel: -1, walk: 0, snap: false })).toBeGreaterThan(0.25)
  })

  it('never flies its own kite into the ground', () => {
    for (const seed of [1, 2, 3, 4]) {
      const engine = makeEngine(seed, { ...NEUTRAL_COMMAND })
      engine.skipCountdown()

      let lowest = Infinity
      const steps = Math.round(60 / FIXED_TIMESTEP)
      for (let i = 0; i < steps; i += 1) {
        engine.advance(FIXED_TIMESTEP)
        if (engine.snapshot.phase === 'flying') {
          lowest = Math.min(lowest, engine.snapshot.rival.position.y)
        }
      }

      // The bug: the AI wound its line in to the minimum and sank, handing the
      // player a win it had not earned.
      expect(lowest, `seed ${seed}`).toBeGreaterThan(5)
    }
  })

  it('does not hand the passive player a free win', () => {
    let playerWins = 0

    for (const seed of [11, 22, 33, 44]) {
      const engine = makeEngine(seed, { ...NEUTRAL_COMMAND })
      engine.skipCountdown()

      const steps = Math.round(90 / FIXED_TIMESTEP)
      for (let i = 0; i < steps; i += 1) engine.advance(FIXED_TIMESTEP)

      if (engine.snapshot.rival.hp < engine.snapshot.player.hp) playerWins += 1
    }

    // Doing nothing should not beat even the easiest opponent every time.
    expect(playerWins).toBeLessThan(4)
  })

  it('keeps every opponent airborne, not just the easiest', () => {
    for (const opponent of OPPONENTS) {
      const engine = createMatchEngine({
        config: {
          seed: 99,
          opponent,
          player: {
            kiteId: 'pecut',
            paletteId: 'senja',
            patternId: 'plain',
            effectId: 'none',
            upgrades: emptyUpgradeLevels(),
          },
          arena: getArena('sawah'),
          timeLimit: DEFAULT_TIME_LIMIT,
          difficultyScale: 1,
        },
        playerInput: { kind: 'local', sample: () => NEUTRAL_COMMAND },
      })
      engine.skipCountdown()

      let lowest = Infinity
      const steps = Math.round(40 / FIXED_TIMESTEP)
      for (let i = 0; i < steps; i += 1) {
        engine.advance(FIXED_TIMESTEP)
        if (engine.snapshot.phase === 'flying') {
          lowest = Math.min(lowest, engine.snapshot.rival.position.y)
        }
      }

      expect(lowest, `${opponent.id} sank`).toBeGreaterThan(5)
    }
  })
})

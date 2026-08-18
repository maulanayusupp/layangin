import { describe, expect, it } from 'vitest'
import {
  applyCableWear,
  findCableContacts,
  findCollision,
  windFactorAt,
} from '~/services/game/physics/obstacles'
import { createFighter } from '~/services/game/physics/fighter'
import { resolveLoadout } from '~/services/game/loadout'
import { ARENAS, arenaHazards, getArena } from '~/data/arenas'
import { createMatchEngine } from '~/services/game/engine'
import { getOpponent } from '~/data/opponents'
import { emptyUpgradeLevels } from '~/data/upgrades'
import { DEFAULT_TIME_LIMIT, FIXED_TIMESTEP } from '~/services/game/constants'
import * as V from '~/services/game/math/vector'
import { NEUTRAL_COMMAND, type ClashPoint, type FighterState } from '~/services/game/types'
import type { InputSource } from '~/services/game/input/source'

function makeFighter(kite: V.Vec2, anchorX = -9): FighterState {
  const loadout = resolveLoadout('pecut', {})
  const fighter = createFighter({
    side: 'player',
    anchorX,
    stats: loadout.stats,
    reelSpeed: loadout.reelSpeed,
    staminaEfficiency: loadout.staminaEfficiency,
    kiteId: 'pecut',
    paletteId: 'senja',
    patternId: 'plain',
    effectId: 'none',
  })

  fighter.position = { ...kite }
  fighter.linePoints = [{ x: anchorX, y: 0 }, { ...kite }]
  fighter.tension = 90
  fighter.reelRate = 5
  return fighter
}

describe('solid collision', () => {
  it('finds nothing in an arena with no solid bodies in the way', () => {
    const sawah = getArena('sawah')
    // Straight up the middle of the field, well clear of the edge trees.
    expect(findCollision(sawah, V.vec2(0, 40), 0.5)).toBeNull()
  })

  it('detects the kite inside a tower', () => {
    const kota = getArena('kota')
    const tower = kota.obstacles.find(obstacle => obstacle.kind === 'tower')!

    const inside = V.vec2(tower.x, tower.height / 2)
    expect(findCollision(kota, inside, 0.5)).not.toBeNull()
  })

  it('does not collide above a building', () => {
    const kota = getArena('kota')
    const tower = kota.obstacles.find(obstacle => obstacle.kind === 'tower')!

    expect(findCollision(kota, V.vec2(tower.x, tower.height + 10), 0.5)).toBeNull()
  })

  it('accounts for the kite\'s own size via the margin', () => {
    const kota = getArena('kota')
    const tower = kota.obstacles.find(obstacle => obstacle.kind === 'tower')!
    // Just outside the wall: a point-sized kite clears it, a wide one does not.
    const beside = V.vec2(tower.x + tower.width / 2 + 0.6, 20)

    expect(findCollision(kota, beside, 0)).toBeNull()
    expect(findCollision(kota, beside, 2)).not.toBeNull()
  })

  it('never collides with a cable, which only snags', () => {
    const kampung = getArena('kampung')
    const cable = kampung.obstacles.find(obstacle => obstacle.kind === 'powerline')!

    expect(findCollision(kampung, V.vec2(cable.x, cable.y + 0.1), 0.2)).toBeNull()
  })
})

describe('wind shadow', () => {
  it('is full strength in an arena with no shadowing obstacles', () => {
    expect(windFactorAt(getArena('sawah'), V.vec2(0, 30))).toBe(1)
  })

  it('is unaffected upwind of a building', () => {
    const kota = getArena('kota')
    const tower = kota.obstacles.find(obstacle => obstacle.kind === 'tower')!
    // Wind blows along +x, so upwind means smaller x.
    expect(windFactorAt(kota, V.vec2(tower.x - 40, 20))).toBe(1)
  })

  it('is reduced immediately downwind and below roof height', () => {
    const kota = getArena('kota')
    const towers = kota.obstacles.filter(obstacle => obstacle.kind === 'tower')
    const downwindEdge = Math.max(...towers.map(t => t.x + t.width / 2))

    const factor = windFactorAt(kota, V.vec2(downwindEdge + 2, 20))
    expect(factor).toBeLessThan(1)
    expect(factor).toBeGreaterThan(0)
  })

  it('recovers with distance downwind', () => {
    const kota = getArena('kota')
    const towers = kota.obstacles.filter(obstacle => obstacle.kind === 'tower')
    const edge = Math.max(...towers.map(t => t.x + t.width / 2))

    const near = windFactorAt(kota, V.vec2(edge + 3, 20))
    const far = windFactorAt(kota, V.vec2(edge + 70, 20))

    expect(far).toBeGreaterThan(near)
  })

  it('is clean air well above the obstacle', () => {
    const kota = getArena('kota')
    const tower = kota.obstacles.find(obstacle => obstacle.kind === 'tower')!

    expect(windFactorAt(kota, V.vec2(tower.x + 10, tower.height * 2))).toBe(1)
  })
})

describe('cables', () => {
  const kampung = getArena('kampung')

  /**
   * A kite whose line crosses the cable run.
   *
   * The cables sit along the street at the downwind end (x 46–82, y 14–20), which is
   * where a kite that has been paid out too far and allowed to sink ends up. A line
   * from x = 30 up to a kite 50 m high at x = 90 crosses 17 m of altitude at about
   * x = 50, squarely under the wires.
   */
  const overTheCables = (): FighterState => makeFighter(V.vec2(90, 50), 30)

  it('finds no contact when the kite flies below every cable', () => {
    const fighter = makeFighter(V.vec2(0, 6))
    expect(findCableContacts(kampung, fighter, [])).toHaveLength(0)
  })

  it('finds a contact when the line crosses a cable', () => {
    expect(findCableContacts(kampung, overTheCables(), []).length).toBeGreaterThan(0)
  })

  /**
   * The fix this pins: cables must be a hazard, not a tax.
   *
   * They used to run across the middle of the field at 14–20 m, and a line from an
   * anchor at x = ±7 to a kite 50 m up crosses that band at x = 3–21 — so every
   * launch snagged, for both fighters, on every seed. Measured at 100% of steps in
   * two arenas. A warning that is permanently lit teaches nothing.
   */
  it('leaves a kite on its normal launch arc alone, in every arena', () => {
    for (const arena of ARENAS) {
      for (const anchorX of [-7, 7]) {
        // Where `launchState` puts a kite: LAUNCH_ELEVATION on START_LINE_LENGTH.
        const kite = V.vec2(
          anchorX + Math.cos(0.96) * 62,
          Math.sin(0.96) * 62,
        )

        expect(
          findCableContacts(arena, makeFighter(kite, anchorX), []),
          `${arena.id} @ ${anchorX}`,
        ).toHaveLength(0)
      }
    }
  })

  it('finds nothing in an arena with no cables', () => {
    const fighter = overTheCables()
    expect(findCableContacts(getArena('sawah'), fighter, [])).toHaveLength(0)
  })

  it('wears the line and flags it as snagged', () => {
    const fighter = overTheCables()
    const contacts = findCableContacts(kampung, fighter, [])
    const out: ClashPoint[] = []

    const damage = applyCableWear(fighter, contacts, 1 / 60, out)

    expect(damage).toBeGreaterThan(0)
    expect(fighter.snagged).toBe(true)
    expect(fighter.lineIntegrity).toBeLessThan(1)
    expect(out.every(clash => clash.kind === 'obstacle')).toBe(true)
  })

  it('does no damage when the line is not sliding', () => {
    const fighter = overTheCables()
    fighter.reelRate = 0
    fighter.velocity = V.vec2(0, 0)

    const contacts = findCableContacts(kampung, fighter, [])
    const damage = applyCableWear(fighter, contacts, 1 / 60, [])

    expect(damage).toBe(0)
    expect(fighter.lineIntegrity).toBe(1)
  })

  it('clears the snagged flag when contact ends', () => {
    const fighter = overTheCables()
    applyCableWear(fighter, findCableContacts(kampung, fighter, []), 1 / 60, [])
    expect(fighter.snagged).toBe(true)

    applyCableWear(fighter, [], 1 / 60, [])
    expect(fighter.snagged).toBe(false)
  })

  it('cuts the line once integrity is exhausted', () => {
    const fighter = overTheCables()
    fighter.lineIntegrity = 0.0001

    applyCableWear(fighter, findCableContacts(kampung, fighter, []), 1, [])

    expect(fighter.lineIntegrity).toBe(0)
    expect(fighter.alive).toBe(false)
  })
})

describe('arena catalog', () => {
  it('has a hazard-free starting arena', () => {
    const first = ARENAS.find(arena => arena.unlockWins === 0)!
    expect(arenaHazards(first).cableCount).toBe(0)
  })

  it('rates a cabled arena as more hazardous than an open one', () => {
    expect(arenaHazards(getArena('kampung')).rating).toBeGreaterThan(
      arenaHazards(getArena('sawah')).rating,
    )
  })

  it('keeps every hazard rating inside 0..1', () => {
    for (const arena of ARENAS) {
      const rating = arenaHazards(arena).rating
      expect(rating, arena.id).toBeGreaterThanOrEqual(0)
      expect(rating, arena.id).toBeLessThanOrEqual(1)
    }
  })

  it('gives every cable obstacle a span to intersect against', () => {
    for (const arena of ARENAS) {
      for (const obstacle of arena.obstacles) {
        if (obstacle.behaviour.snag) expect(obstacle.span, arena.id).toBeDefined()
      }
    }
  })

  it('unlocks arenas in ascending order with no duplicates', () => {
    const thresholds = ARENAS.map(arena => arena.unlockWins)
    expect([...thresholds].sort((a, b) => a - b)).toEqual(thresholds)
    expect(new Set(ARENAS.map(arena => arena.id)).size).toBe(ARENAS.length)
  })
})

describe('arena effect on a match', () => {
  const constantInput = (): InputSource => ({
    kind: 'local',
    sample: () => NEUTRAL_COMMAND,
  })

  function makeEngine(arenaId: Parameters<typeof getArena>[0]) {
    return createMatchEngine({
      config: {
        seed: 31337,
        opponents: [getOpponent('bocah-sawah')],
        player: {
          kiteId: 'pecut',
          paletteId: 'senja',
          patternId: 'plain',
          effectId: 'none',
          upgrades: emptyUpgradeLevels(),
        },
        arena: getArena(arenaId),
        timeLimit: DEFAULT_TIME_LIMIT,
        difficultyScale: 1,
      },
      playerInput: constantInput(),
    })
  }

  it('carries the arena into the snapshot for the renderer and HUD', () => {
    expect(makeEngine('viaduk').snapshot.arena.id).toBe('viaduk')
  })

  it('applies the arena wind multiplier to the match wind', () => {
    const field = makeEngine('sawah')
    const beach = makeEngine('pantai')

    // The beach is configured windier than the rice field for the same opponent.
    expect(beach.snapshot.windSpeed).toBeGreaterThan(field.snapshot.windSpeed)
  })

  it('still produces a finite, airborne simulation in a cluttered arena', () => {
    const engine = makeEngine('kampung')
    engine.skipCountdown()
    for (let i = 0; i < 600; i += 1) engine.advance(FIXED_TIMESTEP)

    const { player } = engine.snapshot
    expect(Number.isFinite(player.position.x)).toBe(true)
    expect(Number.isFinite(player.position.y)).toBe(true)
    expect(Number.isFinite(player.lineIntegrity)).toBe(true)
  })

  it('replays identically in a cabled arena', () => {
    const a = makeEngine('kampung')
    const b = makeEngine('kampung')
    a.skipCountdown()
    b.skipCountdown()

    for (let i = 0; i < 400; i += 1) {
      a.advance(FIXED_TIMESTEP)
      b.advance(FIXED_TIMESTEP)
    }

    expect(a.snapshot.player.position).toEqual(b.snapshot.player.position)
    expect(a.snapshot.player.lineIntegrity).toBe(b.snapshot.player.lineIntegrity)
  })
})

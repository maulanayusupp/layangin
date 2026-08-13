import { describe, expect, it } from 'vitest'
import {
  applyAbrasion,
  detectClashes,
  detectPairClashes,
  exchangeAdvantage,
} from '~/services/game/physics/combat'
import { createFighter } from '~/services/game/physics/fighter'
import { resolveLoadout } from '~/services/game/loadout'
import * as V from '~/services/game/math/vector'
import type { ClashPoint, FighterState } from '~/services/game/types'

/** Build a fighter with a straight line from its anchor to a chosen position. */
function makeFighter(
  side: 'player' | 'rival',
  anchorX: number,
  kite: V.Vec2,
  overrides: Partial<FighterState> = {},
): FighterState {
  const loadout = resolveLoadout('pecut', {})
  const fighter = createFighter({
    side,
    // Index 0 is always the human, so a rival takes slot 1.
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

  fighter.position = { ...kite }
  // Straight two-point line, so the geometry under test is exact.
  fighter.linePoints = [{ x: anchorX, y: 0 }, { ...kite }]
  fighter.tension = 80
  fighter.reelRate = 4

  return Object.assign(fighter, overrides)
}

describe('clash detection', () => {
  it('finds a crossing when the two lines intersect', () => {
    // Player stands left and flies right; rival stands right and flies left.
    const player = makeFighter('player', -20, V.vec2(20, 40))
    const rival = makeFighter('rival', 20, V.vec2(-20, 40))

    const clashes = detectPairClashes(player, rival, [])
    expect(clashes.length).toBeGreaterThan(0)
  })

  it('finds nothing when the lines do not cross', () => {
    const player = makeFighter('player', -40, V.vec2(-20, 40))
    const rival = makeFighter('rival', 40, V.vec2(20, 40))

    expect(detectPairClashes(player, rival, [])).toHaveLength(0)
  })

  it('finds nothing once a line has been cut', () => {
    const player = makeFighter('player', -20, V.vec2(20, 40), { alive: false })
    const rival = makeFighter('rival', 20, V.vec2(-20, 40))

    expect(detectPairClashes(player, rival, [])).toHaveLength(0)
  })

  it('gives the tauter line the larger share of the exchange', () => {
    const player = makeFighter('player', -20, V.vec2(20, 40), { tension: 150 })
    const rival = makeFighter('rival', 20, V.vec2(-20, 40), { tension: 50 })

    const clashes = detectPairClashes(player, rival, [])
    expect(clashes[0]!.aShare).toBeGreaterThan(0.5)
  })

  it('reports no slip when neither fighter is reeling or moving', () => {
    const player = makeFighter('player', -20, V.vec2(20, 40), { reelRate: 0 })
    const rival = makeFighter('rival', 20, V.vec2(-20, 40), { reelRate: 0 })

    const clashes = detectPairClashes(player, rival, [])
    expect(clashes[0]!.slip).toBe(0)
  })
})

describe('abrasion', () => {
  /** A crossing between fighter 0 and fighter 1, with a given tension share. */
  const clash = (aShare: number): ClashPoint => ({
    position: V.vec2(0, 30),
    // Right-angle crossing: maximum bite.
    angle: Math.PI / 2,
    slip: 8,
    intensity: 0.5,
    // Line-on-line: arena cables go through applyCableWear instead.
    kind: 'line',
    a: 0,
    b: 1,
    aShare,
  })

  const duel = (
    playerOverrides: Partial<FighterState> = {},
    rivalOverrides: Partial<FighterState> = {},
  ): FighterState[] => [
    makeFighter('player', -20, V.vec2(20, 40), playerOverrides),
    makeFighter('rival', 20, V.vec2(-20, 40), rivalOverrides),
  ]

  it('does nothing without a crossing', () => {
    const fighters = duel()
    const result = applyAbrasion(fighters, [], 1 / 120)

    expect(result.engaged).toBe(false)
    expect(fighters[0]!.lineIntegrity).toBe(1)
    expect(fighters[1]!.lineIntegrity).toBe(1)
  })

  it('damages the slacker line more than the tauter one', () => {
    const fighters = duel({ tension: 150 }, { tension: 50 })
    const result = applyAbrasion(fighters, [clash(0.75)], 1 / 60)

    expect(result.damage[1]!).toBeGreaterThan(result.damage[0]!)
  })

  it('does no damage when the lines are not sliding', () => {
    const fighters = duel()
    const stationary = { ...clash(0.5), slip: 0 }
    const result = applyAbrasion(fighters, [stationary], 1 / 60)

    expect(result.damage[0]!).toBe(0)
    expect(result.damage[1]!).toBe(0)
  })

  it('bites less at a shallow crossing angle than at a right angle', () => {
    const square = applyAbrasion(duel(), [clash(0.5)], 1 / 60)
    const shallow = applyAbrasion(duel(), [{ ...clash(0.5), angle: 0.08 }], 1 / 60)

    expect(shallow.damage[1]!).toBeLessThan(square.damage[1]!)
  })

  it('marks a fighter as cut once integrity reaches zero', () => {
    const fighters = duel({ tension: 20 }, { tension: 400 })
    fighters[0]!.lineIntegrity = 0.0001

    applyAbrasion(fighters, [clash(0.01)], 1)

    expect(fighters[0]!.lineIntegrity).toBe(0)
    expect(fighters[0]!.alive).toBe(false)
  })

  /**
   * A free-for-all is not three duels run in turn. Damage from every pair has to
   * land on the same step, or the fighter listed first would quietly get a free
   * hit on everyone else.
   */
  it('applies damage from several pairs in one pass', () => {
    const fighters = [
      makeFighter('player', -20, V.vec2(20, 40)),
      makeFighter('rival', 20, V.vec2(-20, 40)),
      makeFighter('rival', 34, V.vec2(-6, 40)),
    ]
    fighters[2]!.index = 2

    const result = applyAbrasion(
      fighters,
      [clash(0.5), { ...clash(0.5), a: 1, b: 2 }],
      1 / 60,
    )

    // Fighter 1 is in both crossings, so it takes damage from both.
    expect(result.damage[1]!).toBeGreaterThan(result.damage[0]!)
    expect(result.damage[2]!).toBeGreaterThan(0)
  })
})

describe('multi-fighter clash detection', () => {
  it('finds the crossing between two opponents, not just against the player', () => {
    // The player flies clear on the left; the two rivals cross each other.
    const player = makeFighter('player', -60, V.vec2(-40, 40))
    const rivalA = makeFighter('rival', 10, V.vec2(40, 40))
    const rivalB = makeFighter('rival', 40, V.vec2(10, 40))
    rivalB.index = 2

    const clashes = detectClashes([player, rivalA, rivalB], [])

    expect(clashes.length).toBeGreaterThan(0)
    expect(clashes.every(clash => clash.a === 1 && clash.b === 2)).toBe(true)
  })
})

describe('exchange advantage', () => {
  it('is even for identical fighters', () => {
    const player = makeFighter('player', -20, V.vec2(20, 40))
    const rival = makeFighter('rival', 20, V.vec2(-20, 40))

    expect(exchangeAdvantage(player, rival)).toBeCloseTo(0.5, 6)
  })

  it('favours the fighter holding more tension', () => {
    const player = makeFighter('player', -20, V.vec2(20, 40), { tension: 160 })
    const rival = makeFighter('rival', 20, V.vec2(-20, 40), { tension: 40 })

    expect(exchangeAdvantage(player, rival)).toBeGreaterThan(0.5)
  })

  it('favours the fighter with better gelasan at equal tension', () => {
    const player = makeFighter('player', -20, V.vec2(20, 40))
    const rival = makeFighter('rival', 20, V.vec2(-20, 40))
    player.stats = { ...player.stats, cutPower: player.stats.cutPower * 2 }

    expect(exchangeAdvantage(player, rival)).toBeGreaterThan(0.5)
  })
})

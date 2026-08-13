import { describe, expect, it } from 'vitest'
import { applyAbrasion, detectClashes, exchangeAdvantage } from '~/services/game/physics/combat'
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

    const clashes = detectClashes(player, rival, [])
    expect(clashes.length).toBeGreaterThan(0)
  })

  it('finds nothing when the lines do not cross', () => {
    const player = makeFighter('player', -40, V.vec2(-20, 40))
    const rival = makeFighter('rival', 40, V.vec2(20, 40))

    expect(detectClashes(player, rival, [])).toHaveLength(0)
  })

  it('finds nothing once a line has been cut', () => {
    const player = makeFighter('player', -20, V.vec2(20, 40), { alive: false })
    const rival = makeFighter('rival', 20, V.vec2(-20, 40))

    expect(detectClashes(player, rival, [])).toHaveLength(0)
  })

  it('gives the tauter line the larger share of the exchange', () => {
    const player = makeFighter('player', -20, V.vec2(20, 40), { tension: 150 })
    const rival = makeFighter('rival', 20, V.vec2(-20, 40), { tension: 50 })

    const clashes = detectClashes(player, rival, [])
    expect(clashes[0]!.playerShare).toBeGreaterThan(0.5)
  })

  it('reports no slip when neither fighter is reeling or moving', () => {
    const player = makeFighter('player', -20, V.vec2(20, 40), { reelRate: 0 })
    const rival = makeFighter('rival', 20, V.vec2(-20, 40), { reelRate: 0 })

    const clashes = detectClashes(player, rival, [])
    expect(clashes[0]!.slip).toBe(0)
  })
})

describe('abrasion', () => {
  const clash = (playerShare: number): ClashPoint => ({
    position: V.vec2(0, 30),
    // Right-angle crossing: maximum bite.
    angle: Math.PI / 2,
    slip: 8,
    playerShare,
    intensity: 0.5,
    // Line-on-line: arena cables go through applyCableWear instead.
    kind: 'line',
  })

  it('does nothing without a crossing', () => {
    const player = makeFighter('player', -20, V.vec2(20, 40))
    const rival = makeFighter('rival', 20, V.vec2(-20, 40))

    const result = applyAbrasion(player, rival, [], 1 / 120)

    expect(result.engaged).toBe(false)
    expect(player.lineIntegrity).toBe(1)
    expect(rival.lineIntegrity).toBe(1)
  })

  it('damages the slacker line more than the tauter one', () => {
    const player = makeFighter('player', -20, V.vec2(20, 40), { tension: 150 })
    const rival = makeFighter('rival', 20, V.vec2(-20, 40), { tension: 50 })

    const result = applyAbrasion(player, rival, [clash(0.75)], 1 / 60)

    expect(result.rivalDamage).toBeGreaterThan(result.playerDamage)
  })

  it('does no damage when the lines are not sliding', () => {
    const player = makeFighter('player', -20, V.vec2(20, 40))
    const rival = makeFighter('rival', 20, V.vec2(-20, 40))

    const stationary = { ...clash(0.5), slip: 0 }
    const result = applyAbrasion(player, rival, [stationary], 1 / 60)

    expect(result.playerDamage).toBe(0)
    expect(result.rivalDamage).toBe(0)
  })

  it('bites less at a shallow crossing angle than at a right angle', () => {
    const square = applyAbrasion(
      makeFighter('player', -20, V.vec2(20, 40)),
      makeFighter('rival', 20, V.vec2(-20, 40)),
      [clash(0.5)],
      1 / 60,
    )

    const shallow = applyAbrasion(
      makeFighter('player', -20, V.vec2(20, 40)),
      makeFighter('rival', 20, V.vec2(-20, 40)),
      [{ ...clash(0.5), angle: 0.08 }],
      1 / 60,
    )

    expect(shallow.rivalDamage).toBeLessThan(square.rivalDamage)
  })

  it('marks a fighter as cut once integrity reaches zero', () => {
    const player = makeFighter('player', -20, V.vec2(20, 40), { tension: 20 })
    const rival = makeFighter('rival', 20, V.vec2(-20, 40), { tension: 400 })
    player.lineIntegrity = 0.0001

    applyAbrasion(player, rival, [clash(0.01)], 1)

    expect(player.lineIntegrity).toBe(0)
    expect(player.alive).toBe(false)
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

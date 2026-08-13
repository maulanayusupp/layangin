import { describe, expect, it } from 'vitest'
import { computeAerodynamics, trimmedHeading } from '~/services/game/physics/aerodynamics'
import { catenarySag, applyLineConstraint } from '~/services/game/physics/tether'
import { createWindField, describeWind } from '~/services/game/physics/wind'
import { WIND_REFERENCE_HEIGHT } from '~/services/game/constants'
import { getKite } from '~/data/kites'
import * as V from '~/services/game/math/vector'

describe('wind field', () => {
  it('is weaker near the ground than at the reference height', () => {
    const wind = createWindField({ referenceSpeed: 6, gustiness: 0, seed: 1 })

    const low = wind.sample(1).speed
    const reference = wind.sample(WIND_REFERENCE_HEIGHT).speed
    const high = wind.sample(80).speed

    expect(low).toBeLessThan(reference)
    expect(high).toBeGreaterThan(reference)
  })

  it('matches the reference speed at the reference height with no gust', () => {
    const wind = createWindField({ referenceSpeed: 7, gustiness: 0, seed: 42 })
    expect(wind.sample(WIND_REFERENCE_HEIGHT).speed).toBeCloseTo(7, 5)
  })

  it('replays identically from the same seed', () => {
    const a = createWindField({ referenceSpeed: 6, gustiness: 0.6, seed: 99 })
    const b = createWindField({ referenceSpeed: 6, gustiness: 0.6, seed: 99 })

    for (let i = 0; i < 50; i += 1) {
      a.update(1 / 120)
      b.update(1 / 120)
      expect(a.sample(40).speed).toBe(b.sample(40).speed)
    }
  })

  it('describes speeds in ascending bands', () => {
    expect(describeWind(1)).toBe('calm')
    expect(describeWind(3)).toBe('light')
    expect(describeWind(6)).toBe('good')
    expect(describeWind(9)).toBe('strong')
    expect(describeWind(14)).toBe('wild')
  })
})

describe('aerodynamics', () => {
  const stats = getKite('pecut').stats

  it('produces no force in still air relative to the kite', () => {
    const result = computeAerodynamics(stats, V.vec2(0, 0), V.vec2(0, 0), 0)
    expect(V.length(result.force)).toBe(0)
  })

  it('scales force with the square of apparent wind speed', () => {
    const slow = computeAerodynamics(stats, V.vec2(0, 0), V.vec2(4, 0), 0.4)
    const fast = computeAerodynamics(stats, V.vec2(0, 0), V.vec2(8, 0), 0.4)

    // Doubling the speed should quadruple the force, since q = ½ρV².
    expect(V.length(fast.force) / V.length(slow.force)).toBeCloseTo(4, 1)
  })

  it('stalls past the lift peak: lift falls as angle of attack grows beyond 45°', () => {
    const wind = V.vec2(7, 0)
    const atPeak = computeAerodynamics(stats, V.vec2(0, 0), wind, Math.PI / 4)
    const pastPeak = computeAerodynamics(stats, V.vec2(0, 0), wind, Math.PI / 2.05)

    expect(Math.abs(pastPeak.lift)).toBeLessThan(Math.abs(atPeak.lift))
  })

  it('reports drag growing toward the flat-plate value as the sail turns broadside', () => {
    const wind = V.vec2(7, 0)
    const edgeOn = computeAerodynamics(stats, V.vec2(0, 0), wind, 0)
    const broadside = computeAerodynamics(stats, V.vec2(0, 0), wind, Math.PI / 2)

    expect(broadside.drag).toBeGreaterThan(edgeOn.drag)
  })

  it('keeps the sail a quarter turn off the line, offset by trim and steering', () => {
    // Kite directly overhead: the line points at +90°.
    const heading = trimmedHeading(V.vec2(0, 0), V.vec2(0, 50), 0.3, 0)
    expect(heading).toBeCloseTo(Math.PI / 2 - Math.PI / 2 + 0.3, 6)
  })
})

describe('tether', () => {
  it('has no sag when the line is straight', () => {
    expect(catenarySag(50, 50)).toBe(0)
    expect(catenarySag(50, 40)).toBe(0)
  })

  it('sags more as more line is paid out', () => {
    const little = catenarySag(50, 52)
    const lots = catenarySag(50, 60)

    expect(little).toBeGreaterThan(0)
    expect(lots).toBeGreaterThan(little)
  })

  it('leaves a slack kite unconstrained and reports only line weight', () => {
    const position = V.vec2(30, 30)
    const velocity = V.vec2(1, 1)

    const result = applyLineConstraint(
      V.vec2(0, 0),
      position,
      velocity,
      100,
      0.25,
      V.vec2(0, 0),
      1 / 120,
    )

    expect(result.taut).toBe(false)
    // Position untouched.
    expect(position).toEqual({ x: 30, y: 30 })
  })

  it('pulls an over-extended kite back onto the line and cancels outward velocity', () => {
    const anchor = V.vec2(0, 0)
    // 50 m from the anchor along +x, on a 40 m line.
    const position = V.vec2(50, 0)
    const velocity = V.vec2(10, 0)

    const result = applyLineConstraint(
      anchor,
      position,
      velocity,
      40,
      0.25,
      V.vec2(0, 0),
      1 / 120,
    )

    expect(result.taut).toBe(true)
    expect(V.distance(anchor, position)).toBeCloseTo(40, 6)
    // The outward (radial) component is removed.
    expect(velocity.x).toBeCloseTo(0, 6)
    expect(result.tension).toBeGreaterThan(0)
  })

  it('preserves tangential velocity while cancelling the radial part', () => {
    const anchor = V.vec2(0, 0)
    const position = V.vec2(50, 0)
    // Purely tangential motion: no radial component to remove.
    const velocity = V.vec2(0, 6)

    applyLineConstraint(anchor, position, velocity, 40, 0.25, V.vec2(0, 0), 1 / 120)

    expect(velocity.y).toBeCloseTo(6, 6)
  })
})

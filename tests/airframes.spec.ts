import { describe, expect, it } from 'vitest'
import { KITES, getKite } from '~/data/kites'
import { GENERATED_AIRFRAMES } from '~/data/airframes'
import { buildAirframe } from '~/services/game/geometry/airframe'
import { buildOutline, outlineChord, outlineSpan, polygonArea } from '~/services/game/geometry/outline'
import { rateLoadout } from '~/services/game/loadout'
import { OPPONENTS } from '~/data/opponents'

describe('airframe catalog', () => {
  it('offers fifty airframes', () => {
    expect(KITES).toHaveLength(50)
  })

  it('has unique ids', () => {
    expect(new Set(KITES.map(kite => kite.id)).size).toBe(KITES.length)
  })

  it('gives every airframe a drawable sail', () => {
    for (const kite of KITES) {
      const hull = kite.geometry.panels[0]
      expect(hull, kite.id).toBeDefined()
      expect(hull!.points.length, kite.id).toBeGreaterThanOrEqual(3)
      expect(polygonArea(hull!.points), kite.id).toBeGreaterThan(0.05)
    }
  })

  /**
   * The point of the catalog is fifty *shapes*, not fifty colours. Comparing
   * normalised span/chord/area/fill signatures catches an accidental duplicate
   * far more reliably than reading the data.
   */
  it('gives every airframe a distinct silhouette', () => {
    const signatures = new Map<string, string>()

    for (const kite of KITES) {
      const hull = kite.geometry.panels[0]!.points
      const span = outlineSpan(hull)
      const chord = outlineChord(hull)
      const area = polygonArea(hull)
      const tailLength = kite.geometry.tails.reduce((total, tail) => total + tail.length, 0)

      const signature = [
        hull.length,
        span.toFixed(2),
        chord.toFixed(2),
        area.toFixed(2),
        (area / (span * chord)).toFixed(2),
        kite.geometry.tails.length,
        tailLength.toFixed(1),
      ].join('|')

      const clash = signatures.get(signature)
      expect(clash, `${kite.id} has the same silhouette as ${clash}`).toBeUndefined()
      signatures.set(signature, kite.id)
    }
  })

  it('keeps every stat physically plausible', () => {
    for (const kite of KITES) {
      const { stats } = kite
      expect(stats.area, `${kite.id} area`).toBeGreaterThan(0.2)
      expect(stats.area, `${kite.id} area`).toBeLessThan(6)
      expect(stats.mass, `${kite.id} mass`).toBeGreaterThan(0.05)
      expect(stats.mass, `${kite.id} mass`).toBeLessThan(2)
      expect(stats.liftCoefficient, `${kite.id} lift`).toBeGreaterThan(0.5)
      expect(stats.liftCoefficient, `${kite.id} lift`).toBeLessThan(2)
      expect(stats.dragCoefficient, `${kite.id} drag`).toBeGreaterThan(0)
      expect(stats.dragCoefficient, `${kite.id} drag`).toBeLessThan(1)
      expect(stats.agility, `${kite.id} agility`).toBeGreaterThan(0)
      expect(stats.stability, `${kite.id} stability`).toBeGreaterThan(0)
      expect(stats.lineStrength, `${kite.id} line`).toBeGreaterThan(0)
      expect(stats.cutPower, `${kite.id} cut`).toBeGreaterThan(0)
    }
  })

  it('keeps every codex rating inside 0..1', () => {
    for (const kite of KITES) {
      for (const [key, value] of Object.entries(rateLoadout(kite.id))) {
        expect(value, `${kite.id}.${key}`).toBeGreaterThanOrEqual(0)
        expect(value, `${kite.id}.${key}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('starts the player with exactly one free airframe', () => {
    expect(KITES.filter(kite => kite.price === 0)).toHaveLength(1)
  })

  it('prices higher tiers above lower ones', () => {
    const cheapestOf = (rarity: string): number =>
      Math.min(...KITES.filter(kite => kite.rarity === rarity).map(kite => kite.price))

    expect(cheapestOf('legend')).toBeGreaterThan(cheapestOf('epic'))
    expect(cheapestOf('epic')).toBeGreaterThan(cheapestOf('rare'))
    expect(cheapestOf('rare')).toBeGreaterThan(cheapestOf('uncommon'))
  })

  it('keeps every opponent flying an airframe that exists', () => {
    for (const opponent of OPPONENTS) {
      expect(() => getKite(opponent.kiteId), opponent.id).not.toThrow()
    }
  })
})

describe('outline generator', () => {
  it('closes every outline kind with a usable polygon', () => {
    for (const spec of GENERATED_AIRFRAMES) {
      const outline = buildOutline(spec.outline)
      expect(outline.length, spec.id).toBeGreaterThanOrEqual(3)
      expect(polygonArea(outline), spec.id).toBeGreaterThan(0.05)
    }
  })

  it('keeps every point inside the unit square the renderer assumes', () => {
    for (const spec of GENERATED_AIRFRAMES) {
      for (const point of buildOutline(spec.outline)) {
        expect(Math.abs(point.x), spec.id).toBeLessThanOrEqual(1.001)
        expect(Math.abs(point.y), spec.id).toBeLessThanOrEqual(1.001)
      }
    }
  })

  it('derives more area for a wider sail', () => {
    const base = GENERATED_AIRFRAMES[0]!
    const narrow = buildAirframe({ ...base, outline: { ...base.outline, shoulder: 0.4 } })
    const wide = buildAirframe({ ...base, outline: { ...base.outline, shoulder: 0.9 } })

    expect(wide.stats.area).toBeGreaterThan(narrow.stats.area)
  })

  it('derives more tail drag for a longer tail', () => {
    const base = GENERATED_AIRFRAMES[0]!
    const short = buildAirframe({
      ...base,
      tails: [{ kind: 'ribbon', length: 0.5, width: 0.1 }],
    })
    const long = buildAirframe({
      ...base,
      tails: [{ kind: 'dragon', length: 6, width: 0.2 }],
    })

    expect(long.stats.tailDrag).toBeGreaterThan(short.stats.tailDrag)
    // And a draggier tail must cost agility and buy stability.
    expect(long.stats.agility).toBeLessThan(short.stats.agility)
    expect(long.stats.stability).toBeGreaterThan(short.stats.stability)
  })

  it('is deterministic: the same spec always builds the same airframe', () => {
    const spec = GENERATED_AIRFRAMES[10]!
    expect(buildAirframe(spec).stats).toEqual(buildAirframe(spec).stats)
  })
})

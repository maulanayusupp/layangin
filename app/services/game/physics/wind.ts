import { WIND_REFERENCE_HEIGHT, WIND_SHEAR_EXPONENT } from '../constants'
import { createNoiseField, type NoiseField } from '../math/noise'
import { clamp } from '../math/scalar'
import type { WindSample } from '../types'
import { vec2 } from '../math/vector'

/**
 * Wind field for one match.
 *
 * Two real effects are modelled:
 *
 * 1. **Shear** — wind is slower near the ground because of surface friction.
 *    The standard engineering approximation is the power law
 *    `v(h) = v_ref · (h / h_ref)^α`, with α ≈ 0.143 over open country. This is
 *    why a kite that loses altitude also loses lift and tends to keep sinking,
 *    and why height is worth fighting for.
 *
 * 2. **Gusts** — fractal value noise in both speed and direction, so the air
 *    swells and lulls instead of blowing at a constant rate. Seeded from the
 *    match seed, so the same match replays identically.
 */
export interface WindField {
  /** Reference speed at 10 m, m/s. Constant for the match. */
  readonly referenceSpeed: number
  /** Advance the internal clock. */
  update(dt: number): void
  /** Wind vector at a given altitude, m/s. */
  sample(altitude: number): WindSample
  /** Current reference-height speed including gust, for the HUD gauge. */
  currentReferenceSpeed(): number
}

export interface WindOptions {
  /** Mean speed at 10 m, m/s. */
  referenceSpeed: number
  /** 0..1 — how strongly gusts modulate the mean. */
  gustiness: number
  seed: number
}

export function createWindField({ referenceSpeed, gustiness, seed }: WindOptions): WindField {
  const speedNoise: NoiseField = createNoiseField(seed, 3)
  const angleNoise: NoiseField = createNoiseField(seed ^ 0x9e3779b9, 2)

  let time = 0

  /** Gust factor around 1. Clamped so the air never fully stops or doubles. */
  const gustFactor = (): number => {
    // 0.22 Hz swell — matches the slow surge you feel holding a real line.
    const swell = speedNoise.sample(time * 0.22)
    return clamp(1 + swell * gustiness * 0.55, 0.35, 1.75)
  }

  /** Small directional wander, radians. Vertical component of real turbulence. */
  const driftAngle = (): number => angleNoise.sample(time * 0.17) * gustiness * 0.22

  const speedAt = (altitude: number): number => {
    // Below the reference height the profile falls off; clamp the base so the
    // exponent never sees a zero or negative altitude.
    const height = Math.max(altitude, 0.6)
    const shear = (height / WIND_REFERENCE_HEIGHT) ** WIND_SHEAR_EXPONENT
    return referenceSpeed * shear * gustFactor()
  }

  return {
    referenceSpeed,

    update(dt: number): void {
      time += dt
    },

    sample(altitude: number): WindSample {
      const speed = speedAt(altitude)
      const angle = driftAngle()
      return {
        velocity: vec2(Math.cos(angle) * speed, Math.sin(angle) * speed),
        speed,
      }
    },

    currentReferenceSpeed(): number {
      return referenceSpeed * gustFactor()
    },
  }
}

/**
 * Beaufort-style descriptor for the HUD, returned as an i18n key suffix so the
 * label is translated rather than hardcoded.
 */
export function describeWind(speed: number): 'calm' | 'light' | 'good' | 'strong' | 'wild' {
  if (speed < 2.5) return 'calm'
  if (speed < 4.5) return 'light'
  if (speed < 7.5) return 'good'
  if (speed < 10.5) return 'strong'
  return 'wild'
}

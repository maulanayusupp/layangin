import { createRandom } from './random'

/**
 * 1D value noise with fractal octaves — the gust generator for the wind field.
 *
 * Real wind is not white noise: it drifts in slow swells with faster ripples on
 * top. Summing octaves of smoothly interpolated random values reproduces that
 * character, and because the lattice is seeded the whole gust timeline is
 * reproducible from the match seed.
 */
export interface NoiseField {
  /** Smooth value in roughly -1..1 at position `t`. */
  sample(t: number): number
}

const LATTICE_SIZE = 512

export function createNoiseField(seed: number, octaves = 3): NoiseField {
  const random = createRandom(seed)
  const lattice = new Float32Array(LATTICE_SIZE)
  for (let i = 0; i < LATTICE_SIZE; i += 1) {
    lattice[i] = random.next() * 2 - 1
  }

  const valueAt = (index: number): number => {
    // Wrap with a bitmask: LATTICE_SIZE is a power of two.
    return lattice[index & (LATTICE_SIZE - 1)] as number
  }

  const smoothValue = (t: number): number => {
    const i = Math.floor(t)
    const frac = t - i
    // Cosine interpolation: C1-continuous, cheap, no derivative table needed.
    const weight = (1 - Math.cos(frac * Math.PI)) * 0.5
    return valueAt(i) * (1 - weight) + valueAt(i + 1) * weight
  }

  return {
    sample(t: number): number {
      let total = 0
      let amplitude = 1
      let frequency = 1
      let normalisation = 0

      for (let octave = 0; octave < octaves; octave += 1) {
        total += smoothValue(t * frequency) * amplitude
        normalisation += amplitude
        amplitude *= 0.5
        frequency *= 2.13 // non-integer so octaves do not phase-align
      }

      return normalisation === 0 ? 0 : total / normalisation
    },
  }
}

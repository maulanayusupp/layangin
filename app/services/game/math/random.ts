/**
 * Seeded pseudo-random number generation.
 *
 * The simulation must never call `Math.random()` directly: a match seeded with
 * the same value has to replay identically. That property is what makes the
 * planned PVP netcode (lockstep / rollback) possible later, and it also lets us
 * reproduce a bug report from its seed. See TODO.md → "Online play".
 */

export interface RandomSource {
  /** Uniform float in [0, 1). */
  next(): number
  /** Uniform float in [min, max). */
  range(min: number, max: number): number
  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number
  /** True with the given probability (0..1). */
  chance(probability: number): boolean
  pick<T>(items: readonly T[]): T
  /** Approximately normal, mean 0, standard deviation 1. */
  gaussian(): number
}

/**
 * mulberry32 — small, fast, statistically adequate for gameplay.
 * Not cryptographic; never use it for anything security related.
 */
export function createRandom(seed: number): RandomSource {
  let state = seed >>> 0

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: probability => next() < probability,
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('pick() called with an empty array')
      return items[Math.floor(next() * items.length)] as T
    },
    // Irwin–Hall approximation: cheap and good enough for gust/AI jitter.
    gaussian: () => (next() + next() + next() + next() + next() + next() - 3) / 0.7071,
  }
}

/** Derive a stable numeric seed from a string (FNV-1a). */
export function seedFromString(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * Seed for a fresh match. This is the one place a non-deterministic source is
 * allowed, because the value is recorded and can be replayed.
 */
export function createMatchSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}

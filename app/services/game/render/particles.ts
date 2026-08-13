import type { RandomSource } from '../math/random'
import { clamp01 } from '../math/scalar'
import type { Vec2 } from '../math/vector'
import type { TrailEffect } from '../types'

/**
 * Particle pool for trail effects and clash sparks.
 *
 * Fixed-capacity and index-recycled: allocating particle objects per frame is
 * the classic way a canvas game ends up stuttering under GC pressure. Dead
 * particles are simply overwritten.
 *
 * Positions are in **world metres** so particles keep their size and drift when
 * the camera zooms.
 */
export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  /** Remaining life in seconds; <= 0 means the slot is free. */
  life: number
  maxLife: number
  size: number
  color: string
  /** Sparks are drawn as bright streaks, trail motes as soft dots. */
  spark: boolean
}

const CAPACITY = 520

export interface ParticleSystem {
  readonly particles: readonly Particle[]
  /** Emit trail motes behind a kite. `dt` carries the fractional emission over. */
  emitTrail(
    effect: TrailEffect,
    position: Vec2,
    velocity: Vec2,
    color: string,
    dt: number,
    key: 'player' | 'rival',
  ): void
  /** Burst of sparks where two lines saw against each other. */
  emitSparks(position: Vec2, intensity: number, dt: number): void
  /**
   * Glass dust shed from the contact point.
   *
   * Separate from sparks on purpose: a spark is a hot fragment that flies off and
   * falls, dust is powdered glass off the *gelasan* coating that hangs in the air
   * and drifts downwind. Having both is what makes a crossing read as grinding
   * rather than as a light show.
   */
  emitDust(position: Vec2, intensity: number, dt: number): void
  update(dt: number, windX: number): void
  clear(): void
}

export function createParticleSystem(random: RandomSource): ParticleSystem {
  const particles: Particle[] = Array.from({ length: CAPACITY }, () => ({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 1,
    color: '#fff',
    spark: false,
  }))

  let cursor = 0
  // Fractional emission carried between frames, per emitter, so a 14/second
  // effect still emits at 14/second when the frame rate is 60.
  const carry = { player: 0, rival: 0, sparks: 0, dust: 0 }

  const spawn = (): Particle => {
    // Round-robin: the oldest slot is overwritten when the pool is saturated.
    const particle = particles[cursor] as Particle
    cursor = (cursor + 1) % CAPACITY
    return particle
  }

  return {
    particles,

    emitTrail(effect, position, velocity, color, dt, key): void {
      if (effect.emissionRate <= 0) return

      carry[key] += effect.emissionRate * dt
      const count = Math.floor(carry[key])
      carry[key] -= count

      for (let i = 0; i < count; i += 1) {
        const particle = spawn()
        particle.x = position.x + random.range(-0.4, 0.4)
        particle.y = position.y + random.range(-0.4, 0.4)
        // Motes are shed backwards from the kite, then taken by the wind.
        particle.vx = -velocity.x * 0.25 + random.range(-1.2, 1.2)
        particle.vy = -velocity.y * 0.25 + random.range(-0.8, 0.8) + effect.buoyancy
        particle.life = effect.lifetime * random.range(0.7, 1.2)
        particle.maxLife = particle.life
        particle.size = effect.size * random.range(0.6, 1.3)
        particle.color = color
        particle.spark = false
      }
    },

    emitSparks(position, intensity, dt): void {
      if (intensity <= 0.02) return

      carry.sparks += intensity * 90 * dt
      const count = Math.floor(carry.sparks)
      carry.sparks -= count

      for (let i = 0; i < count; i += 1) {
        const particle = spawn()
        const angle = random.range(0, Math.PI * 2)
        const speed = random.range(2, 9) * (0.5 + intensity)
        particle.x = position.x
        particle.y = position.y
        particle.vx = Math.cos(angle) * speed
        particle.vy = Math.sin(angle) * speed
        particle.life = random.range(0.12, 0.4)
        particle.maxLife = particle.life
        particle.size = random.range(0.6, 1.5)
        particle.color = random.chance(0.35) ? '#fff4d6' : '#ffd98a'
        particle.spark = true
      }
    },

    emitDust(position, intensity, dt): void {
      if (intensity <= 0.02) return

      carry.dust += intensity * 34 * dt
      const count = Math.floor(carry.dust)
      carry.dust -= count

      for (let i = 0; i < count; i += 1) {
        const particle = spawn()
        const angle = random.range(0, Math.PI * 2)
        // Much slower than a spark: this is powder falling out of a contact, not
        // metal being thrown from it.
        const speed = random.range(0.2, 1.6)
        particle.x = position.x
        particle.y = position.y
        particle.vx = Math.cos(angle) * speed
        particle.vy = Math.sin(angle) * speed
        particle.life = random.range(0.5, 1.3)
        particle.maxLife = particle.life
        particle.size = random.range(0.4, 1.1)
        particle.color = random.chance(0.5) ? '#e8edf5' : '#c9d4e4'
        // Not a spark: the wind owns it and it lingers.
        particle.spark = false
      }
    },

    update(dt: number, windX: number): void {
      for (const particle of particles) {
        if (particle.life <= 0) continue

        particle.life -= dt

        // Sparks are hot fragments: they fall. Motes are light: the wind owns them.
        if (particle.spark) {
          particle.vy -= 14 * dt
        }
        else {
          particle.vx += (windX * 0.6 - particle.vx) * 1.4 * dt
          particle.vy -= 1.1 * dt
        }

        particle.x += particle.vx * dt
        particle.y += particle.vy * dt
      }
    },

    clear(): void {
      for (const particle of particles) particle.life = 0
      carry.player = 0
      carry.rival = 0
      carry.sparks = 0
      carry.dust = 0
    },
  }
}

/** 0..1 remaining-life fraction, for fading. */
export function particleAlpha(particle: Particle): number {
  return clamp01(particle.life / particle.maxLife)
}

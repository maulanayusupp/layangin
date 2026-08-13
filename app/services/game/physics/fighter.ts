import {
  BASE_TRIM_ANGLE,
  CRASH_ALTITUDE,
  EXHAUSTED_EFFECTIVENESS,
  GRAVITY,
  HAUL_TRIM_BONUS,
  LINE_BREAK_TENSION,
  MAX_BANK,
  MAX_LINE_LENGTH,
  MIN_LINE_LENGTH,
  OVERLOAD_COEFFICIENT,
  SNAP_COOLDOWN,
  SNAP_DURATION,
  SNAP_FORCE_MULTIPLIER,
  SNAP_STAMINA_COST,
  STAMINA_DRAIN_RATE,
  STAMINA_RECOVERY_RATE,
  START_LINE_LENGTH,
  WALK_BOUND,
  WALK_SPEED,
} from '../constants'
import { clamp, clamp01, damp, lerp } from '../math/scalar'
import * as V from '../math/vector'
import type { Vec2 } from '../math/vector'
import type { FighterCommand, FighterSide, FighterState, KiteStats, WindSample } from '../types'
import { computeAerodynamics, trimmedHeading } from './aerodynamics'
import { applyLineConstraint, sampleLine } from './tether'

export interface FighterInit {
  side: FighterSide
  anchorX: number
  stats: KiteStats
  reelSpeed: number
  kiteId: FighterState['kiteId']
  paletteId: FighterState['paletteId']
  patternId: FighterState['patternId']
  effectId: FighterState['effectId']
  /** Divides stamina drain. Comes from the stamina upgrade. */
  staminaEfficiency: number
}

export function createFighter(init: FighterInit): FighterState {
  const anchor = V.vec2(init.anchorX, 0)
  // Start already aloft and downwind, at a plausible launch attitude, so a
  // match opens in flight rather than with a launch minigame.
  const position = V.vec2(init.anchorX + START_LINE_LENGTH * 0.55, START_LINE_LENGTH * 0.66)

  return {
    side: init.side,
    kiteId: init.kiteId,
    paletteId: init.paletteId,
    patternId: init.patternId,
    effectId: init.effectId,
    stats: init.stats,
    reelSpeed: init.reelSpeed,

    anchor,
    position,
    velocity: V.vec2(0, 0),
    heading: 0,
    bank: 0,

    lineLength: START_LINE_LENGTH,
    reelRate: 0,
    tension: 0,
    lineIntegrity: 1,
    stamina: 1,
    staminaEfficiency: Math.max(0.1, init.staminaEfficiency),
    snapCooldown: 0,
    snapActive: 0,

    linePoints: [],
    snagged: false,
    alive: true,
  }
}

/** Peak tension this fighter's line survives, in newtons. */
export function breakingTension(stats: KiteStats): number {
  return LINE_BREAK_TENSION * stats.lineStrength
}

/**
 * Advance one fighter by a fixed step.
 *
 * Order matters: intent → line length → forces → integration → constraint.
 * Solving the constraint last is what makes hauling in accelerate the kite,
 * because the constraint physically drags it toward the anchor and that raises
 * the apparent wind on the next step.
 */
export function stepFighter(
  state: FighterState,
  command: FighterCommand,
  wind: WindSample,
  windDirection: number,
  dt: number,
): void {
  if (!state.alive) return

  // --- Intent ---------------------------------------------------------------
  state.anchor.x = clamp(state.anchor.x + command.walk * WALK_SPEED * dt, -WALK_BOUND, WALK_BOUND)

  state.snapCooldown = Math.max(0, state.snapCooldown - dt)
  state.snapActive = Math.max(0, state.snapActive - dt)

  if (command.snap && state.snapCooldown === 0 && state.stamina >= SNAP_STAMINA_COST) {
    state.snapActive = SNAP_DURATION
    state.snapCooldown = SNAP_COOLDOWN
    state.stamina = clamp01(state.stamina - SNAP_STAMINA_COST / state.staminaEfficiency)
  }

  const haul = Math.max(0, command.reel)
  const payOut = Math.max(0, -command.reel)

  // Tired arms cannot haul hard; paying line out costs nothing.
  const effectiveness = lerp(EXHAUSTED_EFFECTIVENESS, 1, state.stamina)
  const snapping = state.snapActive > 0
  const haulBoost = snapping ? SNAP_FORCE_MULTIPLIER : 1

  state.reelRate = haul * state.reelSpeed * effectiveness * haulBoost - payOut * state.reelSpeed

  state.lineLength = clamp(
    state.lineLength - state.reelRate * dt,
    MIN_LINE_LENGTH,
    MAX_LINE_LENGTH,
  )

  const staminaDelta
    = haul > 0
      ? (-STAMINA_DRAIN_RATE * haul) / state.staminaEfficiency
      : STAMINA_RECOVERY_RATE * state.staminaEfficiency
  state.stamina = clamp01(state.stamina + staminaDelta * dt)

  // --- Attitude -------------------------------------------------------------
  // Walking sideways also loads one side of the bridle, which banks the sail.
  const bankTarget = clamp(command.walk, -1, 1) * MAX_BANK
  // `agility` sets how fast the sail answers; `stability` resists the change.
  const bankResponse = state.stats.agility / (1 + state.stats.stability)
  state.bank = damp(state.bank, bankTarget, Math.exp(-bankResponse), dt)

  const trim = BASE_TRIM_ANGLE + HAUL_TRIM_BONUS * haul
  state.heading = trimmedHeading(state.anchor, state.position, trim, state.bank)

  // --- Forces ---------------------------------------------------------------
  const aero = computeAerodynamics(state.stats, state.velocity, wind.velocity, state.heading)
  const force: Vec2 = V.vec2(aero.force.x, aero.force.y - state.stats.mass * GRAVITY)

  // --- Integrate ------------------------------------------------------------
  const inverseMass = 1 / state.stats.mass
  state.velocity.x += force.x * inverseMass * dt
  state.velocity.y += force.y * inverseMass * dt

  // Small numerical damping. Physical damping already comes from drag; this only
  // suppresses integrator ringing at high tension.
  const numericalDamping = 0.9995 ** (dt * 120)
  state.velocity.x *= numericalDamping
  state.velocity.y *= numericalDamping

  state.position.x += state.velocity.x * dt
  state.position.y += state.velocity.y * dt

  if (state.position.y < 0) {
    state.position.y = 0
    state.velocity.y = Math.max(0, state.velocity.y)
  }

  // --- Line -----------------------------------------------------------------
  const constraint = applyLineConstraint(
    state.anchor,
    state.position,
    state.velocity,
    state.lineLength,
    state.stats.mass,
    force,
    dt,
  )
  state.tension = constraint.tension

  sampleLine(state.anchor, state.position, state.lineLength, windDirection, state.linePoints)

  // --- Overload -------------------------------------------------------------
  // Hauling a kite in a hard gust can part the line on its own. This is the
  // counterweight to "just hold pull forever".
  const limit = breakingTension(state.stats)
  if (state.tension > limit) {
    state.lineIntegrity = clamp01(
      state.lineIntegrity - OVERLOAD_COEFFICIENT * (state.tension - limit) * dt,
    )
  }

  if (state.lineIntegrity <= 0) {
    state.alive = false
  }
}

/** True once the kite has been driven into the ground. */
export function hasCrashed(state: FighterState): boolean {
  return state.position.y <= CRASH_ALTITUDE
}

/**
 * Free flight after the line is cut: the kite is carried off downwind, which is
 * the moment everyone on the ground starts running after it.
 */
export function driftCutKite(state: FighterState, wind: WindSample, dt: number): void {
  const drag = 0.55
  state.velocity.x += (wind.velocity.x - state.velocity.x) * drag * dt
  state.velocity.y += (wind.velocity.y - state.velocity.y) * drag * dt - GRAVITY * 0.35 * dt
  state.position.x += state.velocity.x * dt
  state.position.y = Math.max(0, state.position.y + state.velocity.y * dt)
  state.heading += dt * 1.4
  state.tension = 0
  state.linePoints.length = 0
}

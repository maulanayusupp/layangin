import {
  AIR_DENSITY,
  BASE_TRIM_ANGLE,
  CRASH_ALTITUDE,
  EXHAUSTED_EFFECTIVENESS,
  GRAVITY,
  HAUL_TRIM_BONUS,
  LAUNCH_ELEVATION,
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
  STARTING_HP,
  START_LINE_LENGTH,
  TENSION_SMOOTHING,
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
  /** Position in the match's fighter list. 0 is the human. */
  index: number
  /** The opponent definition being flown, or null for the human. */
  opponentId?: FighterState['opponentId']
  anchorX: number
  stats: KiteStats
  reelSpeed: number
  kiteId: FighterState['kiteId']
  paletteId: FighterState['paletteId']
  patternId: FighterState['patternId']
  effectId: FighterState['effectId']
  /** Divides stamina drain. Comes from the stamina upgrade. */
  staminaEfficiency: number
  /** Minimum launch altitude, so a match never opens inside a structure. */
  minAltitude?: number
  /** How far this fighter may walk from centre. Defaults to the duel bound. */
  walkBound?: number
  /** Lives. Defaults to the duel value; a crowded sky gets fewer — see `livesFor`. */
  lives?: number
}

/**
 * Where a kite starts, and on how much line, always taut at `LAUNCH_ELEVATION`.
 *
 * Taut is the important part — see the note on `LAUNCH_ELEVATION`. When an arena
 * hazard forces a higher start, the elevation is raised rather than the line
 * lengthened, so the line stays under tension either way.
 */
interface Launch {
  position: V.Vec2
  /** Line length to start with; always equal to the span, so the line is taut. */
  lineLength: number
}

function launchState(anchorX: number, minAltitude: number): Launch {
  /** Never launch past the lift reversal at 90° − trim, or the sail has no lift. */
  const steepest = Math.PI / 2 - BASE_TRIM_ANGLE - 0.05

  /**
   * Both sides launch at the same elevation.
   *
   * Spreading them apart so the lines cross immediately was tried and measured
   * worse: the flatter kite sits lower in weaker air, so the fighter given the flat
   * launch lost every opening exchange — against the last boss the match was over in
   * a single second. A fair launch is worth the few seconds of manoeuvring.
   */
  const elevation = minAltitude > 0
    ? Math.min(steepest, Math.max(LAUNCH_ELEVATION, Math.asin(Math.min(1, minAltitude / START_LINE_LENGTH))))
    : LAUNCH_ELEVATION

  // A tall obstacle can need more altitude than the default line reaches at a
  // flyable elevation — the monument arena's 62 m tower against a 62 m line. In
  // that case pay out more line rather than standing the kite up vertically,
  // which would leave it with no lift at all.
  const required = minAltitude > 0 ? minAltitude / Math.sin(elevation) : 0
  const lineLength = clamp(Math.max(START_LINE_LENGTH, required), MIN_LINE_LENGTH, MAX_LINE_LENGTH)

  return {
    position: V.vec2(
      anchorX + Math.cos(elevation) * lineLength,
      Math.sin(elevation) * lineLength,
    ),
    lineLength,
  }
}

export function createFighter(init: FighterInit): FighterState {
  const anchor = V.vec2(init.anchorX, 0)
  // Start already aloft and downwind, at a plausible launch attitude, so a
  // match opens in flight rather than with a launch minigame.
  const launch = launchState(init.anchorX, init.minAltitude ?? 0)

  return {
    side: init.side,
    index: init.index,
    opponentId: init.opponentId ?? null,
    kiteId: init.kiteId,
    paletteId: init.paletteId,
    patternId: init.patternId,
    effectId: init.effectId,
    stats: init.stats,
    reelSpeed: init.reelSpeed,

    anchor,
    position: launch.position,
    velocity: V.vec2(0, 0),
    heading: 0,
    bank: 0,

    lineLength: launch.lineLength,
    reelRate: 0,
    tension: 0,
    lineIntegrity: 1,
    hp: init.lives ?? STARTING_HP,
    eliminated: false,
    stamina: 1,
    staminaEfficiency: Math.max(0.1, init.staminaEfficiency),
    walkBound: init.walkBound ?? WALK_BOUND,
    snapCooldown: 0,
    snapActive: 0,

    linePoints: [],
    snagged: false,
    alive: true,
  }
}

/**
 * Put a fighter back in the air for a new round.
 *
 * Restores the line and the launch attitude but deliberately **keeps `hp`** — the
 * lives are the match score, not per-round state. Stamina is refilled too: a
 * round loss should not also hand the winner a tired opponent, which would snowball.
 */
export function relaunchFighter(
  state: FighterState,
  anchorX: number,
  /** Minimum launch altitude, so a round never begins inside a structure. */
  minAltitude = 0,
): void {
  state.anchor.x = anchorX
  state.anchor.y = 0

  const launch = launchState(anchorX, minAltitude)
  state.position.x = launch.position.x
  state.position.y = launch.position.y
  state.velocity.x = 0
  state.velocity.y = 0

  state.heading = 0
  state.bank = 0
  state.lineLength = launch.lineLength
  state.reelRate = 0
  state.tension = 0
  state.lineIntegrity = 1
  state.stamina = 1
  state.snapCooldown = 0
  state.snapActive = 0
  state.linePoints.length = 0
  state.snagged = false
  state.alive = true
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
  state.anchor.x = clamp(
    state.anchor.x + command.walk * WALK_SPEED * dt,
    -state.walkBound,
    state.walkBound,
  )

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
  )
  /**
   * The pull the fighter is adding by hauling.
   *
   * Dragging the kite in at `r` metres per second pushes it through the air at
   * that speed, and the sail resists with `½ρAC_d r²`. That force is carried by
   * the line, so it is felt as extra tension — which is why hauling in is how you
   * win a tension exchange.
   *
   * Without this term the model had hauling *reduce* tension, because a shorter
   * line means a lower kite and weaker wind. That inverted the game's central
   * skill: a player who did nothing always held the tauter line and beat every
   * opponent, since the AI has to reel to reach a crossing at all.
   */
  const haulDrag = haul > 0
    ? 0.5 * AIR_DENSITY * state.stats.area
    * (state.stats.dragCoefficient + state.stats.tailDrag)
    * state.reelRate * state.reelRate
    : 0

  // Smoothed, because tension is read by the HUD, the overload rule and the
  // abrasion model. A single stiff step should not spike any of the three; what
  // they all want is the load the line is actually carrying.
  state.tension = damp(state.tension, constraint.tension + haulDrag, TENSION_SMOOTHING, dt)

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
  /**
   * Falls at about seventy per cent of gravity rather than a third.
   *
   * A freed kite is not a parachute — it collapses, spins and comes down fast, and
   * at a third of gravity the wait was long enough to be dead air in the match. The
   * air drag term is lower too, so the wind carries it sideways less and the descent
   * reads as a fall rather than a glide.
   */
  const drag = 0.4
  state.velocity.x += (wind.velocity.x - state.velocity.x) * drag * dt
  state.velocity.y += (wind.velocity.y - state.velocity.y) * drag * dt - GRAVITY * 0.7 * dt
  state.position.x += state.velocity.x * dt
  state.position.y = Math.max(0, state.position.y + state.velocity.y * dt)
  // Tumbling faster as it picks up speed sells the loss of control.
  state.heading += dt * 2.6
  state.tension = 0
  state.linePoints.length = 0
}

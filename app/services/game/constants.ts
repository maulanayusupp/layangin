/**
 * Physical and gameplay constants, in SI units.
 *
 * The aerodynamic constants are real values; the gameplay constants above them
 * are tuned. Keeping the two groups apart means a balance change never
 * accidentally edits physics.
 */

// --- Physics ---------------------------------------------------------------

/** Air density at sea level, 15 °C, kg/m³. */
export const AIR_DENSITY = 1.225

/** Standard gravity, m/s². */
export const GRAVITY = 9.81

/**
 * Power-law wind profile exponent for open terrain (fields, rice paddies).
 * v(h) = v_ref * (h / h_ref)^ALPHA
 */
export const WIND_SHEAR_EXPONENT = 0.143

/** Reference height the HUD wind speed is quoted at, metres. */
export const WIND_REFERENCE_HEIGHT = 10

/** Flat-plate drag contribution at 90° angle of attack. */
export const FLAT_PLATE_DRAG = 1.28

/** Simulation step. Fixed so the sim is deterministic and replayable. */
export const FIXED_TIMESTEP = 1 / 120

/** Never advance more than this much wall time in one frame (tab-switch guard). */
export const MAX_FRAME_TIME = 0.25

// --- Arena -----------------------------------------------------------------

/** Ground positions of the two fighters at the start of a match, metres. */
export const PLAYER_ANCHOR_X = -9
export const RIVAL_ANCHOR_X = 9

/** How far each fighter may walk from the arena centre, metres. */
export const WALK_BOUND = 26

/** Walking speed, m/s (a brisk jog while holding a spool). */
export const WALK_SPEED = 3.4

/** Line length limits, metres. */
export const MIN_LINE_LENGTH = 18
export const MAX_LINE_LENGTH = 190
export const START_LINE_LENGTH = 62

/** Base reel rate before the reel-speed upgrade, m/s. */
export const BASE_REEL_SPEED = 9

/** Altitude below which the kite is considered crashed, metres. */
export const CRASH_ALTITUDE = 1.2

/** Seconds of grace at match start before a crash can be scored. */
export const CRASH_GRACE = 2.5

// --- Line ------------------------------------------------------------------

/** Line segments used for sag sampling and clash detection. */
export const LINE_SEGMENTS = 24

/** Base breaking tension of the flying line, newtons. */
export const LINE_BREAK_TENSION = 190

/** Abrasion coefficient: tuned so a clean duel lasts roughly 10–25 seconds. */
export const ABRASION_COEFFICIENT = 0.0009

/** Integrity lost per second per newton above the breaking tension. */
export const OVERLOAD_COEFFICIENT = 0.0022

/** Linear mass density of the line, kg/m — drives sag depth. */
export const LINE_MASS_DENSITY = 0.0006

// --- Fighter dynamics ------------------------------------------------------

/** Bridle trim angle: the built-in angle of attack of the sail, radians. */
export const BASE_TRIM_ANGLE = 0.30

/** Extra angle of attack gained at full haul-in. */
export const HAUL_TRIM_BONUS = 0.16

/** Maximum steering deflection the fighter can hold, radians. */
export const MAX_BANK = 0.42

// --- Snap (sentak) ---------------------------------------------------------

export const SNAP_DURATION = 0.42
export const SNAP_COOLDOWN = 2.6
export const SNAP_STAMINA_COST = 0.22
/** Tension and slip multiplier while a snap is active. */
export const SNAP_FORCE_MULTIPLIER = 2.35

// --- Stamina ---------------------------------------------------------------

/** Stamina drained per second at full haul. */
export const STAMINA_DRAIN_RATE = 0.19
/** Stamina recovered per second while not hauling. */
export const STAMINA_RECOVERY_RATE = 0.13
/** Haul effectiveness floor when stamina is empty. */
export const EXHAUSTED_EFFECTIVENESS = 0.35

// --- Match -----------------------------------------------------------------

export const DEFAULT_TIME_LIMIT = 90
export const COUNTDOWN_SECONDS = 3

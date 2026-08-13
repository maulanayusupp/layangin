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

/**
 * Ground positions of the two fighters at the start of a match, metres.
 *
 * Two lines leaving these anchors cross at altitude
 * `separation / (cot θ_left − cot θ_right)`, where θ is each line's elevation.
 * Parallel lines never meet however long they are, so a duel needs an elevation
 * *difference* — and the separation sets how high up the meeting happens.
 *
 * 14 m apart puts a realistic 15° difference (say 40° against 55°) at roughly
 * 28 m altitude: high enough to read on screen, low enough that both kites can
 * reach it. Too close and every crossing hugs the ground; too far and the
 * crossing point climbs above where either kite flies.
 *
 * Fighters can still walk well past each other (see `WALK_BOUND`), which is how
 * they contest the geometry.
 */
export const PLAYER_ANCHOR_X = -7
export const RIVAL_ANCHOR_X = 7

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

/**
 * Elevation the kite is launched at, radians (55°).
 *
 * The launch **must** put the line under tension. A kite released on a slack line
 * is accelerated downwind by drag with nothing restraining it; it quickly matches
 * the wind, at which point the apparent wind over the sail falls to nearly zero
 * and so does lift. By the time the line goes taut the kite is descending fast
 * enough that the angle of attack has swung past 90°, where a flat plate produces
 * *negative* lift — and from there it is pushed into the ground.
 *
 * That was a real bug: every match opened with both kites sinking. Launching taut
 * at just under the ~63° equilibrium means the kite settles upward into trim
 * instead of falling out of it.
 */
export const LAUNCH_ELEVATION = 0.96

/** Altitude below which the kite is considered crashed, metres. */
export const CRASH_ALTITUDE = 1.2

/**
 * Seconds of grace after each launch before a crash or a collision counts.
 *
 * Generous on purpose: the kite starts already aloft and needs a moment to
 * settle into trim, and losing a life to the launch attitude is never the
 * player's mistake.
 */
export const CRASH_GRACE = 4

// --- Line ------------------------------------------------------------------

/** Line segments used for sag sampling and clash detection. */
export const LINE_SEGMENTS = 24

/**
 * Base breaking tension of the flying line, newtons.
 *
 * Real fighting line parts somewhere around 5–25 kgf, so this sits at the strong
 * end of plausible. Calibrated against measured peaks: a first-tier fight in light
 * air loads the line to roughly a third of this, and the final boss's windy
 * afternoon takes it close to the limit — so overload risk grows with tier instead
 * of being either unreachable or automatic.
 */
export const LINE_BREAK_TENSION = 150

/**
 * How fast the reported tension follows the raw constraint value. This is the
 * fraction of the gap remaining after one second, so it is frame-rate independent.
 */
export const TENSION_SMOOTHING = 0.0001

/**
 * Abrasion coefficient.
 *
 * Multiplies `√slip × √(relative contact pressure) × crossing bite` — see the
 * note in `applyAbrasion` for why the response is compressed rather than linear.
 *
 * Calibrated by sweeping it against measured match length across all eight
 * opponents: at this value a duel lands in 9–27 s, against 120 s (or never) before.
 * Raising it further stops helping, because what is left is the time the two lines
 * spend finding each other rather than the time they spend cutting.
 */
export const ABRASION_COEFFICIENT = 3.5

/** Integrity lost per second per newton above the breaking tension. */
export const OVERLOAD_COEFFICIENT = 0.0022

/** Linear mass density of the line, kg/m — drives sag depth. */
export const LINE_MASS_DENSITY = 0.0006

// --- Fighter dynamics ------------------------------------------------------

/** Bridle trim angle: the built-in angle of attack of the sail, radians. */
export const BASE_TRIM_ANGLE = 0.30

/** Extra angle of attack gained at full haul-in. */
export const HAUL_TRIM_BONUS = 0.16

/**
 * Maximum steering deflection the fighter can hold, radians (~9°).
 *
 * Must stay well under `BASE_TRIM_ANGLE`. Steering shifts the angle of attack
 * directly, so a deflection as large as the trim itself does not steer the kite —
 * it re-trims it, and holding a walk key halved the kite's altitude. Keeping it
 * small makes walking a nudge rather than a second throttle.
 */
export const MAX_BANK = 0.16

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

/**
 * Match length cap, seconds.
 *
 * Measured duels resolve in 9–27 s, so this is the ceiling on a stalemate rather
 * than the normal path to a result. Two opponents (tiers 3 and 6) still reach it
 * regularly because they hold contact down to a few seconds — see TODO.md.
 */
export const DEFAULT_TIME_LIMIT = 45
export const COUNTDOWN_SECONDS = 3

/**
 * Lives per fighter.
 *
 * A duel is not decided by one cut. Losing a line — to the opponent, to the
 * ground, or to a cable — costs one life and relaunches the round; the match is
 * over when someone runs out.
 *
 * Two, not three: measured match length is dominated by the time the two lines
 * take to find each other, not by how fast they cut, so each extra life adds
 * roughly ten seconds of manoeuvring. Two keeps a duel around twenty seconds while
 * still meaning a single mistimed haul never ends it.
 */
export const STARTING_HP = 2

/** Seconds between a life being lost and the next round launching. */
export const ROUND_BREAK = 1.4

/**
 * Longest the result screen waits for a cut kite to reach the ground, seconds.
 *
 * The match is already decided at this point; the delay exists so the player gets
 * to watch the kite come down instead of having a modal thrown over it. Capped in
 * case the wind carries the kite sideways for a long time rather than down.
 */
export const FALL_TIMEOUT = 4.5

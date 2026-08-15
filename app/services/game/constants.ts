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

/**
 * Gap between neighbouring anchors, metres — the same 14 m as a duel.
 *
 * A free-for-all keeps the spacing and widens the line instead: three fighters
 * stand at −14/0/+14, four at −21/−7/+7/+21. Compressing them closer together to
 * keep the field narrow would drag every crossing down toward the ground, and
 * spreading them further would push the crossings above where the kites fly.
 */
export const ANCHOR_SPACING = 14

/** Most fighters one match supports. Beyond this the sky stops being readable. */
export const MAX_FIGHTERS = 4

/**
 * How far each fighter may walk from the arena centre, metres.
 *
 * Scales with the crowd: with four anchors spread to ±21 m, a 26 m bound would
 * pin the outer two against the edge and stop them contesting at all.
 */
export const WALK_BOUND = 26

/** Walk bound for a match with `count` fighters. */
export function walkBoundFor(count: number): number {
  return WALK_BOUND + Math.max(0, count - 2) * (ANCHOR_SPACING / 2)
}

/** Ground positions for `count` fighters, centred on the arena. Player first. */
export function anchorsFor(count: number): number[] {
  return Array.from(
    { length: count },
    (_, index) => (index - (count - 1) / 2) * ANCHOR_SPACING,
  )
}

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
 * Swept against measured match length across all eight opponents, with each
 * measured against **the gear a player actually reaches that tier with** rather
 * than the starter kite. That distinction is the whole story: measured with an
 * unequipped player the value looked calibrated at 3.5, and the earlier note here
 * claimed raising it stopped helping. Both were artefacts of the wrong test
 * subject. Measured properly:
 *
 * ```
 *            mean   caps    band
 * 3.5        27.8s  15/48   14–45s
 * 4.5        22.0s   8/48   13–33s
 * 6          16.3s   1/48   13–20s
 * 7 + 3 hp   22.0s   1/48   18–27s   ← here
 * ```
 *
 * Paired with three lives it puts seven of the eight tiers between 18 and 25
 * seconds with one capped match in forty-eight, which is the tightest band any
 * combination produced.
 */
export const ABRASION_COEFFICIENT = 7

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
 * Match length cap for a duel, seconds.
 *
 * A ceiling on a stalemate, not the normal path to a result: measured duels
 * resolve in 31–42 s against the gear a player actually reaches each tier with.
 *
 * The cap does real work rather than being a formality. Left effectively unbounded
 * at 400 s, the median duel still finished in 32 s but the 90th percentile ran to
 * 319 s — the contact-starved matchups (tiers 3 and 6) genuinely never resolve, and
 * five lives multiplies the stall by five. See TODO.md.
 */
export const DEFAULT_TIME_LIMIT = 60

/**
 * Match length cap for `count` fighters, seconds.
 *
 * A free-for-all has more to get through, so it gets proportionally longer before
 * the clock intervenes — measured medians are 32 s for a duel, 70 s for a three-way
 * and 97 s for a four-way, before lives were scaled down to match.
 */
export function timeLimitFor(count: number): number {
  return DEFAULT_TIME_LIMIT + Math.max(0, count - 2) * 25
}
export const COUNTDOWN_SECONDS = 3

/**
 * Lives per fighter.
 *
 * A duel is not decided by one cut. Losing a line — to the opponent, to the
 * ground, or to a cable — costs one life and relaunches the round; the match is
 * over when someone runs out.
 *
 * Five in a duel, paired with a high `ABRASION_COEFFICIENT`. The pair is the
 * point: lives set how long a match runs, abrasion sets how *tightly* the tiers
 * cluster around it. Measured against real per-tier loadouts, with the cap lifted
 * so nothing was distorted by it:
 *
 * ```
 *                 mean    band
 * abr 7, 3 hp    22.5s   18–30s
 * abr 7, 4 hp    29.4s   25–36s
 * abr 7, 5 hp    35.8s   31–42s   ← here
 * abr 6, 4 hp    36.4s   26–56s
 * abr 5, 4 hp    45.2s   26–81s
 * ```
 *
 * Note the last two: reaching the same length by *slowing the cutting* rather than
 * adding lives widens the spread badly, because the contact-starved matchups stall
 * instead of finishing. Lives lengthen a match evenly; abrasion does not.
 *
 * Five also buys forgiveness: a cable, a gust or one mistimed haul costs a fifth of
 * a match. A crowded sky gets fewer — see `livesFor`.
 */
export const STARTING_HP = 5

/**
 * Lives for a match with `count` fighters.
 *
 * Lives shrink as the sky fills, and the reason is arithmetic: winning a match
 * means cutting *every* opponent down to nothing, so a four-way at five lives each
 * needs fifteen cuts against a duel's five. Measured, that turned a free-for-all
 * into a match that almost always ended on the clock — 17 of 24 four-way matches
 * hit the cap — which is the least satisfying way for one to finish.
 *
 * Scaling down keeps every format in roughly the same span, and it happens to fix
 * the HUD too: four fighters at five pips each overflows the mobile strip, at three
 * it does not.
 */
export function livesFor(count: number): number {
  return Math.max(3, STARTING_HP - Math.max(0, count - 2))
}

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

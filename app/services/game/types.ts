import type { Vec2 } from './math/vector'

/**
 * Domain types for the simulation and the content catalogs.
 *
 * ## Coordinate system
 * World space is in **metres**, y-up, ground at `y = 0`. The wind blows along
 * +x. Both fighters stand on the ground a few metres apart, so their kites fly
 * downwind of them and their lines naturally cross — which is exactly the
 * geometry a real *sangkutan* (line-tangling duel) depends on.
 *
 * Rendering converts metres to pixels in `render/camera.ts`; nothing in the
 * simulation ever deals in pixels.
 */

// ---------------------------------------------------------------------------
// Catalog identifiers
// ---------------------------------------------------------------------------

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legend'

export type KiteId
  = | 'pecut'
    | 'sawangan'
    | 'delta'
    | 'bebean'
    | 'kotak'
    | 'janggan'
    | 'elang'
    | 'naga'
    // Generated airframes — see data/airframes.ts.
    | 'wajik'
    | 'ketupat'
    | 'daun'
    | 'panji'
    | 'sirip'
    | 'gapangan'
    | 'pethetan'
    | 'aduan'
    | 'koang'
    | 'kupu'
    | 'capung'
    | 'rokkaku'
    | 'bulan'
    | 'tameng'
    | 'lampion'
    | 'terbang'
    | 'gasing'
    | 'kembang'
    | 'pari'
    | 'kelelawar'
    | 'hiu'
    | 'keris'
    | 'tombak'
    | 'sendaren'
    | 'wau-bulan'
    | 'dandang'
    | 'kepiting'
    | 'bintang-laut'
    | 'merak'
    | 'garuda'
    | 'gurita'
    | 'mahkota'
    | 'kalajengking'
    | 'sayap'
    | 'wau-kucing'
    | 'taring'
    | 'matahari'
    | 'puyuh'
    | 'jangkar'
    | 'tapak'
    | 'kanggokan'
    | 'sultan'

export type PaletteId
  = | 'senja'
    | 'pandan'
    | 'samudra'
    | 'gula-kelapa'
    | 'batik-indigo'
    | 'mercusuar'
    | 'arang'
    | 'nusantara'

export type TrailEffectId
  = | 'none'
    | 'debu'
    | 'kunang'
    | 'asap'
    | 'pelangi'
    | 'bara'

/**
 * Sail graphics — *corak*. Applied over an airframe's panels, so one shape can
 * appear in many liveries the way real fighting kites do. Purely cosmetic.
 */
export type PatternId
  = | 'plain'
    | 'belang'
    | 'palang'
    | 'seperempat'
    | 'panah'
    | 'sasaran'
    | 'bintang'
    | 'papan'
    | 'lidah-api'
    | 'kawung'
    | 'mata'
    | 'sinar'

export type ArenaId
  = | 'sawah'
    | 'pantai'
    | 'kampung'
    | 'kota'
    | 'monumen'
    | 'viaduk'

export type UpgradeId
  = | 'line-strength'
    | 'gelasan'
    | 'reel-speed'
    | 'control'
    | 'stamina'
    | 'luck'

export type OpponentId
  = | 'bocah-sawah'
    | 'anak-kampung'
    | 'juara-lorong'
    | 'bos-pasar'
    | 'si-gelasan'
    | 'sultan-angin'
    | 'raja-sawangan'
    | 'naga-senja'

// ---------------------------------------------------------------------------
// Kite definition
// ---------------------------------------------------------------------------

/** Which palette slot a polygon takes its fill from. */
export type PaintRole = 'primary' | 'secondary' | 'accent' | 'shade' | 'outline'

export interface KitePanel {
  /** Outline in kite-local space: x = span (−1..1), y = chord (−1..1, up positive). */
  points: readonly Vec2[]
  paint: PaintRole
}

export type TailKind = 'ribbon' | 'streamer' | 'tassel' | 'sock' | 'dragon'

export interface KiteTail {
  /** Attachment point in kite-local space. */
  anchor: Vec2
  /** Length as a multiple of the kite's own size. */
  length: number
  width: number
  kind: TailKind
  paint: PaintRole
}

/**
 * Pure geometry — no colour. Colour comes from the equipped palette, which is
 * why a re-skin never needs a geometry change.
 */
export interface KiteGeometry {
  panels: readonly KitePanel[]
  /** Spars/struts drawn as strokes over the panels. */
  spars: readonly (readonly [Vec2, Vec2])[]
  tails: readonly KiteTail[]
  /** Bridle attachment point — where the flying line meets the kite. */
  bridle: Vec2
  /** Optional bowed arc (sawangan hummer bow) drawn above the sail. */
  bow?: { from: Vec2, to: Vec2, depth: number }
}

/**
 * Aerodynamic + gameplay stats. Values are physical wherever a physical value
 * exists, so the numbers stay meaningful when the model is tuned.
 */
export interface KiteStats {
  /** Sail area in m². Drives both lift and drag. */
  area: number
  /** Mass in kg, bamboo frame + paper/nylon sail. */
  mass: number
  /** Peak lift coefficient of the sail. */
  liftCoefficient: number
  /** Parasite drag coefficient at zero angle of attack. */
  dragCoefficient: number
  /** Extra drag contributed by tails. High = very stable, sluggish to steer. */
  tailDrag: number
  /** How quickly the sail responds to steering input, in rad/s. */
  agility: number
  /** Restoring pull back toward trim. High = forgiving, low = twitchy. */
  stability: number
  /** Multiplier on line abrasion resistance. */
  lineStrength: number
  /** Multiplier on abrasion dealt to the opponent's line. */
  cutPower: number
}

export interface KiteDefinition {
  id: KiteId
  /** i18n key suffix — resolved as `kites.items.<id>.name` / `.lore`. */
  i18nKey: KiteId
  rarity: Rarity
  /** Coin price. 0 = owned from the start. */
  price: number
  /** Region the shape comes from; shown in the codex. */
  origin: 'java' | 'bali' | 'sumatra' | 'modern' | 'legend'
  stats: KiteStats
  geometry: KiteGeometry
  /** Rendered size in metres (longest dimension). */
  size: number
  /** Locked until this many ladder wins. */
  unlockWins: number
}

// ---------------------------------------------------------------------------
// Cosmetics
// ---------------------------------------------------------------------------

/**
 * How a pattern is painted inside the sail silhouette. The renderer clips to the
 * airframe's outline and draws the primitive, so a pattern works on any shape.
 */
export type PatternKind
  = | 'plain'
    | 'stripes'
    | 'quarters'
    | 'chevron'
    | 'rings'
    | 'star'
    | 'checker'
    | 'flame'
    | 'lattice'
    | 'eye'
    | 'rays'

export interface KitePattern {
  id: PatternId
  i18nKey: PatternId
  rarity: Rarity
  price: number
  kind: PatternKind
  /** Repeat count: stripe count, ring count, checker divisions, ray count. */
  count: number
  /** The two paint roles the pattern alternates between. */
  paints: readonly [PaintRole, PaintRole]
  /** Rotation of the motif in radians, where the kind supports it. */
  angle?: number
}

export interface Palette {
  id: PaletteId
  i18nKey: PaletteId
  rarity: Rarity
  price: number
  colors: Record<Exclude<PaintRole, 'outline'>, string> & { outline: string }
}

export interface TrailEffect {
  id: TrailEffectId
  i18nKey: TrailEffectId
  rarity: Rarity
  price: number
  /** Particles emitted per second while flying. */
  emissionRate: number
  /** Particle lifetime in seconds. */
  lifetime: number
  /** `palette` follows the kite's colours; a hex string overrides it. */
  tint: 'palette' | string
  size: number
  /** Upward drift in m/s applied to particles. */
  buoyancy: number
}

// ---------------------------------------------------------------------------
// Arenas
// ---------------------------------------------------------------------------

/**
 * What an obstacle does to a kite and its line. A single obstacle can do more
 * than one of these: a concrete tower is solid *and* casts a wind shadow, a power
 * line only snags.
 */
export interface ObstacleBehaviour {
  /** The kite crashes on contact with the body. */
  solid: boolean
  /** A flying line crossing it abrades fast — power lines and steel cables. */
  snag: boolean
  /** Blocks wind downwind of itself, up to its own height. */
  windShadow: boolean
}

export type ObstacleKind
  = | 'building'
    | 'tower'
    | 'tree'
    | 'rock'
    | 'powerline'
    | 'pole'
    | 'arch'

export interface ArenaObstacle {
  kind: ObstacleKind
  /** Footprint in world metres: `x` is the centre, `y` the base (0 = ground). */
  x: number
  y: number
  width: number
  height: number
  behaviour: ObstacleBehaviour
  /**
   * For `powerline`, the cable's endpoints in world metres. The body box is then
   * only used for culling.
   */
  span?: { x1: number, y1: number, x2: number, y2: number }
  /** 0..1 tint variation so a row of identical buildings does not look tiled. */
  shade?: number
}

/** Decorative only — never collides, never affects the simulation. */
export interface ArenaProp {
  kind: 'umbrella' | 'boat' | 'bush' | 'cloud' | 'goalpost' | 'tram' | 'flag' | 'fountain'
  x: number
  y: number
  scale: number
}

export interface ArenaDefinition {
  id: ArenaId
  i18nKey: ArenaId
  /** Ladder wins needed before the arena can be picked. 0 = available at once. */
  unlockWins: number
  /** Sky gradient stops, top to horizon. */
  sky: readonly (readonly [number, string])[]
  /** Sun position in world metres, and its colour. */
  sun: { x: number, y: number, radius: number, color: string, glow: string }
  /** Parallax ridge colours, farthest first. */
  ridges: readonly string[]
  ground: string
  groundAccent: string
  /** Haze drawn over the far layers; '' disables it. */
  haze: string
  /** Multiplies the opponent's configured wind speed. */
  windMultiplier: number
  /** Multiplies the opponent's configured gustiness. */
  gustMultiplier: number
  obstacles: readonly ArenaObstacle[]
  props: readonly ArenaProp[]
}

// ---------------------------------------------------------------------------
// Upgrades
// ---------------------------------------------------------------------------

export interface UpgradeDefinition {
  id: UpgradeId
  i18nKey: UpgradeId
  maxLevel: number
  /** Cost of moving from level n to n+1. */
  costAt: (level: number) => number
  /** Multiplier applied at a given level. Level 0 always returns 1. */
  multiplierAt: (level: number) => number
  /** Which stat the multiplier feeds into, for the UI to explain itself. */
  affects: 'lineStrength' | 'cutPower' | 'reelSpeed' | 'agility' | 'stamina' | 'rewards'
}

export type UpgradeLevels = Record<UpgradeId, number>

// ---------------------------------------------------------------------------
// Opponents
// ---------------------------------------------------------------------------

/**
 * AI behaviour parameters. Every one of these is a human limitation rather than
 * a cheat: the AI reads the same simulation the player sees and its handicap is
 * expressed as slower reactions and looser precision, never extra stats.
 */
export interface AiProfile {
  /** Seconds between re-evaluating the plan. Lower = sharper. */
  reactionTime: number
  /** 0..1 — willingness to seek a crossing instead of playing safe. */
  aggression: number
  /** 0..1 — how accurately it holds its intended line angle. */
  precision: number
  /** 0..1 — how well it manages stamina and snap timing. */
  discipline: number
  /** 0..1 — probability per decision of a clear mistake. */
  mistakeRate: number
  /** 0..1 — how readily it disengages when its line is losing. */
  caution: number
}

export interface OpponentDefinition {
  id: OpponentId
  i18nKey: OpponentId
  /** Position in the ladder, 1-based. */
  tier: number
  isBoss: boolean
  kiteId: KiteId
  paletteId: PaletteId
  patternId: PatternId
  effectId: TrailEffectId
  ai: AiProfile
  /** Upgrade levels the opponent flies with. */
  upgrades: Partial<UpgradeLevels>
  /** Coins awarded for a win. */
  reward: number
  /** Wind speed at the reference height for this fight, in m/s. */
  windSpeed: number
  gustiness: number
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

/** One frame of intent from a human, an AI, or (later) the network. */
export interface FighterCommand {
  /** −1 = pay line out (*ngulur*), +1 = haul line in (*narik*). */
  reel: number
  /** −1 = walk upwind, +1 = walk downwind. */
  walk: number
  /** Burst yank (*sentak*) — big instantaneous tension spike. */
  snap: boolean
}

export const NEUTRAL_COMMAND: Readonly<FighterCommand> = Object.freeze({
  reel: 0,
  walk: 0,
  snap: false,
})

/**
 * Display role. Identity is `FighterState.index` — `side` only says whether a
 * fighter is the human, because that changes how it is drawn and what the HUD
 * treats as "yours".
 */
export type FighterSide = 'player' | 'rival'

/** Index into `MatchSnapshot.fighters`. Index 0 is always the human player. */
export type FighterIndex = number

/** The human's slot. Never anything else — a great deal of code relies on it. */
export const PLAYER_INDEX: FighterIndex = 0

/** Everything the simulation knows about one fighter. */
export interface FighterState {
  side: FighterSide
  /** Position in `MatchSnapshot.fighters`. Stable for the whole match. */
  index: FighterIndex
  /** Which opponent definition this fighter is flying, or null for the player. */
  opponentId: OpponentId | null
  kiteId: KiteId
  paletteId: PaletteId
  patternId: PatternId
  effectId: TrailEffectId
  /** Effective stats after upgrades — computed once at match start. */
  stats: KiteStats
  reelSpeed: number

  anchor: Vec2
  position: Vec2
  velocity: Vec2
  /** Sail heading in radians. */
  heading: number
  /** Steering offset the fighter is currently holding, in radians. */
  bank: number

  /** Deployed line length in metres. */
  lineLength: number
  /** Metres per second currently being hauled in (+) or paid out (−). */
  reelRate: number
  /** Line tension in newtons. */
  tension: number
  /** 0..1 remaining line health. Reaching 0 means the line is cut. */
  lineIntegrity: number
  /**
   * Lives left. Losing a line costs one and relaunches the round; a fighter that
   * reaches 0 is out of the match. See STARTING_HP.
   */
  hp: number
  /**
   * True once this fighter's lives are gone. An eliminated fighter is not
   * relaunched and takes no further part.
   */
  eliminated: boolean
  /** 0..1 arm strength; drained by hauling and snapping. */
  stamina: number
  /** Divides stamina drain. Comes from the stamina upgrade. */
  staminaEfficiency: number
  /**
   * How far this fighter may walk from the arena centre, metres. A property of the
   * fighter rather than a constant because a crowded field is a wider field —
   * see `walkBoundFor`.
   */
  walkBound: number
  /** Seconds until snap is available again. */
  snapCooldown: number
  /** Seconds remaining of an active snap. */
  snapActive: number

  /** Sampled line polyline, anchor → kite, in world metres. */
  linePoints: Vec2[]
  /** True while the line is dragging across an arena cable. */
  snagged: boolean
  alive: boolean
}

/**
 * Match phases.
 *
 * - `roundOver` — the pause after a life is lost, before the next launch. Separate
 *   so the HUD can say what happened and the cut kite can tumble away without the
 *   simulation scoring anything further.
 * - `falling` — the last life has gone, but the result is **not shown yet**: the
 *   cut kite is still coming down. Watching it fall is the payoff for winning (or
 *   the sting of losing), and a modal appearing over it steals that moment.
 */
export type MatchPhase
  = | 'briefing'
    | 'countdown'
    | 'flying'
    | 'roundOver'
    | 'falling'
    | 'resolved'

/** Why a round ended. Drives the round banner and the sound cue. */
export type RoundEndReason = 'cut' | 'crash' | 'obstacle' | 'cable'

export interface RoundResult {
  /** Which fighter lost the life. */
  loser: FighterIndex
  /** True when the loser was the human, so the banner can say "you". */
  loserIsPlayer: boolean
  reason: RoundEndReason
  /** 1-based round number that just finished. */
  round: number
}

/**
 * `winner` is a fighter index, or 'draw'. The player is index 0, so
 * `winner === 0` is a player win — use `isPlayerWin` rather than testing it inline.
 */
export type MatchOutcome
  = | { kind: 'pending' }
    | { kind: 'cut', winner: FighterIndex | 'draw' }
    | { kind: 'crash', winner: FighterIndex | 'draw' }
    /** Flew into an arena structure. */
    | { kind: 'obstacle', winner: FighterIndex | 'draw' }
    | { kind: 'timeout', winner: FighterIndex | 'draw' }

export interface ClashPoint {
  position: Vec2
  /** Crossing angle in radians; near 90° transfers the most abrasion. */
  angle: number
  /** Relative sliding speed of the two lines, m/s. */
  slip: number
  intensity: number
  /**
   * `line` is a duel between two fighters; `obstacle` is a cable in the arena,
   * which abrades without abrading back. The renderer sparks both but tints them
   * differently.
   */
  kind: 'line' | 'obstacle'
  /** The two fighters involved. For `obstacle`, `b` is -1. */
  a: FighterIndex
  b: FighterIndex
  /**
   * 0..1 share of the abrasion flowing *from* A *to* B — A's tension share. High
   * means A's line is the blade. For `obstacle` this is always 1: the cable cuts
   * and takes nothing back.
   */
  aShare: number
}

export interface WindSample {
  velocity: Vec2
  /** Scalar speed at the sampled altitude, m/s. */
  speed: number
}

export interface MatchStats {
  durationSeconds: number
  /** Seconds the two lines were in contact. */
  clashSeconds: number
  /** Peak tension the player reached, in newtons. */
  peakTension: number
  snapsUsed: number
  /** Highest altitude the player's kite reached, in metres. */
  peakAltitude: number
  /** Rounds won and lost, for the result screen. */
  roundsWon: number
  roundsLost: number
  /** Opponents the player outlasted, for the reward. */
  opponentsBeaten: number
}

/**
 * Result helpers. Prefer these to comparing `winner` by hand: the player is index 0,
 * and `outcome.winner === 0` reads like a bug even when it is correct.
 */
export function isPlayerWin(outcome: MatchOutcome): boolean {
  return outcome.kind !== 'pending' && outcome.winner === PLAYER_INDEX
}

export function isDraw(outcome: MatchOutcome): boolean {
  return outcome.kind !== 'pending' && outcome.winner === 'draw'
}

export function isPlayerLoss(outcome: MatchOutcome): boolean {
  return outcome.kind !== 'pending' && !isDraw(outcome) && !isPlayerWin(outcome)
}

export interface MatchSnapshot {
  phase: MatchPhase
  outcome: MatchOutcome
  arena: ArenaDefinition
  /**
   * Everyone in the air, player first. Two for a duel, three or four for a
   * free-for-all, where a cut can come from any direction.
   */
  fighters: FighterState[]
  /** Seconds elapsed in the flying phase. */
  elapsed: number
  timeLimit: number
  /** Seconds left on the pre-match countdown; 0 once flying. */
  countdown: number
  /** 1-based round currently being fought. */
  round: number
  /** How the previous round ended; null before the first one finishes. */
  lastRound: RoundResult | null
  /** Seconds left on the between-rounds pause; 0 outside `roundOver`. */
  roundBreak: number
  /** Convenience alias for `fighters[0]`. */
  player: FighterState
  /**
   * The opponent the HUD treats as the main threat: the nearest fighter still in
   * the match. In a duel this is simply the other one.
   */
  rival: FighterState
  wind: WindSample
  /** Reference wind speed at 10 m, m/s — what the HUD gauge shows. */
  windSpeed: number
  clashes: ClashPoint[]
  stats: MatchStats
}

export interface MatchLoadout {
  kiteId: KiteId
  paletteId: PaletteId
  patternId: PatternId
  effectId: TrailEffectId
  upgrades: UpgradeLevels
}

export interface MatchConfig {
  seed: number
  /**
   * Everyone the player is up against. One for a duel, two or three for a
   * free-for-all — they fight each other as readily as they fight the player.
   */
  opponents: readonly OpponentDefinition[]
  player: MatchLoadout
  arena: ArenaDefinition
  timeLimit: number
  /** Extra difficulty scaling applied on repeat runs of the ladder. */
  difficultyScale: number
}

export interface MatchReward {
  coins: number
  bonusCoins: number
  isFirstWin: boolean
  outcome: MatchOutcome
}

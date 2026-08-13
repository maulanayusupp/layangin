import type { ArenaDefinition, ArenaId, ArenaObstacle, ObstacleBehaviour } from '~/services/game/types'

/**
 * Arenas.
 *
 * Each arena is a real place to fly, not a reskin: the obstacles change how the
 * fight works. An open rice field is a pure duel. A dense neighbourhood strings
 * power lines across the middle of the wind window, so the same tactic that wins
 * on the field will part your own line on the cables. City blocks throw wind
 * shadows that drop your kite out of the sky if you drift behind them.
 *
 * ## Coordinate space
 * World metres, y-up, ground at `y = 0`. Fighters stand near x = ±9, kites fly
 * downwind (+x). Obstacles are placed in that same frame, so an obstacle at
 * x = 0 sits between the two fighters — squarely where the lines cross.
 */

/** Shorthand behaviours, so each obstacle reads as its physical intent. */
const SOLID: ObstacleBehaviour = { solid: true, snag: false, windShadow: false }
const SOLID_SHADOW: ObstacleBehaviour = { solid: true, snag: false, windShadow: true }
const CABLE: ObstacleBehaviour = { solid: false, snag: true, windShadow: false }
const SOFT: ObstacleBehaviour = { solid: true, snag: false, windShadow: false }

/** Power line between two poles. The body box is only used for culling. */
function powerline(x1: number, y1: number, x2: number, y2: number): ArenaObstacle {
  return {
    kind: 'powerline',
    x: (x1 + x2) / 2,
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1) + 0.5,
    behaviour: CABLE,
    span: { x1, y1, x2, y2 },
  }
}

export const ARENAS: readonly ArenaDefinition[] = [
  // -------------------------------------------------------------------------
  // Sawah — open rice fields at dusk. The teaching arena: nothing in the way.
  // -------------------------------------------------------------------------
  {
    id: 'sawah',
    i18nKey: 'sawah',
    unlockWins: 0,
    sky: [
      [0, '#06090f'],
      [0.34, '#0d1430'],
      [0.58, '#241f4d'],
      [0.78, '#5d2f4e'],
      [0.92, '#a9503a'],
      [1, '#d9723c'],
    ],
    sun: { x: 70, y: 9, radius: 4.5, color: '#ffcf8a', glow: 'rgba(255, 158, 74, 0.42)' },
    ridges: ['#1b1c3a', '#141531', '#0c0d22'],
    ground: '#080a15',
    groundAccent: 'rgba(255, 194, 75, 0.22)',
    haze: 'rgba(217, 114, 60, 0.10)',
    windMultiplier: 1,
    gustMultiplier: 1,
    obstacles: [
      // A pair of trees near the edges: reachable only if you drift badly.
      { kind: 'tree', x: -34, y: 0, width: 6, height: 9, behaviour: SOFT, shade: 0.2 },
      { kind: 'tree', x: 38, y: 0, width: 7, height: 11, behaviour: SOFT, shade: 0.5 },
    ],
    props: [
      { kind: 'goalpost', x: -18, y: 0, scale: 1 },
      { kind: 'goalpost', x: 24, y: 0, scale: 1 },
      { kind: 'bush', x: -8, y: 0, scale: 0.8 },
      { kind: 'bush', x: 14, y: 0, scale: 1.1 },
      { kind: 'bush', x: 30, y: 0, scale: 0.6 },
    ],
  },

  // -------------------------------------------------------------------------
  // Pantai — beach between headlands. Strong, gusty sea wind; rocks to the side.
  // -------------------------------------------------------------------------
  {
    id: 'pantai',
    i18nKey: 'pantai',
    unlockWins: 2,
    sky: [
      [0, '#0a2a4a'],
      [0.3, '#155a80'],
      [0.6, '#4fa5b8'],
      [0.84, '#c9e4d8'],
      [1, '#f6e2b8'],
    ],
    sun: { x: 82, y: 26, radius: 6, color: '#fff6d8', glow: 'rgba(255, 244, 200, 0.5)' },
    ridges: ['#2b4a5e', '#6d7c62', '#b7935f'],
    ground: '#e8d7a8',
    groundAccent: 'rgba(79, 165, 184, 0.55)',
    haze: 'rgba(246, 226, 184, 0.16)',
    // Sea breeze: faster and far less steady than inland air.
    windMultiplier: 1.22,
    gustMultiplier: 1.5,
    obstacles: [
      { kind: 'rock', x: -40, y: 0, width: 18, height: 26, behaviour: SOLID_SHADOW, shade: 0.3 },
      { kind: 'rock', x: -26, y: 0, width: 11, height: 15, behaviour: SOLID, shade: 0.6 },
      { kind: 'rock', x: 48, y: 0, width: 20, height: 32, behaviour: SOLID_SHADOW, shade: 0.15 },
    ],
    props: [
      { kind: 'umbrella', x: -14, y: 0, scale: 1 },
      { kind: 'umbrella', x: -9, y: 0, scale: 0.85 },
      { kind: 'umbrella', x: 22, y: 0, scale: 1.05 },
      { kind: 'umbrella', x: 28, y: 0, scale: 0.9 },
      { kind: 'boat', x: 6, y: 0, scale: 1 },
      { kind: 'boat', x: 36, y: 0, scale: 0.55 },
    ],
  },

  // -------------------------------------------------------------------------
  // Kampung — dense neighbourhood alley. Power lines strung right through the
  // wind window: the hardest arena, and the most authentic one.
  // -------------------------------------------------------------------------
  {
    id: 'kampung',
    i18nKey: 'kampung',
    unlockWins: 4,
    sky: [
      [0, '#123a44'],
      [0.34, '#2b7f86'],
      [0.66, '#8fcfc4'],
      [0.88, '#e8dcc0'],
      [1, '#f2cf9e'],
    ],
    sun: { x: 60, y: 34, radius: 5, color: '#fff2cd', glow: 'rgba(255, 226, 170, 0.34)' },
    ridges: ['#7d8c8a', '#98a49c', '#c2bda9'],
    ground: '#8a7a63',
    groundAccent: 'rgba(255, 255, 255, 0.18)',
    haze: 'rgba(232, 220, 192, 0.2)',
    // Buildings break the flow up: slower average air, sharper gusts.
    windMultiplier: 0.9,
    gustMultiplier: 1.35,
    obstacles: [
      // Rooftops either side of the alley.
      { kind: 'building', x: -30, y: 0, width: 16, height: 14, behaviour: SOLID_SHADOW, shade: 0.2 },
      { kind: 'building', x: -14, y: 0, width: 12, height: 10, behaviour: SOLID_SHADOW, shade: 0.5 },
      { kind: 'building', x: 16, y: 0, width: 14, height: 12, behaviour: SOLID_SHADOW, shade: 0.35 },
      { kind: 'building', x: 34, y: 0, width: 18, height: 17, behaviour: SOLID_SHADOW, shade: 0.1 },
      // Poles carrying the cables.
      { kind: 'pole', x: -20, y: 0, width: 0.6, height: 20, behaviour: SOLID, shade: 0.4 },
      { kind: 'pole', x: 8, y: 0, width: 0.6, height: 20, behaviour: SOLID, shade: 0.4 },
      { kind: 'pole', x: 30, y: 0, width: 0.6, height: 20, behaviour: SOLID, shade: 0.4 },
      // The cables themselves: low enough that a sinking kite drags its line
      // across them, which shreds it far faster than any opponent.
      powerline(-20, 19, 8, 17.5),
      powerline(8, 17.5, 30, 19.5),
      powerline(-20, 15.5, 8, 14),
      powerline(8, 14, 30, 15.8),
    ],
    props: [
      { kind: 'bush', x: 2, y: 0, scale: 0.7 },
      { kind: 'bush', x: 26, y: 0, scale: 0.9 },
      { kind: 'flag', x: -6, y: 0, scale: 1 },
    ],
  },

  // -------------------------------------------------------------------------
  // Kota — city block. Two towers with deep wind shadows behind them.
  // -------------------------------------------------------------------------
  {
    id: 'kota',
    i18nKey: 'kota',
    unlockWins: 7,
    sky: [
      [0, '#0d2340'],
      [0.32, '#2e6f9e'],
      [0.62, '#7fc0d6'],
      [0.86, '#e0e6dc'],
      [1, '#f4d9c4'],
    ],
    sun: { x: 88, y: 40, radius: 5.5, color: '#fff8e6', glow: 'rgba(255, 240, 214, 0.4)' },
    ridges: ['#4a5f78', '#6b7f92', '#9aa8b4'],
    ground: '#4f5c4a',
    groundAccent: 'rgba(255, 255, 255, 0.2)',
    haze: 'rgba(224, 230, 220, 0.22)',
    windMultiplier: 1.08,
    gustMultiplier: 1.2,
    obstacles: [
      // Twin slabs straddling the middle of the field.
      { kind: 'tower', x: -4, y: 0, width: 9, height: 52, behaviour: SOLID_SHADOW, shade: 0.15 },
      { kind: 'tower', x: 7, y: 0, width: 9, height: 52, behaviour: SOLID_SHADOW, shade: 0.3 },
      { kind: 'building', x: 26, y: 0, width: 30, height: 9, behaviour: SOLID_SHADOW, shade: 0.45 },
      { kind: 'building', x: -30, y: 0, width: 26, height: 8, behaviour: SOLID_SHADOW, shade: 0.5 },
      { kind: 'pole', x: 34, y: 0, width: 0.5, height: 24, behaviour: SOLID, shade: 0.3 },
    ],
    props: [
      { kind: 'flag', x: 34, y: 0, scale: 1.2 },
      { kind: 'fountain', x: 16, y: 0, scale: 1 },
      { kind: 'bush', x: -18, y: 0, scale: 0.8 },
    ],
  },

  // -------------------------------------------------------------------------
  // Monumen — monument plaza under heavy cloud. One very tall obstacle.
  // -------------------------------------------------------------------------
  {
    id: 'monumen',
    i18nKey: 'monumen',
    unlockWins: 10,
    sky: [
      [0, '#3d4c60'],
      [0.34, '#66768c'],
      [0.66, '#93a1b0'],
      [0.88, '#c2c9cd'],
      [1, '#dfe2df'],
    ],
    sun: { x: 20, y: 60, radius: 8, color: 'rgba(255, 252, 240, 0.5)', glow: 'rgba(255, 250, 235, 0.22)' },
    ridges: ['#5a6a5c', '#4c5a4e', '#3d4a3f'],
    ground: '#6f8154',
    groundAccent: 'rgba(255, 255, 255, 0.24)',
    haze: 'rgba(194, 201, 205, 0.3)',
    // Overcast, gustier air.
    windMultiplier: 1.14,
    gustMultiplier: 1.45,
    obstacles: [
      { kind: 'tower', x: 30, y: 0, width: 7, height: 62, behaviour: SOLID_SHADOW, shade: 0.1 },
      { kind: 'building', x: 30, y: 0, width: 20, height: 7, behaviour: SOLID, shade: 0.3 },
      { kind: 'tree', x: -20, y: 0, width: 9, height: 12, behaviour: SOFT, shade: 0.4 },
      { kind: 'tree', x: -6, y: 0, width: 8, height: 10, behaviour: SOFT, shade: 0.6 },
      { kind: 'tree', x: 8, y: 0, width: 9, height: 13, behaviour: SOFT, shade: 0.25 },
      { kind: 'pole', x: -30, y: 0, width: 0.4, height: 18, behaviour: SOLID, shade: 0.5 },
    ],
    props: [
      { kind: 'fountain', x: 0, y: 0, scale: 1.3 },
      { kind: 'bush', x: 18, y: 0, scale: 0.9 },
      { kind: 'bush', x: -12, y: 0, scale: 0.7 },
    ],
  },

  // -------------------------------------------------------------------------
  // Viaduk — arched viaduct. Arches to fly through, and a live tram cable above.
  // -------------------------------------------------------------------------
  {
    id: 'viaduk',
    i18nKey: 'viaduk',
    unlockWins: 14,
    sky: [
      [0, '#1d5fa8'],
      [0.36, '#3f8fd0'],
      [0.68, '#87c3e8'],
      [0.9, '#d5e9f5'],
      [1, '#f0f4f7'],
    ],
    sun: { x: -40, y: 48, radius: 6, color: '#fffbe8', glow: 'rgba(255, 251, 232, 0.3)' },
    ridges: ['#8f9aa6', '#a7b1ba', '#c4ccd2'],
    ground: '#9a9186',
    groundAccent: 'rgba(255, 255, 255, 0.26)',
    haze: 'rgba(213, 233, 245, 0.24)',
    windMultiplier: 1,
    gustMultiplier: 1.1,
    obstacles: [
      // The viaduct runs across the arena at a height that forces a choice:
      // climb over it, or thread the gap and risk the deck.
      { kind: 'arch', x: -22, y: 0, width: 40, height: 22, behaviour: SOLID_SHADOW, shade: 0.2 },
      { kind: 'arch', x: 18, y: 0, width: 34, height: 18, behaviour: SOLID_SHADOW, shade: 0.35 },
      { kind: 'pole', x: -4, y: 22, width: 0.4, height: 6, behaviour: SOLID, shade: 0.4 },
      { kind: 'pole', x: 34, y: 18, width: 0.4, height: 6, behaviour: SOLID, shade: 0.4 },
      // Tram catenary along the deck.
      powerline(-42, 27, -4, 28),
      powerline(-4, 28, 34, 24),
      { kind: 'tree', x: 6, y: 0, width: 8, height: 11, behaviour: SOFT, shade: 0.5 },
    ],
    props: [
      { kind: 'tram', x: -14, y: 22, scale: 1 },
      { kind: 'bush', x: 24, y: 0, scale: 0.8 },
    ],
  },
] as const

const ARENA_INDEX = new Map<ArenaId, ArenaDefinition>(ARENAS.map(arena => [arena.id, arena]))

export const DEFAULT_ARENA_ID: ArenaId = 'sawah'

export function getArena(id: ArenaId): ArenaDefinition {
  const arena = ARENA_INDEX.get(id)
  if (!arena) throw new Error(`Unknown arena id: ${id}`)
  return arena
}

export function findArena(id: string | undefined): ArenaDefinition | undefined {
  return id ? ARENA_INDEX.get(id as ArenaId) : undefined
}

export function isArenaUnlocked(arena: ArenaDefinition, wins: number): boolean {
  return wins >= arena.unlockWins
}

/**
 * Difficulty summary for the arena picker, so a player can see what they are
 * choosing rather than discovering the cables mid-duel.
 */
export interface ArenaHazards {
  /** Structures the kite can crash into. */
  solidCount: number
  /** Cables that will shred a line dragged across them. */
  cableCount: number
  /** Obstacles that block wind downwind of themselves. */
  shadowCount: number
  /** 0..1 rough difficulty, from hazard count and wind character. */
  rating: number
}

export function arenaHazards(arena: ArenaDefinition): ArenaHazards {
  let solidCount = 0
  let cableCount = 0
  let shadowCount = 0

  for (const obstacle of arena.obstacles) {
    if (obstacle.behaviour.solid) solidCount += 1
    if (obstacle.behaviour.snag) cableCount += 1
    if (obstacle.behaviour.windShadow) shadowCount += 1
  }

  // Cables dominate the difficulty: they cut, and they cannot be cut back.
  const hazardScore = solidCount * 0.045 + cableCount * 0.13 + shadowCount * 0.05
  const windScore = (arena.windMultiplier - 1) * 0.6 + (arena.gustMultiplier - 1) * 0.35

  return {
    solidCount,
    cableCount,
    shadowCount,
    rating: Math.max(0, Math.min(1, hazardScore + windScore)),
  }
}

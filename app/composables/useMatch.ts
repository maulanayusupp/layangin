import { getArena } from '~/data/arenas'
import { createMatchEngine, type MatchEngine } from '~/services/game/engine'
import { createControlState, createLocalInput, type ControlState } from '~/services/game/input/local'
import { createArenaRenderer, type ArenaRenderer } from '~/services/game/render/renderer'
import {
  createRecorder,
  createReplayInput,
  encodeReplay,
  REPLAY_VERSION,
  type Replay,
  type ReplayRecorder,
} from '~/services/game/replay'
import { createMatchSeed } from '~/services/game/math/random'
import { DEFAULT_TIME_LIMIT, STARTING_HP } from '~/services/game/constants'
import { exchangeAdvantage } from '~/services/game/physics/combat'
import { breakingTension } from '~/services/game/physics/fighter'
import { describeWind } from '~/services/game/physics/wind'
import { computeReward } from '~/services/economy/rewards'
import {
  isPlayerWin,
  type MatchOutcome,
  type MatchPhase,
  type MatchReward,
  type MatchStats,
  type OpponentDefinition,
  type RoundResult,
} from '~/services/game/types'
import { clamp01 } from '~/services/game/math/scalar'
import { createSfxEngine, type SfxEngine } from '~/services/audio/sfx'

/**
 * Bridges the non-reactive simulation to Vue.
 *
 * ## The reactivity boundary
 * The engine mutates one long-lived snapshot object 120 times a second. Making
 * that object reactive would mean thousands of dependency notifications per
 * second, and the render would fight the simulation for the frame budget.
 *
 * So the snapshot stays plain. Once per animation frame this composable copies
 * only the handful of scalars the HUD actually shows into refs. The canvas reads
 * the snapshot directly and never goes through Vue at all.
 */
/** One opponent's line on the HUD. */
export interface RivalHud {
  /** 0..1 line condition. */
  integrity: number
  hp: number
  /** True once they are out of lives and out of the match. */
  eliminated: boolean
  /** True while this is the opponent the player is closest to. */
  primary: boolean
}

export interface MatchHud {
  phase: MatchPhase
  countdown: number
  elapsed: number
  timeRemaining: number
  /** 0..1 */
  playerIntegrity: number
  rivalIntegrity: number
  playerStamina: number
  /** 0..1 of breaking tension. Above ~0.8 the line is at risk. */
  playerLoad: number
  rivalLoad: number
  playerTension: number
  playerAltitude: number
  lineLength: number
  windSpeed: number
  windLabel: ReturnType<typeof describeWind>
  /** 0..1 — above 0.5 the player is winning the exchange. */
  advantage: number
  clashing: boolean
  /** True while the line is dragging over an arena cable. */
  snagged: boolean
  /** Lives left. The match ends when the player, or every opponent, reaches 0. */
  playerHp: number
  rivalHp: number
  maxHp: number
  /**
   * Every opponent's standing, in ladder order — so a free-for-all HUD can show
   * three rows of pips instead of one. A duel has exactly one entry.
   */
  rivals: RivalHud[]
  /** 1-based round being fought. */
  round: number
  /** Seconds left on the between-rounds pause; 0 while flying. */
  roundBreak: number
  /** How the previous round ended, for the banner. */
  lastRound: RoundResult | null
  snapReady: boolean
  snapCooldown: number
}

function emptyHud(): MatchHud {
  return {
    phase: 'briefing',
    countdown: 0,
    elapsed: 0,
    timeRemaining: DEFAULT_TIME_LIMIT,
    playerIntegrity: 1,
    rivalIntegrity: 1,
    playerStamina: 1,
    playerLoad: 0,
    rivalLoad: 0,
    playerTension: 0,
    playerAltitude: 0,
    lineLength: 0,
    windSpeed: 0,
    windLabel: 'good',
    advantage: 0.5,
    clashing: false,
    snagged: false,
    playerHp: STARTING_HP,
    rivalHp: STARTING_HP,
    maxHp: STARTING_HP,
    rivals: [],
    round: 1,
    roundBreak: 0,
    lastRound: null,
    snapReady: true,
    snapCooldown: 0,
  }
}

export interface UseMatchOptions {
  /** Canvas element to draw into. */
  canvas: Ref<HTMLCanvasElement | null>
  /** Element whose size the canvas should track. Defaults to the canvas parent. */
  container?: Ref<HTMLElement | null>
  /**
   * The HUD's bottom row. Its height is reserved at the foot of the canvas so the
   * ground line and the fighters standing on it are never drawn underneath it.
   */
  hudFooter?: Ref<HTMLElement | null>
}

export function useMatch({ canvas, container, hudFooter }: UseMatchOptions) {
  const player = usePlayerStore()
  const settings = useSettingsStore()

  const controls: ControlState = createControlState()
  const hud = ref<MatchHud>(emptyHud())
  const outcome = ref<MatchOutcome>({ kind: 'pending' })
  const reward = ref<MatchReward | null>(null)
  const coinsGranted = ref(0)
  /** Everyone in the current match, ladder order. One entry for a duel. */
  const opponents = ref<OpponentDefinition[]>([])
  /** The one the player picked; drives the briefing and the result screen. */
  const opponent = computed<OpponentDefinition | null>(() => opponents.value[0] ?? null)
  const running = ref(false)
  const paused = ref(false)
  const stats = ref<MatchStats | null>(null)

  let engine: MatchEngine | null = null
  let renderer: ArenaRenderer | null = null
  let frame = 0
  let lastTimestamp = 0
  let resizeObserver: ResizeObserver | null = null
  let resultBanked = false

  /**
   * Every match records itself.
   *
   * The cost is one wrapper around the input source and a few hundred array rows,
   * which is nothing next to being able to hand someone the match itself instead of
   * a description of it. `replayText` is only built once the match resolves, so the
   * encoding never runs inside the frame loop.
   */
  let recorder: ReplayRecorder | null = null
  /**
   * Set when the running match is a playback rather than a live game. A ref, not a
   * plain binding: the UI reads it through a computed, and a plain `let` would
   * never notify it.
   */
  const playingBack = ref<Replay | null>(null)
  /** Everything needed to rebuild the finished match, ready to copy. */
  const replayText = ref<string | null>(null)
  /**
   * Set when a playback did not reproduce what it recorded.
   *
   * A replay stores no state, only the inputs — which is what makes it tiny, and
   * also what makes it fragile against a change to the simulation. The recording
   * carries the result it originally produced precisely so this can be checked. A
   * silent divergence would be the worst outcome: the whole value of a replay is
   * that it is the same match, so when it is not, say so.
   */
  const replayMismatch = ref(false)
  /** Everything a replay needs about the current match's setup. */
  let lastConfig: {
    seed: number
    arenaId: Replay['arenaId']
    opponentIds: Replay['opponentIds']
    loadout: Replay['loadout']
    difficultyScale: number
    timeLimit: number
  } | null = null

  /**
   * Sound is driven from the render loop rather than from watchers, because the
   * events it reacts to live on the non-reactive snapshot. Each cue below is
   * edge-triggered off a remembered previous value.
   */
  let sfx: SfxEngine | null = null
  let lastRoundNumber = 1
  let lastRoundLossCount = 0
  let lastSnapActive = false
  let announcedResult = false
  let announcedFall = false
  /** Carry for the sparse spark ticks laid over the rasp. */
  let sparkCarry = 0

  const syncHud = (): void => {
    if (!engine) return
    const snapshot = engine.snapshot
    const { player: self, rival } = snapshot

    hud.value = {
      phase: snapshot.phase,
      countdown: snapshot.countdown,
      elapsed: snapshot.elapsed,
      timeRemaining: Math.max(0, snapshot.timeLimit - snapshot.elapsed),
      playerIntegrity: self.lineIntegrity,
      rivalIntegrity: rival.lineIntegrity,
      playerStamina: self.stamina,
      playerLoad: clamp01(self.tension / breakingTension(self.stats)),
      rivalLoad: clamp01(rival.tension / breakingTension(rival.stats)),
      playerTension: self.tension,
      playerAltitude: self.position.y,
      lineLength: self.lineLength,
      windSpeed: snapshot.windSpeed,
      windLabel: describeWind(snapshot.windSpeed),
      advantage: exchangeAdvantage(self, rival),
      clashing: snapshot.clashes.some(clash => clash.kind === 'line'),
      snagged: self.snagged,
      playerHp: self.hp,
      rivalHp: rival.hp,
      maxHp: STARTING_HP,
      rivals: snapshot.fighters.slice(1).map(fighter => ({
        integrity: fighter.lineIntegrity,
        hp: fighter.hp,
        eliminated: fighter.eliminated,
        primary: fighter === rival,
      })),
      round: snapshot.round,
      roundBreak: snapshot.roundBreak,
      lastRound: snapshot.lastRound,
      snapReady: self.snapCooldown === 0 && self.stamina > 0.22,
      snapCooldown: self.snapCooldown,
    }
  }

  /**
   * Translate this frame's simulation state into sound.
   *
   * Continuous contacts (line rasp, cable zing) are levels; everything else is
   * an edge. Kept in one place so a new cue cannot end up firing twice.
   */
  /** Seconds of the last rendered frame, for rate-based audio cues. */
  let lastFrameSeconds = 0

  const updateAudio = (): void => {
    if (!engine || !sfx) return
    const snapshot = engine.snapshot
    const { player: self, rival } = snapshot

    // Line-on-line rasp: loudest at the strongest crossing.
    let clashIntensity = 0
    let cableIntensity = 0
    for (const clash of snapshot.clashes) {
      if (clash.kind === 'obstacle') cableIntensity = Math.max(cableIntensity, clash.intensity)
      else clashIntensity = Math.max(clashIntensity, clash.intensity)
    }

    const flying = snapshot.phase === 'flying'
    sfx.setClash(flying ? clashIntensity : 0)
    sfx.setCable(flying ? cableIntensity : 0)

    /**
     * Wind bed. Mapped from the reference speed across the range the arenas use
     * (roughly 4–11 m/s), so a gusty afternoon is audibly windier than a calm one.
     */
    const windLevel = snapshot.phase === 'resolved'
      ? 0
      : clamp01((snapshot.windSpeed - 3) / 9)
    sfx.setWind(windLevel)

    // The player's own spool. Only theirs: hearing the opponent's reel would be
    // information a flyer on the field does not have.
    sfx.setReel(flying ? self.reelRate : 0)

    // Sparse ticks over the rasp: a flat noise band alone reads as static, and
    // glass-coated line grinding is granular. Rate follows contact intensity.
    if (flying && clashIntensity > 0.05) {
      sparkCarry += clashIntensity * 14 * lastFrameSeconds
      while (sparkCarry >= 1) {
        sparkCarry -= 1
        sfx.play('spark', 0.5 + clashIntensity * 0.5)
      }
    }
    else {
      sparkCarry = 0
    }

    // The deciding kite is on its way down.
    if (snapshot.phase === 'falling' && !announcedFall) {
      announcedFall = true
      sfx.play('fall')
    }

    // The player's own yank.
    const snapping = self.snapActive > 0
    if (snapping && !lastSnapActive) sfx.play('yank')
    lastSnapActive = snapping

    // A round just ended: name the cause, then who lost it.
    const roundsLost = snapshot.stats.roundsLost + snapshot.stats.roundsWon
    if (roundsLost > lastRoundLossCount) {
      lastRoundLossCount = roundsLost
      const reason = snapshot.lastRound?.reason
      if (reason === 'crash') sfx.play('crash')
      else if (reason === 'obstacle') sfx.play('obstacle')
      else sfx.play('cut')

      if (snapshot.phase !== 'resolved') {
        sfx.play(snapshot.lastRound?.loserIsPlayer ? 'roundLost' : 'roundWon', 0.8)
      }
    }

    // A new round launched.
    if (snapshot.round > lastRoundNumber) {
      lastRoundNumber = snapshot.round
      sfx.play('roundStart', 0.7)
      sfx.play('launch', 0.6)
    }

    // The match is over.
    if (snapshot.phase === 'resolved' && !announcedResult) {
      announcedResult = true
      sfx.stopAll()
      const won = isPlayerWin(snapshot.outcome)
      sfx.play(won ? 'win' : 'lose')
      if (won) sfx.play('coin', 0.6)
    }

    // Keep the rival referenced: its state feeds the clash intensity above via
    // the snapshot, and reading it here documents that this is a two-sided cue.
    void rival
  }

  /** Bank the result exactly once, the moment the match resolves. */
  const bankResult = (): void => {
    if (!engine || opponents.value.length === 0 || resultBanked) return
    const snapshot = engine.snapshot
    if (snapshot.phase !== 'resolved') return

    resultBanked = true
    outcome.value = snapshot.outcome
    stats.value = { ...snapshot.stats }
    replayText.value = buildReplayText()

    /**
     * A playback pays nothing.
     *
     * Without this, watching a recorded win would grant its coins again every time
     * it was played — and since a replay is a shareable string, that is a coin
     * printer anyone could pass around. The result screen still shows what
     * happened; it simply is not banked.
     */
    if (playingBack.value) {
      reward.value = null
      coinsGranted.value = 0

      const recorded = playingBack.value.result
      if (recorded) {
        const winner = snapshot.outcome.kind === 'pending' ? 'draw' : snapshot.outcome.winner
        replayMismatch.value
          = recorded.kind !== snapshot.outcome.kind
            || recorded.winner !== winner
            // A hundredth of a second of tolerance: the duration is stored to two
            // decimals, so an exact comparison would fail on rounding alone.
            || Math.abs(recorded.durationSeconds - snapshot.stats.durationSeconds) > 0.01
      }

      return
    }

    const earned = computeReward(
      snapshot.outcome,
      opponents.value,
      snapshot.stats,
      player.resolved.rewardMultiplier,
      opponents.value.map(entry => player.hasDefeated(entry.id)),
    )

    reward.value = earned
    coinsGranted.value = player.recordMatch(
      opponents.value.map(entry => entry.id),
      earned,
      isPlayerWin(snapshot.outcome),
    )
  }

  /** Encode the match that just finished, or null if it was not recorded. */
  const buildReplayText = (): string | null => {
    if (!engine || !recorder || !lastConfig) return null

    const snapshot = engine.snapshot

    return encodeReplay({
      version: REPLAY_VERSION,
      seed: lastConfig.seed,
      arenaId: lastConfig.arenaId,
      opponentIds: lastConfig.opponentIds,
      loadout: lastConfig.loadout,
      difficultyScale: lastConfig.difficultyScale,
      timeLimit: lastConfig.timeLimit,
      commands: recorder.commands.map(entry => [...entry] as [number, number, number, 0 | 1]),
      result: {
        kind: snapshot.outcome.kind,
        winner: snapshot.outcome.kind === 'pending' ? 'draw' : snapshot.outcome.winner,
        durationSeconds: snapshot.stats.durationSeconds,
        roundsWon: snapshot.stats.roundsWon,
        roundsLost: snapshot.stats.roundsLost,
      },
    })
  }

  const resizeCanvas = (): void => {
    const element = canvas.value
    if (!element || !renderer) return

    const host = container?.value ?? element.parentElement
    const width = host?.clientWidth ?? element.clientWidth
    const height = host?.clientHeight ?? element.clientHeight
    if (width === 0 || height === 0) return

    const ratio = canvasPixelRatio()
    element.width = Math.round(width * ratio)
    element.height = Math.round(height * ratio)

    const ctx = element.getContext('2d')
    // Draw in CSS pixels; the transform handles the device ratio.
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0)

    // Measured rather than hardcoded: the HUD wraps differently at every width.
    const footer = hudFooter?.value
    const insetBottom = footer ? footer.getBoundingClientRect().height : 0

    renderer.resize(width, height, ratio, insetBottom)
  }

  const tick = (timestamp: number): void => {
    frame = requestAnimationFrame(tick)

    if (!engine || !renderer) return

    const dt = lastTimestamp === 0 ? 0 : (timestamp - lastTimestamp) / 1000
    lastTimestamp = timestamp

    if (!paused.value) {
      engine.advance(dt)
    }

    renderer.render(engine.snapshot, paused.value ? 0 : dt)
    syncHud()

    lastFrameSeconds = Math.min(dt, 0.05)
    if (paused.value) sfx?.stopAll()
    else updateAudio()

    if (engine.snapshot.phase === 'resolved') {
      bankResult()
    }
  }

  /**
   * Begin a match against everyone in `targets`, ladder order.
   *
   * A duel passes one; a free-for-all passes two or three, and the engine spreads
   * their anchors across a wider field to suit.
   */
  /**
   * Begin a match against everyone in `targets`.
   *
   * `replay` turns this into a playback: the seed, the arena, the loadout and the
   * opponents all come from the recording instead of the live save, and the
   * player's commands are fed from the recorded stream. Because a match is a pure
   * function of exactly those things, the result is the same match again rather
   * than a similar one.
   */
  function start(targets: readonly OpponentDefinition[], replay: Replay | null = null): void {
    stop()

    const element = canvas.value
    if (!element) return

    const ctx = element.getContext('2d', { alpha: false })
    if (!ctx) return

    const seed = replay?.seed ?? createMatchSeed()

    playingBack.value = replay
    replayText.value = null
    replayMismatch.value = false
    opponents.value = [...targets]
    outcome.value = { kind: 'pending' }
    reward.value = null
    stats.value = null
    coinsGranted.value = 0
    resultBanked = false
    lastRoundNumber = 1
    lastRoundLossCount = 0
    lastSnapActive = false
    announcedResult = false
    announcedFall = false
    sparkCarry = 0

    if (!sfx) sfx = createSfxEngine(!settings.sound)
    sfx.setMuted(!settings.sound)

    controls.walk = 0
    controls.reel = 0
    controls.snap = false

    const arena = replay ? getArena(replay.arenaId) : player.activeArena
    const loadout = replay?.loadout ?? player.loadout
    const timeLimit = replay?.timeLimit ?? DEFAULT_TIME_LIMIT
    const difficultyScale = replay?.difficultyScale ?? player.difficultyScale

    renderer = createArenaRenderer({
      ctx,
      arena,
      seed,
      reducedEffects: settings.reducedEffects,
    })

    // Live play records; a playback does not re-record itself.
    recorder = replay ? null : createRecorder(createLocalInput(controls))

    lastConfig = {
      seed,
      arenaId: arena.id,
      opponentIds: opponents.value.map(entry => entry.id),
      loadout,
      difficultyScale,
      timeLimit,
    }

    engine = createMatchEngine({
      config: {
        seed,
        opponents: opponents.value,
        player: loadout,
        arena,
        timeLimit,
        difficultyScale,
      },
      playerInput: replay ? createReplayInput(replay) : (recorder as ReplayRecorder),
    })

    resizeCanvas()

    if (!resizeObserver && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => resizeCanvas())
      const host = container?.value ?? element.parentElement
      if (host) resizeObserver.observe(host)
    }

    running.value = true
    paused.value = false
    lastTimestamp = 0
    frame = requestAnimationFrame(tick)
    syncHud()
  }

  function stop(): void {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    sfx?.stopAll()
    engine?.dispose()
    engine = null
    renderer = null
    running.value = false
    paused.value = false
  }

  function pause(): void {
    if (running.value) paused.value = true
  }

  function resume(): void {
    paused.value = false
    // Drop the accumulated wall time so the sim does not fast-forward.
    lastTimestamp = 0
  }

  function skipCountdown(): void {
    engine?.skipCountdown()
  }

  onBeforeUnmount(() => {
    stop()
    sfx?.dispose()
    sfx = null
    resizeObserver?.disconnect()
    resizeObserver = null
  })

  // Toggling sound in the shop must take effect on a match already in progress.
  watch(
    () => settings.sound,
    (enabled) => {
      sfx?.setMuted(!enabled)
      if (!enabled) sfx?.stopAll()
    },
  )

  // Backgrounding a tab should not mean losing a match in progress.
  if (import.meta.client) {
    useEventListener(document, 'visibilitychange', () => {
      if (document.hidden) pause()
    })
  }

  return {
    controls,
    hud,
    outcome,
    reward,
    coinsGranted,
    stats,
    opponent,
    opponents,
    /** The finished match, encoded. Null until it resolves. */
    replayText,
    /** True while watching a recording rather than playing. */
    isReplay: computed(() => playingBack.value !== null),
    /** True when a playback did not reproduce the result it recorded. */
    replayMismatch,
    running,
    paused,
    start,
    stop,
    pause,
    resume,
    skipCountdown,
  }
}

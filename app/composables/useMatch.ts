import { createMatchEngine, type MatchEngine } from '~/services/game/engine'
import { createControlState, createLocalInput, type ControlState } from '~/services/game/input/local'
import { createArenaRenderer, type ArenaRenderer } from '~/services/game/render/renderer'
import { createMatchSeed } from '~/services/game/math/random'
import { DEFAULT_TIME_LIMIT } from '~/services/game/constants'
import { exchangeAdvantage } from '~/services/game/physics/combat'
import { breakingTension } from '~/services/game/physics/fighter'
import { describeWind } from '~/services/game/physics/wind'
import { computeReward, isPlayerWin } from '~/services/economy/rewards'
import type {
  MatchOutcome,
  MatchPhase,
  MatchReward,
  MatchStats,
  OpponentDefinition,
} from '~/services/game/types'
import { clamp01 } from '~/services/game/math/scalar'

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
    snapReady: true,
    snapCooldown: 0,
  }
}

export interface UseMatchOptions {
  /** Canvas element to draw into. */
  canvas: Ref<HTMLCanvasElement | null>
  /** Element whose size the canvas should track. Defaults to the canvas parent. */
  container?: Ref<HTMLElement | null>
}

export function useMatch({ canvas, container }: UseMatchOptions) {
  const player = usePlayerStore()
  const settings = useSettingsStore()

  const controls: ControlState = createControlState()
  const hud = ref<MatchHud>(emptyHud())
  const outcome = ref<MatchOutcome>({ kind: 'pending' })
  const reward = ref<MatchReward | null>(null)
  const coinsGranted = ref(0)
  const opponent = ref<OpponentDefinition | null>(null)
  const running = ref(false)
  const paused = ref(false)
  const stats = ref<MatchStats | null>(null)

  let engine: MatchEngine | null = null
  let renderer: ArenaRenderer | null = null
  let frame = 0
  let lastTimestamp = 0
  let resizeObserver: ResizeObserver | null = null
  let resultBanked = false

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
      snapReady: self.snapCooldown === 0 && self.stamina > 0.22,
      snapCooldown: self.snapCooldown,
    }
  }

  /** Bank the result exactly once, the moment the match resolves. */
  const bankResult = (): void => {
    if (!engine || !opponent.value || resultBanked) return
    const snapshot = engine.snapshot
    if (snapshot.phase !== 'resolved') return

    resultBanked = true
    outcome.value = snapshot.outcome
    stats.value = { ...snapshot.stats }

    const computed = computeReward(
      snapshot.outcome,
      opponent.value,
      snapshot.stats,
      player.resolved.rewardMultiplier,
      player.hasDefeated(opponent.value.id),
    )

    reward.value = computed
    coinsGranted.value = player.recordMatch(
      opponent.value.id,
      computed,
      isPlayerWin(snapshot.outcome),
    )
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
    renderer.resize(width, height, ratio)
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

    if (engine.snapshot.phase === 'resolved') {
      bankResult()
    }
  }

  function start(target: OpponentDefinition): void {
    stop()

    const element = canvas.value
    if (!element) return

    const ctx = element.getContext('2d', { alpha: false })
    if (!ctx) return

    const seed = createMatchSeed()

    opponent.value = target
    outcome.value = { kind: 'pending' }
    reward.value = null
    stats.value = null
    coinsGranted.value = 0
    resultBanked = false
    controls.walk = 0
    controls.reel = 0
    controls.snap = false

    const arena = player.activeArena

    renderer = createArenaRenderer({
      ctx,
      arena,
      seed,
      reducedEffects: settings.reducedEffects,
    })

    engine = createMatchEngine({
      config: {
        seed,
        opponent: target,
        player: player.loadout,
        arena,
        timeLimit: DEFAULT_TIME_LIMIT,
        difficultyScale: player.difficultyScale,
      },
      playerInput: createLocalInput(controls),
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
    resizeObserver?.disconnect()
    resizeObserver = null
  })

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
    running,
    paused,
    start,
    stop,
    pause,
    resume,
    skipCountdown,
  }
}

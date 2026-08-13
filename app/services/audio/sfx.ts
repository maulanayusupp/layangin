/**
 * Sound effects, synthesized in the Web Audio API.
 *
 * ## Why no audio files
 * Every sound here is generated from oscillators and a noise buffer, so the game
 * ships no binary audio assets at all. That keeps the download small, keeps the
 * repository text-only, and means a sound can be retuned by editing a number
 * rather than re-recording a sample.
 *
 * ## Autoplay policy
 * Browsers refuse to start an `AudioContext` before the user interacts with the
 * page, and a context created too early lands in `suspended`. So the context is
 * created lazily on the first `play()` after a gesture, and `resume()` is called
 * defensively. Nothing throws if audio is unavailable — the game is fully
 * playable in silence.
 *
 * ## The two continuous sounds
 * ## The continuous sounds
 * `clash` (line-on-line rasp), `cable` (steel zing), `reel` (the spool) and `wind`
 * (the field itself) are *states*, not events: they last as long as the condition does. They run as
 * gated loops whose gain tracks a level, rather than as repeated one-shots, which
 * would machine-gun.
 */

export type SfxName
  = | 'cut'
    | 'crash'
    | 'obstacle'
    | 'yank'
    | 'roundStart'
    | 'roundWon'
    | 'roundLost'
    | 'win'
    | 'lose'
    | 'coin'
    | 'select'
    | 'fall'
    | 'spark'
    | 'launch'

export interface SfxEngine {
  /** Fire a one-shot. Silently ignored when muted or unavailable. */
  play(name: SfxName, volume?: number): void
  /**
   * Set the intensity of the line-on-line rasp, 0..1. 0 stops it.
   * Called every frame from the render loop.
   */
  setClash(intensity: number): void
  /** Set the intensity of the cable-contact zing, 0..1. 0 stops it. */
  setCable(intensity: number): void
  /**
   * Spool sound. `rate` is the reel rate in metres per second, signed: positive
   * hauls in, negative pays out. 0 stops it.
   *
   * One loop for both directions, with the filter moved rather than two separate
   * sounds — hauling is line rasping through a hand under load, paying out is a
   * spool running free, and the difference is mostly brightness.
   */
  setReel(rate: number): void
  /**
   * Wind bed level, 0..1, from the current wind speed. A constant presence rather
   * than an event: the arena sounds like an open field, and a gust is audible
   * before it is visible in the HUD.
   */
  setWind(level: number): void
  /** Mute/unmute everything, including the loops. */
  setMuted(muted: boolean): void
  readonly muted: boolean
  /** Stop all loops. Call when a match ends or the component unmounts. */
  stopAll(): void
  dispose(): void
}

/** Master level. Deliberately conservative: this is a game in a browser tab. */
const MASTER_GAIN = 0.32

type Ctor = typeof AudioContext

function audioContextCtor(): Ctor | null {
  if (typeof window === 'undefined') return null
  const legacy = (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext
  return window.AudioContext ?? legacy ?? null
}

export function createSfxEngine(initiallyMuted = false): SfxEngine {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let noiseBuffer: AudioBuffer | null = null
  let muted = initiallyMuted
  let disposed = false

  /** One shared loop per continuous sound, started on demand. */
  interface Loop {
    source: AudioBufferSourceNode
    gain: GainNode
    active: boolean
  }
  let clashLoop: Loop | null = null
  let cableLoop: Loop | null = null
  let windLoop: Loop | null = null
  let reelLoop: Loop | null = null
  /** The reel loop's filter, retuned as the direction changes. */
  let reelFilter: BiquadFilterNode | null = null

  const ensureContext = (): AudioContext | null => {
    if (disposed) return null

    if (!ctx) {
      const Ctor = audioContextCtor()
      if (!Ctor) return null

      try {
        ctx = new Ctor()
      }
      catch {
        // Some locked-down environments refuse outright. Stay silent.
        return null
      }

      master = ctx.createGain()
      master.gain.value = muted ? 0 : MASTER_GAIN
      master.connect(ctx.destination)

      // Two seconds of white noise, reused by every noise-based sound.
      const length = Math.floor(ctx.sampleRate * 2)
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
    }

    // A context can be suspended by the browser at any time.
    if (ctx.state === 'suspended') void ctx.resume()

    return ctx
  }

  /** Percussive envelope: fast attack, exponential decay. */
  const envelope = (
    context: AudioContext,
    peak: number,
    attack: number,
    decay: number,
  ): GainNode => {
    const gain = context.createGain()
    const now = context.currentTime
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay)
    return gain
  }

  const noiseBurst = (
    context: AudioContext,
    duration: number,
    filter: { type: BiquadFilterType, from: number, to: number, q?: number },
    peak: number,
  ): void => {
    if (!noiseBuffer || !master) return

    const source = context.createBufferSource()
    source.buffer = noiseBuffer
    source.loop = true

    const band = context.createBiquadFilter()
    band.type = filter.type
    band.frequency.setValueAtTime(filter.from, context.currentTime)
    band.frequency.exponentialRampToValueAtTime(
      Math.max(20, filter.to),
      context.currentTime + duration,
    )
    band.Q.value = filter.q ?? 1

    const gain = envelope(context, peak, 0.006, duration)

    source.connect(band).connect(gain).connect(master)
    source.start()
    source.stop(context.currentTime + duration + 0.05)
  }

  const tone = (
    context: AudioContext,
    type: OscillatorType,
    from: number,
    to: number,
    duration: number,
    peak: number,
    delay = 0,
  ): void => {
    if (!master) return

    const osc = context.createOscillator()
    osc.type = type
    const start = context.currentTime + delay
    osc.frequency.setValueAtTime(from, start)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration)

    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

    osc.connect(gain).connect(master)
    osc.start(start)
    osc.stop(start + duration + 0.05)
  }

  /**
   * Build (or reuse) a gated noise loop for the continuous sounds.
   * `onFilter` hands the filter node back so a caller can retune it later.
   */
  const ensureLoop = (
    existing: Loop | null,
    context: AudioContext,
    filter: { type: BiquadFilterType, frequency: number, q: number },
    onFilter?: (node: BiquadFilterNode) => void,
  ): Loop | null => {
    if (existing) return existing
    if (!noiseBuffer || !master) return null

    const source = context.createBufferSource()
    source.buffer = noiseBuffer
    source.loop = true

    const band = context.createBiquadFilter()
    band.type = filter.type
    band.frequency.value = filter.frequency
    band.Q.value = filter.q
    onFilter?.(band)

    const gain = context.createGain()
    gain.gain.value = 0

    source.connect(band).connect(gain).connect(master)
    source.start()

    return { source, gain, active: true }
  }

  /** Ramp a loop's gain smoothly, so intensity changes do not click. */
  const rampLoop = (loop: Loop | null, context: AudioContext, target: number): void => {
    if (!loop) return
    loop.gain.gain.setTargetAtTime(target, context.currentTime, 0.05)
  }

  const stopLoop = (loop: Loop | null): void => {
    if (!loop) return
    try {
      loop.gain.gain.value = 0
      loop.source.stop()
    }
    catch {
      // Already stopped.
    }
    loop.active = false
  }

  return {
    get muted() {
      return muted
    },

    play(name: SfxName, volume = 1): void {
      if (muted) return
      const context = ensureContext()
      if (!context) return

      const level = Math.max(0, Math.min(1, volume))

      switch (name) {
        case 'cut':
          // The snap of a parting line: a bright crack with a pitch drop.
          noiseBurst(context, 0.22, { type: 'bandpass', from: 5200, to: 700, q: 1.2 }, 0.55 * level)
          tone(context, 'triangle', 900, 180, 0.24, 0.16 * level)
          break

        case 'crash':
          // Kite into the ground: low thud plus a dry scatter.
          tone(context, 'sine', 140, 45, 0.34, 0.4 * level)
          noiseBurst(context, 0.3, { type: 'lowpass', from: 900, to: 180, q: 0.7 }, 0.3 * level)
          break

        case 'obstacle':
          // Into a wall: harder, shorter, more mid-range than the ground.
          tone(context, 'square', 220, 70, 0.2, 0.22 * level)
          noiseBurst(context, 0.26, { type: 'bandpass', from: 1600, to: 320, q: 0.9 }, 0.34 * level)
          break

        case 'yank':
          // A sharp haul: air moving over the line.
          noiseBurst(context, 0.16, { type: 'bandpass', from: 700, to: 2600, q: 2.2 }, 0.26 * level)
          break

        case 'roundStart':
          tone(context, 'triangle', 620, 620, 0.1, 0.16 * level)
          tone(context, 'triangle', 930, 930, 0.14, 0.18 * level, 0.13)
          break

        case 'roundWon':
          tone(context, 'triangle', 700, 1050, 0.16, 0.18 * level)
          break

        case 'roundLost':
          tone(context, 'triangle', 520, 300, 0.22, 0.18 * level)
          break

        case 'win':
          // Rising three-note figure.
          tone(context, 'triangle', 523, 523, 0.16, 0.2 * level)
          tone(context, 'triangle', 659, 659, 0.16, 0.2 * level, 0.14)
          tone(context, 'triangle', 880, 880, 0.34, 0.22 * level, 0.28)
          break

        case 'lose':
          tone(context, 'triangle', 494, 494, 0.18, 0.18 * level)
          tone(context, 'triangle', 392, 392, 0.18, 0.18 * level, 0.16)
          tone(context, 'sine', 262, 220, 0.44, 0.2 * level, 0.32)
          break

        case 'coin':
          tone(context, 'square', 1180, 1180, 0.06, 0.1 * level)
          tone(context, 'square', 1760, 1760, 0.12, 0.1 * level, 0.06)
          break

        case 'select':
          tone(context, 'triangle', 880, 880, 0.05, 0.09 * level)
          break

        case 'fall':
          // A cut kite tumbling away: falling pitch, air rushing over the sail.
          noiseBurst(context, 1.1, { type: 'bandpass', from: 1800, to: 180, q: 1.6 }, 0.3 * level)
          tone(context, 'sine', 520, 90, 1.2, 0.12 * level)
          break

        case 'spark':
          // A single glass-on-glass tick, fired sparingly during a clash so the
          // rasp has texture instead of being a flat band of noise.
          noiseBurst(context, 0.05, { type: 'bandpass', from: 6200, to: 3800, q: 6 }, 0.2 * level)
          break

        case 'launch':
          noiseBurst(context, 0.4, { type: 'bandpass', from: 300, to: 1500, q: 1.2 }, 0.18 * level)
          break
      }
    },

    setClash(intensity: number): void {
      if (muted || intensity <= 0.001) {
        if (clashLoop) rampLoop(clashLoop, ctx!, 0)
        return
      }

      const context = ensureContext()
      if (!context) return

      // Dry mid-band rasp: two abrasive lines sawing across each other.
      clashLoop = ensureLoop(clashLoop, context, { type: 'bandpass', frequency: 2400, q: 1.4 })
      rampLoop(clashLoop, context, Math.min(1, intensity) * 0.34)
    },

    setCable(intensity: number): void {
      if (muted || intensity <= 0.001) {
        if (cableLoop) rampLoop(cableLoop, ctx!, 0)
        return
      }

      const context = ensureContext()
      if (!context) return

      // Higher and more resonant than the rasp: this is steel, and it should
      // sound like a warning rather than like a fair fight.
      cableLoop = ensureLoop(cableLoop, context, { type: 'bandpass', frequency: 5200, q: 9 })
      rampLoop(cableLoop, context, Math.min(1, intensity) * 0.3)
    },

    setReel(rate: number): void {
      const speed = Math.abs(rate)

      if (muted || speed < 0.4) {
        if (reelLoop && ctx) rampLoop(reelLoop, ctx, 0)
        return
      }

      const context = ensureContext()
      if (!context) return

      reelLoop = ensureLoop(
        reelLoop,
        context,
        { type: 'bandpass', frequency: 1400, q: 2.4 },
        (node) => {
          reelFilter = node
        },
      )

      if (reelFilter) {
        // Hauling under load is brighter and tighter; a free-running spool is
        // lower and broader. Ramped, so a direction change does not click.
        const target = rate > 0 ? 2100 : 760
        reelFilter.frequency.setTargetAtTime(target, context.currentTime, 0.08)
      }

      // Level tracks how fast line is moving, capped at the base reel speed.
      rampLoop(reelLoop, context, Math.min(1, speed / 9) * 0.15)
    },

    setWind(level: number): void {
      if (muted || level <= 0.001) {
        if (windLoop && ctx) rampLoop(windLoop, ctx, 0)
        return
      }

      const context = ensureContext()
      if (!context) return

      // Low, wide band: moving air rather than a whistle.
      windLoop = ensureLoop(windLoop, context, { type: 'lowpass', frequency: 620, q: 0.8 })
      rampLoop(windLoop, context, Math.min(1, level) * 0.16)
    },

    setMuted(next: boolean): void {
      muted = next
      if (master && ctx) {
        master.gain.setTargetAtTime(next ? 0 : MASTER_GAIN, ctx.currentTime, 0.05)
      }
    },

    stopAll(): void {
      if (!ctx) return
      rampLoop(clashLoop, ctx, 0)
      rampLoop(cableLoop, ctx, 0)
      rampLoop(windLoop, ctx, 0)
      rampLoop(reelLoop, ctx, 0)
    },

    dispose(): void {
      disposed = true
      stopLoop(clashLoop)
      stopLoop(cableLoop)
      stopLoop(windLoop)
      stopLoop(reelLoop)
      clashLoop = null
      cableLoop = null
      windLoop = null
      reelLoop = null
      reelFilter = null
      void ctx?.close()
      ctx = null
      master = null
      noiseBuffer = null
    },
  }
}

import type { FighterCommand, FighterState, WindSample } from '../types'

/**
 * Input abstraction.
 *
 * The simulation never asks *who* is flying a kite — it asks an `InputSource`
 * for one frame of intent. Today there are two implementations (local device,
 * local AI). The same seam is what online play will plug into: a
 * `NetworkInputSource` that replays commands received from a peer, with the
 * local player's commands sent out. Because the simulation is a fixed-step,
 * seeded, deterministic function of its command stream, that swap is sufficient
 * for lockstep netcode — see `network.ts` and TODO.md → "Online play".
 */
export interface InputContext {
  /** The fighter this source is driving. */
  self: FighterState
  /** The other fighter, as visible on screen. AI gets nothing extra. */
  opponent: FighterState
  wind: WindSample
  /** Seconds since the flying phase began. */
  elapsed: number
  /** Fixed simulation step, seconds. */
  dt: number
}

export interface InputSource {
  /** Stable identifier, used in logs and replays. */
  readonly kind: 'local' | 'ai' | 'network'
  /** Intent for this simulation step. Must be pure with respect to rendering. */
  sample(context: InputContext): FighterCommand
  /** Release any listeners. Always called when a match is torn down. */
  dispose?(): void
}

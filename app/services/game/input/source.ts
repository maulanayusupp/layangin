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
  /**
   * The fighter treated as "them": the nearest one still in the match. In a duel
   * that is simply the other one. AI gets nothing extra.
   */
  opponent: FighterState
  /**
   * Everyone else in the air, nearest first, excluding this fighter. A duel has one
   * entry; a free-for-all has two or three, which is what lets an AI pick which of
   * them to go after rather than being told.
   */
  others: readonly FighterState[]
  wind: WindSample
  /**
   * True while the two flying lines are crossed. A fighter on the field can see
   * and feel this plainly, so the AI is given it too — withholding it would be a
   * handicap of the wrong kind.
   */
  contact: boolean
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

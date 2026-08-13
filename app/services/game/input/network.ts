import { NEUTRAL_COMMAND, type FighterCommand } from '../types'
import type { InputContext, InputSource } from './source'

/**
 * Placeholder for online play. **Not wired into any UI yet** — it exists so the
 * simulation seam is real rather than hypothetical, and so the shape of the
 * netcode is decided before it is needed.
 *
 * ## Why lockstep is viable here
 * The simulation is already a deterministic function of `(seed, command stream)`:
 * a fixed 120 Hz step, a seeded PRNG for every random draw, and no reads of wall
 * clock or `Math.random()` inside the step. Two clients fed the same commands
 * therefore produce bit-identical states.
 *
 * ## What still has to be built
 * - A transport (WebRTC data channel via a signalling server, or a WebSocket
 *   relay) and a lobby to pair players.
 * - Input delay of 2–4 steps so a remote command always arrives before the step
 *   that consumes it, with local prediction to hide it.
 * - A desync guard: hash the fighter states every N steps and compare.
 * - Server-side validation of match results before they can grant coins, since
 *   right now progression is entirely client-side and trusts the local save.
 *
 * See TODO.md → "Online play (PVP)" for the sequenced plan.
 */
export interface CommandFrame {
  /** Simulation step index this command applies to. */
  step: number
  command: FighterCommand
}

export interface NetworkInputOptions {
  /** Steps of input delay. Commands are consumed this many steps after arrival. */
  inputDelay: number
  /** Called when a frame for the current step has not arrived. */
  onStall?: (step: number) => void
}

export interface NetworkInputSource extends InputSource {
  /** Feed a command received from the remote peer. */
  enqueue(frame: CommandFrame): void
  /** Steps currently buffered — the UI can show this as connection health. */
  readonly buffered: number
}

export function createNetworkInput(options: NetworkInputOptions): NetworkInputSource {
  const queue = new Map<number, FighterCommand>()
  let step = 0
  let lastKnown: FighterCommand = { ...NEUTRAL_COMMAND }

  return {
    kind: 'network',

    get buffered(): number {
      return queue.size
    },

    enqueue(frame: CommandFrame): void {
      queue.set(frame.step, frame.command)
    },

    sample(_context: InputContext): FighterCommand {
      const target = step - options.inputDelay
      step += 1

      const incoming = queue.get(target)
      if (incoming) {
        queue.delete(target)
        lastKnown = incoming
        return incoming
      }

      options.onStall?.(target)
      // Repeat the last known command rather than snapping to neutral: a dropped
      // packet should look like a brief hesitation, not a released spool.
      return lastKnown
    },
  }
}

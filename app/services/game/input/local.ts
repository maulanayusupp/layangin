import { applyDeadzone, clamp } from '../math/scalar'
import type { FighterCommand } from '../types'
import type { InputSource } from './source'

/**
 * Mutable control state written by the UI (keyboard handlers, touch joystick)
 * and read by the simulation. Deliberately a plain object rather than a Vue ref:
 * the simulation runs outside Vue's reactivity and must not trigger re-renders
 * 120 times a second.
 */
export interface ControlState {
  /** −1 upwind … +1 downwind. */
  walk: number
  /** −1 pay out … +1 haul in. */
  reel: number
  snap: boolean
}

export function createControlState(): ControlState {
  return { walk: 0, reel: 0, snap: false }
}

/**
 * Reads a `ControlState`. Snap is consumed on read (edge-triggered) so holding
 * the button does not fire a yank every single step.
 */
export function createLocalInput(controls: ControlState): InputSource {
  const command: FighterCommand = { reel: 0, walk: 0, snap: false }

  return {
    kind: 'local',
    sample(): FighterCommand {
      command.walk = clamp(applyDeadzone(controls.walk), -1, 1)
      command.reel = clamp(applyDeadzone(controls.reel), -1, 1)
      command.snap = controls.snap
      controls.snap = false
      return command
    },
  }
}

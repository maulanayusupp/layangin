import type { ControlState } from '~/services/game/input/local'

/**
 * Keyboard bindings for the arena, plus a live description of what is held so
 * the on-screen control hints can highlight themselves.
 *
 * Only keys that cannot be confused with browser navigation are used, and
 * `preventDefault` is limited to the arrow keys and space — otherwise the page
 * would swallow shortcuts the player still needs (reload, devtools, tab).
 */
export interface ControlFlags {
  haul: boolean
  release: boolean
  left: boolean
  right: boolean
  snap: boolean
}

const HAUL_KEYS = new Set(['ArrowUp', 'KeyW'])
const RELEASE_KEYS = new Set(['ArrowDown', 'KeyS'])
const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA'])
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD'])
const SNAP_KEYS = new Set(['Space', 'KeyJ'])
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
])

export function useMatchControls(controls: ControlState, enabled: Ref<boolean>) {
  const flags = ref<ControlFlags>({
    haul: false,
    release: false,
    left: false,
    right: false,
    snap: false,
  })

  const held = new Set<string>()

  const apply = (): void => {
    const haul = [...HAUL_KEYS].some(key => held.has(key))
    const release = [...RELEASE_KEYS].some(key => held.has(key))
    const left = [...LEFT_KEYS].some(key => held.has(key))
    const right = [...RIGHT_KEYS].some(key => held.has(key))

    // Opposing keys cancel rather than the later one winning: less surprising
    // when a player rolls their fingers across the keys.
    controls.reel = (haul ? 1 : 0) - (release ? 1 : 0)
    controls.walk = (right ? 1 : 0) - (left ? 1 : 0)

    flags.value = { haul, release, left, right, snap: flags.value.snap }
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!enabled.value) return
    // Never hijack a shortcut the player is deliberately using.
    if (event.metaKey || event.ctrlKey || event.altKey) return

    if (SCROLL_KEYS.has(event.code)) event.preventDefault()

    if (SNAP_KEYS.has(event.code)) {
      if (!event.repeat) {
        controls.snap = true
        flags.value = { ...flags.value, snap: true }
        // Visual flash only; the simulation consumes the intent immediately.
        setTimeout(() => {
          flags.value = { ...flags.value, snap: false }
        }, 160)
      }
      return
    }

    held.add(event.code)
    apply()
  }

  const onKeyUp = (event: KeyboardEvent): void => {
    held.delete(event.code)
    apply()
  }

  /** Releasing focus must not leave the spool locked in a haul. */
  const releaseAll = (): void => {
    held.clear()
    controls.reel = 0
    controls.walk = 0
    flags.value = { haul: false, release: false, left: false, right: false, snap: false }
  }

  if (import.meta.client) {
    useEventListener(window, 'keydown', onKeyDown)
    useEventListener(window, 'keyup', onKeyUp)
    useEventListener(window, 'blur', releaseAll)
  }

  watch(enabled, (value) => {
    if (!value) releaseAll()
  })

  return { flags, releaseAll }
}

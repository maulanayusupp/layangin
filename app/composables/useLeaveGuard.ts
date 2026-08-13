/**
 * Guards against leaving something in progress by accident.
 *
 * Two exits have to be covered, and they work differently:
 *
 * - **In-app navigation** (a header link, the back button) is cancellable, so it is
 *   intercepted and routed through a confirmation the caller renders.
 * - **Leaving the page entirely** (closing the tab, a hard reload) cannot show a
 *   custom dialog — browsers deliberately only allow their own generic prompt, and
 *   only when the page has been interacted with. So `beforeunload` is registered
 *   and the browser's wording is accepted.
 *
 * The guard is only armed while `active` is true, so it never nags on a page where
 * nothing would be lost.
 */
export interface LeaveGuard {
  /** True while the confirmation should be shown. */
  pending: Ref<boolean>
  /** Proceed with the navigation the guard intercepted. */
  confirm: () => void
  /** Stay on the page. */
  cancel: () => void
}

export function useLeaveGuard(active: Ref<boolean> | ComputedRef<boolean>): LeaveGuard {
  const router = useRouter()
  const pending = ref(false)

  /** Where the intercepted navigation was heading, so it can be resumed. */
  let target: string | null = null
  /** Set while we are re-running an already-confirmed navigation. */
  let allowNext = false

  onBeforeRouteLeave((to) => {
    if (!active.value || allowNext) {
      allowNext = false
      return true
    }

    target = to.fullPath
    pending.value = true
    return false
  })

  if (import.meta.client) {
    useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
      if (!active.value) return
      // `preventDefault` is the modern signal; the legacy assignment is still
      // required by some browsers to actually show the prompt.
      event.preventDefault()
      event.returnValue = ''
    })
  }

  function confirm(): void {
    pending.value = false
    allowNext = true

    const destination = target
    target = null

    if (destination) void router.push(destination)
  }

  function cancel(): void {
    pending.value = false
    target = null
  }

  return { pending, confirm, cancel }
}

/**
 * Scrolls a target into view whenever a watched value changes.
 *
 * Wizards, tab bars and filters all replace the content below the control that
 * was just used. On a phone that leaves the reader looking at the bottom of the
 * old panel and having to scroll up by hand to find what they picked. Bringing
 * the new content to the top of the viewport is the expected behaviour.
 *
 * Two details that matter:
 *
 * - The scroll accounts for the sticky header, which would otherwise cover the
 *   heading of whatever was just revealed.
 * - `prefers-reduced-motion` switches the jump from smooth to instant rather than
 *   disabling it. Skipping the scroll entirely would leave the same problem it is
 *   there to fix; it is the *animation* that some people cannot tolerate, not the
 *   change of position.
 */
export interface ScrollToOnChangeOptions {
  /** Extra gap above the target, in pixels, on top of the header offset. */
  offset?: number
  /** Skip the very first change, so mounting does not scroll the page. */
  skipInitial?: boolean
}

export function useScrollToOnChange(
  source: import('vue').WatchSource<unknown>,
  target: Ref<HTMLElement | null>,
  options: ScrollToOnChangeOptions = {},
) {
  const { offset = 12, skipInitial = true } = options
  const reducedMotion = usePreferredReducedMotion()

  /** Height of the sticky header, read from the token that positions it. */
  const headerHeight = (): number => {
    if (typeof window === 'undefined') return 0
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--header-h')
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : 0
  }

  function scrollToTarget(): void {
    const element = target.value
    if (!element || typeof window === 'undefined') return

    const top = element.getBoundingClientRect().top + window.scrollY - headerHeight() - offset

    window.scrollTo({
      top: Math.max(0, top),
      behavior: reducedMotion.value === 'reduce' ? 'auto' : 'smooth',
    })
  }

  watch(source, () => {
    // Wait for the new panel to be in the DOM before measuring where it is.
    nextTick(scrollToTarget)
  }, { flush: 'post' })

  // `skipInitial` is the default; pass false to also scroll on mount.
  if (!skipInitial) onMounted(() => nextTick(scrollToTarget))

  return { scrollToTarget }
}

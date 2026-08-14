/**
 * Copy text, and say so for a moment.
 *
 * Clipboard access can be refused — an insecure origin, a permission prompt the
 * reader dismissed — and there is nothing useful to do about it, so a refusal is
 * reported rather than thrown. Every caller must therefore keep the text visible
 * and selectable as well, so a failed copy is an inconvenience and not a dead end.
 */
export interface CopyToClipboard {
  /** True for a couple of seconds after a successful copy. */
  copied: Ref<boolean>
  /** True for the same window after a refused one. */
  failed: Ref<boolean>
  copy: (text: string) => Promise<void>
}

export function useCopyToClipboard(holdMs = 2200): CopyToClipboard {
  const copied = ref(false)
  const failed = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  const flash = (target: Ref<boolean>): void => {
    copied.value = false
    failed.value = false
    target.value = true

    clearTimeout(timer)
    timer = setTimeout(() => {
      target.value = false
    }, holdMs)
  }

  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      flash(copied)
    }
    catch {
      flash(failed)
    }
  }

  onBeforeUnmount(() => clearTimeout(timer))

  return { copied, failed, copy }
}

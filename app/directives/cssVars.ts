import type { Directive } from 'vue'

/**
 * `v-css-vars` — the project's only sanctioned way to feed a runtime value into
 * a stylesheet.
 *
 * ## Why this exists
 * The house rule is that templates carry no styling: no `style="…"` attributes
 * and no `:style` bindings. But some values genuinely are not knowable at author
 * time — a meter's fill, a rarity tint, a stagger delay. Rather than leaking
 * appearance into the template, the component declares the *value* here and the
 * *rule* stays in its stylesheet:
 *
 * ```vue
 * <div class="meter" v-css-vars="{ fill: ratio }" />
 * ```
 * ```scss
 * .meter::after { transform: scaleX(var(--fill)); }
 * ```
 *
 * A grep for `style="` therefore stays empty, which `pnpm lint:styles` enforces.
 *
 * Keys are written as `--<key>`; numbers are passed through unchanged so `calc()`
 * and `scaleX()` work, and `null`/`undefined` removes the property.
 */
export type CssVarValue = string | number | null | undefined

function applyVars(element: HTMLElement, vars: Record<string, CssVarValue>): void {
  for (const [key, value] of Object.entries(vars)) {
    const property = key.startsWith('--') ? key : `--${key}`

    if (value === null || value === undefined) {
      element.style.removeProperty(property)
      continue
    }

    element.style.setProperty(property, String(value))
  }
}

function clearVars(element: HTMLElement, vars: Record<string, CssVarValue>): void {
  for (const key of Object.keys(vars)) {
    element.style.removeProperty(key.startsWith('--') ? key : `--${key}`)
  }
}

export const vCssVars: Directive<HTMLElement, Record<string, CssVarValue>> = {
  // Runs on the server too, so a token-driven value is correct on first paint
  // instead of flashing after hydration.
  getSSRProps(binding) {
    const vars = binding.value ?? {}
    const style = Object.entries(vars)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => `${key.startsWith('--') ? key : `--${key}`}:${String(value)}`)
      .join(';')

    return style ? { style } : {}
  },

  mounted(element, binding) {
    applyVars(element, binding.value ?? {})
  },

  updated(element, binding) {
    // Remove properties that disappeared between renders.
    const previous = binding.oldValue ?? {}
    const next = binding.value ?? {}
    const dropped = Object.fromEntries(
      Object.keys(previous)
        .filter(key => !(key in next))
        .map(key => [key, null as CssVarValue]),
    )

    clearVars(element, dropped)
    applyVars(element, next)
  },
}

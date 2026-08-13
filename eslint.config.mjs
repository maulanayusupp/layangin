// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

/**
 * ESLint configuration.
 *
 * Extends the generated Nuxt config (which already knows about auto-imports,
 * Vue SFCs and the project's TypeScript setup) and adds the house rules.
 */
export default withNuxt({
  rules: {
    // The whole point of the v-css-vars directive is that appearance never
    // appears in a template. `pnpm lint:styles` catches the `.vue` cases; this
    // keeps the intent visible to anyone reading the config.
    'vue/no-static-inline-styles': ['error', { allowBinding: false }],

    // Components are single-instance-per-file and named by their path.
    'vue/multi-word-component-names': 'off',

    // Ordering rules keep diffs small and templates scannable.
    'vue/attributes-order': ['error', { alphabetical: false }],
    'vue/define-macros-order': ['error', {
      order: ['defineOptions', 'defineProps', 'defineEmits', 'defineSlots'],
    }],

    // The simulation runs hot loops where a `for` with an index is the right
    // tool; the functional-style preference does not apply there.
    'unicorn/no-for-loop': 'off',

    // `console.log` is fine in build scripts, not in shipped code.
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
}).append({
  // Build scripts are Node programs and legitimately log progress.
  files: ['scripts/**/*.mjs'],
  rules: {
    'no-console': 'off',
  },
})

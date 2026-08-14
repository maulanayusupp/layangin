import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Unit test config.
 *
 * These tests cover the pure simulation and economy modules — the parts where a
 * silent sign error or off-by-one changes gameplay without breaking the build.
 * They deliberately do not mount components: no Nuxt environment is needed, so
 * the suite stays fast enough to run on every change.
 *
 * `include` is `tests/**` only. `tools/` holds on-demand harnesses — the replay
 * inspector — which are run explicitly (`pnpm replay`) and must never join the
 * suite, because they exist to print a report rather than to assert anything.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '~~': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})

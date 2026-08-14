import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Config for the on-demand harnesses in `tools/`.
 *
 * Separate from `vitest.config.ts` so they can never join the real suite: a tool
 * exists to print a report, not to assert anything, and one that fails because it
 * was handed no input would be noise on every run.
 *
 * Used by `pnpm replay`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tools/**/*.spec.ts'],
    // A tool's whole output is what it prints, so it must reach the terminal
    // verbatim rather than being swallowed by the reporter.
    disableConsoleIntercept: true,
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '~~': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})

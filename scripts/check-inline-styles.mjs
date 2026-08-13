/**
 * Enforces the project's "no inline styles" rule.
 *
 * Fails the build if any `.vue` file contains a `style="…"` attribute or a
 * `:style` / `v-bind:style` binding. All appearance belongs in a stylesheet;
 * runtime values go through the `v-css-vars` directive, which sets custom
 * properties that the stylesheet then consumes.
 *
 * Run with `pnpm lint:styles`. Part of `pnpm verify`.
 */
import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const searchRoots = ['app', 'server'].map(dir => resolve(root, dir))

/**
 * Patterns that are always a violation.
 *
 * `getSSRProps` in the directive itself legitimately returns a `style` string, so
 * `app/directives/cssVars.ts` is exempt — but that file is `.ts`, not `.vue`, and
 * only `.vue` files are scanned.
 */
const RULES = [
  {
    id: 'style-attribute',
    pattern: /\sstyle\s*=\s*["']/g,
    message: 'Static `style="…"` attribute. Move the rule into the component stylesheet.',
  },
  {
    id: 'style-binding',
    pattern: /\s(?::style|v-bind:style)\s*=/g,
    message: 'Dynamic `:style` binding. Use `v-css-vars` and style from the stylesheet.',
  },
]

async function* walk(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  }
  catch {
    return
  }

  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      yield* walk(full)
    }
    else if (extname(entry.name) === '.vue') {
      yield full
    }
  }
}

const violations = []

for (const searchRoot of searchRoots) {
  for await (const file of walk(searchRoot)) {
    const source = await readFile(file, 'utf8')
    const lines = source.split('\n')

    for (const rule of RULES) {
      lines.forEach((line, index) => {
        rule.pattern.lastIndex = 0
        if (rule.pattern.test(line)) {
          violations.push({
            file: relative(root, file),
            line: index + 1,
            message: rule.message,
            snippet: line.trim(),
          })
        }
      })
    }
  }
}

if (violations.length > 0) {
  console.error(`\n✖ ${violations.length} inline style violation(s):\n`)
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line}`)
    console.error(`    ${violation.message}`)
    console.error(`    → ${violation.snippet}\n`)
  }
  process.exit(1)
}

console.log('✔ No inline styles found.')

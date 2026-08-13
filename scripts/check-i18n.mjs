/**
 * Checks the translation files against each other.
 *
 * The project rule is that every static string lives in `i18n/locales/**` and
 * every locale carries the same key set. This script enforces it, so adding an
 * English string without its Indonesian counterpart fails before it ships.
 *
 * Reports three things:
 *   1. Keys present in the reference locale but missing from another.
 *   2. Keys present in another locale but not in the reference (stale).
 *   3. Interpolation placeholders that differ between locales, e.g. `{name}`
 *      present in one and absent in the other — which would render a broken
 *      sentence at runtime.
 *
 * Run with `pnpm lint:i18n`. Part of `pnpm verify`.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const localesDir = resolve(root, 'i18n/locales')

/** English is the source of truth; every other locale is compared against it. */
const REFERENCE = 'en'

/** Flatten nested JSON into dotted paths, with array indices included. */
function flatten(value, prefix = '', out = new Map()) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out))
    return out
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out)
    }
    return out
  }

  out.set(prefix, value)
  return out
}

/** Extract `{placeholder}` names from a message. */
function placeholders(message) {
  if (typeof message !== 'string') return new Set()
  return new Set([...message.matchAll(/\{(\w+)\}/g)].map(match => match[1]))
}

async function loadLocale(code) {
  const dir = join(localesDir, code)
  const files = (await readdir(dir)).filter(name => name.endsWith('.json')).sort()

  const merged = {}
  for (const file of files) {
    const contents = JSON.parse(await readFile(join(dir, file), 'utf8'))
    Object.assign(merged, contents)
  }

  return flatten(merged)
}

const codes = (await readdir(localesDir, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)

if (!codes.includes(REFERENCE)) {
  console.error(`✖ Reference locale "${REFERENCE}" not found in ${localesDir}`)
  process.exit(1)
}

const reference = await loadLocale(REFERENCE)
const problems = []

for (const code of codes) {
  if (code === REFERENCE) continue

  const target = await loadLocale(code)

  for (const key of reference.keys()) {
    if (!target.has(key)) {
      problems.push(`${code}: missing key "${key}"`)
      continue
    }

    const expected = placeholders(reference.get(key))
    const actual = placeholders(target.get(key))

    for (const name of expected) {
      if (!actual.has(name)) {
        problems.push(`${code}: "${key}" is missing the {${name}} placeholder`)
      }
    }
    for (const name of actual) {
      if (!expected.has(name)) {
        problems.push(`${code}: "${key}" has an unexpected {${name}} placeholder`)
      }
    }
  }

  for (const key of target.keys()) {
    if (!reference.has(key)) {
      problems.push(`${code}: stale key "${key}" (not in ${REFERENCE})`)
    }
  }
}

if (problems.length > 0) {
  console.error(`\n✖ ${problems.length} translation problem(s):\n`)
  for (const problem of problems) console.error(`  ${problem}`)
  console.error('')
  process.exit(1)
}

console.log(
  `✔ Translations consistent across ${codes.length} locales (${reference.size} keys each).`,
)

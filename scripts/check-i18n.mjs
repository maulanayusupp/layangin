/**
 * Checks the translation files against each other.
 *
 * The project rule is that every static string lives in `i18n/locales/**` and
 * every locale carries the same key set. This script enforces it, so adding an
 * English string without its Indonesian counterpart fails before it ships.
 *
 * Reports four things:
 *   1. Keys present in the reference locale but missing from another.
 *   2. Keys present in another locale but not in the reference (stale).
 *   3. Interpolation placeholders that differ between locales, e.g. `{name}`
 *      present in one and absent in the other — which would render a broken
 *      sentence at runtime.
 *   4. Keys the app *asks for* that no locale defines at all.
 *
 * The fourth check exists because the first three cannot catch it: comparing the
 * locales against each other says nothing about a `t('actions.select')` whose key
 * was never written. That shipped, and the symptom is the raw key rendered on the
 * page in place of a word. Both literal calls and template calls are checked —
 * for `t(`opponents.${id}.name`)` the pattern must match at least one real key,
 * which catches a renamed namespace.
 *
 * Run with `pnpm lint:i18n`. Part of `pnpm verify`.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'
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

/** Stands in for an interpolated segment while a template key is analysed. */
const HOLE = '\u00a7'

/** Every .vue/.ts file under a directory, recursively. */
async function sourceFiles(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) await sourceFiles(full, out)
    else if (['.vue', '.ts'].includes(extname(entry.name))) out.push(full)
  }
  return out
}

/**
 * Translation keys the app asks for.
 *
 * Literal calls give an exact key. Template calls give a pattern: the
 * interpolated part becomes a wildcard, because the id it resolves to is only
 * known at runtime. A pattern is satisfied by any one matching key — enough to
 * catch a namespace that was renamed or never written, which is the failure
 * this is here for.
 */
async function usedKeys() {
  const literals = new Map()
  const patterns = new Map()

  const appDir = resolve(root, 'app')
  if (!(await stat(appDir).catch(() => null))) return { literals, patterns }

  for (const file of await sourceFiles(appDir)) {
    const source = await readFile(file, 'utf8')
    const where = relative(root, file)

    // t('a.b.c') and t("a.b.c"), with the leading char guarding against
    // matching the tail of some other identifier ending in `t`.
    for (const match of source.matchAll(/[^\w$]t\(\s*(['"])([\w.-]+)\1/g)) {
      if (!literals.has(match[2])) literals.set(match[2], where)
    }

    // t(`a.${x}.c`) — every interpolation becomes a single-segment wildcard.
    for (const match of source.matchAll(/[^\w$]t\(\s*`([^`]*\$\{[^`]*)`/g)) {
      const raw = match[1]
      // Anything but a dot may appear inside one segment.
      // A sentinel that cannot occur in a key, standing in for the interpolation.
      const expression = raw.replace(/\$\{[^}]*\}/g, HOLE)
      if (!new RegExp(`^[\\w.${HOLE}-]+$`).test(expression)) continue

      const source_ = expression
        .split('.')
        .map(part => part.includes(HOLE) ? '[^.]+' : part.replace(/[.*+?^$()|[\]\\]/g, '\\$&'))
        .join('\\.')

      if (!patterns.has(expression)) patterns.set(expression, { where, regex: new RegExp(`^${source_}$`) })
    }
  }

  return { literals, patterns }
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

// --- 4. Keys the app asks for that nothing defines ------------------------
const { literals, patterns } = await usedKeys()
const referenceKeys = [...reference.keys()]

for (const [key, where] of literals) {
  if (!reference.has(key)) {
    problems.push(`${where}: uses "${key}", which no locale defines`)
  }
}

for (const [shape, { where, regex }] of patterns) {
  if (!referenceKeys.some(key => regex.test(key))) {
    problems.push(
      `${where}: uses \`${shape.replaceAll(HOLE, '${…}')}\`, which matches no key`,
    )
  }
}

if (problems.length > 0) {
  console.error(`\n✖ ${problems.length} translation problem(s):\n`)
  for (const problem of problems) console.error(`  ${problem}`)
  console.error('')
  process.exit(1)
}

console.log(
  `✔ Translations consistent across ${codes.length} locales `
  + `(${reference.size} keys each); `
  + `${literals.size} literal and ${patterns.size} generated key(s) in the app all resolve.`,
)

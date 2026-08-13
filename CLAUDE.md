# CLAUDE.md

Working notes for this repository. Read this before changing anything.

**Layangin** is a browser kite-fighting game: two kites fly downwind, their lines
cross, and each abrades the other until one parts. Nuxt 4 + Vue 3 + TypeScript,
canvas simulation, no backend.

---

## Toolchain

| | |
|---|---|
| Node | **22.14.0** (`.nvmrc`). Run `nvm use` first. |
| Package manager | pnpm 9.15.0 |
| Nuxt | 4.4.8 |

**Node 20 will not work.** Nuxt ≥ 4.4.6 requires Node ^22.12, and Node 20 reached
end of life in April 2026. Upgrading to Nuxt ≥ 4.5 additionally requires Node
≥ 22.19 — see TODO.md.

## Commands

```bash
pnpm dev            # dev server
pnpm build          # production build
pnpm verify         # lint + styles + i18n + typecheck + tests — run before committing
pnpm test           # vitest only
pnpm typecheck      # nuxt typecheck (all four tsconfig projects)
pnpm lint           # eslint
pnpm lint:styles    # fails on any inline style in a .vue file
pnpm lint:i18n      # fails on missing/stale keys or mismatched placeholders
pnpm icons          # regenerate favicons/PWA icons/OG image from brand/*.svg
```

---

## Architecture

```
app/
  assets/styles/     design system — the only place raw colour/size literals live
  components/        <dir><Name>.vue, e.g. game/GameHud.vue → <GameHud>
  composables/       Vue-facing glue (useMatch, useKitePreview, usePageSeo)
  data/              content catalogs: kites, airframes, patterns, palettes,
                     effects, upgrades, opponents, arenas
  directives/        cssVars.ts — the v-css-vars directive
  services/          framework-free domain logic
    audio/           synthesized sound effects (no audio files)
    economy/         rewards, purchase rules
    game/            simulation: math, geometry, physics, render, input, engine
    persistence/     versioned localStorage save + migrations
  stores/            Pinia (player, settings)
  utils/             auto-imported helpers (format, dom)
i18n/locales/<code>/ translation files, one per domain
shared/constants/    values needed by nuxt.config, Nitro and the app alike
server/routes/       robots.txt, sitemap.xml
scripts/             icon generation + the two lint guards
tests/               vitest, pure modules only
```

### The simulation boundary

`app/services/game/**` knows nothing about Vue. The engine mutates one plain
snapshot object at a fixed 120 Hz; `useMatch` copies the handful of scalars the
HUD needs into refs once per animation frame. **Never make the snapshot
reactive** — that pushes thousands of dependency notifications per second and
the render will fight the simulation for the frame budget.

### Rounds and lives

A cut, a crash or a collision costs the fighter **one life** and relaunches the
round; the match resolves when someone reaches 0. Two reasons this matters:

- A single accident — an unlucky gust, one mistimed haul — must never decide a
  duel. The engine used to end a match in two seconds when the AI flew into a
  building; `tests/rounds.spec.ts` now asserts that no arena can resolve a match
  in the first six seconds.
- The line bars refill every round, so **the life pips are the only read of who is
  winning the match**. Keep them prominent in any HUD change.

`endRound` and `startNextRound` in `engine.ts` own the transition. Nothing else
may write `hp`.

### The airframe generator

Fifty hand-drawn silhouettes with fifty hand-typed stat blocks would drift apart,
so 42 of the 50 airframes are generated: `data/airframes.ts` holds outline
*parameters*, `services/game/geometry/` turns them into geometry, and the
aerodynamic stats are **derived from the resulting polygon** — area is the real
polygon area, lift follows the aspect ratio, drag follows how blunt the shape is.

A shape and its numbers therefore cannot disagree. When adding one, add the
parameters only; never hand-write stats. The eight signature airframes in
`kites.ts` stay hand-authored because their outlines carry detail the generator
does not model.

### Audio

`services/audio/sfx.ts` synthesizes every sound from oscillators and one shared
noise buffer — the project ships no audio assets. Two rules:

- The context is created lazily, because browsers refuse one before a user
  gesture. Nothing throws when audio is unavailable; the game is playable silent.
- Continuous contacts (line rasp, cable zing) are **levels** driven every frame,
  not repeated one-shots, or they machine-gun. Events are edge-triggered in
  `useMatch`'s `updateAudio`, which is the single place a cue may fire.
- No information may be conveyed by sound alone — every cue has a visible
  counterpart. This is stated on `/compliance`.

### Flight model — four traps

These were all shipped bugs. `tests/flight.spec.ts` pins every one of them, so if
you change the flight model and that file goes red, read this section first.

1. **Launch taut.** A kite released on a slack line is pushed downwind by drag,
   matches the wind, loses all airspeed and stalls. Launch span must equal line
   length — see `launchState` and `LAUNCH_ELEVATION`.
2. **A luffing sail makes no lift, not reverse lift.** Past 90° angle of attack a
   rigid plate would push back the other way; a kite's sail collapses instead.
   Modelling it as reverse lift made every stall an unrecoverable dive.
3. **Angle of attack falls as the kite climbs** (`90° − trim − elevation`). That is
   what gives a stable equilibrium at ~63°, and why the model cannot fly past the
   zenith. Do not "fix" the sign in `trimmedHeading` — flipping it removes the
   equilibrium and every kite sinks.
4. **Reeling costs elevation, in either direction.** Both hauling and paying out
   drag the kite off its equilibrium arc, so a fighter holding neutral flies the
   steepest line available. The AI's crossing tactics depend on this.

### Why the two lines cross

Two lines cross at altitude `separation / (cot θ_left − cot θ_right)`, and only
when the **shallower** line belongs to the fighter standing further upwind.
Parallel lines never meet however long they are.

So a duel needs an elevation *difference*, and `PLAYER_ANCHOR_X`/`RIVAL_ANCHOR_X`
set how high up the meeting happens. The AI in `input/ai.ts` picks a side based on
whether it is currently the flatter or steeper line, and reels accordingly. Before
that logic existed the lines flew parallel for the whole match and the duel simply
never happened — the player won by default whenever the AI eventually sank.

If you change anchor separation, the trim angle, or the reel model, re-check the
crossing-rate tests in `tests/flight.spec.ts`.

### Determinism (do not break this)

A match is a pure function of `(seed, arena, loadout, command stream)`:

- Every random draw goes through `createRandom(seed)` in `math/random.ts`.
- **Never call `Math.random()` or read the clock inside a simulation step.**
- The step is fixed at `FIXED_TIMESTEP`; `advance()` accumulates real time and
  drains it in whole steps.

This is what makes replays possible and what the planned lockstep netcode
depends on (`input/network.ts`). `tests/engine.spec.ts` asserts it.

---

## Code rules

### Styling

1. **No inline styles.** No `style="…"`, no `:style`. `pnpm lint:styles` fails the
   build on either, and `vue/no-static-inline-styles` catches it in the editor.
2. **Runtime values go through `v-css-vars`.** The template declares the *value*,
   the stylesheet owns the *rule*:
   ```vue
   <div class="meter" v-css-vars="{ fill: ratio }" />
   ```
   ```scss
   .meter::after { scale: var(--fill) 1; }
   ```
3. **Tokens, never literals.** Colour, spacing, radius, motion and z-index all
   come from `assets/styles/base/_tokens.scss` as CSS custom properties. A raw
   hex or px value anywhere else is a bug — except in the two places noted below.
4. **Component styles live in the component.** `<style scoped lang="scss">`. The
   abstracts layer (breakpoints, mixins, `rem()`, `fluid()`) is auto-injected, so
   no `@use` line is needed. Global CSS is only for tokens, reset, typography,
   patterns, animations, a11y, utilities and layout primitives.
5. **Mobile first.** Use `@include mq('md')` (min-width only). `mq-below()` exists
   for the rare mobile-only case.
6. **Two sanctioned exceptions to rule 3**, both because a `<canvas>` cannot read
   CSS custom properties:
   - `services/game/render/palette.ts` — arena chrome colours.
   - `data/palettes.ts` / `data/arenas.ts` — kite and arena colours, which are
     game content rather than site chrome.
   When a token changes, check whether its twin in those files should follow.

### Text and i18n

- **Every user-visible string lives in `i18n/locales/**`.** No literals in
  templates, ever — including `aria-label`, `alt` and `title`.
- English is the reference locale; Indonesian must match it key for key.
  `pnpm lint:i18n` fails on a missing key, a stale key, or a placeholder that
  differs between locales.
- Content ids (`kiteId`, `patternId`, `arenaId`, …) are the i18n key suffixes, so
  adding a catalog entry means adding `*.name` / `*.lore` in **both** locales.
- Format numbers with the helpers in `utils/format.ts` and pass `locale.value` —
  Indonesian uses `.` as the thousands separator.

### Components

- One component per file, named `<Dir><Name>.vue` so the auto-import name is
  predictable (`layout/LayoutHeader.vue` → `<LayoutHeader>`).
- Props typed with `withDefaults(defineProps<…>(), …)`. No untyped props.
- **Never mutate a prop.** The touch pad reports intent through events; `GameArena`
  owns the control buffer.
- Prefer the platform: `<dialog>` for modals, `<details>` for disclosures, real
  `<input type="checkbox">` under a styled switch, real links for navigation.
- When a control replaces the content below it (wizard step, tab, filter), wire
  `useScrollToOnChange` so the reader is not left looking at the old panel.
- Anything reading `localStorage` renders inside `<ClientOnly>`, or the first
  paint shows default values and then flickers.

### Services and data

- Content goes in `data/`, logic in `services/`. A balance change should be a
  `data/` edit.
- `services/` modules are pure and import no Vue. That is what lets `tests/` run
  without a Nuxt environment.
- Persisted data is versioned. Any change to the save shape needs a migration
  step in `services/persistence/migrations.ts`, which must also drop content ids
  the build no longer knows about.

### Accessibility

Non-negotiable, and asserted on the `/compliance` page:

- Keyboard operable throughout, including the whole match.
- Focus indicators never removed; use `@include focus-visible`.
- Canvas content duplicated as text (`GameReadouts`).
- Honour `prefers-reduced-motion`, `prefers-contrast`, `forced-colors`.
- Sizes in `rem` so browser font settings scale the interface.
- Tap targets ≥ 44 px (`@include tap-target`).

---

## Change workflow

Alongside the code change, update whichever of these it touches:

| Changed | Also update |
|---|---|
| Any user-visible string | both locales, then `pnpm lint:i18n` |
| A catalog entry (kite, airframe, pattern, palette, effect, arena, opponent) | `*.name`/`*.lore` in both locales |
| An airframe outline or the derivation formulas | nothing by hand — but check `tests/airframes.spec.ts` still passes, especially the distinct-silhouette test |
| A sound cue | `/compliance` accessibility section: confirm it still has a visible counterpart |
| The flight model, trim, reel model or anchor separation | `tests/flight.spec.ts` — especially the crossing-rate and "never sinks" tests |
| Save shape, storage keys, cookies | `/compliance`, `/legal/privacy`, `/legal/cookies` + the date in `shared/constants/legal.ts` |
| Monetisation, randomised rewards, cosmetic↔gameplay boundary | `/compliance` money + fairness sections |
| Anything a11y-relevant | `/compliance` accessibility section — move the item between "implemented" and "known gaps" honestly |
| AI difficulty mechanism | `/compliance` fairness section |
| A code rule | this file |
| `brand/*.svg` | run `pnpm icons`, commit the output |
| A new feature or a deferred idea | `TODO.md` |

Then run `pnpm verify`.

### Content honesty

The site must not over-claim. `/about` carries an explicit "what is not
simulated" list, and `/compliance` separates what is implemented from known gaps
instead of claiming a standard that has not been audited. Keep both accurate: if
a limitation is fixed, move it; if a new one appears, add it. Never describe a
planned feature as if it ships today — PVP is marked as not implemented in the
FAQ and in `input/network.ts`, and it stays that way until it works.

---

## Commits

Author must be:

```
Maulana Yusup Abdullah <maulanayusupp@gmail.com>
```

Already set locally (`git config user.name` / `user.email`). Do not add
AI/agent co-author trailers to commits in this repository.

Run `pnpm verify` before every commit.

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

`markOut`, `closeRound` and `startNextRound` in `engine.ts` own the transition.
Nothing else may write `hp` or `eliminated`.

The **last** life is different: it goes to a `falling` phase rather than straight to
`resolved`, so the player watches the kite come down before the result appears. The
overlay during that phase is deliberately transparent, and `FALL_TIMEOUT` guarantees
the match cannot hang there if the wind carries the kite sideways instead of down.

### Measure against the gear a player actually has

The single most expensive mistake in this repo's balance work, made twice:
**every duration and win-rate table was measured with the starter kite and no
upgrades, at every tier.** Nobody fights the tier-8 boss like that.

Measured properly — each tier against the loadout a player plausibly reaches it
with — the conclusions inverted. Duels looked 9–27 s and were really 14–45 s. The
abrasion coefficient looked calibrated at 3.5 and was really about half what it
needed to be. A note in this file claimed raising it past 3.5 stopped helping;
that was an artefact of the wrong test subject, and raising it to 7 took the
capped-match rate from 15/48 to 1/48.

So: when measuring anything that scales with gear, build the loadout for the tier.
The harness in `tools/inspect-replay.spec.ts` reads a real player's actual loadout
out of a replay, which is better still.

Match length is dominated by two things and it is worth knowing which one is
biting: how long the lines take to *find* each other (contact rate, measured
22–41%) and how much damage lands once they do. Contact rate turned out **not** to
be the differentiator — tiers 7 and 8 have near-identical contact and durations of
45 s and 14 s, because the gear matchup decides it. Check which before reaching for
a lever.

### Two fighters or four

The engine is written against `snapshot.fighters`, **player always at index 0**. A
duel is the two-element case; a free-for-all adds one or two more. Rules that only
exist because of the crowd:

- **Every pair is tested.** `detectClashes` sweeps all pairs and `applyAbrasion`
  accumulates damage for everyone before applying any of it, so a simultaneous
  double cut stays simultaneous and list order cannot decide a match.
- **Anchors widen, they do not crowd.** `anchorsFor` keeps the 14 m spacing and
  spreads the line (`walkBoundFor` widens with it). Squeezing four into the duel's
  span would drag every crossing down toward the ground — see `ANCHOR_SPACING`.
- **A round ends when the player is cut, or one line is left.** An opponent going
  out does not stop the round: the others fight on, and the cut kite keeps tumbling
  (the `flying` phase drifts dead fighters for exactly this reason). But the player's
  own cut always ends it — a match spent watching two AI flyers finish without you
  is not a game.
- **The AI picks its own target** (`chooseTarget` in `input/ai.ts`), weighted toward
  the human and toward whatever is nearest. This is load-bearing balance, not
  flavour: with purely nearest-target selection, a measured passive player won 6 of 6
  four-way matches against the top tier because the opponents ignored them. The
  weighting is disclosed on the compliance page.

### Teach the two things that decide a match

Measured against real per-tier loadouts, a scripted player that holds neutral
through crossings wins **0 matches in 48**; the same player hauling on contact and
walking to contest the angle wins **29**. Everything else — yank timing, altitude,
stamina management — is worth a fraction of that.

For a long time nothing in the game said so. The HUD reported who was winning the
exchange and never what to do about it, and the only tactical writing was three
hand-written boss briefs. Two things now carry it, and both must keep leading with
those two actions:

- `services/game/briefing.ts` derives a brief for **any** matchup by comparing the
  opponent's stats against the player's *current* loadout. That is what makes it an
  answer to "how do I beat someone stronger than me": buy a tougher line and the
  advice to avoid a grind disappears, because the grind is now winnable. Add a line
  here when adding a stat or an AI trait; never hand-write advice a comparison
  could produce.
- `useMatch`'s `updateCoach` shows one instruction in the arena at the moment it
  applies, and **stops for good** once the player has hauled into five crossings
  (through the ordinary hint-dismissal store, so "show tips again" restores it). It
  ranks below the snag and overload alarms: a line being destroyed is more urgent
  than technique.

### Every AI advantage must pass through a human limit

`/compliance` promises that difficulty comes only from human-shaped limits —
reaction time, precision, discipline, mistake rate — plus gear. That promise is
easy to break by accident, and was: the haul-on-contact response lived in
`sample()` rather than behind the reaction gate, so the most decisive action in a
duel fired one step after the lines touched, for **every** opponent including the
first rung with its nominal 0.95 s reaction. Measured, a scripted player that
hauls, yanks and walks went from 18 wins in 48 to 37 once it was gated.

So when adding any AI behaviour, ask which human limit it passes through. If the
answer is "none", it is a cheat however small it looks. `tests/ai.spec.ts` pins
the contact reflex; extend it rather than adding an ungated reaction.

Note the reflex uses `CONTACT_REACTION_SHARE` (0.5) of the reaction time, because
feeling the other line is quicker than deciding a plan. Also beware the degenerate
case: gating on `contactFor >= 0` is *not* "no delay", it is "always hauling", since
`contactFor` is 0 when the lines are apart. That misreading measured as a passive
player winning 8 of 48.
- **Rewards sum.** `computeReward` takes the whole lineup, and a first-time win
  marks every opponent in it as beaten.

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
  counterpart. This is stated on `/compliance`. Note that the clash glow, the
  friction scrapes and the particles are all behind `reducedEffects`, so the
  counterpart that actually carries the load there is the `game.hud.clashing`
  readout — do not remove it.
- **Contact intensity is a presentation figure, not a force.** `clashIntensity`
  in `physics/combat.ts` feeds the mixer and the renderer, and it is compressed
  with square roots *and* given a floor, because raw `pressure × slip` spans about
  twenty-sevenfold across the ladder. Uncompressed, tier 1 measured a mean of
  0.027 against tier 4's 0.509 — an absolute gain near 0.003, which is why the
  first fight in the game sounded silent. Damage does **not** go through it;
  `applyAbrasion` reads pressure and slip directly, so changing the presentation
  cannot change a result. `tests/combat.spec.ts` pins the range.
- **Calibrate loudness against measured levels.** Both times a sound was reported
  missing it was present in the graph and simply too quiet: the reel peaked at an
  absolute gain of 0.048 and vanished under the wind bed. Measure the values the
  mixer actually receives before retuning anything.

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
5. **Tension must include the haul.** Dragging the kite in at `r` pushes it through
   the air, and the sail resists with `½ρAC_d r²`, carried by the line. Without that
   term hauling *lowered* tension (shorter line → lower kite → weaker wind), which
   inverted the game's central skill: a player who did nothing held the tauter line
   and beat every opponent.

### Calibrate against measurements, not intuition

Tension scales with wind speed squared, so it runs about eleven times higher in the
last fight than the first. Anything calibrated in absolute newtons therefore works
at one tier and not the others — this went wrong three times over:

- abrasion was so slow a first-tier duel could not finish inside the time limit;
- the line-rasp sound sat at roughly a hundredth of audible;
- peak tension read 600 N for a 0.24 kg kite, because the constraint impulse (an
  integrator artefact) was being counted as force.

So `contactPressure` and cable wear both work in **load relative to breaking
tension**, and the abrasion response is deliberately compressed with square roots.
When touching any of it, measure first: instrument the engine headlessly, print
averages over several seeds, and calibrate from the numbers. TODO.md records the
current measured balance table.

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
depends on (`input/network.ts`). `tests/engine.spec.ts` asserts it, and
`tests/replay.spec.ts` asserts it end to end: a recorded command stream replayed
through a fresh engine must reproduce the same outcome, duration and final kite
position. If anything starts reading the clock or `Math.random()` inside a step,
that test is where it shows up.

### Replays

`services/game/replay.ts`. A replay stores **no state** — only the seed, the
setup and a run-length command stream — because the simulation reconstructs
everything else. Three rules:

- **Commands are indexed by how many times the input source has been sampled**,
  not by the engine's step counter. The engine only samples during `flying`, so
  the two differ; a recorder and a player wrapped around the same seam align by
  construction and neither needs to know how phases are scheduled.
- **A playback pays nothing.** `useMatch` skips the reward path when replaying. A
  replay is a shareable string, so granting its coins again would be a coin
  printer anyone could pass around.
- **A recording carries the result it produced.** Playback compares against it and
  reports a mismatch, because a replay whose value is "the same match" must say so
  loudly when the simulation has changed underneath it.

To read one headlessly: `REPLAY='LYG1|…' pnpm replay`.

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
  `pnpm lint:i18n` fails on a missing key, a stale key, a placeholder that
  differs between locales, **or a key the app asks for that nothing defines**.
  That last check exists because the first three cannot catch it: comparing the
  locales against each other says nothing about a `t('actions.select')` whose key
  was never written, and the symptom is the raw dotted key rendered on the page.
  It reads both literal calls and template calls — for `t(\`opponents.${id}.name\`)`
  the pattern must match at least one real key, which catches a renamed namespace.
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
- When a control replaces the content below it (tab, filter), wire
  `useScrollToOnChange` so the reader is not left looking at the old panel. Prefer
  not needing it: see the note on choosing below.
- **A choice should cost one tap and no scrolling.** `GameSetup` is the worked
  example. The play page used to be a three-step wizard, and it was miserable for a
  specific, repeatable reason: the confirm button sat *below* a full page of grid,
  so every choice cost a scroll down to pick and a scroll back up to continue.
  The shape that fixed it:
  - Every choice has a sensible default, so the common path is one button.
  - A long list of options lives in a `<UiModal>` over the page, not inline.
  - The picker **emits on selection and the dialog closes itself**, returning the
    reader exactly where they were. Close on the picker's own `@select` event, not
    on a store watch — re-confirming the option already chosen does not change the
    store, and the dialog would sit there looking broken.
  - The primary action is `position: sticky` at the foot on mobile, static from
    `md` where the screen already fits.
- **A card in a grid is a flex column with `height: 100%`**, and its action row
  carries `margin-block-start: auto`. Under `display: grid` with
  `align-content: start` that auto margin is silently inert, so every card ends
  where its own text ends and a row of them looks ragged — this was wrong in six
  card components at once. Where a row of cards must line up internally too (the
  setup screen's three), give the card explicit `grid-template-rows` so the same
  elements share a baseline across cards.
- **The HUD is furniture over a game; on a phone, strip the furniture.** Below
  `md` the arena is ~340 px tall and the kites fly in it, so bordered panels with
  label rows over percentages covered more than half the field. The mobile HUD is
  two thin strips: a scrim instead of panels, `UiMeter`'s `compact` instead of
  label rows, and the bottom row folded onto one line. Nothing is *removed* —
  every figure is still in `GameReadouts` under the arena and every meter keeps
  its ARIA label and value text.
  - When a label is dropped, check what is left carrying the meaning. Hiding the
    line labels left colour as the only thing separating your line from theirs,
    which fails anyone who cannot separate teal from red — hence the short inline
    tags, placed beside the bar so they cost width rather than height.
- **Size the arena by subtraction, not by a viewport fraction.** On a touch device
  the stage is `max(240px, 100dvh − 330px)`, where 330 px is the header, the match
  bar and the control pad added up. A `min(48dvh, 62vw)` cap was tried and both
  terms fell under the 240 px floor on a 375×667 phone, so the stage came out the
  same height in either orientation and left 100 px of screen unused.
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
| An opponent marked `isBoss` | `game.tactics.items.<id>` in both locales — the hand-written brief inside the derived one. Every claim in it must be read off that opponent's own numbers (airframe steering rate, upgrade levels, wind and gust), not invented |
| A stat that decides an exchange, or an `AiProfile` field | `services/game/briefing.ts` — the pre-match brief is derived from those numbers, so a new lever needs a line there or the advice goes quietly incomplete |
| An airframe outline or the derivation formulas | nothing by hand — but check `tests/airframes.spec.ts` still passes, especially the distinct-silhouette test |
| A sound cue | `/compliance` accessibility section: confirm it still has a visible counterpart |
| The flight model, trim, reel model or anchor separation | `tests/flight.spec.ts` — especially the crossing-rate and "never sinks" tests |
| Save shape, storage keys, cookies | `/compliance`, `/legal/privacy`, `/legal/cookies` + the date in `shared/constants/legal.ts` |
| Monetisation, randomised rewards, cosmetic↔gameplay boundary | `/compliance` money + fairness sections |
| Anything a11y-relevant | `/compliance` accessibility section — move the item between "implemented" and "known gaps" honestly |
| AI difficulty mechanism | `/compliance` fairness section |
| The command stream, input seam or anything a replay stores | `tests/replay.spec.ts`, and bump `REPLAY_VERSION` — old strings must be refused, never misread |
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

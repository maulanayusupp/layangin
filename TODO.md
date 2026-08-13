# TODO

Ordered roughly by value. Anything here is **not implemented** — the site and the
FAQ say so, and they should keep saying so until an item actually ships.

---

## 1. Online play (PVP)

The seam exists: `app/services/game/input/network.ts` is a real
`NetworkInputSource` with an input-delay buffer, and the simulation is already a
deterministic function of `(seed, arena, loadout, command stream)` — asserted by
`tests/engine.spec.ts` and `tests/obstacles.spec.ts`. It is not wired to any UI.

What is left, in order:

- [ ] **Transport.** WebRTC data channel with a small signalling server, or a
      WebSocket relay. A relay is far less work and the latency cost is
      acceptable for a 90-second duel.
- [ ] **Lobby.** Room codes are enough; no accounts, so no matchmaking rating.
- [ ] **Lockstep loop.** Exchange commands with 2–4 steps of input delay, predict
      locally, and stall rather than desync when a frame is missing.
- [ ] **Desync guard.** Hash both fighter states every N steps and compare. Log
      the seed and step index on mismatch — that pair reproduces the divergence.
- [ ] **Server-side result validation.** Progression is client-side today and
      trusts the local save. Coins from an online match must not be grantable by
      editing `localStorage`.
- [ ] **Privacy consequences.** Online play means an IP address reaches a server
      the project controls. `/legal/privacy` and `/compliance` must be updated
      **before** the feature ships, not after.
- [ ] Reconnect / forfeit handling, and an "opponent left" outcome.

## 2. Arena work

- [ ] More arenas. The data shape supports it with no renderer change; each needs
      a sky, ridges, obstacles, props and both locales.
- [ ] Moving obstacles — a tram along the viaduct deck, a flock crossing the
      field. Needs an update hook on `ArenaObstacle`, which does not exist yet.
- [ ] Obstacles that block a *line* without cutting it: a tree the line drapes
      over, changing the geometry rather than the integrity.
- [ ] Arena-specific opponent pairings, so a boss picks its own home field.
- [ ] Rain / night variants of existing arenas — cheap to add, changes the read
      of the sky considerably.

## 3. Kites and cosmetics

- [x] Fifty airframes. Eight hand-authored plus 42 generated from outline
      parameters, with stats derived from the polygon.
- [ ] Outline kinds the generator still cannot express: a true multi-cell box, a
      three-dimensional tetrahedral, a two-line steerable with two bridle points.
- [ ] A second bridle point, which is what a steerable kite actually needs — the
      current model holds the sail at one angle to one line.
- [ ] More patterns. The renderer takes a `PatternKind`; new kinds are a switch
      arm in `render/kite.ts` plus a catalog entry.
- [ ] Custom colourways — let a player pick the four paint roles themselves and
      save a few slots.
- [ ] Tail cosmetics as a separate slot from the airframe.

## 4. Game feel

- [x] **Sound.** Done: `services/audio/sfx.ts` synthesizes the line rasp, cable
      zing, cut, crash, collision, yank, round and match cues from oscillators and
      noise — no audio files. Still missing, and worth adding: a wind bed that
      tracks wind speed, and the sawangan's hum when that airframe is equipped.
- [ ] Haptics on mobile for a clash and a cut.
- [ ] Replays. The engine already supports it — record the command stream and the
      seed, then feed it back through a `ReplayInputSource`. Also the cheapest
      possible bug-report format.
- [ ] Practice mode: no opponent, adjustable wind, free flight.
- [ ] Configurable lives (1 for a quick duel, 5 for a long one). `STARTING_HP` is
      a constant today.
- [ ] Slow-motion / extended-time accessibility mode. Listed as a known gap on
      `/compliance`; this is the fix.
- [ ] Launch phase — walk the kite up rather than starting airborne.

## 5. Progression

- [ ] Daily or weekly challenges ("win without yanking", "win on the cabled
      field"). Must stay offline-only and never time-limited in a way that
      punishes not playing.
- [ ] Endless mode with escalating AI, for after the ladder is cleared.
- [ ] Local leaderboard of best streaks.
- [ ] Export/import save as a JSON string, so progress can move between devices
      without a server. Would need a note on `/legal/privacy`.

## 6. Platform

- [ ] **Offline support.** Currently the page must load from the network; the FAQ
      says so. A service worker would make it genuinely playable offline, which
      suits a game with no backend.
- [ ] Install prompt. The manifest and maskable icons are already generated.
- [ ] Screen-orientation hint on phones — the arena reads much better in
      landscape.
- [ ] Nuxt Image for the OG card if more raster assets ever appear. Not needed
      today: every visual except the icons is drawn in code.

## 7. Technical debt and upgrades

- [ ] **Nuxt 4.5+.** Requires Node ≥ 22.19; `.nvmrc` currently pins 22.14.0
      because that is what was installed. Bump both together.
- [ ] TypeScript 7 / ESLint 10 majors are already in use; watch for
      `eslint-plugin-unicorn` and `@nuxt/eslint-config` peer drift.
- [ ] Two upstream peer warnings come from inside Nuxt's own dependency tree
      (`unctx`→`oxc-parser`, `@bomb.sh/tab`→`cac`). Harmless, not ours to fix,
      recheck on upgrade.
- [ ] Component tests. `@nuxt/test-utils` is installed but unused — the suite is
      pure-module only. Worth adding for `UiMeter`, `UiTabs` and `KitePicker`.
- [ ] Visual regression on the canvas: render a fixed seed to a buffer and hash
      it, so a renderer change cannot silently alter the arena.
- [ ] The kite picker renders one canvas per cell. Twenty per page is fine; if the
      page size grows, draw the grid into a single canvas instead.

## 8. Content

- [ ] Have the Indonesian copy read by a fluent kite flyer. The terminology is
      researched but not reviewed, and `/about` invites corrections.
- [ ] A short history page on Indonesian kite traditions, properly sourced —
      currently the cultural material is only a paragraph on `/about`.
- [ ] Third language, if anyone asks. The i18n layer and the parity guard already
      handle it; add a locale directory and a `locales` entry.

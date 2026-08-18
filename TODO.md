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
- [x] **Friction, audible and visible.** Reported missing twice, and both times the
      cause was calibration rather than a missing feature. Measured contact intensity
      before the fix: mean 0.027 at tier 1, 0.509 at tier 4, 0.285 at tier 8 — the
      raw `pressure × slip` product spans 27× across the ladder, so the first fight
      was inaudible while the mid ladder saturated. After the sqrt compression and
      presence floor: 0.386 / 0.658 / 0.524. The rasp is now two bands (body plus a
      sizzle weighted by intensity²), the reel has a low spool body under the line
      hiss and roughly twice the level, and a crossing draws scrape streaks along
      both lines plus glass dust. Duel pace measured identical to the second
      afterwards, which is the check that it stayed presentation-only.
- [ ] The cable zing still runs louder than the duel rasp when a hauling player is
      dragging a line across steel (measured mean 0.90 at tier 8 against 0.52 for
      line-on-line). Arguably correct — steel should alarm — but worth a listen.
- [ ] A player who holds haul for a whole match never makes contact at all in the
      neighbourhood arena (measured: zero line clashes across tiers 1, 4 and 8).
      Hauling shortens the line and keeps the kite on your own side of the field.
      Probably a real tactical hole rather than a bug, but it deserves a look.
- [x] **Setup, rebuilt.** The three-step wizard is gone. It cost a scroll down and
      a scroll back up per choice, because each step was a page of grid with the
      Next button underneath it. Replaced by one screen: three cards showing the
      current kite, field and opponent, each opening a dialog that closes itself on
      selection, with a single Fly button that is sticky on mobile. The default path
      is now one tap and no scrolling at all.
- [ ] The setup screen shows cut power for the kite and a hazard rating for the
      field. Watch whether players want more than that before adding it — the whole
      point of the rebuild was that the old screen showed too much.
- [x] **Boss briefs.** Each boss now carries a tactical read derived from its own
      stat block — its airframe's steering rate against the starter kite's, its
      upgrade levels, the wind and gust it fights in. Shown on the setup screen when
      a boss is selected, and again as a `<details>` on the result screen after
      losing to one.
- [ ] Non-boss opponents have no brief. Deliberate for now — three accurate ones
      beat eight shallow ones — but tiers 3, 5 and 6 are the other places players
      stall, so they may earn one.
- [x] **The chase has an ending.** A runner who reaches a downed kite claims it,
      holds it up, and the kite is gone from the field — instead of a dead kite
      lying in the grass for the rest of the match. Renderer-only.
- [x] **People are readable.** Flyers and chasers are drawn 2.2× and 2× life size
      for the same reason kites are drawn 4.5×: at a 60–90 m frame a 1.7 m person
      is a few pixels. Nothing physical uses the scale.
- [x] **Touch play fits on the screen.** The stage was 78dvh tall with the pad
      underneath it, so reaching the controls meant scrolling mid-duel. On a coarse
      pointer the stage is now capped at 48dvh and the pad sits under it, both
      visible at once, plus a hint to turn the phone sideways.
- [x] **The mobile HUD stopped covering the field.** Measured from a screenshot at
      a 375 px viewport: the top panel was 115 px and the bottom row 80 px over a
      240 px stage — the HUD occupied more of the arena than the arena did. Now two
      thin strips, about 62 px and 36 px, with the panel chrome replaced by a scrim
      and the meters reduced to bars with short inline tags.
- [x] **Portrait now uses the whole screen.** The touch stage was `min(48dvh,
      62vw)` with a 240 px floor; on a 375×667 phone *both* terms fell under the
      floor, so it came out 240 px tall and wasted 100 px. Sized by subtraction it
      is 337 px, and the camera's zoom goes from 3.43 to 4.81 px/m.
- [ ] **Landscape on a phone still does not fit.** Measured on 667×375: header,
      match bar, a 240 px stage and the control pad need 566 px of a 375 px
      viewport, so it scrolls exactly as portrait used to. Shrinking the stage
      further is not the answer — at 240 px the zoom is already 3.43 px/m against
      portrait's 4.81. The fix is to overlay the pad and the yank button on the
      arena's bottom corners rather than stacking them underneath, which is a design
      decision about occluding the ground where the flyers stand.
- [ ] Removed a "turn your phone sideways" hint that shipped in the previous
      round. It was wrong: with the stage floored at 240 px the camera zoom is
      identical in both orientations, and landscape is the one that does not fit.
      Worth re-adding only once the overlay above exists.
- [ ] Haptics on mobile for a clash and a cut.
- [x] **Replays.** Every match records itself: seed, field, loadout, opponents and
      the run-length command stream, encoded as a ~250-byte line the player can copy
      off the result screen. Paste it back on the setup screen to watch it, or run
      `REPLAY='…' pnpm replay` to replay it headlessly and print what happened second
      by second. A playback never pays coins, and a recording carries the result it
      originally produced so a divergence is reported rather than passing silently.
- [ ] Practice mode: no opponent, adjustable wind, free flight.
- [ ] Configurable lives (1 for a quick duel, 5 for a long one). `STARTING_HP` is
      a constant today.
- [x] **Free-for-all.** Done: two or three opponents in one match, chosen in the
      wizard, drafted by tier proximity (`services/game/lineup.ts`). Every pair of
      lines abrades, so opponents cut each other. `MAX_FIGHTERS` is 4 — beyond that
      the sky stops being readable at the arena's zoom level, and the HUD runs out of
      room for pip rows.
- [ ] Team play: two-on-two, with a shared life pool. The engine already handles four
      fighters; what is missing is a `team` field and clash filtering.
- [ ] Slow-motion / extended-time accessibility mode. Listed as a known gap on
      `/compliance`; this is the fix.
- [ ] Launch phase — walk the kite up rather than starting airborne.
- [ ] Kites are drawn ~4.5× larger than life so the airframe and livery are
      readable; collision still uses the true size. A zoom control, or drawing at
      true scale with a picture-in-picture inset, would remove the discrepancy.

### Cables, fixed — and an AI bug found underneath

`kampung`'s run moved from `x −20..30` to `x 46..82`, where the line only reaches it
below roughly 28° of elevation: a kite paid out too far and allowed to sink, which is
what the original comment said the hazard was *for*. `viaduk`'s catenary became
scenery, because its arches are solid across the field and the line must cross 22–28 m
to clear them — no placement can help.

Moving them exposed a real bug in `input/ai.ts`. The hazard floor clamped the spool to
`≤ 0` with a comment claiming paying out was how the kite climbed away. It is not —
reeling costs elevation in either direction — so the AI paid out straight into the
relocated cables. Now neutral. Passive-player win rates, before and after:

```
             before   after
kampung       7/8      3/8
monumen       8/8      2/8
kota          8/8      8/8
```

- [x] **`kota`'s free win is gone**, 8/8 passive to 0/8, and a competent player wins
      6/8. Two fixes, and the order matters. The AI now gets a `windFactor` probe and
      holds neutral in dead air — correct, but on its own it only turned the losses
      into stalemates, because the arena's 52 m towers cast a wake topping out at 56 m
      against the ~51 m a kite flies at. There was no clean air to climb into. At 40 m
      the wake tops out near 44 m and the shadow is the pocket the arena's brief always
      claimed it was.

Arena survey after all of it (passive / competent, wins out of 8):

```
sawah    0 / 8      kota      0 / 6  (all reach the clock)
pantai   0 / 0      monumen   2 / 2  (all reach the clock)
kampung  3 / 8      viaduk    0 / 8
```

- [ ] **`kota` and `monumen` now always reach the clock.** Better than a free win —
      the result still follows lives and line condition, and skill still decides it —
      but a match that never ends in a cut is unsatisfying. Likely the same cause in
      both: with the shadow avoided, both fighters sit in the clean air above it on
      near-parallel lines, so the crossing rate collapses. Worth measuring contact
      rate per arena.
- [ ] **`pantai` beats a competent player 8 times out of 8** against the *first*
      opponent. It is the windiest field, so an un-upgraded line sits high on the load
      meter before anything happens. Arenas unlock on win count rather than on gear, so
      nothing stops a player taking a bare kite there. Either gate it on upgrades or
      soften the multiplier.
- [ ] `kampung` at 3/8 passive and `monumen` at 2/8 competent are still off. The AI
      navigates obstacles by height and now by wind, but not by both at once.

### Cables in kampung and viaduk are permanent, not avoidable — FIXED, see above

Found within minutes of the replay inspector existing, which is the argument for
having built it. A player giving **no input at all** flies with their line on a
cable **100% of the time** in two of the six arenas:

```
sawah     snagged=0%      pantai   snagged=0%
kampung   snagged=100%    kota     snagged=0%
monumen   snagged=0%      viaduk   snagged=100%
```

In a recorded tier-4 match on kampung the line went from full to cut in about six
seconds, twice, with **zero** opponent contact in the entire duel — both lives
went to the cable. Higher tiers are worse because cable wear scales with tension.

This looks like a defect rather than the design. CLAUDE.md describes a cable as
"the arena hazard players have to actively fly around", which means avoidable; a
hazard that is on from the launch attitude and never lets go is a flat tax. It
also breaks the `snagged` HUD warning, which is meaningless when it is permanently
lit.

- [ ] Decide the intent, then move the cable spans in `data/arenas.ts` so the
      default flying arc clears them, or accept it and rewrite the arena's brief to
      say the field is unflyable without deliberate avoidance. Do not just soften
      `CABLE_ABRASION` — that hides the geometry problem instead of fixing it.

### Why it felt impossible: the AI's contact reflex was ungated

Reported as "very hard to beat". Measured with scripted players of increasing
skill against real per-tier loadouts (wins out of 48):

```
                       before  after
passive                  0       0
haul on contact          1       2
+ yank                   5      11
+ walk to contest       18      29
```

Skill was already the dominant factor — 0 to 18 — but the AI had a real cheat.
`input/ai.ts` applied its haul-on-contact override in `sample()`, outside the
reaction gate, so it answered a crossing one simulation step (8 ms) after the lines
touched. Every opponent, including tier 1 whose reaction time is nominally 0.95 s.
That is precisely what `/compliance` promises does not happen.

Gated at half the reaction time (a reflex is quicker than a decision, but not
instant) the ladder now reads: tiers 1–3 winnable with active play, 4–6 a genuine
challenge, 7–8 a wall no script has beaten. A passive player still wins 0 of 48,
which is the property that must not be traded away.

Duel length barely moved: 35.5 s → 34.2 s mean, and capped matches went 1/48 → 0/48.

- [x] **Every boss is beatable — the earlier 0/6 was my measurement, not the game.**
      Those tables gave the player a plausible-looking kite per tier, which at tier 7
      meant a sawangan against the sawangan boss and at tier 8 a naga with `gelasan 4`
      against a boss with 5 — when the ceiling is 6. Re-measured on the right kite:

      ```
      bos-pasar (T4)      8/8 on a naga, even at modest upgrades
      raja-sawangan (T7)  8/8 on a naga
      naga-senja (T8)     0/8 near-max, 5/8 fully maxed (1.5 of 5 lives left)
      ```

      So the final boss demands full investment and the rest demand the right
      airframe. Both are legitimate — the problem was that nothing said so.
- [ ] `naga-senja` at 5/8 fully maxed is the intended wall, but it has only ever been
      beaten by a script with a 0.25 s reaction. Worth a replay from a human before
      calling the top of the ladder tuned.
- [ ] The ladder is still not ordered: measured 6/6/6/2/5/4/0/0 across tiers. The
      dips are gear matchups, not difficulty. The ordering test in the section below
      is still worth writing.
- [x] **The game now teaches the two things that matter.** A derived brief
      (`services/game/briefing.ts`) compares the opponent's stats against the
      player's current loadout and leads with hauling and walking every time; it
      shows on the setup screen for every opponent and again after a loss. In the
      arena, one coaching line appears at the moment a crossing is being lost and
      stops for good after the player has hauled into five of them.
- [x] **The brief now names the kite to fly.** A losing matchup points at a better
      airframe already in the hangar (`betterKiteFor`), and gear parity against a
      sharp opponent is called out as the losing position it measured as — without
      that, a mirror match against the tier-7 boss read as "evenly matched" on a
      fight worth 0 wins in 6.
- [ ] The matchup score behind that recommendation is a heuristic
      (`lineStrength × cutPower`, nudged by steering) rather than a simulated result.
      It picks the naga correctly for the top tiers, but it has not been checked
      against a sweep of every kite against every opponent.
- [ ] Non-boss opponents still have no hand-written flavour brief, only the derived
      one. That is deliberate — three accurate ones beat eight shallow ones — but the
      derived panel now covers the tactical need, so any addition would be for
      character rather than help.
- [ ] The coaching cue is untested by anything but reading it. Component tests would
      catch a cue that fires on every glancing brush or never dismisses; the harness
      for that (`@nuxt/test-utils`) is installed and unused.

### Duration, lengthened again — and what actually controls it

Asked for longer matches than the ~22 s band below. Re-swept with the cap lifted
to 400 s first, so nothing was measured through a ceiling:

```
                mean    band       note
abr 7, 3 hp    22.5s   18–30s      was shipping
abr 7, 4 hp    29.4s   25–36s
abr 7, 5 hp    35.8s   31–42s      ← now shipping
abr 8, 5 hp    33.8s   28–39s
abr 6, 4 hp    36.4s   26–56s      same mean, twice the spread
abr 5, 4 hp    45.2s   26–81s      spread collapses entirely
```

**Lives lengthen a match evenly; lowering abrasion does not.** The last two rows
are the finding: reaching the same mean by slowing the cutting widens the band from
11 s to 55 s, because the contact-starved matchups stall rather than finish. Lives
are the lever for length, abrasion for tightness.

**The cap is not a formality.** Left at 400 s the median duel still finished in
32 s, but the 90th percentile ran to 319 s and the longest to 335 s — tiers 3 and 6
genuinely never resolve for an under-equipped player, and five lives multiplies that
stall fivefold.

**Free-for-all needed its own numbers.** At five lives each, winning a four-way
means fifteen cuts, and 17 of 24 measured matches ended on the clock. Lives now
shrink as the sky fills (`livesFor`: 5 / 4 / 3) and the clock grows
(`timeLimitFor`: 60 / 85 / 110 s). That also fixed the HUD: four fighters at five
pips each overflowed the mobile strip.

- [ ] Free-for-all still reaches the clock in about a quarter of measured matches
      (13/48 three-way, 11/48 four-way, means 55 s and 52 s). Expected to be
      overstated — the harness player never attacks, so it rarely eliminates anyone
      — but worth re-measuring once a human has played some.
- [ ] The guide's lives and clock are now interpolated from the constants rather
      than typed into the copy. They had gone stale once already, and no guard can
      catch a sentence that is merely out of date. Worth doing the same anywhere
      else prose quotes a number.

### Duration, recalibrated against real loadouts

The tables further down were all measured with the starter kite at every tier,
which nobody actually plays. Re-measured with the gear a player plausibly reaches
each tier with, and swept:

```
                    mean   caps/48   band
abrasion 3.5, 2 hp  27.8s   15       14–45s   ← was shipping
abrasion 4.5, 2 hp  22.0s    8       13–33s
abrasion 6,   2 hp  16.3s    1       13–20s
abrasion 7,   3 hp  22.0s    1       18–27s   ← now shipping
```

Seven of the eight tiers now land between 18 and 25 seconds. Two findings paid
for the sweep:

- **The old note in `constants.ts` was wrong.** It claimed raising abrasion past
  3.5 stopped helping. That was measured on an unequipped player; with real gear,
  going to 7 took the capped-match rate from 15/48 to 1/48.
- **Contact rate is not the differentiator.** Measured 22–41% across all tiers,
  and tiers 7 and 8 have near-identical contact with durations of 45 s and 14 s.
  The gear matchup decides it, so reaching for a contact lever would have been
  wasted work.

- [ ] `profile.caution` is close to dead code. Sweeping it from 1.0 to 0 changed
      measured duration by nothing at all across every tier, because `losing` is
      rarely true for long enough to trigger a retreat. Either give it real effect
      or drop it from `AiProfile` — a difficulty knob that does nothing is worse
      than no knob, and it is currently described on `/compliance`.

## 5. Ladder balance — measured, and not right yet

Measured over 6 seeds per opponent on the open field, starter kite, no upgrades,
after the pace recalibration (win rate / match length / seconds of line contact):

```
                 fly steep & hold      haul on contact
T1 bocah-sawah   0/6  22s  c= 6s       1/6  22s  c= 3s
T2 anak-kampung  0/6  27s  c=11s       0/6  25s  c= 5s
T3 juara-lorong  0/6  45s  c= 8s       2/6  45s  c= 5s   ← hits the cap
T4 bos-pasar     0/6  14s  c= 4s       0/6  18s  c= 3s
T5 si-gelasan    0/6  11s  c= 2s       0/6  10s  c= 1s
T6 sultan-angin  0/6  39s  c= 7s       0/6  39s  c= 3s   ← hits the cap
T7 raja-sawangan 0/6  11s  c= 2s       0/6   9s  c= 1s
T8 naga-senja    0/6  10s  c= 1s       0/6   9s  c= 1s
```

Pace is now where it should be: 9–27 s against 120 s (or never) before. What is
left is win rate.

- [ ] **The player loses almost everything in the harness.** Note the caveat: the
      scripted players above never *walk*, and walking is how a human contests the
      side and the crossing angle — the two things the AI actively uses. So these
      numbers are a floor, not a verdict, and the first thing to do is watch a human
      play before tuning further.
- [ ] **Tiers 3 and 6 reach the time cap** because they hold contact down to a few
      seconds. Both fly agile airframes (delta, elang) and reposition constantly.
      The AI should be willing to *stay* in a losing-looking crossing rather than
      always breaking off.
- [ ] **Raising abrasion further will not help.** Swept 2.0 → 3.5 → 5.0: match
      length barely moved below 3.5, because what remains is the time the two lines
      spend finding each other, not the time they spend cutting. Shortening a duel
      further means making contact more reliable, not damage faster.
- [ ] Tried and rejected: launching the two fighters at different elevations so the
      lines cross immediately. It made matches *longer* (22 s → 42 s at tier 1) and
      the flat-launched fighter lost instantly at tier 8, because a flatter line sits
      lower in weaker air. Symmetric launch is worth the manoeuvring seconds.
- [ ] Once win rate is right, add a test asserting the ladder is *ordered* — win
      rate should fall monotonically with tier.

Verified working: nobody sinks unprompted, the AI never flies into the ground, and
crossings do happen (50–90%) for a player who is not hauling.

### Free-for-all, measured

Same harness, passive player, open field, 6 seeds — duel against three-way against
four-way (win rate / mean length / share of steps in line contact):

```
                 1 opponent        2 opponents       3 opponents
T1 bocah-sawah   0/6  21s  45%     0/6  28s  45%     1/6  36s  46%
T2 anak-kampung  0/6  23s  48%     0/6  28s  45%     1/6  30s  54%
T3 juara-lorong  4/6  45s  17%     0/6  30s  44%     0/6  37s  47%
T4 bos-pasar     0/6  14s  51%     0/6  21s  44%     0/6  20s  50%
T5 si-gelasan    0/6  12s  44%     0/6  28s  39%     1/6  28s  40%
T6 sultan-angin  1/6  45s  20%     0/6  22s  41%     0/6  33s  39%
T7 raja-sawangan 0/6  11s  46%     0/6  17s  40%     0/6  16s  46%
T8 naga-senja    0/6  10s  45%     0/6  10s  44%     0/6  10s  55%
```

Notes on what those numbers cost to get:

- **Nearest-target selection was broken.** The first implementation had each AI go
  after whoever was closest. Contact collapsed to 8–31% and a player giving *no
  input at all* won 6/6 four-way matches at tiers 5, 6 and 8 — the opponents cut each
  other and left the human alone. `PLAYER_APPEAL` in `input/ai.ts` is the fix; the
  table above is after it.
- A three- or four-way now runs slightly *longer* than the duel at the same tier
  (more lives in the air), which is the right direction, and only 0–2 of 6 reach the
  time cap against 4–6 before.
- [ ] Tiers 3 and 6 no longer cap in a free-for-all — a third line finds them even
      when they are dodging the player. Worth investigating whether the same trick
      (a second AI that will not let them reposition) can be applied to the duel.
- [ ] The passive-player floor is still ~0/6. Same caveat as the duel table: the
      harness never walks.

## 6. Progression

- [ ] Daily or weekly challenges ("win without yanking", "win on the cabled
      field"). Must stay offline-only and never time-limited in a way that
      punishes not playing.
- [ ] Endless mode with escalating AI, for after the ladder is cleared.
- [ ] Local leaderboard of best streaks.
- [ ] Export/import save as a JSON string, so progress can move between devices
      without a server. Would need a note on `/legal/privacy`.

## 7. Platform

- [ ] **Offline support.** Currently the page must load from the network; the FAQ
      says so. A service worker would make it genuinely playable offline, which
      suits a game with no backend.
- [ ] Install prompt. The manifest and maskable icons are already generated.
- [ ] Screen-orientation hint on phones — the arena reads much better in
      landscape.
- [ ] Nuxt Image for the OG card if more raster assets ever appear. Not needed
      today: every visual except the icons is drawn in code.

## 8. Technical debt and upgrades

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

## 9. Content

- [ ] Have the Indonesian copy read by a fluent kite flyer. The terminology is
      researched but not reviewed, and `/about` invites corrections.
- [ ] A short history page on Indonesian kite traditions, properly sourced —
      currently the cultural material is only a paragraph on `/about`.
- [ ] Third language, if anyone asks. The i18n layer and the parity guard already
      handle it; add a locale directory and a `locales` entry.

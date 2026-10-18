# Roadmap: the redesign, R0 to R9

Companion to `docs/game-design.md` (what the game becomes) and `docs/decisions.md` (why things
are the way they are). This file says **what to build next, in which order, how hard the agent
should think, and what "done" means**. It was rewritten in R0 from the approved plan
(`docs/redesign/11-roadmap.md`, which keeps the reasons); the W-phase roadmap and its results are
in `docs/archive/roadmap-w.md`.

## Where we are (2026-10-18, R2 Feel S4 done)

- **The live game** is W8 on frozen `main` at https://wipeday.patrikliska.dev: season 1 (started
  2026-10-07) sits untouched and nobody plays it now (owner decision 7). It ends quietly at the
  cut-over at the end of R4 The Big Red. Nothing lands on `main` but emergency fixes (D145). Its
  database is copied off the server every night (D143).
- **The redesign** was approved on 2026-10-10 (every owner decision in
  `docs/redesign/README.md` section 3). It is built on the `redesign` branch, which starts at the
  `pre-redesign` tag; everything R0 deleted stays reachable there.
- **R0 Foundations and R1 The run are done** (results below; 2026-10-10 and 2026-10-11): state v2,
  closed-form settle, the slim taps path, simulator v2; then the five eras and targets, the 14
  lines with milestones and hands, the shelf, flotsam, welcome back, the HUD with the crown, sound
  and vibration. Playtest 1 is the owner's (`docs/playtest-1.md`).
- **2026-10-17, the owner's Feel brainstorm** (D181-D190): the owner played R1 and still did not
  like it. The order changed to **R2 Feel**, **R3 Cards**, then R4 The Big Red (the old R2; every
  later phase moved by two, D192). The proposal is `docs/redesign/12-feel.md`; the HUD direction
  is the Saltmarsh Feel Board (private, https://claude.ai/artifact/VarETEGfAs1nf37PcTW9mB), approved;
  the look is chunky pixel art generated with Retro Diffusion, and the first generated island
  scene, the Saltmarsh Scene Mock, was approved on 2026-10-18 (D189, D190; `docs/redesign/art/`).
- **R2 Feel's plan was approved on 2026-10-18** (D191, reordered in D202): eight sessions, the look
  first (the pixel scene S2-S3, the HUD S4, sound S5), the palette from the Scene Mock. **S1 groundwork is done** (results below).
- **R2 Feel S2, the pixel island's first two eras, is done** (2026-10-18; results below): the
  terraced island (D203), the pixel camera (D204), `pnpm art` and the first generated art
  (D205).
- **The owner's reviews (2026-10-18)**: the crafting lines moved inside the house, which opens as
  a room (D206); the ground is painted, never tiled (D208); the terraces gave way to one ground
  with two rows under a ruined skyline, and flotsam to airdrops (D209).
- **R2 Feel S3's art is done** (2026-10-18; results below): Stone to Armored in pixel art, the
  rooms, the back row placed deeper, Armored's wider camp, pixel wear (D214-D216).
- **R2 Feel S3 is done** (2026-10-18; results below): the hero tap (the stockpile, the chips,
  squash on the step grid, the fell's shake; D217) and pixel clouds (D218).
- **R2 Feel S4, the HUD, is done** (2026-10-18; results below): the Feel Board's tokens and
  fonts, the dock, panels as sheets, the shop as cards in a fixed order with the hire on its
  line's card and the Best buy chip, the lamp, the ticker (D219-D223).
- **Next: R2 Feel S5, sound and juice** (`sounds.json5`, the juice checklist on everything so
  far, a credits panel; `docs/credits.md` holds its lines). The owner's playtest after S4 is due.
  Retro Diffusion has about 4.39 USD left.

### R2 Feel S4 results: the HUD
- **Look** (D219): plywood and steel plates, signal orange as the only primary, gold Supplies;
  Big Shoulders Display for numbers and titles, Barlow for text, self-hosted with their OFL.
- **The shop** (D220): cards with the line's own pixel art at its stage, the level badge, the
  hand's portrait, the cycle strip, the rate and the bar to the next milestone; the hire folded
  into its line's card; the Lines tab by rung with the next era's card at its place; the Shelf by
  price; the collapsed drawer a two-card window that follows the crown calmly; the Best buy chip
  only while the crowned card is out of sight. The harness buys three cards in a row and fails
  the shot if any card moves.
- **The dock and sheets** (D221): Island from 0:00, Crew at the first hand with a badge for new
  hands; Crew and Settings as sheets with the dock live under them.
- **The lamp** (D222) in the counter row and on the welcome card; **the ticker** (D223), thirty
  lines that only say what is true.
- **Shots:** 28 new `s4_*` (the `desktop_hero`, `phone_hero` and `phone_drawer_cards` of
  `08-screens.md` 8.3 at day, dusk, night and rain; `desktop_sheet_crew`, `phone_dock_badges`,
  `welcome_back_lamp`, `ticker` at day and some at night; the other weathers of those four are
  S8's); 110 in all, the audit clean. Three review rounds in `docs/ui-review.md`.
- **Checks:** `pnpm check` green; `pnpm sim check` OK (shipped R1, 7.4 s). No rule changed, so the
  N-values read as at S1.

### R2 Feel S3 results: the hero tap and pixel clouds
- **The hero tap** (D217): every tap chips a log, stone, nugget, sulfur lump or hull plate that
  arcs onto a pallet at the target's right foot; nine pieces, then each new one sells the top
  piece for coins; a pile left alone is carted off. A fell lands three pieces and shakes the camera
  a whole art pixel for 60 ms; the squash steps 2, 1, -1 art px. The front row moved a few pixels
  to make room (the target at 166). Chips and pallet: `scripts/art/chips.py`.
- **Pixel clouds** (D218): 18 seeded shapes on the grid, tinted by the hour, more in rain.
- **Checks:** `pnpm check` green; the shots audit passes on `s3_*`. No rule changed, so the
  N-values read as at S1.

### R2 Feel S3 results (the art)
- **Art** (`scripts/art/picks/s3.json`, 6.12 USD): the furnace, tannery and oil press; the Rain
  Catcher, generator, radio mast, Scrapyard and reactor at three stages; Ore, Sulfur and The
  Crashed Plane; the stone hut, the shack and the bunker with their rooms. Every line, target,
  house tier and room now has pixel art; the stand-in drawings remain only as fallbacks.
- **Layout** (D215): the back row 22 px behind the front, clear of the target and the house;
  Armored's camp in a wider view (194 art px) with its own spots, re-placed on the era change.
- **Wear** (D216): cracks, torn plates and the tree's notch on the art grid (`scene/wear.ts`).
- **Icons**: Clean Water, the Rain Catcher, the Scrapyard, The Crashed Plane; the airdrop crate
  under a parachute; no flotsam icon shows waves.
- **Checks:** `pnpm check` green; the shots audit passes on the new `s3_*` shots. No rule changed,
  so the N-values read as at S1.

### R2 Feel S2 results (the pixel island, Twig and Timber)
- **The scene** is pixel art on one grid: `scene/pixel.ts` loads `packages/content/art/scene/`,
  `scene/island.ts` holds the terraced layout, `scene/landscape.ts` the far coast, sea, terraces,
  beach and earth (the old `terrain.ts` is gone). The target, the house, the lines and the hands
  draw their art when it exists and the stand-in drawing when not (the Stone and later eras).
- **The art:** the palette (48, from the Scene Mock), the mock's pine, tiles and props; generated
  in S2: Twig and Timber lines at three stages (low-res, outlined), the Twig tent, the Timber
  cabin, Timber's outcrop, a 12×18 survivor with idle and walk cycles. 4.52 USD.
- **Checks:** `pnpm check` green; the shots audit (one crown, 44 px, the target at least 120 px)
  passes. No rule changed, so the N-values read as at S1.
- **Still open, into S3:** pixel wear on the targets, pixel clouds, the house tiers from Stone,
  the Stone to Armored lines and targets, the stockpile and the chips.

### R2 Feel S1 results (groundwork)
- **Docs:** `CLAUDE.md` 1, 2, 6, 8, 11 and 12, `docs/game-design.md`, this file and
  `08-screens.md` 8.3 rewritten from `12-feel.md`; the plan files keep their numbers under a note
  in `11-roadmap.md` and the redesign README; D191-D200.
- **Phases R0-R9** in code (`PHASES`) and in `pacing.json5`: every later tag moved by two; N19 on
  R3 in its new band (4-6 scrap a day), N30 added (D192).
- **The simulator's time:** the pacing check inside `pnpm test` took 9.4-9.6 s of its 10 s; it
  takes 5.4-5.9 s now, with every verdict of `pnpm sim check --phase R7` identical before and after
  (D193: the effects cache in two layers, per-line memos, finiteness checked once a session).
- **Groundwork:** the state's new fields with defaults (`run.research`, `run.frenzy`,
  `run.gulls`, `meta.badges`, and the counters crits, Frenzies, gulls, units, Workshop levels and
  eras in `meta.stats`); units, eras and crits counted from now; stored bases pick the fields up
  through `normalizeState` (tested). New stats `frenzy_gain` and `frenzy_seconds`; `tap_flat`
  takes `add`. No balance moved: every N-value reads as at R1's end.

### R1 results (acceptance)
- **Pacing** (`pnpm sim check --full`, 365 days × seeds 7, 11, 23; the scenarios on 12 seeds;
  `shipped: "R1"`): **N4** first hand 47-54 s (≤ 120); **N5**, **N6** 20 s at most with nothing
  affordable (≤ 30, ≤ 120); **N7** a purchase at 100% of the casual's day-1 check-ins (R4's 30-day
  reading: 99.6%); **N8** 70.6% tap-driven in minute 0-1 (≥ 50%), 13.9% direct from minute 10
  (5-25%); **N9** the weather-weighted active hour 2.66 / 2.23 / 2.22 at days 14 / 30 / 60, rain
  2.81 / 2.39 / 2.42 (1.5-3, rain a warning: none); **N23** run 1 ends at 5.0e10-2.7e11 made,
  the largest number 8.6e25. Run 1's beats: Timber 0:33, Mara 0:47, the crate at exactly 3:00,
  Sorting Tables 3:59, Stone 5:44, Sheet Metal 40:24-48:14, yield 10 at 42:54-49:04 (D179).
- **N18, N20**: the content check holds the Night Shift to 12-48 h and the API tests the window
  (a full window stops accrual and destroys nothing); flotsam every 4-10 minutes for 13 s and
  Hustle ×1-×2 are domain tests (D180).
- **What S5 changed** (D176-D179): a taps batch covers its last second, so unmanned lines run as
  if manned while tapped (one cycle per batch had run a Beachcomber 60% of the time); the crown's
  rule 4 is the best score and saves for it, purchases are scored over a day the player is away
  half of, and a new line counts as the way to its hand (a crown-follower had never reached Sheet
  Metal); the simulator's buyer is the crown and settles while not tapping (N5 and N6's 152 s was
  that bug); Handcarts at 5e9. Taps and flotsam needed no change.
- **Moved, not yet asserted** (R4 asserts them with the Blast Map): glass ever at day 30 alone,
  HEAD → R1: casual 421 → 424, active 734 → 933, optimal 1,094 → 1,281, idler 756 → 818.
  The active and optimal players' lead over the casual grew (2.2× and 3.0×, against N16's 2 and
  2.5 for R5); R4 tunes it with the tree and `k`.
- **Tests**: every command's idempotency and the 1,000-sequence prediction (client = server)
  unchanged and passing; new: the batch-span cases (D176), the crown's saving and hand rules
  (D177), Hustle's range (N20).
- **Shots**: 55 (2 new: `phone_saving`, `phone_saving_drawer`), the audit clean, two rounds
  (`docs/ui-review.md`, `preview/web/index.html`).
- **Frames and time budgets**: on an idle PC at the session's start, `pnpm web:perf` 60 fps (5th
  percentile 59, at most 4 floaters and 114 particles) and the simulator's test 8.6 s (budget
  10 s): S4's 13 s was the PC's load, not the simulator. At the end, with R1 shipped (N9's
  snapshots and four first-hour seeds switched on), it ran 9.5 s with a game running on the PC;
  neither number was re-taken on an idle PC. R4 adds checks, so its plan should buy time back
  (the effects folds take a third of it).

### R1 S4 results (flotsam and away)

- **Flotsam:** the scene draws the domain's `afloat()` (the state's schedule, so a reload shows
  the same arrival at the same age): a 2.5 s drift from the left edge, a 64 px button, the 13 s
  ring, a sink of 1.2 s still catchable inside the server's 3 s grace; run 1's crate at 3:00
  pays "+2 min of supplies" (`crateMinutes`, a test). A late claim is quiet; a sunk one says so
  once. Its three sounds ship with it (D172).
- **Welcome back:** three cases (window used up, not used up, nobody on shift), from the server
  on load or from the client's own `welcomeBack()` when a hidden tab shows again; no ping while
  it is up; the counter holds the gain until Collect. Domain tests: no card under an hour, the
  gain stops at the window's end and stays, `stoppedAt`, Collect clears it.
- **Odds:** `odds()` prints 49.5 / 44.0 / 6.6% (a test), from Settings and the Multipliers sheet.
- **Weather:** flotsam reviewed in day, night, rain and fog (its glow sits above the night
  tint); the `phone_stone_*` set re-shot unchanged.
- **Shots:** 53 (16 new), the audit clean, no console errors; three review rounds
  (`docs/ui-review.md`, `preview/web/index.html`).

### R1 S3 results (the HUD)

- **The crown:** `crown()` in the domain (02 11.1 rules 2-4 and 7), weighed by the player's own
  pace; over 2,000 seeded states it crowns a purchase in reach or the hint, and the expanded
  drawer crowns the same row (`glance.test.ts`); each expanded tab crowns exactly one row, the
  collapsed drawer none while the hint has the crown (`rows.test.ts`).
- **The Multipliers sheet:** its steps multiply out to the full rate within 1e-9 over 1,000
  seeded states.
- **Shots:** 37 (`preview/web/index.html`), the audit clean (no button under 44 px, the target's
  box at least 120 px, one crown per view); three review rounds (`docs/ui-review.md`).
- **Frames:** `pnpm web:perf` 60 fps (5th percentile 59) at 15 taps a second with the drawer up,
  also with the CPU slowed 4×.

### R1 S2 results (the scene)

- **N27:** the target's tap box (a button over it, D158) is 140-180 × 160-174 CSS px on a 390 px
  phone, the pine's centred at 41% of the height; 209-421 × 235-405 on 1600 × 900. The shots
  audit fails on any button or scene tap area under 44 px and any target box under 120 px.
- **Frames:** `pnpm web:perf`, 30 s at 15 taps a second on a busy Stone run: 60 fps (5th
  percentile 60) with at most 12 floaters and 126 particles on the dev PC's GPU, and 60 fps with
  the CPU slowed 4×.
- **Bundle:** 310 KB of JS gzipped in all (the budget 450 KB).
- **Review:** four rounds over 23 shots (`docs/ui-review.md`, `preview/web/index.html`).

### R0 results (acceptance)

- **Backup:** `deploy/offsite.sh` from `vpsuser`'s crontab at 04:30 into `wipeday-offsite:` (rclone
  `crypt` over the owner's Google Drive, own OAuth client, `drive.file`): `pre/` forever,
  `nightly/` 30 days, copy only. The first run copied 23 files, `wipeday-pre-r0.db` and the
  2026-10-10 nightly among them; the restore drill read both back (integrity ok, 3 players,
  2 bases, 195 and 182 `event_log` rows; `docs/deploy.md`).
- **Branch and docs:** `pre-redesign` and `redesign` on GitHub; the plan in `docs/redesign/`;
  `CLAUDE.md`, `docs/game-design.md` and this roadmap rewritten; D127-D145, then D146-D149 for
  what building R0 decided.
- **Numbers (D130):** the domain and `save()` throw on NaN and Infinity (a corrupt row answers 500
  and stays as it was); content amounts are `finite().nonnegative()`. The formatter prints
  `12.4k`, `1.50Qa`, `999Dc`, `1.23e36` and `0.4/s` (every row of `09` 2.4 is a test).
- **Effects (D135):** one test per op in the fold order, scope, conditions and `per` with `max`;
  monotonicity over 10,000 seeded random sets; a per-stat bound (the Blast Map's ceilings join in
  R4). `legacy.test.ts` and its 12,288 combinations are gone.
- **N24:** path independence worst 4.4e-16 over 10,000 states and 1.1e-14 over 10,000 command
  sequences (the bound 1e-9); the tick oracle, which shares no code with settle, worst 8.2e-12
  over 1,000 states × 48 h (the bound 1e-6).
- **N10, N25:** over 2,000 adversarial sequences the credit reaches exactly, never passes,
  `45 + 15 × elapsed`; an honest tapper is never clamped; hold counts 4 a second; a replayed
  batch is credited once (after its record expired, only from tokens left). No record holds a
  state; slim records expire after 1 hour and write no `event_log` row. An hour at 15 taps a
  second from one tab stores 3,600 slim records (the bound 3,700), credits all 54,000 taps and
  the server's supplies equal the prediction exactly; two tabs at 15 a second each got 930 of
  1,800 taps in 60 s (the bound 945).
- **Clocks (D138):** the demo game clock runs at 1× with +1 h, +6 h and next 08:00; a jump never
  moves the wall clock (a test); `__wipeDay.clocks` exposes `game` and `wall`, and shots pin both.
- **Simulator v2 (D144):** N21 passes (fifth root, `L0` 5e5, Glow 0.25, first nuke 10) and N23
  passes (every number finite every step; the largest 3.5e10 in 90 days, 1.9e11 in 365 days ×
  3 seeds, against 1e150). `pnpm sim 30` plays the five archetypes and both scenarios; the test
  profile runs in 1.4 s inside `pnpm test` (the budget 10 s), `--full` in 18 s. Every other
  assertion is listed with its phase and pending. For information (R1 asserts it): the first hand
  comes at 143 s (active) to 171 s (casual), against N4's 120 s once eras and Grip exist.
- **Visual review:** two rounds on the bare island, the drawer and `/base` (`docs/ui-review.md`);
  `preview/web/index.html`, `preview/discord/index.html`.

## Overview

### The phases

| Phase | Goal | Kind | Sessions | Total | Who plays it |
| --- | --- | --- | --- | --- | --- |
| R0 Foundations | The engine and the rules before content | architecture | 3 | 3 | nobody (a bare island) |
| R1 The run | From the first tap to Sheet Metal | balance, UI | 5 | 8 | the owner, locally |
| R2 Feel | Taps that make things, a HUD that looks great, the Workshop, the pixel scene | architecture, balance, UI, art | 7 | 15 | the owner, locally |
| R3 Cards | Survivors and gear, Supply Drops, the Album, scrap as premium | domain, balance, UI | 4 | 19 | the owner, locally |
| R4 The Big Red | The full loop; **cut-over, friends play** | architecture, UI | 4 | 23 | everyone, live |
| R5 Blast Map wave 2 | Months of goals | balance | 3 | 26 | live |
| R6 Logbook | Collection as power | content, UI | 2 | 28 | live |
| R7 Scrap and the check-in | The slow layer | domain, balance | 3 | 31 | live |
| R8 Friends | The social core | architecture, social | 3 | 34 | live |
| R9 Dares, wave 3, live ops | Depth, the rest of W9, the scrap store | content, ops | 3 | 37 | live |
| Later, gated | The Crossing; creeds; a sea layer | architecture, balance | 3-4 each | | when a trigger fires |

**About 37 sessions of a few hours to R9.** Friends play the full loop from the cut-over at the end
of R4, about session 23. Until then season 1 runs on the old build.

### Dependencies

```
              owner approves the plan (07-what-changes.md)
                               |
  main (live, frozen) ---- R0 Foundations     the off-server backup lands on main first
                               |
                           R1 The run          local only (LocalBackend, local API)
                               |
                           R2 Feel             the HUD, the Workshop, the pixel scene; local only
                               |
                           R3 Cards            survivors, gear, Supply Drops, scrap; local only
                               |
                           R4 The Big Red ===> CUT-OVER: redesign merged into main (73 nodes)
                               |
                     R5 Blast Map wave 2       rings 4-6 (178 nodes); rings 7-9 in data, hidden
                               |
                  +------------+------------+
                  |                         |
           R6 Logbook (+13)       R7 Scrap, check-in (+10)     either order; 201 after both
                  |                         |
                  +------------+------------+
                               |
                          R8 Friends           needs R6's first finds and R7's scrap;
                               |               the group run simulates the late wall
                 owner's late-wall choice
                               |
              R9 Dares, wave 3, live ops       361 nodes visible
                               |
            Later, gated: the Crossing | creeds | a sea layer
```

R5 comes first after the cut-over: by day 7 a casual friend has lit about 62 of wave 1's 73
nodes and an active one runs out (`10-balance.md` 4.7). R6 and R7 fill the slots R5 reserves in
rings 4-6 for their systems (`04-blast-map.md` 1.4: 178, 191, 201 nodes). They may swap if the
first week's check-ins feel empty (188 before 201); R5 stays first, because both fill its rings.

### The common contract (every phase)

1. `pnpm check` passes on the phase's branch.
2. `pnpm sim check` passes every N-assertion switched on so far (canon 15 as amended in
   `10-balance.md` 4.9). `pacing.json5` v2 marks each with the phase that switches it on; a test
   fails if a shipped phase still has one pending. Warn-only assertions (N11 until R9, the
   late-wall checks) print WARN. `pnpm sim check --full` (365 days, three seeds, the group) runs
   before R2, R4, R5 and R9 ship.
3. Visual changes reviewed with `pnpm web:shots` (phone, desktop, `__zoom` crops), two iterations
   at least for new visuals, noted in `docs/ui-review.md`; the list is `08-screens.md`'s `SHOTS`.
4. Decisions logged (topics in 7.2); "Where we are", "R<n> results" and `docs/game-design.md`
   updated.
5. Nothing visible teases a later phase (canon 12.3). When a phase deploys, players past its
   gates get its unlocks at once, with one "New on Saltmarsh" card (`03-the-big-red.md` 12).
6. Stop and report: what was built, decisions, the N-values measured (warnings included),
   `preview/web/index.html`, what the owner supplies next.

## The phases

### R0 Foundations

*Goal:* the engine carries an incremental game, and the rules say so, before any content.

| Kind | Plan mode | Model and effort | Sessions | Lands on |
| --- | --- | --- | --- | --- |
| architecture | yes, full | Opus, high | 3 (1-3) | `main`: the backup only; the rest on `redesign` |

**Build**

- **S1. Backup, branch, docs.**
  - The off-server backup, on `main` (data-loss protection is allowed there): a script in
    `deploy/`, run from the `vpsuser` crontab at 04:30 (after the nightly copy), copies
    `~/wipeday/var/backups/` (the 14 nightly copies and every `wipeday-pre-*.db`) with rclone
    (one binary in `~/bin`, no sudo). Default destination: an rclone `crypt` remote on Google
    Drive, since the database holds session tokens and the VAPID key. It writes
    `var/backups/offsite.json` (`{ok, at, files}`) for R4's `/status`. A manual
    `wipeday-pre-r0.db` goes first.
  - Tag `pre-redesign`, create `redesign`, push both ("Branches and the cut-over").
  - The approved plan into `docs/redesign/` (a README plus the plan files; its
    `09-architecture.md` stays the engineering spec, and CLAUDE.md points to it); the old design
    into `docs/archive/game-design-v1.md`; `CLAUDE.md`, `docs/game-design.md` and
    `docs/roadmap.md` rewritten from the plan (`07-what-changes.md` 5).
  - The decisions from D127 in canon 16's order (`07-what-changes.md` 4.4), with P1's constants
    and the amended N-numbers; canon 4.10's first week and month are replaced by the P1 figures
    (`01-vision.md` 4.6-4.8; errata E26).
- **S2. Delete, then the skeleton.**
  - Delete what canon 11 marks Remove or Park, with their tests (`09-architecture.md` 12): domain
    `den`, `contracts`, `market`, `casino`, `raids`, `signal`, `craft`, `recipes`, `missions`,
    `jobs`, `active` and the rest of its list; the data files canon 13.8 lists; API `den.ts` and
    `season-cli.ts`; web `map/MapView.ts`, the Den, raid, Signal and season views; sim `rtp.ts`,
    the gambler and the raider. `crew.json5` and `resources.json5` are slimmed (the 14 hand ids;
    the currencies and product ids), not deleted, so their locale keys and icons survive.
  - State v2 (`09-architecture.md` 3): `meta` plus the run, with canon 9's reserved `island` and
    `keepOnCrossing`; `lines.json5` with `02-the-run.md`'s formulas; `Amount` with the finite
    guard; the formatter (canon 13.1); the effects evaluator with `04-blast-map.md` 4's
    vocabulary.
  - The demo clocks: the game clock at 1× (today 240× with a speed control,
    `apps/web/src/state/clocks.ts`), with jumps of +1 h, +6 h and to the next day in the drawer;
    a `wall` clock beside it, so shots pin `time` and `wall` as CLAUDE.md 6.4 says.
  - The client shows a bare island with a supplies counter; the bot's `/base` says "Open the game"
    until R4.
- **S3. Settle, taps, simulator.** Closed-form settle with its property tests (13.3); the taps
  transport (13.4: coalescing, the bucket, no dropped predicted taps); outcome-only command
  records for every command (1 h for taps and pings, 7 days for the rest; amends D59); simulator
  v2's lifetime loop with a stub `nuke`, the five archetypes (the idler taps 4 a second only
  while nothing runs by itself) and the first-hour and autoclicker scenarios; `SHOTS` pruned.

**Done when**

- The remote holds the newest nightly copy and `wipeday-pre-r0.db`. A restore drill (copy one back,
  open it read-only, count `players`, `bases`, `event_log`) is in `docs/deploy.md` with its output.
- `pre-redesign` and `redesign` are on GitHub; the decisions from D127 are logged; the plan is in
  `docs/redesign/`; the three docs are rewritten.
- `save()` and the domain throw on `Infinity` and `NaN`; content amounts are
  `z.number().finite().nonnegative()`. Formatter: `12400` → `12.4k`, `1.5e15` → `1.50Qa`,
  `9.99e35` → `999Dc`, `1.23e36` → `1.23e36`, a rate of 0.4 → `0.4/s`.
- Effects: one test per op in the fold order; monotonicity over 10,000 seeded random effect sets; a
  per-stat bound. `legacy.test.ts`'s 12,288 combinations are gone.
- **N24:** path independence within 1e-9 over 10,000 seeded command sequences; the tick oracle
  within 1e-6 over 1,000 states × 48 h (seeded through `rng.ts`, like W6's property tests).
- **N10, N25:** a batch never credits more than `45 + 15 × elapsed` taps; hold counts 4 a second;
  a repeated batch is credited once; no command record holds state; slim records expire after 1 h
  and write no `event_log` row. An hour at 15 taps a second from one tab stores at most 3,700 slim
  records and the server's total equals the prediction; two tabs together never pass the bucket.
- The demo game clock runs at 1×; a jump never moves a real-second timer (rule 6.3.9);
  `__wipeDay.clocks` exposes `wall`.
- **N21** (fifth root, `L0` 5e5, Glow `1 + 0.25√G`) is in data and **N23** runs in the simulator;
  `pnpm sim 30` plays every archetype and scenario; the `test` profile inside `pnpm test` stays
  under 10 s (`10-balance.md` 7.3; errata E4).

**Owner supplies:** approval; the big decision (one run currency or materials, `07`); the
decisions needed to start ("What the owner needs to do"); the backup destination, its authorisation (the owner's
Google login) and the crypt password; the plan files from this session.

**Shots:** `phone_bare_island`, `bare_island`.

### R1 The run

*Goal:* a fresh run plays from the first tap to Sheet Metal and looks great on a phone.

| Kind | Plan mode | Model and effort | Sessions | Lands on |
| --- | --- | --- | --- | --- |
| balance, UI | yes (full for S1, then screenshot rounds) | Opus, high for S1 and S5; medium for S2-S4 (Sonnet is fine for the UI grind) | 5 (4-8) | `redesign`, played locally |

**Build** (content and constants from `02-the-run.md` and `10-balance.md`)

- **S1. Data and domain.** `lines`, `eras`, `targets`, `upgrades`, `milestones`, `flotsam` and
  `island` (weather and the island clock, so rain's flotsam is server-checked); closed-form buy-k
  and buy-max; milestones (roster ones kept for the run once reached); the shelf (Grip, Line Mk
  II/III, island upgrades); eras; tap value, felling, Hustle; hands; unmanned lines with a
  busy-until `readyAt`; the Night Shift and `ping`; welcome back. Commands `taps`, `ping`,
  `buy_line`, `hire_hand`, `buy_upgrade`, `buy_era`, `claim_flotsam`, `collect` in
  `apps/api/src/commandSchema.ts`. The island clock runs at UTC+1 with no daylight saving (errata
  E9). "Night Shift over", on by default and held through quiet hours (22:00-08:00, browser time),
  with a "Quiet hours 22:00-08:00" row in Settings (errata E19).
- **S2. The scene.** The camera reframe; the five targets with fell and regrow art; the 14 lines at
  1, 25 and 100 owned, each drawing its product (amendment A1; the Radio Mast's is `broadcast`);
  hands walking to their lines; pooled `BitmapText` floaters with product badges; procedural
  sounds for tap, buy, milestone and fell; Android vibration.
- **S3. The HUD.** The top bar (counter written outside React; the Multipliers sheet); the drawer
  (crowned row plus two; Lines and Upgrades tabs; the bulk toggle after the 2nd hand); the nav row,
  hidden until its first destination unlocks; signal-orange primary with the contrast fixes
  (`08-screens.md` 6.3); the 44 px fixes; advisor v2 (era before hand, one crown per view); the
  desktop 420 px column.
- **S4. Flotsam and away.** Drift Crate, Fuel Drum and Adrenaline Kit on the seeded schedule; run
  1's crate at 3:00, paying a flat 2 minutes of output, back every 3 minutes until caught (errata
  E1); an Odds sheet in Settings from R1, repeated in the Logbook from R6 (guardrail 9; errata
  E8); the welcome-back card; weather contrast.
- **S5. Balance and polish.** Tune in demo mode and with `pnpm sim` in `10-balance.md` 8.1's
  order (the run economy, then taps and flotsam); extra shot rounds; playtest 1, which also asks
  whether unmanned lines feel right (canon 19's fallback, lines that run while Hustle > 0, stays
  in reserve).

**Done when**

- **N4** first hand by 2 min; **N5** nothing affordable for more than 30 s in run 1's first 10
  online minutes; **N6** at most 120 s online with nothing affordable; **N7** a purchase at each
  of the casual's day-1 check-ins (the 30-day reading starts in R4); **N8** tap-driven income
  (taps plus unmanned lines) at least 50% in run 1's minute 0-1, direct taps 5-25% from minute 10
  outside bursts; **N9** an active hour 1.5-3× an idle online hour at days 14, 30 and 60, asserted
  on the weather-weighted hour, rain hours a warning (errata E13; six
  flotsam seeds; `10-balance.md` section 6's tap budget stands in for the tree); **N18**; **N20**
  flotsam every 4-10 min for 13 s and Hustle ×1-×2 on real seconds; **N23** run 1 reaches yield
  10 at 1e10-1e12 supplies made.
- The first-hour archetype (6 taps a second, 12 seeds) plays `10-balance.md` 4.2's P1 column in
  order, the crate at exactly 3:00 and yield 10 at 40-60 min. After playtest 1 the first minute
  may slow (the Timber era's price) within the N-assertions.
- Unmanned lines follow the busy-until rule (`02-the-run.md` 3: a started cycle pays at its end);
  buying an era never lowers income; a re-caught buff restarts its timer (tests).
- Every command has idempotency tests (same key twice, stale state, replay). Over 1,000 seeded
  sequences the client's prediction equals the server within 1e-9.
- Welcome back after 2 days: one card, one Collect, the window-capped gain; a full window stops
  accrual and destroys nothing.
- The shots harness fails on a visible button under 44 × 44 CSS px at 390 px, a target under 120 px
  (**N27**), or a view with more than one crown (the expanded drawer is a view of its own and
  crowns exactly one row). Thirty seconds at 15 taps a second hold 55 fps on the dev PC with at
  most 12 live floaters (the `__wipeDay` frame counter).

**Owner supplies:** names pass 1; R1 icons; decisions 2 and 15; playtest 1.

**Shots:** `08-screens.md` 8.3's R1 group: the first ten minutes' beats, the expanded drawer, the
Multipliers sheet, buffs, welcome back, `999Dc` and `1.23e36` counters, five weathers, desktop.

### R2 Feel

*Goal:* the game feels like a modern idle game: every tap makes something you can see, a second
system opens at minute two, absence is short enough to bring you back, and the island and the HUD
look great on a desktop and a phone (`12-feel.md` 1).

| Kind | Plan mode | Model and effort | Sessions | Lands on |
| --- | --- | --- | --- | --- |
| architecture, balance, UI, art | yes, full (approved 2026-10-18, D191) | Opus, medium for S2-S5 with many shot rounds; high for S6-S7 | 8 (9-16) | `redesign`, played locally |

**Build** (from `12-feel.md`; decisions D181-D200)

- **S1. Groundwork** (no balance change). The docs rewritten from `12-feel.md`; the phases
  renumbered R0-R9 in code and `pacing.json5` (D192); the simulator's time bought back with
  identical verdicts (D193); the state's new fields and counters; the new effect stats. *Done.*
- **S2. The pixel scene: the grid and the first two eras** (art; D202 moved the look first).
  `pnpm art` (the scripts of `docs/redesign/art/` plus the clean-up: pitch detection,
  nearest-neighbour downsample, palette quantise, background knock-out, a numbered contact
  sheet); the 48-colour palette from the Scene Mock (D191); the integer-zoom camera,
  nearest-neighbour, the sprite loader with today's drawing as fallback; Twig and Timber targets
  with wear, their lines at three stages, the house tiers, two hands with idle and walk cycles;
  bands from the palette gradient.
- **S3. The pixel scene: the rest, and the hero tap** (art, UI). Stone to Armored targets and
  lines, the other hands, flotsam, the stockpile and the chips; every tap chips a sprite onto the
  stockpile, squash and stretch on the step grid, the fell's shake.
- **S4. The HUD** (UI). The Feel Board's tokens and fonts (D187); the dock (D199); panels as
  sheets; the shop as cards in fixed order with the crown in place and the Best buy chip (D186);
  the lamp in the counter plate and on the welcome card; the ticker (30 lines).
- **S5. Sound and juice.** `sounds.json5` with CC0 sources (Kenney) and the procedural voices as
  fallback, every cue through the event bus, sound off until the first tap; the juice checklist
  (`12-feel.md` 3.2) on everything built so far; a credits panel.
- **S6. The Workshop and the 2 h Night Shift** (balance). `research.json5`: tiers 1-4 (20 items,
  one effect each, level `n` of tier `k` at `40 × 20^(k−1) × 1.35^n`) and one `{line}_mk` item per
  line (D194); `buy_research {item, count: 1 | "max"}`; the advisor's gain for every research
  stat in closed form; the shelf keeps Grip, eras and island upgrades. The window at 2 h with a
  24 h ceiling, Spare Wicks +20 min × 6 (D195). Content checks: every research stat has an advisor
  gain; cost cuts at ×0.6 at most; the whole tree under 1e18. The simulator answers `12-feel.md`
  15: what the idler and the casual lose on day 1 at 2 h against 12 h; N4-N7 and the first-hour
  beats retuned, Research open at 2:00. The Workshop tab's tiles and the dock's Workshop place.
- **S7. The active layer** (balance, UI). Frenzy's meter and trip in closed form inside the taps
  batch (D196), its meter under the target and the warm sky; gulls on their seeded grid and
  `claim_gull` (D197), their sprites and tap button; about 60 badges in `achievements.json5`,
  Morale +1% each (D198), the Logbook's badge wall and toast; the crown on lasting rates (D200).
  N8 and N9 switched to their new bands and tuned.
- **S8. The finish.** `pnpm sim check --full`; the juice checklist on S6-S7's features; every R2
  Feel shot in every weather; the report.

**Done when**

- **N4-N7** hold with the Workshop in the run (**N31**): the first hand by 2:00, never more than
  30 s with nothing affordable in the first ten minutes, a purchase at every day-1 check-in.
- **N8** at least 50% of minute 0-1 is tap-driven; from minute 10, outside bursts, direct taps
  are 10-30% of income. **N9** an active hour is 4-6× an idle online hour on the weighted hour
  (rain warns).
- **N18** 100% inside a Night Shift of 2 h rising to 24 h; a full window stops accrual and
  destroys nothing (content check and the API's window test).
- **N23** run 1 still ends in its band; the first nuke's script still lands on day 1 for the
  casual in the simulator's stub (guardrail 1, asserted in R4).
- Domain tests: research costs and "max" in closed form; a Frenzy trip at the first, a middle and
  the last tap of a batch, and the tick oracle across a Frenzy segment; the gull grid never under
  120 s apart, claims once; each badge once, never on a refusal; idempotency for `buy_research`
  and `claim_gull`; settle path independence with the new fields.
- The Feel Board's desktop and phone views reproduced by `pnpm web:shots` within the tokens; the
  shop never reorders (a shot sequence buys three rows and the order stays); one crown per view;
  sound on every event in `sounds.json5`.

**Owner supplies:** the plan's two answers (given, D191); about 25 USD of Retro Diffusion credit
before S5; picks from the contact sheets in S5 and S6; names in each report; playtests after S4
and S7.

**Shots:** `08-screens.md` 8.3's R2 Feel group: `desktop_hero`, `desktop_frenzy`,
`desktop_research`, `desktop_sheet_crew`, `phone_hero`, `phone_drawer_cards`, `phone_research`,
`phone_dock_badges`, `welcome_back_lamp`, `achievement_toast`, `gull_elite`, `ticker`, at day,
dusk, night and rain.

### R3 Cards

*Goal:* the crew become people you collect: survivor and gear cards from Supply Drops, an Album,
and scrap as the premium currency earned in play (`12-feel.md` 7, 8, 9.2).

| Kind | Plan mode | Model and effort | Sessions | Lands on |
| --- | --- | --- | --- | --- |
| domain, balance, UI | yes, full | Opus, high for drops, pity and scrap; medium for the Album | 4 (17-20) | `redesign`, played locally |

**Build** (from `12-feel.md` 7-9; the open questions of its 15 answered first)

- **S1. Cards and drops in the domain.** `cards.json5`: 14 survivors (rarity fixed per survivor,
  stars 1-5 from shards, one trait while hired), about 30 gear cards (one stat, a slot kind),
  sets; Supply Drops of three cards in tiers I-III with printed odds and pity counted per player
  (10 / 40 / 150); duplicates pay shards; shard prices; the drop sources (every 5th fell in run
  1, every 10th after; achievements; the Sealed Locker; scrap). Seeded, printed, tested.
- **S2. Scrap and boosts.** Scrap earned in play (badges, elite gulls, daily quests, and from R4
  the nuke); Overdrive, Double Time and Lucky Tide on real seconds; daily quests (three a day on
  the island's clock, the third pays a drop and 1 scrap). Nothing for real money (D182).
- **S3. The Album and the reveal.** The dock's Album (portraits greyed until owned, stars, gear,
  sets, odds and pity counters, shard balances); the drop's reveal (one flip per tap, rarity
  colour first, "Flip the next" primary); equipping gear; survivor busts and gear art through
  `pnpm art`.
- **S4. Workshop tiers 5-8 and balance.** The late tiers; the simulator's drop and scrap
  accounting; N19 and N30.

**Done when:** **N28** no card is blank, a duplicate pays shards (domain test); **N29** pity as
printed (the seeded drop test); **N30** the casual opens at least one drop a day in days 1-30;
**N19** scrap 4-6 a day for a casual (7-day average from day 2), at least 100 by day 30, nobody
above 8; scrap never traded, gifted, wagered, stolen or sold for Supplies; the odds page is one
tap from every drop.

**Owner supplies:** answers to `12-feel.md` 15; picks for busts and gear art; names (survivor
traits, gear, sets, quests).

**Shots:** the drop's reveal at each rarity, the Album (empty, half, full), a survivor's sheet
with gear, a boost running, the daily quests.

### R4 The Big Red

*Goal:* the full loop works, and friends play it live.

| Kind | Plan mode | Model and effort | Sessions | Lands on |
| --- | --- | --- | --- | --- |
| architecture, UI | yes, full | Opus, high; medium for cinematic rounds | 4 (20-23) | `main`, at the cut-over |

**Build** (from `03`, `04`, `04b`, `06`, `09`)

- **S1. Domain and API.** Glass ever and held, Glow, the gain as a delta of the formula level
  (`03-the-big-red.md` 1); Wipe Days and small blasts (the 10% rule); the crown's rules;
  `nuke(state, now)`; Afterglow from the run's first tap; the agenda; `buy_node` with paths; wave 1
  in `blastmap.json5`: rings 1-3 of all eight sectors (73 nodes), the Logbook and Scrapyard wedges
  built from history, the shelf and run counters; scrap recorded in `meta` (3 for the first Wipe
  Day) with no chip; the new events; the simulator on the real `nuke`.
- **S2. The show.** The Kettle's pad and its locked card, at 5e8 lifetime supplies in run 1 (about
  minute 9-10) and from the start of later runs (errata E2); its later stages (`03-the-big-red.md`
  3.2); the Big Red and its crowned chip; the cover card (Wipe Day or small blast, and what this press unlocks) and the 2 s
  hold with the siren; the cinematic (every phase pinnable; U-Turn, Loop-the-Loop, Sputter and
  Drop, and Fizzle for small blasts; skippable from nuke 2; a fade under reduced motion); the
  postcard (what the next Wipe Day unlocks); the rebuild screen; the crater sign; the boom.
- **S3. The map and the edges.** The overview disk, sector ladder and node sheet (React DOM and
  SVG), path buying, the advisor's pulse; Wipe Day news to the feed and `#wipe-day-idle`; bot card
  v2, its command route taking only `collect`; error reporting and `/status`; admin `grant` (glass
  to held only) and `respec_all` (`docs/redesign/11-roadmap.md` 3); notification switches reset to the new defaults at
  the cut-over.
- **S4. Cut-over.** The rehearsal, the live cut-over (4.3), a 24-hour watch.

**Done when**

- **N1** first nuke at 40-60 min (first-hour archetype, 12 seeds); **N2** at least 25 min on the
  wall clock for every archetype, the autoclicker included; **N3** casual by the day-1 21:00
  check-in on 12 of 12 seeds; **N5, N6** for runs 1-5; **N7** at least 90% of casual check-ins in
  days 1-30 hold a purchase; **N11** at most 65% early (median, warn-only); **N12** ×1.5-2.5
  early; **N13** fails on a seeded flat fixture (five nukes whose product is under ×1.3, nothing
  opening in the next three); **N14** 6-10 nodes at the first nuke, later median at least 2;
  **N20** Afterglow `1 + 2 × 2^(−t/300 s)`; **N21**; **N22** a small blast pays its glass and
  moves no count, news or agenda.
- The crown's three rules (`03-the-big-red.md` 2.2, with "counts and the run is 20 h old"), the
  guided first nuke at yield 10, and a welcome back that never crowns the nuke are tested. The slowing-down
  rule's rate (`03-the-big-red.md` 2.2 rule 3) is re-checked by simulator v2 with the advisor's own definition; if it fires too late for
  active players, it uses the last-hour rate (an R4 tuning item; errata E28).
- The simulator measures the shelf and era price cuts at their caps (×0.25 per shelf kind, ×0.5
  for eras) before R5 starts (errata E25).
- Over 10,000 seeded states `nuke` keeps exactly `meta`, grants exactly the formula's glass and
  keeps `version` rising. A grant adds to glass held only and leaves Glow unchanged. A double press
  makes one nuke; a stale tab re-renders.
- **N26** on the 73 nodes; no ring-1-3 node needs a later system, and only unlock, automation and
  keystone nodes use `feature:<id>` (content checks). For every nuke count from 0 to 60 the agenda
  lists nothing from a later phase; no scrap shows anywhere, though `meta` holds 3 after the first
  Wipe Day. A game-clock jump never advances the cinematic or Afterglow.
- One Wipe Day gives the same item in the feed and the bot (`bot.test.ts` pattern);
  `POST /api/bot/commands` refuses everything but `collect` with `not_on_discord`; card v2 passes
  `boundary.test.ts` (an allowlist, `06-friends.md`'s version; errata E18) and `pnpm preview`.
- A forced error in a command DMs the owner once (one per signature per hour); `/status` shows
  version, uptime, last backup, last off-site copy and errors in 24 h; a copy older than 26 h sends
  a DM. `grant` and `respec_all` are idempotent, logged and owner-only.
- **Rehearsal:** `09-architecture.md`'s runbook runs end to end on a copy of the live database from
  the remote. The wipe keeps exactly what 4.3 step 4 lists; `event_log` ids continue above the
  old maximum; both players land on a fresh island; the gift shows; the bot posts the next item.
- **Live:** all four sites answer 200, both founders have played, and the first live Wipe Day's
  news reached the channel.

**Owner supplies:** names pass 2; R4 icons; playtest 2; the cut-over date, agreed with the friends;
presence at the deploying computer. (Decisions 3, 8 and 18 were made on 2026-10-10.)

**Shots:** `08-screens.md` 8.3's R4 group (the Kettle, the cover card for a Wipe Day and a small
blast, the hold, each cinematic phase, the postcard, the Blast Map, the rebuild, Afterglow);
welcome back with the nuke ready (Collect stays primary); card v2 at phone width.

### R5 Blast Map wave 2

| Kind | Plan mode | Model and effort | Sessions | Lands on |
| --- | --- | --- | --- | --- |
| balance | yes, full | Opus, high | 3 (24-26) | branch `r5` |

**Build:** rings 4-6 from `04b` (178 nodes in all; the slots for R6's and R7's systems stay
reserved) and their keystones; exactly three keystone slots (Wipe Days 10, 20, 40; the third waits
for R9), the loadout on the rebuild screen (`set_loadout`), and a keystone bought into an empty
slot slotted at once; the filter chips; two ladders on desktop; the Wipe Day 10 Night Shift +4 h;
rings 7-9 written into data with a `wave` field, hidden until R9; a tuning pass from the first
week.

**Done when:** **N11** at most 95% mid (warn-only); **N12** ×1.15-1.6 mid; **N13**; **N14**;
**N15** on the full 361-node data: optimal at most 45% lit by day 30, 100% not before day 90, and
the warning "casual at least 45% lit at day 180"; **N16** at days 30 and 90 (active ≤ 2×, optimal
≤ 2.5×, idler ≥ 0.5× casual), asserted in the group of five with Late Tide; solo gaps and the
doubling idler's trough are warnings, and the late idler gaps are asserted for an idler following
the crown (errata E11); **N23** under 1e150 over 180 days; **N26** on everything in data.
With the whole tree the steady tap coefficient stays at most 0.6 at 6 taps a second and Hustle at
most ×2.25, Storm Season's Hustle reward counted inside it (content check; errata E22). Keystones work only when slotted and re-pick free (tests); each has a
simulator row showing at most ×2 for the archetype it targets and a cost elsewhere. Nothing from
rings 7-9 is visible. A change to bought nodes ships with `respec_all` and a decision.

**Owner supplies:** keystone names; the friends' first-week screenshots. **Shots:** the overview at
rings 4-6; the loadout picker; a keystone sheet; the filters; desktop ladders.

### R6 Logbook

| Kind | Plan mode | Model and effort | Sessions | Lands on |
| --- | --- | --- | --- | --- |
| content, UI | short | Opus or Sonnet, medium | 2 (27-28) | `r6` |

**Build:** about 120 pages from `05b`, conditions as domain predicates, found by one pure function
at the end of every command (a taps batch that finds one writes that one `logbook_entry` row); the
taps batch's optional `pokes` (the gull, the Kettle), clamped by the same bucket; Morale in the
fold; the Logbook tab, which repeats the Odds sheet (Settings keeps it; errata E8); secrets with hints from Wipe Day 15; shared
first finds (a World input); the Drowned Drone and the Message in a Bottle; flight variants
collected; the 13 Logbook-sector nodes in rings 4-6; +1 scrap per 25 pages, recorded in `meta`;
pages derivable from records granted at deploy.

**Done when:** a content check gives every page an evaluable condition, a locale key and an icon or
the fallback; about 25% are secrets, each with a hint. Morale = `1 + 0.02 × entries` (test); hints
open at Wipe Day 15 (test); with two players the first finder gets the feed line and the other the
hint, and no feed line names a secret (API test; errata E19); a page found in a taps batch writes exactly one row, and pokes beyond the bucket
are clamped (tests). Over 100,000 seeded draws the flotsam weights land within one point of
`02-the-run.md`'s table (the Sealed Locker's share redistributed until R7). **N12, N16** stay
green.

**Owner supplies:** names pass 3; R6 icons. **Shots:** the tab; a secret with its hint; Morale on the
Multipliers sheet; a first-find line; the drone; the bottle.

### R7 Scrap and the check-in

| Kind | Plan mode | Model and effort | Sessions | Lands on |
| --- | --- | --- | --- | --- |
| domain, balance | yes, full | Opus, medium-high | 3 (29-31) | `r7` |

**Build:** the Magnet, scrap's steady daily source next to R3's (crew ranks are gone:
survivor stars replace them, `12-feel.md` 7.2); Pockets (slot 1 from Wipe Day 2; slots 2 and 3 through `deep_pockets` and
`sewn_lining`; a POCKETS block on the rebuild screen); the Sealed Locker; the Toolbelt (Rush,
Grit, and Flare from the agenda at Wipe Day 15, its kind chosen with `flare_gun`); the Foreman
(client loop; on Collect, Discord's included when `meta.prefs.foreman` is on, a greedy pass that keeps
the crowned purchase's price in reserve; errata E18); Dead Hand, with presets of 25, 50, 100 and
200% of glass ever, or "when crowned" (errata E12); `set_loadout` gains `foreman` and `deadHand`; the Crew panel; the welcome back's new lines;
"Magnet full" (off by default); the 10 ring-4-6 nodes that use these systems.

**Done when:** **N19** re-run with the Magnet in R3's band (a casual 4-6 scrap a day, at least
100 by day 30, nobody above 8; `12-feel.md` 11); **N20** Magnet tests at 19:59, 20:00, 23:00 and
24:00, a miss resetting it. A full Pocket swaps only before the run's first purchase; a pocketed upgrade
survives a nuke and works from the first second. Cooldowns follow the game clock, effects real
seconds; Grit stops at 10. The Foreman sends at most one ordinary command a second; Collect's pass
keeps the reserve and matches on client, server and simulator; settle never changes `owned`; Dead
Hand never fires offline. Agenda gates at Wipe Days 1, 2, 4, 7, 8, 15, 20 and 25 are tested.
**N26** on all 361 nodes in data; **N16** re-run.

**Owner supplies:** decisions 12, 14, 19; names; R7 icons. **Shots:** the Magnet at 20 h, 23 h and
full; Pockets; the Toolbelt ready and cooling; the Foreman toggle; Dead Hand's toast.

### R8 Friends

| Kind | Plan mode | Model and effort | Sessions | Lands on |
| --- | --- | --- | --- | --- |
| architecture, social | yes, full | Opus, high (World, group sim); medium (boards, Discord) | 3 (32-34) | `r8` |

**Build** (from `06-friends.md`): Blowback (counted Wipe Days only; the Drift Crate's formula, with
its 1-minute floor; crates in `meta.blowback` as `[{from, at}]`); Late Tide (`World.lateTide`
carries the median as a number); the Island Count (`World.islandCount` counts Wipe Days only;
errata E18); the Freighter; the boards, with season 1's hall
of fame as "the old world"; the Friends tab; Discord postcards; the `friend_nuked` and
`freighter_tier` notifications (off by default); Visit as the stretch; the group simulation, which
also runs the late wall's options 1 and 2 (`10-balance.md` 5, `05-meta-layers.md`) for the owner's
choice before R9.

**Done when:** in a three-player API test a Wipe Day leaves 3 crates on each other shore and a
small blast none, at most 9 wait, no other base is written, and a claim pays
`max(1 min, min(15% of held, 10 min of output))` (errata E20). Late Tide ×3 is labelled for its
player only, never on boards or any shared surface (errata E19), applies below half the median
glass ever of the other players active in 14 days (with two players, half the other's), and never
carries a player past that median (errata E20). **N16** holds in the group of five with Late Tide
(errata E11); **N17** the late joiner reaches the day-30 casual's glass ever within 12 days,
asserted for two players, five players a warning (errata E16). A Freighter load
costs exactly one hour of the loader's current output, at most 6 a week, tiers at 2/4/6 pay 1
scrap each; **N19** still holds. In the group run the late joiner tops two boards in their first
week. Both late-wall options have 365-day tables in the report.

**Owner supplies:** names; R8 icons; playtest 4 (decides 6 and 13). **Shots:** 1 and 9 crates
waiting; the hull at each tier; the Friends tab; each board; the Late Tide label; Visit; the
postcard in `pnpm preview`.

### R9 Dares, wave 3, live ops

| Kind | Plan mode | Model and effort | Sessions | Lands on |
| --- | --- | --- | --- | --- |
| content, ops | short | Opus, medium; Sonnet, low for the ops session | 3 (35-37) | `r9` |

**Build:** four Dares on the rebuild screen; rings 7-9 shown and keystone slot 3 at Wipe Day 40;
the late-wall option the owner chose (option 1: the outer rings as tuned, the Crossing trigger at
"45% lit and N13 firing"; option 2: the fair calendar-time power source of `05-meta-layers.md`); an
owner-only admin page (players, grant, respec, ban, reload data, status) and Discord `/admin`; the
`event_log` CSV export.

**Done when:** each Dare shows constraint and goal in full, abandoning is free, no reward exceeds
+25% on one stat (content check). **N11** becomes a failing assertion (at most 65% / 95% / 100%,
medians); **N12** ×1.1-1.5 late; **N26** over the 361 visible nodes (187 small, 70 notable, 16
keystone, 36 unlock, 36 automation, 16 completion); **N15** on the shipped tree; every N-assertion
green over 180 days, and the late-wall warnings at what the chosen option promised. The panel and `/admin` refuse anyone but
the owner. The export's row count equals the table's. The simulator and the export report the
Crossing trigger's inputs.

**Owner supplies:** the late-wall choice, before the phase starts; Dare names and badges; a review
of the panel. **Shots:** a Dare picked, in progress and done; the full disk; the admin page.

### Later, gated (3-4 sessions each)

| Phase | Trigger (measured, not felt) |
| --- | --- |
| The Crossing (canon 9) | N13 firing (five consecutive nukes' product under ×1.3, nothing opening in the next three) with at least 45% of the tree lit under the late wall's option 1 (70% otherwise), in the simulator and the export |
| Creeds (at most 3) | Playtest 4 says runs feel samey, and nukes per player fall two weeks running while nodes are still affordable |
| A sea layer | Casual friends ask for a slower overnight clock (playtest 4, decision 6) |

## Branches and the cut-over

### Before the cut-over (R0-R4)

- **Tag** `pre-redesign` on `main` at the start of R0, after the backup script lands, and push it.
  Everything the redesign deletes stays reachable there.
- **Branch** `redesign` from the tag, pushed after every green milestone so either computer can
  continue (`docs/deploy.md`, "Working from two computers").
- **`main` is frozen**: nobody plays season 1 (decision 7), so nothing lands beyond R0's backup,
  except an emergency fix if the live server or the backup breaks (a container that will not
  start, a broken backup). Balance, polish, names and the old bot's looks are not fixes. A fix is committed, deployed and pushed on `main` as today, then merged into
  `redesign` at once (where it touches a deleted file, keep the deletion), with a line in "Where we
  are". Season 1's end needs no commit on `main` (errata E3).
- **One image** serves the API and the web build, so nothing from `redesign` ships early.

### After the cut-over (R5 on)

The old convention returns: `main` is live; each phase gets a branch (`r5`, `r6`, ...), merged with
`--no-ff` and deployed at its end from the computer that holds the deploy key. `redesign` is
deleted when R5 starts.

### The cut-over

The commands, checks and rollback are in `09-architecture.md`'s runbook; the order is canon 10's:

1. An off-server backup, `wipeday-pre-cutover.db`, confirmed in the remote.
2. Tag the live old game `season-1-final` on `main`.
3. `pnpm season end` once, with the bot kept stopped (its season news is live-only, so nothing
   wrong is posted); season 1 ends quietly; the owner's message, with `07-what-changes.md`'s
   text, is optional (errata E3; decision 7). There is no `season announce`.
4. Wipe run state only, with the runbook's recipe, not `docs/deploy.md`'s W7 one: `players`,
   sessions, push subscriptions, `settings` (the VAPID keys, the casino secret, the Discord feed
   cursor), `seasons`, `season_archive`, `hall_of_fame`, `legacy` and `event_log` with its sequence
   all stay.
5. Merge `redesign` into `main` (`--no-ff`), run the deploy checklist, deploy.
6. `grant` each founder the Founder skin and 5 glass, to glass held only.

When and who: only after R4's acceptance and the rehearsal; on a date agreed with the friends a few
days ahead, on a quiet morning; the owner at the deploying computer, the agent running the
runbook. Then a 24-hour watch (log, error DMs, `/status`). Within that day a rollback (restore the
pre-cut-over copy, redeploy `season-1-final`) is clean; after it, fix forward.

## How to run a phase with an agent

### The kickoff prompt

Paste at the start of each session, then add the phase's line:

```
Read CLAUDE.md, docs/roadmap.md, docs/game-design.md and docs/decisions.md from D127, and the
plan files in docs/redesign/ that phase R<n> lists. We are starting phase R<n> on branch
<redesign | r<n>>; merge main into it first if main moved. Work in plan mode first, show me
the plan, then build it milestone by milestone against R<n>'s acceptance criteria. Stay inside
the phase. Balance in data files, strings in locale files, rules in packages/domain. Argue
every number from `pnpm sim` output. Review every visual change with `pnpm web:shots` (phone,
desktop, __zoom crops), at least two iterations for new visuals, and write what was wrong and
what changed into docs/ui-review.md. Commit per milestone, push when green. Finish with a
report: what was built, decisions added, the N-assertions switched on and their measured
values (warnings too), screenshot paths, what I need to supply next.
```

| Phase | Plan files (`docs/redesign/`) | Add |
| --- | --- | --- |
| R0 | 07, 09, 10 | "First the off-server backup on main, then the tag and the branch. Rewrite the docs before deleting code. Demo clock at 1× with jumps, plus the wall clock. No visuals beyond a bare island." |
| R1 | 02, 08, 09, 10 | "Data and domain first, then the scene, then the drawer. Tell me if unmanned lines feel wrong." |
| R2 | 12, 08, 09, 10, `art/README.md` | "Follow the approved plan (roadmap R2 Feel): rules before the HUD, the HUD before the pixel scene. Estimate every art batch before paying for it; I pick takes by number." |
| R3 | 12, 05, 09, 10 | "Odds and pity printed and tested before any drop opens. Nothing for real money." |
| R4 | 03, 04, 04b (rings 1-3), 06, 08, 09 | "This phase ends with the cut-over. Do not deploy until I say so; rehearse the runbook on a copy first." |
| R5 | 04, 04b, 10 | "Write rings 7-9 into data, hidden. A change to bought nodes needs respec_all and a decision." |
| R6 | 05, 05b, 04b | "Transcribe pages into data; hand-write only the secrets' hints." |
| R7 | 05, 04b, 10 | "Nothing buys inside settle; the Foreman and Dead Hand send ordinary commands." |
| R8 | 06, 09, 10 | "Count events, times and ratios, never amounts. Never write to another player's base." |
| R9 | 04b, 05, 09, 10 | "Build the late-wall option I chose. Ops last; keep the admin page small." |

### Effort guide

As before: architecture, settle, money-like state and balance get **high**; UI gets **medium** with
many screenshot rounds; transcription and chores get **low** or a smaller model.

| Phase | Kind | Model | Effort | Plan mode | Sessions |
| --- | --- | --- | --- | --- | --- |
| R0 Foundations | architecture | Opus | high | full | 3 |
| R1 The run | balance + UI | Opus; Sonnet ok for the UI grind | high (S1, S5), medium (S2-S4) | yes | 5 |
| R2 Feel | balance + UI + art | Opus | medium (S2-S5, many shot rounds), high (S1, S6-S7) | full | 8 |
| R3 Cards | domain + balance + UI | Opus | high (drops, pity, scrap), medium (Album) | full | 4 |
| R4 The Big Red | architecture + UI | Opus | high; medium for cinematic rounds | full | 4 |
| R5 Blast Map wave 2 | balance | Opus | high | full | 3 |
| R6 Logbook | content + UI | Opus or Sonnet | medium | short | 2 |
| R7 Scrap, check-in | domain + balance | Opus | medium-high | full | 3 |
| R8 Friends | architecture + social | Opus | high (World, group sim), medium (boards, Discord) | full | 3 |
| R9 Dares, wave 3, ops | content + ops | Opus, then Sonnet | medium; low for ops | short | 3 |
| Later, gated | architecture + balance | Opus | high | full | 3-4 each |

High effort pays where a mistake is expensive to undo: state v2, settle, `nuke`, the cut-over, World
inputs. If a session drifts outside its phase, stop it and restate the acceptance criteria.

### Decisions to log per phase

| Phase | Topics |
| --- | --- |
| R0 | From D127 (R0, S1), with P1's constants, the amended N-numbers and the demo clock |
| R1 | The drawer and crowned row; the product mapping; busy-until crediting; `island.json5`; the odds sheet; procedural sound; the ping; quiet hours |
| R2 | The Workshop's tree and its advisor gains; the window at 2 h; Frenzy's numbers; gulls; badges; the dock; the card shop; the palette and the grid; sound sources |
| R3 | Rarity, stars and shards; drop odds and pity; gear stats and sets; scrap sources and boosts; daily quests; 12-feel 15's open questions |
| R4 | `nuke` as built; Wipe Days and small blasts; the crown; wave 1; Afterglow's constants; scrap in `meta`; bot card v2 and the `collect`-only route; error reporting; grant and respec; season 1's end and the gift |
| R5 | Keystones and loadout; ring 4-6 costs; the hidden wave-3 data |
| R6 | Logbook conditions and detection; `pokes`; Morale; secrets and first finds |
| R7 | Magnet; ranks; Pockets; Toolbelt; Foreman and its reserve; Dead Hand; hand traits |
| R8 | Blowback; Late Tide; the Freighter; boards; notification defaults; Visit |
| R9 | Dares; wave 3; the late-wall option; the admin page and export |

### If time runs short

Cut in this order; each can return later:

1. Visit. 2. Discord postcard images (keep text news). 3. The admin page and `/admin` (keep the CLI
and `/status`). 4. The CSV export. 5. Island Count cosmetics. 6. The Freighter (the Magnet and the
Logbook still meet N19). 7. Dares. 8. Flight variants two and three. 9. Logbook secrets and first
finds (keep pages and Morale). 10. Rush and Flare (keep Grit).

If R4 runs long, these can slip into R5 without blocking the cut-over: flight variants, the
crater's deepening, `respec_all`, Android vibration, and bot card v2 (`/base` then answers "Open
the game" and the feed keeps posting).

**Never cut:** the off-server backup; R0's property tests and the simulator gates; idempotency and
the bucket; welcome back; the advisor; Afterglow; Late Tide (guardrail 3, and small); the
cinematic. Waves 2 and 3 may slip but not be cut (guardrail 6).

## What the owner needs to do

**Before R0**

- [x] Read `01-vision.md` and `07-what-changes.md`; approve or amend (decided 2026-10-10; README
      section 3 and `07` section 10 have every choice).
- [x] The big decision: one run currency, Supplies.
- [x] Decisions to start: 4 seasons [removed as a reset]; 5 the cut list [accepted];
      7 season 1 [runs untouched, ends quietly at the cut-over; the message optional]; 9 prestige
      [fifth root of lifetime, √ Glow]; 10 offline [100% in 12 h, rising to 48 h]; 11 primary
      [signal orange]; 20 notation [suffixes to Dc, then scientific].
- [x] Backup destination [rclone crypt on Google Drive, own Google client `wipeday-backup`]:
      authorised 2026-10-10. Keep the two crypt passwords and the client in a password manager.
- [x] The approved plan files, committed into `docs/redesign/` in R0.
- [ ] Optional: tell the friends the new game comes at the cut-over (early to mid-November) with a
      fresh start, a Founder skin and 5 glass.
- [ ] Optional: notifications on again on every device.

**R0**

- [x] Check the restore drill's row counts in `docs/deploy.md` (confirmed 2026-10-10).

**R1**

- [x] Names pass 1: Supplies; Beachcomber, Ship Breaker, Reactor; Gus, Vera; the five
      targets and fell cries; Hustle; Hold to work; Night Shift; Drift Crate, Fuel Drum, Rally,
      Adrenaline Kit; hands; Grip; the products. Decided so far (D157): "Starter Kit"
      (`packed_crate`) becomes **Go Bag**; "Fish Crates" (`food`) becomes **Tinned Fish**. Everything
      else kept as proposed, and the eras keep the five Rust grades (D164). Decisions 2 [Saltmarsh] and 15 [procedural
      sound] were made on 2026-10-10.
- [x] Icons go to `packages/content/icons/<kind>/<id>.svg`. Safe now: `scrap` first; tier badges;
      tools; the 11 kept line buildings; `tree`, `stone`, `ore`, `sulfur`; `crate`; the 12
      portraits; products reusing ids (`timber`, `roast`, `fibre`, `rope`, `planks`, `charcoal`,
      `ingots`, `leather`, `fuel`, `food`, `plates`).
- [x] Icons, new: `supplies`, `hustle`, `hand`, `night_shift`, `wreck`, `beachcomber`,
      `shipbreaker`, `reactor`, `gus`, `vera`, `fuel_drum`, `adrenaline`, five nav icons, `upgrade`,
      `roster`, `buy_max`, and products `battery`, `broadcast`, `cell`. (Drawn by the agent and
      approved 2026-10-10, with R4's and R6-R7's lists ahead: 115 icons, D150-D151; `pnpm icons`.)
- [ ] Playtest 1 (phone on the LAN, about 45 minutes to Sheet Metal; setup, beats and questions
      in `docs/playtest-1.md`): where were you lost? Do unmanned lines feel right? Does the
      crown's saving read? Is the first minute too rushed? Base or spreadsheet? Is the phone
      warm? Send screenshots.
- [ ] Post three phone screenshots to `#wipe-day-idle`.

**R2 Feel**

- [x] Approve the plan; pick where the pixel scene goes (the middle) and where the palette comes
      from (the Scene Mock) (2026-10-18, D191).
- [ ] During S2: top up Retro Diffusion by about 25 USD (balance about 8 USD covers the first
      era; the whole art pass is estimated at 25-35 USD).
- [ ] S2 and S3: pick the takes by number from the contact sheets in `preview/art/`.
- [ ] Names, to approve or veto in each session's report (Workshop, Supply Drop, Album, Frenzy and
      Spare Wicks are fixed for now, D188); the Workshop's items and the badges' names.
- [ ] Optional: a donation to 0-mem0ry (the look's inspiration; none of its files are used).
- [ ] Playtest on the phone and desktop after S4 and after S8; send screenshots.

**R3 Cards**

- [ ] 12-feel.md 15's open questions (traits while hired; gear slots at once; the nuke's drop by
      glass) before its plan.
- [ ] Survivor busts and gear art picks from the contact sheets.

**R4**

- [ ] Names pass 2: Crater Glass, Glow, the Kettle, the Big Red, Afterglow, the Blast Map, Ground
      Zero, the sectors, the anchor nodes, Wipe Day #N and small blast, the postcard, the crew's
      one-liners, the flight variants. Decisions 3 [toilet-seat lid], 8 [Founder skin plus 5 glass held,
      for every season 1 base] and 18 [no nuke from Discord] were made on 2026-10-10.
- [ ] Icons: `glass`, `glow`, `big_red`, four `kettle` stages, `afterglow`, `ground_zero`, eight
      sector glyphs, five node-type frames.
- [ ] Playtest 2 (local): to the first nuke; hold to launch on the phone; the Blast Map; rebuild; ten
      minutes of run 2. Was it 40-60 minutes? Did the cinematic land?
- [ ] Agree the cut-over date with the friends; be at the deploying computer that morning. Optional:
      post season 1's closing message by hand (`07-what-changes.md` has the text; errata E3).

**After the cut-over**

- [ ] Log in on the phone; use `/base`; send screenshots (bugs, ahead of the next phase).
- [ ] Playtest 3, the first week: when did rings 1-3 run out? Did check-ins feel empty? (Decides
      whether R7 goes before R6.)

**R5 to R9**

- [ ] R5: keystone names.
- [ ] R6: names pass 3 (pages, secrets); icons `morale`, `drowned_drone`, `bottle`.
- [ ] R7: decision 19 [traits: one-line perks, the leaning, or cut] (12 [three skills] and 14 [Dead
      Hand opt-in, online, Wipe Day 25] were made on 2026-10-10); icons `magnet`, `pocket`, `rank`, `foreman`, `dead_hand`, `rush`,
      `grit`, `flare`, `sealed_locker`; the 11 traits only if they stay.
- [ ] R8: icons `blowback`, `island_count`, `freighter`, `pennant`, `late_tide`; playtest 4
      confirms 6 [expeditions parked] and 13 [creeds deferred] (16 [1 scrap per tier, a pennant at
      III] and 17 [Visit as a stretch] were made on 2026-10-10).
- [ ] Before R9: the late wall's final option (`10-balance.md` 5), from R8's simulations [option 1,
      a slow outer tree with the Crossing trigger at 45% lit and N13 firing, is the working plan;
      option 2 is simulated alongside].
- [ ] R9: Dare names and badges; review the admin page.
- [ ] Stop drawing (canon 17): other resources and items, furnace types, the `fibre` node, defences,
      Den, casino, Signal, contract and task art.

Risks and the calendar sketch: `docs/redesign/11-roadmap.md` sections 5 and 7.1. Where the
old plan's items (W9, the to-do list, the polish backlog) went: its section 3.

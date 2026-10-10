# 11. Roadmap: building the redesign

Status: a proposal for the owner, 2026-10-07. It expands `canon.md` section 16 as amended and
never contradicts it. Nothing in the repository changes until the owner approves; R0's first job
is that rewrite. The design is in `01`-`05`, the screens in `08-screens.md`, the engineering in
`09-architecture.md`, the numbers in `10-balance.md` (the P1 constants, and the amended N-numbers
of its 4.9, which every acceptance below uses). This file says what to build, in which order, how
hard the agent should think, and what the owner supplies. Names are canon until the owner's pass
(section 8).

---

## 1. Overview

### 1.1 The phases

| Phase | Goal | Kind | Sessions | Total | Who plays it |
| --- | --- | --- | --- | --- | --- |
| R0 Foundations | The engine and the rules before content | architecture | 3 | 3 | nobody (a bare island) |
| R1 The run | From the first tap to Sheet Metal | balance, UI | 5 | 8 | the owner, locally |
| R2 The Big Red | The full loop; **cut-over, friends play** | architecture, UI | 4 | 12 | everyone, live |
| R3 Blast Map wave 2 | Months of goals | balance | 3 | 15 | live |
| R4 Logbook | Collection as power | content, UI | 2 | 17 | live |
| R5 Scrap and the check-in | The slow layer | domain, balance | 3 | 20 | live |
| R6 Friends | The social core | architecture, social | 3 | 23 | live |
| R7 Dares, wave 3, live ops | Depth and the rest of W9 | content, ops | 3 | 26 | live |
| Later, gated | The Crossing; creeds; a sea layer | architecture, balance | 3-4 each | | when a trigger fires |

**About 26 sessions of a few hours to R7.** Friends play the full loop from the cut-over at the end
of R2, about session 12. Until then season 1 runs on the old build.

### 1.2 Dependencies

```
              owner approves the plan (07-what-changes.md)
                               |
  main (live, frozen) ---- R0 Foundations     the off-server backup lands on main first
                               |
                           R1 The run          local only (LocalBackend, local API)
                               |
                           R2 The Big Red ===> CUT-OVER: redesign merged into main (73 nodes)
                               |
                     R3 Blast Map wave 2       rings 4-6 (178 nodes); rings 7-9 in data, hidden
                               |
                  +------------+------------+
                  |                         |
           R4 Logbook (+13)       R5 Scrap, check-in (+10)     either order; 201 after both
                  |                         |
                  +------------+------------+
                               |
                          R6 Friends           needs R4's first finds and R5's scrap;
                               |               the group run simulates the late wall
                 owner's late-wall choice
                               |
              R7 Dares, wave 3, live ops       361 nodes visible
                               |
            Later, gated: the Crossing | creeds | a sea layer
```

R3 comes first after the cut-over: by day 7 a casual friend has lit about 62 of wave 1's 73
nodes and an active one runs out (`10-balance.md` 4.7). R4 and R5 fill the slots R3 reserves in
rings 4-6 for their systems (`04-blast-map.md` 1.4: 178, 191, 201 nodes). They may swap if the
first week's check-ins feel empty (188 before 201); R3 stays first, because both fill its rings.

### 1.3 The common contract (every phase)

1. `pnpm check` passes on the phase's branch.
2. `pnpm sim check` passes every N-assertion switched on so far (canon 15 as amended in
   `10-balance.md` 4.9). `pacing.json5` v2 marks each with the phase that switches it on; a test
   fails if a shipped phase still has one pending. Warn-only assertions (N11 until R7, the
   late-wall checks) print WARN. `pnpm sim check --full` (365 days, three seeds, the group) runs
   before R2, R3 and R7 ship.
3. Visual changes reviewed with `pnpm web:shots` (phone, desktop, `__zoom` crops), two iterations
   at least for new visuals, noted in `docs/ui-review.md`; the list is `08-screens.md`'s `SHOTS`.
4. Decisions logged (topics in 7.2); "Where we are", "R<n> results" and `docs/game-design.md`
   updated.
5. Nothing visible teases a later phase (canon 12.3). When a phase deploys, players past its
   gates get its unlocks at once, with one "New on Saltmarsh" card (`03-the-big-red.md` 12).
6. Stop and report: what was built, decisions, the N-values measured (warnings included),
   `preview/web/index.html`, what the owner supplies next.

---

## 2. The phases

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
    `var/backups/offsite.json` (`{ok, at, files}`) for R2's `/status`. A manual
    `wipeday-pre-r0.db` goes first.
  - Tag `pre-redesign`, create `redesign`, push both (section 4).
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
    until R2.
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
decisions needed to start (section 8); the backup destination, its authorisation (the owner's
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
  E1); an Odds sheet in Settings from R1, repeated in the Logbook from R4 (guardrail 9; errata
  E8); the welcome-back card; weather contrast.
- **S5. Balance and polish.** Tune in demo mode and with `pnpm sim` in `10-balance.md` 8.1's
  order (the run economy, then taps and flotsam); extra shot rounds; playtest 1, which also asks
  whether unmanned lines feel right (canon 19's fallback, lines that run while Hustle > 0, stays
  in reserve).

**Done when**

- **N4** first hand by 2 min; **N5** nothing affordable for more than 30 s in run 1's first 10
  online minutes; **N6** at most 120 s online with nothing affordable; **N7** a purchase at each
  of the casual's day-1 check-ins (the 30-day reading starts in R2); **N8** tap-driven income
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

### R2 The Big Red

*Goal:* the full loop works, and friends play it live.

| Kind | Plan mode | Model and effort | Sessions | Lands on |
| --- | --- | --- | --- | --- |
| architecture, UI | yes, full | Opus, high; medium for cinematic rounds | 4 (9-12) | `main`, at the cut-over |

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
  to held only) and `respec_all` (section 3); notification switches reset to the new defaults at
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
  active players, it uses the last-hour rate (an R2 tuning item; errata E28).
- The simulator measures the shelf and era price cuts at their caps (×0.25 per shelf kind, ×0.5
  for eras) before R3 starts (errata E25).
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

**Owner supplies:** names pass 2; R2 icons; playtest 2; the cut-over date, agreed with the friends;
presence at the deploying computer. (Decisions 3, 8 and 18 were made on 2026-10-10.)

**Shots:** `08-screens.md` 8.3's R2 group (the Kettle, the cover card for a Wipe Day and a small
blast, the hold, each cinematic phase, the postcard, the Blast Map, the rebuild, Afterglow);
welcome back with the nuke ready (Collect stays primary); card v2 at phone width.

### R3 Blast Map wave 2

| Kind | Plan mode | Model and effort | Sessions | Lands on |
| --- | --- | --- | --- | --- |
| balance | yes, full | Opus, high | 3 (13-15) | branch `r3` |

**Build:** rings 4-6 from `04b` (178 nodes in all; the slots for R4's and R5's systems stay
reserved) and their keystones; exactly three keystone slots (Wipe Days 10, 20, 40; the third waits
for R7), the loadout on the rebuild screen (`set_loadout`), and a keystone bought into an empty
slot slotted at once; the filter chips; two ladders on desktop; the Wipe Day 10 Night Shift +4 h;
rings 7-9 written into data with a `wave` field, hidden until R7; a tuning pass from the first
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

### R4 Logbook

| Kind | Plan mode | Model and effort | Sessions | Lands on |
| --- | --- | --- | --- | --- |
| content, UI | short | Opus or Sonnet, medium | 2 (16-17) | `r4` |

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
`02-the-run.md`'s table (the Sealed Locker's share redistributed until R5). **N12, N16** stay
green.

**Owner supplies:** names pass 3; R4 icons. **Shots:** the tab; a secret with its hint; Morale on the
Multipliers sheet; a first-find line; the drone; the bottle.

### R5 Scrap and the check-in

| Kind | Plan mode | Model and effort | Sessions | Lands on |
| --- | --- | --- | --- | --- |
| domain, balance | yes, full | Opus, medium-high | 3 (18-20) | `r5` |

**Build:** the Magnet; the scrap chip, showing what `meta` has recorded since R2; crew ranks (×2,
rising together); Pockets (slot 1 from Wipe Day 2; slots 2 and 3 through `deep_pockets` and
`sewn_lining`; a POCKETS block on the rebuild screen); the Sealed Locker; the Toolbelt (Rush,
Grit, and Flare from the agenda at Wipe Day 15, its kind chosen with `flare_gun`); the Foreman
(client loop; on Collect, Discord's included when `meta.prefs.foreman` is on, a greedy pass that keeps
the crowned purchase's price in reserve; errata E18); Dead Hand, with presets of 25, 50, 100 and
200% of glass ever, or "when crowned" (errata E12); `set_loadout` gains `foreman` and `deadHand`; the Crew panel; the welcome back's new lines;
"Magnet full" (off by default); the 10 ring-4-6 nodes that use these systems.

**Done when:** **N19** casual 0.8-2 scrap a day as a 7-day average from day 2 (one-offs excluded),
at least 25 by day 30, nobody above 2.5 (the averages are asserted, single 7-day windows are
warnings; errata E15); **N20** Magnet tests at 19:59, 20:00, 23:00 and 24:00, a
miss resetting it. Ranks give ×2 each (434 scrap for all 14), and no hand rises two ranks above
the lowest (test). A full Pocket swaps only before the run's first purchase; a pocketed upgrade
survives a nuke and works from the first second. Cooldowns follow the game clock, effects real
seconds; Grit stops at 10. The Foreman sends at most one ordinary command a second; Collect's pass
keeps the reserve and matches on client, server and simulator; settle never changes `owned`; Dead
Hand never fires offline. Agenda gates at Wipe Days 1, 2, 4, 7, 8, 15, 20 and 25 are tested.
**N26** on all 361 nodes in data; **N16** re-run.

**Owner supplies:** decisions 12, 14, 19; names; R5 icons. **Shots:** the Magnet at 20 h, 23 h and
full; ranks; Pockets; the Toolbelt ready and cooling; the Foreman toggle; Dead Hand's toast.

### R6 Friends

| Kind | Plan mode | Model and effort | Sessions | Lands on |
| --- | --- | --- | --- | --- |
| architecture, social | yes, full | Opus, high (World, group sim); medium (boards, Discord) | 3 (21-23) | `r6` |

**Build** (from `06-friends.md`): Blowback (counted Wipe Days only; the Drift Crate's formula, with
its 1-minute floor; crates in `meta.blowback` as `[{from, at}]`); Late Tide (`World.lateTide`
carries the median as a number); the Island Count (`World.islandCount` counts Wipe Days only;
errata E18); the Freighter; the boards, with season 1's hall
of fame as "the old world"; the Friends tab; Discord postcards; the `friend_nuked` and
`freighter_tier` notifications (off by default); Visit as the stretch; the group simulation, which
also runs the late wall's options 1 and 2 (`10-balance.md` 5, `05-meta-layers.md`) for the owner's
choice before R7.

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

**Owner supplies:** names; R6 icons; playtest 4 (decides 6 and 13). **Shots:** 1 and 9 crates
waiting; the hull at each tier; the Friends tab; each board; the Late Tide label; Visit; the
postcard in `pnpm preview`.

### R7 Dares, wave 3, live ops

| Kind | Plan mode | Model and effort | Sessions | Lands on |
| --- | --- | --- | --- | --- |
| content, ops | short | Opus, medium; Sonnet, low for the ops session | 3 (24-26) | `r7` |

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

---

## 3. Where the old plan's items go

| Old item | Now |
| --- | --- |
| W9: backups off the server | R0, first, on `main`: the wipe must never be the one way to lose everything |
| W9: error reporting through the bot, `/status` | R2, for the friends: a new `ops` message on the bot stream (`apps/api/src/hub.ts`), DMed to the owner's Discord id from `.env` |
| W9: admin grant | R2, for the founders' gift: a route under `/api/admin` (loopback or `ADMIN_TOKEN`, as today) and `admin-cli.ts` *(proposal)* replacing `season-cli.ts` |
| Admin `respec_all` (new) | R2: the free respec after a tree patch (canon 6.5) |
| W9: announce or end a season | Removed: `season end` runs once, at the cut-over, on the old build |
| W9: ban, reload data, admin panel, Discord admin | R7 |
| W9: `event_log` CSV export | R7; until then the simulator is the balance tool |
| To-do 0: try the bot, send screenshots | Optional: the old build gets no fixes beyond emergencies (decision 7); the card is redone in R2 |
| To-do 1: announce season 1's end | Not needed: no `season announce` (errata E3); season 1 ends quietly (decision 7). It would show the end at 20:00 UTC (the cut-over is a morning) and open the Signal early |
| To-do 2: name pass on W4b-W7 strings | Becomes the glossary pass (canon 20), one slice per phase (section 8) |
| To-do 3: turn notifications on again | Still worth it: subscriptions survive the cut-over, and the switches reset to the new defaults ("Night Shift over" on, quiet hours 22:00-08:00) |
| To-do 4: play and send screenshots | Crashes only until the cut-over; then screenshots are bugs again |
| After W9: polish backlog | Mostly moot. The covered coast becomes R1's column, crew faces the owner's portraits, titles come with R6's boards |
| After W9: research tree; wards | Replaced by the Blast Map; removed (the Freighter is the co-op) |
| After W9: art | Procedural stays (D41); the owner's icons arrive by phase |

---

## 4. Branches and the cut-over

### 4.1 Before the cut-over (R0-R2)

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

### 4.2 After the cut-over (R3 on)

The old convention returns: `main` is live; each phase gets a branch (`r3`, `r4`, ...), merged with
`--no-ff` and deployed at its end from the computer that holds the deploy key. `redesign` is
deleted when R3 starts.

### 4.3 The cut-over

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

When and who: only after R2's acceptance and the rehearsal; on a date agreed with the friends a few
days ahead, on a quiet morning; the owner at the deploying computer, the agent running the
runbook. Then a 24-hour watch (log, error DMs, `/status`). Within that day a rollback (restore the
pre-cut-over copy, redeploy `season-1-final`) is clean; after it, fix forward.

---

## 5. Calendar sketch

Assumptions: the plan is approved by Sunday 2026-10-11, R0 starts Monday 2026-10-12, sessions are
evenly spread, phases take their estimate.

| Milestone | Session | At 4 a week | At 3 a week | 3 a week, 25% overrun |
| --- | --- | --- | --- | --- |
| R0 done | 3 | 2026-10-16 | 2026-10-17 | 2026-10-18 |
| R1 done (playtest 1) | 8 | 2026-10-24 | 2026-10-28 | 2026-11-02 |
| **Cut-over** | 12 | **2026-10-31** | **2026-11-07** | **2026-11-14** |
| R3 done | 15 | 2026-11-05 | 2026-11-14 | 2026-11-22 |
| R5 done | 20 | 2026-11-14 | 2026-11-25 | 2026-12-07 |
| **R7 done** | 26 | **2026-11-25** | **2026-12-09** | **late December; likely January 2027** |

- **The cut-over most likely lands in the first half of November**, whenever R2 and the
  rehearsal pass; it no longer needs to match season 1's planned end (about 2026-11-04;
  decision 7). Add 2-4 days to agree a date.
- **It could be faster:** W0-W8, estimated at 16-22 sessions, took 12 days (2026-09-26 to
  2026-10-07). At that pace the cut-over lands around 2026-10-20, and the owner's review
  (decisions, names, icons, playtests) sets the pace.
- **Phases also grow:** W1 and W4 overran; R1 and R2 are this plan's likeliest, then R3 (it now
  also writes rings 7-9 into data).
- **R7 can meet the holidays.** Under P1 the most active friend reaches Wipe Day #30 (ring 7's gate)
  around day 40 and affords a ring-7 node around day 70 (`10-balance.md` 4.5-4.7), so wave 3 is
  due within about two months of the cut-over.

---

## 6. Kickoff prompts and the effort guide

### 6.1 The kickoff prompt

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

| Phase | Plan files | Add |
| --- | --- | --- |
| R0 | 07, 09, 10 | "First the off-server backup on main, then the tag and the branch. Rewrite the docs before deleting code. Demo clock at 1× with jumps, plus the wall clock. No visuals beyond a bare island." |
| R1 | 02, 08, 09, 10 | "Data and domain first, then the scene, then the drawer. Tell me if unmanned lines feel wrong." |
| R2 | 03, 04, 04b (rings 1-3), 06, 08, 09 | "This phase ends with the cut-over. Do not deploy until I say so; rehearse the runbook on a copy first." |
| R3 | 04, 04b, 10 | "Write rings 7-9 into data, hidden. A change to bought nodes needs respec_all and a decision." |
| R4 | 05, 05b, 04b | "Transcribe pages into data; hand-write only the secrets' hints." |
| R5 | 05, 04b, 10 | "Nothing buys inside settle; the Foreman and Dead Hand send ordinary commands." |
| R6 | 06, 09, 10 | "Count events, times and ratios, never amounts. Never write to another player's base." |
| R7 | 04b, 05, 09, 10 | "Build the late-wall option I chose. Ops last; keep the admin page small." |

### 6.2 Effort guide

As before: architecture, settle, money-like state and balance get **high**; UI gets **medium** with
many screenshot rounds; transcription and chores get **low** or a smaller model.

| Phase | Kind | Model | Effort | Plan mode | Sessions |
| --- | --- | --- | --- | --- | --- |
| R0 Foundations | architecture | Opus | high | full | 3 |
| R1 The run | balance + UI | Opus; Sonnet ok for the UI grind | high (S1, S5), medium (S2-S4) | yes | 5 |
| R2 The Big Red | architecture + UI | Opus | high; medium for cinematic rounds | full | 4 |
| R3 Blast Map wave 2 | balance | Opus | high | full | 3 |
| R4 Logbook | content + UI | Opus or Sonnet | medium | short | 2 |
| R5 Scrap, check-in | domain + balance | Opus | medium-high | full | 3 |
| R6 Friends | architecture + social | Opus | high (World, group sim), medium (boards, Discord) | full | 3 |
| R7 Dares, wave 3, ops | content + ops | Opus, then Sonnet | medium; low for ops | short | 3 |
| Later, gated | architecture + balance | Opus | high | full | 3-4 each |

High effort pays where a mistake is expensive to undo: state v2, settle, `nuke`, the cut-over, World
inputs. If a session drifts outside its phase, stop it and restate the acceptance criteria.

---

## 7. Risks, decisions, and what to cut

### 7.1 Risks (canon 19, made concrete)

| Risk | Bites in | Early warning | Mitigation |
| --- | --- | --- | --- |
| Settle drift, client vs server | R0-R2 | A rollback toast in honest play | N24 in R0; R1's 1,000-sequence test; nothing buys in settle |
| Prestige runaway or stall | R2-R3 | N12-N13 out of band, N11 warnings | The fifth root, never steeper without a group-simulation proof; levers in data; N13 fails the build; no cut-over with N1-N3 or N12-N14 red |
| Lines read as a spreadsheet; unmanned crediting feels off | R1 | Playtest 1 | Drawn products and sounds (A1); redraws at 25 and 100; busy-until crediting, with the Hustle fallback in reserve |
| Click fatigue, heat, autoclickers | R0-R1 | A warm phone, fps under 55 | Hold to work; Hustle's 2 s grace; N9 caps active at 3×; the bucket, so a cheat gains about ×1.3 |
| The UI bar | R1-R3 | Owner screenshots | Three shot rounds for the drawer, cover card and Blast Map; harness checks |
| Friends wait 12 sessions | R0-R2 | Friends lose interest before the cut-over | Three phone shots in `#wipe-day-idle` after R1; the Founder gift for every season 1 base |
| `redesign` drifts from `main` | R0-R2 | A conflict outside deleted files | `main` frozen; merged after each fix |
| A cut-over data mistake | R2 | The rehearsal fails | A real copy; `event_log` ids checked; the off-site copy first; a one-day rollback |
| VPS build memory | R2, R7 | `free -m` under 200 MB while building | Procedural art and sound; else build the web bundle on the PC (a decision) |
| Friends light wave 1 before R3 | R3 | All 73 lit in the first week | R3 first; rings 4-6 already in `04b` |
| The late wall: runs grow to 4.5-10 days after about day 100 | R7 and after | The casual lit share under 45% at day 180 (a warning from R3) | The owner's choice before R7, both options simulated in R6; the Crossing's trigger |
| Writing volume; samey mid-game; bloat | R3-R7 | A session spent on text; weekly nukes falling; N23 near its ceiling | Templated small nodes; agenda unlocks, keystones, secrets, Toolbelt, Dares; one scene-changing node per sector per three rings; the Crossing later |
| Sunk cost | R0 | The urge to keep a system "for later" | The `pre-redesign` tag and the Park list |

### 7.2 Decisions to log per phase

| Phase | Topics |
| --- | --- |
| R0 | From D127 (R0, S1), with P1's constants, the amended N-numbers and the demo clock |
| R1 | The drawer and crowned row; the product mapping; busy-until crediting; `island.json5`; the odds sheet; procedural sound; the ping; quiet hours |
| R2 | `nuke` as built; Wipe Days and small blasts; the crown; wave 1; Afterglow's constants; scrap in `meta`; bot card v2 and the `collect`-only route; error reporting; grant and respec; season 1's end and the gift |
| R3 | Keystones and loadout; ring 4-6 costs; the hidden wave-3 data |
| R4 | Logbook conditions and detection; `pokes`; Morale; secrets and first finds |
| R5 | Magnet; ranks; Pockets; Toolbelt; Foreman and its reserve; Dead Hand; hand traits |
| R6 | Blowback; Late Tide; the Freighter; boards; notification defaults; Visit |
| R7 | Dares; wave 3; the late-wall option; the admin page and export |

### 7.3 If time runs short

Cut in this order; each can return later:

1. Visit. 2. Discord postcard images (keep text news). 3. The admin page and `/admin` (keep the CLI
and `/status`). 4. The CSV export. 5. Island Count cosmetics. 6. The Freighter (the Magnet and the
Logbook still meet N19). 7. Dares. 8. Flight variants two and three. 9. Logbook secrets and first
finds (keep pages and Morale). 10. Rush and Flare (keep Grit).

If R2 runs long, these can slip into R3 without blocking the cut-over: flight variants, the
crater's deepening, `respec_all`, Android vibration, and bot card v2 (`/base` then answers "Open
the game" and the feed keeps posting).

**Never cut:** the off-server backup; R0's property tests and the simulator gates; idempotency and
the bucket; welcome back; the advisor; Afterglow; Late Tide (guardrail 3, and small); the
cinematic. Waves 2 and 3 may slip but not be cut (guardrail 6).

---

## 8. The owner's to-do list, in order

**Before R0**

- [x] Read `01-vision.md` and `07-what-changes.md`; approve or amend (decided 2026-10-10; README
      section 3 and `07` section 10 have every choice).
- [x] The big decision: one run currency, Supplies.
- [x] Decisions to start: 4 seasons [removed as a reset]; 5 the cut list [accepted];
      7 season 1 [runs untouched, ends quietly at the cut-over; the message optional]; 9 prestige
      [fifth root of lifetime, √ Glow]; 10 offline [100% in 12 h, rising to 48 h]; 11 primary
      [signal orange]; 20 notation [suffixes to Dc, then scientific].
- [ ] Backup destination [rclone crypt on Google Drive]: authorise it; keep the password safe.
- [ ] Keep the approved plan files (they live in a temporary session folder) for R0 to commit into
      `docs/redesign/`.
- [ ] Optional: tell the friends the new game comes at the cut-over (early to mid-November) with a
      fresh start, a Founder skin and 5 glass.
- [ ] Optional: notifications on again on every device.

**R0**

- [ ] Check the restore drill's row counts in `docs/deploy.md`.

**R1**

- [ ] Names pass 1 *(proposal)*: Supplies; Beachcomber, Ship Breaker, Reactor; Gus, Vera; the five
      targets and fell cries; Hustle; Hold to work; Night Shift; Drift Crate, Fuel Drum, Rally,
      Adrenaline Kit; hands; Grip; the products; "Starter Kit" (`packed_crate`, the id stays; errata E27) renamed. Eras: keep the
      five Rust grades [leaning] or rename all five. Decisions 2 [Saltmarsh] and 15 [procedural
      sound] were made on 2026-10-10.
- [ ] Icons go to `packages/content/icons/<kind>/<id>.svg`. Safe now: `scrap` first; tier badges;
      tools; the 11 kept line buildings; `tree`, `stone`, `ore`, `sulfur`; `crate`; the 12
      portraits; products reusing ids (`timber`, `roast`, `fibre`, `rope`, `planks`, `charcoal`,
      `ingots`, `leather`, `fuel`, `food`, `plates`).
- [ ] Icons, new: `supplies`, `hustle`, `hand`, `night_shift`, `wreck`, `beachcomber`,
      `shipbreaker`, `reactor`, `gus`, `vera`, `fuel_drum`, `adrenaline`, five nav icons, `upgrade`,
      `roster`, `buy_max`, and products `battery`, `broadcast`, `cell`.
- [ ] Playtest 1 (phone on the LAN, about 45 minutes to Sheet Metal): where were you lost? Do
      unmanned lines feel right? Is the first minute too rushed? Base or spreadsheet? Is the phone
      warm? Send screenshots.
- [ ] Post three phone screenshots to `#wipe-day-idle`.

**R2**

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
      whether R5 goes before R4.)

**R3 to R7**

- [ ] R3: keystone names.
- [ ] R4: names pass 3 (pages, secrets); icons `morale`, `drowned_drone`, `bottle`.
- [ ] R5: decision 19 [traits: one-line perks, the leaning, or cut] (12 [three skills] and 14 [Dead
      Hand opt-in, online, Wipe Day 25] were made on 2026-10-10); icons `magnet`, `pocket`, `rank`, `foreman`, `dead_hand`, `rush`,
      `grit`, `flare`, `sealed_locker`; the 11 traits only if they stay.
- [ ] R6: icons `blowback`, `island_count`, `freighter`, `pennant`, `late_tide`; playtest 4
      confirms 6 [expeditions parked] and 13 [creeds deferred] (16 [1 scrap per tier, a pennant at
      III] and 17 [Visit as a stretch] were made on 2026-10-10).
- [ ] Before R7: the late wall's final option (`10-balance.md` 5), from R6's simulations [option 1,
      a slow outer tree with the Crossing trigger at 45% lit and N13 firing, is the working plan;
      option 2 is simulated alongside].
- [ ] R7: Dare names and badges; review the admin page.
- [ ] Stop drawing (canon 17): other resources and items, furnace types, the `fibre` node, defences,
      Den, casino, Signal, contract and task art.

---

## Open questions

None; settled by errata v3.

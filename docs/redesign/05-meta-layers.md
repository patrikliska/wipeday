# 05 Meta layers: everything you keep beside the Blast Map

Status: proposal for the owner, 2026-10-07; revised 2026-10-08 against the resolutions (canon v2).
It expands canon sections 3, 4.7, 5.5, 7 and 9 and the numbers N19, N20 and N22. Names marked
*(proposal)* wait for the owner's pass; numbers marked *(sim)* are starting constants owned by
`10-balance.md`. Rules and shapes are canon.

The tree is `04-blast-map.md` (catalog `04b`); the nuke, cover card, postcard, rebuild screen,
agenda and the Crossing are `03-the-big-red.md`; wireframes are `08-screens.md`; state, commands
and schemas are `09-architecture.md`; the Freighter and first-find news are `06-friends.md`; the
Logbook catalog is `05b` (its brief is 1.9).

---

## 0. The layers at a glance

| Layer | What it gives | Paid with | Opens | Ships |
| --- | --- | --- | --- | --- |
| Logbook | Morale `1 + 0.02 × pages`; 1 scrap per 25 pages | playing | the first tap | R4 |
| The Magnet | about 1 scrap a day | time | Wipe Day #1 | R5 |
| Crew ranks | ×2 per rank to one hand's line, 5 ranks, rising together | scrap 1/2/4/8/16 | #1 | R5 |
| Pockets | one shelf upgrade kept through every nuke, 3 slots | scrap 5/15/40 | slot 1 at #2; slots 2-3 by node | R5 |
| Toolbelt | Rush, Grit, Flare | cooldowns | #4, #8, #15 | R5 |
| The Foreman | buys lines while you watch; one pass at Collect | free | #7 (lines 1-6), #20 (all) | R5 |
| Dead Hand | presses the Big Red while you watch | the `dead_hand` node | #25 | R5 |
| Dares | one rule changed for a run; a permanent ≤ +25% on one stat | a run | #5 | R7 (4); 8 later |
| Crater depth (option 2) | everything ×1.03 more each day, from day 90 | calendar time | day 90 | R7, only if chosen (10.3) |
| Creeds | a different verb per run | — | only on a trigger | later, gated |

Rules for every layer:

- It lives in `state.meta`, survives every nuke and is predicted on the client (D64). The
  player's standing orders (keystones, the Foreman's switch, Dead Hand's setting) are one
  `set_loadout {keystones?, foreman?, deadHand?}` command: keystones in `meta.loadout`, the Foreman
  and Dead Hand in `meta.prefs` (resolution 3.15; `09` 3.1); an omitted field stays as it is. Keystones change only while rebuilding (`03` 9.1); the
  other two any time after their unlock.
- Nothing here acts inside settle. The Magnet's auto-haul is time-driven and closed-form, like the
  Night Shift window's end; everything else is a command.
- Never tease: a layer's nav item, chip, hints and Logbook pages appear only once its phase ships.
  A player past a gate gets it at once through the "New on Saltmarsh" card (`03`, section 12).
- Scrap is recorded before it shows: `meta.scrap` holds the first Wipe Day's 3 from R2 and 1 per
  25 pages from R4; the chip appears in R5 together with its sinks (resolution 3.20).
- Scrap is never traded, gifted, wagered, stolen or sold (guardrail 8).

---

## 1. The Logbook and Morale (R4)

### 1.1 What it is

The island's achievements, written as the crew's diary. Every entry ("page") raises **Morale**, and
every 25 pages pay 1 scrap. About **120 pages** ship in R4, growing to about **250**; about 25% are
**secrets**. Pages are kept forever, through nukes and a Crossing (resolution 3.24).

### 1.2 Categories (R4 launch: 120 pages)

| Category (id) | Pages | Secrets | Covers |
| --- | --- | --- | --- |
| Eras (`eras`) | 9 | 2 | first reach of each era, fast reaches, odd climbs |
| Lines (`lines`) | 18 | 3 | 100 of each line, roster milestones, the 200-400 milestones of one line |
| Hands (`hands`) | 12 | 2 | first hires, all hands at once, kept hands |
| Taps (`taps`) | 11 | 3 | fells, crits, full Hustle, hold to work, Afterglow |
| Flotsam (`flotsam`) | 12 | 3 | each kind, counts, combos, catches in rain |
| Wipe Days (`nukes`) | 13 | 4 | counts, doubling blasts, odd launches, glass ever |
| Flight log (`flights`) | 13 | 0 | the 12 flight variants (`03`, 7.3), and all of them |
| Blast Map (`map`) | 9 | 1 | node counts, a lit ring, a keystone slotted, a path bought |
| Night Shift (`night_shift`) | 6 | 2 | full windows, long absences, Collect |
| Island (`island`) | 8 | 4 | weather, night, gulls, the crater sign |
| Jokes (`jokes`) | 9 | 6 | silly feats |
| **Total** | **120** | **30** | |

Growth to about 250, each page in the phase of its systems: about 40 in R5 (Scrapyard, Toolbelt,
automation), 40 in R6 (Friends, counting events and never amounts) and 50 in R7 (Dares, rings 7-9,
more of the rest).

### 1.3 How pages are detected

- **One pure domain function**, `logbook(before, after, events) → pages`, runs **at the end of
  every command** (taps, pings and Collect included; resolution 3.14): on the client for
  prediction, on the server for truth. It never runs inside settle; a page that needs time to pass
  (a full Night Shift window) is found at the next command, which is when the player looks anyway.
- **A taps batch that finds a page writes that one `logbook_entry` row** (about 250 in a lifetime);
  other batches still write none (canon 13.4). A first find needs the row at once (1.7).
- **Pokes.** Taps on scene objects ride on the taps batch as an optional `pokes: {gull: 3}`,
  credited from the same token bucket after the taps, so both together stay within 15 a second. A
  poke pays nothing, builds no Hustle, never fells, counts in `meta.stats.pokes` and plays a
  reaction (the gull flaps off squawking, the Kettle clangs). R4 ships `gull` and `kettle`.
- **Every condition is data**: one `when` from the closed vocabulary below. A page that needs a new
  kind of condition is code, budgeted in its phase like an unlock node.

| `when` kind | Shape | Reads | Bar |
| --- | --- | --- | --- |
| `stat` | `{stat, of?, gte}` | a lifetime counter in `meta.stats` | yes |
| `run` | `{run, of?, gte}` | a counter of this run | yes |
| `event` | `{event, <field>: value, <field>Gte / Lte: n}` | a domain event of this command | no |
| `state` | `{state, eq or gte, era?}` | a named predicate on state after the command | with `gte` |
| `buffs` | `{buffs: [kind, kind]}` | buffs running at once | no |
| `pages` | `{pages: {category?, all?, gte?}}` | other pages | yes |

- **Counters** (`stat`, recorded from their phase so R4 can backfill; `of` narrows by kind): R1
  `taps`, `felled` (of a target), `flotsam` (of a kind), `hands_hired` and `units` (of a line),
  `upgrades`, `eras` (of an era), `collects`, `full_windows`; R2 `crits`, `wipe_days`,
  `small_blasts`, `nodes`, `glass_ever`; R4 `pokes` (of an object). **Run counters** (`run`):
  `taps`, `felled`, `flotsam`, `units`, `hands_hired`, `upgrades`, `made`, `seconds`.
- **Events** and the fields a page may filter on: `era_reached {era, runSeconds}`; `hand_hired
  {line, runSeconds}`; `milestone {kind: line | roster, line, at}`; `felled {target, crit}`;
  `flotsam_claimed {kind, weather, night}`; `nuked {counted, flight, weather, night, gain,
  gainShare, runSeconds, handsHiredThisRun, era}`; `collected {awaySeconds, windowFull}`;
  `node_bought {node, sector, ring, type, path}`; `record_set {record}`. `collected` and
  `node_bought` are new client-only events (`09-architecture.md` 7.2 adds them).
- **State predicates** (small pure functions in `logbook.ts`; R4 starts with nine):
  `supplies_floor` (eq), `hands_working`, `lines_min_owned` (every unlocked line owns at least n),
  `line_max_owned`, `sector_rings_lit` (most fully lit rings in one sector), `sectors_touched`,
  `keystones_slotted`, `run_made_before_era` (supplies made this run before any era purchase),
  `window_hours`.
- **Buffs:** `rally`, `adrenaline`, `drone` (R4); `rush` (R5).
- **Backfill.** On R4's deploy every page derivable from counters, records and the flights-seen
  list arrives in one toast: "Logbook: 23 pages from your past runs". Event pages (a fast era, a
  launch in rain) must be earned again.
- Weather and night come from `island.json5` in the domain (resolution 3.17), so "in rain" agrees
  on client and server.

### 1.4 Morale

- **Morale = `1 + m × pages`**, `m` = 0.02 plus the Logbook sector's `morale_per` nodes. It is
  folded once, after Glow and before buffs (canon 13.5), so it multiplies every line and every tap.
- Shown on the Logbook header (`Morale ×2.48`), the Multipliers sheet and each new-page toast as
  before → after.
- The catalog is finite, so an active player's Morale lead is capped by its size: a quiet catch-up
  for idlers and late joiners (N16, N17).

Morale nodes, placed by `04-blast-map.md` 6.9 (errata E24; the sector's rings 1-3 are history nodes, so wave 1
ships whole in R2):

| Node (id) | Ring, type | Effect | Per page after | Ships |
| --- | --- | --- | --- | --- |
| War Stories (`war_stories`, perk id) | 4, stat | `morale_per` +0.005 | 0.025 | R4 |
| Old Maps (`old_maps`, perk id) | 4, unlock | secret hints show now, not at Wipe Day #15 | — | R4 |
| Margin Notes (`margin_notes`) | 5, stat | +0.005 | 0.030 | R4 |
| Field Notes (`field_notes`) | 6, stat | +0.005 | 0.035 | R4 |
| Dog-eared Pages (`dog_eared`) | 6, notable | Morale ×1.2 | — | R4 |
| Pressed Flowers (`pressed_flowers`) | 7, stat | +0.005 | 0.040 | R7 |
| Bound Volume (`bound_volume`) | 9, stat | +0.010 | 0.050 | R7 |

At 250 pages with every node in this table: `(1 + 0.05 × 250) × 1.2 = ×16.2`; with Full Log
(`full_log`, Logbook ring 9 completion, Morale ×1.25) as well, `(1 + 0.05 × 250) × 1.5 = ×20.25`. The total matches
`10-balance.md` 6.1 (0.02 → 0.05); the +0.006 its budget gives rings 2-3 moves to rings 4-9 with
the nodes.

### 1.5 Scrap from pages

+1 scrap at 25, 50, 75 … pages (a secret counts once). Recorded in `meta.scrap`
from R4, shown from R5, when the header adds "next scrap at 75 (3 to go)".

### 1.6 Secrets and hints

- A secret is a "???" tile until found; its condition is never shown.
- Its **one-line hint** opens when any of these holds: **Wipe Day #15** (agenda, R4); **Old Maps**
  owned; a **friend found it first** (1.7); or a **Message in a Bottle** opened it (the bottle
  picks, by seed, one unfound secret with a closed hint; with none left it pays its crate only).
  Bottle Reader (ring 6, R4) makes a bottle name the answer; Hint Lamp and Treasure Map follow in
  R7 (`04` 6.9). Opened hints live in `meta.logbook.hints`.
- Until then the tile reads "A secret · hints from Wipe Day #15", a real and reachable reason.
- Hints are fair: one sentence, never the solution's words, solvable without a wiki.

### 1.7 Shared first finds

- When a player logs a secret nobody has logged (the server checks the `logbook_entry` events),
  it is a **first find**: a feed line and a Discord post (canon 8.1), and its hint opens for all.
- Copy: "Patrik found a Logbook secret first. Its hint is open to everyone now: 'The gulls are
  keeping score.'" The page's **name stays hidden**: names give answers away, so no feed line ever names a
  secret (errata E19).
- Others' tiles show the hint and "Patrik found this first"; the finder's tile gets a "First find"
  ribbon. No power, no scrap: friends cheer, they do not race for stock.
- A World input `firstFinds: {page: player}` is copied into `meta` on each server settle (canon
  13.6's pattern); the finder's name is what the tile shows.

### 1.8 UI summary (wireframes in `08-screens.md`)

- **Nav:** Logbook, the fourth nav item from R4, with a dot for unseen pages. **Header:** "Logbook ·
  74/120 · Morale ×2.48", and from R5 "next scrap at 75 (1 to go)".
- **Nearest page** card on top (the closest unfinished visible page and its bar), then **category
  chips** over a **3-column grid** at 390 px. A tile: icon in a page frame, name on one truncating
  line, then the date found, a bar with numbers, or "???" with its hint.
- **New page:** a toast with icon, name and `Morale ×a → ×b`; pages within 2 s merge ("Logbook +3").
- **Odds page:** every random table, read from data (flotsam, crits, flights; the Magnet from R5).
  It repeats the Odds sheet in Settings, there from R1 (`02-the-run.md` 8.5; errata E8).
- **Icons:** none new per page: a page shows its subject's icon in a page frame; secrets and jokes
  use the gull, the Kettle or a "?" page (three new `ui` icons for R4: the frame, `?` and the gull).

### 1.9 Brief for the `05b` catalog writer

**Deliverable:** `05b-logbook.md` beside this file.

1. **The R4 table**, exactly 120 rows: `id` · category · name *(proposal)* · how (shown text) ·
   `when` (JSON5, 1.3) · secret · hint (secrets only) · quip (optional) · icon (`<kind>/<id>`,
   `07-what-changes.md` 8.1's kinds) · day (the casual's estimated day of first find, or "long
   haul").
2. **Growth pages** (optional, at most 30): the same columns plus the phase (R5, R6 or R7).
3. **New counters and predicates**, if any, with where each counts and its phase: at most 6 new
   counters and 12 state predicates in all (1.3's nine included).
4. **Counts per category and per pacing band**, checked against 1.2 and the bands below.

**Counts:** exactly 1.2's table, category by category: 120 pages, 30 secrets.

**Pacing** (`10-balance.md` 2.1's Logbook curve scaled to 120 pages; the casual plays 08:00, 13:00
and 21:00 for 5 minutes at 4 taps/s and nukes when crowned): 15-25 pages on day 1, 45-55 by day
7, 70-80 by day 30, 90-100 by day 90. The rest are secrets and at most 12 long-haul pages.

**An R4 page may read only** R1-R4: the run (with three flotsam kinds, weather and night), the Big
Red (Wipe Days, small blasts, Afterglow, the crater sign, crits), Blast Map rings 1-6 and
keystones, and R4's own Logbook, Drowned Drone, Bottle, eight new flights and pokes. **Never in
R4:** scrap, the Magnet, ranks, Pockets, the Toolbelt, the Foreman, Dead Hand, the Sealed Locker,
Blowback, the Island Count, the Freighter, Late Tide, boards, Visit, Dares, rings 7-9, the Barge.

**Tone.** The crew's diary: dry, short, warm. Names 1-3 words in Title Case; they may play on the
island's own words (Kettle, Big Red, Wipe Day, Saltmarsh). How lines are imperative, one line, at
most 48 characters, numbers in the shared formatter. Quips at most 60 characters, in a crew voice.
No other game's names, achievement titles, quotes or branded memes (D43): "1,337" as a number is
fine, the word "Leet" is not.

**Rules.**

1. One `when` from 1.3; every counter page shows a bar.
2. Achievable by the casual archetype within 90 days, except the long-haul pages; none needs more
   than 6 months, 10,000 fells or 1M taps (hold to work counts). Unit prices grow by `g_i` per unit
   (`02-the-run.md` 2.4), so 1,000 of one line is out of reach; 400 is the practical top.
3. Nothing that rewards absence beyond a night, needs a calendar date or a clock time (rain, fog
   and night are fine: a casual meets them at the check-ins), needs a friend or a friend's amounts,
   or is rarer than 1 in 1,000 per honest try.
4. Secrets stay possible at every stage: none may become impossible after a Blast Map purchase
   (start-era, kit and kept-hand nodes change how runs start; `04` 6.11) or only work before Wipe
   Day #3.
5. Wipe Day pages read only counted nukes (`counted: true`); Fizzle is the small blast's page.
6. A secret's "how" shows only once found; its hint follows 1.6.
7. Ids: lowercase `snake_case`, 2-32 characters, unique, never another content id (they become the
   locale keys `logbook.<id>.name`, `.how`, `.hint` and `.quip`). Ids a `when` names come from
   `02-the-run.md` (eras, targets, lines, hands, flotsam), `03` 7.3 (flights) and `04` (nodes,
   sectors).

**Fifteen examples** (five secrets):

| Id | Name | Category | How (shown) | `when` | Hint |
| --- | --- | --- | --- | --- | --- |
| `first_fell` | Timber! | taps | Fell your first target. | `{stat: "felled", gte: 1}` | |
| `felled_1000` | Thousand Stumps | taps | Fell 1,000 targets. | `{stat: "felled", gte: 1000}` | |
| `metal_sprint` | Tin Roof Sprint | eras | Reach Sheet Metal in a run's first 30 min. | `{event: "era_reached", era: "metal", runSecondsLte: 1800}` | |
| `all_hands` | All Hands | hands | Have all 14 hands working at once. | `{state: "hands_working", gte: 14}` | |
| `bit_of_everything` | A Bit of Everything | lines | Own 100 of every unlocked line. | `{event: "milestone", kind: "roster", at: 100}` | |
| `double_shot` | Double Shot | flotsam (R5) | Run a Rally and an Adrenaline Kit at once. | `{buffs: ["rally", "adrenaline"]}` | |
| `regular` | Regular | nukes | Reach Wipe Day #10. | `{stat: "wipe_days", gte: 10}` | |
| `loop_the_loop` | Loop-the-Loop | flights | Watch the Kettle loop the loop. | `{event: "nuked", flight: "loop_the_loop"}` | |
| `scorched_wedge` | Scorched Wedge | map | Light every node of one ring in one sector. | `{state: "sector_rings_lit", gte: 1}` | |
| `slept_through` | Slept Through It | night_shift | Come back to a full Night Shift window. | `{event: "collected", windowFull: true}` | |
| `elite_heap` | Elite Heap | jokes, secret | Hold exactly 1,337 supplies. | `{state: "supplies_floor", eq: 1337}` | "Some numbers are more elite than others." |
| `lightning_rod` | Lightning Rod | nukes, secret | Press the Big Red while it rains. | `{event: "nuked", counted: true, weather: "rain"}` | "Most people launch in fair weather." |
| `gull_botherer` | Gull Botherer | island, secret | Poke the gulls 100 times. | `{stat: "pokes", of: "gull", gte: 100}` | "The gulls are keeping score." |
| `nobody_home` | Nobody Home | nukes, secret | Press the Big Red with no hand hired that run. | `{event: "nuked", counted: true, handsHiredThisRun: 0}` | "Some blasts are a solo act." |
| `lean_to_life` | Lean-to Life | eras, secret | Make 1M supplies in a run before buying an era. | `{state: "run_made_before_era", gte: 1e6}` | "Some never move out." |

`elite_heap` checks `floor(supplies)` at a command's end; it is easiest at a run's start, before
any hand. `nobody_home` counts hands hired this run, so kept hands do not spoil it. `lean_to_life`
works from any starting era, so start-era nodes never close it. `double_shot` is a growth page:
natural flotsam never overlaps a Rally (`02-the-run.md` 8.1), so it waits for the Flare.

---

## 2. Scrap and the Magnet (R5)

### 2.1 The Magnet's states

A free electromagnet crane over the bay, running from Wipe Day #1, driven by `meta.magnet = {since,
n, tray}` (cycle start, hauls so far, scrap in the tray), all on the **game clock** (an idle timer).

| State | Time in the cycle | A haul gives | Then |
| --- | --- | --- | --- |
| Growing | 0-20 h | nothing; the card shows when the next states begin | — |
| Early haul | 20-23 h | **50%**: 1 scrap; a miss gives nothing | the cycle restarts now, hit or miss |
| Sure | 23-24 h | 1 scrap; **10% rich**: 2 or 3, even odds | the cycle restarts now |
| Auto-haul | at 24 h | the Sure roll, into the tray, by itself | the next cycle starts at once (`since += 24 h`) |

- **Expected values:** 1.15 per Sure or auto haul, 0.5 per early haul. Waiting always pays more on
  average; the card says so, and hauling early is the player's call.
- **Lazy:** settle counts the auto-hauls since `since` (`k = floor(elapsed / 24 h)`), rolls each by
  its index and adds them to the tray. Three days away leave three hauls; nothing is lost.
- **Seeded:** `rng(seed, "magnet", n)`, `n` counting every haul. No clock value enters the roll, so
  prediction and server agree and nothing can be rerolled.
- **Commands:** `haul_magnet` (empties the tray, plus an early or Sure haul when one is open;
  refused only while Growing with an empty tray, with the time to wait) and `collect` (empties the
  tray; the only command the bot may send, resolution 3.23). The tray never expires and has no cap.
- **R5's start:** a player past Wipe Day #1 when R5 deploys starts a fresh cycle at their first
  command after it. Hauls are not backfilled; `meta.scrap` already holds what R2-R4 recorded.

### 2.2 Scrapyard nodes on the cycle

Four winch stat nodes (`magnet_hours` 24 → 20) each take 1 h off all three thresholds, down to
**16/19/20 h**: `quick_winch` (ring 5) and `greased_cable` (ring 6) in R5, `heavy_coil` (ring 7)
and `night_crane` (ring 8) in R7 (`04` 6.10; rings 5-8, errata E24). No node raises the rich chance or scrap per haul:
2.3's ceiling is tight. The sector also holds the Pocket-slot nodes (section 4).

### 2.3 Every source and sink, per week

A steady week (weeks 2-4) once R4-R6 have shipped *(sim)*:

| Source | Rule | Casual | Idler | Active | Optimal |
| --- | --- | --- | --- | --- | --- |
| The Magnet | one haul a day, 1.15 each | 8.1 | 8.1 | 8.4 | 9.2 (two nodes) to 10.2 (four) |
| Sealed Locker | 1% of flotsam (errata E15) | 0.1 | 0.1 | 0.8 | 1.6 |
| Logbook | 1 per 25 pages | 0.8 | 0.5 | 1.2 | 1.0 |
| The Freighter | 1 per tier, at most 3 a week | 2 | 1.5 | 3 | 3 |
| **Per week / per day** | | **11.0 / 1.6** | **10.2 / 1.5** | **13.4 / 1.9** | **14.8-15.8 / 2.1-2.3** |

One-off: **3 scrap for the first Wipe Day** (recorded from R2). Online time assumed: casual 15 min
a day (2 flotsam caught), active 80 min (11), optimal hourly with Flare (about 23).

**N19** reads "per day" as the 7-day average from day 2, one-offs excluded (resolution section 2):
casual 1.6 a day (band 0.8-2); casual by day 30 ≈ 3 + 33 + 6 + 6 + 1 = **49** (≥ 25; the model
measures 53); nobody above 2.5. N19 asserts these averages; a single 7-day window outside the band
is a warning (errata E15). With all four winches (R7) the optimal player sits near 2.3. The lever
left is the Freighter's cap (3 → 2).

| Sink (the only two) | Prices | Total |
| --- | --- | --- |
| Crew ranks | 1, 2, 4, 8, 16 per hand, 14 hands | 434 |
| Pocket slots | 5, 15, 40 | 60 |
| **All** | | **494**, about ten months of a casual's scrap |

A casual's path *(sim)*: day 1, the first Wipe Day's 3 scrap buy rank 1 for three hands; days 3-5,
Pocket slot 1; week 2, rank 1 for every hand met; weeks 3-4, Pocket slot 2; month 2, rank 2 for
all; months 3-4, rank 3 and Pocket slot 3; months 9-10, every hand at rank 5 (ranks alone take 7-9
months across the archetypes, resolution 1.7).

### 2.4 In the scene: the crane over the bay

- A rusty crane on the quay at x ≈ 520, its jib over the water to x ≈ 380, a tray crate at its
  foot. Fixed-size tap target (D48), at least 44 CSS px. Its lamp draws on `lights` (D47).
- **Growing:** the magnet under water, cable taut, a slow white blink; bubbles quicken over the
  cycle. **Early:** the cable twitches; the lamp turns amber. **Sure:** the magnet hangs half out
  of the water with a glinting lump; the lamp is gold.
- **Haul** (1.2 s, real seconds): winch up, swing, drop into the tray with a clink; "+1 scrap" flies
  to the chip. A rich haul brings a bigger lump and scatters the gulls; a miss brings up an old boot
  ("Nothing. The Magnet goes back down."). Scrap waiting in the tray glints.
- It glows when it has something, like flotsam, and never takes the advisor's crown.

### 2.5 In the top bar, and the Magnet card

- **Scrap chip** (gold, `7`) right of the glass chip, from R5. A thin arc around its icon follows
  the cycle: gold filling, amber in Early, full and pulsing in Sure, plus a dot when the tray holds
  scrap. A tap opens the Magnet card.
- **Magnet card** (one primary at most), with "Scrap buys crew ranks and Pocket slots" linking to
  Crew:

  | State | Copy | Buttons |
  | --- | --- | --- |
  | Growing | "14 h 20 m in. Early haul in 5 h 40 m, sure in 8 h 40 m, hauls by itself in 9 h 40 m." | Close |
  | Early | "Haul early: 50% chance of 1 scrap. A miss restarts the timer. Sure in 2 h 10 m." | **Haul early (50%)** secondary, **Wait** |
  | Sure | "Ready: 1 scrap, 10% chance of a rich haul (2-3)." | primary **Haul** |
  | Tray | "In the tray: 2 scrap." | primary **Take it** |

- **Welcome back:** "The Magnet hauled up 2 scrap." Collect empties the tray. **"Magnet full"**, off
  by default (canon 12.7), fires when a haul becomes sure. Hint: "The Magnet hauls up scrap once a
  day. Scrap is rare: spend it in Crew."

---

## 3. Crew ranks (R5)

Each of the 14 hands has 5 ranks, kept forever, bought in the Crew panel (`rank_hand`). A hand can
be ranked once it has been hired at least once (Gus and Vera after a first Armored run).

| Rank | Price | Line | Portrait frame | On the island |
| --- | --- | --- | --- | --- |
| 1 | 1 | ×2 | rope, 1 gold pip | a gold armband |
| 2 | 2 | ×4 | rope, 2 pips | |
| 3 | 4 | ×8 | riveted iron, 3 pips | a gold hat band |
| 4 | 8 | ×16 | riveted iron, 4 pips | |
| 5 | 16 | ×32 | gold, 5 pips, a green glass edge | a gold star on the hat, glinting at night (`lights`) |

- 31 scrap maxes a hand; 434 maxes all 14, about 7-9 months (resolution 1.7). Rank 0 is a plain
  rope frame.
- **Ranks rise together** (resolution 1.7): a hand ranks up only while it is at the lowest rank
  among the rankable hands, so no hand is ever two ranks above another. Every hand gets rank 1
  before any gets rank 2; a newly rankable hand (Gus, Vera) catches up first, cheaply. A blocked
  button stays visible with its reason: "Rank 3 after every hand has rank 2 (4 to go)". Focused
  ranks would put the optimal player at 4.98× the casual by day 30 (`10-balance.md` 8).
- Pips are scrap gold, so ranks read as bought with scrap. Frames never use tier colours, which
  mean eras everywhere (CLAUDE.md 6.2).
- **The rank multiplies the line, manned or not:** no "is she hired?" condition. Lone Wolf (no hands
  at all) keeps rank bonuses.
- **With milestones:** the rank is one `more` factor per line (`2^rank`) beside Line Mk, eras and
  island upgrades, after milestones. It never moves a milestone's threshold or size, and it is
  payout, never speed, so cycle bars stay honest; Union Rules does not touch it. The row shows both:
  "Furnace · 140 · ×8 (Wren ★★★) · 140/200 → ×3".
- **Choosing:** every rank open in a round costs the same, so Crew crowns the open hand whose line
  earns most now (rule 6.3.1): "Furnaces make 41% of your supplies. Rank 2 for Wren: Furnaces ×2,
  +41% now."
- **Rank nodes:** `rank_mult` nodes in the Scrapyard from ring 6 (the 6.3 notable, ×2.1, R5) to
  `brass_polish` (ring 8, R7) raise the step to at most ×2.25 *(sim)* (errata E24).
- Hand traits (owner decision 19) stay separate: if kept, a one-line perk under the name.
- Hint: "Ranks are forever: ×2 to her line, every run."

---

## 4. Pockets (R5)

- **Slots** (resolution 3.10): slot 1 from Wipe Day #2 (agenda), 5 scrap; slot 2 once the
  Scrapyard node `deep_pockets` (ring 4, 333 glass; errata E24) is lit, 15; slot 3 with `sewn_lining` (ring 6,
  44.4k), 40. A node makes a slot buyable; a bought slot is kept for good.
- **What fits:** one shelf upgrade per slot: a Grip rung, a Line Mk II or III, or an island upgrade
  (40 eligible, `02-the-run.md` 5.1). Never an era, hand, line unit or flotsam; one upgrade in one
  slot only.
- **Effect:** owned from the first second of every run. A pocketed Line Mk works at 0 units owned. A
  pocketed Grip rung counts toward `2^grip`; lower rungs stay buyable in order. Its shelf row reads
  "In your Pocket".
- **Filling and swapping** (`set_pocket {slot, upgrade}`; the first fill of an unbought slot also
  pays its scrap): an **empty slot** can be filled at any time with an upgrade owned this run or
  bought last run; a **full slot** can be swapped only **before the run's first purchase** (the
  rebuild screen, or Crew right after landing), so nothing is lost mid-run. Later, `junk_drawer`
  (ring 9, R7) allows one swap per run at any time, and the Sentimental keystone (ring 8) makes
  pocketed upgrades count five times for one slot fewer.
- **On the rebuild screen** from R5, a POCKETS block whenever a slot is owned or buyable; it alone
  is reason enough to show the screen (`03` 9.1):

  ```
  POCKETS · 2 of 3
  [rail_spur]  Rail Spur · everything ×2      [Change]
               last run: bought at 2 h 41 m
  [empty]      Pick from last run's upgrades  [Pick]
  [locked]     Slot 3 · 40 scrap · needs Sewn Lining (Scrapyard)
  ```

- **The picker** lists last run's shelf buys by suggested value, the effect times how far into the
  run it was bought ("×2 for the first 2 h 41 m"); the top row is the advisor's pick and **Pocket
  it** the one primary. Late island upgrades usually win; a late Line Mk III on the top line is
  second.
- A Dare may put a pocket to sleep (Bare Hands, a Grip rung): "asleep this run".
- Hint: "A Pocket keeps one upgrade through the blast."

---

## 5. The Foreman (R5)

### 5.1 Unlock and scope

- Agenda: **Wipe Day #7** for lines 1-6, **#20** for all; Foreman's Mate (Crew ring 6, gate 7)
  covers lines 1-10 from #7 (`04` 6.4).
- A switch in Crew, **on** when unlocked, with the hint "The Foreman buys lines for you while you
  watch. Switch him off in Crew." Stored in `meta.prefs.foreman` and changed with
  `set_loadout {foreman}` (resolution 3.15), so every tab and device agrees.
- **Scope:** line units of **manned** lines, unlocked this run, in scope and under any Dare cap.
  Never hands, upgrades, eras, nodes, scrap buys, the Toolbelt or the Big Red.
- In the scene, a hard-hat figure with a clipboard points at a building as it gains units; the row's
  count ticks with a clipboard mark. No toasts.

### 5.2 Which unit, and the reserve

**Payback** = a unit's price ÷ the supplies per second it adds, milestone jumps included (the 25th
unit doubles the line's speed, so it is bought first). The Foreman buys the **affordable unit with
the lowest payback** (ties: the lower rung), the same function as the simulator's greedy buyer.

**It keeps the crowned purchase's price in reserve** (resolution 1.10): it reads the advisor's
crown once, and with crown price `T` and supplies `S` it spends only `S − T`, buying nothing while
`S < T`, so the player's next tap still buys the crown. A crowned Big Red reserves nothing; a
crowned unit in the Foreman's own scope is simply its first buy. Without the reserve the model's
idler falls from 1.00 to 0.44 of the casual at day 30 (`10-balance.md` 8).

### 5.3 Online policy

While the page is visible, it checks once a second and sends **at most one ordinary `buy_line
{line, count}` a second**, `count` being 5.4's chunk, within the same reserve. It waits while the
drawer is expanded, a sheet or card is open (the cover card pauses it, `03`) or the hold and
cinematic run; for 5 s after the player's own purchase; and in a hidden tab (with two tabs, only
the most recently focused runs it). A refused Foreman command is silent; the next second
recomputes.

### 5.4 The pass at Collect

`collect` (no payload) runs: settle to now, empty the Magnet's tray, **one deterministic greedy
buy-max pass**, then the Logbook check. The welcome-back card previews the pass ("The Foreman will
buy about 1,240 units"), since the client runs the same function. Discord's Collect is the same
command, so it runs the pass too whenever the Foreman is on (errata E18).

In words: read the crown once; repeatedly take the best unit within budget and buy the largest
**chunk** of its line in one closed-form step: as many as the budget allows, stopping before its
payback passes the second-best line's and at the next line or roster milestone; stop when nothing
fits, or after 2,000 steps *(sim)*.

```ts
// packages/domain/src/foreman.ts (proposal). Called by `collect` after settle; never by settle.
export function foremanPass(s: State): State {
  if (!foremanOn(s)) return s;                     // unlocked and meta.prefs.foreman
  const reserve = crownReserve(s);                 // advisor v2, read once; 0 for the Big Red or an in-scope unit
  for (let step = 0; step < MAX_STEPS; step++) {   // MAX_STEPS = 2,000, in data
    const budget = s.run.supplies - reserve;
    const ranked = foremanScope(s)                 // manned, unlocked, in scope, under Dare caps
      .map((i) => ({ i, pb: price(s, i, 1) / addedRate(s, i, 1) }))
      .sort((a, b) => a.pb - b.pb || a.i - b.i);
    const best = ranked.find((c) => price(s, c.i, 1) <= budget);
    if (!best) break;
    const second = ranked.find((c) => c.i !== best.i)?.pb ?? Infinity;
    const k = chunk(s, best.i, second, budget);    // >= 1: budget, payback crossing, next milestone
    s = buyLine(s, best.i, k);                     // the same pure function `buy_line` runs
  }
  return s;
}
```

`chunk` is the minimum of: units affordable within the budget (the geometric series inverted),
units before the payback passes `second` (`log(second / pb) / log(g_i)`), units up to and including
the next line or roster milestone, and any Dare cap; each is then checked with `price()` and
adjusted by ±1.

### 5.5 Why it stays closed-form and identical

- **Settle stays closed-form:** the pass runs inside `collect`, after settle, as a bounded loop of
  closed-form steps. Settle never changes `owned`.
- **One function, one input:** prediction, server and simulator run `foremanPass` on the same
  settled state, through the `price` and `buyLine` that `buy_line` uses.
- **Float edges:** `Math.pow` and `Math.log` may differ in the last bit between engines; the ±1
  check removes most cases, and the server's answer replaces the prediction silently (only a
  refusal toasts).
- **Tests:** chunked equals a one-unit-at-a-time oracle on 1,000 seeded states (within one unit on
  exact ties); a 12-hour Collect takes under 200 steps; an affordable crown is still affordable after
  the pass; simulated lifetimes never hit `MAX_STEPS`.

### 5.6 Edge cases

| Case | What happens |
| --- | --- |
| No manned line in scope, or Foreman off | No-op. |
| Thirteen / Twig Only Dares | Never past 13 owned / scope is lines 1-3. |
| A new run | It resumes once a line in scope is manned (kept hands from #3: at once). |
| `MAX_STEPS` reached | The pass stops and supplies stay. |

---

## 6. Dead Hand (R5)

- **Unlock:** the `dead_hand` node (Blast ring 6, 22.2k glass) becomes buyable at **Wipe Day
  #25**; buying it adds the switch to the Big Red's card. **Off by default** (owner decision 14).
- **Setting:** presets fire at **25%, 50%, 100% (default) or 200%** of glass ever, or "when
  crowned" (`03` 2.2; errata E12), stored in `meta.prefs.deadHand = {on, at, stoppedRun}` through `set_loadout` (resolution
  3.15).
- **Firing:** the client sends the ordinary `nuke` command when the yield reaches the setting; the
  server checks it like any nuke and never fires one itself.
- **Safety rules:**
  1. Only in a visible, focused tab; never offline, never from Discord.
  2. Only a counted nuke (≥ 10% of glass ever, N22): a Wipe Day, never a small blast.
  3. Never during welcome back, a flotsam buff, Rush, Afterglow's first 5 minutes or a floating
     flotsam, nor during a Dare with its goal unmet.
  4. Never in the first 60 s after the page opens, so a returning player can switch it off.
  5. A 5-second toast first: "Dead Hand: launching in 5 · +2.1k glass · **Stop**". Stop sends
     `set_loadout` with `stoppedRun` set to this run; the Big Red's card re-arms it.
  6. Two tabs: only the focused one runs it; a late `nuke` from the other is refused as stale,
     silently.
- **A postcard toast instead of the cinematic:** a 300 ms thump, the short landing, then a toast
  that stays until dismissed: "Dead Hand pressed the Big Red. Wipe Day #31: +4.1k glass · Glow
  ×17.2 → ×18.4 · **See postcard**". The rebuild screen follows when it offers a choice; Autopilot
  (Blast ring 8, R7) skips it with the last loadout. No Dare starts by itself; glass waits on the
  Blast Map.
- **News:** the `nuked` event carries `by: "dead_hand"`: "Patrik's Dead Hand pressed the Big Red."
  Blowback applies as usual.

---

## 7. The Toolbelt (R5)

| Skill (id) | Effect | Effect clock | Cooldown (game clock) | Unlock | At a nuke |
| --- | --- | --- | --- | --- | --- |
| Rush (`rush`) | taps ×5 for 30 s | real seconds | 10 min | Wipe Day #4 | effect lost |
| Grit (`grit`) | all lines ×1.05 for the rest of the run, stacking to 10 (×1.63) | the run | 8 h | #8 | stacks lost |
| Flare (`flare`) | calls one flotsam now, 13 s float | real seconds | 60 min | #15 | — |

- **Two clocks** (canon 12.3): effects that ask for attention run on real seconds and never speed
  up with the demo clock; cooldowns are idle timers on the game clock and keep running through
  nukes. In production both are the system clock. Cooldowns live in `meta.toolbelt`; effects are run
  buffs; the command is `use_tool {tool, kind?}`.
- **Rush** is ×5, not canon's ×10 (resolution 1.6, for N9); it stacks with Hustle, Afterglow, Rally
  and Adrenaline. **Grit** is a run-scoped `more` on all lines, so it lifts the Night Shift too: the
  casual's check-in ritual (08:00 and 21:00 give ×1.10-1.16 per day-long run).
- **Flare** (resolution 3.11): granted by the agenda at Wipe Day #15; it calls one flotsam with the
  normal weights from `rng(seed, "flare", n)`, checked like any arrival. The `flare_gun` node (Tide
  ring 6, gate 15, 33.3k glass, R5) lets the player choose crate, drum or kit (`kind`), never the
  Sealed Locker, Bottle or Drone, so a chosen Flare is never a scrap source. The button wears the
  chosen kind's badge; its long-press sheet changes it.
- **Automation nodes** send the ordinary `use_tool` from a visible tab: `hair_trigger` (Grip ring
  6, Rush when Hustle fills) and `wake_up_call` (Bunker ring 5, Grit at the first visit after it is
  ready) in R5; `auto_flare` (Tide ring 8) in R7.
- **Placement:** at most **three round 48 px buttons, ever**, stacked on the right above the drawer,
  16 px from the edge, 8 px apart, in unlock order from the bottom. Desktop: the right edge of the
  scene, beside the 420 px column. Never over the target or the sea lane; no node or creed adds a
  fourth.
- **States:** cooling, a ring filling with the time inside ("9m", "7h", 12 px bold); ready, full
  colour with a soft glow every 4 s; active, an orange arc draining. Grit shows "3/10". A long press
  opens the skill's sheet.
- **Advisor** ("a ready Toolbelt skill", canon 12.5): Grit whenever ready; Rush only while a buff,
  Afterglow or full Hustle runs; Flare only when nothing floats. A crowned skill takes the view's
  one crown, so the collapsed drawer shows no orange row (resolution 3.25).
- Hints: "Rush: taps ×5 for 30 s." "Grit lasts the whole run, even overnight." "Flare: call in
  flotsam now."
- Effect stats for `04b`, with the skill scope (resolution 3.12): `rush_mult` (5), `rush_seconds`
  (30), `rush_cooldown`, `grit_step`, `grit_cap`, `grit_cooldown`, `flare_cooldown`.

---

## 8. Dares (R7)

### 8.1 Rules

- **Opt-in** from Wipe Day #5, one per run, picked only on the rebuild screen (`start_dare`, `03`
  9.1), with **constraint, goal and reward shown in full** and "Abandon any time, free."
- **In the run:** a slim Dare bar under the top bar ("Long Night · Stone → Sheet Metal · 4.1B /
  20B"); a tap opens its sheet with **Abandon** (`abandon_dare`; secondary, one confirm line:
  "Abandon Long Night? The run goes on as normal, with no reward.").
- **Goal met:** the bar fills, a toast says "Dare done: the reward lands with your next Wipe Day",
  and the **constraint lifts**.
- **A Dare run ends only by a nuke.** That nuke grants a met goal's **permanent effect and Logbook
  page**, on the postcard ("Dare done: Long Night. Night Shift window +4 h, forever."). An unmet
  goal ends unfinished, free, and the cover card says so (`03`). Rich Tides' and Speed Wipe's goals
  are the nuke itself.
- **Timed goals** use run time on the game clock; a miss says "Missed: Stone took 17 min. The run
  goes on as normal" and lifts the constraint.
- **Rewards:** at most +25% on one stat, a different stat per Dare, once only, kept through a
  Crossing (resolution 3.24). A finished Dare can be retaken for fun ("Done · no reward again").
  Dares add no glass (canon 5.1). Rewards never raise what N9 binds (steady tap value, Hustle's
  top, flotsam frequency or payout, Rush; resolution 1.5), so Rich Tides and Storm Season reward
  differently from canon 7.7.
- Constraints are effects with `when: "dare:<id>"` (canon 13.5); the Foreman, Pockets and keystones
  obey them, and Dead Hand waits for the goal.
- **Difficulty** *(sim)*: taken at Wipe Day #5-10, a casual finishes each in one run, an active
  player in 1-3 hours.

### 8.2 The launch four (season-modifier ids reused)

| Dare (id) | Constraint | Goal (the bar) | Reward |
| --- | --- | --- | --- |
| Long Night (`long_nights`) | No Night Shift: lines stop while you are away. Flotsam ×2 as often. | Reach Sheet Metal (era steps, then supplies toward the next era) | Night Shift window +4 h, within the 48 h ceiling (errata E10) |
| Rich Tides (`rich_tides`) | Lines ×0.25. Flotsam ×4 as often. | A counted nuke: yield ≥ 10% of glass ever (`+8 / +12 glass`) | Flotsam floats 25% longer (13 → 16 s) |
| Storm Season (`storm_season`) | Hustle drains ×3. Taps ×3. | Reach Stone within 15 min (bar plus countdown) | Hustle drains 25% slower (10 → 7.5 a second), inside the ×2.25 Hustle ceiling, c ≤ 0.6 (errata E22) |
| Quiet Hands (`quiet_raiders`) | No taps after minute 5: the target greys out, "Hands off". | Reach Stone | Offline output +10% |

The locale today says "Long Nights" and "Quiet Raiders"; the naming pass picks the final names.

### 8.3 Eight more, for later (up to 12)

| Dare (id, proposal) | Constraint | Goal | Reward |
| --- | --- | --- | --- |
| Bare Hands (`bare_hands`) | No Grip rungs (pocketed ones sleep) | Reach Stone | Grip rungs cost 25% less |
| Thirteen (`thirteen`) | At most 13 of each line | Reach Sheet Metal | The 10-owned milestone ×2 → ×2.5 |
| Speed Wipe (`speed_wipe`) | The clock | A counted nuke within 30 min of the run's start | Afterglow ×3 → ×3.75 |
| Twig Only (`twig_only`) | No eras: lines 1-3, the Lone Pine all run | 100 of each Twig line | Eras cost 20% less |
| Skeleton Crew (`skeleton_crew`) | At most 3 hands working, kept ones included | Reach Sheet Metal | Hands cost 20% less |
| Dead Calm (`dead_calm`) | No flotsam; Flare off | A counted nuke | The Magnet's early haul 50% → 62% |
| No Frills (`no_frills`) | No shelf upgrades (pocketed ones sleep) | Reach Sheet Metal | Line Mk and island upgrades cost 20% less |
| Empty Belt (`empty_belt`) | Toolbelt off | Reach Armored | Grit's cooldown −20% (8 → 6.4 h) |

Twelve rewards, twelve stats. Price-cut rewards count toward the caps on shelf and era price cuts
(×0.25 per shelf kind, ×0.5 for eras; errata E25). A constraint needing new code (Quiet Hands' timed lock, Thirteen's
cap) is an unlock budgeted in its phase. Dead Calm's early haul stays below a Sure haul's 1.15
expected scrap, so waiting still pays more and N19 does not move.

---

## 9. Creeds (deferred)

**Status:** not built; at most three, only if runs feel samey (canon 1.3, owner decision 13).

**The trigger**, checked at a playtest after R7; two of three must hold: (1) at least half the
active friends say run 30 plays like run 10; (2) over 14 days of live data, at least 80% of runs
past Wipe Day #20 keep the previous keystone loadout and start no Dare; (3) for players past #20,
the median session stays under 3 minutes for two weeks while runs are not getting shorter.

Shared rules: picked on the rebuild screen like a Dare, "no creed" the default; a creed changes
**what you tap or wait for, one Toolbelt button (swapped, never a fourth) and the scene**; nothing
buys inside settle; the simulator must find a different best archetype per creed, none beating
another by more than 25% glass a day at days 14 and 30. 3-4 sessions each.

- **Scrappers** (`scrappers`, proposal). Verb: **smash**. The era target becomes a heap of junk
  that grows with the era (a car, a boat hull, the Wreck), junk piles stand by every line and a crane
  looms over a beached hulk. Taps ×3, Hustle drains half as fast, and one tap in 20 is a seeded
  Wreck Swing worth ×25; lines ×0.85 and hands cost ×2. Rush becomes **Rampage**: for 20 s every
  credited tap pays three times, inside the same 15/s bucket. For the active player.
- **Bunker Folk** (`bunker_folk`, proposal). Verb: **wait**. Hatches in the slope, a periscope, vent
  steam, crew asleep in bunks. Manned lines gain **Quiet**, +2% per minute without a tap up to +100%
  (a capped ramp settle integrates in closed form; any tap resets it); Night Shift window +12 h,
  still capped at 48 h, and offline ×1.25; taps ×0.5 and flotsam half as often. Grit becomes
  **Lockdown**: seal for 1-8 h, lines ×2, no taps or flotsam, ending early if you tap the hatch.
  For casuals and idlers.
- **Tinkers** (`tinkers`, proposal). Verb: **wire**. Cables between buildings, rattling conveyors,
  buzzing drones. One drone per 25 line units owned; a drone wired to a line (tap it) makes it ×2
  and, while the page is open, buys that line's best chunk every 10 s (a per-line Foreman, online
  only); taps ×0.5, hands cost ×0.5. Flare becomes **Overclock**: wired lines ×5 for 45 s, then idle
  15 s. For players who like setting things up.

---

## 10. The late game: the Crossing and the wall

### 10.1 These layers through a Crossing (`03-the-big-red.md` 14)

- **Kept** (resolution 3.24): Logbook pages, scrap, ranks, Pocket slots, Dare rewards, the Wipe Day
  count and agenda unlocks (so the Magnet, Rush, Grit, Flare and the Foreman stay), cosmetics.
- **How they carry over:** Morale keeps its pages but falls back to 0.02 a page until the Logbook
  nodes are bought again. A hand keeps its rank and runs the line of the same rung on the new
  island. A bought Pocket slot never needs its node again; an upgrade the new island lacks leaves
  its slot empty, refillable at once.
- **Reset with the Blast Map:** the winches, Dead Hand's and the Flare Gun's nodes (their gates are
  met, so they can be bought again), and, under option 2, the crater's depth.

### 10.2 The wall, and the owner's choice before R7

Under P1 the casual player's runs stretch from a day (month 1) to 4-5 days (months 2-6) and 10-14
days later, and the tree is 57% lit at day 365 (`10-balance.md` section 5). Anything that shortens
runs through activity splits the group. The owner chooses before R7 (resolution 3.24):

1. **Option 1, recommended:** a slow outer tree as in P1, with the Crossing's trigger lowered to
   "45% lit and N13 firing", so the second layer arrives in months 4-6 as the release valve.
2. **Option 2:** a late power source that grows with calendar time, the same for every player of
   the same age. Sketched below and simulated with the group before R7.

### 10.3 Option 2: the deepening crater (ready to simulate)

**Rules** *(proposal; numbers sim)*:

- **Depth** `D` = island days since `meta.craterFrom`, never below 0. `craterFrom` is the later of
  90 days after the player's first Wipe Day and R7's deploy, so no live player gets a sudden jump
  and the crater leaves every day-30 and day-90 number as P1. The ground settles a metre a day
  whether you play or not; absence never costs depth.
- **Effect:** `Crater = 1.03^D`, a derived multiplier folded with Glow and Morale (after Πmore,
  before buffs), on lines and the flat part of a tap, so the tap share and N9 do not move. It joins
  the flat tap's global fold (eras, island upgrades, roster, Grit, Glow, Morale; errata E23).
- **Fair:** no tap, command or choice changes it. A late joiner trails by their start offset, which
  the fifth root shrinks (30 days behind is ×2.4 output but about ×1.25 glass).
- **Settle:** `D` changes at island-day boundaries (the UTC offset in `island.json5`: UTC+1, no daylight saving; errata E9); settle splits
  there, one more split point beside the Night Shift's end and buff ends, so it stays closed-form
  (at most three boundaries in a 48 h window; N24's property tests include one).
- **Shown** on the Multipliers sheet ("Crater 41 m: ×3.36 · +3% a day") and the postcard's back,
  with one "New on Saltmarsh" line when it first deepens: "The crater has started to settle: a
  metre a day, and every line +3% with it." No push, no crown.
- **Data:** `prestige.json5` `crater: {perDay: 0.03, afterDays: 90}`; one field,
  `meta.craterFrom`, reset at a Crossing (a new island, a new crater).

**First reading.** A 20-line in-memory variant of `wipe_model.py` (P1 otherwise; 365 days; seeds 7,
11 and 23 unless marked; no group simulation). Gaps are glass ever against the casual player.

| Variant | Casual median run, days 30-180 / 180-365 | Casual tree lit, day 180 / 365 | Gaps at day 180: active / optimal / idler on the crown | Gaps at day 365 | Largest number |
| --- | --- | --- | --- | --- | --- |
| P1 (no crater; rings 6-9 ×1,000) | 4.3-5.1 / 11.5-13.9 d | 47 / 57% | 1.09-1.24 / 1.33-1.49 / 0.63-0.71 | 1.44-1.64 / 1.72-1.92 / 0.35-0.40 | 6e38 |
| **Crater 3% a day from day 90; rings 6-9 ×100** | 4.5-4.8 / 4.4-4.8 d | 50-52 / 74% | 1.24-1.36 / 1.47-1.78 / 0.58-0.77 | 1.03-1.10 / 1.05-1.19 / 0.86-0.90 | 1.2e44 |
| Crater 3% from day 60; rings ×100 | 3.5 / 5.0-5.3 d | 56-57 / 76% | 1.38-1.61 / 1.55-1.90 / 0.44-0.59 | 1.01-1.07 / 1.09-1.17 / 0.89-0.94 | 6e44 |
| Crater 3% from day 60; rings ×1,000 (seed 11) | 2.5 / 2.0 d | 63 / 100% | 1.94 / 3.98 / 0.48 | 0.98 / 1.04 / 0.89 | 2e55 |

The calendar source shortens late runs and pulls the group together by day 365, but **only with
weaker outer rings**: on P1's ×1,000 rings the loop runs away mid-year. Starting at day 90 leaves
months 1-3 untouched; day 60 shortens runs sooner but widens the day-180 gaps. An idler who presses
only at doubling falls far behind after day 180 in every variant (P1: 0.19 at day 365; with the
crater 0.04), because glass arrives only at a press; following the crown it stays at 0.86-0.90.

**To simulate before R7** (`10-balance.md` 7, the `full` profile with the group): add `crater =
(perDay, afterDays)` to the model and simulator v2 (`D` from the first Wipe Day, folded with Glow
and Morale, re-read at every session start after the offline settle and at every new run). Grid:
perDay 2-5%; afterDays 60, 90, 120; outer rings ×30, ×100, ×300, on rings 6-9 or only 7-9 (ring 6
ships in R3 at ×1,000; retuning it means a free respec, canon 6.5); the idler on both rules; Late
Tide on and off. Pass: N16's bands at days 30 and 90 (asserted in the group of five with Late Tide)
and 180 and 365 (warned, except the idler following the crown, whose late gaps are asserted; solo
gaps and the doubling idler are warnings; errata E11); casual
runs after day 30 ≤ 3 days (canon 5.7, warned); casual ≥ 45% lit at day 180; the full tree not
before day 180; N13; N23 over 365 days. Compare with option 1 on the same seeds.

---

## 11. Fit to the curve, and phases

### 11.1 What each layer adds (planning values for `10-balance.md`; casual, all phases shipped)

| Layer | Day 7 | Day 30 | Day 90 | Targets |
| --- | --- | --- | --- | --- |
| Morale | ×3.0 (100 pages) | ×4-5 (150) | ×5-7 (190) | N12, N16, N17 |
| Crew ranks (on the earning lines) | ×2 | ×2-4 | ×8 (×16-32 by day 180) | N12, N13 |
| Grit | ×1.05-1.16 per run | same | same | N9 |
| Pockets | 1 slot | 1-2 | 3 | N11 (shorter run openings) |
| Dares (from R7) | — | ×1.1-1.3 | ×1.3-1.6 | N12 |
| Rush, Flare | active only | | | N8, N9 |
| Foreman, Dead Hand | no power; time saved | | | N7 |
| Crater (option 2) | ×1 | ×1 | ×1, then ×1.03 a day | 10.3 |
| Scrap earned | 12 | about 49 | about 150 | N19 |

Morale, ranks and (under option 2) the crater grow with **real days**, not Wipe Days, so they keep
a casual's late nukes growing when rings stop opening (N13). The Magnet is the same for every
archetype, so the idler is never far behind on scrap (N16).

### 11.2 Phases (acceptance criteria in `11-roadmap.md`)

| Phase | From this file |
| --- | --- |
| R1-R2 | Lifetime counters (1.3) in `meta.stats` and the flights-seen list for R4's backfill; `meta.scrap` records the first Wipe Day's 3 (R2) |
| R4 Logbook (2 sessions) | 120 pages (`05b`), the detection function, `pokes` on the taps batch, Morale, secrets and hints, Old Maps, first finds, the Odds page, the Drowned Drone and the Bottle, the R4 Logbook nodes, 1 scrap per 25 pages recorded |
| R5 (3 sessions) | 1: the Magnet, scrap chip and card, ranks rising together, Pockets, the Sealed Locker. 2: the Toolbelt and the Flare Gun. 3: the Foreman with its reserve, Dead Hand, `set_loadout`'s standing orders. Scrapyard nodes; R5's pages |
| R6 | Freighter scrap; Friends pages |
| R7 | The four Dares and their pages; ring 7-9 pages and nodes (winches, Morale, `rank_mult`); option 2 if chosen |
| Later | Eight more Dares; creeds only if section 9's trigger fires |

Data: `logbook.json5`, `magnet.json5` (the Magnet, rank and Pocket prices), `toolbelt.json5`
(skills, and the Foreman's and Dead Hand's constants) and `dares.json5` (from `seasons.json5`'s
modifier ids), per canon 13.8, plus option 2's `crater` block in `prestige.json5`;
`09-architecture.md` fixes the schemas.

---

## Open questions

1. **The late-wall choice** (owner, before R7; resolution 3.24). If option 2 is chosen, two things
   follow outside this file: `10-balance.md` 6.1's outer rings drop from ×1,000 to about ×100 each,
   and `03`'s crater depth (√ of the Wipe Days, cosmetic) becomes this depth, so the island shows
   one number. Both wait for the group simulation in 10.3.

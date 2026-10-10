# The Wipe Day redesign: start here

**Status:** approved. The plan is dated 2026-10-08; the owner made every decision in section 3
on 2026-10-10 (all defaults except season 1, decision 7), and R0 committed it on the `redesign`
branch, rewrote `CLAUDE.md`, `docs/game-design.md` and `docs/roadmap.md` from it and logged
decisions from D127. Those are the spec now; these files are the detail behind them. Until the
cut-over the live game is W8 on frozen `main`, and season 1 sits untouched on it. Names marked *(proposal)* wait for the owner's
naming pass. Numbers come from the tuned balance model P1 (`10-balance.md`), which the simulator
will own; they are starting values, not promises. A *session* is one working block by the coding
agent, a few hours long; the calendar assumes 3-4 a week. **Decision 0 is settled: one currency,
Supplies.**

---

## 1. The plan in one paragraph

Wipe Day becomes an incremental idle game. You wash up on Saltmarsh *(proposal)* with nothing and
tap a tree for **Supplies**, the one run currency (the owner's choice; decision 0). Supplies
buy 14 production lines, from Beachcomber to Reactor, each dearer than the last. A line works
only while you tap, until you hire its worker (a **hand**); then it runs forever, also while you
are away, up to the **Night Shift** limit (12 h, rising to 48 h). When you choose, you press
**the Big Red** and nuke your own island. The blast pays **Crater Glass**: glass you ever earned
boosts everything (**Glow**), and glass you hold buys nodes on the **Blast Map**, a 361-node
permanent tree. Every run is faster than the last. Monthly seasons, crafting, storage caps, the market,
the casino, raids and PvP go; scrap stays, but rare. Friends meet through nuke news, a weekly
co-op and visible catch-up, never by trading or stealing. The build is eight phases, R0-R7, about
26 sessions; friends play at the end of R2, about session 12. (`01-vision.md` 3 and 7.)

---

## 2. The brief, answered

The owner's brief is quoted in full in `working/vision/resolutions.md` section 0 and
`01-vision.md` 1.1. `01-vision.md` 1.2 answers it in 15 rows; the short version:

| The owner's words | The answer | Detail |
| --- | --- | --- |
| "I dont like now the process" | Agreed. Today is a check-in game: about 62 purchases a season against 84 check-ins, caps as the real wall, timers up to 24 h. The plan replaces the process and keeps the engine. | `01` 2; `07` |
| "Whole game should be idle game, automatization" | Yes. 14 lines; each starts manual and runs forever once a hand is hired, at 100% while away inside the Night Shift. Then bulk buying, hands kept through nukes, the Foreman (auto-buy) and Dead Hand (auto-nuke, opt-in). | `02` 2, 3, 9, 10; `05` 5, 6 |
| "MASSIVE tree where ppl will spend their 'ascending points'" | **The Blast Map** *(proposal)*: 361 permanent nodes, 8 sectors × 9 rings around Ground Zero, shipped in waves (73 in R2, 201 by R5, 361 in R7). Nobody can finish it before day 90 (a simulator check); the optimal player owns 37% at day 30. | `04`; catalog `04b` |
| "(we can call them another way)" | **Crater Glass** *(proposal)*, the sand your blast fuses. Each nuke pays glass that grows slowly with everything you ever made (10 glass needs about 50 billion supplies); glass you ever earned boosts everything, and spending it never takes that boost away. | `03` 1; `07` 2.4; `10` |
| "more flexible" / "want to play game more and more" | Tap hard or idle, nuke when you choose, grow any of 8 sectors, keystones, Pockets (slots that keep chosen upgrades through a nuke), Dares (optional challenge runs). Always something to buy, every run faster, a new unlock every few Wipe Days, nothing lost while away. | `01` 1.2 rows 5-6; `02`; `05` |
| "starting from nearly nothing clicking like crazy to get things moving and automated" | A beach, one glowing pine, "Tap the tree." Taps and the lines they drive make over half of run 1's first minute (55% in the model); the first hand comes at about 0:41; the first nuke at about 46-48 minutes for an active player, at the day-1 21:00 check-in for a casual one. Gather's cooldown and the daily haul go. | `01` 4.1-4.3; `02` 7 |
| "push 'weirdly looking red button' … fire nuclear missile … funny" | **The Big Red** *(proposal)*: a red dome on an oil drum under a hazard-taped toilet-seat lid, next to the Kettle (a boiler on stilts with a traffic-cone nose). Hold 2 s, a 6-8 s cinematic, a postcard from Ground Zero, crew one-liners and flight variants. The only reset, and you choose when. | `03` 3-9 |
| "rework Scrap to make it more RARE" | **Yes.** Scrap leaves the run: the Magnet hauls about one a day, a few other sources add a little, nobody earns over 2.5 a day. It buys crew ranks (×2 to a line, forever) and Pocket slots; never traded, gambled or at risk. | `07` 2.3; `05` 2-4 |
| "or we can add something else, like blueprint fragmets" | **Something else, under our own name.** Blueprint Fragments is a real Rust item, and the game uses no other game's names (D43); and "blueprint" promises crafting, which is cut. Its job goes to Crater Glass; **Pockets** keep chosen upgrades through a nuke. | `07` 2.4; `05` 4 |
| "If you think its good idea to remove seasons" | **Yes, as a reset.** The monthly wipe and the chosen nuke compete for one emotion, and a calendar reset punishes whoever joins late. One season row stays forever, "month" survives as a board window, the four modifiers become Dares. Season 1 runs untouched on the old build until R2, then ends quietly (decision 7). | `07` 2.1; `01` 1.3 |
| "or other stuff let me know" | **Yes, most of W3-W7.** Removed: Gather and its cooldown, the daily haul, build timers, upkeep and decay, storage caps, 22 of 23 stocked resources, crafting, blueprints, items, daily tasks, the Den, contracts, market, casino, NPC raids, defence, PvP, monthly seasons, the Signal, the 25% legacy cap. Parked in git: expeditions and the map. Kept: the engine, the scene, the UX rules, ops, the Discord companion. | `07` 2.2, 3; `01` 1.3 |
| "Take inspiration from … Cookie clicker, Melvor Idle, Melvor Idle 2, AdVenture Capitalist, Clicker Heroes, Realm Grinder, Egg, Inc." | AdVenture Capitalist gives the run (lines, hands, milestones); Cookie Clicker the bursts (flotsam: bonuses that wash up for a few seconds) and the prestige shape; Clicker Heroes the Toolbelt and the second layer (the Crossing, a later reset above the nuke); Realm Grinder the agenda and Dares; Egg, Inc. hold-to-work, Hustle (a bonus for tapping fast) and co-op (the Freighter); Melvor full-rate offline and automation as upgrades. Each row also lists what was left out on purpose. | `01` 1.4; `working/research/ref-*` |
| "postapocaliptic world and game called RUST" | In mechanics and mood, never names: the tool ladder (Grip), five tiers re-climbed every run, gathering targets, scrap as the precious currency, jank engineering, the wipe as a ritual. | `01` 3 |
| "dont code the game, just full planning" | No code or repository doc changed. Phases, acceptance criteria and kickoff prompts are in `11-roadmap.md`. | `11` |
| "Currently i work on svg icons to fill" | What to draw now (scrap first), what is new for R1, what to stop drawing, and the file format. | `01` 1.5; `07` 8 |

---

## 3. Owner decisions

From `07-what-changes.md` 10 (canon section 18), with errata v3 applied. "When" is when the
decision is needed, from `11-roadmap.md` 8. **The owner decided all 22 on 2026-10-10** (last
column): every default except season 1 (decision 7: it ends quietly, with no ceremony required),
plus two refinements (the gift goes to every season 1 base; eras lean to the Rust grades).
Three are recorded as leanings and confirmed later in their phase: names (passes in R1, R2, R4),
hand traits (R5) and the late wall (before R7).

**Decision 0 came first, and it was a real trade; the owner chose one currency.** The plan recommended one run currency,
Supplies: one number on a phone screen, a loop you understand in seconds without a tutorial, and
a game that is simpler to build and easier to keep fair. The honest cost is the Rust feeling of
several stockpiles and "I need 2k more stone". Product badges recover part of it: each line shows
a little icon of what it makes (planks, stone), but you never stock or spend them. The fallback,
four materials (`timber`, `stone`, `ingots`, `plates`) needed only to unlock the next age of
buildings, adds a second counter and about 1.5 sessions, so friends would start about half a
week later (session 14 instead of 12; `07` 1).

| # | Decision | Default | If you choose otherwise | When | Owner's choice (2026-10-10) |
| --- | --- | --- | --- | --- | --- |
| 0 | Run currency | One currency with product badges | Era materials: about +1.5 sessions, a second counter, a material model in the simulator | Before R0 | **One currency, Supplies, with product badges** (default) |
| 1 | Names | `07` 7 *(proposal)*, including "Starter Kit" (`packed_crate`; the id stays) on the list (errata E27) | A locale edit; ids and icons untouched | Pass 1 in R1, pass 2 in R2, pass 3 in R4 | **Default passes** (R1, R2, R4). Eras: lean to keeping the five Rust grades; rename Starter Kit in R1 |
| 2 | Island | Saltmarsh; its clock UTC+1, no daylight saving (errata E9) | Locale only (nuke news, postcard, Island Count); the clock is one value in `island.json5` | R1 | **Saltmarsh, UTC+1, no daylight saving** (default) |
| 3 | The lid | Toilet-seat lid | The jam jar: art only | R2 | **Toilet-seat lid** (default) |
| 4 | Seasons as a reset | Remove; month as a board window | A monthly wipe takes the Blast Map (meant to last months) or only the run (pointless); reset code to maintain | Before R0 | **Remove**; month as a board window (default) |
| 5 | Cut list | Accept all | Each kept system needs a scale-free redesign; casino, PvP and stock-taking raids break the rules "absence never hurts" and "precious things never at risk" | Before R0 | **Accept all** (default) |
| 6 | Expeditions | Parked until the R6 playtest | A sea layer earlier: 3-4 sessions and a second time scale before the core loop is proven | R6 (playtest 4) | **Parked until the R6 playtest** (default) |
| 7 | Season 1 | Keeps running until the new game is ready (end of R2, about early-to-mid November), then ends with a ceremony; you post one prepared message in Discord by hand (`07` 9.3; the steps are in `11` 4) | Ending on the old date (about 2026-11-04) means season 2 on a frozen build, or no game until R2 | Before R0 | **Changed:** nobody plays season 1 now, so it runs untouched (no announcement, no season 2, no work on `main` beyond R0's backup) and ends quietly at the cut-over with one `pnpm season end`, archived in the Hall as "the old world". The Discord message is optional, and the cut-over is no longer timed to season 1's old end date |
| 8 | Founders' gift | Founder skin plus 5 glass, held only | More glass skews Late Tide (a catch-up boost for whoever falls behind) and the checks that friends stay close; a skin alone gives no power | R2 | **Founder skin plus 5 glass, held only** (default), for everyone with a season 1 base |
| 9 | How fast nukes pay off | Slow and steady: the tree takes months (the formula is in `10` 1) | Faster: in the model the first nuke came at 22 min and the whole tree was lit by day 12, leaving nothing to chase | Before R0 | **Slow and steady** (default): fifth root of lifetime (`L0` 5e5), √ Glow |
| 10 | Offline | 100% inside 12 h, up to 48 h | Lower rates punish the casual night; no limit removes the reason to check in | Before R0 | **100% inside the Night Shift, 12 h rising to 48 h** (default) |
| 11 | Primary colour | Signal orange, with the contrast fixes in R1 | Today's red blurs the Big Red, which must never look advised | Before R0 | **Signal orange**, with the contrast fixes in R1 (default) |
| 12 | Toolbelt | Three skills, R5 | Fewer loses Grit, the casual ritual; more crowds 390 px | R5 | **Three skills** (Rush, Grit, Flare), R5, never a fourth (default) |
| 13 | Creeds | Deferred, at most 3 | Now: 3-4 sessions and a far larger balance surface | R6 (playtest 4) | **Deferred**, at most 3, only if the post-R7 trigger fires (default) |
| 14 | Dead Hand | Opt-in, online; presets 25 / 50 / 100 / 200% of glass ever, or "when crowned" (errata E12) | Offline auto-nukes need buying inside settle and skip the show | R5 | **Opt-in, online**, presets and safety rules as written (default) |
| 15 | Sound | Procedural WebAudio, R1 | Silence until you supply your own sounds | R1 | **Procedural WebAudio, R1** (default) |
| 16 | Freighter rewards | 1 scrap per tier per loader; pennant at III | More scrap breaks the cap of 2.5 scrap a day | R6 | **1 scrap per tier per loader; pennant at III** (default) |
| 17 | Visit | R6 stretch | Cut, or earlier as a read-only route before the core loop | R6 | **R6 stretch** (default) |
| 18 | Nuke from Discord | No (the bot may only Collect) | A chat card holds a destructive action and the cinematic is lost | R2 | **No**: web only; the bot may Collect and link to the Big Red (default) |
| 19 | Hand traits | One-line perks or cut, decided in R5 | Full traits bring back per-hand stats to balance | R5 | **Decide in R5**, leaning to one-line perks (default) |
| 20 | Notation | 1.2M, 3.4B … up to 1.2Dc (decillion, 10^33), then 1.2e36; a setting switches to e-notation | Scientific only reads as homework early; suffixes past Dc stop being readable | Before R0 | **Suffixes to Dc, then scientific, with a toggle** (default) |
| 21 | The late wall | Option 1: a slow outer tree, the Crossing's trigger lowered to "45% lit and nukes no longer feel faster"; option 2 (a calendar-fair power source such as the deepening crater) designed and simulated as the alternative | Option 3, stronger outer rings carried by Late Tide, splits the group (`10` 5) | Before R7, from R6's simulations | **Default approach**: option 1 as the working plan, option 2 designed and simulated alongside; the final option is chosen before R7 from R6's simulations and playtest |

Also before R0, not a design choice: say yes to encrypted backups of the game in your Google
Drive (you log in once), and keep the password we give you somewhere safe (`11` 2, R0 S1).

---

## 4. Reading order

### 4.1 The owner, deciding (short path)

1. **This README.**
2. **`07-what-changes.md`**: the big decision (1), the direct answers (2), the decision table (10)
   and what happens to the live game and season 1 (9).
3. **`01-vision.md`**: the brief answered (1), the first ten minutes to month three (4), three
   friends in a week (5), the plan on one page (7).
4. **`08-screens.md`**: what it looks like at 390 px.

Then, as interest allows, `03-the-big-red.md` (the nuke) and `11-roadmap.md` 5 and 8 (calendar
and to-do list).

*The owner can stop reading here and skip to section 5; 4.2-4.4 are for the builder.*

### 4.2 An agent building R0 and later

Read `CLAUDE.md`, this README, then `11-roadmap.md` (the phase's section, the common contract in
1.3, the kickoff prompt and per-phase file list in 6.1). R0 reads `07`, `09` and `10`; each later
phase reads the files its 6.1 row lists. Once R0 lands, the rewritten `CLAUDE.md`,
`docs/game-design.md`, `docs/roadmap.md` and decisions from D127 are the spec; these files stay as
the detail behind them, and `09-architecture.md` stays the engineering spec.

### 4.3 What each file holds

| File | What it holds |
| --- | --- |
| `01-vision.md` | Why change (ten problems with evidence), the pitch and five pillars, the experience from minute one to month three, three friends, the build plan and decisions on one page |
| `02-the-run.md` | One island's life: the resource model and product badges, the 14 lines, manned and unmanned lines, milestones, the shelf, eras and targets, the tap, flotsam, hands, the Night Shift, the advisor's first 20 hints, data files |
| `03-the-big-red.md` | The nuke: the glass formula, when to press, the Kettle, the cover card, hold to launch, the cinematic, the postcard, the rebuild, Afterglow, kept and lost, the agenda, the Crossing hook |
| `04-blast-map.md` | The tree's design: structure, node types, costs, effect vocabulary, respec, the eight sector briefs, the power budget split by sector, the UI, `blastmap.json5` |
| `04b-blast-map-catalog.md` + `04b-blast-map.json` | All 361 nodes, generated from the JSON (0 errors, 7 warnings); the JSON is one array, `ground_zero` first. Do not edit the `.md` by hand |
| `05-meta-layers.md` | What you keep beside the tree: Logbook and Morale, scrap and the Magnet, crew ranks, Pockets, the Foreman, Dead Hand, the Toolbelt, Dares, creeds (deferred), the late game |
| `05b-logbook-catalog.md` + `05b-logbook.json` | The Logbook's 120 launch pages (R4, 30 secrets) and 130 later pages for R5-R7; the JSON is `{"launch": [...], "later": [...]}` |
| `06-friends.md` | The social layer: nuke news, Blowback, the Island Count, the Freighter, Late Tide, boards, Visit, shared first finds, the Discord companion v2, notifications, toxicity checks |
| `07-what-changes.md` | The big decision, the direct answers, every system's disposition, decisions overturned and new (from D127), the `CLAUDE.md` rewrite, guardrails, names, icons, the live game and cut-over, the decision table |
| `08-screens.md` | The UX and visual spec: layout, every screen and overlay, visual language, juice, sound, motion and accessibility, onboarding, the `SHOTS` review plan |
| `09-architecture.md` | The engineering spec: numbers (`Amount`), state, settle, the effects evaluator, commands, events, content, API and DB, web, bot, the deletion plan, the cut-over runbook, testing, ops |
| `10-balance.md` | The numerical model: P1 constants, results per archetype and in a group of five, the late wall, the authoritative Blast Map power budget, simulator v2, tuning levers |
| `11-roadmap.md` | Phases R0-R7 with goals, sessions, acceptance criteria, branches and the cut-over, the calendar, kickoff prompts, risks, the owner's to-do list |
| `working/` | How the plan was made (below). Not needed to decide or to build |

### 4.4 `working/`

| Path | What it holds |
| --- | --- |
| `working/research/` | Five surveys of the code at `58533e4` (`code-api`, `code-domain`, `code-economy`, `code-meta`, `code-web`) and four reference studies (`ref-cookie-adcap`, `ref-clickerheroes-realmgrinder`, `ref-egginc-melvor`, `ref-patterns`) |
| `working/vision/` | Proposals A (Wasteland Clicker), B (Salvage Factory), C (Creeds & Doctrines) and D (Evolution, not revolution); `canon.md`, the design director's synthesis; `amendments.md` (A1-A6); `resolutions.md` (canon v2, with the owner's brief in section 0); `errata-v3.md` (E1-E28) |
| `working/catalog-sectors/` | The eight sector files the Blast Map catalog is built from (`04b-<sector>.json` and `.md` notes: grip, crew, works, tide, bunker, blast, logbook, scrapyard) |
| `working/model/` | The Python balance model and its outputs in `out/` |
| `working/_sections_summary.txt` | The section writers' reports on the first drafts of 01-11 (superseded by the files themselves) |

**Authority order** when files disagree: `errata-v3.md` wins over `resolutions.md`, which wins over
`amendments.md`, which applies on top of `canon.md`; the numbered plan files follow all
of them; proposals A-D are superseded. Within the catalogs, the generated `04b` catalog wins over
a sector note.

**The model.** `wipe_model.py` is the model (run economy, taps, flotsam and weather, Night Shift,
prestige, Late Tide, Blowback, Blast Map budget, meta layers, archetypes); `configs.py` holds
`CANON`, `PROPOSAL` (P1 as first published), `V2` (P1 under canon v2) and `V2_ALONE`; `group.py`
is the lockstep group simulation. The P1 constants are in `resolutions.md` 1: glass
`floor((L / 5e5)^(1/5))`, Glow `1 + 0.25√G`, output ×4.75 per rung, taps 0.4% per Grip rung,
Hustle at most ×2.25, Rally ×4 for 60 s, Adrenaline ×100 for 12 s, ranks ×2 rising together,
Late Tide ×3 below half the median, the 20-hour crown (errata E1 changes run 1's 3:00 crate to a
flat 2 minutes). To regenerate the canon v2 tables, run `python -I run_v2.py` from
`working/model/`: it writes `out/report_v2.txt` and `out/v2_extra.txt`, takes about four and a
half minutes on 28 workers (it uses `Pool(28)`), and `run_all.py` regenerates P1's tables.
`treecheck.py` and `catalog.py` expect the sector files in a sibling
`plan/` folder, so they need their paths adjusted before they run from here. In R0 the model is
replaced by simulator v2 in `packages/sim` (`10` 7).

---

## 5. What happens next

1. **Your to-do this week** (by Sunday 2026-10-11 to keep the calendar): ~~the decisions~~ (done
   2026-10-10, section 3); say yes to encrypted backups in your Google Drive and store the
   password safely; meanwhile, draw the scrap icon first (`01-vision.md` 1.5).
2. **Commit only when the owner asks.** The files stay uncommitted in `docs/redesign/` until
   then; when asked, they go on a branch, not on frozen `main`.
3. **R0 per `11-roadmap.md`**: the off-server backup on `main` first, then tag `pre-redesign`,
   branch `redesign`, rewrite `CLAUDE.md`, `docs/game-design.md` and `docs/roadmap.md` from the
   plan, archive today's design as `docs/archive/game-design-v1.md`, log decisions from D127,
   then delete the cuts and build the skeleton, `Amount`, effects, settle and simulator v2.
4. **R1-R2 locally, then the cut-over** at the end of R2: season 1 ends quietly with one
   `pnpm season end` (the Discord post optional), and everyone with a season 1 base starts fresh
   with a Founder skin and 5 glass.

**Calendar estimate** (`11-roadmap.md` 5; assumes approval by Sunday 2026-10-11 and R0 starting
Monday 2026-10-12):

| Milestone | Session | At 4 a week | At 3 a week | 3 a week, 25% overrun |
| --- | --- | --- | --- | --- |
| R0 done | 3 | 2026-10-16 | 2026-10-17 | 2026-10-18 |
| R1 done (playtest 1) | 8 | 2026-10-24 | 2026-10-28 | 2026-11-02 |
| **Cut-over** | 12 | **2026-10-31** | **2026-11-07** | **2026-11-14** |
| R3 done | 15 | 2026-11-05 | 2026-11-14 | 2026-11-22 |
| R5 done | 20 | 2026-11-14 | 2026-11-25 | 2026-12-07 |
| **R7 done** | 26 | **2026-11-25** | **2026-12-09** | **late December; likely January 2027** |

The cut-over most likely lands in the first half of November, near season 1's planned end (about
2026-11-04), though it no longer needs to match it (decision 7). It could be faster: W0-W8 took 12 days. The owner's review of decisions, names,
icons and playtests sets the pace. The owner's full to-do list, phase by phase, is
`11-roadmap.md` 8; the icons to draw now are in `01-vision.md` 1.5.

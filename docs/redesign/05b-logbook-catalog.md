# 05b The Logbook catalog

Status: proposal for the owner, 2026-10-08. Written against `05-meta-layers.md` 1.9 (the brief),
`02-the-run.md`, `03-the-big-red.md` 7.3 (flights), `06-friends.md` 9 (shared first finds) and
`09-architecture.md` 6-7 (commands and events), under canon v2 (`resolutions.md` wins, then
`amendments.md`, then `canon.md`). Names are *(proposal)* until the owner's naming pass. The data
is in `05b-logbook.json` (`{"launch": [...], "later": [...]}`), generated from the same source as
these tables, so the two never disagree.

The Logbook is the crew's diary: every page raises Morale (`1 + 0.02 × pages`, `05` 1.4) and every
25 pages record 1 scrap. **120 pages ship in R4** (30 secrets); **130 more** are listed for R5
(40), R6 (40) and R7 (50), each shipping with its system, for about 250 in all. Pages are kept
through every nuke and a Crossing.

How a page works (`05` 1.3, resolution 3.14): one pure function, `logbook(before, after, events)`,
runs at the end of every command (taps, pings and Collect included), on the client for prediction
and on the server for truth. Every page has exactly one `when` from the closed list below. A taps
batch that finds a page writes that one `logbook_entry` row. A secret is a "???" tile until found;
its one-line hint opens at Wipe Day #15, with Old Maps, through a Message in a Bottle, or when a
friend finds it first (then the feed shows the hint, never the name).

Columns of the launch table: **id** (the locale key `logbook.<id>.*`), **name**, **how** (the
shown line, at most 48 characters; for a secret it shows only once found), **when** (JSON5),
**S** (secret), **hint** (secrets only), **quip** (optional, at most 60 characters), **icon**
(`<kind>/<id>`, kinds from `07-what-changes.md` 8.1; a page draws its subject's icon in the page
frame) and **day** (the casual archetype's estimated day of first find: 08:00, 13:00 and 21:00 for
5 minutes at 4 taps/s, pressing when crowned; "long haul" or "secret" when it has no estimate).

## 1. Condition vocabulary used

The six `when` kinds of `05` 1.3, unchanged: `stat`, `run`, `event`, `state`, `buffs`, `pages`.
The catalog stays inside the brief's budget: **2 new counters** (of 6 allowed) and **3 new state
predicates** plus one replaced (12 in all, the limit).

### 1.1 Counters

| Counter | Kind | Counts | Recorded from | Pages |
| --- | --- | --- | --- | --- |
| `taps`, `felled` (of target), `flotsam` (of kind), `hands_hired`, `units`, `upgrades`, `eras` (of era), `collects`, `full_windows` | `stat` (05) | as `05` 1.3 | R1 | many |
| `crits`, `wipe_days`, `small_blasts`, `nodes`, `glass_ever` | `stat` (05) | as `05` 1.3 | R2 | many |
| `pokes` (of `gull`, `kettle`) | `stat` (05) | taps on scene objects, from the taps batch | R4 | 4 |
| **`held`** (new) | `stat` | taps credited from a hold to work. The taps batch gains an optional `held` (at most `count`), clamped with the batch; it pays nothing extra, so a forged value can only log one page early | R4 (no backfill) | `hold_steady` |
| **`afterglow_taps`** (new) | `stat` | taps credited while Afterglow is above ×1 (the run's first 30 min from its first tap), computed on the server from `afterglowFrom` | R4 (no backfill) | `afterglow_1000` |
| run `taps`, `felled`, `units`, `hands_hired`, `upgrades`, `made`, `seconds` | `run` (05) | this run | R1 | `lumberjack_day` |

`09-architecture.md` 3.1 names some lifetime stats differently (`hands`, `blasts`, `flights`);
the domain should adopt `05`'s names (`hands_hired`, `small_blasts`) or alias them in one place.

### 1.2 State predicates (12)

| Predicate | Value compared | Params | Status |
| --- | --- | --- | --- |
| `supplies_digits` | the leading digits of `floor(supplies)` (`eq`) | none | **replaces `supplies_floor`** (open question 1) |
| `hands_working` | hands at work on a line with at least one unit | `era?`: only that era's lines | 05; `era` param new |
| `lines_min_owned` | the lowest unit count among unlocked lines | `era?`: only that era's lines | 05; `era` param new |
| `line_max_owned` | the highest unit count of any line | | 05 (unused at launch) |
| `sector_rings_lit` | the most fully lit rings, counted from ring 1, in any one sector | | 05 |
| `sectors_touched` | sectors with at least one owned node | | 05 |
| `keystones_slotted` | keystones in the loadout | | 05 |
| `run_made_before_era` | supplies made this run before its first era purchase | | 05 |
| `window_hours` | the Night Shift window, hours | | 05 |
| **`lines_equal`** | the common unit count when every unlocked line owns exactly the same number, else 0 | | new, R4 |
| **`kept_hands`** | hands that started this run on shift without a hire (agenda and Crew nodes) | | new, R4 |
| **`hustle`** | the Hustle meter after the command, 0-100 | | new, R4 |

The `era` parameter (already in `05`'s shape `{state, eq or gte, era?}`) narrows a line or hand
predicate to the lines that era opens: `{state: "lines_min_owned", era: "wood", gte: 100}` means
100 each of Loom, Workbench and Kiln. A run that starts in a later era (Prefab Walls, Stone
Foundations) emits no `era_reached` for the skipped eras; no secret depends on one.

### 1.3 Events and fields used

All from `05` 1.3: `era_reached {era, runSeconds}`, `hand_hired {runSeconds}`, `milestone {kind,
line, at}`, `felled {target, crit}`, `flotsam_claimed {kind, weather, night}`, `nuked {counted,
flight, weather, night, gain, gainShare, runSeconds, handsHiredThisRun}`, `collected
{awaySeconds, windowFull}`, `node_bought {path}`. `gainShare` is gain ÷ glass ever before the
press. `Gte` / `Lte` suffixes compare numbers. Wipe Day pages read only `counted: true` (rule 5);
the Fizzle page and two jokes read small blasts (`counted: false`).

### 1.4 `pages` and `buffs`

`{pages: {gte: n}}` counts all logged pages; `{pages: {category, all: true}}` means **every other
page of that category**, so the page cannot wait on itself. Buffs at launch: `rally`, `drone`
(R4) and `adrenaline`.

## 2. Counts

### 2.1 By category (checked against `05` 1.2)

| Category (id) | Pages | Secrets | Brief | Day 1 | By day 7 | By day 30 | By day 90 | Long haul | Secret, no estimate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Eras (`eras`) | 9 | 2 | 9 / 2 ok | 3 | 5 | 6 | 8 | 0 | 1 |
| Lines (`lines`) | 18 | 3 | 18 / 3 ok | 3 | 9 | 12 | 17 | 0 | 1 |
| Hands (`hands`) | 12 | 2 | 12 / 2 ok | 2 | 7 | 10 | 12 | 0 | 0 |
| Taps (`taps`) | 11 | 3 | 11 / 3 ok | 2 | 6 | 10 | 10 | 0 | 1 |
| Flotsam (`flotsam`) | 12 | 3 | 12 / 3 ok | 2 | 5 | 8 | 10 | 1 | 1 |
| Wipe Days (`nukes`) | 13 | 4 | 13 / 4 ok | 1 | 5 | 7 | 12 | 1 | 0 |
| Flight log (`flights`) | 13 | 0 | 13 / 0 ok | 1 | 5 | 11 | 11 | 2 | 0 |
| Blast Map (`map`) | 9 | 1 | 9 / 1 ok | 2 | 5 | 7 | 8 | 0 | 1 |
| Night Shift (`night_shift`) | 6 | 2 | 6 / 2 ok | 1 | 1 | 3 | 4 | 1 | 1 |
| Island (`island`) | 8 | 4 | 8 / 4 ok | 2 | 3 | 4 | 6 | 0 | 2 |
| Jokes (`jokes`) | 9 | 6 | 9 / 6 ok | 0 | 1 | 2 | 2 | 1 | 6 |
| **Total** | **120** | **30** | 120 / 30 | **19** | **52** | **80** | **100** | **6** | **14** |

### 2.2 Pacing bands (`05` 1.9)

| Band | Brief | This catalog (cumulative, casual) |
| --- | --- | --- |
| Day 1 | 15-25 | 19 |
| By day 7 | 45-55 | 52 |
| By day 30 | 70-80 | 80 |
| By day 90 | 90-100 | 100 |
| Long haul (non-secret) | at most 12 | 6 |
| Secrets with no estimate | the rest | 14 |

Day counts include secrets that ordinary casual play finds anyway (for example `lightning_rod`: about one Wipe Day in five is in rain). The casual's numbers: about one Wipe Day a day in week 1 and #25 near day 30; about 2 flotsam caught a day; about 3,600 taps and 40 fells a day; Lucky Swing near Wipe Day #5; Old Crew III near day 35.

## 3. Coverage

| Thing | Pages |
| --- | --- |
| 12 flight variants (`03` 7.3) | `flight_u_turn`, `flight_loop_the_loop`, `flight_sputter_drop`, `flight_fizzle`, `flight_boomerang`, `flight_storm_rider`, `flight_gull_strike`, `flight_skipper`, `flight_moonshot`, `flight_lawn_dart`, `flight_ricochet`, `flight_rowboat_chaser`; all of them: `all_flights`; also `over_the_moon`, `wet_firework` |
| 5 eras | Twig `lean_to_life`; Timber `timber_era`; Stone `stone_era`; Sheet Metal `metal_era`, `metal_sprint`; Armored `armored_era`, `armored_dash`, `armored_regular`, `wreck_express` |
| 14 lines | lines 1-3 `twig_hundreds`; 4-6 `timber_hundreds`; 7-9 `stone_hundreds`; 10-12 `metal_hundreds`; 13-14 `armored_hundreds`; by name also `tideline_sprawl` (Beachcomber), `hot_pennant` (Reactor) |
| 14 hands | Mara, Dax, Ivo `twig_crew`; Rook, Sela, Bram `timber_crew`; Wren, Otto, Juno `stone_crew`; Pike, Hale, Tamsin `metal_crew`; Gus, Vera `armored_crew`; all `all_hands`, `crew_for_life` |
| 5 targets | `first_fell` (any), `hull_splitter` (the Wreck), `felled_100`, `felled_1000`; later `felled_5000` |
| R4 flotsam kinds | crate `crates_10`; fuel drum `drums_10`; Adrenaline Kit `first_adrenaline`, `storm_surge`; Drowned Drone `first_drone`, `night_drone`, `full_throttle`; Bottle `first_bottle`. Sealed Locker (R5): `first_locker`, `lockers_10` |
| Weather and night | rain `rain_catch`, `lightning_rod`, `storm_surge`, `wet_firework`; fog `out_of_fog`, `blind_launch`; night `night_catch`, `night_launch`, `night_drone`, `over_the_moon`, `blind_launch` |
| Pokes (R4: gull, Kettle) | `gull_hello`, `gull_botherer`; `kettle_knock`, `kettle_drummer` |

## 4. The R4 launch catalog (120 pages)

Grouped by category, in the Logbook's chapter order. **S** marks a secret.

### Eras (`eras`): 9 pages, 2 secrets

| id | Name | How (shown) | `when` | S | Hint | Quip | Icon | Day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `timber_era` | Goodbye, Lean-to | Reach the Timber era. | `{stat: "eras", of: "wood", gte: 1}` |  |  | A roof. An actual roof. | `tier/wood` | 1 |
| `stone_era` | Set in Stone | Reach the Stone era. | `{stat: "eras", of: "stone", gte: 1}` |  |  |  | `tier/stone` | 1 |
| `metal_era` | Tin Can Living | Reach the Sheet Metal era. | `{stat: "eras", of: "metal", gte: 1}` |  |  | It rattles when it rains. We love it. | `tier/metal` | 1 |
| `armored_era` | Plated Up | Reach the Armored era. | `{stat: "eras", of: "hqm", gte: 1}` |  |  |  | `tier/hqm` | 3 |
| `metal_sprint` | Tin Roof Sprint | Reach Sheet Metal in a run's first 30 min. | `{event: "era_reached", era: "metal", runSecondsLte: 1800}` |  |  |  | `tier/metal` | 6 |
| `armored_dash` | Armor by Lunch | Reach Armored in a run's first hour. | `{event: "era_reached", era: "hqm", runSecondsLte: 3600}` |  |  |  | `tier/hqm` | 14 |
| `armored_regular` | Plate Collector | Reach the Armored era 25 times. | `{stat: "eras", of: "hqm", gte: 25}` |  |  |  | `tier/hqm` | 32 |
| `lean_to_life` | Lean-to Life | Make 1M supplies in a run before buying an era. | `{state: "run_made_before_era", gte: 1e6}` | S | Some never move out. | Who needs walls? We have a tarp. | `tier/twig` | secret |
| `wreck_express` | Wreck Express | Reach Armored in a run's first 10 min. | `{event: "era_reached", era: "hqm", runSecondsLte: 600}` | S | Some crews reach the hull before the tea cools. |  | `target/wreck` | 35 |

### Lines (`lines`): 18 pages, 3 secrets

| id | Name | How (shown) | `when` | S | Hint | Quip | Icon | Day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `first_line` | Open for Business | Buy your first line. | `{stat: "units", gte: 1}` |  |  | One man, one sack, one beach. | `line/beachcomber` | 1 |
| `ten_of_a_kind` | Ten Alike | Own 10 of one line. | `{event: "milestone", kind: "line", at: 10}` |  |  |  | `line/beachcomber` | 1 |
| `twig_hundreds` | Smoke and Hemp | Own 100 of each Twig line. | `{state: "lines_min_owned", era: "twig", gte: 100}` |  |  |  | `line/campfire` | 2 |
| `timber_hundreds` | Rope and Planks | Own 100 of each Timber line. | `{state: "lines_min_owned", era: "wood", gte: 100}` |  |  |  | `line/loom` | 3 |
| `stone_hundreds` | Hides and Ingots | Own 100 of each Stone line. | `{state: "lines_min_owned", era: "stone", gte: 100}` |  |  |  | `line/furnace` | 5 |
| `metal_hundreds` | Sparks and Static | Own 100 of each Sheet Metal line. | `{state: "lines_min_owned", era: "metal", gte: 100}` |  |  |  | `line/radio_mast` | 7 |
| `armored_hundreds` | Heavy Industry | Own 100 Ship Breakers and 100 Reactors. | `{state: "lines_min_owned", era: "hqm", gte: 100}` |  |  |  | `line/reactor` | 12 |
| `roster_25` | Bunting Up | Own 25 of every unlocked line. | `{event: "milestone", kind: "roster", at: 25}` |  |  | Somebody found a lot of flags. | `ui/roster` | 1 |
| `bit_of_everything` | A Bit of Everything | Own 100 of every unlocked line. | `{event: "milestone", kind: "roster", at: 100}` |  |  |  | `ui/roster` | 5 |
| `roster_250` | Roof Flag | Own 250 of every unlocked line. | `{event: "milestone", kind: "roster", at: 250}` |  |  |  | `ui/roster` | 35 |
| `bronze_pennant` | Bronze Pennant | Own 200 of one line. | `{event: "milestone", kind: "line", at: 200}` |  |  |  | `ui/roster` | 4 |
| `silver_pennant` | Silver Pennant | Own 300 of one line. | `{event: "milestone", kind: "line", at: 300}` |  |  |  | `ui/roster` | 15 |
| `gold_pennant` | Gold Pennant | Own 400 of one line. | `{event: "milestone", kind: "line", at: 400}` |  |  | We ran out of pole. | `ui/roster` | 45 |
| `units_10k` | Busy Builders | Buy 10,000 line units. | `{stat: "units", gte: 10000}` |  |  |  | `ui/buy_max` | 8 |
| `shelf_stocker` | Shelf Stocker | Buy 1,000 shelf upgrades. | `{stat: "upgrades", gte: 1000}` |  |  |  | `ui/upgrade` | 35 |
| `even_keel` | Even Keel | Own the same 50+ of every unlocked line. | `{state: "lines_equal", gte: 50}` | S | A level deck: nothing sits higher than the rest. | Measured twice. Bought once. | `ui/roster` | secret |
| `hot_pennant` | Hot Pennant | Own 200 Reactors. | `{event: "milestone", kind: "line", line: "reactor", at: 200}` | S | Bronze looks best on a cooling tower. |  | `line/reactor` | 40 |
| `tideline_sprawl` | Tideline Sprawl | Own 300 Beachcombers. | `{event: "milestone", kind: "line", line: "beachcomber", at: 300}` | S | The oldest trade on the beach can still win silver. |  | `line/beachcomber` | 40 |

### Hands (`hands`): 12 pages, 2 secrets

| id | Name | How (shown) | `when` | S | Hint | Quip | Icon | Day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `first_hand` | Help Wanted | Hire your first hand. | `{stat: "hands_hired", gte: 1}` |  |  | Mara says she'll take it from here. | `ui/hand` | 1 |
| `twig_crew` | Beach Crew | Have Mara, Dax and Ivo at work at once. | `{state: "hands_working", era: "twig", gte: 3}` |  |  |  | `crew/mara` | 1 |
| `timber_crew` | Rope Crew | Have Rook, Sela and Bram at work at once. | `{state: "hands_working", era: "wood", gte: 3}` |  |  |  | `crew/rook` | 2 |
| `stone_crew` | Forge Crew | Have Wren, Otto and Juno at work at once. | `{state: "hands_working", era: "stone", gte: 3}` |  |  |  | `crew/wren` | 3 |
| `metal_crew` | Dock Crew | Have Pike, Hale and Tamsin at work at once. | `{state: "hands_working", era: "metal", gte: 3}` |  |  |  | `crew/pike` | 5 |
| `armored_crew` | Wreck Crew | Have Gus and Vera at work at once. | `{state: "hands_working", era: "hqm", gte: 2}` |  |  |  | `crew/vera` | 8 |
| `all_hands` | All Hands | Have all 14 hands working at once. | `{state: "hands_working", gte: 14}` |  |  | Fourteen mugs. One kettle. Trouble. | `ui/hand` | 8 |
| `hands_100` | Payroll | Hire 100 hands. | `{stat: "hands_hired", gte: 100}` |  |  |  | `ui/hand` | 10 |
| `quick_hire` | Instant Hire | Hire a hand in a run's first minute. | `{event: "hand_hired", runSecondsLte: 60}` |  |  |  | `crew/dax` | 2 |
| `old_faces` | Old Faces | Start a run with 3 hands already on shift. | `{state: "kept_hands", gte: 3}` |  |  | Same boat, same faces, new island. | `crew/mara` | 3 |
| `crew_for_life` | Crew for Life | Start a run with all 14 hands kept. | `{state: "kept_hands", gte: 14}` | S | A crew that rows back from every blast, to the last name. |  | `crew/ivo` | 35 |
| `crew_album` | Crew Album | Log every other Hands page. | `{pages: {category: "hands", all: true}}` | S | Know every face, every way there is. |  | `ui/hand` | 35 |

### Taps (`taps`): 11 pages, 3 secrets

| id | Name | How (shown) | `when` | S | Hint | Quip | Icon | Day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `first_fell` | Timber! | Fell your first target. | `{stat: "felled", gte: 1}` |  |  | Mind your toes. | `target/tree` | 1 |
| `felled_100` | Hundred Stumps | Fell 100 targets. | `{stat: "felled", gte: 100}` |  |  |  | `target/stone` | 3 |
| `felled_1000` | Thousand Stumps | Fell 1,000 targets. | `{stat: "felled", gte: 1000}` |  |  | The island grows them back. Rude. | `target/ore` | 25 |
| `taps_10k` | Sore Thumbs | Tap 10,000 times. | `{stat: "taps", gte: 10000}` |  |  |  | `ui/finger` | 3 |
| `full_hustle` | In the Groove | Fill Hustle to the top. | `{state: "hustle", gte: 100}` |  |  | Don't stop now. Seriously, don't. | `ui/hustle` | 1 |
| `hold_steady` | Hold Steady | Hold to work for 1,000 taps. | `{stat: "held", gte: 1000}` |  |  |  | `ui/finger` | 2 |
| `crits_100` | Lucky Streak | Land 100 crits. | `{stat: "crits", gte: 100}` |  |  |  | `tool/iron_tools` | 8 |
| `afterglow_1000` | Ash and Sparks | Tap 1,000 times in Afterglow. | `{stat: "afterglow_taps", gte: 1000}` |  |  | The sky's green. Keep swinging. | `ui/afterglow` | 3 |
| `clean_through` | Clean Through | Fell a target with a crit. | `{event: "felled", crit: true}` | S | Sometimes the last swing is the lucky one. |  | `tool/salvaged_tools` | 8 |
| `lumberjack_day` | Lumberjack Day | Fell 100 targets in one run. | `{run: "felled", gte: 100}` | S | Some runs are all chopping. | We're out of firewood space. Again. | `target/tree` | secret |
| `hull_splitter` | Hull Splitter | Fell the Wreck 100 times. | `{stat: "felled", of: "wreck", gte: 100}` | S | That rusted hull on the rise has a hundred lives. |  | `target/wreck` | 15 |

### Flotsam (`flotsam`): 12 pages, 3 secrets

| id | Name | How (shown) | `when` | S | Hint | Quip | Icon | Day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `first_catch` | Washed Up | Catch your first flotsam. | `{stat: "flotsam", gte: 1}` |  |  | Finders keepers. | `flotsam/crate` | 1 |
| `crates_10` | Crate Digger | Catch 10 Drift Crates. | `{stat: "flotsam", of: "crate", gte: 10}` |  |  |  | `flotsam/crate` | 10 |
| `drums_10` | Rally Round | Catch 10 Fuel Drums. | `{stat: "flotsam", of: "fuel_drum", gte: 10}` |  |  |  | `flotsam/fuel_drum` | 12 |
| `first_adrenaline` | Jolt | Catch an Adrenaline Kit. | `{stat: "flotsam", of: "adrenaline", gte: 1}` |  |  | My hands are buzzing. Is that normal? | `flotsam/adrenaline` | 8 |
| `first_drone` | Fished a Drone | Catch a Drowned Drone. | `{stat: "flotsam", of: "drowned_drone", gte: 1}` |  |  |  | `flotsam/drowned_drone` | 7 |
| `first_bottle` | Message Received | Open a Message in a Bottle. | `{stat: "flotsam", of: "bottle", gte: 1}` |  |  | It says 'help'. Same, mate. | `flotsam/bottle` | long haul |
| `flotsam_100` | Tide Watcher | Catch 100 flotsam. | `{stat: "flotsam", gte: 100}` |  |  |  | `flotsam/crate` | 50 |
| `rain_catch` | Wet Pickings | Catch flotsam in the rain. | `{event: "flotsam_claimed", weather: "rain"}` |  |  |  | `flotsam/fuel_drum` | 3 |
| `night_catch` | Night Fishing | Catch flotsam at night. | `{event: "flotsam_claimed", night: true}` |  |  |  | `flotsam/crate` | 1 |
| `full_throttle` | Full Throttle | Run a Rally and a Drowned Drone at once. | `{buffs: ["rally", "drone"]}` | S | A drum that waits can share the stage. |  | `flotsam/fuel_drum` | secret |
| `storm_surge` | Storm Surge | Catch an Adrenaline Kit in the rain. | `{event: "flotsam_claimed", kind: "adrenaline", weather: "rain"}` | S | Lightning in a tin. |  | `flotsam/adrenaline` | 40 |
| `out_of_fog` | Fog Find | Catch flotsam in the fog. | `{event: "flotsam_claimed", weather: "fog"}` | S | Not everything lost in the murk stays lost. |  | `flotsam/crate` | 5 |

### Wipe Days (`nukes`): 13 pages, 4 secrets

| id | Name | How (shown) | `when` | S | Hint | Quip | Icon | Day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `first_wipe` | Lid's Up | Press the Big Red. | `{stat: "wipe_days", gte: 1}` |  |  | I *just* fixed the roof. | `ui/big_red` | 1 |
| `wipe_5` | Old Habit | Reach Wipe Day #5. | `{stat: "wipe_days", gte: 5}` |  |  |  | `ui/big_red` | 5 |
| `regular` | Regular | Reach Wipe Day #10. | `{stat: "wipe_days", gte: 10}` |  |  | The gulls don't even look up any more. | `ui/big_red` | 10 |
| `doubling` | Twice as Bright | Double your glass in one Wipe Day. | `{event: "nuked", counted: true, gainShareGte: 1}` |  |  |  | `currency/glass` | 2 |
| `glass_1k` | Glass Jar | Earn 1,000 crater glass. | `{stat: "glass_ever", gte: 1000}` |  |  |  | `currency/glass` | 7 |
| `glass_10k` | Glass Shelf | Earn 10,000 crater glass. | `{stat: "glass_ever", gte: 10000}` |  |  |  | `currency/glass` | 20 |
| `glass_100k` | Glass House | Earn 100,000 crater glass. | `{stat: "glass_ever", gte: 100000}` |  |  | Nobody throw anything. | `currency/glass` | 50 |
| `big_gain` | Ten Thousand Shards | Earn 10,000 glass in one Wipe Day. | `{event: "nuked", counted: true, gainGte: 10000}` |  |  |  | `ui/glow` | 40 |
| `short_fuse` | Short Fuse | Make a Wipe Day within 30 min of a run's start. | `{event: "nuked", counted: true, runSecondsLte: 1800}` |  |  |  | `ui/big_red` | long haul |
| `lightning_rod` | Lightning Rod | Press the Big Red while it rains. | `{event: "nuked", counted: true, weather: "rain"}` | S | Most people launch in fair weather. |  | `ui/big_red` | 5 |
| `nobody_home` | Nobody Home | Press the Big Red with no hand hired that run. | `{event: "nuked", counted: true, handsHiredThisRun: 0}` | S | Some blasts are a solo act. |  | `ui/big_red` | 35 |
| `blind_launch` | Blind Launch | Press the Big Red at night, in fog. | `{event: "nuked", counted: true, weather: "fog", night: true}` | S | Nobody saw that one go. | Did it go? I think it went. | `ui/big_red` | 35 |
| `just_made_it` | Just Made It | Make a Wipe Day worth under 11% of your glass. | `{event: "nuked", counted: true, gainShareLte: 0.11}` | S | Scraping past the line still counts. |  | `currency/glass` | 40 |

### Flight log (`flights`): 13 pages, 0 secrets

| id | Name | How (shown) | `when` | S | Hint | Quip | Icon | Day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `flight_u_turn` | U-Turn | Watch the Kettle shrug and turn home. | `{event: "nuked", counted: true, flight: "u_turn"}` |  |  | It looked at the sea and changed its mind. | `ui/kettle_fuel` | 1 |
| `flight_loop_the_loop` | Loop-the-Loop | Watch the Kettle loop the loop. | `{event: "nuked", counted: true, flight: "loop_the_loop"}` |  |  |  | `ui/kettle_fuel` | 3 |
| `flight_sputter_drop` | Sputter and Drop | Watch the Kettle cough and drop. | `{event: "nuked", counted: true, flight: "sputter_drop"}` |  |  | Technically a launch. | `ui/kettle_fuel` | 3 |
| `flight_fizzle` | Fizzle | Set off a small blast. | `{event: "nuked", counted: false, flight: "fizzle"}` |  |  | That's it? That's the whole bang? | `ui/kettle_frame` | long haul |
| `flight_boomerang` | Boomerang | Watch the Kettle come back the other way. | `{event: "nuked", counted: true, flight: "boomerang"}` |  |  |  | `ui/kettle_fuel` | 4 |
| `flight_storm_rider` | Storm Rider | Watch lightning steer the Kettle home. | `{event: "nuked", counted: true, flight: "storm_rider"}` |  |  |  | `ui/kettle_fuel` | 15 |
| `flight_gull_strike` | Gull Strike | Watch a gull ride the Kettle down. | `{event: "nuked", counted: true, flight: "gull_strike"}` |  |  | The gull got off. The gull always gets off. | `ui/kettle_fuel` | 6 |
| `flight_skipper` | The Skipper | Watch the Kettle skip like a stone. | `{event: "nuked", counted: true, flight: "skipper"}` |  |  |  | `ui/kettle_fuel` | 9 |
| `flight_moonshot` | Moonshot | Watch the Kettle go straight up. | `{event: "nuked", counted: true, flight: "moonshot"}` |  |  |  | `ui/kettle_fuel` | 11 |
| `flight_lawn_dart` | Lawn Dart | Watch the Kettle stick in the yard. | `{event: "nuked", counted: true, flight: "lawn_dart"}` |  |  |  | `ui/kettle_fuel` | 13 |
| `flight_ricochet` | Ricochet | Watch the Kettle bounce off the lighthouse. | `{event: "nuked", counted: true, flight: "ricochet"}` |  |  |  | `ui/kettle_fuel` | 17 |
| `flight_rowboat_chaser` | Rowboat Chaser | Watch the Kettle chase the rowboat. | `{event: "nuked", counted: true, flight: "rowboat_chaser"}` |  |  | Row. ROW. | `ui/kettle_fuel` | 23 |
| `all_flights` | Seen Them All | Watch all 12 flights. | `{pages: {category: "flights", all: true}}` |  |  |  | `ui/kettle_fuel` | long haul |

### Blast Map (`map`): 9 pages, 1 secret

| id | Name | How (shown) | `when` | S | Hint | Quip | Icon | Day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `first_node` | First Scorch | Light your first Blast Map node. | `{stat: "nodes", gte: 1}` |  |  |  | `ui/ground_zero` | 1 |
| `nodes_10` | Spreading Burn | Light 10 nodes. | `{stat: "nodes", gte: 10}` |  |  |  | `ui/ground_zero` | 2 |
| `nodes_50` | Scorch Marks | Light 50 nodes. | `{stat: "nodes", gte: 50}` |  |  |  | `ui/ground_zero` | 10 |
| `nodes_100` | Wide Burn | Light 100 nodes. | `{stat: "nodes", gte: 100}` |  |  |  | `ui/ground_zero` | 35 |
| `scorched_wedge` | Scorched Wedge | Light every node of one ring in one sector. | `{state: "sector_rings_lit", gte: 1}` |  |  |  | `sector/grip` | 1 |
| `all_sectors` | Every Direction | Light a node in all eight sectors. | `{state: "sectors_touched", gte: 8}` |  |  |  | `ui/ground_zero` | 3 |
| `first_keystone` | Keystone | Slot a keystone. | `{state: "keystones_slotted", gte: 1}` |  |  | Rules are more like guidelines now. | `node_type/keystone` | 11 |
| `path_buy` | Shortcut | Buy a whole path in one tap. | `{event: "node_bought", path: true}` |  |  |  | `ui/ground_zero` | 5 |
| `burnt_crust` | Burnt Through | Light rings 1-6 of one sector in full. | `{state: "sector_rings_lit", gte: 6}` | S | One slice, burnt right through. |  | `sector/blast` | secret |

### Night Shift (`night_shift`): 6 pages, 2 secrets

| id | Name | How (shown) | `when` | S | Hint | Quip | Icon | Day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `first_collect` | Welcome Back | Collect what the Night Shift made. | `{stat: "collects", gte: 1}` |  |  | We saved you some fish. | `ui/night_shift` | 1 |
| `collects_50` | Morning Routine | Collect 50 times. | `{stat: "collects", gte: 50}` |  |  |  | `ui/night_shift` | 17 |
| `long_window` | Round the Clock | Stretch the Night Shift window to 24 h. | `{state: "window_hours", gte: 24}` |  |  |  | `ui/night_shift` | 12 |
| `slept_through` | Slept Through It | Come back to a full Night Shift window. | `{event: "collected", windowFull: true}` |  |  | We stopped at nine. Union rules. | `ui/night_shift` | long haul |
| `catnap` | Catnap | Collect after barely an hour away. | `{event: "collected", awaySecondsLte: 3660}` | S | The shortest welcome is still a welcome. |  | `ui/night_shift` | secret |
| `deep_bunker` | Deep Bunker | Stretch the Night Shift window to 40 h. | `{state: "window_hours", gte: 40}` | S | Some bunkers sleep for days. |  | `ui/night_shift` | 45 |

### Island (`island`): 8 pages, 4 secrets

| id | Name | How (shown) | `when` | S | Hint | Quip | Icon | Day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `gull_hello` | Hello, Gull | Poke a gull. | `{stat: "pokes", of: "gull", gte: 1}` |  |  | It did not say hello back. | `ui/gull` | 1 |
| `kettle_knock` | Knock Knock | Poke the Kettle 10 times. | `{stat: "pokes", of: "kettle", gte: 10}` |  |  | Don't. Knock. On. The. Warhead. | `ui/kettle_frame` | 2 |
| `night_launch` | Night Sky Show | Press the Big Red at night. | `{event: "nuked", counted: true, night: true}` |  |  |  | `ui/big_red` | 1 |
| `metal_sign` | Metal Sign | Reach Wipe Day #25: the sign goes metal. | `{stat: "wipe_days", gte: 25}` |  |  |  | `ui/ground_zero` | 30 |
| `gull_botherer` | Gull Botherer | Poke the gulls 100 times. | `{stat: "pokes", of: "gull", gte: 100}` | S | The gulls are keeping score. |  | `ui/gull` | secret |
| `kettle_drummer` | Kettle Drummer | Poke the Kettle 250 times. | `{stat: "pokes", of: "kettle", gte: 250}` | S | It rings like a dinner gong if you keep at it. |  | `ui/kettle_frame` | secret |
| `over_the_moon` | Over the Moon | Watch a Moonshot at night. | `{event: "nuked", counted: true, flight: "moonshot", night: true}` | S | One flight is best watched after dark. |  | `ui/kettle_fuel` | 35 |
| `night_drone` | Glow Worm | Catch a Drowned Drone at night. | `{event: "flotsam_claimed", kind: "drowned_drone", night: true}` | S | Something blinks in the dark water. |  | `flotsam/drowned_drone` | 40 |

### Jokes (`jokes`): 9 pages, 6 secrets

| id | Name | How (shown) | `when` | S | Hint | Quip | Icon | Day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `paperwork` | Paperwork | Log 25 Logbook pages. | `{pages: {gte: 25}}` |  |  | Somebody has to write this down. | `ui/page` | 2 |
| `page_turner` | Page Turner | Log 60 Logbook pages. | `{pages: {gte: 60}}` |  |  |  | `ui/page` | 12 |
| `damp_squibs` | Damp Squibs | Set off 3 small blasts. | `{stat: "small_blasts", gte: 3}` |  |  | Pop. Pop. Pop. | `ui/kettle_frame` | long haul |
| `elite_heap` | Elite Heap | Hold supplies that start with 1337. | `{state: "supplies_digits", eq: 1337}` | S | Some numbers are more elite than others. |  | `currency/supplies` | secret |
| `not_found` | Not Found | Hold supplies that start with 404. | `{state: "supplies_digits", eq: 404}` | S | Look for the number that is never found. |  | `currency/supplies` | secret |
| `lucky_sevens` | Lucky Sevens | Hold supplies that start with 777. | `{state: "supplies_digits", eq: 777}` | S | Three of a kind, right on the counter. |  | `currency/supplies` | secret |
| `oops` | Oops | Set off a small blast in a run's first minute. | `{event: "nuked", counted: false, runSecondsLte: 60}` | S | Some people press it just to see. | It was a test. Of the island. | `ui/big_red` | secret |
| `wet_firework` | Wet Firework | Watch Sputter and Drop in the rain. | `{event: "nuked", counted: true, flight: "sputter_drop", weather: "rain"}` | S | A dud looks even sadder in the rain. |  | `ui/kettle_fuel` | secret |
| `class_clown` | Class Clown | Log every other Jokes page. | `{pages: {category: "jokes", all: true}}` | S | Laugh at every last one of them. |  | `ui/secret` | secret |

## 5. Secrets: found without a wiki

Every secret has one fair hint (`05` 1.6), never the solution's words. The route below is for this review only; players see the hint. None becomes impossible after a Blast Map purchase (rule 4) and none only works before Wipe Day #3; keystones that remove a kind are optional loadouts, changed free on the rebuild screen.

| id | Hint | Route, and why it stays possible |
| --- | --- | --- |
| `lean_to_life` | Some never move out. | Skip the era row and keep buying lines. Any start era works: the run counts what it made before its first era purchase. |
| `wreck_express` | Some crews reach the hull before the tea cools. | Rush the eras after a nuke; Afterglow and kits make it routine in the late game. Armored is never a start era, so no node closes it. |
| `even_keel` | A level deck: nothing sits higher than the rest. | Buy every line up to the same round number with x1. Kits start at most 25 units, so 50 or more is always reachable. |
| `hot_pennant` | Bronze looks best on a cooling tower. | Keep buying the top line past 200. Natural for long runs; the 200 milestone shows on the row ("187/200 → ×3"). |
| `tideline_sprawl` | The oldest trade on the beach can still win silver. | Keep buying Beachcombers past 300; the row shows "281/300 → ×3". Line 1 is always cheap to stack. |
| `crew_for_life` | A crew that rows back from every blast, to the last name. | Follow the Crew sector's Old Crew nodes to the end (Old Crew III). Found at the next run's start. |
| `crew_album` | Know every face, every way there is. | Log the other eleven Hands pages; the Hands chapter shows 11/12. |
| `clean_through` | Sometimes the last swing is the lucky one. | Buy Lucky Swing (Grip ring 3); 5% of fells land on a crit. Crit chance only rises with nodes. |
| `lumberjack_day` | Some runs are all chopping. | Tap through one long run. Felling never stops; Heavy Haft only makes it easier. |
| `hull_splitter` | That rusted hull on the rise has a hundred lives. | Keep felling the Wreck in Armored runs; ordinary play finds it in a few weeks. |
| `full_throttle` | A drum that waits can share the stage. | Hot Breakfast (Bunker ring 1) starts a Rally at Collect; or Drag Line (Tide ring 4) keeps a missed drum waiting. Catch a drone during it. Keystones that remove kinds are optional loadouts. |
| `storm_surge` | Lightning in a tin. | Play in the rain (the scene shows it; flotsam comes 1.5x as often). About 1 catch in 80 in rain is a kit. |
| `out_of_fog` | Not everything lost in the murk stays lost. | Catch anything in fog, about 10% of the day. Ordinary play finds it within a week. |
| `lightning_rod` | Most people launch in fair weather. | Press in rain. Rain is visible on the scene and in the forecast copy; about 1 nuke in 5. |
| `nobody_home` | Some blasts are a solo act. | Launch with only kept hands, or with none: unmanned lines run while you tap. Kept hands never count as hires, so Old Crew III makes it automatic. |
| `blind_launch` | Nobody saw that one go. | Press at night while fog is down. Both are shown on the scene; about 1 nuke in 25 by chance. |
| `just_made_it` | Scraping past the line still counts. | Press as soon as the cover card says it counts (the Forecast node shows when). Every run passes 10% once. |
| `burnt_crust` | One slice, burnt right through. | Finish one sector through ring 6. The Blast Map shows each wedge's fill; ring 6 opens at Wipe Day #20. |
| `catnap` | The shortest welcome is still a welcome. | Come back right after the welcome-back card starts appearing (1 h) and press Collect. |
| `deep_bunker` | Some bunkers sleep for days. | Follow Bunker's window plan to ring 6 (Cold Storage). The window length is on the Night Shift card. |
| `gull_botherer` | The gulls are keeping score. | Hello, Gull (non-secret) teaches that gulls can be poked; keep going. Pokes ride on the taps batch, so nothing closes it. |
| `kettle_drummer` | It rings like a dinner gong if you keep at it. | Knock Knock (non-secret) teaches the Kettle clangs; keep going. |
| `over_the_moon` | One flight is best watched after dark. | Moonshot (from Wipe Day #10) passes the moon at night; launch after dark until it plays. Flight School (Blast ring 3) lets you pick it. |
| `night_drone` | Something blinks in the dark water. | Catch a Drowned Drone after dark; drones blink on the water at night. |
| `elite_heap` | Some numbers are more elite than others. | Hold supplies whose leading digits read 1337 (1,337 or 13,37x or 1.337M on the Multipliers sheet). Scale-free, so kits and kept hands never close it. |
| `not_found` | Look for the number that is never found. | The counter shows three digits (404, 40.4k, 4.04M); wait for it to read 404 and act (any tap or buy). |
| `lucky_sevens` | Three of a kind, right on the counter. | As above with 777 (777k, 7.77B). Waiting without spending is always possible. |
| `oops` | Some people press it just to see. | Press the Big Red in a fresh run's first minute when it is pressable (a small blast). Easier as glass grows; never closed. |
| `wet_firework` | A dud looks even sadder in the rain. | Launch in rain until Sputter and Drop plays (Flight School can pick it). About 1 rainy nuke in 10. |
| `class_clown` | Laugh at every last one of them. | Log the other eight Jokes pages; the chapter shows 8/9. |

## 6. Later pages (130): R5, R6, R7

Each ships with its system, so nothing unshipped is teased. Columns: id, category, name, condition (JSON5), secret, and what the phase must add (a counter, predicate, event or field, budgeted in that phase like an unlock node). Hows, hints, icons and days are written in the phase.

### R5: scrap, the Magnet, ranks, Pockets, the Toolbelt, the Foreman, Dead Hand (40)

| id | Category | Name | Condition | S | Needs |
| --- | --- | --- | --- | --- | --- |
| `first_haul` | scrap | First Haul | `{stat: "hauls", gte: 1}` |  | counter hauls |
| `early_win` | scrap | Early Bird | `{event: "scrap_hauled", early: true, amountGte: 1}` |  |  |
| `old_boot` | scrap | Old Boot | `{event: "scrap_hauled", early: true, amountLte: 0}` | S |  |
| `rich_haul` | scrap | Gold Lump | `{event: "scrap_hauled", rich: true}` |  |  |
| `auto_haul` | scrap | Hauls Itself | `{event: "scrap_hauled", auto: true}` |  |  |
| `hauls_30` | scrap | Crane Operator | `{stat: "hauls", gte: 30}` |  |  |
| `hauls_100` | scrap | Magnet Keeper | `{stat: "hauls", gte: 100}` |  |  |
| `scrap_25` | scrap | Scrap Tin | `{stat: "scrap_earned", gte: 25}` |  | counter scrap_earned |
| `scrap_100` | scrap | Scrap Pile | `{stat: "scrap_earned", gte: 100}` |  |  |
| `tray_three` | scrap | Full Tray | `{state: "magnet_tray", gte: 3}` | S | predicate magnet_tray |
| `first_pocket` | scrap | Lined Pocket | `{stat: "pocket_slots", gte: 1}` |  | counter pocket_slots |
| `pockets_3` | scrap | Full Pockets | `{stat: "pocket_slots", gte: 3}` |  |  |
| `pocket_island` | scrap | Pocket Island | `{state: "pocketed", of: "island", gte: 1}` | S | predicate pocketed |
| `pocket_grip` | scrap | Pocket Tools | `{state: "pocketed", of: "grip", gte: 1}` |  |  |
| `pocket_shuffle` | scrap | Pocket Shuffle | `{stat: "pocket_swaps", gte: 5}` | S | counter pocket_swaps |
| `first_rank` | hands | Armband | `{stat: "ranks", gte: 1}` |  | counter ranks |
| `ranks_all_1` | hands | Gold Armbands | `{state: "rank_floor", gte: 1}` |  | predicate rank_floor |
| `ranks_all_2` | hands | Two Pips Each | `{state: "rank_floor", gte: 2}` |  |  |
| `ranks_all_3` | hands | Hat Bands | `{state: "rank_floor", gte: 3}` |  |  |
| `ranks_all_4` | hands | Four Pips Each | `{state: "rank_floor", gte: 4}` |  |  |
| `gold_star` | hands | Gold Star | `{event: "rank_bought", rank: 5}` |  | event rank_bought |
| `ranks_all_5` | hands | Gold Stars | `{state: "rank_floor", gte: 5}` |  |  |
| `first_locker` | flotsam | Barnacled Locker | `{stat: "flotsam", of: "sealed_locker", gte: 1}` |  |  |
| `lockers_10` | flotsam | Locker Room | `{stat: "flotsam", of: "sealed_locker", gte: 10}` |  |  |
| `double_shot` | flotsam | Double Shot | `{buffs: ["rally", "adrenaline"]}` |  |  |
| `first_rush` | toolbelt | Rush Job | `{stat: "tools", of: "rush", gte: 1}` |  | counter tools |
| `rush_100` | toolbelt | Always Rushing | `{stat: "tools", of: "rush", gte: 100}` |  |  |
| `first_grit` | toolbelt | Grit Your Teeth | `{stat: "tools", of: "grit", gte: 1}` |  |  |
| `grit_full` | toolbelt | Ten Stacks | `{state: "grit", gte: 10}` |  | predicate grit |
| `first_flare` | toolbelt | Flare Up | `{stat: "tools", of: "flare", gte: 1}` |  |  |
| `flares_50` | toolbelt | Flare Season | `{stat: "tools", of: "flare", gte: 50}` |  |  |
| `called_it` | toolbelt | Called It | `{event: "tool_used", tool: "flare", kind: "fuel_drum"}` | S | event tool_used |
| `overdrive` | toolbelt | Overdrive | `{buffs: ["adrenaline", "rush"]}` | S |  |
| `everything_at_once` | toolbelt | Everything at Once | `{buffs: ["rally", "adrenaline", "rush"]}` | S |  |
| `clipboard` | lines | Clipboard | `{stat: "foreman_units", gte: 1}` |  | counter foreman_units |
| `middle_management` | lines | Middle Management | `{stat: "foreman_units", gte: 10000}` |  |  |
| `bulk_order` | lines | Bulk Order | `{event: "collected", foremanUnitsGte: 1000}` | S | field collected.foremanUnits |
| `hands_free` | nukes | Hands Free | `{event: "nuked", counted: true, by: "dead_hand"}` |  | field nuked.by |
| `set_and_forget` | nukes | Set and Forget | `{stat: "dead_hand_wipes", gte: 10}` |  | counter dead_hand_wipes |
| `cold_feet` | nukes | Cold Feet | `{event: "dead_hand_stopped"}` | S | event dead_hand_stopped |

### R6: friends, counting events and never amounts (40)

The six `count_*` pages follow the Island Count tiers, 10 / 25 / 50 / 100 / 175 / 250 Wipe Days
(errata E17).

| id | Category | Name | Condition | S | Needs |
| --- | --- | --- | --- | --- | --- |
| `first_claim` | friends | Return Mail | `{stat: "blowback", gte: 1}` |  |  |
| `claims_10` | friends | Beach Mail | `{stat: "blowback", gte: 10}` |  |  |
| `claims_50` | friends | Shore Duty | `{stat: "blowback", gte: 50}` |  |  |
| `claims_200` | friends | Wash-up Collector | `{stat: "blowback", gte: 200}` |  |  |
| `full_shore` | friends | Full Shore | `{state: "crates_waiting", gte: 9}` |  | predicate crates_waiting |
| `soggy_parcel` | friends | Soggy Parcel | `{event: "blowback_claimed", weather: "rain"}` | S | field blowback_claimed.weather |
| `midnight_delivery` | friends | Midnight Delivery | `{event: "blowback_claimed", night: true}` | S |  |
| `spread_the_love` | friends | Spread the Love | `{event: "nuked", counted: true, islandsWashedGte: 3}` | S | field nuked.islandsWashed |
| `neighbourly` | friends | Neighbourly | `{stat: "crates_sent", gte: 100}` |  | counter crates_sent |
| `double_delivery` | friends | Double Delivery | `{event: "blowback_claimed", afterglow: true}` | S |  |
| `first_load` | friends | Loaded Up | `{stat: "loads", gte: 1}` |  |  |
| `six_deep` | friends | Six Crates Deep | `{state: "loads_this_week", gte: 6}` |  | predicate loads_this_week |
| `loads_50` | friends | Regular Shipper | `{stat: "loads", gte: 50}` |  |  |
| `loads_150` | friends | Freight Line | `{stat: "loads", gte: 150}` |  |  |
| `over_the_line` | friends | Over the Line | `{event: "freighter_loaded", tierGte: 1}` |  |  |
| `topped_off` | friends | Topped Off | `{event: "freighter_loaded", tier: 3}` |  |  |
| `four_mondays` | friends | Four Mondays | `{stat: "freighter_weeks", gte: 4}` |  | counter freighter_weeks |
| `twelve_mondays` | friends | Twelve Mondays | `{stat: "freighter_weeks", gte: 12}` |  |  |
| `pennant_up` | friends | Pennant Up | `{stat: "pennants", gte: 1}` |  | counter pennants |
| `pennant_row` | friends | Pennant Row | `{stat: "pennants", gte: 10}` |  |  |
| `count_10` | friends | Scorched Flag | `{state: "island_count", gte: 10}` |  | predicate island_count |
| `count_25` | friends | Glass Gull | `{state: "island_count", gte: 25}` |  |  |
| `count_50` | friends | Pockmarked | `{state: "island_count", gte: 50}` |  |  |
| `count_100` | friends | Century of Craters | `{state: "island_count", gte: 100}` |  |  |
| `count_175` | friends | Swiss Cheese | `{state: "island_count", gte: 175}` |  |  |
| `count_250` | friends | Crater Field | `{state: "island_count", gte: 250}` |  |  |
| `popping_round` | friends | Popping Round | `{stat: "visits", gte: 1}` |  | counter visits |
| `grand_tour` | friends | Grand Tour | `{state: "visited_all", eq: true}` | S | predicate visited_all |
| `nosy_neighbour` | friends | Nosy Neighbour | `{stat: "visits", gte: 25}` |  |  |
| `postcard_collector` | friends | Postcard Collector | `{stat: "postcards_viewed", gte: 10}` | S | counter postcards_viewed |
| `night_visit` | friends | Night Visit | `{event: "visited", night: true}` | S | event visited |
| `front_page` | nukes | Front Page | `{event: "nuked", counted: true, news: true}` |  |  |
| `three_in_a_row` | nukes | Hat Trick | `{event: "nuked", counted: true, foldedGte: 3}` | S |  |
| `best_blast_yet` | nukes | Best Blast Yet | `{event: "record_set", record: "best_blast"}` |  |  |
| `comeback_kid` | nukes | Comeback Kid | `{event: "record_set", record: "fastest_comeback"}` |  |  |
| `biggest_bang` | nukes | Biggest Bang | `{event: "record_set", record: "biggest_gain"}` | S |  |
| `on_the_board` | friends | On the Board | `{state: "boards_listed", gte: 1}` |  | predicate boards_listed |
| `seven_boards` | friends | Seven Boards | `{state: "boards_listed", gte: 7}` |  |  |
| `busy_month` | friends | Busy Month | `{stat: "month_pages", gte: 10}` |  | monthly counter pages |
| `tide_month` | friends | Tide Month | `{stat: "month_flotsam", gte: 50}` |  | monthly counter flotsam |

### R7: Dares, rings 7-9 and more of the rest (42)

| id | Category | Name | Condition | S | Needs |
| --- | --- | --- | --- | --- | --- |
| `sleepless` | dares | Sleepless | `{event: "dare_done", dare: "long_nights"}` |  |  |
| `rich_pickings` | dares | Rich Pickings | `{event: "dare_done", dare: "rich_tides"}` |  |  |
| `eye_of_the_storm` | dares | Storm's Eye | `{event: "dare_done", dare: "storm_season"}` |  |  |
| `hands_in_pockets` | dares | Hands in Pockets | `{event: "dare_done", dare: "quiet_raiders"}` |  |  |
| `changed_my_mind` | dares | Changed My Mind | `{stat: "dares_abandoned", gte: 1}` | S | counter dares_abandoned |
| `daredevil` | dares | Daredevil | `{state: "dares_done", gte: 4}` |  | predicate dares_done |
| `encore` | dares | Encore | `{event: "dare_done", repeat: true}` | S | field dare_done.repeat |
| `double_or_nothing` | dares | Double or Nothing | `{event: "dare_done", double: true}` | S | field dare_done.double |
| `seventh_ring` | map | Seventh Ring | `{event: "node_bought", ring: 7}` |  |  |
| `outer_rim` | map | Outer Rim | `{event: "node_bought", ring: 9}` |  |  |
| `nodes_200` | map | Big Burn | `{stat: "nodes", gte: 200}` |  |  |
| `nodes_300` | map | Scorched Earth | `{stat: "nodes", gte: 300}` |  |  |
| `whole_map` | map | The Whole Map | `{stat: "nodes", gte: 361}` |  |  |
| `three_keystones` | map | Three Keystones | `{state: "keystones_slotted", gte: 3}` |  |  |
| `edge_of_the_map` | map | Map's Edge | `{state: "sector_rings_lit", gte: 9}` | S |  |
| `full_circle` | map | Full Circle | `{event: "node_bought", ring: 9, type: "completion"}` |  |  |
| `lit_sign` | island | Lit Sign | `{stat: "wipe_days", gte: 50}` |  |  |
| `hundredth_wipe` | nukes | Hundredth Wipe | `{stat: "wipe_days", gte: 100}` |  |  |
| `glass_1m` | nukes | Glass Palace | `{stat: "glass_ever", gte: 1000000}` |  |  |
| `glass_10m` | nukes | Glass Mountain | `{stat: "glass_ever", gte: 10000000}` |  |  |
| `night_owl` | island | Night Owl | `{stat: "night_wipes", gte: 25}` | S | counter night_wipes |
| `storm_chaser` | island | Storm Chaser | `{stat: "rain_wipes", gte: 10}` | S | counter rain_wipes |
| `serial_fizzler` | jokes | Serial Fizzler | `{stat: "small_blasts", gte: 25}` | S |  |
| `felled_5000` | taps | Clear-Cut | `{stat: "felled", gte: 5000}` |  |  |
| `taps_100k` | taps | Iron Thumbs | `{stat: "taps", gte: 100000}` |  |  |
| `taps_500k` | taps | Thumbs of Steel | `{stat: "taps", gte: 500000}` |  |  |
| `crits_10k` | taps | Critical Mass | `{stat: "crits", gte: 10000}` | S |  |
| `flotsam_250` | flotsam | Sea Legs | `{stat: "flotsam", gte: 250}` |  |  |
| `crates_100` | flotsam | Crate Hoard | `{stat: "flotsam", of: "crate", gte: 100}` |  |  |
| `drums_100` | flotsam | Drum Line | `{stat: "flotsam", of: "fuel_drum", gte: 100}` |  |  |
| `adrenaline_25` | flotsam | Wired | `{stat: "flotsam", of: "adrenaline", gte: 25}` |  |  |
| `drones_25` | flotsam | Drone Pilot | `{stat: "flotsam", of: "drowned_drone", gte: 25}` | S |  |
| `bottles_5` | flotsam | Pen Pal | `{stat: "flotsam", of: "bottle", gte: 5}` | S |  |
| `collects_250` | night_shift | Creature of Habit | `{stat: "collects", gte: 250}` |  |  |
| `two_day_shift` | night_shift | Two-Day Shift | `{state: "window_hours", gte: 48}` |  |  |
| `armored_100` | eras | Armor Veteran | `{stat: "eras", of: "hqm", gte: 100}` |  |  |
| `units_100k` | lines | Boomtown | `{stat: "units", gte: 100000}` |  |  |
| `upgrades_2500` | lines | Collector's Shelf | `{stat: "upgrades", gte: 2500}` |  |  |
| `pages_150` | jokes | Thick Book | `{pages: {gte: 150}}` |  |  |
| `pages_200` | jokes | Doorstop | `{pages: {gte: 200}}` |  |  |
| `gull_nemesis` | island | Gull Nemesis | `{stat: "pokes", of: "gull", gte: 1000}` | S |  |
| `kettle_concerto` | island | Kettle Concerto | `{stat: "pokes", of: "kettle", gte: 1000}` | S |  |

### With the eight later Dares (`05` 8.3), whenever each ships (8)

| id | Category | Name | Condition | S | Needs |
| --- | --- | --- | --- | --- | --- |
| `bare_knuckles` | dares | Bare Knuckles | `{event: "dare_done", dare: "bare_hands"}` |  | ships with its Dare |
| `unlucky_thirteen` | dares | Unlucky Thirteen | `{event: "dare_done", dare: "thirteen"}` |  | ships with its Dare |
| `speed_demon` | dares | Speed Demon | `{event: "dare_done", dare: "speed_wipe"}` |  | ships with its Dare |
| `twig_forever` | dares | Twig Forever | `{event: "dare_done", dare: "twig_only"}` |  | ships with its Dare |
| `bare_bones` | dares | Bare Bones | `{event: "dare_done", dare: "skeleton_crew"}` |  | ships with its Dare |
| `flat_sea` | dares | Flat Sea | `{event: "dare_done", dare: "dead_calm"}` |  | ships with its Dare |
| `plain_living` | dares | Plain Living | `{event: "dare_done", dare: "no_frills"}` |  | ships with its Dare |
| `belt_undone` | dares | Belt Undone | `{event: "dare_done", dare: "empty_belt"}` |  | ships with its Dare |

Later pages by category: dares 16, eras 1, flotsam 9, friends 35, hands 7, island 5, jokes 3, lines 5, map 8, night_shift 2, nukes 11, scrap 15, taps 4, toolbelt 9. Secrets among them: 30. Catalog total: 250 pages, 60 secrets (`05` 1.4 plans about 250 with 60 secrets). Later secrets get their hints, written to the same rules as section 5, in their phase.

## 7. What the later phases add to the vocabulary

| Phase | Addition | Pages using it first |
| --- | --- | --- |
| R5 | counter dead_hand_wipes | 1 |
| R5 | counter foreman_units | 1 |
| R5 | counter hauls | 1 |
| R5 | counter pocket_slots | 1 |
| R5 | counter pocket_swaps | 1 |
| R5 | counter ranks | 1 |
| R5 | counter scrap_earned | 1 |
| R5 | counter tools | 1 |
| R5 | event dead_hand_stopped | 1 |
| R5 | event rank_bought | 1 |
| R5 | event tool_used | 1 |
| R5 | field collected.foremanUnits | 1 |
| R5 | field nuked.by | 1 |
| R5 | predicate grit | 1 |
| R5 | predicate magnet_tray | 1 |
| R5 | predicate pocketed | 1 |
| R5 | predicate rank_floor | 1 |
| R6 | counter crates_sent | 1 |
| R6 | counter freighter_weeks | 1 |
| R6 | counter pennants | 1 |
| R6 | counter postcards_viewed | 1 |
| R6 | counter visits | 1 |
| R6 | event visited | 1 |
| R6 | field blowback_claimed.weather | 1 |
| R6 | field nuked.islandsWashed | 1 |
| R6 | monthly counter flotsam | 1 |
| R6 | monthly counter pages | 1 |
| R6 | predicate boards_listed | 1 |
| R6 | predicate crates_waiting | 1 |
| R6 | predicate island_count | 1 |
| R6 | predicate loads_this_week | 1 |
| R6 | predicate visited_all | 1 |
| R7 | counter dares_abandoned | 1 |
| R7 | counter night_wipes | 1 |
| R7 | counter rain_wipes | 1 |
| R7 | field dare_done.double | 1 |
| R7 | field dare_done.repeat | 1 |
| R7 | predicate dares_done | 1 |

## 8. Open questions and deviations from the brief

1. **`supplies_floor` → `supplies_digits`.** The brief's `elite_heap` checks `floor(supplies) =
   1337` and says it is easiest at a run's start. From Wipe Day #1 most players own Starter Kit
   and Old Friends, so Mara works 10 Beachcombers from the first second and supplies jump by
   thousands per whole second: an exact small number becomes practically impossible after two
   cheap ring-1 nodes, against rule 4. The leading-digit form is scale-free: 404 reads as 404,
   40.4k or 4.04M on the three-digit counter, and simply waiting without spending always passes
   through it. It keeps the predicate count at 12. If the owner prefers the exact form, the three
   digit jokes become run-1-only and should be replaced.
2. **Flight page ids.** The brief's example uses `loop_the_loop` as a page id, but rule 7 forbids
   reusing a content id (it is the flight's id). Flight pages are `flight_<variant>`; their names
   are the flights' names, the one deliberate shared name (like a sector named for its theme).
3. **Deliverable names.** The brief asks for `05b-logbook.md`; this run's task named
   `05b-logbook-catalog.md` plus `05b-logbook.json`. Rename on approval if wanted.
4. **Growth pages.** The brief allows "at most 30" growth rows with full columns; the task asked
   for the full ~130 later list (id, category, name, condition, phase), matching `05` 1.2's
   40 / 40 / 50 growth. Their hows, hints, icons and days are written in their phase.
5. **Buff combos in R4.** `05` 1.9 says natural flotsam never overlaps a Rally, so `double_shot`
   waits for the Flare. Two R2-R3 nodes already allow an overlap: Hot Breakfast (a Rally at
   Collect after 6 h away) and Drag Line (a missed drum waits on the beach). `full_throttle`
   (Rally plus Drowned Drone) uses that in R4; `double_shot` stays R5 as the brief says.
6. **`held` trusts the client** for which taps were held (the server cannot tell). Clamped by the
   batch and worth one page, so the risk is a page logged early. Alternative: drop `hold_steady`
   and use a plain tap count.
7. **Day estimates** come from the plan's casual numbers (`03` 1.3, `05` 2.3, `10-balance.md`
   2.1), not from simulator runs. R4 should replace them with the simulator's first-find days and
   re-check the bands (15-25 / 45-55 / 70-80 / 90-100).
8. **Rule 3 and R6.** "Needs a friend" is forbidden for R4 pages. The R6 list counts only the
   player's own social actions (claims, loads, visits, own records), but Blowback, the Island
   Count and the Freighter tiers still need at least one friend to nuke or load. With the group
   always two or more, this is accepted for R6; no page compares two players or races for a
   first find.
9. **Tin Roof Sprint.** `metal_sprint` keeps the brief's id and name, which sits beside the Tin
   Roofs node (Works ring 7, R7). Once Tin Roofs starts runs in Sheet Metal the page can no longer
   be logged; it is not a secret and players log it in week 1, but the naming pass may rename it
   and R7 may let a start era count as reached at second 0 for this one page.

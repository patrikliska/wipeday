# 01. Why change, and what Wipe Day becomes

Status: a proposal for the owner, 2026-10-07. It follows `canon.md`, the orchestrator's
amendments and the design director's resolutions (canon v2); the resolutions win where they
differ. Nothing in `CLAUDE.md`, `docs/game-design.md`, `docs/roadmap.md` or `docs/decisions.md`
changes until the owner approves. On approval the plan moves to `docs/redesign/`, and R0 rewrites
those files from it, archives today's design as `docs/archive/game-design-v1.md` and logs
decisions from D127. Names marked *(proposal)* wait for the owner's naming pass. Numbers come from
the tuned model P1 in `10-balance.md`, which the simulator owns; numbers that are only examples
are marked *illustrative*.

---

## 1. The owner's brief, ask by ask

### 1.1 The brief

> "Hi, our game is nearly finished as a beta version for testing! Currently i work on svg icons to
> fill. from you i need to investigate and think about game. I dont like now the process. Whole game
> should be idle game, automatization with MASSIVE tree where ppl will spend their "ascending points"
> (we can call them another way) and whole idle game should be more flexible, player should feel and
> want to play game more and more, so starting from nearly nothing clicking like crazy to get things
> moving and automated. Take inspiration from games like Cookie clicker Melvor Idle and Melvor Idle 2,
> AdVenture Capitalist, Clicker Heroes, Realm Grinder, Egg, Inc.
> If you think its good idea to remove seasons or other stuff let me know.
> I was players to ascend the way that they will do something like = player will be given option
> (after progressing in the game) to push "weirdly looking red button" which will basically fire
> nuclear missile and destroys whole island with them. this will be funny like concept how to ascend.
> Then they will get ascending points, we can rework Scrap to make it more RARE or we can add
> something else, like blueprint fragmets etc etc.. This game is highly inspirated by
> postapocaliptic world and game called RUST.
> Create a plan how to improve this whole scenario, dont code the game, just full planning"

### 1.2 Every ask, answered

In "Where", `02` means `02-the-run.md` and so on; plain numbers are sections of this file.

| # | The owner's words | The plan's answer | Where |
| --- | --- | --- | --- |
| 1 | "I dont like now the process" | Agreed: today's loop is a check-in game with few purchases, long timers and caps (section 2). The plan replaces the process and keeps the engine. | 2; `07` |
| 2 | "Whole game should be idle game, automatization" | Yes. 14 lines on geometric cost curves; each starts manual and runs forever once a named hand is hired, at 100% while you are away (the Night Shift, 12-48 h). Then bulk buying, kept hands, the Foreman, Dead Hand. | `02`, `05` |
| 3 | "MASSIVE tree where ppl will spend their ascending points" | The **Blast Map**: 361 permanent nodes, 8 sectors × 9 rings around Ground Zero, shipped in waves (73 in R2, 201 by R5, 361 in R7). Not finished before day 90 (N15); the model's optimal player owns 37% at day 30. | `04` |
| 4 | "ascending points (we can call them another way)" | **Crater Glass**, the sand your blast fuses. A nuke pays the growth of `floor((L / 5e5)^(1/5))`, `L` being lifetime supplies, so 10 glass need 50B made. Glass ever drives **Glow** (`1 + 0.25√G`) on everything; glass held buys nodes; spending never lowers Glow. | `03`, `10` |
| 5 | "more flexible" | Tap hard or idle (Hustle or the Night Shift, and keystones for each), nuke when you choose, grow any of 8 sectors, slot keystones, keep upgrades in Pockets, take on Dares. Two minutes or twenty both count; no timer gates a purchase. | `02`, `04`, `05` |
| 6 | "want to play game more and more" | Always something to buy (N5-N7), every run faster than the last (N11), a new unlock every few Wipe Days ("Next Wipe Day unlocks …"), a tree that lasts months, flotsam and friends' blasts in between, and nothing lost while away. | `02`, `03`, `10` |
| 7 | "starting from nearly nothing clicking like crazy to get things moving and automated" | A beach, one glowing pine and "Tap the tree." Taps and the lines they drive make over half of run 1's first minute (55% in the model); Hustle, felling and flotsam reward a fast thumb, and holding counts as 4 taps a second. The first hand comes at about 0:41. Gather's cooldown and the daily haul go. | `02`; `09` |
| 8 | "Take inspiration from games like …" | What each of the six gave, and what was left out on purpose. | 1.4 |
| 9 | "remove seasons or other stuff" | **Seasons: yes, as a reset. Other stuff: yes, most of what W3-W7 built.** | 1.3; `07` |
| 10 | "push 'weirdly looking red button' … destroys whole island … funny" | **The Big Red**, a red dome on an oil drum under a hazard-taped toilet-seat lid, beside **the Kettle**, a boiler on stilts with a traffic-cone nose that assembles as your yield grows. Hold 2 s, a 6-8 s cinematic, a postcard from Ground Zero; crew one-liners, flight variants and a "WIPE DAY #N" crater carry the jokes. The only reset, and you choose when. | `03` |
| 11 | "rework Scrap to make it more RARE" | **Yes.** Scrap leaves the run: the **Magnet** hauls about one a day, a few other sources add a little, nobody earns over 2.5 a day. It buys crew ranks (×2 to a line, forever) and Pocket slots, and is never traded, gambled or at risk. | `05` |
| 12 | "or we can add something else, like blueprint fragmets" | **Something else, under our own name.** Blueprint Fragments is a real Rust item (D43), and "blueprint" promises crafting, which is cut. Its job goes to Crater Glass; **Pockets** keep chosen upgrades through a nuke. | `03`, `05`, `07` |
| 13 | "postapocaliptic world and game called RUST" | In mechanics and mood, never names (section 3); every line shows its product with the owner's icons (A1). | 3; `07` |
| 14 | "dont code the game, just full planning" | Eleven plan files; no code or repository doc changed. Phases, acceptance criteria and kickoff prompts: `11-roadmap.md`. | `11` |
| 15 | "Currently i work on svg icons to fill" | What to draw now, what to stop, the file format. | 1.5 |

### 1.3 Seasons and the other stuff

**Seasons.** A monthly forced wipe and a player-chosen nuke compete for one emotion, and the
forced one loses. Your own red button is funny and chosen; a calendar reset is neither, and it
punishes the friend who joins on day 25. Removing it costs no SQL: one season row stays forever,
and `pnpm season end` runs once more, at the cut-over, with no `season announce`: the bot is kept
stopped while it runs, and a message from the owner is optional (errata E3; decision 7). "Month" survives as a board window, the four
season modifiers become Dares with the same ids, and the Signal goes. Season 1 (started
2026-10-07; nobody plays it now) runs untouched on the current build until R2 ships, then ends
quietly. The
cut-over deletes run state only: players, sessions, push devices, settings, the season rows,
`season_archive`, `hall_of_fame`, `legacy` and `event_log` with its sequence stay, so season 1
lives on as "the old world".

**What else goes** (reasons in `07-what-changes.md`):

| Verdict | Systems |
| --- | --- |
| Removed | Gather and its cooldown; the daily haul; build timers and builders; upkeep and decay; storage caps; 22 of 23 stocked resources (scrap stays, rare; ten of the ids live on as product badges, A1); the crafting web, queues, parts and salvage; blueprints; items; daily tasks; the Den counter, contracts, market and casino; NPC raids, defence and bandit camps; PvP; monthly seasons and the Signal; the 25% legacy cap |
| Parked in git | Expeditions, the fogged map, sites, regions, keycodes, report cards (a possible sea layer after R6) |
| Reworked | Tools → **Grip**; tiers → **eras** re-climbed every run; 11 buildings → **lines**; crew → **hands**; barrels → **flotsam**; modifiers → **Dares**; perks → Blast Map nodes |
| Kept | The architecture, the scene, welcome back, the advisor, weather and day/night (now domain data), skins and titles, feed and Web Push, the Discord companion, backups, the screenshot harness |

`CLAUDE.md` section 1 still holds: UI and UX first, zero tutorial (five 6.3 rules amended and
one added, `08-screens.md`), private, own-IP and free of real money, for a handful of friends at
very different levels (`06-friends.md`).

### 1.4 The six reference games

In one line: AdVenture Capitalist gives the run, Cookie Clicker the bursts and the prestige
shape, Clicker Heroes the Toolbelt and the second layer, Realm Grinder the agenda and the Dares,
Egg, Inc. the feel of the tap and the co-op, Melvor the respect for time away. Every name is our
own (D43). Research: `research/ref-cookie-adcap.md`, `ref-clickerheroes-realmgrinder.md`,
`ref-egginc-melvor.md`.

| Game | Taken, and where it lives | Left out on purpose |
| --- | --- | --- |
| Cookie Clicker | One big thing to tap, taps that grow with output (Grip). Golden cookies: **flotsam**, 13 s on screen; "Lucky" (`min(15% of the bank, 15 min of output)`) becomes the Drift Crate. The prestige shape: a root of lifetime paid as a delta, a kept level apart from a spent currency (glass ever, glass held). The heavenly tree: the Blast Map's digit-pattern prices, the Starter Kit, permanent slots (**Pockets**). Achievements as power: **Logbook** and Morale. Sugar lumps (20/23/24 h): the **Magnet**. Golden Switch: Bunker Mentality. | Minigames, wrinklers and the grandmapocalypse: each needs a sentence ("one glance"). Calendar seasons. 0% offline until bought. Click Frenzy's ×777 stacking: P1 tames bursts (Adrenaline ×100, Rally ×4) so an active hour stays 1.5-3× an idle one (N9, on the weather-weighted hour; errata E13). |
| Melvor Idle, Melvor Idle 2 (announced, not released) | Offline at the full online rate inside a window, summed up on return: the **Night Shift** and welcome back. Melvor Idle 2's "automation as a core mechanic", each chore removed by a visible upgrade: hands, bulk buying, the Foreman. Restricted runs (Ancient Relics) and plain tasks instead of formulas: **Dares** and Logbook pages, shown in full. | The RuneScape breadth (dozens of skills, 1,279 items, a bank, interlocks, combat): the shape W3-W7 built and the owner dislikes. One action at a time and its dead time. No prestige. |
| AdVenture Capitalist | The run: tap a line per cycle until a manager (our **hand**) runs it forever, offline too. ×12 cost per tier, gentler growth for dear tiers (ours ×16, 1.15 down to 1.072). Ownership milestones (speed ×2 at 25 and 50) and all-business unlocks (**roster milestones**). The ×1 / ×10 / ×100 / Max toggle. Gilding: **crew ranks**. Events that refresh without a wipe: the case against seasons. | Angel sacrifice, where spending loses the bonus (glass ever never falls). Gold, ads, time warps, gacha. Moon and Mars for now: the Crossing is only a hook. |
| Clicker Heroes | Clicks that add a share of output per second (Grip's `p`). Real-second skills on long cooldowns: Clickstorm becomes **Rush**, Dark Ritual (×1.05 for the run, 8 h) becomes **Grit**. Idle and active builds: keystones. The "I'm a god now" second run. Transcendence, a log-scaled second layer: **the Crossing** and Sea Charts. Auto-clickers kept forever: kept hands. | Calculator-solved ancients. Meta-skills (Energize, Reload): the Toolbelt stays at three. The boss timer. Rubies and bought time skips. Hidden mercenary lifespans. Clicker Heroes 2's reset that only gives back what you lost: every Wipe Day opens something. |
| Realm Grinder | The reincarnation unlock list: the **agenda**. Challenges with a constraint, a goal and a permanent reward: **Dares**, with the full text shown. Research slots re-picked every run: the **keystone loadout**. Silly secret trophies (exactly 1,337 coins): Logbook secrets with hints. Factions, kept as deferred creeds (at most three, and only if they change the verbs). | Factions now: balance surface against priority 4, and early ones "feel the same". Mana and spells. Three prestige layers and the value shift; our numbers stay under 1e150 (N23). Requirements hidden behind a wiki. |
| Egg, Inc. | Tap a big button, then **hold to work**. The Running Chicken Bonus, a meter that drains when you stop: **Hustle**. Drones through the scene: flotsam. Silos, an offline window that grows: the Night Shift's Bunker nodes. The half-built rocket pad: the Kettle assembling on the slope. Epic research: the permanent tree. Co-op contracts: the **Freighter**, in each player's own hours. | Co-op grades, kicks and sleep-breaking deadlines. The hidden catch-up multiplier on drones: Late Tide is printed. Boost and token spreadsheets. Golden eggs, ads, the piggy bank. Vigintillions. |

### 1.5 What to draw now (the SVG icons)

Today every icon in the game is a lettered placeholder tile (`apps/web/src/hud/Icon.tsx`). The
new art goes to `packages/content/icons/<kind>/<id>.svg` (the kinds are in `07-what-changes.md`
8.1): a 48-unit square viewBox, main shapes in `currentColor`, flat vector with no raster, text or
gradients, and a silhouette you can still name at 16 px. A missing icon falls back to the tile, so
no phase waits for art.

1. **Now, in this order** (all survive the redesign): `currency/scrap` (top priority, the rare
   gold chip); the 11 product badges `timber`, `roast`, `fibre`, `rope`, `planks`, `charcoal`,
   `ingots`, `leather`, `fuel`, `food`, `plates`; lines 2-12 (`campfire` to `radio_mast`); the
   era badges `twig`, `wood`, `stone`, `metal`, `hqm` and the Grip tools `rock` to `power_tools`;
   the targets `tree`, `stone`, `ore`, `sulfur` and `flotsam/crate`; the 12 crew portraits.
2. **New for R1:** `supplies` (a lashed bundle), `hustle`, `hand`, `night_shift`, `wreck`; lines
   `beachcomber`, `shipbreaker`, `reactor`; portraits `gus`, `vera`; products `battery`,
   `broadcast`, `cell`; flotsam `fuel_drum`, `adrenaline`; the five nav icons; shop `upgrade`,
   `roster`, `buy_max`. R2 and later: `07-what-changes.md` 8.5.
3. **Stop now:** the 12 resources that are not products, the items other than `crate`, `roast`
   and the keycodes (which wait for a sea layer), the furnace types, the defence buildings, and
   the casino, Signal, contract, Den and task art (`07-what-changes.md` 8.4).

---

## 2. What is wrong with today's loop

Wipe Day today is a well-built **check-in game**. The problem is its shape, not its build
quality. The evidence below comes from the code survey of commit `58533e4`.

| # | Problem | Evidence | The plan instead |
| --- | --- | --- | --- |
| 1 | Too few purchases | A season holds about **62 purchases** (4 tiers, 4 tools, 18 buildings × 3 levels) against 84 check-ins: less than one upgrade per visit. | A run has thousands of line units, 44 shelf upgrades and 14 hands. |
| 2 | About ×30 growth a month | Output goes from 4 to 121 scrap-equivalent an hour. Curves are hand-tuned in 3-5 steps; tier costs jump ×5.2, ×23.3, ×0.98. Each building level costs ~×3.1 more for a linear gain, so every level is worse value than the last. | Each rung costs ×16 more and outputs ×4.75 more, so the cheapest output keeps moving between lines; milestones multiply. |
| 3 | Additive bonuses | `Modifiers` (`modifiers.ts`) is a flat struct of about 25 additive fields. Perks dilute in the same buckets, and a new effect touches 4-5 places. | Effects as data, folded once: base → add → milestones → (1 + Σinc) → Πmore → Glow → Morale → buffs. |
| 4 | Caps are the real wall | A scripted hyperactive player fills the Twig timber cap by minute ~20 and Timber's by ~90. Later, engaged players sit at 100% storage from day 22-27 with nothing left to buy: the whole season's shop costs about one week of end-game output. | No caps. The Night Shift window (12-48 h) limits only offline time, and line growth gives a sink with no end. |
| 5 | Clicking is capped on purpose | The daily haul (D63) pays 180 production-minutes a day in full, then 10%; hard play uses it up in 10 minutes. Gather is one tap per 10 minutes. | Taps start every run; a 15-a-second token bucket is the only limit. |
| 6 | Timers set the rhythm | Builds up to 24 h, furnaces 8-17 h, queues up to 20 h, trips up to 12 h, barrels every 4 h, raids at night. | Purchases are instant; only the Night Shift, the Magnet, cooldowns and the Freighter use the game clock. |
| 7 | Absence is punished | Upkeep and decay (D27, D72), crew tiredness, raids taking up to 5%. | Absence never hurts (guardrail 7). |
| 8 | Guardrails against the genre | "8 check-ins ≈ 1.6×" (never asserted in `checkPacing`). "A veteran is never more than 25% stronger", enforced four times (`CLAUDE.md` 8, `checkLegacy`, `perkBonusSchema`, 12,288 combinations in `legacy.test.ts`). Anti-rush floors on days 14 and 18. | New guardrails (canon 14), asserted as N1-N27 (as amended) by simulator v2. |
| 9 | A shared, absolute economy | One table, `den.json5` `market.refPer100`, prices the Den, contracts, the market floor, the Wealth board, Signal gifts and raid strength. The tier ladder fences casino bets, PvP and raid ceilings. Friends at 1e3 and 1e12 break both yardsticks. | Social features count events, times, ratios and each player's own hours. |
| 10 | The engine stops at 2^53 and "B" | Amounts are `z.int()`, and `abbrev` prints 1e12 as "1000B". Each tap is a full round trip that rewrites the whole state, about 140-280 KB/s of SQLite writes at 10 taps a second. A network error empties the predicted queue (`store.ts:475-479`). | Finite doubles behind `Amount`, a formatter to Dc and beyond, batched taps with slim records. |

**What is good, and stays.** W0-W8 built a real foundation:

- **The engine:** the injected `Clock` (D51), seeded randomness, idempotent commands (D59),
  client prediction (D64), `LocalBackend`, `World`, SSE and lazy settling. The nuke is one more
  pure domain function on top.
- **The scene:** procedural art (D41), 11 building drawings that become lines, the tier pop,
  weather, day and night, the `lights` layer (D47), the tree's fall and regrow, and the floaters.
- **The UX rules** in `CLAUDE.md` 6.3: zero tutorial, one primary, disabled buttons that explain
  themselves, welcome back, and an advisor whose hints retire.
- **Content ids** that survive: the five tiers and their colours, five tools, 12 crew, 11
  buildings, ten resource ids and the `roast` item as product badges, eight perk ids (now nodes),
  four modifier ids (now Dares), the crate and three skins.
- **Operations:** the VPS, nightly backups (D54), `event_log`, the feed, Web Push, the Discord
  companion (D121-D126), `pnpm web:shots` (D44) and the simulator harness.

The sunk cost is real: about 60% of W3-W7 goes. It is tagged `pre-redesign`, and parked
systems can return.

---

## 3. The pitch, the five pillars, and where Rust lives

**Pitch.** You wash up on Saltmarsh with nothing. One tree stands on the rise. Tap it, and
supplies pour out. Spend them up a 14-rung ladder from beachcombers to a pre-war reactor. A line
without a hand only works while you tap; hire one and it runs forever, even while you sleep.
Meanwhile, on the slope, someone is bolting together a boiler on stilts with a traffic-cone
nose: *the Kettle*. Beside it, under a hinged lid, sits a fat red button. Press it, and your own
missile flattens your own island. The crater glass it leaves is all that lasts. Spend it on the
Blast Map, 361 nodes around Ground Zero, and the next island goes up faster.

**The five pillars** (they replace `docs/game-design.md` section 1):

| # | Pillar | What it rules out |
| --- | --- | --- |
| 1 | **One glance, one number, one tap.** One big number going up, one thing to tap, one crowned purchase. | A run mechanic that needs a sentence: it goes in the tree. |
| 2 | **Tap to start it, hire to keep it.** Every line starts manual and becomes automatic. | Lines you tend forever. |
| 3 | **Boom is progress.** The nuke is the only reset. You choose it, and it always shows what it gives. | Forced wipes, decay, raids. |
| 4 | **The island tells the story.** Every line, milestone, era and hand is drawn. | Progress that lives only in a panel. |
| 5 | **Friends cheer, never compete for stock.** Social features count events, times and ratios, never amounts. | Trading, gifting, PvP, shared absolute projects. |

The priority order in `CLAUDE.md` section 1 does not change.

**Three currencies.** The run has one spendable number, **Supplies**. **Crater Glass** comes
only from the nuke and buys only Blast Map nodes. **Scrap** is the rare gold chip with small
integers (recorded from the first Wipe Day; the chip appears in R5 with its sinks). **Glow** (from
glass ever earned), **Morale** (from Logbook pages) and **Hustle** (the tap meter) are
multipliers, never spent. Spending glass never lowers Glow.

**Where Rust lives** (mechanics and mood, never names, per D43):

- the tool ladder, as Grip: Rock, Stone Tools, Iron Tools, Salvaged Tools, Power Tools;
- the five tiers re-climbed every run, from Twig to Armored;
- gathering on a tree, an outcrop, an ore seam, a sulfur vent and a wreck;
- products you can see (driftwood, ingots, oil drums, steel plates), drawn with the owner's
  resource icons (A1);
- scrap as the precious currency;
- jank homemade engineering: the Kettle, hazard tape, a red dome on an oil drum;
- the wipe as a ritual: "Wipe Day" is the day you wipe your own island.

---

## 4. The experience over time

### 4.1 The first ten minutes (phone, 390 px; continuous play at 6 taps a second)

Times are the P1 model's (resolution 29, errata E1). R1 may slow the very first minute, for example with a
dearer Timber era, if playtests find it rushed, within the N-asserts. The crown goes to an era
before a hand.

| Time | What happens |
| --- | --- |
| 0:00 | Dawn: a twig lean-to, three crew at a dead fire, a big glowing pine on the rise. The only text: "Tap the tree." Each tap pops "+1" and sheds leaves. |
| 0:02 | The drawer slides up with one crowned row: **Beachcomber, 6**. A figure walks to the tideline; the row says "Runs while you tap". |
| 0:07 | Forty taps: the tree falls ("Timber!"), pays ten taps, and a new one pops up. |
| 0:08 | **Stone Tools** (60): taps ×2 and +0.4% of supplies per second. |
| 0:12 | 10 Beachcombers: "×2", a sorting table appears, and the row now reads "10/25 → speed ×2". |
| 0:36 | **Timber era** (1.5k): a timber cabin pops up, the target becomes an outcrop, three locked rows appear with prices. |
| 0:41 | **Hire Mara** (1.8k): she walks to the tideline and the bar loops without taps. Hint: "Hands keep a line running, even while you're away." The nav row slides in with Crew, its first destination. |
| 1:30 | Second hand; the ×10 / ×100 / Max toggle appears. |
| 3:00 | The first flotsam, a crate, bobs in for 13 s: "+2 min of supplies". Run 1's guaranteed crate pays a flat 2 minutes of output and returns every 3 minutes until caught (errata E1). |
| 3:01 | **Sorting Tables** (1M), the first island upgrade: everything ×2. |
| 4:30 | **Stone era** (3M); the target becomes an ore seam. |
| 9:36 | The fifth hand. |
| 9-10 min | At 500M supplies made a taped "DO NOT" pad rises on the slope beside a drum with a red dome under a lid. Its card: "The first launch needs 10 glass, at 50B supplies made", with a progress bar: locked, with its reason, never hidden. The pad and its card ship in R2 (errata E2). |

### 4.2 The first hour (active, about 6 taps a second)

Tapping still pays: Grip adds 0.4% of supplies per second to every tap and Hustle doubles it,
so from minute 10 taps are about 14% of income outside bursts (N8 wants 5-25%). At a yield of 5
glass (13:16) the Kettle's frame, a boiler on stilts, goes up on the pad. Stone carries the middle
half hour. **Sheet Metal** lands at about **45:46**: the base redraws in its tier colour and the
target becomes a sulfur vent that goes "Pop!". About eight flotsam are caught: a Fuel Drum's Rally
runs every line ×4 for 60 s, and a rare Adrenaline Kit makes taps ×100 for 12 s. At a yield of 10
(50B made) the warhead goes on, a taped crate with a traffic-cone nose; steam curls, and a crew
member keeps glancing at it. **The first nuke comes at about 46-48 minutes** (errata E1; N1
wants 40-60), worth 10 glass.

### 4.3 Day 1 for a casual player (08:00, 13:00, 21:00, about 5 minutes each at 4 taps a second)

- **08:00.** The first minutes of the script, at a slower thumb. She leaves after about 40
  purchases with the Timber era and Mara on the Beachcomber.
- **13:00.** One welcome-back card, one **Collect**: five hours of Night Shift, about 80M
  supplies made so far. The crown goes to the **Stone era**, then to hands; she leaves with four
  hands and Sorting Tables (yield 2 of 10), still short of the 500M that raise the DO-NOT pad
  (errata E2).
- **21:00.** Collect again: about 40B made, yield 9. The DO-NOT pad and the drum stand on the
  slope with their progress bar, and the Kettle's frame is up. Welcome
  back's primary is always Collect, never the nuke. A minute of tapping takes the yield to 10:
  the warhead goes on, then fuel and steam, and the crown moves to a hazard-framed chip above the
  drawer: "Big Red: +10 glass". **The first nuke lands at the day-1 21:00 check-in** (N3, on 12 of
  12 seeds).
- **Overnight.** Run 2 works on Mara, kept by Old Friends, and on whatever she hires after the
  blast. The 11 hours to 08:00 fit inside the 12-hour Night Shift from day 1.

### 4.4 The first nuke (staging in `03-the-big-red.md`)

The cover card, in danger style, reads **+10 glass · Glow ×1.00 → ×1.79 · This Wipe Day
unlocks: the Blast Map, Glow and Afterglow**. It lists what is kept and what is lost, then offers
**Flip the lid** or **Not yet**. She holds for 2 s against a rising siren, and a crew member says
"I *just* fixed the roof." The crew sprint to the rowboat, one runs back for the toaster, and the
Kettle sputters up, arcs over the sea and comes back: a U-turn, the first flight variant for the
Logbook. A white flash, a fireball, a mushroom cloud and a burnt orange sky follow.

The postcard says "Greetings from Ground Zero" over a crater with a **WIPE DAY #1** sign; its
back says "Next Wipe Day unlocks: the Armored era". Its one button, **Open the Blast Map**, lands
on the advisor's pulsing pick (errata E6). The guided basket is six ring-1 nodes for 9 glass, with 1 left for a
seventh (N14): Starter Kit (on the naming-pass list, errata E27; 10 Beachcombers and 5 Campfires at every start), Calloused Hands (taps
+50%), Deep Cellars (Night Shift +4 h), Hot Coals (Campfires +100%), Old Friends (Mara's hire
survives nukes) and Bigger Payload (+10% glass). The first Wipe Day also records 3 scrap.
**Rebuild** (the map's "< Rebuild" lands the boat): a sapling pokes out of the glassy crater, a lean-to pops up, ash falls from a green
sky, and from the first tap **Afterglow** multiplies taps by `1 + 2 × 2^(−t/300 s)`: ×3, the bonus
halving every 5 minutes, gone after about 30. The feed and `#wipe-day-idle` read: "Ben pressed the
Big Red. Wipe Day #1 on Saltmarsh: +10 crater glass."

### 4.5 Run 2: "I'm a god now"

Ten Beachcombers and five Campfires are already standing. Mara walks straight from the rowboat
to the tideline, every tap is worth ×1.5 × 3, and Glow multiplies everything by 1.79. Eras that
took minutes take seconds *(illustrative)*. The asserted promise (N11, amended): early runs pass
the previous run's whole gain in at most 65% of its time (median, warn-only until R7); in the
model the medians are 42-63% by archetype, and the active player's run 2 needs only 28%. The
advisor crowns the Big Red again when the gain would double glass ever, when the run's glass rate
falls below 80% of its peak (a rate simulator v2 re-checks with the advisor's own definition; if it
fires too late for active players it becomes the last-hour rate, an R2 tuning item, errata E28), or once the run is 20 hours old (the last two only if the nuke
counts: a press worth under +10% of glass ever is a quiet *small blast* that pays its glass and
moves no counter). Wipe Day #2 opens the Armored era. This is where the loop clicks: losing everything was
the price of getting faster.

### 4.6 The first week

About one Wipe Day a day for a casual player; eleven in the week for the active player. These P1
figures replace canon 4.10's first week and month in R0's rewrite (errata E26). Every postcard names the next unlock. **Armored** opens at Wipe Day #2 and is first
reached in the fourth run: the target becomes the Wreck ("Cracked open!"), and the Ship Breaker
and Reactor arrive with two new hands, Gus and Vera. Wipe Day #3 keeps the hands for lines 1-3
through every nuke, #4 brings Rush (taps ×5 for 30 s), #5 ring 4, and #7 the Foreman for lines
1-6. The first Wipe Day's 3 scrap rank up three hands (each line ×2, forever; ranks rise together,
so no hand gets two ranks ahead of the rest), the Magnet hauls about one a day from day 2, and
five buy Pocket slot 1. By day 7 *(P1 model)* the casual player has 7 Wipe Days, about 1,100 glass
ever and about 60 of rings 1-3's 72 nodes lit; the active player 11 Wipe Days and about 9,000
glass.

### 4.7 The first month

About 25 Wipe Days for a casual player (the asserted band is 20-40 by day 30, errata E14) and 27
for an active one. Runs settle at about a day for
both: one nuke a day. Rings 4-6 open. **Wipe Day #10** brings ring 5,
+4 h of Night Shift and the first keystone slot: Wipe Day Rush (Afterglow holds ×5 for 60
minutes; Night Shift halved) or Bunker Mentality (offline ×1.5, no flotsam), re-picked free on
every rebuild. #15 brings the Flare and secret hints, #20 ring 6, a second slot and the Foreman on
every line, and #25 the opt-in Dead Hand. The Logbook fills toward its 120 pages at +2% Morale
each. The casual player has earned about 50 scrap (N19 wants at least 25, asserted on the averages; errata E15), enough for rank 1-2 on
every hand. Grit, all lines ×1.05 for the run every 8 hours, becomes the check-in ritual. Each
counted Wipe Day now adds 10-25% to glass ever, about ×1.2 of output power. The optimal player
owns 37% of the tree at day 30 (N15: at most 45%).

### 4.8 Month three and the late wall

Runs stretch to 3-5 days, and each counted Wipe Day still needs +10% glass ever, which under the
fifth root is ×1.6 the lifetime. At day 90 *(P1 model)* the casual player has about 41 Wipe Days,
246k glass ever and 43% of the tree lit. Wipe Days 30, 40 and 50 open rings 7-9 and keystone
slot 3 (R7), but their nodes cost 200k glass and up, out of reach until about day 150. Dares
such as Quiet Hands (no taps after minute 5) change the verbs for a run and pay a permanent effect
of at most +25% on one stat. Ranks and Morale keep growing with real days, but the outer rings
become a year-long goal: 57% of the tree at day 365. This is the late wall (`10-balance.md`
section 5). The recommended answer, the owner's decision before R7: accept a slow outer tree and
lower the Crossing's trigger to "45% lit and N13 firing", with a calendar-fair power source (such
as the deepening crater) designed and simulated before R7. **The Crossing**, a new island with its
own curve, is shown only once it ships.

### 4.9 Coming back after two days away

One card, one **Collect**:

> Away 2 d 3 h. Your hands worked the Night Shift (12 h of it): +4.2T supplies. The Magnet hauled
> up 2 scrap. 3 friends nuked their islands: 9 crates are waiting on your shore. Logbook +2.

Collect banks the gain and runs the Foreman's buy pass, which keeps the crowned purchase's price
in reserve. The run stalled when the window filled and is over 20 hours old, so if the nuke
counts the next crown is the Big Red. Two minutes later the crates are tapped, the island is a
crater, three nodes are bought and Afterglow is running. **Two days away become one satisfying
blast.** Nothing was lost, only paused.

---

## 5. Three friends in one week

*Illustrative*: the full game with R6 shipped, three friends starting the same Monday. The
"By Sunday" row is the P1 model at day 7, before Late Tide; `10-balance.md` owns the curves.

| | Ana, the idler | Ben, the casual | Cal, the active player |
| --- | --- | --- | --- |
| Plays | 08:00 and 21:00; taps 4/s only while nothing runs by itself | 08:00, 13:00, 21:00, 5 minutes at 4 taps/s | 8 sessions of 10 minutes at 6 taps/s |
| First nuke | Day 2, 21:00 | Day 1, 21:00 | Day 1, noon (third session, 20 minutes online) |
| First buys | Deep Cellars, so her 13 hours from 08:00 to 21:00 fit the Night Shift; Old Friends | The guided basket | Calloused Hands, then Grip and Tide |
| By Sunday | 4 Wipe Days, glass ever ~260, Glow ×5.0 | 7, ~1,100, Glow ×9.3 | 11, ~9,000, Glow ×24.7 |

**How they meet:**

- **Nuke news.** Every counted Wipe Day posts to the feed and `#wipe-day-idle` with the postcard;
  quick repeats fold into one line. Cal's flight variants become a running joke ("Wipe Day #6:
  loop-the-loop").
- **Blowback.** Each counted Wipe Day washes 3 crates onto every other shore. Ben and Cal make 18
  between them, so Ana finds a full or nearly full shore at most check-ins (at most 9 wait). Each
  crate pays `max(1 min of output, min(15% of held supplies, 10 min of output))` of *her* run, so
  a veteran's blast feeds a newcomer at the newcomer's scale.
- **The Freighter.** One load costs one hour of *your own* output, so Ana's load counts as much
  as Cal's. Cal loads 6, Ben 4 and Ana 2: an average of 4 reaches tier II, and each of them gets
  2 scrap.
- **The Island Count** passes 10, its first tier (errata E17), and a scorched flag goes up on all three islands.
- **Boards.** Cal tops Wipe Days and flotsam caught, and Ben tops fastest comeback. Ana's late-week
  nuke is the week's **best blast** (glass gained before Late Tide ÷ glass ever before, so the
  board never hints at Late Tide, errata E19).
- **Late Tide.** Ana is below half the median of the other players' glass ever, so her cover card
  shows "Late Tide ×3" openly to her (boards and other shared surfaces never show the tag, errata
  E19); the bonus never carries her past that median, and nothing is taken
  from Cal.

**Why nobody falls hopelessly behind:**

1. **The formula is concave twice.** Glass is the fifth root of lifetime, so doubling it takes
   32× the lifetime, and Glow is `1 + 0.25√G`. Cal's 8× lead in glass on Sunday is a 2.7× lead in
   Glow, and in the model it shrinks to 1.4× Ben's glass by day 30 and 1.2× by day 180, as his
   runs stretch to a day like everyone's.
2. **Tree costs rise ×10 per ring**, so a several-fold lead is less than one ring.
3. **Absence never hurts.** The Night Shift pays 100% inside 12-48 hours; only your own button
   takes progress.
4. **Catch-up is visible and one-sided.** Late Tide lifts the player behind; Blowback and the
   Freighter scale to each player.
5. **The simulator asserts it** (N16, N17). At days 30 and 90, in a group of five with Late Tide,
   the active player stays within 2× the casual's glass ever, the optimal within 2.5×, and the
   idler at no less than 0.5× (P1 at day 30 in the group: 1.06, 1.34 and 0.67); solo gaps are warnings, and the
   late idler gaps are asserted for an idler following the crown (errata E11). A friend who joins
   on day 30 catches the day-30 casual within 12 days (P1: 10), asserted for two players (errata
   E16).

---

## 6. What the player sees at a glance

Wireframes at 390 px are in `08-screens.md`.

- **The island (home).** A 64 px top bar: Supplies in large numerals with `+3.1T/s` under it
  (tap for the Multipliers sheet), the green glass chip (glass held and `×Glow`) and, from R5,
  the gold scrap chip. The scene fills the top half: the era's target on the rise, at least 120 px
  tall inside the thin Hustle arc; the lines behind it, each showing its product; the Kettle on
  the slope; flotsam on the sea. The collapsed drawer shows the crowned row and the next two, with
  icon, count, cycle bar, next milestone ("38/50 → speed ×2") and price. The nav row (Island ·
  Blast Map · Crew · Logbook · Friends) is hidden at 0:00 and slides in with its first
  destination; locked items give their reason, unshipped ones are hidden.
- **One crown per view**, in signal orange. While it sits on the Big Red chip, a crate, a
  Toolbelt skill or the tap hint, the collapsed drawer has no orange row; the expanded drawer
  (Lines and Upgrades, the ×1 / ×10 / ×100 / Max toggle) always crowns one row.
- **The Big Red:** the cover card, the hold, the cinematic, the postcard, and the rebuild screen
  (keystones, Pockets, an optional Dare). It is never styled as the primary.
- **The Blast Map:** an SVG scorch disk of 361 dots; each wedge shows its fill and affordable
  count, and locked rings name their gate. A wedge unrolls into a ladder of at most four 56 px
  nodes a row, with no pinch or pan. A node sheet gives the effect in current numbers ("+38k/s
  now") and one Buy, or a path ("4 nodes, 1,240 glass"). Exactly one node pulses.
- **Crew, Logbook, Friends:** hands with ranks and the Foreman toggle; pages, Morale, "???"
  secrets and printed odds (the flotsam Odds sheet is in Settings from R1, repeated in the
  Logbook from R4; errata E8); the feed, boards, the Freighter, the Island Count and Visit.
- **Welcome back** is one card with one Collect. **On desktop** the drawer becomes a 420 px right
  column and the camera recentres.

---

## 7. The build plan and the owner's decisions, on one page

### 7.1 Build plan (acceptance criteria and the kickoff prompt in `11-roadmap.md`)

| Phase | Goal | Sessions |
| --- | --- | --- |
| R0 Foundations | Off-server backup, the `redesign` branch, decisions from D127, the docs rewritten, cuts deleted, `Amount`, effects, settle with property tests, the taps transport, simulator v2 | 3 |
| R1 The run | First tap to Sheet Metal: lines, shelf, eras, Grip, Hustle, hands, Night Shift, welcome back, 3 flotsam kinds, the phone layout, sound | 5 |
| R2 The Big Red | **The full loop; friends play.** Glass, the Kettle, the cinematic, Afterglow, Blast Map wave 1 (73 nodes), nuke news, bot card v2. **Cut-over** | 4 |
| R3 Blast Map wave 2 | Rings 4-6 and keystones: the tree reaches 178 nodes, then 191 and 201 as R4-R5's systems ship | 3 |
| R4 Logbook | About 120 pages, Morale, secrets | 2 |
| R5 Scrap and the check-in | Magnet, ranks, Pockets, Toolbelt, Foreman, Dead Hand | 3 |
| R6 Friends | Blowback, Island Count, Freighter, Late Tide, boards, Visit | 3 |
| R7 Dares, wave 3, live ops | 4 Dares, rings 7-9, admin panel, exports | 3 |
| Later, gated | The Crossing; at most 3 creeds; a sea layer | 3-4 each |

**About 26 sessions to R7. Friends play the full loop at about session 12.** Work happens on the
`redesign` branch; `main` stays the old game, untouched beyond R0's backup (an emergency fix only
if the live server breaks), until the R2 cut-over. W9's live-ops items fold into R0, R2 and R7. Everyone with a season 1 base gets a Founder skin and 5
glass, as glass held only, so it never moves Glow.

### 7.2 Owner decisions (made 2026-10-10; full list, fallbacks and the `CLAUDE.md` rewrite in `07-what-changes.md`)

**The big one, decided: one run currency, Supplies.** The plan recommended it: one number at 390 px, a loop readable in seconds with no tutorial, a closed-form
settle, and a simulator that can model whole lifetimes. The honest cost is the Rust feeling of
several stockpiles and "I need 2k more stone"; product badges (A1) recover part of it, since
every line shows and voices what it makes, but nothing is stocked or spent. The fallback in `07`,
3-4 era materials that only gate era purchases, costs about 1.5 sessions and a second counter.

The other decisions, as the owner chose them (every default except season 1):

| # | Decision | Chosen |
| --- | --- | --- |
| 1-3 | Names; the island; the lid | As proposed, passes in R1, R2, R4 (eras lean to the Rust grades; Starter Kit renamed in R1); Saltmarsh, its clock UTC+1 with no daylight saving (errata E9); a toilet-seat lid |
| 4-7 | Seasons; the cut list; expeditions; season 1 | Remove the reset; accept all; parked until the R6 playtest; runs untouched until R2, ends quietly with one `pnpm season end` |
| 8-10 | Founders' gift; prestige shape; offline | Founder skin + 5 glass held, for every season 1 base; fifth root of lifetime (`L0` 5e5) with √ Glow, the exponent never above 1/5 without a group-simulation proof; 100% inside 12 h, rising to 48 h |
| 11-15 | Primary colour; Toolbelt; creeds; Dead Hand; sound | Signal orange; 3 skills in R5; deferred, at most 3; opt-in, online, Wipe Day #25, presets 25 / 50 / 100 / 200% of glass ever or "when crowned" (errata E12); procedural WebAudio from R1 |
| 16-20 | Freighter rewards; Visit; nuke from Discord; hand traits; notation | 1 scrap per tier, pennant at III; R6 stretch; no (the bot may only Collect); decided in R5, leaning to one-line perks; suffixes to Dc, then scientific |
| 21 | The late wall (before R7) | A slow outer tree with the Crossing's trigger at "45% lit and N13 firing"; a calendar-fair power source designed and simulated as the alternative (4.8); the final option chosen before R7 |

**What the owner supplies, soonest first:** the icons in 1.5 (scrap first), then the naming
pass, and later any sounds that should replace the procedural ones.

---

## Open questions

None; settled by errata v3.

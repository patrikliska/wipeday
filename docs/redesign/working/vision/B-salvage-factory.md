# Wipe Day redesign, proposal B: "Salvage Factory"

Philosophy B: depth through **production chains**. The core puzzle is Egg, Inc.'s bottleneck
pipes in Kittens Game and Melvor-style chains with Rust-flavoured goods: timber to planks, ore
to ingots to plates and gears, sulfur to gunpowder to charges to a warhead. Every name is a
proposal for the owner's pass. Every number is a target for the simulator, not a promise.
Written 2026-10-07. Nothing in the repository was changed.

---

## 1. Pitch and pillars

**Pitch.** You wash up on a wrecked island with nothing but your hands. You chop and smash
until the first rigs hum, then wire your crew, hired hands and motors into chains (timber to
planks, ore to ingots, plates and gears, sulfur to gunpowder and charges) until the island is
one roaring, visible factory whose last product is a **warhead**. Load it with every charge you
can make, flip the cover off the weird red button and hold it down. Your own missile climbs,
wobbles, turns round and flattens everything. You paddle back to the crater with **Glow**:
permanent power for a huge tree, the **Schematic**, which makes the next factory faster, deeper
and stranger. The crew at sea come home with relics, and the crater gets deeper every time.

**Pillars** (in priority order):

1. **The bottleneck is the game.** Every line shows its pipes (gather, process, yard) with a
   green, amber or red gauge. The advisor names the binding pipe in one sentence. Reading and
   fixing it is the core decision, on every check-in.
2. **Your hands start every line; crew and machines finish it.** Every processor starts
   hand-cranked. Automation is a visible person or motor standing at the machine. "Click like
   crazy, then automate" happens once per machine type, so it repeats all through a run.
3. **The bomb is the factory's last product.** Prestige is not an abstract formula on a
   counter. The warhead is built from the chain, and its payload of charges *is* the yield. A
   better factory means a bigger bang.
4. **The base tells the story, and the crater remembers.** Every machine stands in the scene.
   Persistent things (crew, relics, the dock, the crater's depth) visibly survive the blast.
5. **Generous when away, better when present.** Yards hold 8 to 48 hours of output. Being there
   is worth about 2× (tapping the bottleneck, Momentum, flotsam), never 10×.

---

## 2. The experience over time

### 2.1 The first ten minutes (a brand-new player, run 1)

| Time | What happens | Numbers |
| --- | --- | --- |
| 0:00 | A beach, a wreck, two trees, one rock, the player's survivor by a cold campfire. The top bar shows **Timber 0**. One tree glows: "Tap to chop". | Tap = +1 timber (Rock in hand). A gold weak spot on the trunk is a critical hit: ×5. |
| 0:08 | The first buy row lights up as the one primary: **Woodlot**. Buying it puts a small chopping stand next to the trees. | 10 timber. 0.5 timber/s. |
| 0:30 | The rock starts glowing; **Rock Pit** is revealed when affordable. | 15 timber. 0.4 stone/s. |
| 1:00 | **Stone Tools**: hand power ×3. The next tool rung shows its cost. | 60 timber, 30 stone. |
| 1:40 | **Sawbench**, hand-run: tap it, a 1-second bar fills, planks pop out. Taps queue up to 3 cycles, so you can hop between targets. | 40 timber, 20 stone. 1 plank/s per copy, from 2 timber. |
| 2:30 | **Mara** walks up the beach: "Put Mara on the Sawbench?" This is the first automation: the sawbench now runs by itself, offline too. | Free. |
| 3:30 | **Campfire** (20 planks). The flame becomes the **Momentum** meter: taps feed it. | Up to ×1.5 on everything at full. |
| 4:30 | 10 woodlots: the first milestone ("Sharper axes, ×2"). The first **bottleneck gauge** appears: "Timber piles up (+4/s): the sawbenches are the bottleneck. Build a Sawbench." | 10 timber/s in, 3 sawbenches eat 6/s. |
| 5:30 | The first **flotsam** (scripted the first time): a crate drifts in, with 12 s to tap it. **Rush**: ×5 on everything for 60 s. | |
| 7:00 | **Warehouse**: the yard holds one more hour. | 150 stone, 60 planks. |
| 8:00 | **Timber era**: the base rebuilds with a pop and turns timber-coloured. The Kiln, Ore Drill and Furnace are revealed. A sealed hatch stencilled **DO NOT** appears on the slope with a three-line checklist (foreshadowing). | 400 timber, 200 stone, 100 planks. |
| 9:30 | Hand-run **Kiln**. **Dax** arrives: the second foreman and the first real choice ("Sawbench or Kiln?"). | |
| 10:00 | **Ore Drill**, and the first ingot made by hand at the furnace. The gauge reads: "Charcoal is short: the furnace waits." | |

Simulator target: at least one affordable purchase every 30 s in the first 10 minutes, and
never more than 90 s with nothing to buy during the first hour.

### 2.2 The first hour

- **10 to 25 min.** The Metal line takes shape. Ivo arrives (the third foreman), Bunkhouses
  sell **hired hands** (unnamed foremen), and the 25-copy milestones land. The first **Shift
  orders** appear (three daily jobs paying scrap, such as "Tap 300 times").
- **25 to 35 min.** **Stone era** opens the Workbench (plates), the Gear Cutter, the Garden
  (fibre) and the Loom. There are now more processor types than foremen, so one line stays
  hand-cranked: that tension drives the next goal.
- **35 to 60 min.** The first **line bonus** lands (25 of every Wood machine: ×2). About 150
  machines stand, timber runs at about 150/s, and the silo checklist shows real numbers.

### 2.3 The first day

- **Active player (2 to 3 hours).** **Sheet Metal era** at about 1:20 opens the Powder line,
  fat and fuel, the generator and **motors**, and the **Dock** (the first 20-minute trip burns
  200 fuel). **Armored era** at about 1:55 opens the Demolition Bench and the **Silo**. The
  first nuke comes between 2:20 and 2:50, with about 2,500 charges: **about 25 Glow**, or eight
  or so ring-1 nodes.
- **Casual player (3 check-ins of 5 to 15 minutes).** Day 1 reaches Stone era. The 8-hour yards
  fill overnight, so the morning check-in is a shopping spree. The first nuke is on the evening
  of day 2.

### 2.4 The first week

- **Runs.** Active: runs 2 to 7, each 45 to 90 minutes. Casual: about one a day.
- **Nuke-count unlocks (section 4.6):** foremen start already staffed (nuke 3), the scrap-paid
  Workshop (4), Doctrines and the first keystone slot (5).
- **Expeditions.** Tier 1-2 sites and the first relics (a cracked hard hat: +25% hand power).
  The first weekly **Convoy** with friends.
- **Lifetime Glow.** About 300 to 700 for an active player.

### 2.5 The first month

- About 25 to 40 nukes for an active player, 12 to 20 for a casual one. Rings 3-4 open.
- Autobuyers per line; auto-era from nuke 15. Tier 4-5 sites with 24-hour trips and keycodes.
- Production reaches about 1e6 to 1e9 per second.
- At nuke 30 the crater "hits something hard": the second layer, **Bedrock** (section 4.7),
  shows on the horizon list. The crater is visibly deeper.

### 2.6 A returning player after two days away

The welcome-back card (rule 6.3.10) reads **"Away 2 d 3 h. Your yards were full 8 h after you
left."**, then one line each: what each line banked and when it stopped; **2 trips back** (one
with a rare relic); a **Shockwave from a friend's nuke** (×2 for 10 min, claimable); the
**Convoy at 64%** ("your share: 2 hours of plates"); and any hand-run machine that did nothing,
with a "Staff it" link.

One primary: **"Launch: +410 Glow"** if a payload was waiting, otherwise **"Back to work"**,
which lands on the advisor's bottleneck card. The Momentum fire is cold, so the first taps
relight it. After 7 days away there is a care package (20 scrap). Nothing decayed, nothing was
raided.

---

## 3. The run

### 3.1 What the player buys, and why

| Buyable | What it does |
| --- | --- |
| **Rigs** (gatherers) | Make raw goods, always automatic: more input to every line |
| **Processors** | Turn inputs into the next good, hand-run until staffed: unclog the next pipe |
| **Staff** (crew, hired hands, motors) | Run a processor type without taps, offline too: freedom to leave |
| **Warehouses** | +1 h of yard time each (at most +8): a longer offline window |
| **Tools** (Rock to Power Tools) | Hand power about ×3 per rung: faster starts, stronger taps |
| **Era upgrades** (the base tier) | Open the next machines and give ×1.5 to everything built: the chapter breaks |
| **Silo parts** (casing, booster, payload) | Arm the nuke; charges set the yield: the run's goal |

Every machine is **countable** on its own geometric curve: a run means hundreds of purchases,
not the current season's 62.

### 3.2 Resource model: 16 goods in 4 lines

Four lines of four goods, revealed over five eras. Every good has at least one producer and one
consumer, so the existing content check "every part has a recipe and a use" stays.

| Line | Raw (rigs) | Refined | Component | Final |
| --- | --- | --- | --- | --- |
| **Wood & Stone** | timber, stone | planks | charcoal (from timber) | (feeds everything) |
| **Metal** | ore | ingots (ore + charcoal) | plates, gears | casing |
| **Powder** | sulfur_ore | sulfur (sulfur ore + charcoal) | gunpowder (sulfur + charcoal) | **charge** (gunpowder + cloth + plate) |
| **Field** | fibre, fat | cloth (fibre) | fuel (fat) | booster, trips, power |

**Why these 16:** charcoal is the shared hub (furnaces, ovens and mixers all draw it: the
classic "split one input" puzzle); ingots split into plates and gears (gears pay for motors:
the automation tax); fuel is the expedition sink and the power source (Egg, Inc.'s rocket
fuel). Hide, leather, rope, food, frames and springs are **parked** for a later Deep line:
they have no consumer in this loop, and 16 is the most a 390 px ledger carries with one era's
lines expanded.

**Recipes** use small whole ratios, so the player can do the maths in their head:

| Recipe | Ratio |
| --- | --- |
| plank | 2 timber |
| charcoal | 2 timber |
| ingot | 2 ore + 1 charcoal |
| plate | 3 ingots |
| gear | 2 ingots |
| sulfur | 2 sulfur_ore + 1 charcoal |
| gunpowder | 1 sulfur + 1 charcoal |
| cloth | 3 fibre |
| fuel | 2 fat |
| **charge** | 10 gunpowder + 2 cloth + 1 plate |

Fully expanded, one charge costs about 20 sulfur ore, 46 timber, 6 fibre and 6 ore. It sits
at the top of the whole factory.

### 3.3 Machines, costs and production

The cost of copy *n* (counting from 0) is `c(n) = b × r^n`, for each cost good. Buying *k*
copies costs `b·r^n·(r^k − 1)/(r − 1)`. "Max" is the minimum over the cost goods of
`floor(log_r(S·(r − 1)/(b·r^n) + 1))`, which gives constant-time ×1, ×10 and Max buttons
(free, never gated).

| Machine (id) | Line | Era | Base cost | r | Per copy, per second |
| --- | --- | --- | --- | --- | --- |
| Woodlot (`woodlot`) | Wood | Twig | 10 timber | 1.15 | +0.5 timber |
| Rock Pit (`rock_pit`) | Wood | Twig | 15 timber | 1.15 | +0.4 stone |
| Sawbench (`sawbench`) | Wood | Twig | 40 timber, 20 stone | 1.13 | 1 plank ← 2 timber |
| Charcoal Kiln (`kiln`) | Wood | Timber | 150 stone, 60 planks | 1.13 | 1 charcoal ← 2 timber |
| Ore Drill (`ore_drill`) | Metal | Timber | 200 stone, 80 planks | 1.15 | +0.6 ore |
| Furnace (`furnace`) | Metal | Timber | 400 stone, 100 planks | 1.13 | 1 ingot ← 2 ore + 1 charcoal |
| Workbench (`workbench`) | Metal | Stone | 300 ingots, 200 planks | 1.12 | 0.5 plate ← 1.5 ingots |
| Gear Cutter (`gear_cutter`) | Metal | Stone | 500 ingots, 100 plates | 1.12 | 0.5 gear ← 1 ingot |
| Fibre Garden (`garden`) | Field | Stone | 2k stone, 400 planks | 1.15 | +1 fibre |
| Loom (`loom`) | Field | Stone | 600 planks, 100 plates | 1.12 | 0.5 cloth ← 1.5 fibre |
| Hunting Traps (`traps`) | Field | Sheet Metal | 1k planks, 200 gears | 1.15 | +0.5 fat |
| Oil Press (`press`) | Field | Sheet Metal | 800 plates, 300 gears | 1.12 | 0.5 fuel ← 1 fat |
| Sulfur Drill (`sulfur_drill`) | Powder | Sheet Metal | 1.5k plates, 300 gears | 1.15 | +1 sulfur_ore |
| Sulfur Oven (`sulfur_oven`) | Powder | Sheet Metal | 2k plates, 200 gears | 1.12 | 1 sulfur ← 2 sulfur_ore + 1 charcoal |
| Powder Mixer (`mixer`) | Powder | Sheet Metal | 1k plates, 500 gears | 1.12 | 1 gunpowder ← 1 sulfur + 1 charcoal |
| Demolition Bench (`demo_bench`) | Powder | Armored | 5k plates, 2k gears, 1k cloth | 1.11 | 0.1 charge ← 1 gunpowder + 0.2 cloth + 0.1 plate |

The ratios are readable on purpose: one sawbench wants four woodlots; one furnace wants 3.3
ore drills plus one kiln. The line card says so ("needs 1.3 more drills").

**Throughput of a machine type:**

```
T = rate × owned × milestones × (1 + Σ increased) × Π more × (1 + 0.02 × lifetimeGlow) × momentum × eraBonus
```

For example, the 50th woodlot costs 10 × 1.15^50 ≈ 10.8k timber, and fifty woodlots with three
milestones (×8) make 200 timber/s before the tree. Run 1 ends at roughly 80 woodlots (about 600
timber/s), 35 furnaces (about 100 ingots/s) and 15 demolition benches (1.5 to 3 charges/s).

### 3.4 The three pipes and the bottleneck

Every good flows through **gather → process → yard**; the run ends at the **silo** (the
"ship" pipe).

- **Flow rule.** A processor type runs at `min(capacity, input supply, output yard space)`.
  When a shared input is short, consumers draw **in proportion to demand** and each shows "fed
  67%". From tree ring 2, a **priority pin** per good chooses who eats first.
- **Gauges.** Each good row shows in/s and out/s with a bar: green (surplus), amber (within
  10%), red (starving a consumer).
- **The advisor's binding pipe.** For the current goal (next era, a silo part, a milestone),
  take the missing good with the longest time to afford and walk upstream to the first link at
  100% utilisation with a non-empty input. The card reads: *"Ingots hold up the Stone era (need
  400, +2.1/s, about 3 min). The furnaces are at full; ore is piling up. **Build a Furnace**
  (#4: 620 stone, 140 planks)."* If it is not affordable, the advice is "tap it" or "staff it";
  a full yard is named. Tapping a non-bottleneck floats "not the bottleneck: tapping here won't
  help". This teaches the puzzle with zero tutorial.
- **Yards (storage).** Per good, `cap = max(eraFloor, H × gross output per second)`, with
  `H = 8 h + 1 h per warehouse (at most +8) + tree (up to 48 h)`, and era floors of 500, 2k,
  10k, 50k and 250k. The yard is both the in-run "store" pipe (nothing costs more than H hours
  of output) and **the offline window**: one cap mechanism, not two (Pecorella: short offline
  caps churn players). A full yard stops its link and never destroys anything.

### 3.5 Milestones

- **Per machine type:** ×2 at 10, 25, 50 and 75 owned, ×3 at 100, then ×2 every 50. Each
  milestone **redraws the machine** in the scene (three visual levels at 1, 25 and 100), and the
  buy row shows "38/50 → ×2".
- **Line bonus** (AdCap's all-business unlock): 25 of every machine in a line gives ×2 to the
  line, and 100 of each gives ×3. This makes players buy broadly, not only the best machine.
- **Era bonus:** each era upgrade gives ×1.5 to everything already built ("new tools for the
  whole holdfast").

### 3.6 Eras inside a run (the five base tiers keep their ids and colours)

| Era | Cost (run 1) | Opens |
| --- | --- | --- |
| Twig | (start) | woodlot, rock pit, sawbench, campfire, warehouse, tools |
| Timber | 400 timber, 200 stone, 100 planks | kiln, ore drill, furnace, bunkhouse |
| Stone | 6k stone, 2k planks, 400 ingots | workbench (plates), gear cutter, garden, loom |
| Sheet Metal | 40k stone, 3k plates, 800 gears, 500 cloth | the Powder line, traps, press, generator, motors, dock |
| Armored | 25k plates, 6k gears, 2k cloth, 1k fuel | demolition bench, silo, radio mast |

Era costs are fixed rows in data, about ×8 to ×12 per step in raw value (the simulator checks
the band). Later runs cross them in minutes: that is the "visibly faster" feeling.

### 3.7 The click verb, and how it stays relevant

| Tap target | Effect | Scaling |
| --- | --- | --- |
| A node (tree, rock, ore, sulfur seam, fibre patch) | +hand power of that raw, ×Momentum. The gold weak spot (today's marker, kept) is a ×5 critical. | Hand power = tool rung (1, 3, 10, 30, 100) + 0.04 s of that raw's rig output per tap. Clicks keep pace with the factory (the Cookie Clicker mouse rule). |
| A **hand-run** processor | Starts one 1-second cycle of the whole type (all copies). Up to 3 cycles queue. | Hand-running equals the automated rate only while you keep tapping it. |
| A **staffed** processor (overdrive) | +0.25 s of that type's throughput per tap. | About +150% at 6 taps/s, and only useful on the bottleneck. |
| Anything | +3% Momentum per tap. The meter holds for 5 s, then falls 10% a second. | Full meter = ×1.5 on everything; tree nodes raise it to ×3. |

**The shape over a run:** taps are 100% of production in minutes 0 to 3, about 50% at minute
10 (hopping between hand-run machines), and 10 to 20% after automation, where their real use
is to **rush the bottleneck**: the binding link plus full Momentum gives about ×2.2 to ×2.5 on
that line. The server credits taps through a token bucket (15 per second, burst 45; section
9), on real seconds only (rule 9).

### 3.8 Active bursts

- **Flotsam** (the golden cookie; it replaces barrels) spawns every 4 to 10 minutes (mean 7)
  while the game is open, storms add 50%, and it can be tapped for 12 s. The odds are on the
  "What washes up" card:

  | Outcome | Chance | Effect |
  | --- | --- | --- |
  | Rush | 40% | ×5 on everything for 60 s |
  | Windfall | 35% | for every good: the lesser of 15% of its yard and 15 min of its output |
  | Hands | 12% | taps ×50 for 15 s; hand cycles are instant |
  | Line surge | 8% | one line ×10 for 45 s |
  | Scrap cache | 5% | +3 to 10 scrap |

  Effects multiply, so combos exist. The server seeds a schedule per player; a claim is an
  idempotent command inside the window.
- **Call a drop.** The Radio Mast (Armored era) summons one flotsam every 30 real minutes, for
  combos.
- **No other skills.** One burst system done well beats Clicker Heroes' nine (priority 4).

### 3.9 The automation ladder

| Rung | Run 1 timing | What it automates | Price |
| --- | --- | --- | --- |
| Hands | 0:00 | you tap nodes and crank machines | none |
| Rigs | 0:08 | raw goods, always automatic | goods |
| Crew foremen | 2:30 | one processor type each, offline too; trait and level bonus | free; named and persistent (3 at the start, more from trips) |
| Hired hands | Timber era | an unnamed foreman | Bunkhouse: 100 planks ×3 per hand |
| Motors | Sheet Metal | any processor type; each needs 1 power | 50 gears ×1.35 per motor; the generator turns 1 fuel/s into 10 power |
| Priority pins | tree, ring 2 | who eats a shared good first | Glow |
| Autobuyers | nuke 4+ (Workshop) | per line: keep buying while the cost is under 10% of stock | scrap |
| Auto-era | nuke 15 | era upgrades buy themselves | agenda |
| Auto-load | nuke 25 | a set share of charges goes straight into the silo | agenda |
| Auto-launch | Workshop | launch when the yield reaches a chosen target | scrap |

Motors bring a fourth pipe late in the run: fuel → power → motors. "The generator is the
bottleneck" is a real mid-run problem.

### 3.10 The offline model

Staffed and motored links run at **100%** offline; hand-run links stop. Each good stops at its
yard (8 h to 48 h of gross output); downstream links keep drawing their stock, so the factory
winds down link by link, and the welcome card reports the order. Flotsam and Momentum need
presence. Trips resolve on their timers; autobuyers act at 10-minute game-time ticks (bounded,
section 9). No upkeep, no decay, no raids, ever.

---

## 4. The nuke

### 4.1 Unlock: the silo checklist

The hatch appears in the **Timber era**, sealed, stencilled **DO NOT**, and visible with its
reason long before it can be used (rule 6.3.3). In the **Armored era** it slides open and the
checklist becomes buyable:

1. **Casing**: 10k plates, 2k gears (run 1). The missile body rises on a crane.
2. **Booster**: 3k fuel. It hisses.
3. **Payload**: arms at 100 charges, and **every charge loaded after that adds yield** ("Load
   all", or an auto-load share). Bandit camps also want charges (section 7): a real choice.

Casing and booster are fixed per run (the tree discounts them, or `spare_casing` keeps the
casing through the blast). Only the payload scales.

### 4.2 Staging (UX and comedic beats)

1. **The button.** Once armed, a pedestal rises beside the silo: a fat, dome-shaped red button,
   slightly melted on one side, under a hinged glass cover with hazard stripes, labelled
   "LAUNCH (PLEASE DON'T)". It never uses the advisor's red primary style (code-web finding 9).
   Idle gag: a crew member pokes it with a stick and is told off.
2. **The live readout:** "Yield **+37 Glow** (you have 40) · next Glow in 212 charges · 14
   Glow/h now, peak 17/h".
3. **Commit in two steps.** Tap the cover: a card shows gain, kept and lost (rule 6.3.4) and a
   crew line (*"Ivo: I just fixed the roof."*). Then **hold for 2 s**: the siren rises, the crew
   run for the raft, a gull lands on the missile. Cancel stays visible throughout.
4. **The launch gag.** The missile climbs, sputters, loops ("the guidance is made of gears"),
   turns round and comes straight down on the base. The path is seeded, so it varies, and the
   Logbook collects the variants.
5. **Impact.** A white flash, a fireball on the lights layer (D47), a mushroom cloud of puff
   sprites, a shockwave over the sea, camera shake (a fade under reduced motion). 6 to 8 real
   seconds, skippable after the first time.
6. **Afterglow.** Ash falls; a sign in the crater reads **"WIPE DAY #3"**; the crater is
   √nukes metres deep, and says so. The raft paddles back.
7. **Results card:** "+25 Glow · background radiation now +50% · Run 1: 2 h 31 m · 2,512
   charges · best line: Metal". Primary **Open the Schematic** (the first time it opens on a
   pulsing node, so the reward lands in the same minute); "Begin run 2" is secondary.
8. **News.** The feed and Discord post "Patrik pressed the red button. It turned around. Wipe
   Day #3: +56 Glow." Every friend gets a **Shockwave** to claim.

The game's title becomes the joke: Wipe Day is the day you wipe your own island.

### 4.3 Prestige currency: Glow

- **Formula.** Based on lifetime charges, with a delta, so early resets cannot be farmed:

  ```
  GlowTotal(C) = floor( sqrt( C / 4 ) )        C = lifetime charges detonated
  gain         = GlowTotal(C_before + payload) − GlowTotal(C_before)
  ```

  | Lifetime charges | 2,500 | 10k | 1M | 1.6e9 |
  | --- | --- | --- | --- | --- |
  | Lifetime Glow | 25 | 50 | 500 | 20,000 |

  Doubling Glow takes 4× the charges (AdCap's square root); the constant 4 is tuned by the
  simulator.
- **What one Glow is worth** (the Cookie Clicker split, so spending never hurts): every Glow
  **ever earned** gives **+2% to all throughput** for good ("background radiation"), and
  unspent Glow buys Schematic nodes. Early, one Glow is roughly a ×2 on one machine type
  (ring-1 nodes cost 1 to 3); later, ring costs rise ×10 per ring, so "a few nodes per nuke"
  holds.
- **When to press.** The advisor promotes Launch to the primary when the run's Glow per hour
  drops below 80% of its peak, or when the gain is at least the lifetime Glow (the doubling
  rule), whichever comes first. The very first nuke is promoted at 20 Glow or more.

### 4.4 Kept and lost

| Lost in the blast | Kept forever |
| --- | --- |
| all 16 goods, every machine, tools, warehouses, hired hands, motors | Glow (lifetime and unspent), the Schematic |
| the era (back to Twig), milestones, staffing, Momentum | scrap, relics (equipped and in the vault) |
| shift-order progress for the run | crew (named, levels, XP, traits); trips in flight finish |
| | the map: scouted regions, site stars, keycodes, first clears |
| | the Logbook, cosmetics, lifetime stats, nuke count, crater depth |

### 4.5 Run lengths and per-run acceleration

| Phase | Run length (active) | Casual | Per-run power gain | Rule the simulator asserts |
| --- | --- | --- | --- | --- |
| First nuke | 2 h 20 m to 2 h 50 m | evening of day 2 | (start) | about 25 Glow; first nuke not under 90 min active |
| Runs 2-5 | 45 to 90 min | 1 per day | ×2 to ×3 | run N+1 reaches run N's peak charges/s in at most 40% of run N's time |
| Mid game (runs 6-30, weeks 2-6) | 1 to 3 h; 2 to 4 per day | 1 per day | ×1.5 to ×2 | Glow gain per run at least 1.0× the previous run |
| Late (30+) | 4 to 12 h; set up before sleep | 1 every 1-2 days | ×1.2 to ×1.5 | when it falls under ×1.3, a ring or Bedrock must be open |

The sanity path on the formula:

| Run | Payload (×4 to ×6 per run) | Lifetime Glow | Passive bonus |
| --- | --- | --- | --- |
| 1 | 2.5k | 25 | ×1.5 |
| 2 | 12k | 60 | ×2.2 |
| 3 | 60k | 136 | ×3.7 |
| 4 | 300k | 305 | ×7.1 |

The tree adds the rest.

### 4.6 What each nuke count unlocks

The AD eternity-milestone pattern (the count itself removes repetition), shown as a horizon
list on the results card: "next nuke unlocks …".

| Nuke | Unlock |
| --- | --- |
| 1 | the Schematic (centre + ring 1), background radiation |
| 2 | ring 2; relic slot 2; the Logbook |
| 3 | foremen remember their posts (start staffed) |
| 4 | the Workshop sector (scrap) |
| 5 | ring 3; Doctrines (challenge launches); keystone slot 1 |
| 8 | start with 10 woodlots and 5 rock pits, free |
| 10 | ring 4; start each run in the Timber era |
| 15 | auto-era |
| 20 | ring 5; keystone slot 2 |
| 25 | auto-load |
| 30 | the crater "hits something hard" (Bedrock foreshadowed) |
| 35 | ring 6 |
| 40 | Bedrock (second layer) |
| 50 | keystone slot 3 |

### 4.7 The second prestige layer (design hook)

At crater depth 6.3 m (nuke 40), the player can **drill the Bedrock**. It resets lifetime and
unspent Glow and the stat nodes of rings 1-5. It keeps unlock, automation and Workshop nodes,
relics, scrap, crew and the map. It pays **Core Samples**:
`floor(10 × log10(lifetimeGlow) − 30)`, so 1e5 lifetime Glow gives 20.

Each sample multiplies Glow gain by ×1.1, compounding. Samples open the **Deep line** (a fifth
line bringing back springs, frames and leather plus copper and circuits, for a "guided warhead"
with a better yield exponent) and an alternative island biome with different ratios (AdCap's
Mars lesson: a different curve feels new). Design only: build it when the simulator shows the
per-run ratio flattening below ×1.3.

---

## 5. The Schematic (the massive tree)

### 5.1 Size and structure

**About 360 nodes** in **9 sectors** around the centre, **Ground Zero** (the gate, free with
nuke 1). It is drawn as a pre-war engineering blueprint: nodes are valves and gauges, edges are
pipes, and bought pipes fill with green light flowing out from the centre.

| Sector | Theme | Currency |
| --- | --- | --- |
| Hands | taps, crits, Momentum, flotsam | Glow |
| Wood & Stone | rigs, sawbench, kiln, charcoal | Glow |
| Metal | furnace, plates, gears | Glow |
| Powder | sulfur, gunpowder, charges | Glow |
| Field | fibre, cloth, fat, fuel, power | Glow |
| Logistics | yard hours, splitters, motors, era costs | Glow |
| Crew & Sea | foremen, trips, relic slots, sites | Glow |
| Silo | casing, booster, yield, Shockwave | Glow |
| Workshop | autobuyers, QoL, starting kits | **scrap** |

Every sector has six **rings**:

| Ring | Nodes per sector | Opens at nuke | Glow per node |
| --- | --- | --- | --- |
| 1 | 3 | 1 | 1 to 3 |
| 2 | 5 | 2 | 5 to 15 |
| 3 | 7 | 5 | 40 to 120 |
| 4 | 9 | 10 | 400 to 1.2k |
| 5 | 9 | 20 | 5k to 15k |
| 6 | 7 | 35 | 60k to 200k |

That is 40 per sector, plus a repeatable node at the end of each (cost ×1.6 per level). Costs
are fixed in data with playful digit patterns (7, 77, 777, 1,111) and rise about ×10 per ring,
because Glow grows roughly geometrically across runs. Target: **4 to 8 nodes per nuke**. The
Workshop costs 10 to 5,000 scrap a node, about 8,000 in all: some four months for an active
player.

### 5.2 Node types (the mix)

| Type | Share | About | Example |
| --- | --- | --- | --- |
| Small stat (×1.25 to ×2 or +% on one link) | 50% | 180 | `sharp_saws`: Sawbench ×2 |
| Notable (a named mechanic) | 20% | 72 | `heat_recovery`: furnaces refund 40% of their charcoal |
| Unlock (a new toy) | 10% | 36 | `switchboard`: priority pins |
| Automation and QoL (mostly Workshop) | 10% | 36 | `autobuy_wood` |
| Cluster capstone (complete a ring) | 5% | 18 | "Metal ring 3 complete: ingots also count as 0.1 plate" |
| Keystone (rule change with a cost) | 4% | 14 | `night_shift` |
| Repeatable sink | ~2% | 9 | `metal_tuning`: Metal line +10% per level |

There are never more than three small nodes in a row before a notable or an unlock. Every
sector has at least one node that **changes the scene** (a conveyor belt drawn between
machines, motors that glow, a second dock pier).

### 5.3 Respec

The **tree is permanent**: nothing is refunded, which keeps purchases meaningful and the maths
simple. **Keystones** go into a **loadout** (1 slot at nuke 5, 2 at nuke 20, 3 at nuke 50),
swapped for free at every launch on the results card: Realm Grinder's "collection, re-picked
each run". After any balance change the owner grants a **free full respec** with one admin
command (W9).

### 5.4 How it reads on a 390 px phone

- **No pan and zoom.** The **overview** is a 3×3 grid of sector tiles (about 116 px each: icon,
  ring progress arc, "3 affordable", a pulse if the advisor's pick is inside). A tile opens the
  **sector view**: a vertical scroll of six rings, each one row of at most 4 nodes (56 px
  circles, above the 44 px rule) piped to the row above. With about 45 nodes per view it is
  plain React/DOM with inline SVG icons, simpler than a Pixi canvas (priority 3).
- **Tapping a node** opens a bottom sheet: icon, name, "effect now → after", cost, what it leads
  to, and one primary **Buy**, or a disabled button with its reason ("Ring 3 opens at nuke 5",
  "Need 12 more Glow"). Tapping a far node offers "Buy path: 3 nodes, 47 Glow".
- **Filter chips** (Affordable, Unlocks, Automation), and exactly one node pulses: the
  advisor's pick by estimated payback (rule 6.3.1).

### 5.5 Example nodes

Ids in *italics* reuse the eight current perk ids, so those icons and locale keys survive.

| Id | Sector, ring | Type | Effect | Cost |
| --- | --- | --- | --- | --- |
| *`steady_hands`* | Hands 1 | stat | node taps ×3 | 1 Glow |
| *`quick_fingers`* | Hands 1 | stat | overdrive +0.4 s per tap (was 0.25) | 2 |
| `kindling` | Hands 2 | stat | Momentum maximum ×2 (from ×1.5) | 8 |
| `deadeye` | Hands 3 | notable | a weak spot on every node; crits ×10 | 77 |
| `bare_knuckles` | Hands 4 | keystone | taps ×25, rigs ×0.5 | 777 |
| `sharp_saws` | Wood 1 | stat | Sawbench ×2 | 1 |
| `woodlot_rows` | Wood 1 | unlock | start with 10 woodlots | 2 |
| `heat_recovery` | Wood 3 | notable | furnaces and ovens refund 40% of their charcoal | 99 |
| *`hot_coals`* | Metal 1 | stat | Furnace ×2 | 2 |
| `cold_rolling` | Metal 3 | notable | the Workbench makes 1 plate from 2 ingots | 111 |
| `shaped_charges` | Powder 3 | notable | each charge counts as 1.5 in the payload | 120 |
| `dirty_bomb` | Powder 5 | keystone | payload ×3; the next run's rigs ×0.5 for 20 minutes | 7,777 |
| `rendering` | Field 2 | notable | the Press makes 1 fuel from 1 fat | 7 |
| *`deep_cellars`* | Logistics 1 | stat | yards +4 h | 2 |
| `switchboard` | Logistics 2 | unlock | priority pins on shared goods | 15 |
| `night_shift` | Logistics 4 | keystone | ×3 on everything while offline; taps and Momentum off (the idler's build) | 1,111 |
| *`old_friend`* | Crew 1 | unlock | your best foreman starts at their post | 3 |
| *`old_maps`* | Crew 1 | stat | +1 star progress per trip | 2 |
| *`war_stories`* | Crew 2 | stat | crew XP ×2 | 10 |
| `second_berth` | Crew 3 | unlock | expedition slot 3 | 150 |
| *`packed_crate`* | Silo 1 | stat | start with 500 timber, stone and planks | 3 |
| `shockwave` | Silo 2 | notable | your nukes give friends ×2 for 10 min, and you get ×1.5 for their next nuke | 15 |
| `spare_casing` | Silo 3 | unlock | the casing survives the blast | 200 |
| `chain_reaction` | Silo 4 | notable | Glow exponent 0.5 → 0.52 | 1,111 |
| `autobuy_wood` | Workshop | automation | an autobuyer for the Wood line | 25 scrap |
| `auto_launch` | Workshop | automation | launch when the yield reaches a chosen target | 2,000 scrap |

---

## 6. Currencies

| Currency | Kind | Sources | Sinks | On a nuke |
| --- | --- | --- | --- | --- |
| **The 16 goods** | run | rigs, taps, processors, flotsam | machines, eras, silo, camps (charges), trips (fuel) | reset |
| **Glow** (proposal; alternatives *Isotopes*, *Half-lives*) | prestige | the nuke only, by formula | Schematic rings | kept; the lifetime total gives +2% each |
| **Scrap** | rare, persistent | flotsam (5%, 3-10), Shift orders (3 a day, 5-10 each), trips (2 to 200 by tier, more on first clears), Logbook entries, Convoy rewards | the Workshop sector, relic fusing and rerolls, Call-a-drop charges | kept |
| **Relics** | persistent items | trips, bandit camps | equipped (1 slot, up to 5 from the agenda and tree); fuse 3 into the next tier (scrap) | kept |
| **Core Samples** | second layer | Bedrock | Glow-gain multiplier, the Deep line | kept (layer 2) |

**What happens to scrap:** exactly what the owner asked for, **rare and persistent**. No machine
produces it and nothing in a run is priced in it. Income is roughly 30 a day (casual) to 80
(active), so its numbers stay in the hundreds and thousands forever. It keeps Rust's
"research currency" feeling: scrap buys permanent know-how (the Workshop) and relic work.

**Rule** (one decision record): Glow and scrap are **never traded, wagered, stolen or sold**;
the prestige currency is never at risk.

**Names, all own IP:** **Glow** comes from the crater; **Schematic** replaces "blueprint
fragments" (a real Rust item, ruled out by D43); **Shockwave**, **Bedrock** and **Core
Samples** are proposals; "Fallout", "rads" and "vault" are avoided (another franchise).

---

## 7. Systems disposition

| System | Verdict | How or why |
| --- | --- | --- |
| **Seasons** (monthly wipe) | **Remove the reset** | The nuke is the reset; two resets compete for one emotion and punish late joiners. One perpetual season row (no SQL change). Optional monthly **Season board** (records, a cosmetic title) that resets nobody. |
| **Season modifiers** | **Rework** | **Doctrines**: opt-in challenge launches from nuke 5 with a keystone or cosmetic reward. Reuse `long_nights` (no taps), `rich_tides` (flotsam ×3, machines ×0.5), `storm_season` (no trips, flotsam ×2). |
| **The Signal** | **Remove** | Absolute shared stages break when friends are 1e6 apart. Convoys replace it. |
| **Legacy perks** | **Rework** | The legacy plumbing becomes the meta layer; the 8 perk ids become Schematic nodes; the 25% cap and its three checks are retired by decision. |
| **PvP** | **Remove** | Percent theft across exponential scales is meaningless or absurd; first on the roadmap's cut list already. |
| **NPC raids and defence** | **Remove** | Raids planned two days ahead never land in runs of hours, and punishing absence breaks pillar 5. Walls, turret, watchtower and repairs go. |
| **Bandit camps** | **Keep** as expedition sites | Entry costs charges (competing with the payload); they pay the best relics and scrap. |
| **Player market** | **Remove** | Not fair between scales (D100: "mostly empty" with two players). |
| **Den counter** | **Rework, small** | The skiff becomes the **Trader**: two daily scrap offers (relic reroll, extra Call-a-drop, cosmetic). Never Glow, never goods. |
| **Contracts** | **Rework** | They become **Convoys** (section 8), measured in each player's own hours of output. |
| **Casino** | **Remove (park the code)** | No role in a factory loop, and persistent scrap must not be gambled. Odds engine and RTP tests stay in git history. |
| **Crew** | **Keep and rework** | Persistent named people: foremen and trip members with levels and traits (`tinkerer` +25% at a processor, `navigator` faster trips, `demolition` +50% Demolition Bench, `lucky` better relics, `cook` slower Momentum decay). No tiredness, sleep or injuries. |
| **Expeditions, map, keycodes** | **Keep and rework** | Egg, Inc. rockets; see below. |
| **Crafting web and stations** | **Rework** | Timed queues become continuous processors; the recipe graph helpers drive "where does this come from" and the advisor's upstream walk. |
| **Furnaces** | **Rework** | A countable Furnace; `large_furnace` and `electric_furnace` become its visual levels at 25 and 100 owned. |
| **Buildings** | **Rework** | The 18 ids map to machines and support (section 12). Instant, no build timers, no upkeep. |
| **Tools** | **Keep and rework** | The hand-power ladder (1, 3, 10, 30, 100), bought with goods. |
| **Node mini-game** | **Rework** | Nodes are the tap targets; the marker (D34) becomes the crit spot; the daily haul (D63) goes. A tree falls after 25 hits and regrows in 20 real seconds while others stand. |
| **Barrels** | **Rework** | Flotsam (section 3.8). |
| **Daily tasks** | **Rework** | **Shift orders**: 3 per UTC day, scale-free, paying scrap; the casual player's steady scrap. |
| **Weather, day/night** | **Keep (visual)** | Storms add 50% flotsam; nothing else changes rates. Machines glow at night on the lights layer. |
| **Leaderboards** | **Rework** | Scale-fair categories only (section 8); lifetime stats live in the meta layer. |
| **Feed** | **Keep** | New kinds: nuked, record, first clear, rare relic, Convoy done. |
| **Notifications** | **Keep** | Opt-in per kind; defaults on: "trip back" and "friend nuked (Shockwave waiting)". |
| **Discord bot** | **Keep the architecture** | `/base` shows era, line rates, the binding pipe, yard fill time, "Launch: +X Glow", trips, Shockwave. No tapping through Discord. |
| **Welcome back** | **Keep, central** | Section 2.6. |

**Expeditions in detail (the Egg, Inc. rockets model):**

The **Dock** (Sheet Metal era) launches trips that burn **fuel**, a production sink. Each site
offers short, standard and long trips (20 min, 1 h, 4 h at tier 1; up to 4 h, 12 h, 24 h at
tier 5). Two slots to start; `second_berth` and a later node add more. Trips **survive the
nuke** ("the crew were at sea when it went up"), which makes a ritual: send the long trips,
then launch. **Stars** per site (from repeat trips) raise relic count and quality; a site's
**first clear** unlocks something (a capstone, a crew member). Keycodes still gate the deep
sites, now persistently, and odds stay fixed at departure and shown (D86, D93).

---

## 8. Social layer for 2 to 10 friends at very different progress

The rule: compare **times, counts and ratios**, never absolute amounts.

- **Feed and Discord** carry the shared story: every nuke, records, first clears, legendary
  relics and Convoy results, posted from the same events as today (D124).
- **Shockwave.** When anyone nukes, every friend can claim ×2 on everything for 10 minutes
  within 24 h. The `shockwave` node adds a reverse bonus for the launcher. Everyone gains, it
  is scale-free, and one friend's reset becomes a group moment.
- **Convoys** (they replace contracts and the Signal): weekly, with a 72-hour window. The goal
  is counted in **crew-hours**: delivering plates worth one hour of *your own* plate output is 1
  crew-hour, and a Convoy might need 40 crew-hours across everyone in 3 steps. A run-2 player
  and a run-40 player contribute equally per hour of effort. Everyone who took part gets
  scrap, a relic crate and a pennant cosmetic. No grades, warnings or kicks (Egg, Inc.'s
  failures); reruns pay points only.
- **Send a crate**, once a day: gift a friend 30 minutes of *their own* production, and you get
  10 minutes of yours. Positive-sum and capped.
- **Leaderboards**, monthly, on the optional Season board: fastest to Armored (run time),
  biggest blast (best single-nuke Glow gain divided by lifetime before), most nukes, Schematic
  nodes owned, deepest crater, Convoy crew-hours, Logbook entries. Two or three are always
  winnable by a newcomer.
- **Catch-up.** A player under 50% of the group's median lifetime Glow earns ×(median/own)^0.5
  Glow, capped at ×3, until they reach it. Flotsam's Windfall adds an Egg, Inc.-style rubber
  band (×10 when far behind the group's run-time curve).
- **Shared Logbook.** Secret entries show "???" with a one-line hint. The first friend to find
  one gets a feed line, so the group shares discoveries without a wiki.

---

## 9. Architecture implications and an honest reuse estimate

### 9.1 Numbers

- **Plain doubles** for amounts and rates behind one `Amount` alias; counts (owned, nodes,
  nukes) stay integers. A finite-number guard in the domain and in `save()` means
  `JSON.stringify(Infinity)` can never write `null`. Fractional remainders stay in state (no
  per-settle flooring, unlike D19).
- **Magnitude budget:** about 1e3 at the end of run 1, about 1e10 by day 30, under 1e120 by day
  365 (asserted by the simulator). That is far inside 1e308, so **no Decimal library**.
- `abbrev` extends to k, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc, then `1.23e36`, with a scientific
  toggle; web and bot share it.
- **Decision records:** retire "integers in state" for amounts; retire the 25% legacy cap;
  replace the 1.6× rule with lifetime gap bands; remove the season reset; amend rule 6.3.9
  (machine cycles are seconds, not check-in timers) and rule 6.3.1 (the advisor crowns one buy
  row; the rest are secondary).

### 9.2 The settle model: a flow integrator

Today's single linear window does not survive chains with buffers. The new settle is an
**event-stepped integrator over the line graph** (a DAG of at most 16 goods). In each segment a
topological pass computes every link's actual flow from capacity, input supply (an empty stock
means supply-limited) and output space (a full yard means downstream-limited), splitting shared
goods by demand or by pins. The next event is the earliest of a stock reaching 0 or its yard, a
timer (trip, flotsam window), an autobuyer tick (every 10 game minutes) or `now`; integrate
linearly to it and repeat. The step budget is 5,000 per settle, finished in bulk with the
buy-max closed form. Tests: **path independence** (`settle(settle(s, t1), t2) ≈ settle(s, t2)`
within a relative 1e-9), agreement with a one-second tick simulation, and conservation of goods
through every recipe. Domain CPU stays in microseconds, and it is the same function on client
and server (D64).

### 9.3 Click transport

One **`work` command per batch**, `{target, count}`: the client coalesces taps for about 1 s
(or until the tab hides) while the command is unsent (code-api 8.2). The domain credits taps
from a **token bucket in state** (15 per second, burst 45) and silently clamps the rest, so
prediction and server agree for any human. `work` gets a **slim idempotency record** (no state,
10-minute TTL) and one aggregated `worked` stat instead of an `event_log` row per tap. Predicted
batches are never dropped on a network error: today's queue wipe goes.

### 9.4 Where the meta layer lives

**Inside the player's base document** (code-api option 7.5 B) as `state.meta`: Glow, the
Schematic, scrap, relics, crew, map, Logbook, lifetime stats. Tree buys are predicted instantly.
`launch` is a **pure domain command**, `{meta, run} → {meta', newRun(meta', seed(base,
nukes))}`, so the client can play the cinematic before the server answers and the simulator
plays lifetime loops with the same function. The API overwrites the same `bases` row, so
`version` keeps counting (code-api finding 5): one transaction, idempotent by key, no backup
per nuke. The `legacy` table stays only as a read model for leaderboards, with one perpetual
season row.

**Modifiers** become data, `{stat, op: inc | more | add | unlock, value, scope: good | machine
| line | all, when?}`, folded once with an identity cache in a fixed bucket order:
base → milestones → Σinc → Πmore → radiation → momentum. Tests check monotonicity and upper
bounds per stat, not every combination.

### 9.5 Reuse estimate (honest)

| Part | Survives | What survives |
| --- | --- | --- |
| `packages/domain` (11.2k lines with tests) | **about 30%** | clock, rng, World, the command/refusal/idempotency shape, events and feed, words (formatter extended), the missions engine (about 70% of it), recipe graph helpers, the advisor shell, carry plumbing. The rewrites are `base.ts`, settle, crafting, nodes, crew jobs and buildings. Den, market, casino, raids and Signal are deleted. |
| `apps/web` | **about 50%** | the Pixi scene engine, terrain, sky, palette, effects (with pooling added), actors, the floater and particle juice, the map view, Panel, Toasts, the modals pattern, Cost chips, the store's prediction pipeline (batching added), LocalBackend, the shots harness. Machine drawings, the HUD layout, the ledger and the tree are new. |
| `apps/api` | **about 75-80%** | auth, sessions, the command path, SSE, push, backups, bot routes, the tick. Den, raid and season paths go; the slim `work` records and launch handling come in. |
| `packages/content` | **about 25%** of the schema; **about 40%** of the ids | loader, locale and cross-check framework. New machine, line and tree schemas with formulas. |
| `packages/sim` | **about 40%** | the harness, manual clock and pacing-in-test (D56). Archetypes and targets are rewritten. |
| `apps/discord` | **about 70%** | the whole thin-client architecture; the card content is rewritten. |
| **Overall** | **about 45%** | |

**The new simulator** plays lifetime loops (30, 90 and 365 days) for idler, casual, active,
optimal and late-joiner archetypes. `pacing.json5` v2 asserts: first nuke (active 90 to 180
min, casual day 1.5 to 3); the 40% replay rule; Glow gain per run at least 1.0× the previous
in runs 2-10; active at most 2.5× casual in lifetime Glow at days 30 and 90, and the idler at
least 0.4×; a late joiner reaches a day-30 casual's Glow within 12 days; optimal owns at most
55% of the Schematic by day 30 and all of it not before day 150; the purchase cadence; the
magnitude budget.

---

## 10. Build plan

| Phase | Goal | Scope | Sessions |
| --- | --- | --- | --- |
| **R0** Foundations (architecture, plan mode) | The engine before content | **Off-server backups first** (W9 item 1); the decision records; `Amount` and the formatter; data-driven effects; the flow integrator with property tests; machine and line schemas; the lifetime simulator with pacing v2. | 3 |
| **R1** Wood & Metal | The first 30 minutes | Twig to Stone eras, tapping, hand-run processors, foremen, hired hands, yards, milestones, gauges and the advisor card, the new HUD (scene above, Line board drawer below, tabs Factory, Crew, Map, Schematic, Logbook), the `work` batch command. **Ships as `?demo`** (LocalBackend, no server change) while season 1 keeps running. | 5 |
| **R2** The full chain | Every line | Sheet Metal and Armored, the Powder and Field lines, generator and motors, flotsam, Momentum, tools, offline yards, welcome-back. | 4 |
| **R3** The red button (architecture) | **The full loop live** | Silo, `launch`, cinematic and results card, Glow, meta in the base, Schematic v1 (rings 1-2, about 80 nodes), agenda to nuke 5, Shockwave, feed. **Cut-over:** `season end` once as season 1's ceremony, a founder gift (5 Glow, a "Season 1 founder" skin), then the tested wipe. | 4 |
| **R4** The sea | Persistent sub-game | Dock trips as rockets, stars, first clears, relics and fusing, scrap sources, bandit camps, Shift orders. | 4 |
| **R5** The massive tree | Depth | Rings 3-6 (about 360 nodes), keystone loadout, Workshop and autobuyers, auto-era, auto-launch, Doctrines, the Logbook (about 120 entries). | 4 |
| **R6** Friends | Social | Convoys, Send a crate, the Season board, catch-up, notifications, the Discord card. | 3 |
| **R7** Live ops | W9 remainder | Error reports via the bot, admin commands (grant, respec all, reload), the `event_log` export. | 2 |
| Later | Bedrock, Deep line | When the simulator shows the per-run ratio flattening. | 4+ |

**About 29 sessions to R7.** Friends try the factory opening at **R1 (about session 8)** and
play the whole click → factory → nuke → tree loop for real at **R3 (about session 16)**. Every
phase keeps `pnpm check`, `web:shots` and the `ui-review.md` notes; the shots list is pruned to
the new game in R1.

---

## 11. Risks, failure modes and open decisions

**Failure modes of this philosophy, and their mitigations:**

1. **Too much to read at 390 px.** Chains are harder than one cookie. Lines are revealed one
   era at a time, only the current goal's chain is expanded, the advisor names the pipe in one
   sentence, gauges are colour plus a word, and 16 goods per run is a hard cap. Owner
   screenshots are the check.
2. **Ratio homework** (the Factorio-calculator trap, and the solved metas of Clicker Heroes and
   Realm Grinder). The game shows the ratios itself ("needs 1.3 more drills"), and a free "Even
   out this line" button buys the missing machines in one tap. No hidden formulas.
3. **A long first run.** At 2 to 3 hours the first nuke is later than in a browser clicker. Five
   eras give a chapter break every 15 to 30 minutes, the silo is foreshadowed from minute 8, and
   R1 demo play plus the simulator can shorten it.
4. **Settle correctness.** Buffers, sharing and autobuyers invite path-dependence bugs. Property
   tests and the tick-simulation oracle come in R0, before any content.
5. **Multiplier bloat late.** Unlocks, ratio-changing keystones, scene-changing nodes, Doctrines
   and Bedrock carry the late game; the simulator flags per-run gains under ×1.3.
6. **Expeditions feel detached.** Relics act on lines, fuel comes from the chain, camps eat
   charges, and trips survive the nuke.
7. **The active/idle gap among friends.** `night_shift`, 48-hour yards and catch-up keep the
   casual friend in the race; the gap is asserted, not hoped for.
8. **Art workload.** About 16 machines × 3 visual levels plus the silo and cinematic,
   procedural first (D41); the owner's SVGs cover the panels.

**Open decisions for the owner:**

1. Names: **Glow** (or Isotopes, Half-lives), **Schematic**, the line names, Shockwave, Bedrock.
2. The first-nuke length: 2-3 h active and day 2 casual as proposed, or shorter (about 60 to
   90 min, by cutting the Field line until run 2)?
3. Remove seasons as a reset (recommended)? Keep the optional monthly Season board, or nothing?
4. Wipe timing: keep season 1 running until R3 (recommended) and then wipe with the founder
   gift?
5. Should trips survive the nuke (recommended), or reset?
6. Number notation: short-scale suffixes then scientific (proposed), or scientific only?
7. Cut list confirmation: PvP, the market, the casino, NPC raids and defence, the Signal.
8. Sound: the cinematic and taps want audio (none exists yet). Commissioned, procedural, or none
   for now?

---

## 12. Icons: what to keep drawing, what to stop, what is new

Name files by kind, because ids collide: `resource/stone.svg`, `tier/stone.svg`,
`node/stone.svg`, `building/furnace.svg`.

**Safe to keep drawing** (they exist in this proposal):

| Kind | Ids |
| --- | --- |
| Resources (17) | timber, stone, ore, sulfur_ore, sulfur, fibre, fat, planks, charcoal, ingots, plates, gears, gunpowder, charge, cloth, fuel, **scrap** |
| Tools (5) | rock, stone_tools, iron_tools, salvaged_tools, power_tools |
| Tiers / eras (5) | twig, wood, stone, metal, hqm |
| Buildings, reused (13) | furnace, kiln, workbench, loom, garden, traps (now hunting traps), press (oil press), warehouse, bunkhouse, generator, dock, radio_mast, campfire (the Momentum fire) |
| Node kinds (5) | tree, stone, ore, sulfur, fibre |
| Crew portraits (12) and traits (11) | all |
| Sites (15) and regions (13) | all; the three camps stay as expedition sites |
| Keycodes (3) | tin_keycode, copper_keycode, brass_keycode |
| Trip events (3) | ambush, cache, stranger (low priority) |
| Skins (3) | driftwood, rust, beacon (cosmetics) |
| Perk ids (8) | steady_hands, deep_cellars, quick_fingers, hot_coals, old_maps, war_stories, old_friend, packed_crate (now Schematic nodes; low priority) |
| Modifiers kept as Doctrines (3) | long_nights, rich_tides, storm_season |

**Stop drawing** (cut or parked): hide, food, rope, leather, frames, springs (parked for the
Deep line); walls, turret, watchtower, lights, tannery; large_furnace and electric_furnace
(they become furnace visual levels); every item except the keycodes (crates, meals, medicine,
weapons, armour); the `quiet_raiders` modifier, the 4 Signal stages, 12 contracts, 13 Den lots
and 16 casino symbols; the 6 old leaderboard categories and the dock-action letters.

**New icons needed** (about 40): machines (woodlot, rock_pit, sawbench, ore_drill,
gear_cutter, sulfur_drill, sulfur_oven, mixer, demo_bench); motor and power; the nuke set
(silo, casing, booster, payload, red_button, crater); glow and core_sample; flotsam, momentum,
call_drop; nine tree sectors (hands, wood, metal, powder, field, logistics, crew, silo,
workshop); keystone, autobuyer and unlock badges; shockwave, convoy, send_crate; shift_order,
logbook, relic frames by tier; the factory and schematic HUD tabs.

**Priority for the owner:** the 17 resources and 5 tools first (on every screen), then the 9
new machines and the 13 reused buildings, then the nuke set and glow, then crew and sites.

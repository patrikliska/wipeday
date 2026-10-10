# Reference study: Clicker Heroes (1 and 2) and Realm Grinder, and what Wipe Day should take from them

Researcher: ref-clickerheroes-realmgrinder. Sources are the two community wikis (read as raw wikitext
through the MediaWiki API), G00F's "Not a Wiki" for Realm Grinder (more current than the fandom wiki),
the developers' own post-mortem for Clicker Heroes 2, and a few reviews and guides. Facts come from
those sources unless they are marked *(uncertain)* or *(my count)*. Numbers are from the current
versions (Clicker Heroes 1.0e11+, Realm Grinder v4.x).

---

## 0. Summary

- **Clicker Heroes (CH1)** shows how to build a clicker that turns into an idle game: clicking beats
  DPS for the first minutes, DPS beats clicking soon after, and then three ways back in keep clicking
  worth doing: short skills on long cooldowns, an "active" set of prestige upgrades, and purchasable
  auto-clickers. It has two prestige layers (Ascension, then Transcendence), each with its own
  currency and its own set of upgrades.
- **Realm Grinder (RG)** shows how to keep a game fresh for hundreds of hours with **variety more
  than bigger numbers**. Each run you pick a faction that changes which buildings, spells and
  resources matter. There are three prestige layers (Abdicate, Reincarnate, Ascend). Every
  reincarnation unlocks a new *system*, not only a multiplier. Challenges, hidden trophies and
  research slots that are chosen again every run do the rest.
- **What goes wrong in both:** solved metas that send players to calculators and wikis, hidden
  requirements, walls where the only move is waiting, numbers past 1e300 that stop meaning
  anything, and (in CH2) a prestige reward that only gave back what the player had just lost.

---

## 1. Clicker Heroes 1

### 1.1 Zones, monsters, bosses
- A regular zone needs **10 kills** (+0.1 per 500 zones). Every 5th zone is a **boss zone**: one
  monster with about 10× HP and a **30 s timer** (−2 s per 500 zones, at least 2 s). If you fail,
  you stay one zone back and farm. That is the game's only fail state, and it is mild.
- **Monster HP** for zones 1–140 is `ceil(10 × (zone−1 + 1.55^(zone−1)) × (boss ? 10 : 1))`, then
  ×1.145 per zone up to 500, then ×(1.145 + 0.001 per 500 zones), capped at 1.545. Gold per kill
  grows about 1.6× per zone to 140, then 1.15× per zone. A zone-140 monster is worth about
  **4.7e28 gold**.
- Up to zone 140 each boss needs about 10× the DPS of the one before; after that, about 2×. That is
  why the first wall sits near zone 130–140.
- A **treasure chest** replaces a monster 1% of the time and pays 10× gold. Clickables float on
  screen and pay gold or the premium currency (rubies).

### 1.2 Click damage against hero DPS
- The first hero (Cid) only raises click damage; every other hero deals DPS, which outgrows clicks
  within minutes. Clicking stays relevant through upgrades that add a share of total DPS to each
  click, critical clicks, skills (1.5) and the active prestige upgrades (1.8). Manual clicks are
  capped at **30 per second**; only auto-clickers go faster.

### 1.3 Hero cost scaling and milestone multipliers
- Hero level cost: `floor(BaseCost × 1.07^level)`, so the cost doubles about every 10 levels.
- DPS milestones:
  - From level 200, every 25 levels multiplies the hero's DPS by **×4**.
  - At levels 1000, 2000 … 8000 the multiplier is **×10** instead.
  - Later heroes get ×4.5 every 25 levels and no ×10s.
  - Four late "Ace" heroes cost **1.22^level** but get **×1000 every 25 levels**.
- The maths: past level 200, DPS bought per gold falls about **1.2% per level**. The wiki's rule
  of thumb is "level each hero about 25 levels above the next one". So the player always has a
  "next milestone" target that is a few minutes away.
- A few heroes give **global** multipliers (all of them together: ×80.7 DPS and ×13.2 gold), which
  makes a whole roster worth buying, not just the newest hero.

### 1.4 Gilding
- At zone 100 and every 10 zones after it (first time per transcension), a **random hero gets a
  gild**: +50% DPS per gild. A prestige upgrade raises that by +2% per level.
- Moving gilds costs hero souls: **2** to send one gild to a random hero, **80** to pull one onto a
  chosen hero.
- The effect: gilds pull you towards building around one carry hero, and moving them is a small
  sink for the prestige currency.

### 1.5 Skills (the active layer)
| Skill | Effect for 30 s (unless stated) | Cooldown |
|---|---|---|
| Clickstorm | auto-clicks 10/s | 10 min |
| Powersurge | +100% DPS | 10 min |
| Lucky Strikes | +50% critical click chance | 30 min |
| Metal Detector | +100% gold | 30 min |
| Golden Clicks | each click pays 1% of a monster's gold | 1 h |
| Dark Ritual | ×1.05 DPS for the rest of the run, stacks up to 20 | 8 h |
| Super Clicks | +200% click damage | 1 h |
| Energize | doubles the next skill | 1 h |
| Reload | −1 h on the last skill's cooldown | 1 h |

- Each skill is unlocked by levelling a specific hero, so skills come back every run.
- The two meta-skills (Energize, Reload) create combos and routing decisions. That is real
  decision-making in a 30-second window, on cooldowns of 10 minutes to 8 hours: almost exactly the
  "2-minute check-in" shape Wipe Day wants.
- Prestige upgrades extend the durations by +2 s per level, until "permanent Clickstorm" becomes a
  late-game goal.

### 1.6 Auto-clickers: purchasable, assignable automation
- Bought with rubies at **1000 + 500n**. They are kept forever, through both prestige layers.
- You **drag** one onto a target:
  - the monster: 10 clicks/s each for up to 4; with more than 4, `ceil(10 × 1.5^(n−1))` in total;
  - a hero's level button: auto-buys levels;
  - a skill: auto-casts it on cooldown;
  - "buy available upgrades".
- An auto-clicker left **unassigned** powers the idle prestige upgrade instead (+1% damage per
  click/s it would have given).
- Automation is a physical object you place, so the player can see and understand it.

### 1.7 Ascension and hero souls
- Unlocked at hero level 150 of a specific hero (in practice from about zone 100–140).
- **What is kept and lost:**
  - Kept: souls, ancients, outsiders, gilds, auto-clickers, mercenaries, 4 equipped relics,
    rubies, achievements.
  - Lost: gold, hero levels, zone progress.
- **Souls earned:**
  - 1 soul per **2,000 total hero levels**;
  - **Primal bosses**: from zone 100, a 25% chance per boss zone (zones 110/120/130 and the
    centurion bosses at every 100 are guaranteed). Each pays `floor(((zone−80)/25)^1.3 × outsider
    bonus)`. A primal can't be farmed: it appears only on the first visit to that zone in a run.
- **Unspent souls give +10% DPS each.** Spending them on ancients is a trade-off against holding
  them.
- The ascension achievements give starting click damage (+10 for the first, up to 43,811 in total
  after 250 ascensions), so a fresh run starts a little faster.

### 1.8 Ancients (the persistent upgrade set for layer 1)
- **26 ancients**. Summoning one shows **4 random choices**; you can reroll for a fee.
  - Summon cost rises 1, 2, 4, 8, 16, 35, 70 … 50,000 souls (184,161 in total for all).
  - Respec refunds 75%.
- Level costs fall into three shapes:
  - `n` per level: Siyalatas (+25% idle DPS), Libertas (+50% idle gold), Fragsworth (+20% clicks),
    Bhaal (+15% crit damage), Argaiv (+2% per gild), Mammon (+5% gold) and others;
  - `2^n` per level, for the utility ones that cap out: boss timer +s, monsters per zone −,
    boss HP −, primal chance +, chest chance +, hero cost −, skill durations +2 s;
  - `n^1.5` per level: Juggernaut (active combo) and Nogardnit (idle with auto-clickers).
  - Morgulis costs 1 per level (+11% soul DPS) and is the dump for leftover souls.
- **Idle vs active is encoded in the upgrades themselves:**
  - Idle mode starts after 60 s with no clicks. It powers Siyalatas, Libertas and Nogardnit.
  - Active mode: Juggernaut builds a combo (+0.01% DPS per click per level) that only starts
    decaying after **280 s** without a click (5% of the combo per second after that). That is a
    forgiving active mechanic: one click every 4½ minutes keeps it alive.
- The wiki publishes optimal ratios in closed form (for example Siyalatas ≈ √(10·HS/(24+15R²))),
  and community calculators are the "recommended" way to play. This is the **solved meta** problem.

### 1.9 Transcendence (layer 2): ancient souls and outsiders
- Available after zone 300.
- **What it resets:** souls, ancients, gilds and relics.
- **What it keeps:** outsiders, auto-clickers, mercenaries, rubies, achievements.
- **Ancient souls:** `AS = floor(5 × log10(total hero souls sacrificed))`, so +5 AS per tenfold
  more souls. That logarithm keeps layer 2 slow by design.
- **Transcendent Power:** `TP = 25 − 23·e^(−0.0003·AS)` %, from 2% up to a 25% cap. Each primal
  boss then pays a bonus of `20 × (1 + outsider bonus) × (1+TP)^(zone/5 − 20)`, which grows
  exponentially with depth.
- **9 outsiders**, mostly costing `n+1` AS per level. Most of them **amplify a specific ancient**
  (for example +12.5% effectiveness of the monsters-per-zone ancient per level). So layer 2
  re-weights layer 1 instead of only adding raw power.
- **A forced wall:** the first time a player passes zone 500 without having transcended, monster
  HP gets a flat **×100**, with an in-game message telling them to transcend. A soft wall that
  tells you what to do next.
- Advice in the guides: transcend after 3–4 ascensions that earn new AS. Each transcension
  contains several ascensions.

### 1.10 Builds: idle, active, hybrid
- **Active:** needs auto-clickers or real clicking; best at the highest zones of 1–50k and
  250k–1M.
- **Idle:** for players with no auto-clickers. Since patch 1.0e10 it **caps out around zone
  182k**.
- **Hybrid:** idle until monsters stop dying in one hit, then active, using time-skips.
- The tier list ranks the ancients differently for each style. That is real build diversity, but
  the optimum shifts with progress, and players learn it from the wiki, not from the game.

### 1.11 Mercenaries ("send away for rewards")
- Up to 5. Unlocked after the first ascension.
- Each gets **4 random quests**: gold, rubies, hero souls (scaled to the current "quick ascension"
  value), relics, skill activations, or a recruit. Rerolling the quests costs 30 rubies.
- Reward by duration, against a 5-minute quest:

  | Duration | 5 min | 1 h | 8 h | 1 day | 2 days |
  |---|---|---|---|---|---|
  | Reward multiplier | 1× | 7.49× | 37.5× | 90× | 144× |
  | Reward per minute | 1.0 | 0.62 | 0.39 | 0.31 | 0.25 |

  So reward grows about **t^0.8**: short quests pay more per minute, long quests cover nights away.
- Level = days spent questing; the reward multiplier equals the level.
- **Death:** a lifespan is rolled at birth: 80% survival per day of questing, about 4.5 days on
  average. Reviving costs `10 × (10 + ceil(1.5^level))` rubies, or you can bury the mercenary for
  gold.

### 1.12 How long runs take
- **First run:** reaching zone ~140 takes about **8–10 hours, or a day or two**. The second run
  reaches 140 in about **30 minutes** *(community reports, via search)*. That "I'm a god now"
  second run is the hook.
- **Mid game:** many ascensions per day.
- **Late game:** runs to zones in the hundreds of thousands, with hours of idling or bought
  time-skips. The game's soft cap is around zone 5.46M.

---

## 2. Clicker Heroes 2: the cautionary sequel

- **What it was:** a one-time purchase with no microtransactions; a Path-of-Exile-style skill tree
  (about **682 nodes** early on); energy (100, −1 per click, +1 per auto-attack) and mana (100,
  +5 per minute) as skill costs; worlds of 100 zones with **3-minute timed zones**. Its best idea
  was the **Automator**: "stones" are conditions (every 10 s, mana > 90%, monster HP < 50%) and
  "gems" are actions (cast a skill, buy the cheapest upgrade, click), wired by the player. On
  Ascension the tree's "flammable" nodes burn and the rest stay.
- **What went wrong:** a reviewer found play "largely passive" once a build worked, and after each
  reset you "get back" what you lost instead of exploring; the damage multiplier was "the least
  interesting possible" reward. The developers (2021) named Flash, being **"too different from
  Clicker Heroes 1"**, **too little content at launch** ("a few days worth") and charging for a
  sequel to a free game. It was **delisted on 14 March 2024**.

---

## 3. Realm Grinder

### 3.1 Core loop
- **11 building tiers.** Each building costs **×1.15** more than the last of its type (×1.03 after
  the first Ascension). Base costs run 10, 125, 600, 1,800, 5,600, 38,000, 442,000, 7.3M, 145M,
  3.2B, 200B.
- Tiers 1–3 and 11 are shared by everyone. Tiers 4–10 **depend on alignment**: Good, Evil or
  Neutral each get their own set and art. The 11th (Hall of Legends) produces **250,000 per
  trophy owned**.
- **Clicking** pays gold. Each click has a base **10% chance** to find a **Faction Coin** (FC).
  Each faction has its own coin. Assistants click passively at 5% of the click reward.
- **Royal Exchanges:** spend FCs for **+10% production each** (additive), costing
  `floor(20 × 1.1^x)` FCs. This is the always-available sink for side currencies.
- **Offline production** is slower than online. Some factions specialise in it.

### 3.2 Factions (the run-defining choice)
You first buy a **Proof** (picks the alignment), then a **Trade Treaty** (picks the faction). Each
faction has **1 spell and 12 upgrades**: 3 tiers, each with one FC-priced gate and 3 gold-priced
upgrades. Vanilla treaties cost 20 FCs.

| Group | Faction | Play style |
|---|---|---|
| Good (active) | Fairy | the 3 lowest building tiers; assistants |
| | Elf | clicking and faction coins |
| | Angel | spells and mana |
| Evil (idle) | Goblin | cheaper buildings; the Tax Collection spell |
| | Undead | grows with time played and offline |
| | Demon | the highest building tiers; trophies |
| Neutral (from about 1B gems, unlocked by dug-up artifacts) | Titan | luck: the spell boosts a random building |
| | Druid | balance: boosts your weakest building by your three biggest |
| | Faceless | production that ramps over time; "past choices" |
| Prestige (stacked on a base faction) | Dwarf (+Good) | excavations |
| | Drow (+Evil) | offline production |
| | Dragon (+Neutral, from R46) | random-effect spell |
| Mercenary (R3+) | any alignment | pick **2 spells and 3×4 upgrades from any faction**: a custom build |
| Elite (R125+; *fandom says R135*) | Archon, Djinn, Makers | a third simultaneous affiliation (Order, Chaos, Balance) |

- **Faction Champion:** buying all 12 of a faction's upgrades once earns a trophy that unlocks
  its **Heritage**, a permanent upgrade (5,000 FC for vanilla factions) that you can rebuy in later
  runs whatever faction you play. This is the "**try every faction once**" hook, and the official
  first goal.
- **Bloodline (R7):** pick a second faction's passive for the run.
- **Lineages (R60):** 15 of them. Their levels persist. Each has 5 perks, and level 15 lets you
  use **another faction's spell**.

### 3.3 Spells and mana
- Base mana: **1,000 cap, 1 per second**. Spells cost 200–2,500 mana and last 5–600 s.
  - **Tax Collection** (200 mana): 30 s of production at once.
  - **Call to Arms** (400): `(25 + 0.3 × buildings)^0.975 %` production for 20 s.
  - Alignment spells: Holy Light (+1,750% clicks), Blood Frenzy (+1,250% Evil buildings), Gem
    Grinder.
  - Faction spells, for example Fairy Chanting (+50,000% to tiers 1–3 for 10 s) and Brainwave
    (+2% per second, building up over 600 s).
- **Autocasting** unlocks after **60,000 mana produced** in total. Later upgrades let spells keep
  running while offline.
- Spell tiers (from about R42) and spell combos are the main way to play actively.

### 3.4 Three prestige layers
| Layer | When | Resets | Keeps | Gives |
|---|---|---|---|---|
| **Abdicate** | any time | buildings, upgrades, gold, faction coins | gems, trophies, challenges, artifacts, heritages, unlocked factions | **gems** |
| **Reincarnate** | first at **1e27 gems**, each later one costs **×1,000 more** | gems, excavations, faction coins, most stats | trophies, heritages, artifacts, research points and slots, challenges | **Reincarnation Power**: +50% production per R, ×(1+5·R) offline, +1% FC chance per R, and so on |
| **Ascend** | at R39, R99, R159, R219 | everything a reincarnation resets | the R count | a **value shift**: every boost is raised to the 1/10 power, a new currency (Diamond, then Emerald), older upgrades become free, building cost ×1.03 |

- **Gems formula:** the total coins needed for n gems is `n × (n+1) × 5e11`. The first gem comes
  at 1T coins; **doubling gems needs 4× the coins** (a square root). Each gem gives about +2%
  production with the "Gem Power" upgrade (guides quote 2–3% depending on upgrades).
- Rules of thumb: abdicate when the pending gems are about 2× what you own, or as soon as you
  can't buy anything significant within a couple of spell combos.
- **The reincarnation unlock agenda.** Each R brings a new *system*: R2 challenges, R3 the
  Mercenary faction, R7 bloodlines, R14 a new spell, R16 vanilla research, R23 neutral research,
  R29 prestige research, R40 Ascension, R46 Dragon, R60 lineages, R75 mercenary research, R100
  new alignments, R125 elite factions. **This list is the backbone of the game's freshness.**

### 3.5 Research
- **6 facilities:** Spellcraft, Craftsmanship, Divine, Economics, Alchemy, Warfare. Each is linked
  to 1 vanilla faction, 2 neutral and 3 prestige factions.
- There are about **42 researches per facility (~250 in total)**, plus a dozen late "Forgotten"
  ones *(my count of the Research List)*.
- **Research points per facility = R(R+1)/2**, so they grow with reincarnations. Raising a
  facility costs coins plus `(x+1)^3` faction coins. Researches unlock at point thresholds and
  often need **feats** ("5 hours offline as Undead", "25k spells cast this game").
- **The key mechanic:** research points persist, but **slots (4 to 6 per facility) reset at every
  abdication**. Every run, you rebuild a loadout of active researches from a large unlocked pool.
  Late layers replace slots with a point budget (6,000, then up to 14,000). So the large tree is a
  **collection**, and each run uses a **chosen subset**.

### 3.6 Challenges and hidden trophies
- **Challenges** start at R2, with 3–6 tiers per faction. Each is a **constraint plus a goal**,
  often against the clock. Examples:
  - "Only use Farms, Inns and Blacksmiths and buy all Fairy upgrades within 1 minute"
  - "Get 400,000 Elven coins in under 1 hour"
  - "Generate 500,000 mana in 3 h **without casting Tax Collection**"
  - "2,000 Halls of Legends and no Good buildings"
  - "Collect 5,000 Demon coins **without** gem power, reincarnation power, research or
    excavations"
  - "Exactly 666 Royal Exchanges, 0 of them Demon, in under 666 s"

  Rewards are permanent:
  - tier 1 boosts the faction itself;
  - tier 2 **boosts a different faction**, which links the factions together;
  - the last tier is universal;
  - finishing all of a faction's challenges upgrades its spell.
- **Trophies:** about 290, **64 of them secret**, each rewarding an upgrade. The secret ones are
  silly and memorable:
  - Leet: have exactly 1,337 coins;
  - Unitary: exactly 1 of each building;
  - Building Hater: 100,000 coins without building anything;
  - Need a Head Start?: do nothing for 5 minutes after starting;
  - Assistant Squasher: click the tiny background assistant 100 times;
  - Speed Run: 1M coins in 5 minutes without gem power.
- **Excavations** unlock at 1B gems. The first costs 1e27 coins, each later one +20%. They find
  FCs, rubies and **artifacts**, with guaranteed finds at set counts. Artifacts unlock the neutral
  factions and other features.

### 3.7 How RG stays fresh through variety, not bigger numbers
- The faction choice changes **which numbers matter** (building tiers, clicks, mana, time,
  offline time, luck); challenges ask you to play a faction **badly on purpose**; research
  loadouts are re-picked every run; each reincarnation adds a **system**, not a multiplier;
  Ascension **rescales** numbers so they mean something again; feats ("12 h as Evil this
  reincarnation") push you to rotate factions.
- *(Uncertain, community reports:)* reaching R16 or R40 takes weeks to months; at R33 a
  reincarnation can take about an hour for a well-built player.

---

## 4. What makes the first hour, day and month work

| | Clicker Heroes | Realm Grinder |
|---|---|---|
| **First hour** | Clicks matter at once. A new hero every few minutes, cost milestones every 10–25 levels, a 30 s boss every 5 zones, Clickstorm at Cid level 25. Then DPS overtakes clicking: "it plays itself". | Clicks and farms. After about 30 minutes, the Good/Evil choice changes the buildings and the art. Spells give a reason to come back when the mana is full. |
| **First day** | The climb to zones 100–140, the first gilds, primal bosses showing pending souls, then Ascension and picking 1 of 4 ancients. Run 2 reaches the old wall about 15× faster. | Frequent abdications, the "try each faction" goal (6 heritages), secret trophies found by accident, autocasting. |
| **First month** | Many ascensions a day, mercenaries and relics, Transcendence at zone 300+, outsiders re-weighting the ancients. The cost: calculators take over. | The first reincarnation at 1e27 gems, then a new system every few R (challenges, mercenary, bloodlines, research). Each R feels like a new chapter. |

---

## 5. Build diversity, replayability, and what goes wrong

**Diversity**
- CH: idle, active or hybrid, encoded in prestige-upgrade weights and auto-clicker placement.
- RG: around 15 factions × bloodline × research loadout × mercenary picks × challenge constraints.

**What goes wrong**
1. **Solved metas and outside tools.** CH ancient ratios come from calculators. RG builds are
   copied from G00F's tables. Players optimise in a spreadsheet, not in the game.
2. **Hidden requirements.** RG challenges show a name and a clue but not the exact requirement
   (PC Gamer). Players must use a wiki. Wipe Day's zero-tutorial rule forbids this.
3. **Factions that feel the same early.** TouchArcade: Good versus Evil "feel the same", "just
   changing the fluff", and a Hell Portal is "just a super Blacksmith when you're not using
   spells". A faction must change the *verbs* the player uses, not only the labels.
4. **Walls where the only move is waiting.** RG reviewer: "I just kept the game closed for half a
   day". CH's ×100 HP at zone 500 at least tells you what to do.
5. **Number blow-up.** CH monster HP passes 1e25,000. RG overflowed doubles at 1.8e308 and had to
   invent Ascension as a value shift. By zone 140, CH gold is about 4.7e28 per monster.
6. **A prestige that only gives back.** CH2: a reset that burns your tree and returns a flat
   multiplier makes you rebuild, not explore.
7. **Pay-to-skip.** CH's late game leaned on bought time-skips. A sign of pacing gaps, not a model.
8. **Opaque randomness.** CH mercenary lifespans are rolled at birth and hidden.

---

## 6. Lessons for Wipe Day (transferable mechanics, own IP)

The theme: a Rust-like wrecked island. The prestige is a **red button that nukes your own
island**. Working names below are proposals.

1. **Show the nuke's yield before the press.** Both games turn run progress into a prestige
   currency with a concave formula (RG gems ≈ √(coins/5e11); CH 1 soul per 2,000 levels, plus
   bosses). *Wipe Day:* the button shows "**Yield: +X fallout**" (or blueprint fragments) worked
   out from the √ of the run's lifetime output, and **glows hot when the yield per hour of this
   run peaks**. That replaces CH's calculator and RG's "2× gems" rule of thumb with something
   visible in the game (UX rule 4: cost and outcome before commitment).

2. **One-time bonus drops on the way.** CH's primal bosses pay souls once per zone per run, with
   guarantees at set zones. *Wipe Day:* a raider warlord, a sunken bunker or an airdrop crate pays
   bonus fallout **the first time per run**, with a few guaranteed ones. This gives each run a
   route ("I'll push to the dam warlord, then nuke").

3. **Unspent prestige currency is itself a buff.** CH gives +10% DPS per unspent soul; RG gives
   +2% per gem. *Wipe Day:* unspent fallout = "**background radiation**", +x% to all output. Every
   purchase in the large tree is then a real trade-off, not an automatic click.

4. **Milestones with visible jumps.** CH: cost ×1.07 per level against ×4 output every 25 levels.
   *Wipe Day:* each building type has count milestones (10/25/50/100/250…). Each one **doubles or
   quadruples that line's output and redraws the building** in the scene ("the base tells the
   story"). A progress bar shows the next milestone (6.2).

5. **Active skills: short effects, long cooldowns, meta-skills.** CH: 30 s effects on 10 min to 8 h
   cooldowns, plus Energize/Reload combos. *Wipe Day:* "**Adrenaline**" (tap frenzy), "**Overclock
   the generator**", "**Scav Rush**", "**Flare**" (×2 loot), with a "**Second Wind**" that doubles
   the next skill and a "**Duct Tape**" that cuts a cooldown. Real seconds, never sped up by the
   demo clock (rule 9). It turns a 2-minute check-in into a short combo.

6. **Idle and active built into the upgrade tree, both forgiving.** CH: idle bonuses after 60 s
   without input; the active combo lasts **280 s** after the last click. *Wipe Day:* tree branches
   for **Night Shift** (bonus while untouched; offline accrual) and **Rush** (a stacking combo that
   survives 5 minutes away), so a 3-check-in casual and a 20-minute grinder both have a path. RG
   does the same through Undead/Drow (offline) against Elf/Angel (active).

7. **Automation as visible objects you place.** CH's auto-clickers are **kept forever** and dragged
   onto a target. CH2's Automator wires "if condition, then action". *Wipe Day:* scrap **drones /
   helper bots** that persist across nukes. Drag one onto a node (auto-gather), a building
   (auto-upgrade), a skill (auto-cast) or the Den (auto-sell). Later, a "**rigging board**" of
   condition → action cards ("storage > 90% → sell surplus"). This is the "click like crazy, then
   automate" arc the owner wants, and it is visible in the scene.

8. **A second prestige layer that re-weights the first.** CH: `AS = 5·log10(HS)`; outsiders mostly
   **multiply specific ancients**. RG: each reincarnation unlocks systems. *Wipe Day:* after N
   nukes, "**Exodus**": abandon the archipelago by boat for a new island. It pays a log-scaled
   second currency that **amplifies branches of the first tree** and changes island rules (new
   biome, new hazards). Use a CH-style **telegraphed soft wall** ("the fallout here is too thick,
   time to leave") instead of a silent stall.

9. **Creeds: a faction chosen at the start of each run (the key lesson).** RG's factions change
   which buildings, verbs and resources matter. *Wipe Day:* after each nuke you pick a creed,
   each with its own active skill and 3 tiers of upgrades:
   - **Scrappers**: tapping and nodes;
   - **Tinkers**: drones and automation;
   - **Bunker Folk**: offline time, storage;
   - **Tidecallers**: boats and the sea;
   - **Wardens**: defence and raids;
   - **Smugglers**: the Den, trade, casino;
   - **Glowheads**, a later unlock: they *gain* from radiation and nuke yield.

   Fix RG's flaw: each creed must change **verbs and visuals** (Tinkers' base fills with conveyors;
   Bunker Folk dig down), not only percentages.

10. **The first full run of each creed gives a permanent perk.** RG's Champion → Heritage. *Wipe
    Day:* finishing a creed's 12 upgrades once earns its **relic**, a small universal perk that
    can be used in any later run. The "collect all 7" goal gives the first weeks a clear agenda
    and pushes players to rotate.

11. **Challenges = special nukes, with constraints shown up front.** RG's constraint-and-goal
    challenges. *Wipe Day:* "**Doctrines**" picked at the button. Examples:
    - "Reach Stone with no furnace"
    - "Nuke within 45 minutes"
    - "No crew this run"
    - "Twig tier only, 1M scrap"
    - "Exactly 13 buildings"

    Rewards are permanent and often **cross-creed** (a Bunker doctrine improves Tinkers), so runs
    link together. Unlike RG, the requirement text is **fully visible**, with a progress bar (rule
    3 and zero tutorial).

12. **A massive tree used through loadouts.** RG: research points persist, **slots reset every
    run**. *Wipe Day:* the owner's "MASSIVE tree" is the **collection** (hundreds of nodes bought
    with fallout and blueprint fragments, kept forever). A small number of **keystone slots** are
    picked again at each nuke (the Melvor/PoE feel without the "get back what you lost" problem of
    CH2). Big nodes can unlock **new systems** (boats, the Den, drones), as RG's
    reincarnations do, not only "+5%".

13. **A visible nuke-count agenda.** RG's unlock table. *Wipe Day:*
    - Nuke 1: the tree;
    - Nuke 2: doctrines;
    - Nuke 3: drones carry over;
    - Nuke 5: a second creed slot (bloodline);
    - Nuke 8: the "free agent" mix-and-match creed (RG's Mercenary);
    - Nuke 12: Exodus.

    Show it as a horizon list: "next nuke unlocks …". Every press of the button promises something
    new.

14. **Silly secret achievements, with visible hints.** RG's Leet / Head Start / Assistant Squasher.
    *Wipe Day:*
    - "have exactly 1,337 scrap";
    - "nuke with zero buildings standing";
    - "sit in the bunker for 5 minutes after the blast";
    - "tap the seagull 100 times";
    - "launch the nuke during a storm".

    Each gives a small permanent upgrade. Show a **cryptic one-line hint** after the first secret
    is found, so no wiki is needed.

15. **Expedition reward against duration, and crater digs.** CH mercenaries: reward ∝ t^0.8 (5 min
    = 1×, 1 day = 90×, 2 days = 144×). Short trips are better per minute, long ones cover nights.
    Wipe Day's crew expeditions can keep that shape (it respects check-ins and absences). RG's
    excavations (rising cost, guaranteed artifacts at set counts) fit **digging in your own
    crater** after a nuke for pre-war blueprint fragments.

---

## 7. Notes for the planner (conflicts with the current spec)

- **The guardrails in CLAUDE.md §8 and game-design §2 conflict with this genre.** Here each
  prestige multiplies power by orders of magnitude; the current spec caps legacy at **25%** and
  8 check-ins a day at **1.6×** the pace of 3. A redesign must rewrite these as pacing targets the
  simulator can assert (for example "time to the n-th nuke", "yield per hour peaks between 2 and
  6 hours of a run").
- **Number range.** The spec says "integers in state". SQLite INTEGER tops out at about 9.2e18,
  while a CH run passes 1e28 by zone 140. Either design a flat curve deliberately (an RG-style
  value shift at each Exodus, or a Melvor-like linear economy), or store mantissa and exponent.
  This is an architecture decision to make up front.
- **Seasons.** Neither game has seasons: prestige is paced by the player. For a group of friends,
  the nuke can replace the monthly wipe as the main reset. Seasons can then become optional
  windows: a monthly doctrine or island modifier and a leaderboard, like RG's events. That also
  removes the "everyone resets on the owner's command" dependency.
- **Multiplayer.** CH's clans (shared "immortal" bosses, damage scaling with your prestige) are a
  cheap co-op layer that fits Wipe Day's Discord companion: for example a weekly shared raid boss
  that pays fallout.

---

## Sources

Clicker Heroes wiki (fandom, raw wikitext through the MediaWiki API):
- https://clickerheroes.fandom.com/wiki/Hero_Souls
- https://clickerheroes.fandom.com/wiki/Ascension
- https://clickerheroes.fandom.com/wiki/Transcendence
- https://clickerheroes.fandom.com/wiki/Outsiders
- https://clickerheroes.fandom.com/wiki/Ancient_Souls
- https://clickerheroes.fandom.com/wiki/Ancients
- https://clickerheroes.fandom.com/wiki/Template:AncientChart
- https://clickerheroes.fandom.com/wiki/Skills
- https://clickerheroes.fandom.com/wiki/Heroes
- https://clickerheroes.fandom.com/wiki/Formulas
- https://clickerheroes.fandom.com/wiki/Zones
- https://clickerheroes.fandom.com/wiki/Monsters
- https://clickerheroes.fandom.com/wiki/Auto_Clicker
- https://clickerheroes.fandom.com/wiki/Mercenaries
- https://clickerheroes.fandom.com/wiki/Builds
- https://clickerheroes.fandom.com/wiki/Juggernaut,_Ancient_of_Momentum
- https://clickerheroes.fandom.com/wiki/Siyalatas,_Ancient_of_Abandon
- https://clickerheroes.fandom.com/wiki/Relics
- https://clickerheroes.fandom.com/wiki/Rubies
- https://clickerheroes.fandom.com/wiki/Cid,_the_Helpful_Adventurer

Clicker Heroes 2:
- https://clickerheroes2.fandom.com/wiki/Automator
- https://clickerheroes2.fandom.com/wiki/Skill_Tree
- https://clickerheroes2.fandom.com/wiki/Skills
- https://clickerheroes2.fandom.com/wiki/Energy
- https://clickerheroes2.fandom.com/wiki/Mana
- https://clickerheroes2.fandom.com/wiki/Worlds
- https://clickerheroes2.fandom.com/wiki/Zones
- https://clickerheroes2.fandom.com/wiki/Ascension
- https://pixelpoppers.com/2019/07/clicker-heroes-2-is-a-very-interesting-project/
- https://blog.playsaurus.com/2021/06/28/the-state-of-clicker-heroes-2/
- https://delistedgames.com/clicker-heroes-2/

First-run timing (community, via search; the exact thread is not verified):
- https://steamcommunity.com/app/363970/discussions/0/617335934135764178
- https://earlyguides.com/clicker-heroes/beginners-guide

Realm Grinder wiki (fandom, raw wikitext):
- https://realm-grinder.fandom.com/wiki/Factions
- https://realm-grinder.fandom.com/wiki/Abdication
- https://realm-grinder.fandom.com/wiki/Reincarnation
- https://realm-grinder.fandom.com/wiki/Ascension
- https://realm-grinder.fandom.com/wiki/Gems
- https://realm-grinder.fandom.com/wiki/Research
- https://realm-grinder.fandom.com/wiki/Buildings
- https://realm-grinder.fandom.com/wiki/Mana
- https://realm-grinder.fandom.com/wiki/Royal_Exchange
- https://realm-grinder.fandom.com/wiki/Faction_Coins
- https://realm-grinder.fandom.com/wiki/Clicking_%26_Automatic_Clicks
- https://realm-grinder.fandom.com/wiki/Offline_Production
- https://realm-grinder.fandom.com/wiki/Trophies
- https://realm-grinder.fandom.com/wiki/Excavations
- https://realm-grinder.fandom.com/wiki/Soft_Resets

G00F's "Not a Wiki" (the maintained Realm Grinder reference):
- https://musicfamily.org/realm/Factions/
- https://musicfamily.org/realm/Research/
- https://musicfamily.org/realm/ResearchList/
- https://musicfamily.org/realm/Challenges/
- https://musicfamily.org/realm/MercenaryFaction/
- https://musicfamily.org/realm/Bloodline/
- https://musicfamily.org/realm/Lineages/
- https://musicfamily.org/realm/Heritages/
- https://musicfamily.org/realm/Spells/
- https://musicfamily.org/realm/Reset/

Guides and reviews:
- https://www.pcgamer.com/realm-grinder-guide/
- https://toucharcade.com/2017/02/21/realm-grinder-review-grind-is-right/
- https://steamcommunity.com/app/610080/discussions/0/1484359403774842059 (R16/R40 timing; uncertain
  attribution through search)

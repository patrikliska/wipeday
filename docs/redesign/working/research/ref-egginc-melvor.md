# Egg, Inc. and Melvor Idle (1 and 2): reference research for the Wipe Day redesign

Researcher: ref-egginc-melvor, 2026-10-07. Markers: **[V]** read in a source listed at the end (the
community wikis quote game files); **[~]** my arithmetic on verified formulas; **[?]** uncertain.

---

## 1. Egg, Inc. (Auxbrain, iOS/Android, July 2016; v1.36 June 2026)

### 1.1 Start: tap, then the farm taps for you

- **The verb.** A big red button hatches chickens. The hatchery holds 250 and refills 3/s; research
  raises it to 500 and refill ×16.875. Epic research "Hold to Hatch" (+2/s per level, to +30/s) turns
  mashing into holding. [V]
- **Running Chicken Bonus (RCB).** While chickens run (only while habitats are not full) each adds egg
  value; the bonus decays when you stop. Research lifts its cap from single digits to hundreds (+0.2×
  ×50 levels, +0.5× ×50, +2× ×150, epic +2× ×100). It stays relevant late: drone payouts scale with √RCB. [V]
- **Automation.** "Internal hatchery" research makes every hen house hatch chickens per minute without
  tapping, up to 7,440/min/hab with all common research; epic research adds +100%, and +200% **while
  away**. [V] The arc: mash → hold → buildings do it → tap only for bursts.

### 1.2 The core puzzle: three pipes

Income = eggs **delivered** × egg value × multipliers; delivered = min(laid, shipping capacity); laid
= chickens × laying rate; chickens are capped by hab space and grown by hatch rate. The UI names the
binding pipe: a depot bar going green → yellow → red, and nags such as "Your farm is making more eggs
than the shipping depot can handle!" [V] 19 hab types in 4 slots (max 11.34B chickens), each type ×30–60
pricier than the last; 12 vehicle tiers (Trike 5,000 eggs/min → 50M), 4 slots growing to 17. [V]

### 1.3 Common research (resets on prestige)

13 tiers, ~50 lines, **4,660 levels**, total cost ~5.5e73. Most lines are small steps (+10% laying ×50
levels = ×6), punctuated by single-purchase spikes ("Bigger Eggs: DOUBLES egg value", "TRIPLES",
"10× egg value"). Lines in different tiers multiply. [V] Every level is priced on one shared 500-point
**price curve** indexed by "egg level" times a per-line percentage, so all costs follow one table. [V]
A tier opens after a number of purchases on the current farm (thresholds commonly quoted as 30, 80,
160, 280 ... [?]); the research building redraws at 200, 400, 750 and 1,200 purchases. [V] Every
purchase also drips golden eggs into the (paid) piggy bank: +3 per research, +50 per hab. [V]

### 1.4 Egg types: progression inside a run

19 eggs: Edible 0.25 → Superfood 1.25 (discovered at 10M farm value) → Medical 6.25 (840M) → Rocket
Fuel 30 (38B) → Super Material 150 (27T) → Fusion 700 → Quantum 3,000 ... → Universe 100T →
Enlightenment (value ~0, an endgame challenge egg). [V] Early steps are ×5 value while discovery
thresholds grow ×80–×700. [~] Upgrading the egg restarts the farm on a pricier curve: **each egg is a
mini-prestige inside a prestige**, and each one redraws the hatchery. [V]

### 1.5 Prestige: soul eggs

- Prestige resets chickens, common research, habs, silos, vehicles and the egg; it keeps epic
  research, golden eggs, boosts, mystical eggs and artifacts. [V]
- **Soul eggs (SE)** gained grow with bocks earned this run, x, through stacked power laws with
  exponents 0.15 → 0.21 (above 1e60: SE = 10^-1.26 · x^0.21). The wiki: "The rate of Soul Egg gain
  slows as your Prestige Earnings increase, encouraging frequent prestiging over waiting." [V] A run
  earning 1e12 → ~8 SE; 1e21 → ~250 SE. [~]
- **Each SE is +10% earnings** (additive), +1 point per level of epic "Soul Food" (to 150%). The first
  prestige is therefore a giant, legible jump. [V]
- Community timing rule: "if the game is slowing down and you have no goals that require staying on the
  current egg, then it's time to prestige." Late-game ritual, the **preload**: fill habs with hatchery
  boosts, fire earnings boosts plus a "Soul Beacon" (500× SE gain for 10 min), prestige when they end. [V]

### 1.6 Earnings bonus: additive base × compounding rare layer

EB = SE × (10% + Soul Food) × (1.05 + 0.01·Prophecy Bonus)^PE × 1.01^EoT [V]

**Eggs of Prophecy (PE)** multiply the soul-egg bonus by 5% each, compounding (10% with a 5-level
research costing 2.75M golden eggs). They are **finite**: 231 existed in late 2025 (163 from contracts,
40 trophies, 24 daily calendar, 4 seasons). [V] Players rank themselves by EB orders of magnitude
(Farmer I, II, III, Kilofarmer ...), a status ladder the game itself never shows. [V]

### 1.7 Epic research: the permanent tree

21 lines bought with golden eggs, never reset, 16.67M golden eggs in total. Each level's price is a
**linear interpolation** between a hard-coded first and last price: first + ⌊(level−1)(last−first)/
(levels−1)⌋. [V] The mix: hatching speed, −5%/level hab, vehicle and research costs (to −50%), +6 min
offline per silo per level, +200% hatching while away, Soul Food, +10% SE per prestige per level,
drone rewards, ship speed and capacity. [V] Golden eggs come from active play: drones (3–48), gift
boxes, ads, the daily calendar, challenges, trophies (1K–25K) and contracts, plus a **welcome-back gift
of 720–1,440 after 7+ days away**. [V]

### 1.8 Drones, boosts, tokens, silos

- **Drones** spawn every 23.4 s on average (~154/h, clustered), 8% are fast "elite"; 70% pay bocks, 30%
  golden eggs. Bocks = S × band (0.04% / 0.2% / 1% of farm value) × √RCB, where **S is a hidden catch-up
  multiplier from 30× (far behind the expected farm value) down to 0.25× (far ahead)**. [V]
- **Boosts**: 3× earnings 20 min, 10× 15 min, 50× 10 min; hatchery 10×/100×/1000×; beacons that multiply
  active boosts; 2 at once (5 paid). In contracts they also cost **tokens** that arrive on a timer
  (e.g. every 30 min). An ad gives 2× for 30 min (+30 min per research level). [V]
- **Silos** store 1 h of offline income each: free players get 2 silos at half rate, paid 10 at full
  rate; silo n costs 100,000·(n−1)^(n+14); research adds +2 h per silo → **30 h maximum**. [V]

### 1.9 Contracts and co-ops (the multiplayer model)

- From 1,000 SE: a co-op must **deliver N of an egg within a time limit** on a separate farm (example:
  7 days, max 5 players, a token every 30 min, three goals 75T / 250T / 3q, a reward per goal);
  deliveries pool; up to 3 contracts at once. [V]
- Since May 2023 players sit in grades C → AAA by earnings bonus and 30-day history. **Contract score**
  = ⌈187.5 · goals share · grade (1–7) · C · (1 + days/3) · (1 + 4(1 − time used)³) · (1 + teamwork)⌉
  with C = 1 + 3·ratio^0.15 (your share against an even split: carrying gives little extra). Teamwork
  comes from **"chicken runs"**, gifting 5% of your population to a co-op mate (cooldown ~3 h [?]). [V]
- Rewards: SE, golden eggs, boosts, artifact cases and **prophecy eggs**, once per contract; reruns
  give points only "to reduce the risk of burnout". [V]
- **Seasons** (since Dec 2024): 13 contracts per quarter; cumulative score unlocks 5 seasonal goals
  (one prophecy egg among them); old contracts return weekly as reruns for catch-up. **Nothing resets**:
  the season is a reward track and a calendar. [V]
- Enforcement: warnings for "Low Contribution", "Poor Teamwork", "Abandoned Co-op", kicks, demotions;
  top players "will often need to disrupt their sleep schedule". [V]

### 1.10 Rockets and artifacts (the expedition system)

- Unlock at 100K Rocket Fuel eggs/min and 10K SE; the pad sits half-built until then (a visible
  promise). Ships cost bocks plus **eggs as fuel** (a production sink); 3 missions at once. [V]
- 11 ships, each with Short / Standard / Extended trips: the first 20 min / 1 h / 2 h, the last 2 / 3 /
  4 days; each unlocks after N launches of the previous ship (4 → 40) plus an SE threshold. **Stars**
  from launch points (1 / 1.4 / 1.8) raise capacity and quality; longer trips return better items;
  late ships can **target** an item family. [V]
- Loot: **artifacts** (tiers 1–4, common → legendary, 0–3 stone slots, 2 equipped, 4 paid), **stones**
  to socket, **ingredients** for crafting; all survive prestige. Crafting gets cheaper with experience
  (to 10% after 300 crafts) and rarer results more likely. Early advice: "don't worry about crafting.
  Anything you can craft today will drop for free from the next ship." [V]

### 1.11 Path of Virtue (Sept 2025): a restriction mode after the end

Five special eggs, each enabling only one system (research, shipping, silos, ships or habs); shifting
between them costs soul eggs; your earnings bonus does not apply. Delivery milestones award **Eggs of
Truth** (490 in total, at least ~1.8 years of play), worth ×1.01 compounding on normal farms. [V]

### 1.12 Rhythm and what goes wrong

- **First hour**: nonstop tapping, the screen fills with running chickens, something affordable every
  few seconds, the first new egg in the session. **First day**: several eggs, drones and gifts, the first
  prestige (+100% or more), check-ins every couple of hours as silos fill. **First month**: contracts
  pull you into co-ops, rockets add a slower clock (hours to days), epic research becomes the goal. [~]
- **Problems**: number inflation empties numbers of meaning (vigintillions); 13 tiers of identical
  "+5% something" lines; the late game is boost and token spreadsheeting, dependent on third-party
  calculators; co-op pressure (warnings, kicks, alarms); a finite compounding currency creates a gap
  that seasonal rewards and reruns were added to close; the restriction mode is deep but opaque.

---

## 2. Melvor Idle (Games by Malcs; browser 2018, full release 2021 [?])

### 2.1 Shape

- A RuneScape-like idle RPG: 24 skills, 1,279 items, 161 enemies, 17 dungeons, level cap 99. Paid
  expansions add layers to the same save: Throne of the Herald (2022, levels 100–120), Atlas of Discovery
  (2023, two skills, Ancient Relics mode), Into the Abyss (2024, a separate "Abyssal Realm" with 60 new
  levels per skill, so new bonuses don't make old content trivial). One-time purchase, no MTX. [V]
- **One active action at a time** is the central constraint. Parallel exceptions: Farming plots (real
  time), Township (hourly town ticks, buildings decay and need repair), passive cooking (the two idle
  utilities at 5× the time, no XP), and passive modifier systems (Agility, Astrology, Summoning). [V]

### 2.2 Actions, XP and mastery

- Woodcutting: Normal tree 3 s (level 1), Oak 4 s (10), Willow 5 s (25), Teak 6 s (35), Maple 8 s (45),
  Mahogany 10 s (55), Yew 12 s (60), Magic 20 s (75), Redwood 15 s (90). Shop axes −5% each, the level-99
  cape −15%, "Multi-Tree" cuts 2 trees at once (3 with expansions). [V]
- XP per level ≈ ⌊(L − 1 + 300·2^((L−1)/7))/4⌋: it **doubles every ~7 levels**, level 92 is half of 99
  (13M XP). A new tree, ore or recipe arrives every ~10 levels, so an unlock is always near. [V]
- **Mastery**: every recipe has its own level; its XP per action grows with total mastery in the skill.
  Rewards are small and frequent (woodcutting: +5% double logs every 10 levels, −0.2 s at 99). **25% of
  mastery XP also fills a skill-wide pool** (cap 500,000 × items); the pool can be spent 1:1 on any
  recipe, and **checkpoints at 10/25/50/95% full** give skill-wide bonuses (woodcutting: +5% mastery XP,
  +5% double items, +50% log sale value, +1 nest). Spending below a threshold switches its bonus off: a
  real spend-or-hold choice. [V]
- Cross-skill rewards make "useless" skills worth training: Firemaking mastery and its cape give global
  XP bonuses. [V]

### 2.3 Interlocks, combat, offline

- Woodcutting → Firemaking (bonfires, 40% coal per burn) → better cooking fires; Fishing + Cooking →
  food → Combat; Mining → Smithing → gear; Farming → Herblore potions; Summoning tablets need other
  skills' goods, and familiar pairs unlock synergies. [V]
- Combat is automatic; the player sets gear, food, prayers and potions. Shop upgrades remove chores
  (auto-eat tiers, auto slayer). Dungeons are monster sequences whose **first clear unlocks content**. [V]
- **Offline**: up to **24 h at the full online rate**, simulated exactly, then a summary. "There is no
  actual difference between being Online and being Offline ... other than not being able to switch what
  action you're doing." [V] Active play is not faster; it only allows more decisions.

### 2.4 Why no prestige still lasts hundreds of hours

Breadth (24+ skills × dozens of recipes, each with level and mastery, a completion log, a pet per
skill); the doubling XP curve (a near unlock and a far 99); interlocks that make "what next" a real
plan; new realms that add layers instead of resets; and **optional restart modes** standing in for
prestige: Hardcore (death deletes the save), Adventure (skills bought with gold), and **Ancient Relics**
(all skills capped at 10, each first dungeon clear raises chosen caps by 15, relics at 1/1,000 per action
grant permanent modifiers). [V]

### 2.5 Melvor Idle 2 (status October 2026)

Announced 23 April 2025: a Godot rewrite, Steam Early Access planned for 2026 with a Next Fest demo 19–26
October 2026 and 12–18 months of Early Access; 29 skills (5 new, reportedly Ranching, Hunting,
Beastcrafting, Construction, Enchantment [?]), cap 120, story quests with bosses, day/night and
weather, new modes, no MTX, alpha saves kept. [V] Design changes that matter here:
- **Mastery Guilds** replace per-item mastery with "pre-defined tasks that you need to complete within
  the Skill, which unlock powerful bonuses as you level up your Guild", now also for combat. [V]
- **Automation built in**: "We saw how heavily automation mods were used in MI1, so we decided to add it
  as a core mechanic" (auto plant, harvest, compost). [V]
- Combat moves away from "the 'one weapon is BiS' meta" toward build diversity; hourly-rate readouts and
  an event log that includes offline progress. [V]

### 2.6 Rhythm and what goes wrong

- **First hour**: a new log type every few minutes (Oak at level 10 ≈ 115 normal logs ≈ 6 min [~]), sell,
  buy an axe, watch the timer shrink. **First day**: one overnight 24 h action, levels 40–60, first food
  and combat loop. **First month**: first 99s, mastery pools, dungeons. Session: one decision per check-in.
- **Problems**: dead time (one action means long AFK stretches with nothing to decide); multi-hour grinds
  near 99; bank-space chores; dependence on the wiki and a combat simulator; automation mods so popular
  that MI2 absorbed them; opaque formulas that MI2 replaces with plain tasks.

---

## 3. Side by side

| Question | Egg, Inc. | Melvor Idle |
| --- | --- | --- |
| Why come back today? | silos full, tokens, ships back | the 24 h action ran out, a level is close |
| Where does power come from? | prestige multipliers, permanent tree | breadth: levels, mastery, gear, unlocks |
| Active vs idle | active is far better (RCB, drones, boosts) | same rate, only more decisions |
| Multiplayer | co-op contracts, pooled goal | none |
| Reset | prestige every hours/days, mini-reset per egg | none; optional modes |
| Expeditions | rockets: fuel sink, 3 slots, stars, loot survives prestige | dungeons: first clear unlocks |

---

## 4. Lessons for Wipe Day (own names, proposals)

1. **Momentum as the clicking verb (RCB).** Taps on the wreck, a tree or the forge fill a visible
   Momentum meter that multiplies output and decays seconds after you stop; research raises its cap
   (×2 → ×20–50), then "hold to work" replaces mashing, then automation makes it a bonus, not a need.
   Real seconds only (UX rule 9), online minutes only.

2. **Crew and machines as parallel action slots, with automation as unlocks.** Melvor's "one action at
   a time", inverted: you start as the only worker; each crew member, rig or conveyor adds a slot that
   keeps working offline (1 → ~12 slots, each visible at its node). Every chore the first hour teaches
   (requeue, replant, collect) has a visible upgrade that removes it (MI2's lesson).

3. **The three-pipe bottleneck.** Gather rate → storage caps → processing throughput (furnaces,
   benches) → export value at the dock. One green/yellow/red gauge per chain; the advisor names the
   binding pipe ("furnaces are full: build a second"), which makes "one obvious next action" computable.

4. **Per-run research on one price curve, tiers by count, rare DOUBLES.** Many small levels (+5–25%), a
   "doubles plank value" spike per tier, tiers opening after N purchases, the workshop redrawn at
   milestones. One price table indexed by base tier keeps balance in data.

5. **Base tiers as eggs.** Twig → Armored each multiply item value (×4–5) and open a chain at a visible
   base-value threshold. Recommendation: keep buildings on tier-up, reset only in-run research, so the
   base still tells the story.

6. **The red button: sublinear points, huge first jump, live preview.** Points = ⌊k · (run value)^0.2⌋,
   each +10% to all output. The button shows points now, points per hour, "next point at". The first
   nuke (day 1–2) should be +100% or more. A short end-of-run consumable that multiplies points earned in
   the last 10 minutes turns the launch into an event.

7. **Two prestige layers.** Nuke points add; a rare token from co-op contracts only (prophecy eggs)
   multiplies them ×1.05 each, compounding. Finite per season, with reruns for late joiners from day one.

8. **A massive tree that is cheap to balance.** ~150–300 nodes, each a short line of 1–20 levels priced
   by two numbers (first, last) with linear interpolation. Lines mirror Egg, Inc.'s mix: −5%/level cost
   cuts (to −50%), longer offline window, automation, +10% nuke points, quality of life.

9. **Rare scrap as the active-play currency.** Scrap drops from active things (drifting crates, tapped
   events, expedition finds, a welcome-back gift after 7+ days) and buys tree nodes and timed boosts; nuke
   points are power, scrap is choice. It persists across nukes. The casino becomes optional.

10. **Tappable scene events with a catch-up multiplier (drones).** Something drifts through the scene
    every ~25–40 s while open, paying a band of base value (0.04% / 0.2% / 1%) or a little scrap, scaled
    ×10–30 for players far behind their stage's expected value and ×0.25 far ahead: a rubber band for
    friends playing at different paces.

11. **Expeditions as rockets.** Trips cost **fuel and rations made by your chains**; 3 slots; each site
    has short / standard / long trips (20 min → 1–4 days at the top); a site opens after N trips to the
    previous one; **stars** per site from trips raise loot count and quality; late sites allow
    **targeting** a loot family. Loot is **relics** (tiers, rarities, slots for "cores") that survive
    the nuke in the bunker; relic crafting gets cheaper with experience. Fits the current map and keycodes.

12. **Co-op convoys replace PvP and the market; seasons stop wiping.** Weekly: deliver N of an item
    (e.g. 40K plates, 8K fuel) within 72 h, three goals, a reward per goal for all, delivered from each
    base's storage; a daily "send a crate" gift (5% of a resource) to a friend. Avoid Egg, Inc.'s
    failures: no grades, warnings or kicks among 3–6 friends, long windows so nobody sets alarms,
    diminishing returns on share (ratio^0.15), reruns for points only. Like Egg, Inc., a season becomes a
    calendar of convoys plus a cosmetic track and a leaderboard; the nuke is the only reset.

13. **An offline window that grows (silos).** Start at 4–8 h of accrual and upgrade toward 24–30 h
    through the tree (Egg, Inc. +6 min per level per silo; Melvor a flat 24 h). It drives early check-ins
    while the welcome-back summary and gift keep days away painless.

14. **Know-how survives the nuke (mastery, guilds).** Each chain has a level; each recipe a mastery; a
    share of mastery XP fills a chain pool with checkpoints (10/25/50/95%) granting chain-wide bonuses.
    Thematically "what you learned": mastery persists across nukes while buildings reset. Present it as
    MI2-style tasks ("smelt 500 ingots: +5% double ingots"), not formulas, for zero-tutorial UX.

15. **Challenge islands for veterans (Ancient Relics, Path of Virtue).** Optional restricted runs ("no
    furnaces", "crew only", "level cap 10 until the first site is cleared") pay a small compounding
    permanent bonus (×1.01 each, as truth eggs do). Variety without new content, and a reason for the
    strongest friend to slow down.

---

## 5. Conflicts with the current spec to resolve

- **Activity guardrail** ("8 check-ins ≈ 1.6× of 3", CLAUDE.md §8) versus an Egg, Inc.-style active
  multiplier: bound active gains per day, or accept a larger gap and make active play a faster route to
  the same nuke.
- **Integers in state**: Egg, Inc. reaches 1e60+ in doubles; SQLite integers stop at 9.2e18, JS safe
  integers at 9e15. Keep growth under ~1e15 (×5–10 per tier, not ×1000) or store mantissa + exponent.
  Decide before data files are written.
- **Legacy 25% cap**: incompatible with incremental prestige (+10% per point compounds to ×100s). Replace
  the power cap with catch-up tools (scene-event rubber band, convoy reruns, rare-token reruns).
- **Seasons, PvP, market, casino**: the nuke plus co-op convoys can replace the monthly wipe and PvP; the
  casino is optional once scrap is rare.

---

## Sources

Egg, Inc. community wiki (read through its MediaWiki API, October 2026), pages under
https://egg-inc.fandom.com/wiki/ : Earnings_Bonus, Earnings_Bonus/Soul_Eggs,
Earnings_Bonus/Eggs_of_Prophecy, Earnings_Bonus/Eggs_of_Truth, Research,
Research/Research_Cost_Formula, Research/Epic_Research, Research_Building, Prestige, Contracts,
Contracts/Contract_Score, Contracts/Contracts_V1, Contracts/Quantum_Payload, Boosts, Boost_Tokens,
Drones, Grain_Silos, Hatchery, Habitats, Vehicles, Eggs, Spaceships, Artifacts, Artifacts/Crafting,
Path_of_Virtue, Golden_Eggs, Piggy_Bank, Version_History.
Also: https://en.wikipedia.org/wiki/Egg,_Inc. ; Auxbrain posts cited by the wiki:
https://medium.com/@kevin_67107/changes-to-cs-4ff41a7ed1e4 and
https://medium.com/@kevin_67107/season-rewards-f15b6ef8961b

Melvor Idle official wiki (MediaWiki API, October 2026), pages under https://wiki.melvoridle.com/w/ :
Mastery, Offline_Progression, Game_Mode, Ancient_Relics, Hardcore, Adventure, Expansion, Realms, Shop,
Woodcutting, Experience_Table, Firemaking, Cooking, Township.

Melvor Idle 2:
- https://store.steampowered.com/app/3218350/Melvor_Idle_2/
- https://www.gamingonlinux.com/2025/04/popular-idle-game-melvor-idle-is-getting-a-sequel-with-melvor-idle-2-bringing-some-huge-new-features/
- https://news.melvoridle.com/what-weve-been-up-to-with-melvor-idle-2/ (20 Nov 2025)
- https://news.melvoridle.com/melvor-idle-2-development-progress-update-june-2026/
- https://news.melvoridle.com/melvor-idle-2-development-progress-update-september-2026/
- Third-party summary, used only for the new skill names [?]: https://tideward.app/melvor-idle-2/

# Reference research: Cookie Clicker and AdVenture Capitalist

Researcher: "ref-cookie-adcap". Input for the Wipe Day idle redesign (click, automate, nuke the
island, spend points in a massive tree). Nothing in the repository was changed.

Confidence tags used below:

- **[V]** verified from a source fetched in this session (listed at the end).
- **[M]** from memory or a secondary source, consistent with what was fetched but not checked line by line.
- **[E]** my own derivation or estimate from the verified numbers.

---

## 1. Why these two games matter for Wipe Day

They are the two purest examples of the loop the owner described:

- **Cookie Clicker (CC)**: click a big thing, buy generators, the passive rate overtakes clicking within
  minutes, then hundreds of upgrades, random "golden" bursts that reward being present, achievements
  that are themselves a multiplier, and a prestige ("ascension") with a huge node tree. Its late game
  adds slow real-time currencies and minigames.
- **AdVenture Capitalist (AdCap)**: every business must be tapped once per production cycle until you
  hire its **manager** (the automation step), ownership **milestones** (25/50/100...) multiply speed and
  profit, and **angel investors** (prestige) are both a currency and a passive bonus. Later it adds
  other worlds and time-limited events with their own small economies.

---

## 2. Cookie Clicker

### 2.1 Generators and the cost curve

- Price of the next building = `base × 1.15^(owned − free)` **[V]**. 1.15^5 ≈ 2.01, so the price
  **doubles every 5 copies**; 1.15^50 ≈ 1084, so **×1000 every 50 copies** **[V][E]**.
- Selling refunds 25% of the current price (≈28.75% of what you paid; 50% with a dragon aura) **[V]**.
- Base cost and base output (CpS = cookies per second) **[V]**, with base payback (cost / CpS) **[E]**:

| Building | Base cost | Base CpS | Base payback |
| --- | --- | --- | --- |
| Cursor | 15 | 0.1 | 150 s |
| Grandma | 100 | 1 | 100 s |
| Farm | 1,100 | 8 | 138 s |
| Mine | 12,000 | 47 | 255 s |
| Factory | 130,000 | 260 | 500 s |
| Bank | 1.4 M | 1,400 | 1,000 s |
| Temple | 20 M | 7,800 | 2,564 s |
| Wizard tower | 330 M | 44,000 | 7,500 s |
| Shipment | 5.1 B | 260,000 | 19,615 s |
| Alchemy lab | 75 B | 1.6 M | 46,875 s |
| Portal | 1 T | 10 M | 100,000 s |
| ... 20 buildings in total, up to "You" at 540 septillion | | | |

**Design insight [E]:** each tier costs ~11-16× the previous but gives only ~5-6× the output, so
base payback roughly **doubles per tier**. The game still pulls you up the ladder, because the
1.15 curve makes the 50th grandma (≈108k cookies) far worse than the first farm. The cheapest
"cost per CpS" keeps moving between buildings, and that rotation is the core buy decision.

### 2.2 Upgrades (the "one more thing" layer)

- 717 normal upgrades in v2.058 **[V]**, of which 300 are building tiers: each tier **doubles one
  building's CpS** and unlocks at 1, 5, 25, 50, 100, 150, 200 ... 600 owned **[V]**. Ownership
  thresholds therefore act as milestones, the same idea as AdCap's.
- Cursor tiers 4+ ("Thousand fingers") instead add +0.1 cookies per click and per cursor for every
  *non-cursor* building, then ×5, ×10, ×20 **[V]**, so the clicking path scales with everything else.
- Mouse upgrades make each click give +1% of CpS **[M]**, which keeps clicking relevant for life and
  is what makes Click Frenzy combos explode.
- "Flavoured cookie" upgrades give flat +x% CpS. Synergy upgrades boost pairs of buildings **[V]**.
- Research upgrades take real time (30 min each, ×10 faster with the "Persistent memory" heavenly
  upgrade) **[V/M]**.

### 2.3 Click → buildings → upgrades: how fast

- "Speed baking I/II/III": **1 million cookies baked in 35 / 25 / 15 minutes** of a fresh run **[V]**.
  So 1M in roughly half an hour is the designed pace for an engaged new player.
- "Neverclick" (1M with at most 15 clicks) and "True Neverclick" (1M with **no** clicks) exist **[V]**:
  the designer made sure pure idle works too.
- Derived timeline **[E]**: at about 5 clicks/s, the first Cursor (15) comes in ~3 s. Five grandmas
  (≈674 cookies in total) give 5 CpS, which matches hand clicking, so **passive output overtakes clicking
  within about 3-5 minutes**. Farms come at about minute 5, mines and factories by minute 20-30,
  1M at minute 15-35.
- The first golden cookie spawns 5-15 minutes in **[V]**, which is perfectly timed to teach the
  active layer just as clicking stops mattering.

### 2.4 Golden cookies, frenzies and combos (active bursts in an idle game)

- Spawn every **300-900 s** (mean about 7.4 min), on screen for a short time (~13 s base) **[V/M]**.
- Main effects **[V]**:
  - **Frenzy**: CpS ×7 for 77 s.
  - **Lucky**: the lesser of 15% of the bank + 13, or 15 minutes of CpS + 13. Capping by bank turns
    "keep a big bank" into a strategy.
  - **Click Frenzy**: click power ×777 for 13 s. **Building special**: +10% CpS per building of one
    random type for 30 s. **Cookie chain** and **Cookie storm** (many cookies, each worth 1-7 min
    of CpS).
- **Combos**: buffs multiply, so Frenzy × Building special × Click Frenzy produces hours or days of
  production in seconds **[V]**. Upgrades double spawn rate and duration (Lucky day, Serendipity),
  or effect duration (Get lucky) **[V]**.
- The **Grimoire** spell "Force the Hand of Fate" summons a golden cookie on demand (from magic that
  regenerates over time), so experts *save* a spawn to stack combos **[V/M]**.
- **Golden switch** (heavenly, 999 HC): **+50% passive CpS but no golden cookies** **[V]**. The
  pantheon spirit Holobore gives +15/10/5% CpS but leaves its slot when you click a golden cookie
  **[V]**. These are explicit **idle-versus-active builds**.

### 2.5 Achievements → milk → kittens (achievements as a multiplier)

- Each achievement gives **4% milk**; 622 normal achievements give up to 2,488% milk; shadow
  achievements give none **[V]**.
- Kitten upgrades multiply CpS by `1 + milk × factor`. Factors are 0.1 (helpers, from 52% milk, i.e.
  13 achievements), 0.125 (workers, 100%), 0.15, 0.175, 0.2 ... and the heavenly "Kitten angels"
  adds 0.1 **[V]**. These multiply each other, so **every achievement raises output through ~15
  stacked multipliers**.
- The effect is that collecting things is a power source: "bake X", "own N of Y", "click a golden
  cookie N times", and joke ones like "Just plain lucky" (1-in-a-million chance every second) **[V]**.

### 2.6 Prestige: heavenly chips and prestige levels

- **Prestige level** = cube root of all-time cookies baked ÷ 10^12 **[V]**. The first level needs
  1 trillion cookies. Doubling your prestige needs **8× the all-time earnings** **[V]**.
- Each ascension grants heavenly chips 1:1 with the new prestige levels **[V]**. **Chips are spent in
  the tree; levels are never spent** and give **+1% CpS each, additive** **[V]**. So spending is never
  punished. This is cleaner than AdCap's model (see 3.6).
- The +1%/level bonus needs "Legacy" (1 HC). Its potential is then unlocked by five cheap in-run
  upgrades at 5% / 25% / 50% / 75% / 100% **[V]**, costing 11 / 1,111 / 11,111 / 111,111 / 1,111,111
  cookies **[M]**. This is a small ritual at the start of every run: re-buy your power in the first
  minutes, which feels great.
- **Persists:** heavenly upgrades, prestige, unspent chips, sugar lumps and building levels, garden
  seeds. **Resets:** buildings, normal upgrades, cookies **[V]**.
- **First ascension:** possible at 1 prestige, but the community target is **~365 levels**, which buys
  Legacy, Heavenly cookies, the dragon, cookie boxes, Heavenly luck and Permanent upgrade slot I.
  The second target is ~2,185 **[V]**. 365 levels need ~4.9×10^19 all-time cookies **[E]**. Real
  first-run length varies a lot: several days of mixed play is typical, and some guides say weeks
  **[M, uncertain]**.
- The ascend button always shows the levels you would gain right now **[M]**, so the reset decision
  is visible and continuous.

### 2.7 The heavenly upgrade tree (the "massive tree")

- **Size:** about 100+ nodes (wiki pages say "80+" and "over 100" depending on version) **[V]**.
- **Layout:** a free-form constellation graph on the ascension screen. "Legacy" sits at the centre,
  branches radiate out and lines show prerequisites (for example Twin Gates → Angels → Archangels
  → ...) **[V]**.
- **Cost range: 1 HC to 50 billion HC, about 11 orders of magnitude** **[V]**. So the same tree serves a
  first-day player and a player 2,000 hours in. Costs use playful digit patterns: 7 / 77 / 777 / 7,777;
  1,111; 99,999; 7^n for the angel chain (7, 49, 343, 2,401, 16,807, 117,649, 823,543) **[V]**.
- **Node types, with examples [V]:**

| Kind | Examples (cost) | Why it works |
| --- | --- | --- |
| Gate that opens the system | Legacy (1) | a first purchase that "turns on" prestige |
| Flat multiplier | Heavenly cookies +10% (3), Wrinkly cookies +10% (6.67 M), Sugar crystal cookies (1 B) | simple, always useful |
| Faster restart | Starter kit: start with 10 cursors (50); Starter kitchen: 5 grandmas (5,000) | skips the boring re-opening |
| Keep something | Permanent upgrade slots I-V (100; 20,000; 3 M; 400 M; 50 B): keep one chosen normal upgrade per slot through ascension | a personal, build-defining choice |
| Offline production | Twin Gates (1): 5% CpS for 1 h while closed (0.5% beyond); Angels → God +10% each to 75%; demons Belphegor (7) 2 h ... Lucifer (823,543) 5 d 8 h | offline is *earned*, not given |
| Golden-cookie branch | Heavenly luck 5% more often (77), Lasting fortune 10% longer (777), Decisive fate (7,777) | invests in the active style |
| Unlocks new systems | How to bake your dragon (9), Season switcher (1,111), Kitten angels (9,000), Synergies Vol. I/II (222,222 / 2.718 M), Sugar baking/craving | new toys, not just numbers |
| Discounts | Divine discount/sales: buildings/upgrades 1% cheaper (99,999 each), Five-finger discount | small, cumulative |
| QoL | Persistent memory: research ×10 faster (500), Inspired checklist: **"Buy all" button** (900,000), Genius accounting (2 M), Label printer (5 M) | even convenience is a reward |
| Joke or skill nodes | Lucky digit / number / payout (777; 77,777; 77.78 M): +1% prestige, need the prestige level to end in 7 / 777 / 777777 **[M for condition]** | gives people a reason to time a reset |
| Keep collections | Keepsakes (1.111 B): seasonal drops have a 1/5 chance to survive ascension | softens the reset |

### 2.8 Challenge mode: "Born Again"

A run in which heavenly upgrades, prestige, sugar lumps, building levels, permanent slots and
minigames have no effect **[V]**. It exists to earn achievements that need a clean start
(Speed baking, Hardcore: 1B with no upgrades, Neverclick). Achievements feed milk, so a challenge
run raises your power permanently.

### 2.9 Sugar lumps (a slow real-time currency)

- Unlock at 1 billion cookies baked. One lump grows on a **24 h cycle**: mature at 20 h (harvest with a
  50% chance of success), ripe at 23 h (guaranteed), falls by itself at 24 h. Up to ~4 h faster
  with upgrades **[V]**.
- Types: normal (1), bifurcated (1-2), golden (2-7 plus a bank bonus), meaty (0-2), caramelized
  (1-3) **[V]**.
- Uses: **building level N costs N lumps for +1% CpS of that building** **[V]**. Level 1 of Farm / Bank
  / Temple / Wizard tower **unlocks a minigame** **[V]**. "Sugar frenzy" (×3 CpS for 1 h, once per
  ascension) and "Sugar baking" (+1% CpS per unspent lump up to 100) **[V]**.
- **Persist through ascension** **[V]**. The point: a daily, unmissable reason to check in that no
  amount of clicking can speed up.

### 2.10 Minigames (unlocked by buildings, partly persistent)

- **Garden** (Farm): ticks every 3-15 min depending on soil (dirt 5, fertilizer 3, clay 15). The plot
  grows from 2×2 to 6×6 with farm level. 34 plants bred by adjacency mutations. **Seeds stay
  unlocked through ascension**. Completing the seed log lets you sacrifice it for 10 sugar lumps **[V]**.
- **Stock market** (Bank): goods tick every ~60 s with random-walk prices, bought with "production
  seconds" **[V/M]**.
- **Pantheon** (Temple): 11 spirits in 3 slots (diamond > ruby > jade strength). Worship swaps
  regenerate in 1 h (from 2 left), 4 h (from 1) or 16 h (from 0), up to 3 **[V]**. It is a loadout
  system with a cost to change.
- **Grimoire** (Wizard tower): a regenerating magic meter sized by tower count and level. Spells include
  summoning a golden cookie **[V/M]**.

### 2.11 Grandmapocalypse and wrinklers (opt-in risk)

- A research chain turns grandmas evil (three stages). Wrath cookies appear among golden cookies,
  with big risk/reward effects such as Elder frenzy ×666 for 6 s or Clot ×0.5 **[M]**. An "Elder
  Pledge/Covenant" can pause or stop it **[M]**.
- **Wrinklers**: up to 10 (14 with upgrades) latch on, each **withering 5% of CpS**, but popping one
  returns **1.1× what it ate** (shiny: 3.3×). The net multiplier `1 + N·0.05·(1.1·N − 1)` grows
  quadratically, so 10 wrinklers is a big net gain **[V]**. A visible, tappable, risky savings
  account.

### 2.12 Seasons and the dragon

- Five real-calendar seasons (Christmas, Halloween, Valentine's, Easter, Business Day), each with a
  collection of drop-only upgrades. Season switcher (1,111 HC) lets you start one anytime for a
  rising cookie price **[V]**. Collections drive repeat play. Keepsakes keeps 1/5 of the drops through
  ascension **[V]**.
- The dragon (9 HC to unlock, egg after 1M cookies) levels up by **sacrificing buildings** (e.g. 100 of
  one type per level) and unlocks selectable auras **[M]**: a sink for surplus generators.

### 2.13 Offline gains

Base game: **nothing while closed**. Offline production is a tree branch: 5% for 1 h (Twin Gates),
up to 75% (God) and up to 5 d 8 h (Lucifer), with a reduced rate beyond the window **[V]**. The
browser version keeps producing at 100% if the tab stays open, which pushes "leave it open" play.

### 2.14 What makes each time scale compelling

- **First 5 minutes:** a giant clickable object, a number going up on every tap, a first purchase in
  seconds, and a joking news ticker that changes as you buy things **[M]**. Achievements pop in
  minute 1 ("Wake and bake": 1 cookie) **[V]**.
- **First hour:** new building types every few minutes, building-tier upgrades at 1/5/25 owned, the
  first golden cookies, a steady stream of achievements and the first kitten upgrade at 13
  achievements.
- **First day:** 1 billion unlocks sugar lumps (a 24 h hook). 1 trillion lights the ascension
  counter. Seasonal and grandma research chains open.
- **First week:** first ascension, the tree, starter kits, minigames unlocked one lump at a time,
  and the realisation that each run gets faster.
- **Session rhythm:** active bursts (5-15 min golden cycles), check-ins for lumps (daily),
  garden ticks (minutes to hours), pantheon swaps (hours), and ascension every few days, then
  more often.

### 2.15 What players complain about (late game)

Prestige bonuses stop mattering once they become astronomical. Setting up combos becomes tedious.
The stock market is boring. The garden grind and very long achievement gaps late on. "After all
the heavenly upgrades there is little left" **[V: Steam threads via search]**. The deeper lesson:
when the meta layer is just a bigger multiplier, it stops feeling like progress. Unlocks and new
systems keep it alive; numbers alone do not.

---

## 3. AdVenture Capitalist

### 3.1 Businesses (Earth)

Price of the next = `base × coefficient^owned` **[V]**. Costs grow exactly ×12 per tier. Coefficients
fall as tiers rise (cheap things get expensive fast; expensive things scale gently) **[V]**.

| Business | Base cost | Coef. | Cycle | Revenue/cycle | Base payback **[E]** |
| --- | --- | --- | --- | --- | --- |
| Lemonade stand | 3.738 | 1.07 | 0.6 s | 1 | 2.2 s |
| Newspaper | 60 | 1.15 | 3 s | 60 | 3 s |
| Car wash | 720 | 1.14 | 6 s | 540 | 8 s |
| Pizza | 8,640 | 1.13 | 12 s | 4,320 | 24 s |
| Donut shop | 103,680 | 1.12 | 24 s | 51,840 | 48 s |
| Shrimp boat | 1,244,160 | 1.11 | 96 s | 622,080 | 192 s |
| Hockey team | 14,929,920 | 1.10 | 384 s | 7,464,960 | 768 s |
| Movie studio | 179,159,040 | 1.09 | 1,536 s | 89,579,520 | 3,072 s |
| Bank | 2,149,908,480 | 1.08 | 6,144 s | 1,074,954,240 | 12,288 s |
| Oil company | 25,798,901,760 | 1.07 | 36,864 s (10 h 14 min) | 29,668,737,024 | 32,055 s |

(Shrimp, hockey, oil rows and all coefficients verified; the rest follow the verified ×12 pattern
and Pecorella's article **[V/M]**.)

**Insights [E]:**

- Cycle times run from **0.6 s to 10 h**. The top business is slow and visible: a progress bar that
  takes hours, which suits check-ins.
- A 1.07 coefficient doubles only every ~10 copies, so owning **thousands** of lemonade stands is
  normal. Lemonade milestones run to 6,000+ owned **[V]**.
- Bulk buy has closed forms. Cost of n more: `b·r^k·(r^n − 1)/(r − 1)`. Max affordable:
  `floor(log_r(c·(r−1)/(b·r^k) + 1))` **[V]**. Buy ×1/×10/×100/Max buttons rely on these.

### 3.2 The click → automate step: managers

Without a manager, **every business must be tapped to start each cycle**. A manager runs it forever,
online and offline **[V]**. That is the whole first session: tap lemonade every 0.6 s, buy stands,
afford the first manager in about a minute or two, and feel the relief of automation. Then do the
same for the next business. Manager prices grow with the tier (for example ~$1,000 for lemonade up to ~$100 B
for oil **[M, unverified]**). Later "cost-reduction managers" exist **[V: Steam thread title]**.

### 3.3 Milestones ("unlocks")

- Per business: owning 25, 50, 100, 200, 300, 400 ... gives big multipliers. Early ones are mostly
  **"speed doubled"** (cycle halved), later ones profit ×2/×3/×4/×7 and more. For example lemonade:
  25 → speed ×2; 1,300 → profit ×4; 3,750 → profit ×2 **[V]**.
- **"Capitalist" (all-business) unlocks**: own N of *every* business and all of them get a bonus.
  25 → speed doubled, 50 → speed doubled (+1 slot-machine spin), then 75, 100 and every 100 **[V]**.
  This is the tool that makes players buy *broadly* instead of only the best one.
- The UI always shows the next milestone per business, so each one is a visible goal **[M]**.

### 3.4 Cash upgrades

Bought with cash: mostly ×3 profit for one business or for all of them, plus angel-effectiveness
upgrades **[M]**. Flux capacitors (premium) multiply speed by 2.21 / 3.42 / 4.63 for 1/2/3 units
**[V]**.

### 3.5 Angel investors (prestige)

- **Formula:** `angels = 150 × sqrt(lifetime earnings / 10^15)` **[V]**. The first angel comes at
  $44.44 B, the second at $177.8 B, the third at $400 B (matches the formula) **[V]**. **150 angels at exactly
  $1 quadrillion** **[E]**. Doubling angels needs **4× the lifetime earnings** (Cookie Clicker needs 8×) **[V]**.
- Each held angel gives **+2% profit**, additive (50 angels = ×2, 150 = ×4) **[V]**.
- Angels accumulate as "claimable". Claiming resets businesses, cash and managers **[V]**.
- **Reset heuristic:** reset when the claimable angels are about equal to what you already hold
  (your multiplier roughly doubles). For the first reset, wait for about 100-150 **[V]**.

### 3.6 Angel upgrades (sacrifice)

You can **spend** angels on upgrades (×3 profit, angel effectiveness and so on), but spent angels are
**gone permanently**, their 2% bonus with them, **and the upgrades reset on the next claim** **[V]**.
The wiki publishes break-even points (for example "Angel Sacrifice" costs 10k angels for ×3 and is only worth it
at ≥ 14,950 angels **[V]**). Community rules: spend ≤ 20% of angels on a ×2 for everything, ≤ 50% for ×5-9,
≤ 1% on single-business upgrades **[V]**.
**Lesson:** "spend it and lose the passive bonus" creates math homework and feels bad. Cookie
Clicker's split (levels kept, chips spent) is friendlier.

### 3.7 Moon and Mars

Separate worlds with their own businesses, cash and progression **[V]**. They were designed to *feel*
different. **Moon:** a slow grind with occasional bursts at big unlocks. **Mars:** "out-of-control
growth", for example Terrorformers ×333 roughly every 100 owned **[V]**. Complaint: after Mars,
Earth and Moon feel slow **[V]**. Each world has its own suit sets **[V]**.

### 3.8 Events (separate mini-economies)

Since Oct 2015 **[V]**: themed limited events with their **own businesses, managers and upgrades**
that last **2-4 days** (another source says 7-8 days on average; they vary) **[V]**. You score points
by completing goals. "Golden goals" are worth ≥2,000 points and expire in 3 h. There are ~12 reward
tiers per event plus leaderboard brackets. **Newer players get easier goals** **[V]**. Rewards: suits
(3 pieces, a set bonus like ×2 profit or +0.4%/angel), badges (3 equipped), gold, Mega Bucks,
time warps **[V]**. Events give a "fresh start" feeling every week **without wiping the main game**.

### 3.9 Premium and meta currencies

- **Gold:** buys angel claims without reset (20), vaults (10/50), time warps (instant hours/days of
  earnings), ×3 "kitchen" multipliers, flux capacitors **[V/M]**.
- **Mega Bucks:** from events and unlocks. **Gilding** each business: Gold ×7.77 (10 MB),
  Platinum 1 ×17.77 (10), P2 ×77.77 (30), P3 ×777.77 (100), P4 ×7,777.77 (500 MB per business)
  **[V]**. A permanent per-generator multiplier ladder that survives resets.
- Ad boost: watch an ad for **×2 profit for 4 h** **[V]**. Manager card vaults (gacha) **[V]**. These are
  monetisation, and Wipe Day has none, but the *shape* (a permanent per-generator star rank) is reusable.

### 3.10 Offline gains

Managed businesses earn **100% offline** **[V]**. The welcome-back screen shows what was earned
(and on mobile offers an ad to double it **[M]**). Very generous, so the game is "check once in a while".

### 3.11 What makes each time scale compelling

- **5 minutes:** a 0.6 s tap loop, constant cheap purchases, the first manager (automation), the
  first "speed doubled" at 25 lemonade stands.
- **First hour:** a new business every few minutes (the cost ladder is only ×12), a manager for each,
  and milestone bars filling.
- **First day:** the top businesses with hour-long cycles, offline income, and the angel counter
  climbing past ~100-150, then the first reset at ×3-×4.
- **First week:** resets get shorter, angel upgrades, Moon (and later Mars), the first event.
- **Rhythm:** tap-heavy only at the start of each run. Afterwards check in to buy milestones and
  reset when angels roughly double. A weekly event gives a fresh mini-run.

### 3.12 Complaints

Paywall and expensive purchases (Earth "only beatable by paying"). Long walls where days offline
barely move you ("only worth checking once or twice a week"). Moon too slow. Mars makes the rest
feel slow. Critics called it repetitive with dull achievements ("a pointless waste of time",
Pocket Gamer) **[V]**.

---

## 4. Side by side

| | Cookie Clicker | AdVenture Capitalist |
| --- | --- | --- |
| Cost growth | 1.15 for all 20 buildings | 1.07-1.15, gentler for higher tiers |
| Tier cost ratio | ~11-16× | exactly 12× |
| Automation step | none needed (buildings are passive); clicking stays a scaling option | managers: tap per cycle until hired |
| Milestones | ×2 tier upgrades at 1/5/25/50/100... | speed/profit at 25/50/100/200...; all-business milestones |
| Active burst | golden cookies (5-15 min), combos, spells | (mostly none; events, ad boosts) |
| Prestige formula | cube root of lifetime/10^12 (8× to double) | 150·sqrt(lifetime/10^15) (4× to double) |
| Prestige bonus | +1%/level, never spent; chips spent separately | +2%/angel; spending loses it |
| Tree | ~100+ node constellation, 1 to 5×10^10 cost | flat list of angel upgrades, reset each claim |
| Offline | 0% until bought in the tree (5% → 75%, 1 h → 5 d) | 100% with managers |
| Daily hook | sugar lumps (24 h) | events, ad boosts |
| Side systems | garden, market, pantheon, grimoire, dragon, seasons | Moon, Mars, events, gilding |

---

## 5. Lessons for Wipe Day (transferable mechanics, mapped to the island)

Names below are placeholders in Wipe Day's own voice. None reuse another game's names. Note:
**"blueprint fragments" is an actual Rust item (Rust added basic and advanced blueprint fragments in
2023) [M]**, so D43 argues against that name for the prestige currency.

1. **A real ladder of generators with exponential price and linear output.** Replace "3-5 levels per
   building" for the production core with *countable* rigs (scrap pickers, net lines, rain stills,
   smelters, oil pumps, a reactor shed ...), priced `base × r^owned`. Use ~12× cost per tier and
   about 2× worse base payback per tier. Make r gentler for higher tiers (1.15 → 1.07), so the
   cheap early rig hits a wall and the top rig can be owned in hundreds. Put every curve in
   `packages/content/data` and let the simulator assert time to first automation, first tier and
   first nuke.

2. **Click first, then hire a crew member to automate (the AdCap manager).** Each station starts
   manual: tap the pump, crank the winch, haul the net, one cycle per tap with a visible bar. Assigning a
   survivor (crew already exist in Wipe Day) makes it run forever, offline included. That is
   "click like crazy, then automate", and it reuses the crew system instead of inventing managers. Target:
   the first automation inside 60-120 s and five stations automated in the first 20-30 min.

3. **Ownership milestones with a visible "next" bar.** At 10/25/50/100/200 of a rig: cycle halved
   or output ×2/×3. **Island-wide milestones** ("25 of every rig: all rigs twice as fast") make players
   buy broadly. Show "38/50 → ×2 speed" under each rig. This is the "one more" engine.

4. **Driftcrates, the golden-cookie layer.** A crate washes in from the sea (left of the scene), a flare
   lands or a gull drops something every 5-15 min, and stays ~12 s. Tap it for one of a few effects: output ×7 for
   ~75 s; a lump sum = min(15% of the bank, 15 min of output) (cap by bank so it cannot be farmed);
   tap power ×hundreds for ~13 s; one rig type boosted. Effects stack, which gives the skill ceiling
   for active players. Server-side: a seeded per-player spawn schedule, claimable inside its window
   by an idempotent command. Only while the page is open.

5. **An explicit idle-versus-active switch.** A Golden-switch analogue ("Lockdown": +50% passive, no
   crates) and loadout slots (a Pantheon analogue: "three relics on the shrine", swaps refill in 1 h /
   4 h / 16 h). The three-check-ins friend and the clicker friend both get a strong build.

6. **The logbook as a multiplier (milk and kittens).** Each logbook entry (achievement) adds, say,
   +4% "Grit". "Old hands" upgrades multiply output by `1 + grit × factor`, with several factors stacked.
   This turns cheap content (hundreds of logbook lines, joke ones included) into power and gives
   collectors a goal. Challenge runs (point 12) feed it.

7. **Prestige math: a sublinear root, live preview, the doubling rule.** Points = `k × (lifetime value)^(1/2 or 1/3)`.
   A square root (4× to double) feels generous for a small group; a cube root (8×) is stricter and
   longer-lived. Show the pending gain live on the red button ("Detonate now: +37, you have 40").
   Keep the button visible but disabled with the reason until the first point is worth it (rule 6.3.3).
   Teach the heuristic in one line: "worth it when this doubles what you have."

8. **Split the prestige reward into a kept level and a spent currency (the Cookie Clicker model, not
   AdCap's).** "Fallout" level: never spent, +1% output each. A spendable currency for the tree.
   Avoid AdCap's "spending angels removes their bonus and the upgrades reset", which made players
   do break-even math and feel punished. Optional re-buy ritual: cheap in-run upgrades that unlock
   5/25/50/75/100% of the Fallout bonus give a satisfying first minute after every nuke.

9. **A huge constellation tree with cost bands spanning many orders of magnitude.** About 100-150 nodes
   around a centre gate, prices from 1 to 10^9+ in digit-pattern bands, so every nuke buys
   something. Node types to copy: a gate; flat multipliers; **starter kits** (start with 10 pickers,
   then 5 crew); **heirloom slots** (keep one chosen upgrade through nukes; Wipe Day's persistent
   blueprints fit here); an **offline branch** (bunker generator: offline efficiency and window grow
   from, say, 25%/8 h to 100%/3 days, so lazy settlement stays the norm and the tree decides the
   ratio); an **active branch** (crates more often or longer); **system unlocks** (greenhouse,
   radio, the Den, expeditions); discounts; QoL (buy max, auto-buy, the full welcome-back report) and a few
   joke nodes. Keep 6.3 rule 3: locked nodes visible, with the reason.

10. **A slow real-time currency that survives the nuke (sugar lumps).** Something glowing grows in
    the crater, one every ~22-24 h. Harvest early for a 50% chance, ripe for a sure one. Spend on
    rig *levels* (level N costs N, +1% for that rig) and on opening mini-systems. It is the
    daily-check-in hook that clicking cannot accelerate, and it fits "respect the clock".

11. **Mini-systems unlocked by rig levels, with progress that persists.** A greenhouse with
    cross-breeding mutations (the existing garden plots; discovered seeds survive the nuke). The Den's
    price ticks (already built). A shrine with three slots. A radio with a regenerating meter that can
    "call a crate" so players can set up combos. Each one opens later and gives the run variety.

12. **Challenge nukes (Born Again).** "Hard landing": a run with the tree switched off, for logbook
    entries and titles only. Cheap content that also feeds point 6.

13. **Opt-in risk that pays (wrinklers).** Rats or "mudleeches" in the stores, each eating 5% of
    output, burst for 110% (rarely a glowing one for 330%). The net is a quadratic gain and they are
    tappable, visible and funny. A post-apocalyptic "Rot" phase can bring risk/reward crates
    (big ×, or a short slowdown) behind a reversible pledge.

14. **Events with their own tiny economy instead of forced monthly wipes.** AdCap keeps the main
    game and adds 2-7 day event islands with their own rigs, easier goals for newer players, a friends
    leaderboard and rewards that persist (cosmetics plus a meta currency for **per-rig star ranks**
    like gilding ×7.77 → ×17.77 → ×77.77). For Wipe Day this suggests: **the nuke replaces the
    monthly season wipe as the reset**. "Seasons" can become a monthly themed event island or
    modifier with a friends' board ("most Fallout this month", "fastest nuke"), never a forced reset.

15. **Worlds that feel different after enough nukes.** AdCap's Moon (slow grind) versus Mars
    (explosive ×333 bursts) shows that a new zone with a *different curve* refreshes the game. After N
    nukes, unlock a second island (a fog-bound archipelago, a frozen rig field) with its own
    rig ladder and milestone rhythm, sharing the tree.

### Cautions from the complaints (what to avoid)

- **Multiplier bloat makes the meta pointless** (Cookie Clicker's late game). Keep tree nodes
  meaningful through *unlocks and choices*, not only "+x%". Add new systems as the nuke count rises.
- **Walls where days barely move you** (AdCap). The simulator should assert a minimum "something new
  per check-in" and a maximum time between purchases at each stage.
- **Gold-style shortcuts** are out (no real money), but time warps can be in-game rewards (a radio
  broadcast worth 4 h of output from the logbook or events).
- **Guardrail conflict to flag for the plan:** Wipe Day's current rules (8 check-ins ≤ 1.6× of 3;
  legacy ≤ 25% stronger than a new player; no timer under 10 min) contradict this genre. In these games
  veterans are 10^N times stronger and active play is worth much more than idle. If the redesign goes
  this way, those guardrails need rewriting. For example: compare friends by *per-run* or
  *per-month* metrics and cap the active/idle ratio through crate frequency rather than through
  rates.
- **Click spam on a server-settled game:** batch taps client-side (for example every 1-2 s, with a
  count) and have the server cap taps per elapsed second. Keep crate claims idempotent and windowed.

---

## Sources

- Cookie Clicker Wiki (wiki.gg): Buildings, https://cookieclicker.wiki.gg/wiki/Buildings
- Cookie Clicker Wiki: Ascension (heavenly upgrade costs and effects), https://cookieclicker.wiki.gg/wiki/Ascension
- Cookie Clicker Wiki: Prestige, https://cookieclicker.wiki.gg/wiki/Prestige
- Cookie Clicker Wiki: Golden Cookie, https://cookieclicker.wiki.gg/wiki/Golden_Cookie
- Cookie Clicker Wiki: Milk, https://cookieclicker.wiki.gg/wiki/Milk
- Cookie Clicker Wiki: Achievements, https://cookieclicker.wiki.gg/wiki/Achievements
- Cookie Clicker Wiki: Upgrades, https://cookieclicker.wiki.gg/wiki/Upgrades
- Cookie Clicker Wiki: Sugar Lump, https://cookieclicker.wiki.gg/wiki/Sugar_Lump
- Cookie Clicker Wiki: Minigames / Garden / Pantheon, https://cookieclicker.wiki.gg/wiki/Minigames , https://cookieclicker.wiki.gg/wiki/Garden , https://cookieclicker.wiki.gg/wiki/Pantheon
- Cookie Clicker Wiki: Wrinkler, https://cookieclicker.wiki.gg/wiki/Wrinkler
- Cookie Clicker Wiki: Seasons, https://cookieclicker.wiki.gg/wiki/Seasons
- Cookie Clicker Wiki: Challenge Mode (via search summary), https://cookieclicker.wiki.gg/wiki/Challenge_Mode
- Steam discussions on the late game (via search), https://steamcommunity.com/app/1454400/discussions/0/591765076067746179/
- A. Pecorella, "The Math of Idle Games, Part I" (costs, bulk buy, AdCap lemonade), https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i
- A. Pecorella, "The Math of Idle Games, Part III" (prestige formulas: AdCap sqrt, Cookie Clicker cube root, Realm Grinder, Clicker Heroes, Egg Inc.), https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii
- AdVenture Capitalist Wiki: Businesses (table via search), https://adventure-capitalist.fandom.com/wiki/Businesses
- AdVenture Capitalist Wiki: Unlocks (Earth) (via search), https://adventure-capitalist.fandom.com/wiki/Unlocks_(Earth)
- AdVenture Capitalist Wiki: Angel Upgrades (via search), https://adventure-capitalist.fandom.com/wiki/Angel_Upgrades
- Steam discussions on angels (first angel at $44.444 B, 150 angels first reset), https://steamcommunity.com/app/346900/discussions/0/365172547955569702
- Steam discussions on Moon/Mars design (via search), https://steamcommunity.com/app/346900/discussions/0/2789369987129998965
- gameplay.tips, "AdVenture Capitalist Basic Guide (Angels, Events, Suits, Badges)", https://gameplay.tips/guides/adventure-capitalist-basic-guide-angels-events-suits-badges.html
- AdVenture Capitalist Help Center: Gilding and Mega Ticket update, https://screenzilla.helpshift.com/hc/en/5-adventure-capitalist/faq/548-gilding-mega-ticket-update/
- Wikipedia: AdVenture Capitalist, https://en.wikipedia.org/wiki/AdVenture_Capitalist
- Touch Tap Play guide (ad boost ×2 for 4 h), https://www.touchtapplay.com/adventure-capitalist-cheats-tips-strategy-guide-to-make-a-ton-of-money/
- Wipe Day: CLAUDE.md and docs/game-design.md (current design, guardrails), read only.

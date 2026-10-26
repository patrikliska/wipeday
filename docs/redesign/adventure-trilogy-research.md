# Hyper Hippo AdVenture Trilogy: Mechanics, Retention & Monetization Reference

Reference research on AdVenture Capitalist (AdCap), AdVenture Communist (AdComm) and AdVenture Ages, plus selected mechanics from other idle/incremental games. This document describes how these games work. It contains **no recommendations for any specific project**.

**Confidence labels used throughout:**
- **[High]**: matches multiple sources and/or official material, or is mathematically verified.
- **[Med]**: single community source (fandom wiki, guide), plausible but not independently verified.
- **[Low]**: player speculation, conflicting sources, or a time-sensitive snapshot (prices, ratings, max ranks) that may be outdated.

Most numeric data comes from community wikis, not official documentation. See section 9 for known issues and corrections.

---

## 1. Summary

- **AdCap** is the "pure math" idle game. Generator costs grow exponentially (`cost = base × r^owned`, r = 1.07–1.15) while production grows linearly. Milestone multipliers (×2 speed at 25/50/100/200/300/400 owned) create constantly visible short-term goals. Prestige (Angel Investors) uses a square-root formula on lifetime earnings, with each angel giving +2% profit. [High]
- **AdComm** subordinated that math to a **mission → rank** structure. Rank-up requires completing N of N+3 missions and acts as the prestige reset. Persistent power comes from **gacha cards (Researchers)** obtained from capsules. It added weekly events with leaderboards and a monthly pass. [High]
- **AdVenture Ages** is mechanically a re-skin of AdComm (Heroes instead of Researchers, historical theme). Hyper Hippo stated this openly. [High]
- The trend across the trilogy goes from a sandbox with math toward a **guided campaign with gacha and live-ops**. This improved controllable retention but increased perceived pay-to-win and event fatigue in player reviews. [Med]

---

## 2. AdVenture Capitalist (2014 web / 2015 mobile)

### 2.1 Core loop and cost formula [High]

Buy a business → it produces per cycle → reinvest. Anthony Pecorella (Kongregate, "The Math of Idle Games") formalizes it:

```
cost_next        = cost_base × rate_growth^owned
production_total = production_base × owned × multipliers
```

Cost grows exponentially, production linearly, so every business eventually becomes "too expensive" and the player shifts to another one.

**Growth coefficients (Earth):**

| Business | Growth rate r |
|---|---|
| Lemonade Stand | 1.07 |
| Newspaper | 1.15 |
| Car Wash | 1.14 |
| Pizza | 1.13 |
| Donut Shop | 1.12 |
| Shrimp Boat | 1.11 |
| Hockey Team | 1.10 |
| Movie Studio | 1.09 |
| Bank | 1.08 |
| Oil Company | 1.07 |

Pattern: cheap early businesses (except Lemonade) have higher coefficients and hit a ceiling quickly. Late businesses have low coefficients and scale for a long time.

**Reference values** (per Kongregate's model table) [High]:
- Lemonade Stand: base cost 3.738, cycle 0.6 s, revenue 1 per cycle.
- Oil Company: base cost 25,798,901,760, cycle 36,864 s (10:14:24).
- The 200th Lemonade Stand costs ~2.6M (verified: 3.738 × 1.07^199 ≈ 2.63M).

**Bulk purchase cost** (geometric series) [High]:

```
cost(owned=k, buy m) = base × r^k × (r^m − 1) / (r − 1)
```

Sanity check at r = 1.07, starting from 0 owned:
- The 11th unit costs 1.967× the first; buying the first 10 costs 13.8× the first unit's price.
- The 101st unit costs 867.7× the first; buying the first 100 costs ~12,382× the first unit's price.

(Some wiki sources state "10 units = ×1.97" and "100 units = ×868". Those numbers are the price of the *next single unit*, not the total cost of the batch.)

### 2.2 Milestone unlocks [Med]

- For most businesses the cycle time halves at 25, 50, 100, 200, 300 and 400 owned.
- The same thresholds repeat as global "Everything" unlocks once *all* businesses reach that count.
- Maximum is 12 halvings (cycle down to 1/4096 of the original). From the 7th unlock onward, unlocks multiply profit instead (×2…×30; Lemonade up to ×15 at 7,000 owned).
- Newspaper is an exception: unlocks every 25 owned, and from the 4th unlock it boosts *other* businesses.

Design effect: there is always a visible next target ("7 more until ×2"), and the player rotates between businesses.

### 2.3 Managers (automation) [Med]

- The first manager (Lemonade) costs 1,000. From then on the business runs without clicks, including offline.
- Later "accountant" managers give −10% cost (paid in angels). "Discount" managers divide costs by 100,000.

### 2.4 Prestige: Angel Investors [High for formula, Low for threshold]

```
total_angels = 150 × sqrt(lifetime_earnings / 10^15)    (includes spent angels)
angel_gain   = total_angels − angels_already_earned
bonus        = +2% profit per held angel (additive; 1000 angels = ×21)
```

- By this formula the first angel appears at ~44.4 billion lifetime earnings (1e15 / 150² = 4.44e10), and 150 angels at 1 quadrillion. The official help-center FAQ instead says "after 100 trillion". **The sources conflict.**
- Angels can be **spent on upgrades, which removes their +2% bonus**. This creates a real trade-off instead of a single reset button.
- Because the formula uses *lifetime* earnings, resetting at the same point as last run still yields something, just less.
- Square-root scaling means doubling total angels requires 4× lifetime earnings (Pecorella describes it as roughly 3–4× in practice, since bonuses compound across runs).

### 2.5 Additional layers [Med/Low]

- Moon (unlocked with money, reportedly 100 trillion), Mars (unlocked with Mega Bucks).
- Mega Bucks: first one at 1 decillion on Earth, each subsequent one much more expensive (wiki states ×999). Pecorella cites Mega Bucks as a system for taming runaway numbers.
- Platinum boosts: 17.77× → 77.77× → 777.77× → 7,777.77×.

### 2.6 Events [Med]

- Separate economy with its own businesses. Rewards include gold, Mega Bucks, and **badges with permanent bonuses that carry into the main game**.
- ProfitCaster-type items: e.g. ×12 for 10 s once every 4 h (micro return trigger).
- Leaderboards are split into groups. Group size is **not confirmed**; a Steam player estimates ~100 players grouped by event join time. [Low]
- Recurring Steam complaints about suspected bots and pay-to-win ("As a f2p it's impossible to win any event"). [Low: player perception]

### 2.7 Monetization [Med, prices Low]

- Gold packs (US, time-sensitive): $4.99 = 55, $9.99 = 115, $19.99 = 240, $49.99 = 625, $94.99 = 1,300.
- Time Warps: 1 day = 10 gold, 7 days = 25, 14 days = 40.
- First Time Buyer bundles ($3.99 / $7.99), Gold Subscription ($9.99).
- Gold is also earnable: from events, some Everything unlocks, and a one-time 200 gold for the first hard reset of a planet.
- Rewarded ad: ×2 profit for 4 h, max 5 views per day per planet.

---

## 3. AdVenture Communist (2016/2017)

### 3.1 Different economy [Med]

- Generators **do not increase in cost with count owned**. Each tier produces the previous tier (derivative/chain growth, described in Pecorella's Part II), and costs resources + "comrades".
- Example: Farmer costs 10 potatoes + 1 comrade and produces 3 potatoes per 2 s. Plantation costs 100 Farmers + 10B potatoes + 1 comrade and produces 6 Farmers per 16 s.
- The progression wall is created **not by cost scaling but by mission requirements**, which grow exponentially with rank.

### 3.2 Ranks and missions (the key structural innovation) [Med]

| Rank | Missions required | Missions available |
|---|---|---|
| 7–19 | 10 | 13 |
| 20–39 | 12 | 15 |
| 40–59 | 14 | 17 |
| 60–79 | 16 | 19 |
| 80–99 | 18 | 21 |
| 100–180 | 20 | 23 |
| 181+ | 23 | 26 |

- Max rank reported as 187 (wiki, July 2026). [Low: changes with updates]
- The player always has **3 more missions than required**, so they can skip missions that feel too hard and never get stuck on a single one.
- Each mission rewards a Wood/Stone capsule; rank-up gives a Silver capsule.
- **Rank-up is the prestige reset**: resources, generators and comrades reset. Rank-up itself does **not** increase production. Power comes only from Researchers, so the reset feels painless and the player wants it.

### 3.3 Researchers (gacha cards) [High for max levels, Med for the rest]

- Max levels (official FAQ): Common 13, Rare 11, Epic 8, Event 6, Supreme 6.
- Level-up costs card copies + science.
- Shop price per card: Common 10 science / 0.5 gold, Rare 100 / 5, Epic 1,000 / 50, Supreme 40,000 / 1,500.
- Duplicate copies beyond max level convert to science at 50% value, so duplicates are never fully dead.
- Ad-slot capsule odds in shop: 60% Common / 30% Rare / 9.99% Epic / 0.01% Supreme.

### 3.4 Special Operations and daily gifts [Med]

- Daily gifts in 5-day cycles (capsules, science, gold, cards).
- Operations like "open 10 capsules" award points toward a tier track.

### 3.5 Events [Med]

- Twice weekly: a 100 h weekend event + a 32 h mini event. Every few months an 11-day "Supreme" event.
- Events have their own rank ladder (e.g. 30 ranks with rewards) and leaderboards, from Champion (1,000 gold, 50,000 science) down to Top 100% (50 science).
- The wiki notes that players who spent over $100 and start early are placed into the hardest leaderboards. This is an attempt at fairness, but it also confirms that spending affects outcomes.

### 3.6 Monetization [Med, prices Low]

- Gold packs (US App Store): Bit $1.99, Lot $4.99, Tonne $9.99, Bucket $19.99.
- Event Starter Pack $6.99. "Rank N Event Bundle" $3.99–$9.99: offers tied to progress inside an event.
- **Supreme Pass: $9.99 / 30 days** (AU $14.99). Includes a 25-tier premium track, ×2 ad boost without ads, 3rd Special Ops slot, 8 h refresh instead of 12 h, and a stack of 4 event capsules instead of 2.
- App Store listing is labeled "Contains Loot Boxes".

### 3.7 Reception [Med]

- Wikipedia summarizes reviews as positive but criticized as too similar to its predecessor and for excessive microtransactions.
- Player complaints: "ironically more pay to win than adcap"; after maxing rank, players just wait for events, which are "repetitive at best"; players watch more ads than they actually play.

---

## 4. AdVenture Ages (February 2021)

- Hyper Hippo replied on Google Play that some players disliked the Communist theme, so they offered the same game with a new theme. [High]
- Mechanically AdComm: 5 Ages (Bronze, Medieval, Renaissance, Industrial, Atomic), missions, ranks (max 140 as of January 2022 [Low: outdated], always +3 spare missions). Rank-up locks all Ages except Bronze and wipes resources and population. Hero levels, cards, XP and gems persist.
- **Heroes** replace Researchers: 99 heroes across 9 bonus types (Speed, Chance, Production, Cost, Upgrade…). Max levels (official FAQ): Common 13, Rare 11, Legendary 8, Epic 6, Historic 5. Historic levels 2/3/4/5 cost 5k/20k/50k/100k XP and 2/5/10/20 cards. A typical Rare hero gives ×2, ×4, ×8… to one Age's production.
- Innovation: **historical identity on cards** (Joan of Arc, Lincoln), adding collection motivation beyond raw numbers.
- Events are compressed: 5–6 tasks per rank instead of 10, 21 heroes instead of 95.
- Update v1.25.0 (May 2024) added "Time Pods Prime" (paid ad-skipping) and new Time Warps. The game has a seasonal pass.
- Ratings (snapshot) [Low]: 3.9★ Google Play (37.8K reviews), 4.6★ App Store (7.7K).
- Reviews: "just a worse version of something they already had"; events constantly pull players away from the main game; chest-opening competitions favor payers; an event mission would take a week.

---

## 5. Evolution across the trilogy

| | AdCap (2014/15) | AdComm (2016/17) | Ages (2021) |
|---|---|---|---|
| Generator cost | exponential, r 1.07–1.15 | fixed, tier produces tier | same as AdComm |
| Primary driver | ×2 milestones + angels | missions → rank | missions → rank |
| Prestige | voluntary, √ lifetime | rank-up (gated by missions) | rank-up |
| Meta progression | angels, gold upgrades, Mega Bucks | Researcher cards | Hero cards |
| Gacha | minimal | capsules (loot boxes) | capsules |
| Events | separate planets, badges | 2×/week, leaderboards | compressed, leaderboards |
| Pass/subscription | Gold Subscription $9.99 | Supreme Pass $9.99 | seasonal pass |

---

## 6. Why these mechanics retain players

1. **Visible near-term goals.** "7 more until ×2" in AdCap, mission progress bars in AdComm. The player has a goal at the 30-second, 10-minute and 1-day scale simultaneously.
2. **Step rewards instead of linear ones.** A ×2 speed jump is immediately visible in the cycle animation. Pecorella's models show "bumps" of rapid purchases around milestones; a player who just hit a big multiplier keeps playing.
3. **Prestige as a "relaunch".** Pecorella: a reset with a big boost creates a "ladder climbing" feeling of power. A good reset must (a) be quick to replay and (b) have a noticeably faster start.
4. **Offline progress + short return sessions.** Pecorella's Kongregate data shows idle game retention as unusually high; a Game Developer write-up of his GDC 2015 talk cites ~10% two-year retention. His later presentation describes the profile as low ARPDAU, high DAU, great retention, with ads providing light daily monetization.
5. **Timed return triggers with stack caps.** 4 h ad boost, ProfitCaster every 4 h, 12 h Special Ops refresh, free capsules that stack only to 2 (4 with pass). **The stack cap is the key**: it pushes players to return before rewards are "wasted".
6. **Variable rewards.** Capsules with rarity tiers are a classic variable-ratio schedule. Converting duplicates into currency reduces frustration.
7. **Social comparison.** Small leaderboard groups make "1st place" feel reachable, but they are also the largest source of toxicity (bot and pay-to-win suspicion).

Academic counterpoint: Mullally, "Wasting Time: Human Idleness and Durational Mechanics in Idle Games" (Game Studies, vol. 26, issue 1, 2026) describes AdCap as a cynical deployment of idle mechanics toward extraction and accumulation.

---

## 7. Monetization: business data and ethics

**Scale** (Rimmy Spanjer, Director of Games, Hyper Hippo, Pocket Gamer interview, Aug 2021) [Med]:
- AdCap on Kongregate gained almost 25,000 new users per day; mobile launch drove 3M downloads immediately; 50M+ downloads by Aug 2021.
- All three games combined: 80M+ installs.
- Revenue figures are **not public**.

**Fair vs. predatory spectrum** (analyst opinion, not sourced fact):
- *Generally seen as fair:* optional rewarded ads with a daily cap; Time Warps as "bought time" in single-player contexts; passes with a free track where premium only accelerates; cosmetics; one-time starter packs with clear value; duplicates converting to currency.
- *Grey zone:* event bundles tied to event rank, because they target the moment of frustration.
- *Widely seen as predatory:* paid capsules with very low top-tier odds (0.01% Supreme) in **competitive** events; leaderboards decided by spending; monthly "premium" priced like a full game; loot boxes without published odds.

---

## 8. Reference mechanics from other games

### 8.1 Expeditions / dispatch

**Egg, Inc. – Spaceships** [Med]
- First ship: missions of 20 min (2M fuel, 4 artifacts), 1 h (3M, 5), 2 h (10M, 6). Higher-tier ships go for days and return 56–91 rewards.
- Fuel is paid with the main produced resource, so **expeditions act as a sink for the main economy**.
- Events can give 2–3× capacity or cut durations to 25%.

**Clicker Heroes – Mercenaries** [Med]
- Unlock around Zone 139, max 5 mercenaries, quest durations from 5 min to 2 days, choice of 4 random quests.
- Mercenaries gain levels over time spent questing; rewards scale with level; each has a hidden lifespan, so **high-level mercenaries can die**. This risk is what makes choices meaningful.

### 8.2 Async PvP / raiding without frustration

**Clash of Clans** [Med/Low: wiki text and table conflict]
- Only a percentage of storage can be stolen (~20% at low Town Hall levels, ~14% from TH9, with caps). Clan treasury: only 3%.
- Shields of 12/14/16 h depending on destruction, revenge from defense log, Village Guard 30 min–4 h.
- Third-party wiki reports (Oct 2025) a "Loot Cart" returning 10% of stolen loot to the defender and an 8 h shield after being raided. [Low]

**Coin Master** [Med]
- Max 3 shields; extras convert back to spins. Attacking a shielded player steals nothing.
- Raids take only part of the coins, split across 4 holes (one empty).
- Deconstructor of Fun analysis: the defender cannot defend, therefore loot is limited and fragmented.

### 8.3 Multi-layer prestige

**Antimatter Dimensions** [High]
- Infinity at 1.79e308 antimatter → Eternity at 1.79e308 Infinity Points → Reality at 1e4000 Eternity Points.
- EP formula: `EP = 5^(log10(IP)/308 − 0.7)`, equivalent to `≈ 0.324 × IP^(1/440.65)` (verified). Each layer has its own currency and an extremely compressed gain formula.

**Realm Grinder** [Low: not verified]
- Abdication (gems, percentage bonus per gem, anytime) → Reincarnation (reported first at 1e27 gems, each subsequent 1000× more expensive) → Ascension (after R39, R99…).

**Egg, Inc. prestige** [Med]
- Formula as reported in Pecorella's Part III: `Δp = (c_R / 10^6)^0.14`. Doubling gain requires 2^(1/0.14) ≈ **141×** more (often stated as "128×", which corresponds to exponent 1/7).
- Offline earnings are limited by **Silos** (each silo holds a set amount of away time; more silos and research extend it). It is not a flat universal cap.

### 8.4 Rust's Bandit Camp wheel (theme reference)

[Med]
- 25 segments: 12 × "1", 6 × "3", 4 × "5", 2 × "10", 1 × "20" (48 / 24 / 16 / 8 / 4%).
- Payout: stake returned + stake × number. Expected value per bet type (computed):

| Bet | Chance | Return multiple | EV |
|---|---|---|---|
| 1 | 12/25 | 2× | 0.96 |
| 3 | 6/25 | 4× | 0.96 |
| 5 | 4/25 | 6× | 0.96 |
| 10 | 2/25 | 11× | 0.88 |
| 20 | 1/25 | 21× (or 25× per one guide) | 0.84 (or 1.00) |

- Sources disagree on the 20 payout. Spin interval and the slot machine buy-in are not verified.

---

## 9. Data quality and known issues

**Reliable [High]:** AdCap growth coefficients, Lemonade/Oil base values, the angel formula and +2% bonus, AdComm/Ages card max levels (official FAQ), Supreme Pass price (App Store), Antimatter Dimensions thresholds and EP formula, Hyper Hippo's own statement about Ages being a re-theme.

**Plausible but single-source [Med]:** milestone thresholds, manager details, AdComm rank/mission table, card shop prices, capsule odds, event structure, Egg Inc. ship numbers, Clicker Heroes mercenary details, Coin Master raid rules.

**Weak or time-sensitive [Low]:** all IAP prices (vary by region and over time), max ranks, store ratings, leaderboard group sizes (player estimates), bot accusations, Clash of Clans loot percentages, Realm Grinder thresholds, the first-angel threshold (formula vs. official FAQ conflict).

**Corrections made vs. the original Czech report:**
1. Bulk cost: "10 units = ×1.97" and "100 units = ×868" are the prices of the next single unit, not the total for the batch (correct totals: 13.8× and ~12,382×).
2. Rust wheel EV: the "10" bet has EV 0.88, not 0.96.
3. Egg Inc. prestige doubling: ≈141×, not 128×.
4. Egg Inc. offline: silo-based, not a flat 2 h cap.
5. Angel doubling: pure √ math requires 4×; "3–4×" refers to practice with compounding bonuses.

**Not researched / missing:** official Hyper Hippo revenue, retention or ARPU data; GDC talks by Hyper Hippo staff themselves (most design theory here comes from Kongregate's Pecorella, not Hyper Hippo); current 2026 state of events in all three games.

---

## 10. Key sources

- Kongregate, "The Math of Idle Games" Parts I–III (Anthony Pecorella): https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i · https://www.kongregate.com/en/pages/the-math-of-idle-games-part-iii
- AdVenture Capitalist wiki (Businesses, Earth, Unlocks, Angel Investors, Mega Bucks, Gold, Time Warps, Opt-In Boosts): https://adventure-capitalist.fandom.com/wiki/Businesses · https://adventure-capitalist.fandom.com/wiki/Angel_Investors · https://adventure-capitalist.fandom.com/wiki/Opt-In_Boosts
- AdCap Help Center (angels): https://screenzilla.helpshift.com/hc/en/5-adventure-capitalist/faq/3-how-do-i-get-angels/?hpn=1&p=web&han=1&l=en
- Steam guide, Angel Investors Explained: https://steamcommunity.com/sharedfiles/filedetails/?id=420273770
- Medium, "Idle capitalism. A look at AdVenture Capitalist": https://medium.com/gametalk/idle-capitalism-eac089cd670
- AdVenture Communist wiki (Rank, Mission, Researcher, Shop, Guides/Events, Supreme Pass): https://adventurecommunist.fandom.com/wiki/Rank · https://adventurecommunist.fandom.com/wiki/Researcher · https://adventurecommunist.fandom.com/wiki/Supreme_Pass
- AdComm Help Center (max Researcher levels, Supreme Pass): https://screenzilla.helpshift.com/hc/en/6-adventure-communist/faq/350-what-are-max-researcher-levels/?p=all
- AdComm App Store: https://apps.apple.com/us/app/adventure-communist/id1225683141
- AdVenture Ages wiki (Rank, Hero, Historic Hero): https://adventure-ages.fandom.com/wiki/Hero
- AdVenture Ages Help Center (max Hero levels): https://screenzilla.helpshift.com/hc/en/9-adventure-ages/faq/285-what-are-max-hero-levels/?p=ios
- AdVenture Ages Google Play: https://play.google.com/store/apps/details?id=ca.hyperhippo.adventureages
- Pocket Gamer, Company Spotlight: Hyper Hippo: https://www.pocketgamer.biz/company-spotlight-hyper-hippo-entertainment/
- Wikipedia, AdVenture Capitalist: https://en.wikipedia.org/wiki/AdVenture_Capitalist
- Egg, Inc. wiki (Spaceships, Special Event): https://egg-inc.fandom.com/wiki/Spaceships
- Clicker Heroes mercenaries: https://blog.clickerheroes.com/best-mercenary-missions-in-clicker-heroes-for-long-rewards/
- Clash of Clans wiki, Multiplayer Battles: https://clashofclans.fandom.com/wiki/Multiplayer_Battles · Shields: https://www.clash.ninja/guides/what-are-shields-and-guard
- Coin Master support (attacks): https://support.coinmastergame.com/hc/en-us/articles/360001264874-What-are-Attacks
- Deconstructor of Fun, Coin Master analysis: https://www.deconstructoroffun.com/blog/2019/3/4/is-coin-master-the-new-face-of-social-casino
- Antimatter Dimensions wiki (Eternity, Reality): https://antimatter-dimensions.fandom.com/wiki/Eternity
- Realm Grinder wiki (Reincarnation): https://realm-grinder.fandom.com/wiki/Reincarnation
- Rust Bandit Camp: https://eip.gg/rust/guides/bandit-camp-monument/ · https://rust.facepunch.com/news/bandit-town-update

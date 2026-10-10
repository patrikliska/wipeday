# 06. Friends: the social layer and the Discord companion v2

Status: proposal, 2026-10-07, awaiting the owner's approval (A3). It expands canon sections 8,
12.6, 12.7 and the Discord rows of section 11, with resolutions 1.6, 1.8, 3.1 and 3.23 applied.
Phases: nuke news, bot card v2, the bot's command allowlist, the new notification kinds and quiet
hours in R2; first finds in R4; the Magnet's notification in R5; Blowback, the Island Count, the
Freighter, Late Tide, boards, Visit and Discord postcards in R6 (11-roadmap.md). Names marked
(proposal) need the owner's pass.

---

## 1. The rules

Friends are 2 to 10 people at very different points. Ten Wipe Days apart, one economy can be 1e10
times the other, so anything that adds, trades or compares supplies or glass across players breaks
on day 2. Seven rules (one R0 decision, "the social rules"):

| # | Rule | In practice |
| --- | --- | --- |
| 1 | **Counts, times, ratios, own scale** | Every social number is a count (Wipe Days, crates, loads), a time, a ratio, or an amount in the *viewer's own* numbers ("10 min of your output"). |
| 2 | **Never amounts across players** | No board, goal, sum or comparison uses supplies or glass. A sentence about one player's own event may state that player's own number ("+12 crater glass"); nothing sets it against anyone else's. Late Tide (section 6) is the one rule that reads others' glass: one median, shown only to the player it helps. |
| 3 | **No trading, no gifting of stock** | Nothing moves between bases. Blowback is derived, not sent. |
| 4 | **No PvP** | Nobody can take from, slow, block or target another island. |
| 5 | **No tap goals** | Nothing social counts taps (autoclickers, RSI, phone heat). |
| 6 | **No permanent power from co-op** | Co-op pays only scrap, at most 3 a week (the Magnet's currency, also earned solo), and cosmetics. No multiplier exists that only a group can earn. |
| 7 | **Never write another base** | A friend's effect on you is derived lazily from `event_log` on your own settle (a `World` input, canon 13.6). |

### 1.1 Why the old social layer failed them

| Old system (decisions) | What broke | Rule |
| --- | --- | --- |
| Player market (D99) | Moved stock between bases; its floor came from one absolute table (`den.json5` `market.refPer100`), so a veteran could hand a newcomer a fortune; mostly empty with two players (D100) | 2, 3 |
| Den counter, contracts (D100) | Fixed scrap prices and per-tier amounts from the same table | 2 |
| Casino (D101, D102) | Wagered scrap, now the rare currency; one absolute jackpot pool | guardrail 8 |
| Leaderboards (D103) | Wealth at reference prices, Builder by tier; Trader, Lucky, Guard tied to removed systems | 2 |
| NPC raids, PvP (D106-D111) | Took a share of stock across scales; losses punished absence; a tier fence means nothing when tiers re-climb | 3, 4 |
| The Signal (D119) | Absolute shared stages: a late-run player fills them in a click, an early one adds nothing visible | 2 |
| Legacy points (D116, D117) | Points from relative rank: your permanent power depended on friends; degenerate with two players | 6 |

The feed and Web Push (D96) and the Discord architecture (D121-D126) survive with new content.

### 1.2 Two terms used everywhere

- **Active since `t`:** opened the game on the web since `t`, i.e. `players.last_seen_at >= t`. The
  column exists; bot calls never move it (D121). Late Tide looks back 14 days; the Freighter looks
  at the current week.
- **Wipe Day and small blast** (resolutions 3.1): a nuke that adds at least 10% to glass ever
  (`countShare` in `prestige.json5`, 03-the-big-red.md 1.5) is a **Wipe Day**: it raises Wipe Day
  #N and is the only nuke the social layer sees (news, Blowback, the Island Count, boards). A
  smaller one is a **small blast**: it resets the island and pays its glass quietly, with the
  Fizzle flight. The first nuke is always a Wipe Day. In this file "nuke" means either.

---

## 2. Nuke news

### 2.1 Feed kinds

No new event types: each kind is an event canon lists (13.7) carrying a flag the server sets from
`World` in the event's own transaction, so the web feed, the bot and welcome back read one row
(D124). `FEED_TYPES` (`packages/domain/src/feed.ts`) becomes `nuked`, `era_reached`,
`logbook_entry`, `freighter_loaded`; `isFeedWorthy` checks the flags.

| Kind | Rides on | News when | Phase |
| --- | --- | --- | --- |
| Nuke | `nuked`, `news: true` | a Wipe Day that passes the throttle (2.2) | R2 |
| First Armored | `era_reached`, `first: true` | the player's first Armored era ever | R2 |
| Shared first find | `logbook_entry`, `firstFind: true` | nobody has logged that secret before (section 9) | R4 |
| Freighter tier | `freighter_loaded`, `tier` | the load crossed tier I, II or III (5.2) | R6 |
| Record | `nuked`, `record` | a new island all-time best on Best blast or Fastest comeback, once that board holds 10 values | R6 |
| Island Count tier | `nuked`, `islandCount` | the count reached a tier (section 4) | R6 |

Never in the feed: small blasts, Late Tide, who has not loaded, inactivity or last-seen times,
failed Dares, any sentence comparing two players.

### 2.2 The throttle

Early runs can be short (canon 5.7: 15-60 minutes for an active player), so an eager player can
make several Wipe Days an hour. One is news when the player's last news nuke was at least **30
minutes** ago, or it is a milestone (#1, #10, #25, #50, then every 50), sets a record, or reaches
an Island Count tier. A held-back Wipe Day folds into the next news nuke ("3 times since 14:05 ...
in all"); `nuke()` keeps `meta.news = {at, folded, glass}`, so the fold is pure. Held-back Wipe
Days still wash Blowback and count everywhere else.

### 2.3 Example sentences

Keys in `packages/content/locale/en.json`; numbers through the shared formatter; Discord times as
`<t:…:t>` so each reader sees their own clock. Gains follow the P1 model (10-balance.md 4.5).

| # | Key | Example |
| --- | --- | --- |
| 1 | `feed.nuked` | Patrik pressed the Big Red. Wipe Day #4 on Saltmarsh: +144 crater glass. |
| 2 | `feed.nuked_first` | Mira pressed the Big Red for the first time. Wipe Day #1: +10 crater glass and a fresh crater. |
| 3 | `feed.nuked_folded` | Ivo pressed the Big Red 3 times since 14:05. Wipe Day #5: +286 crater glass in all. |
| 4 | `feed.nuked` + `feed.flight.loop` | Patrik pressed the Big Red. Wipe Day #9 on Saltmarsh: +629 crater glass. The Kettle did a loop-the-loop first. |
| 5 | `feed.nuked_milestone` | Mira reached Wipe Day #50: +61k crater glass. The crater sign needed a bigger post. |
| 6 | `feed.nuked_dead_hand` (R5) | Patrik's Dead Hand pressed the Big Red. Wipe Day #31: +24k crater glass. |
| 7 | `feed.first_armored` | Ivo reached the Armored era for the first time. There is a wreck to crack open on the rise. |
| 8 | `feed.first_find` | Mira found a Logbook secret first. Its hint is open to everyone now: "The gulls are keeping score." |
| 9 | `feed.first_find` | Patrik found a Logbook secret first. Its hint is open to everyone now: "Most people launch in fair weather." |
| 10 | `feed.freighter_tier` | Ivo's crate got the Freighter to tier I. 1 scrap for everyone who loaded. |
| 11 | `feed.freighter_full` | Mira's crate filled the Freighter: tier III. 1 more scrap for everyone who loaded, and the pennant goes up. |
| 12 | `feed.record_best_blast` | Tess set an island record: best blast, +340% glass in one Wipe Day. |
| 13 | `feed.record_comeback` | Patrik set an island record: fastest comeback, past the last run's glass in 21% of its time. |
| 14 | `feed.island_count` | Saltmarsh has been nuked 10 times. Every lean-to now flies a scorched flag. |
| 15 | `feed.island_count` | Saltmarsh has been nuked 25 times. A glass gull now perches on every Kettle. |
| 16 | `discord.news.month` | October on Saltmarsh: 87 Wipe Days, 1,204 flotsam caught, 3 secrets found first, and the Freighter filled twice. |

A first find never names the secret, only its hint: names give answers away (05-meta-layers.md
1.7). Two personal lines are not feed: the nuker's postcard ("Your blast washed 9 crates onto 3
islands.") and a receiver's toast ("Mira's blast washed 3 crates onto your shore.").

### 2.4 Where news appears

- **Web, Friends → Feed** (fifth nav item, canon 12.1): newest first, a dot on the nav item when
  unread. A nuke row has a postcard thumbnail that opens the friend's postcard read-only, with
  "Visit {name}'s island" as a secondary button (R6).
- **Live:** an open tab shows a toast for a friend's news nuke, then asks for a fresh `look()` after
  a random 0-3 s delay, so the crates wash in while you watch.
- **Welcome back** (canon 12.6): counts only, "3 friends nuked their islands: 9 crates are waiting
  on your shore."
- **Discord `#wipe-day-idle`:** the same sentence from the same row (D124); text in R2, with the
  postcard PNG from R6 (10.5). The postcard holds only the nuker's own numbers (rule 2).
- **DMs:** only with "friend nuked" switched on (section 11).

---

## 3. Blowback (R6)

### 3.1 The math

- Each Wipe Day by a friend washes **3 crates** onto every other player's shore. Small blasts wash
  none.
- At most **9** wait. A full shore stops arrivals, like a full Night Shift: nothing waiting is lost;
  later crates simply do not land.
- **No expiry.** Crates live in `meta`, so they survive your own nuke too.
- One tap opens one crate, paying at that moment the Drift Crate's lump (resolutions 1.6):
  `max(1 min of output, min(15% of held supplies, 10 min of output))`, output being the idle rate
  (manned lines with every run-long multiplier; no taps, Hustle, Rally, Afterglow or Drone).
- Crates opened in a row compound until the 10-minute cap binds, so **a full shore is worth at most
  1 h 30 min of the receiver's own output**, and the floor makes it **at least 9 minutes**, even
  with nothing held.
- **Arrival pace:** in month 1 each friend makes about one Wipe Day a day (10-balance.md 4.7), so
  three friends fill the shore daily and one friend (season 1's two players) brings 3 crates a day.
  From month 2, when runs last 4-5 days, a friend brings about 0.5-0.8 crates a day.

Example: 40B held, idle rate 20M/s (10 min = 12B, 1 min = 1.2B).

| Crate | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pays | 6.0B | 6.9B | 7.9B | 9.1B | 10.5B | 12.0B (cap) | 12.0B | 12.0B | 12.0B | 88.5B, 1 h 14 min of output |

With nothing held, each crate pays the 1.2B floor until 15% of held passes it: 11.1B in all, 9 min.

### 3.2 The lazy cursor

State: `meta.blowback = {cursor, crates: [{from, at}]}`, `from` being the sender's player id (the
paper tag and "from Mira" need it).

1. On every server settle, `World` supplies friends' Wipe Days (`nuked` rows flagged `counted`)
   with `id > cursor` and `player_id != self`, oldest first, **at most 3** (three fill an empty
   shore), plus the newest `nuked` id. Both use the `event_log_type_at` index.
2. A pure function `arrive(meta, nukes, newest)` adds `min(3, 9 − waiting)` crates per Wipe Day,
   tagged with the sender, then sets `cursor = newest`. The client predicts with its last `meta`.
3. A new base's first server settle sets `cursor` to the newest `nuked` id without crates: no
   backlog.
4. **The nuker's line:** in the nuke's transaction the server runs the same `arrive` on the stored
   `meta` (read only) of each friend active in the last 14 days and counts what lands: "Your blast
   washed 7 crates onto 3 islands." Quiet islands still get crates but are not counted. If every
   shore is full: "Every friend's shore is already full of crates."

`claim_blowback` opens the oldest crate, idempotent by key; an empty shore refuses
`nothing_waiting`, which only re-renders a stale view.

### 3.3 Edge cases

| Case | What happens |
| --- | --- |
| Your own nuke | Never lands on your shore; the cursor skips your events. Waiting crates stay. |
| A friend's small blast | Lands nothing and is not counted anywhere (1.2). |
| A friend makes 10 Wipe Days in an hour | The first three fill an empty shore; the other seven land nothing for you, and their postcard counts only what landed. |
| Away for weeks | On return, 9 crates (given 3 friend Wipe Days) and the cursor jumps to the newest; welcome back says so. |
| Crates waiting when you nuke | They stay, but pay what the new run can (at least 1 min of its output), so the hint and the cover card's Kept list nudge you to open them first. |
| Same crate tapped in two tabs | The second claim refuses or opens the next crate; each crate pays once. |
| Demo mode | The LocalBackend's fake friend Hollis nukes on a schedule (09-architecture.md 10.7); the demo drawer also gets "Wash up 3 crates". |

### 3.4 On screen

- **Scene:** crates beach on the sand right of the tideline, three to a row, at most three rows, in
  the Drift Crate art (`crate`) with a paper tag carrying the sender's initial. Each tap target is
  at least 44 CSS px on screen (D48); a full cluster reads "Shore full: 9 crates".
- **Tap:** the crate pops; a floater ("+6B", supplies icon) flies to the counter with "from Mira"
  under it.
- **Advisor:** waiting crates take the crown in canon 12.5's order (after the best-payback buy).
  While they hold it, the collapsed drawer shows no orange row (one crown per view, resolutions
  3.25).
- **First-time hint** (retires after two uses): "Friends' Wipe Days wash crates ashore. Each pays
  15% of what you hold: at least 1 min of output, at most 10."

---

## 4. The Island Count (R6)

"Saltmarsh has been nuked 214 times": every Wipe Day by anyone since the cut-over (small blasts
excluded), the `World` input `World.islandCount`, which counts Wipe Days only (errata E18). Each
tier unlocks a cosmetic for **everyone**, later joiners included.
No stat, glass or scrap. The unlocked set is derived from the count, so nothing is stored per
player.

Tiers per errata E17 (re-checked by the group simulation):

| Count | Cosmetic (id), proposal | What changes |
| --- | --- | --- |
| 10 | Scorched Flag (`scorched_flag`) | a singed flag on every lean-to's pole |
| 25 | Glass Gull (`glass_gull`) | a gull of green crater glass perches on every Kettle |
| 50 | Enamel Sign (`sign_enamel`) | the "WIPE DAY #N" sign becomes red enamel with white letters |
| 100 | Ash Kite (`ash_kite`) | a patched kite flies over every island during Afterglow |
| 175 | Glass Chimes (`glass_chimes`) | crater-glass chimes on the lean-to ring at each Wipe Day |
| 250 | Gold Lid (`gold_lid`) | the Big Red's toilet-seat lid is painted gold |

- **Where:** the Friends header ("Saltmarsh has been nuked 214 times") with a bar to the next tier
  and its cosmetic; a feed line at each tier; each cosmetic can be switched off in Settings
  (default on).
- **Pace** (P1 model, 10-balance.md 4.7): four friends (a casual, an active, an optimal and an
  idle player) pass 10 on day 2, 50 around day 14, 100 around day 60 and reach about 210 by day
  365. Two players (casual and active) pass 50 around day 30 and 100 around day 170. So four
  friends reach the 175 tier within a year and 250 after it; the group simulation re-checks
  these numbers (errata E17).

---

## 5. The Freighter (weekly co-op, R6)

### 5.1 Schedule and loads

- A rusted cargo ship (proposal: "the Freighter", icon `freighter`) grounds on the sandbar every
  **Monday 00:00 UTC** and refloats when the next one grounds. The week id is that Monday's unix
  time. It is not the Armored era's tap target, the Wreck (`wreck`), which stands on the rise.
- **A load** costs **one hour of your own current output**, `3,600 × idle rate` (as in 3.1), so a
  day-1 friend and a veteran give the same thing. Loads are cheapest just after a Wipe Day, when
  output is low; that is accepted (resolutions 3.23): a load is a token of attention, and 6 a week
  bound it.
- **At most 6 loads per player per week**, one `load_freighter` command each; all six can go in one
  check-in after a Night Shift.
- Locked reasons (rule 6.3.3): "Hire a hand first: the Freighter takes an hour of your hands'
  work"; "Need 4.2B supplies (you have 1.1B): about 44 min"; "6 of 6 loaded: a new Freighter
  grounds Monday 01:00" (local time).

### 5.2 Tiers and "active player"

- `n` = players **active this week** (opened the game on the web since Monday 00:00 UTC), at least 1.
- Tiers I, II and III are reached when the week's total reaches **2n, 4n and 6n**: an average of 2,
  4 and 6 loads per active player.
- **A reached tier is never taken back.** If another friend opens the game mid-week, `n` rises and
  only the next tier's bar moves.
- **A load can only help.** `n` does not depend on loading, so a load raises the total and lowers
  nothing. (Counting only loaders would let one small load drop the average below the next tier.)
- Discord-only players are not in `n`: they cannot load from Discord (10.3).

| Active islands `n` | 1 (solo) | 2 | 4 | 10 |
| --- | --- | --- | --- | --- |
| Tiers I / II / III at | 2 / 4 / 6 | 4 / 8 / 12 | 8 / 16 / 24 | 20 / 40 / 60 |

### 5.3 Rewards

- Each tier pays **1 scrap** to every player who loaded at least once that week, whether the tier
  falls before or after their loads: at most **3 scrap a week**, inside N19's 2.5-a-day ceiling.
- The first tier III a player loaded for unlocks the **pennant** (`pennant`, proposal) on their
  lean-to; each later one adds a knot ("Pennant ×7" in Visit).
- **Lazy payout:** `meta.freighter = {week, loads, paid}`. On settle, `World` supplies the tiers
  reached in `meta.freighter.week`; a loader with `tiers > paid` gets the difference, even weeks
  later, with a toast and a welcome-back line ("The Freighter reached tier II: +2 scrap"). Tiers
  are derived from the `freighter_loaded` events' `tier` flags, so no new table is needed.

### 5.4 Group size and solo players

- **Solo:** 2, 4 and 6 loads give tiers I-III and 3 scrap. A group never raises the per-player bar.
- **Keen loaders carry quiet ones:** 6 loads cover three players' tier I share and one and a half
  players' tier II share, so tiers I and II are robust at any size.
- **Tier III means every island that played this week loaded 6:** a good week for 2-4 friends, rare
  for 10. It is the celebration tier, not the expected one.
- **No grades, warnings, kicks or contribution scores.** Nobody can be removed, and the sheet never
  lists who has not loaded.

### 5.5 The scene and the sheet

The ship sits small on the horizon at the left of the phone's view, beyond the flotsam lanes, with
marks I, II and III painted on its hull. Crates stack on deck and the hull settles lower as it fills
(total ÷ 6n in a fixed 18 slots, so group size never changes the drawing). A horn and a flag mark
tiers I and II; the pennant goes up at III. It glows softly while you can load but never takes the
advisor's crown. The sheet (tap the ship or the Freighter card in Friends; layout in 08-screens.md):

> **The Freighter** · aground until Monday 01:00
> [hold bar, marks I · II · III] 14 of 24 crates · tier I reached
> Tier II at 16, tier III at 24 (6 for each of the 4 islands that played this week).
> Each tier pays 1 scrap to everyone who loaded this week. Tier III raises a pennant.
> You: 2 of 6 loads.
> **[Load 1 h of supplies · 4.2B]** · leaves you 18.3B
> Loaded this week: Ivo, Mira, Patrik
> Last 4 weeks: III · II · II · I

Loaders are listed alphabetically, **without counts**.

---

## 6. Late Tide (catch-up, R6)

- **Rule** (resolutions 1.8). Take glass ever of every *other* player active in the last 14 days
  and their median (the middle value; for an even count, the mean of the two middle values). A
  player below **50% of that median** gets **Late Tide ×3** on every nuke, applied last, to the
  whole gain after Blast nodes, but the bonus never carries glass ever past the median. With `g`
  the gain before Late Tide, `E` glass ever and `M` the median, the nuke pays
  `max(g, min(3g, M − E))`. With nobody else active, it never applies.
- **Not clawed back.** The gain is `(G(L) − level) × multipliers` and only `level` moves
  (resolutions 1.2; 03-the-big-red.md owns the formula). Granted glass (the founders' 5, admin
  grants) goes to glass held only, so it never moves anyone's median.
- **Examples.** Five players at 40, 300, 2,000, 2,500 and 9,000 glass ever: the player at 40 sees
  the others' median 2,250, so Late Tide applies (below 1,125); the player at 300 also sees 2,250
  and has it; the player at 2,000 sees 1,400 and does not. Two players at 900 and 3,000: 900 is
  below half of 3,000, so a gain of 400 pays 1,200, and a gain of 900 pays 2,100 (not 2,700),
  exactly up to 3,000.
- **Visible label.** The glass chip's sheet: "Late Tide ×3: your glass ever is under half of your
  friends' middle (3,000). Blasts pay triple glass, never past 3,000, until you reach 1,500." The
  cover card: "+1,200 glass (Late Tide ×3)", or when the cap binds "+2,100 glass (Late Tide, up to
  3,000)". A stamp on the player's own in-game postcard. The rule is in the Friends help line.
- **Openly, not publicly.** The player always sees that it applies, by how much and until when,
  and everyone can read the rule (guardrail 9: no hidden catch-up). Nobody is shown who has it: it
  is never in a feed sentence, a shared postcard, a board, Visit or the island list.
- **Freshness.** `World.lateTide` carries the median as a number (errata E18); `World` copies it
  (or none, when Late Tide does not apply) into `meta` on
  every server settle (canon 13.6); the nuke uses the server's value, and the postcard shows it if
  it moved since the cover card.

**Why it cannot be gamed:** it only multiplies your own gain and cuts nothing from anyone; glass
ever never falls (spending does not lower it), so you cannot stay under the line and still gain;
one press can at most reach the others' median, never pass it on the bonus; your own glass is not
in your median; extra low-glass accounts lower the median and shrink Late Tide; a leader going
quiet leaves the median after 14 days, which also lowers it; the server computes it from `World`,
never from a client value; and waiting for a friend's big Wipe Day to lift the median is catch-up
working as intended.

10-balance.md's N17 result (10 days at ×3) has no cap yet; the group simulation re-checks N16 and
N17 with it (section 13): N16 is asserted in the group of five with Late Tide, N17 for two players
(five players is a warning) (errata E11, E16).

---

## 7. Boards (R6)

### 7.1 The seven boards

Each has a **monthly** window (UTC calendar month; canon 10 keeps "month" only as a board window)
and an **all-time** window. Nobody is ever reset. Small blasts score on none of them.

| Board (id) | Metric | Monthly / all-time | Better | Scale-free because |
| --- | --- | --- | --- | --- |
| Wipe Days (`wipe_days`) | Wipe Days | this month / total | more | a count |
| Best blast (`best_blast`) | glass gained before Late Tide ÷ glass ever before, %, from Wipe Day #2 | best single this month / ever | higher | a ratio of your own numbers |
| Fastest comeback (`fastest_comeback`) | producing time in a run until its gain passed the last Wipe Day run's, ÷ that run's producing time, %; from Wipe Day #3 | best this month / ever | lower | a ratio of your own times |
| Nodes lit (`nodes_lit`) | Blast Map nodes owned | bought this month / owned | more | a count |
| Logbook (`logbook`) | entries | logged this month / total | more | a count |
| Flotsam (`flotsam`) | flotsam caught (Flare included, crates not) | this month / total | more | a count, capped by the 4-10 min spawn |
| Freighter loads (`freighter_loads`) | loads | this month / total | more | a count, at most 6 a week |

Best blast leaves Late Tide out, so the board never hints at who has it. Fastest comeback:
*producing time* excludes time stalled at a full Night Shift, so idling out a run does not fake a
fast comeback; both gains are the formula's gain before nodes and Late Tide, so no bonus fakes one
either; the reference is the last run that ended in a Wipe Day, so a small blast cannot set an easy
mark. It is recorded at the run's Wipe Day; a run that never passed its reference records nothing.

### 7.2 Windows, ties, listing, the Hall

- **Ties** are judged on the shown value (whole percent, exact counts); tied players share the rank,
  ordered by name.
- Only players with a value in the window are listed; **zero is never shown**. If you are not on a
  board, your row is pinned at the bottom with a way on: "Not on this board yet: catch a flotsam to
  join." (rule 6.3.5).
- Values come from `meta.stats` and `meta.stats.month` (keyed "2026-11", reset lazily when the key
  changes, last month kept for the Hall), computed from bases in JS as `leaderboards()` in
  `packages/domain/src/leaderboard.ts` is today (called by `Game.ranks`, `apps/api/src/game.ts`;
  canon 13.2). `GET /api/ranks` becomes `GET /api/boards` (09-architecture.md 9.1).
- **The Hall** keeps season 1's archive as "the old world" (read-only) plus each month's board
  leaders, written by the scheduler's first tick after the month ends.

### 7.3 A newcomer's first week

Tess joins on the 10th; Patrik is three months in, Mira two.

| This month | Tess (week 1) | Patrik | Mira | Why Tess can lead |
| --- | --- | --- | --- | --- |
| Best blast | +180% (Wipe Day #2 after a day-long run) | +31% | +48% | early Wipe Days add 170-190% to glass ever; late ones 10-50% (10-balance.md 4.5) |
| Fastest comeback | 34% (run 3) | 71% | 66% | early runs pass the last one in about 30-55% of its time, late runs in 80-90% (medians, 10-balance.md 4.6) |
| Logbook | 26 | 8 | 11 | the easy entries are new to her |
| Freighter loads | 6 | 6 | 6 | capped; ties share rank 1 |

Veterans keep the all-time boards and usually Wipe Days, Nodes lit and Flotsam this month: every
kind of player leads something.

---

## 8. Visit (R6 stretch)

Tap a friend to see their island now, read-only.

| Shown | Never shown |
| --- | --- |
| era badge and base drawing; lines as drawn (1/25/100) with count badges; hands at their lines; the target; the Kettle's stage; the crater and its sign; keystone loadout; current Dare; cosmetics (Founder skin, Island Count items, pennant ×N); counts of nodes lit, Logbook entries, flotsam caught | supplies, rate, glass, Glow, scrap, Late Tide, Night Shift fill, Magnet, Pockets, crates waiting, last seen or any activity time, settings |

- **Entry points:** Friends' island list (avatar, name, era badge, Wipe Day count; no online dot), a
  name in a feed row, a board row, a friend's postcard sheet. Not on Discord.
- **Screen:** the same Pixi scene, read-only (ambient animation, no taps, flotsam or shop), a banner
  "Mira's island · Wipe Day #23 · Stone era" and Back (rule 6.3.2).
- **API:** `GET /api/friends` (the island list) and `GET /api/visit/:player` (09-architecture.md
  9.1), returning a `VisitView` projected by a pure domain function from a read-only settle, never
  the state document.

---

## 9. Shared first finds (R4)

- When a player logs a secret, the server checks `World`'s set of secrets already found on the
  island (from `logbook_entry` events flagged `firstFind`). If nobody has it, the event gets the
  flag and posts (examples 8, 9). SQLite serialises transactions: two finds in one second resolve to
  whoever committed first.
- Everyone else's Logbook then shows that secret's one-line hint at once, even before Wipe Day #15 or
  the `old_maps` node, with "Found first by Mira"; the entry stays "???" until they log it.
- The finder's tile gets a "Found first on Saltmarsh" stamp; their Logbook shows "First finds: 3".
- A Message in a Bottle (canon 4.6) picks a secret whose hint the player lacks, so it is never wasted
  on a shared hint. Logbook content is 05-meta-layers.md's.

---

## 10. The Discord companion v2

### 10.1 What stays

D121-D126 are unchanged except for the command allowlist (10.3): a thin API client with a service
token, `/base` ephemeral on 600 units for a 290 px phone, one-time login links, DMs mirroring web
notifications, the feed channel from the same `event_log` row with an acked cursor, its own
container profile. Words and numbers come from `@wipe-day/domain/words` and the shared formatter.
The command stays `/base`.

### 10.2 The `/base` card v2

| Field | Shows | Phase |
| --- | --- | --- |
| Title, subtitle | "{name}'s island"; "Stone era · Wipe Days: 12" (or "Twig era · first run") | R2 |
| Big number | the idle rate, "+3.1T/s" | R2 |
| Glass chip | "2,154 ×12.6" (glass and Glow) | R2 |
| Night Shift bar | "7 h 12 m of 12 h"; stalled: "Full: your hands stopped <t:…:R>" | R2 |
| Big Red | "+12 glass now", with the crown mark when crowned; locked: "First launch at 50B made (31M now)" | R2 |
| Scrap chip, Magnet line | "7"; "**Magnet** a sure haul <t:…:R>" or "2 scrap waiting in the tray" | R5 |
| Blowback line | "**Blowback** 6 crates on your shore, from Mira and Ivo" | R6 |
| Freighter line | "**Freighter** tier I, 14 of 16 loads to tier II; sails <t:…:R>" | R6 |
| Status line | what the last click did, or the advisor's one next step | R2 |

The card is private (D125), so it may show the player's own amounts. Fields for unshipped systems are
absent, never greyed (canon 12.3).

### 10.3 Buttons, and an allowlist on the API

- **Collect** sends the ordinary `collect`, keyed `discord:{interaction id}`: it settles, restarts the
  Night Shift window and runs the Foreman's pass when `meta.prefs.foreman` is on (canon 7.5; resolutions
  3.15, errata E18). It leads the row when the window is stalled or at least half used;
  otherwise **Open the game** leads. After a click: "Collected: your hands worked 9 h 12 m (+4.2T).
  A fresh 12 h Night Shift starts now." It does not mark the player seen (D121), so the web's
  welcome back still tells the story.
- **Refresh** and **Turn DMs off/on** as today.
- **Nothing else:** no taps, no nuke (owner decision 18), no buying, crates, Freighter, Magnet or
  Blast Map. When one is the next step, the status line points into the game: "The Big Red is
  crowned: open the game to flip the lid."
- **On the server** (resolutions 3.23): `POST /api/bot/commands` accepts only `collect` and refuses
  the rest with `not_on_discord`. This narrows D121's "every player route of the web is mounted
  there too" for commands; the read routes stay mounted.

### 10.4 DMs and the feed channel

- **DMs:** the four kinds of section 11, same words, switches and quiet hours (D123), each with
  "Show my base", "Open the game" and "Turn DMs off"; "Night Shift over" also gets **Collect** as
  its primary. `NOTE_TONE` in `apps/discord/src/ui/island.ts` becomes `night_shift_over` warning,
  `magnet_full` success, `friend_nuked` neutral, `freighter_tier` success.
- **Feed channel:** the six kinds (2.1) in the web's sentences, throttled server-side so the channel
  and the web never disagree. Season news is replaced by one **monthly post** on the stream's news
  event: the group's counts (example 16) and each board's monthly leaders, ties included.

### 10.5 The postcard card (R6)

New `apps/discord/src/render/cards/postcard.tsx`, 600 × 380 units, same renderer and bundled Roboto
Condensed (D3, D7). Left: the crater with its "WIPE DAY #N" sign in the player's sign style, the
Kettle's flight as a dashed line for its variant, and "Greetings from Ground Zero". Right: "{name} ·
Wipe Day #N", run time, "+12 glass", "Glow ×1.79 → ×2.17", best line with its product icon (A1),
flotsam caught and "Next Wipe Day unlocks: …". Shared postcards (Discord, the feed thumbnail) never
carry the Late Tide stamp; only the player's own in-game postcard does (section 6). Icons come
from `icons/<kind>/<id>.svg` with today's tile as fallback; if rendering fails the sentence posts
alone. Only news nukes post, so at most one postcard per player per 30 minutes.

### 10.6 `boundary.test.ts`

- Keep "keeps no database of its own" and the `applyCommand|settleAll` check, extended to `nuke(`
  and `applyTaps` (09-architecture.md 11).
- Replace the blocklist `RULEBOOK` (`commands` and `settle`, plus `nodes`, `missions`, `market`,
  `casino` and `raids`, all five leaving) with an **allowlist** (errata E18): value imports from
  `@wipe-day/domain/*` only from `glance` (proposal: one read-only module for rate, window fill, Big
  Red yield, Magnet, crates and Freighter, shared with the web's top bar), `advisor`, `words` (the
  formatter included, 09-architecture.md 2.4) and `clock` (the bot's `systemClock`); the preview
  fixtures (`render/fixtures.ts`) may also call `newBase`. Everything else is type-only. An
  allowlist cannot go stale while the domain is rewritten. Module names follow 09-architecture.md.
- Remove the `raidWarned` exception.
- New: one constant `BOT_COMMANDS = ["collect"]`, and no other command `type` literal in
  `apps/discord/src`; an API test checks `not_on_discord`.

### 10.7 Strings, removals and preview

New or changed `discord.*` keys (all in `packages/content/locale/en.json`):

| Key | English |
| --- | --- |
| `discord.command` | Your island: how it's doing, Collect, and a link into the game |
| `discord.title`, `discord.card.subtitle` / `subtitle_first` | as in 10.2 |
| `discord.card.night_shift` / `night_shift_full` | Night Shift {used} of {window} / Full: your hands stopped {when} |
| `discord.card.big_red` / `big_red_locked` | +{glass} glass now / First launch at {threshold} made ({made} now) |
| `discord.line.crates` | **Blowback** {count} crates on your shore, from {names} |
| `discord.line.freighter` | **Freighter** tier {tier}, {loads} of {next} loads to tier {nextTier}; sails {when} |
| `discord.status.stalled` | The Night Shift is over and your hands have stopped. Collect to start them again. |
| `discord.status.collected` | Collected: your hands worked {time} (+{gain}). A fresh {window} Night Shift starts now. |
| `discord.next_action.*` | big_red, era, hand, buy, crates, tool, tap (the advisor v2 kinds, canon 12.5) |
| `discord.feed_title` | On Saltmarsh |
| `discord.news.month` / `news.leaders` | example 16 / **Led the boards** |

**Removed:** Gather, its cooldown and `gatherReadyAt`; storage tiles and "store full"; the waiting,
builders, crafting, trip, scout and raid lines with `raidWarned`; the season subtitle,
`discord.season_ends` and `seasonDay`; season news (`discord.news.announced`, `next`, `ended`,
`started`, `started_plain`, `winners`, `winner`); the `Last` kinds `gathered`, `full`,
`cooldown`; the DM kinds `party_back`, `raided`, `raid_warning`, `arrivals`, `builds_done`, `sold`.

**`pnpm preview`** adds: the card at run 1 minute 1, crowned, and stalled with 9 crates; a 7-digit
glass chip and a 32-character name; postcards #1 and #47 with a "+2.15M" gain; every feed and DM kind;
the monthly post.

---

## 11. Notifications

| Kind (id) | Default | Fires | Title / body | Opens |
| --- | --- | --- | --- | --- |
| `night_shift_over` | **on** | when the window ends (last command + window) | "Your hands have stopped" / "The Night Shift is over: 12 h worked. Open the game, or Collect on Discord, to start the next one." | the island |
| `magnet_full` | off | when the Magnet has hauled by itself (05-meta-layers.md) | "The Magnet hauled up scrap" / "2 scrap is waiting in the tray." | the Magnet |
| `friend_nuked` | off | a friend's news nuke (2.2) | "Mira pressed the Big Red" / "Wipe Day #12. 3 crates washed onto your shore." (or "Your shore is already full of crates.") | your shore |
| `freighter_tier` | off | a tier is reached; **only to that week's loaders** | "The Freighter reached tier II" / "+1 scrap is yours." | the Freighter |

- `NOTIFY_KINDS` and `DEFAULT_NOTIFY` (`packages/domain/src/feed.ts`) become these four (canon 12.7).
  At the cut-over every player's switches reset to the defaults; `notifyPrefs` already drops unknown
  keys. The push pipeline (`apps/api/src/push.ts`) is unchanged; DMs carry the same words.
- An open, visible tab pings every 5 minutes, so "Night Shift over" never fires while you play.
- **Quiet hours** (resolutions 3.23): 22:00-08:00 in the player's browser time zone, on by default,
  one switch in Settings ("Quiet hours 22:00-08:00"). The zone is sent with the notification
  settings; before the first web visit the island's clock (`island.json5`: UTC+1, no daylight
  saving, errata E9) stands in. A
  notification due in quiet hours waits until 08:00; a later one of the same kind replaces it.
  Without this, a 12-hour window started at 15:00 pings at 03:00. DMs wait the same way in the
  API; the bot stays live-only (D123), so a held DM goes out at 08:00 only if the bot is connected.

---

## 12. Toxicity and pressure checks

| Situation | What could hurt | How the design prevents it |
| --- | --- | --- |
| Far behind | Hopelessness | Nothing compares amounts; Late Tide ×3, labelled; two boards favour early runs |
| A newcomer passes you | Resentment | All-time and cumulative boards stay the veteran's; Late Tide ends at half the median and its bonus never carries anyone past the median |
| You did not play this week | Guilt, nagging | No last-seen, no online dot, no "has not loaded" list; loaders named without counts; nothing decays |
| Tier III missed | Blame | Tiers I-II carried by keen loaders; a load never lowers anything; reached tiers stay; no grades, warnings or kicks. If playtests show pressure, tier III could sit at an average of 5 (a canon change) |
| Needed at a set time | Alarms | The Freighter runs all week, no first-come bonus; nothing is timed to the group; quiet hours on by default |
| Notification or channel spam | Muting everything | One kind on by default; small blasts post nothing; at most one nuke post per player per 30 min; records need 10 values; Island Count tiers are rare; one monthly post |
| Late Tide label | Being marked as behind | Only on your own chip, cover card and in-game postcard; never on shared ones or boards |
| Visit | Being judged | No amounts, Glow or activity times |
| Records | A loser named | "set an island record", never whose record fell |
| Blowback | Missing out; a dud | No expiry; crates survive the nuke; a returner finds 9; every crate pays at least 1 min of output |
| Cheating | Inflated boards | Taps never count socially; small blasts never count; flotsam capped by its spawn; every social value server-derived |
| A friend quits or returns | Others punished; a wall | They leave the median after 14 days and the Freighter bar in any week they do not play; on return, 9 crates, Late Tide, nothing reset |

---

## 13. Data and tests

`packages/content/data/social.json5` (canon 13.8; keys proposal, schema in 09-architecture.md):

```json5
{
  // the 10% Wipe Day rule is prestige.json5's countShare (03-the-big-red.md 1.7)
  news: { foldMinutes: 30, milestones: [1, 10, 25, 50], everyAfter: 50, recordMinValues: 10 },
  blowback: { cratesPerNuke: 3, maxWaiting: 9, pays: "crate" }, // the Drift Crate's lump, flotsam.json5
  islandCount: { tiers: [10, 25, 50, 100, 175, 250], // errata E17
    cosmetics: ["scorched_flag", "glass_gull", "sign_enamel", "ash_kite", "glass_chimes", "gold_lid"] },
  freighter: { loadSeconds: 3600, maxLoadsPerWeek: 6, tierAverages: [2, 4, 6],
    scrapPerTier: 1, pennantTier: 3 },
  lateTide: { factor: 3, belowMedianShare: 0.5, activeDays: 14 }, // never past the others' median
  notify: { defaults: { night_shift_over: true, magnet_full: false, friend_nuked: false,
    freighter_tier: false }, quiet: { on: true, from: "22:00", to: "08:00" } },
}
```

Tests (09-architecture.md lists them in full): Blowback never lands your own nukes or a small blast,
never exceeds 9, never moves the cursor back, writes no other base, and every crate pays at least 1
min of output; a Freighter load never lowers a tier (property), 50 parallel loads stop at 6, each
(week, tier) pays once; Late Tide excludes the viewer from the median, never carries glass ever past
it, and zero-glass accounts never raise anyone's Late Tide (properties); **boards are
scale-invariant** (property: multiplying every amount in every base by 1e10 changes no board); a
small blast never posts, counts or scores; the throttle folds; a notification due in quiet hours
goes out at 08:00 and is replaced by a later one of its kind; the bot allowlist and
`not_on_discord`. The simulator's group run (canon 13.9) supplies the Late Tide medians (with the
cap) and the Blowback rate from friends' actual Wipe Days, replacing 10-balance.md's flat 9 crates
a day, re-checks N16 (group of five) and N17 (two players), and counts Freighter scrap in N19. Shots for 08-screens.md:
`phone_friends_feed`, `phone_boards`, `phone_freighter`, `phone_freighter_tier3`,
`phone_blowback_shore`, `phone_visit`, `phone_late_tide_cover`, `phone_island_count`, and
`phone_settings` with quiet hours.

---

## Open questions

None; settled by errata v3.

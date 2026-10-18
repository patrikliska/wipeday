# 12. Feel: the addictive layer (owner brainstorm, 2026-10-17)

**Status:** owner decisions taken in chat on 2026-10-17 (D181-D187); the detail here is a
proposal for the next plan-mode session. R2 Feel's approved plan (2026-10-18) refines it in
D191-D201, which win where they differ: the palette comes from the Scene Mock and the pixel scene
lands inside R2 Feel (D191), the Line Mks become one Workshop item per line (D194), the offline
item is Spare Wicks (D201). Where this file disagrees with `02`, `05`, `10` or
`11`, this file wins; where it is silent, they stand. Every number is a P1 starting value that
the simulator owns and may retune. The visual direction, the two HUD mocks, the card reveal and
the asset catalogue are on the Saltmarsh Feel Board (private artifact, link in `docs/roadmap.md`
"Where we are").

## 1. Why

The owner played R1 and still did not like the game. Against Cookie Clicker, Egg, Inc. and Idle
Cave Miner 2 the diagnosis was:

1. **The tap makes a number, not stuff.** A small tree in the corner and a counter.
2. **One verb for 45 minutes:** buy the next row. No second system before the nuke.
3. **The crew are switches, not people.** Hire, done. No levels, gear or collection.
4. **Nothing random is fun.** Flotsam every 4-10 minutes is the only surprise; no drops, no
   reveal moments. The spec banned the gacha layer on purpose.
5. **Offline is too generous too early.** 12 h at 100% from day one removes the lunch check-in.
6. **The HUD reads as a dashboard:** grey glass rows, a muted palette, no juice, no sound, and
   the shop reorders itself under the finger.

The owner's words: the game must be addictive like modern idle games; clicking and activity must
visibly do something; cards of survivors and their gear, collected or bought from chests; the
purchase switch for real money only in the last phase; offline 2 h at the start, extended by
research; as user-friendly and as good-looking as possible; desktop, tablet and phone.

## 2. The owner's decisions (2026-10-17)

| # | Decision | Replaces |
| --- | --- | --- |
| D181 | Survivor and gear **cards**, **Supply Drops** (chests), an **Album**. Odds printed, pity visible, no pull ever blank | guardrail 8's "no casino" as a blanket ban; `05` 2-4 crew ranks |
| D182 | **Scrap is the premium currency**, earned in play, spent on drops and boosts. **Real-money purchase of scrap is the last phase only**; nothing is wired before it | CLAUDE.md 1 "no real-money anything" (deferred, not deleted); N19's scrap band |
| D183 | **Offline starts at 2 h** and grows by research (per run) and glass (permanent) to 24 h | guardrail 7 / N18 (12 h rising to 48 h) |
| D184 | **Taps stay relevant:** an active hour is 4-6× an idle hour; taps make physical things and drive Frenzy | N8, N9 (1.5-3×) |
| D185 | **A research tree from minute two**, per run, priced in Supplies | nothing; new |
| D186 | **The shop never reorders.** Fixed order by rung; the crown highlights in place; a Best buy chip scrolls to it | `02` 11 / D165-D170's crown-leads-the-drawer |
| D187 | **One bottom dock on every device**, five places; desktop gets the same dock centred; panels open as sheets over the scene, the shop stays a right column on desktop | `08` 2's nav row and desktop column |

Also agreed: a salvaged-materials HUD on the tokens of the Feel Board (the owner approved the
board's HUD direction the same day); desktop 1440 is designed first and 390 px right after; paid
assets are fine up to 100 USD in total. The scene was first agreed as painted 2D; the owner then
chose pixel art (D188, 2.1).

### 2.1 Pixel art (D188)

The owner's pick is 0-mem0ry's *Post Apocalyptic Workshop Set* (itch.io, free, name your price;
commercial use allowed, no redistribution, no AI use or training): 32×32 grungy workshop
furniture and 16×16 crafting icons. It sets the look: chunky 32-px props, a warm rust-and-plywood
palette, readable silhouettes. The rules that make it work in our scene:

- **Side view stays.** The island is a side view with a slightly raised eye, as now (D42). The
  pack is drawn 3/4 top-down, which reads fine for props standing on a side-view ground (its
  floor and door tiles go unused). The island layers, the per-era hero targets, the hands at
  work, the flotsam and the survivor busts are generated in the same style (2.2) and snapped to
  the grid and palette by a script, so one pixel scale and one palette hold across everything.
- **One grid.** 1 art pixel = 5 stage units, so the 1600×900 stage is 320×180 art pixels and
  the hero target is at least 60 art pixels tall (N27 holds at zoom 2). Zoom is an integer in
  device pixels, chosen per viewport (2 on a 390 px phone, 4 on a 1440 desktop, clamped 2-5);
  the camera shows more or less world, never a non-integer scale. Nearest-neighbour everywhere
  (`scaleMode: 'nearest'`, `image-rendering: pixelated`); no sub-pixel movement, animations step
  on the art grid.
- **One palette.** `scene/palette.ts` becomes a fixed palette of at most 48 colours derived from
  the pack plus the five era colours; the generation script quantises to it, the procedural
  layers (sea, sky, weather, night tint) draw from it. Text, the HUD and the panels stay crisp
  CSS on the Feel Board's tokens; no pixel font.
- **Icons (D141 amended).** Item icons (products, gear, flotsam kinds, targets) become 16×16
  pixel PNGs at `packages/content/icons/<kind>/<id>.png`, drawn at integer multiples; UI glyphs
  (dock, actions, currencies, settings) stay currentColor SVG. One format per kind, the lettered
  tile remains the fallback.
- **Packs are committed with their licence.** Licensed packs live under
  `packages/content/art/<pack>/` next to a `LICENSE.txt` and a line in a credits panel. CLAUDE.md
  2's "third-party game assets" means assets ripped from other games (D43), not licensed packs;
  R2 Feel rewrites the line. No pack image is ever sent to an image model (the pack forbids it).
- **The prompts** on the Feel Board (1-4) are rewritten for pixel art in R2 Feel's art sprint:
  "32-px side-view pixel art, 48-colour palette, no anti-aliasing, no outline on terrain" and
  the palette swatch as the only reference image.

### 2.2 The image tools, run by the agent (D189)

Figma's image generation is off on the owner's org and its Weave models need a linked Weave
account, so neither is the path. Gemini is not the path either: its image models still return
opaque images (no alpha channel; the known workaround is a chroma-key background plus a script)
and the owner's past results with it were poor. Chunky 16-32 px sprites are also a bad fit for any
general image model: they paint a "pixel look" at high resolution with an uneven grid,
anti-aliasing and off-palette colours. So: two tools and one cleanup script, all run by the
agent; the owner supplies keys only.

- **Primary, for sprites, props, tiles, era targets, hands, busts and animations: Retro
  Diffusion** (retrodiffusion.ai). A pixel-art-specific generator: true pixel grid, transparent
  backgrounds, palette control, outputs from 16×16 to 384×384, animations and tilesets. Pay per
  image on prepaid credits that do not expire: about 0.015 USD (RD Fast) to 0.18 USD (RD Pro) per
  image, 0.07-0.25 per animation, 0.10 per tileset, as its MCP readme states today (to confirm
  on the site); new accounts get starter credits. It has a hosted MCP server
  (`mcp.retrodiffusion.ai/mcp`, bearer key `rdpk-…`) and a REST API, so the agent drives it from
  Claude Code directly. Budget: 20 USD of credits.
- **Backup, for the large layers: OpenAI gpt-image-2.5** (`OPENAI_API_KEY`). Official
  `background: "transparent"` with PNG output; edges up to 3840 px. Billed per output token at
  30 USD per million: about 0.03 USD for a 1024² image at medium quality, 0.13 at high. Used for
  the parallax bands (skyline, sea, sky) that Retro Diffusion's 384 px ceiling cannot cover in
  one piece, then snapped to the grid. Budget: 10 USD, with a cap set in the console.
- **PixelLab** (pixellab.ai) is the alternative to Retro Diffusion: a subscription (about 12 USD
  a month per third-party listings), strongest at skeleton-based character animation and 4- or
  8-direction rotation, with an API and an MCP server. Taken only if Retro Diffusion's
  characters disappoint.
- **The cleanup script, `pnpm art`** (added in R2 Feel): detects the pixel pitch of any output
  and downsamples to the art grid by nearest neighbour, quantises to the 48-colour palette,
  knocks out a chroma or white background by edge flood fill when the model gave none, and
  writes the candidates into `preview/art/` with a contact sheet. The owner picks by number.
- **What the owner does:** create a Retro Diffusion account, buy credits, paste the key; create
  an OpenAI key with a spending cap, paste it. Two lines in `.env`, nothing else.

**Done on 2026-10-18 (D190).** The Retro Diffusion key is in `.env`, its MCP server is registered
in Claude Code, 10 USD of credits are loaded, and a first island scene was generated and
composed: fifteen assets for 2.16 USD, published as the Saltmarsh Scene Mock (private,
https://claude.ai/artifact/PKrdCDtyVt5gZCrmFBGthV; the page, the sprites, the scripts and the
working prompts are in `docs/redesign/art/`, its README is the pipeline's manual). What it fixed:

- `rd_pro__platformer` (0.18 USD per image, any size 12-256 px) draws every sprite in the game:
  strict side view, clean alpha, one grid, first try. `rd_plus__low_res` (0.06) is enough for
  props under 40 px. The v2 API is asynchronous (submit, then poll the task list).
- The environment style paints whole postcards and ignores "no sky, no ground", so the bands
  (sky, sea, ground, far coast) come from the palette gradient plus small generated pieces or
  the tile styles. OpenAI stays the backup for anything wider than 384 px; not needed yet.
- The real pass constrains every prompt to the 48-colour swatch (`input_palette`) and states one
  light direction; the mock skipped both on purpose and shows the drift.
- Characters animate from the finished sprite: `rd_advanced_animation__idle` and `__walking`
  take it as `input_image` (padded to at least 32 px a side) and return 8 frames for 0.14 USD.
- The whole scene, four eras of targets, hands, flotsam and twelve busts: about 25-35 USD.

## 3. The feel

### 3.1 The hero tap

- The target stands at about 35% of the screen height, centre-left on desktop, centre on a
  phone; at least 120 px tall (N27 stands).
- **Every tap chips a thing:** a log, a stone, a nugget, a pinch of sulfur, a plate, drawn as a
  sprite that arcs onto a **stockpile** prop next to the tree, where it stays until a hand or the
  tap floater "sells" it. The counter still credits at once; the stockpile is the picture of it.
  Squash and stretch on the target, chips and dust from the Particle Pack, a 60 ms shake on the
  fell, a thud from Impact Sounds.
- **Frenzy** replaces Hustle's silent ×1 to ×2. The meter is drawn under the target. At 100 it
  trips: 15 s of ×3 taps, the sky warms, lines spin faster visibly, a sting plays; then it drains.
  Hustle's numbers stay as the base (`02` 6); Frenzy is the visible state on top.
- **Felling** drops things: every fell pays its bonus as today and, on a printed schedule, a
  Supply Drop (7.1).
- **Hold to work** stays. Afterglow stays.
- Target: an active hour at 4-6× an idle online hour on the weighted hour (N9 rewritten, 11).
  The levers are Frenzy, Rush, drops and boosts; the bucket (15 taps/s) does not move.

### 3.2 The juice checklist (every feature, every phase)

Every purchase: a sound, a flash on the thing it changed, a number pop. Every bar: a tick at the
end. Every gain: a delta floating from where it came from with its icon (6.3.7 stands). Coins arc
into the counter on Collect. Buttons have depth and a press state. Cards flip. Chests creak,
then burst. One sting per rarity. Reduced-motion users get the same information without the
motion.

### 3.3 Sound

Off by default on the web until the first tap, then on, with one switch. Sources: Kenney
Interface and Impact Sounds (CC0), Freesound filtered to CC0, the Sonniss GDC bundles. One
`sounds.json5` maps events to files; nothing plays from a component.

## 4. Navigation and the shop

- **The dock:** Island, Research, Crew, Album, Logbook. Appears at 0:00 with Island alone and
  grows as each destination unlocks (Research at 2:00, Crew at the first hand, Album at the
  first drop, Logbook at the first page). Badges count new things. Same component on every
  device; on desktop it is centred along the bottom edge with larger icons.
- **Panels** open as sheets over the scene from the dock, full-height on a phone, wide and
  centred on desktop; Escape, the back gesture or a click outside closes them. Never a dead end.
- **The shop** on desktop is a right column of **cards**, 400 px: art thumbnail with the level
  badge and the hand's portrait, name, rate, progress to the next milestone, one button. On a
  phone it is the drawer, two cards collapsed, dragged open. Tabs: Lines, Shelf, Research.
- **Fixed order** by rung, forever (D186). The crown lights its card in place. A **Best buy**
  chip in the counter plate scrolls the list to the crowned card and pulses once. The advisor's
  rules (`02` 11) are unchanged; only the presentation moves.
- Panels never reorder, hide or collapse rows on their own. Locked rows stay visible with the
  reason.

## 5. Research (the Workshop) *(proposal)*

Egg, Inc.'s common research, in our materials: a per-run tree of small, repeatable upgrades
priced in Supplies, open from minute two, reset by the nuke so every run re-climbs it. It is the
engine behind guardrail 4 ("always something to buy") in the minutes between line purchases.

- **Shape:** 8 tiers, 5 items each, 40 items, every item 5-25 levels. Tier `k` opens with era
  `k/2` rounded up (tiers 1-2 Twig, 3-4 Timber, 5-6 Stone, 7-8 Sheet Metal). Armored has no
  tier; it is the end.
- **Price:** level `n` of item `i` in tier `k` costs `b_k × 1.35^n` with `b_k = 40 × 20^(k−1)`
  (tier 1 from 40, tier 8 from 51B). Content check: the whole tree costs under 1e18 Supplies,
  about 3% of a run-1 lifetime at the top, so it is bought alongside lines, never instead.
- **Effects** use the one vocabulary (`09` 5.1): `inc` on one line's output, `inc` on all lines
  of an era, `more` on taps, `set` on offline hours (6), `add` on flotsam odds, `inc` on
  milestone thresholds (never below 10), `add` on Frenzy gain, price cuts capped at ×0.6.
- **Examples (tier 1):** Sharper Hooks (Beachcomber +5%/level, 25 levels), Dry Kindling
  (Campfire +5%, 25), Lamp Oil (offline +20 min, 6), Calloused Thumbs (tap +1, 10), Quick Count
  (buy ×10 unlocked, 1).
- **Shown** as a grid of tiles with an icon, a level ring, the next level's cost and gain; the
  crown may land on a research tile (advisor rule 4 scores it like any purchase).
- Simulator: research is bought by the same payback rule as lines; N5-N7 measure it. The late
  tiers are the research equivalent of Mk II/Mk III; the shelf (`02` 5) shrinks to Grip, eras
  and the island upgrades, and the Mk rows move into research as tier items.

## 6. Offline: the Night Shift at 2 h

- **Window:** 2 h from the last command. Lamp Oil research adds 20 min a level, 6 levels,
  **4 h** per run (bought again each run, cheap). Permanent: Bunker-sector nodes add 2 h each,
  five of them (Deep Cellars stays the first, 1 glass), **14 h**; Wipe Days #10, #20 and #40 add
  2 h each, **20 h**; the Long Night Dare's reward and one ring-7 node reach the ceiling of
  **24 h**. The 48 h ceiling goes.
- **Inside the window 100%** of manned output, every lasting multiplier included. A full window
  stops accrual and destroys nothing. Welcome back and Collect as `02` 10; the card shows the
  window's fill as the lamp burning down.
- **Shown:** the lamp bar in the counter plate with "1 h 42 min of 2 h". Research names the
  next step: "Lamp Oil: +20 min, 1.2k".
- The casual's 13:00 check-in is a real check-in again; the simulator reports what the casual
  loses at 2 h versus 12 h and the day-1 curve is retuned so the first nuke still lands on day 1
  (guardrail 1 stands).

## 7. Cards, drops and the Album

### 7.1 Supply Drops

A chest of **three cards**. Tiers I, II, III set the odds. Every drop is earned or bought with
scrap; nothing else opens one before the last phase.

| Source | Tier | How often |
| --- | --- | --- |
| Felling | I | every 5th fell in run 1, every 10th after (printed) |
| Daily quests | I | three quests a day, the third pays a drop |
| Achievements | I-II | one per 10 pages |
| Flotsam: Sealed Locker | II | weight 1 (replaces its scrap) |
| The nuke | I / II / III | a small blast / a Wipe Day / a doubling Wipe Day |
| Scrap | II / III | 30 / 120 scrap |

**Odds, printed in the Album** (per card): tier I 70/25/4.5/0.5; tier II 45/40/13/2; tier III
10/50/32/8 (Common/Rare/Epic/Legendary, %). **Pity, printed:** a Rare or better within 10
cards, an Epic or better within 40, a Legendary within 150, counted per player across tiers.
**No blank pulls:** a duplicate pays shards (7.3). The reveal is one flip per tap, rarity colour
first; "Flip the next" is primary, "To the Album" secondary, both always present.

### 7.2 Survivor cards

The 14 hands become 14 **survivor cards**. The run is never gated by a card: a hand is hired
with Supplies exactly as today (`02` 3), card or no card. Owning the card adds to the hired hand:

- **Rarity** (fixed per survivor, not per line order, so early pulls matter): 5 Common (Mara,
  Dax, Ivo, Bram, Otto), 5 Rare (Rook, Sela, Wren, Juno, Pike), 3 Epic (Hale, Tamsin, Gus), 1
  Legendary (Vera).
- **Stars** 1-5 from shards: 10 / 25 / 50 / 100 shards for stars 2-5. Each star: that line
  **+25%** (`inc`). Five stars: ×2, the old rank-5 value. Crew ranks (`05` 3) go; the "ranks rise
  together" rule goes with them.
- **One trait** each, on while hired: Dax "Keeps the fire" (crit +2%), Mara "Early riser"
  (Night Shift +10 min), Wren "Hot hands" (Furnace cycle −10%) and so on; at most +25% on one
  stat, in `cards.json5`.
- **Three gear slots.**

### 7.3 Gear cards

About 30 at launch, Rust in mood with our names: Salvaged Hatchet, Driftwood Rod, Rope Belt,
Tin Lantern, Gas Mask, Hazmat Coat, Jerrycan, Car Battery, Welding Goggles, Crowbar. Each has a
rarity, one stat (`{stat, op, value}`, at most +20% Common to +60% Legendary) and a slot kind
(hand, head, pack). Equipped to one survivor at a time; swapping is free and instant.
Duplicates pay shards of their rarity; shards buy any gear card of that rarity in the Album, so
a wanted piece is always reachable by play (shard prices 20 / 50 / 120 / 300).

**Sets:** all five Common survivors at 3 stars: Twig and Timber lines ×1.5; all 14 at 1 star:
Morale +10%; a survivor with three gear pieces of one rarity: that line +10%. Printed in the
Album.

### 7.4 The Album

A dock destination. Survivors as a grid of portraits (greyed until owned, stars under each),
gear as a grid, sets, the odds and pity counters, and the shard balances. Icons from
game-icons.net until the pixel icons exist (D141 fallback applies).

## 8. Scrap as the premium currency

- **Earn:** the Magnet (about 1 a day, `05` 2), achievements (1 per 5 pages), elite gulls (9.3),
  the nuke (3 on a Wipe Day, 10 on a doubling), daily quests (1 for the set). Target for a
  casual: 4-6 a day; N19 is rewritten to that band (11).
- **Spend:** Supply Drops (30 / 120), **boosts** on real seconds: Overdrive (all lines ×3 for
  10 min, 15 scrap), Double Time (taps ×5 for 2 min, 10), Lucky Tide (flotsam every 90 s for 5
  min, 20); Pocket slots as `05` 4. Boosts stack with Rally and Frenzy: that stack is the
  active-play jackpot.
- **Never:** traded, gifted, wagered, stolen, sold for Supplies. Boards count events, never
  scrap.
- **The last phase** adds one thing: a store with scrap packs for money, with the odds page one
  tap away. Before it ships: a payment provider, a short legal check on loot boxes for the
  players' countries (odds are already printed; some countries need more), and the owner's
  decision on prices. Nothing else in the game changes when the switch flips.

## 9. The scaffolding

### 9.1 Achievements wall

The Logbook's pages move up to the Feel phase in their simplest form: 60 badges at launch
(taps, fells, lines owned, hands, eras, drops opened, Frenzies, flotsam, nukes), each worth
Morale +1% (`05` 1's formula, 0.02 becomes 0.01 at launch and the Logbook phase raises it).
Shown as a wall, locked badges visible with their condition. A toast with the badge on each
unlock.

### 9.2 Daily quests

Three a day on the island's clock (UTC+1): "Tap 500 times", "Hire 2 hands", "Catch 3 flotsam",
"Open a drop", "Fell 20 times". The third completed pays a tier-I drop and 1 scrap. Never
"spend scrap". Rerolls: none.

### 9.3 Gulls

A gull crosses the sky every 2-4 minutes while the page is open; tapping it pays 30 s of output.
One in 20 is an **elite** (glowing, faster) and pays 1 scrap. Odds printed. The flotsam rules
(`02` 8) stay; gulls are the skill-based sibling.

### 9.4 The news ticker

One line under the dock on desktop, in the drawer's handle on a phone: crew one-liners, friends'
Wipe Days, the island's weather. Thirty lines at launch in `en.json`.

## 10. The first session, target beats

| Time | What is new |
| --- | --- |
| 0:00 | Tap the tree; logs arc onto the stockpile |
| 1:00 | First line, the shop card |
| 2:00 | Research opens (Sharper Hooks 40) |
| 4:00 | Fifth fell: first Supply Drop, first survivor reveal (Mara) |
| 5:00 | First achievement badge |
| 8:00 | First gull |
| 12:00 | First Frenzy trips |
| 15:00 | Timber era |
| 20:00 | Daily quests reveal (one already complete) |
| 45:00 | The Big Red; a tier-II drop and the Blast Map |

A new kind of thing every few minutes until minute 20, then the known rhythm.

## 11. Guardrails amended

- **N8:** unchanged in minute 0-1 (at least 50% tap-driven). From minute 10, outside bursts,
  direct taps 10-30%.
- **N9:** an active hour is **4-6×** an idle online hour on the weighted hour; rain hours warn.
- **N18:** 100% inside a Night Shift of **2 h rising to 24 h**; a full window stops accrual and
  destroys nothing.
- **N19:** scrap **4-6 a day** for a casual (7-day average from day 2), at least 100 by day 30,
  nobody above 8; scrap never traded, gifted, wagered, stolen or sold for Supplies.
- **New N28:** no Supply Drop card is blank; a duplicate pays shards (domain test).
- **New N29:** pity as printed (10 / 40 / 150), asserted by the seeded drop test.
- **New N30:** the casual opens at least one drop a day in days 1-30 (simulator).
- **New N31:** research keeps N5-N7 true with the shelf's Mk rows moved into it.
- Guardrail 8 is reworded: "Precious things are never at risk; randomness is paid for in play
  and always printed." Guardrail 1 stands: the first nuke on day 1, retuned for the 2 h window.

## 12. The phases, reordered

| Phase | Goal |
| --- | --- |
| R2 **Feel** | tokens, the dock, the card shop with fixed order, the hero tap and stockpile, Frenzy, juice and sound, research tiers 1-4, the Night Shift at 2 h with Lamp Oil, achievements wall, gulls, the ticker; on the stand-in scene |
| R3 **Cards** | survivors, gear, Supply Drops, the Album, scrap as premium with boosts, daily quests; research tiers 5-8 |
| R4 **The Big Red** | the nuke, the Blast Map wave 1, the cut-over, friends play (the old R2) |
| R5 | Blast Map wave 2 (the old R3) |
| R6 | Logbook in full (the old R4, minus the pages moved to R2) |
| R7 | Scrap sources, Pockets, Toolbelt, Foreman, Dead Hand (the old R5, minus ranks) |
| R8 | Friends (the old R6) |
| R9 | Dares, wave 3, live ops, the **store** and the purchase switch (the old R7 plus D182) |
| Painted scene | lands in any phase once the style sheet is approved; the HUD does not wait for it |

R2 Feel runs in plan mode first (architecture and balance). Its "done" adds: the Feel Board's
desktop and phone shots reproduced by `pnpm web:shots` within the tokens, sound on every event
in `sounds.json5`, N5-N9 and N18 passing in their new bands.

## 13. Screens for `SHOTS` (R2 Feel)

`desktop_hero`, `desktop_frenzy`, `desktop_research`, `desktop_sheet_crew`, `phone_hero`,
`phone_drawer_cards`, `phone_research`, `phone_dock_badges`, `welcome_back_lamp`,
`achievement_toast`, `gull_elite`, `ticker`; each at day, dusk, night and rain as `08` 8 lists.

## 14. What the owner supplies

Answered on 2026-10-17 (D188):

1. The HUD direction on the Feel Board (tokens, the dock, the card shop): **approved**.
2. The style: **pixel art**, anchored on 0-mem0ry's Post Apocalyptic Workshop Set (2.1). The
   style sheet is no longer the owner's job: the agent generates it through the image API (2.2).
3. Names, decided by the agent as asked, open to a later pass (a rename is a locale edit):
   **Workshop** for research, **Supply Drop** for the chest, **Album** for the collection,
   **Frenzy** for the tripped meter, **Lamp Oil** for the offline research.
4. The budget: 20-35 USD image API, 10 USD donation to 0-mem0ry, 2-5 USD TheLazyStone's
   post-apocalypse pack (outdoor props, commercial tier), the rest held. CraftPix is dropped:
   its packs are painted, not pixel.

Still owed: the two keys in `.env` (2.2). Nothing else blocks R2 Feel. The owner confirmed
chunky pixel (look A of the Pixel or Painted page) on 2026-10-17; D188's grid stands.

## 15. Open questions

- Should a survivor's trait work only while hired, or always once owned? (Proposal: while
  hired, so the run still matters.)
- Do gear slots open at stars (1 / 3 / 5) or all at once? (Proposal: all at once; fewer rules.)
- Should the nuke's drop tier depend on glass gained or on the Wipe Day count? (Proposal: glass
  gained, so a small blast never out-pays a Wipe Day.)
- Is the 2 h window too tight for the idler archetype at day 1? The simulator answers before
  R2 Feel's S1 closes.

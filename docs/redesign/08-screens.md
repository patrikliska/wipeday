# 08 Screens: the UX and visual spec

Status: proposal, 2026-10-07, awaiting the owner's approval (A3). It expands canon section 12 as
settled by the design director's resolutions (canon v2) and never overrides either. Rules live in
`packages/domain`, numbers in `packages/content/data` and every string below in
`packages/content/locale/en.json`; this file says how they look, read and move. Mechanics are
owned elsewhere: the run in 02-the-run.md, the nuke in 03-the-big-red.md, the tree in
04-blast-map.md, the meta layers in 05-meta-layers.md, the social layer in 06-friends.md, the
engineering in 09-architecture.md, numbers in 10-balance.md.

**Conventions.**

- Sizes are CSS px. The design viewport is **390 × 844** (`phone_*` shots, @3x). Desktop is
  1600 × 900.
- Wireframes: one character is about 10 px across and one line about 24 px down, so 390 px is the
  39 columns between the bars. Numbers in wireframes are illustrative but follow the P1 constants
  (resolutions section 1); 10-balance owns the real ones.
- Wireframe legend: `[[ Buy ]]` is the primary (signal orange, the crown); `[ Buy ]` is
  secondary; `{! Flip the lid !}` is danger style; `///` is a hazard frame; `( )` is a round
  button or a tree node; `^` is the crown mark; `##--` is a bar; `<` is back; `(x)` is a 44 px
  close button.
- Quoted copy is the proposed English string. Names marked (proposal) need the owner's pass.
- Phase tags (R1 to R7) say when a screen or element first ships (canon section 16).
  "Resolution 3.25" means item 3.25 of the design director's resolutions.

---

## 1. Layout

### 1.1 The phone frame

| Band | y (px) | Height | Holds |
| --- | --- | --- | --- |
| Top bar | 0-56 (+ safe top) | 56 | Supplies counter and `/s`, glass and scrap chips, menu |
| Scene | 0-464 | 464 (55%) | the target, base, lines, Kettle, sea, flotsam; the top bar floats over its sky |
| Buff pills | 64-92 | 28 | active buffs (Rally, Afterglow, Rush), left-aligned, not tappable |
| Action band | 412-456 | 44 | Big Red chip (left), hint pill (centre), Toolbelt foot (right) |
| Drawer, collapsed | 464-754 | 290 | handle (44) + three rows (80 each) + 6 px padding |
| Nav row | 754-810 (+ safe bottom) | 56 | five destinations |

The canvas fills the whole screen behind the HUD, as today. The camera places the stage in the
free area between the top bar and the drawer, reading both rects the way `hudInsets()` already
does for the map (`apps/web/src/scene/Scene.ts:87`).

**Camera (proposal, tuned by shots in R1).** Phones keep at least 880 world units across (D75
unchanged), so the whole base still fits. The ground line moves from 66% of the viewport to about
52% (y ≈ 442). The era target becomes a hero object drawn about 290 world units tall, which is
128 px at today's phone scale of 0.443, standing on a rise in front of the house with its centre
at y ≈ 338 (40%). The line spots are re-laid inside world x 430-1310 so a phone shows every line,
a sea strip of at least 60 px on the left, and the Kettle on the slope at the Signal's old spot
(`Scene.ts:225`, x 670).

**Wireframe 1: run 1 at 0:00.** Canon 4.9: the only text is "Tap the tree."

```
   0 +---------------------------------------+
     | [b] 0                             (=) |  counter and menu only
  56 +---------------------------------------+
     |                                       |
     |            .    dawn    .             |
     |                  /\                   |
     |                 /  \                  |  the Lone Pine, glowing,
     |                /    \                 |  centre y 338, 128 px tall
     |               /      \                |
     |              /________\               |
     |                  ||                   |
     | ~~~~~ _________/^^^^\_______ lean-to  |  three crew, a dead fire
     |~~~~~~~ beach                          |
     |           ( Tap the tree. )           |  hint pill, y 460
     |                                       |
     |                                       |
 844 +---------------------------------------+
```

No drawer, no nav row and no chips yet. The drawer slides up with its first row when 6 supplies
are reached (a few seconds in). The nav row stays hidden until its first destination unlocks
(resolution 3.7): Crew, at the first hire (Mara, about 0:41 in the P1 script, resolution 3.29).

**Wireframe 2: run 1 at 10:30, Stone era (final-phase build).**

```
   0 +---------------------------------------+
     | [b] 31.2M                         (=) |  top bar, 56
     |     +162k/s                           |
  56 +---------------------------------------+
     |                                       |
     |        .   cloud             gull     |
     |                  .-----.              |
     |  DO NOT         /  ORE  \       mast  |  target: Ore Seam,
     |  [pad]         |  SEAM   |     |  |   |  Hustle arc around it
     |  [drum]         \_______/   ___|__|_  |
     | ~~~~~~~ ____/^^^^^^^^^^^^\__ cabin    |  rise; base and lines
     |~~sea~~~ beach       x1.6              |  behind; Hustle label
 464 +=================[ -- ]================+
     | See all                               |  handle, 44
     +---------------------------------------+
     |(Ro) Hire Rook            ^ [[ Hire  ]]|  crowned hand row
     |     Loom runs without taps [[ 7.38M ]]|
     |                                       |
     +---------------------------------------+
     |[4]  Charcoal Kiln          [  Buy   ] |
     |[ic] (chr)####---- +60k/s   [  9.9M  ] |
     |     4/10 -> x2                        |
     +---------------------------------------+
     |[0]  Furnace                [ in 4m  ] |  not yet affordable
     |[ic] (ing)........          [  101M  ] |
     |     0/10 -> x2                        |
 754 +---------------------------------------+
     | Island Blast Map Crew Logbook Friends |  nav, 56
 810 +---------------------------------------+  safe area below
```

**The action band** (y 412-456) is shared. Left: the Big Red chip, under the Kettle it belongs
to. Centre: the hint pill (one line, at most 294 px when the Toolbelt is out, ellipsis). Right:
the foot of the Toolbelt column. Flotsam bobs along the waterline above the band (y 360-404) and
nothing in the band covers that strip.

```
     |  [Kettle]      (target)        (Rush) |  Toolbelt: 3 x 48 px,
     |  steam~                        ( 8m ) |  stacked at the right
     |  [drum]                        (Grit) |  edge, y 266-456
     |                                (Flare)|
     |/// ^ Big Red: +12 glass ///           |  chip, y 412-456
 464 +=======================================+
```

**Other sizes.** Below 740 px tall (Safari with its bars, about 390 × 664) the top bar is 52 px
and the collapsed drawer shows two rows. Landscape phones (520 px tall or less) get the desktop
arrangement with a 320 px column. Tablets in portrait keep the phone layout, drawer centred and at
most 600 px wide; the column layout starts at 1024 px wide with width/height at least 1.2.

### 1.2 The top bar

- **Supplies** (`[b]`, the lashed bundle): 32 px bold tabular numerals over a 13 px `/s` line.
  The block (at least 150 × 56) opens the Multipliers sheet (2.16); it is written outside React
  (4.4).
- **Glass chip** (shard, held glass, `×Glow`) opens the Blast Map. **Scrap chip** (gold, a small
  integer, R5) opens the Magnet card (2.17), which links to Crew, where scrap is spent. Scrap is
  recorded from R2 (3 for the first Wipe Day), but the chip appears only in R5 with its sinks
  (resolution 3.20). Each chip appears the first time its currency is above zero and is a 44 px
  tall button around a 20 px tile.
- **Menu** `(=)`, 44 × 44, opens Settings (2.15).

### 1.3 The scene band

- **The target**: a hit box fixed on screen (D48), its drawn bounds of at least 96 × 120 px plus
  12 px of slop, with no marker. Per tap it squashes 1.06 × 0.94 for 120 ms and sheds 3 particles.
- **Hustle**: a 4 px arc, 270° around the target, `--hustle-lo` at 0 to `--hustle-hi` at 100,
  with its multiplier (`×1.6`; ×2 at most, ×2.25 with nodes) in 12 px at the arc's end.
- **Buff pills**: under the top bar, 28 px, icon plus `×4 · 41s` and a draining underline; three
  at most, then `+2`. Not buttons: the counter opens the full list.
- **Flotsam** drifts in from the left along the waterline, with a 13 s ring timer and a 64 px
  fixed hit circle.
- **Scene buttons** (each at least 44 px on screen): the target, flotsam, Blowback crates (R6),
  the Kettle and drum (R2), the skiff (opens Upgrades), the Magnet (R5), a hand (its Crew row),
  the gull (R4: a poke that can find a Logbook page, resolution 3.14).

### 1.4 The shop drawer

- **Collapsed** (290 px): a handle and three rows: the crowned row first, then the next two by the
  advisor's score (payback, including time to afford). Rows reorder at most every 2 s and never
  within 600 ms of a touch on the drawer, so nothing moves under a finger.
- **Handle** (44 px): a grabber, "See all" on the left; from the second hand, a bulk button on the
  right cycling `×1 → ×10 → ×100 → Max` (44 × 44). Tapping "See all" or dragging up expands.
- **Expanded**: the drawer rises to y = 64 under the top bar, so the counter stays in view. The
  header holds the tabs **Lines** and **Upgrades** (44 px) and the bulk segmented control
  (`×1 · ×10 · ×100 · Max`, 4 × 72 × 44). Lines lists the era row first, then lines 1-14 in order
  with locked rows last. Drag down, tap the grabber or "Close" to collapse; Android back collapses
  too. Taps on the target need the collapsed drawer.
- **One crown per view** (resolution 3.25). When the advisor's pick is a purchase, that row is
  crowned in the collapsed and the expanded drawer. While the crown is on the Big Red, Blowback
  crates, a Toolbelt skill or the tap hint, the collapsed drawer shows no orange row, so the
  island shows exactly one crown. The expanded drawer is a separate sheet and always crowns one
  row: the pick if it is a purchase, otherwise the best payback (rule 6.3.1 as amended).

### 1.5 The nav row

Island · Blast Map · Crew · Logbook · Friends: 78 × 56 px, a 24 px icon over an 11 px bold label.
The current one has a 2 px top bar in `--text`, never orange. Blast Map shows its affordable
node count in glass green; Friends, Logbook and Crew show a white dot for something new. The row
is hidden at 0:00 and slides in when its first destination unlocks (resolution 3.7). From then on
a shipped but locked item is disabled and its tap toasts the reason ("The Blast Map opens after
your first Wipe Day."); an unshipped one is hidden (7.3). Island closes any panel. Panels sit
between the top bar and the nav row (y 64-754), so switching destinations is one tap.

### 1.6 The Big Red chip and the Toolbelt

- **Big Red chip** (R2): shown only while the advisor crowns the Big Red, which it never does for
  a small blast (resolution 3.1). Hazard frame, dark fill, a red dome glyph, the crown mark and
  two lines: "Big Red: +12 glass" over "9/h now · peak 14/h" (the first two times: "Flattens
  your island for crater glass."). It opens the cover card, as the drum does. It is never orange
  (12.3).
- **Toolbelt** (R5): at most three round 48 px buttons stacked at the right edge, an 11 px label
  under each ("Rush", "Grit", "Flare"). Cooling: a conic pie and the time left ("8m"). Ready: a
  white ring and a slow 2 px bob. Crowned: the crown mark. A skill not yet unlocked is absent, not
  greyed. Flare comes from the agenda at Wipe Day #15; with the `flare_gun` node a tap opens a
  small sheet to pick the flotsam kind it calls, shipped kinds only (resolution 3.11).

### 1.7 Desktop (1600 × 900)

The drawer becomes a permanent 420 px right column; the camera recentres in the free 1180 px
(the HUD-inset pattern, now with a right inset). One character is about 20 px across here.

```
+----------------------------------------------------------+--------------------+
| [b] 4.12Qa  +3.10T/s          [g 1,240 x15.2] [s 7] (=)  | Lines  | Upgrades  |
| (Rally x4 41s) (Afterglow x1.5 20m)                      | x1 x10 x100 Max    |
|                                                          | [Sheet Metal 20B ] |
|                cloud                     gull            | Beachcomber   ...  |
|   [Kettle]              (  ORE  )                        | Campfire      ...  |
|   [drum]                ( SEAM  )      cabin  furnace    | Garden        ...  |
| ~~~ sea ~~~  flotsam  ___/^^^^^\___    kiln   loom       | Loom          ...  |
|                                                 (Rush)   | Workbench     ...  |
| [/// ^ Big Red: +12 glass ///]                  (Grit)   | ...                |
|                                                 (Flare)  | Island Map Crew .. |
+----------------------------------------------------------+--------------------+
```

- The column has no collapsed mode; its nav row sits at its foot, and Crew, Logbook and Friends
  replace the shop inside it ("< Shop" returns).
- The Blast Map covers the scene area: the disk on the left, the selected sector's ladder and its
  clockwise neighbour side by side, the node sheet as a popover. Modals are centred, at most
  480 px wide. Nothing is hover-only.
- Keyboard: Space or Enter taps the target, holding Space is hold to work, B buys the crowned
  row, Escape closes the top sheet.

### 1.8 Sheets, modals and toasts

| Kind | Phone | Closes by |
| --- | --- | --- |
| Small sheet (node, Kettle card, Magnet, entry) | bottom, auto height up to 60% | `(x)`, swipe down, backdrop, Escape, Android back |
| Panel (Crew, Logbook, Friends, Settings) | between top bar and nav row | Island, `(x)`, Android back |
| Modal (welcome back, cover card, postcard, rebuild) | bottom-anchored card over a 55% dim, nav hidden | its own buttons only |
| Toast | under the top bar, two at most, 4 s | timeout, its button, swipe |

Every sheet pushes a history entry so Android back closes it. A read-only sheet has one primary,
"Done", which closes it (6.3.1 and 6.3.2).

---

## 2. Screens and overlays

### 2.1 Shop rows

Every row is 80 px tall (76 + 4 gap), 16 px side gutters, an 8 px grid inside.

```
     +---------------------------------------+
     |[12] Furnace                [  Buy   ] |  name 16 bold
     |[ic] (ing)######---  +498k/s [ 369M  ] |  product badge, cycle bar, rate
     |[Wr] 12/25 -> x2                       |  milestone 12 px muted
     +---------------------------------------+
```

- **Icon block** (48 × 48): the building icon, the owned count as a pill on its top-left, and on
  its bottom-right the hand's 20 px face when manned (a finger glyph when not).
- **Line 1**: the name, 16 px bold with ellipsis ("Charcoal Kiln" fits the 166 px left).
- **Line 2**: the **product badge** (20 px, amendment A1), the cycle bar in the era colour and
  the line's `/s`. A manned bar loops. An unmanned bar has a dashed track: a credited tap starts a
  cycle only while the line is idle, the bar fills over that one cycle and pays at its end even if
  tapping stopped, then sits empty and the rate reads "Idle · tap to run" (resolution 3.3,
  02-the-run.md 3.2).
- **Line 3**: the next milestone ("17/25 → speed ×2", "380/400 → ×4", past 1,000 "×2 every 100 ·
  next at 1,100"); "Runs while you tap" instead on unmanned rows until the second hire.
- **Buy button** (104 × 56): "Buy", "Buy ×10" or, under Max, "Buy 37", over the cost with the
  supplies icon. Not affordable: the cost dims and the top line becomes the time to afford ("in
  42s", "in 3h 10m", or "tap to earn" at zero rate). Crowned: orange with the crown mark.

**Other row kinds.**

| Row | Line 1 | Line 2-3 | Button |
| --- | --- | --- | --- |
| Hand | "Hire Mara" (portrait 48 px) | "Keeps the Beachcomber running, even while you're away." (first two hires), then "Beachcomber runs without taps" | "Hire" / "1.8k" |
| Era (pinned top of Lines) | "Stone era", 3 px frame in the tier colour | "Everything ×2 · Furnace, Tannery, Oil Press"; a bar to the cost: "31% · in 2m 10s" | "Buy" / "3M" |
| Upgrade | "Iron Tools" | "Taps ×2 · +0.4% of your /s per tap" (resolution 1.5) | "Buy" / "6k" |

A hand row sits directly under its line row, from the first unit of the line until the hand is
hired: one button and one price per row (errata E5).

**Locked rows** keep their real price and give one real reason (rule 6.3.3):

| State | Reason line | Button |
| --- | --- | --- |
| Next era's lines | "Opens in the Stone era" | lock glyph, base cost dimmed |
| The Armored era (R2; runs before Wipe Day #2) | "Opens after Wipe Day #2" | lock, "400T" |
| Line Mk upgrade | "Needs 25 Furnaces (12 now)" | lock, cost |
| Hand with no unit | (row hidden until the line has a unit) | |

Eras after the next one, and their lines, are not listed. When an era lands, the next three lines
appear locked with prices (canon 4.4).

### 2.2 The Upgrades tab

```
     +---------------------------------------+
     | Lines   [Upgrades 3]       x1 x10 Max |  tabs 44
     +---------------------------------------+
     |[ic] Iron Tools             [[  Buy  ]]|
     |     Taps x2 . +0.4% of /s  [[  6k   ]]|  crowned
     +---------------------------------------+
     |[ic] Campfire Mk II         [  Buy    ]|
     |     Campfire x3            [  9.6M   ]|
     +---------------------------------------+
     |[ic] Sorting Tables         [ in 1m   ]|
     |     Everything x2          [   1M    ]|
     +---------------------------------------+
     |[ic] Furnace Mk II          [ locked  ]|
     |     Needs 25 Furnaces (12 now)        |
     +---------------------------------------+
     | Bought this run (9)                 v |  folded
     +---------------------------------------+
```

Sorted by cost; icons tell the kinds apart (Grip the tool, a Line Mk the line's icon with a
chevron, island upgrades the skiff). A pocketed upgrade (R5) reads "In your Pocket" and is owned
from the first second of a run. "Bought this run" folds spent rows. The tab label carries the
affordable count; the skiff in the scene opens this tab.

### 2.3 The Crew panel

R1 ships the roster; ranks, the Foreman, Pockets and Dead Hand arrive in R5 (05-meta-layers.md
owns their rules).

```
  64 +---------------------------------------+
     | Crew                             (x)  |
     | 6 of 14 on shift . scrap 7            |
     +---------------------------------------+
     | (Ma) Mara . Beachcomber               |
     |      On shift . stays every Wipe Day  |
     |      Rank 2 ##--- x4 [ Rank 3 . 4 ]   |  disabled (R5)
     |      Every hand needs rank 2 first    |
     +---------------------------------------+
     | (Da) Dax . Campfire                   |
     |      On shift . stays every Wipe Day  |
     |      Rank 1 #---- x2 [[Rank 2 . 2 ]]  |  crowned (R5)
     +---------------------------------------+
     | (Gu) Gus . Ship Breaker               |
     |      Rank 1 . not hired this run      |
     +---------------------------------------+
     | AUTOMATION                            |
     | Foreman  buys the best-value   [ on ] |
     |          line while you play          |
     | Dead Hand  launch at [100%]    [ off] |
     | POCKETS                               |
     | [1 Rail Spur] [2 Pick >] [3 locked]   |
     +---------------------------------------+
```

- Status lines: "On shift", "Not hired this run · hire on the Lines tab", "Stays every Wipe Day"
  (kept by a milestone or node), "Armored era · not hired this run". Gus and Vera appear once
  the Armored era has been seen.
- **Ranks** (resolution 1.7): five pips and the line's multiplier, ×2 per rank ("×4" at rank 2),
  with "Rank 3 · 4 scrap". Ranks rise together: no hand may be two ranks above the lowest-ranked
  of the 14, so a blocked rank stays visible, disabled, with its reason ("Every hand needs rank 2
  first (9 to go)"). A hand never hired reads "Hire Gus once to rank him (Armored era)"; short of
  scrap, "Need 2 more scrap".
- **Foreman** and **Dead Hand** switches send `set_loadout` (resolution 3.15). Foreman: "Buys the
  best-value line once a second while the game is open." Dead Hand: launch at 25%, 50%, 100% or
  200% of glass ever, or "when crowned" (05-meta-layers.md 6, errata E12), under "Never fires while you're
  away." The Big Red's card shows the same switch.
- **Pockets** (resolution 3.10): three 44 px slots costing 5, 15 and 40 scrap. Slot 1 is
  available from Wipe Day #2; slots 2 and 3 come with the Scrapyard nodes `deep_pockets` and
  `sewn_lining`. A slot not yet available shows its real reason ("Needs Sewn Lining"); an
  available one, its price. An empty slot can be filled at any time from this run's or last run's
  shelf buys (never an era). A full slot can be swapped only before the run's first purchase,
  here or on the rebuild screen (2.8); after that it reads "Kept · change at the next rebuild".
- Primary: the crowned rank (the best share of income per scrap, 05-meta-layers.md 3), otherwise
  "Done".

### 2.4 The Kettle card and the cover card

**Before the first launch** (R2), the pad and drum appear at 500M supplies made in run 1 (about
minute 9-10 over seeds) and from the start of later runs (resolution 3.5, errata E2). Tapping
either opens the locked card, shown here at minute 10 of the P1 script:

```
     +---------------------------------------+
     | The Kettle                       (x)  |
     | Someone is building a rocket out of a |
     | boiler. The first launch needs 10     |
     | crater glass: 3 so far. That comes at |
     | 50B supplies made (now 500M).         |
     | ##########---------------- 3 / 10     |
     | "It's for emergencies." Dax           |
     | [[         Back to work             ]]|
     +---------------------------------------+
```

The bar shows the unfloored yield over 10, so it moves at every check-in. After the first nuke,
while the yield is 0: "Nothing to launch yet. The next glass comes at 2.3T supplies made (now
1.1T)." with the same bar. From a yield of 1 the drum opens the cover card.

**The cover card** (rule 6.3.4, danger style, hazard frame; never orange), here a crowned,
counted press:

```
     +///////////////////////////////////////+
     / Press the Big Red?               (x)  /
     / Wipe Day #4 . Saltmarsh               /
     /  +44 crater glass                     /  32 px, glass green
     /  Glow x2.58 -> x3.29                  /
     /  +44 now . 31/h now . peak 38/h       /
     /  Counts as Wipe Day #4.               /
     /  Wipe Day #4 unlocks: Toolbelt: Rush  /
     /                                       /
     /  KEPT                                 /
     /  Glass, Glow and 14 Blast Map nodes   /
     /  Logbook and Morale . scrap, ranks    /
     /  Mara, Dax, Ivo (they stay)           /
     /  LOST                                 /
     /  412T supplies . 412 line units       /
     /  23 upgrades . Sheet Metal . 6 hands  /
     /                                       /
     /  {!        Flip the lid           !}  /  danger
     /  [            Not yet              ]  /
     +///////////////////////////////////////+
```

- **Which press it is** (resolution 3.1): the second line is "Wipe Day #4 · Saltmarsh" with
  "Counts as Wipe Day #4." under the gain, or "A small blast · Saltmarsh". The unlock line names
  what **this** press unlocks; the postcard names what the next Wipe Day unlocks (resolution 3.6).
- **Small blast** (the gain adds under 10% to glass ever): no unlock line; a `--warning` note in
  its place: "Small blast: +6 is 7% of your 84 glass. It pays its glass but isn't a Wipe Day: no
  unlocks, no news, no crates for friends. Wipe Day #5 needs +9." The advisor never crowns one, so
  only the drum opens this card.
- **Counted, not crowned** (resolution 1.9): "Waiting pays more: at +84 glass (in about 2h) this
  launch doubles your glass ever." The crown comes at doubling, when the run's glass rate falls
  below 80% of its peak, or once the run is 20 h old.
- **The first launch** is crowned at a yield of 10: "Wipe Day #1 unlocks: the Blast Map, Glow and
  Afterglow"; KEPT names no hands. Loadout, Pocket and Dare choices wait for the rebuild screen.
- Late Tide (R6): "Late Tide ×3 included" under the gain when it applies (resolution 1.8). Dead
  Hand (R5): its switch at the foot. KEPT and LOST list only shipped systems; the notes (a buff
  ending, flotsam sinking, crates staying) are 03-the-big-red.md 5.2's.

### 2.5 Hold to launch

"Flip the lid" flips the toilet-seat lid up (250 ms) and the card's lower half becomes the button:

```
     /  "I *just* fixed the roof."  Dax      /  one-liner, one per hold
     /                                       /
     /             .---------.               /
     /           /  ///////  \               /  hazard ring = progress
     /          |    BIG     |               /  dome 120 px, #d8261c
     /          |    RED     |               /
     /           \  ///////  /               /
     /             '---------'               /
     /          Hold to launch               /
     /          Let go to cancel             /
     /  [            Not yet              ]  /
```

- The ring fills over 2 s of real time with the siren; Android pulses in tightening steps.
  Letting go drains the ring in 300 ms, winds the siren down and shows a relief line ("Phew.").
  Keyboard: hold Space or Enter.
- One-liners: 03-the-big-red.md 6 (twelve, spoken by a hand hired this run, never repeating
  within six holds).
- At 100% the HUD fades in 200 ms and the cinematic starts; the command goes at once and the
  cinematic plays before the answer (canon 13.2).

### 2.6 The cinematic (summary)

03-the-big-red.md 7 owns the beats, timings and variants. The screen side, with the U-Turn's
times (`I` is the impact, 4,100 ms; 2,600 for Fizzle):

| Phase id (pinnable) | At (ms) | On screen |
| --- | --- | --- |
| `scramble` | 600 | HUD gone; crew sprint to the rowboat, one runs back for the toaster |
| `ignite` | 1,100 | the Kettle shudders and coughs |
| `liftoff` | 1,500 | smoke trail, exhaust glow on `lights` |
| `flight` | 2,800 | the seeded variant: `u_turn`, `loop_the_loop`, `sputter_drop` in R2; small blasts always `fizzle` |
| `whistle` | I − 400 | back down onto the base |
| `flash` | I + 40 | white CSS overlay over everything |
| `fireball` | I + 400 | fireball on `lights` (D47), shake, burnt-orange tint |
| `cloud` | I + 1,400 | puff-sprite mushroom cloud |
| `settle` | I + 2,500 | the crater and glass; on a Wipe Day the "WIPE DAY #N" sign drops in; the postcard slides up |

- "Skip" (secondary, top right, 44 × 44, from Wipe Day #2) fades in after 400 ms and jumps to
  `settle`. A tap elsewhere does nothing, so a nervous thumb cannot skip the first one.
- Reduced motion: no shake, no flash; 2.5 s of cross-faded stills (the Kettle mid-air, the
  crater with a still cloud).
- Every phase can be pinned for `web:shots` (8.1).

### 2.7 The postcard

```
     +---------------------------------------+
     | GREETINGS FROM GROUND ZERO            |  front, 3:2, satori-safe
     |     .-~~~~~~~~~~~~~~~~-.              |  layout (flexbox, SVG)
     |    (   crater, green    )  [WIPE      |
     |     '-..____________..-'   DAY #3]    |
     | Saltmarsh                             |
     +---------------------------------------+
     | Run time            47m 12s           |  back, flips in at 1.5 s
     | Crater glass        +25 (47 ever)     |  (tap to flip again)
     | Glow                x2.17 -> x2.71    |
     | Best line           Furnace, 41%      |
     | Flotsam caught      7                 |
     | Flight              Loop-the-Loop     |
     | Era reached         Sheet Metal       |
     | NEXT  Wipe Day #4 unlocks Toolbelt:   |
     |       Rush                            |
     | [[             Rebuild              ]]|
     | [ Blast Map . 5 affordable ]          |
     +---------------------------------------+
```

- After Wipe Day #1 the only button is **Open the Blast Map** (the primary, on the advisor's
  pulsing pick; errata E6). From the second, the primary is **Rebuild**, with "Blast Map · 5 affordable" as
  secondary when nodes are affordable.
- Until Rebuild, the island is the crater and the Blast Map's back button reads "< Rebuild": after
  Wipe Day #1 it lands the rowboat at once; later it returns to the rebuild card, or to the
  postcard when there is none. The way back is always one tap.
- **NEXT** names what the next Wipe Day unlocks (resolution 3.6), shipped content only (canon
  5.8); when the next count unlocks nothing shipped, it names the next count that does.
- **A small blast's postcard** is "Postcard from a Puddle of Glass": the Fizzle flight, no new
  sign number, and a first back line "Small blast · Wipe Day #5 still needs +9 glass".
- The front uses flexbox and inline SVG only (`postcardSvg`, 03-the-big-red.md 8.1), so R6 can
  draw the same picture in the bot's satori pipeline (apps never import each other).

### 2.8 The rebuild screen

The scene shows the crater under the Afterglow sky; the card sits at the bottom.

```
     +---------------------------------------+
     | Rebuild Saltmarsh                     |
     | Wipe Day #12 . the crater is 3.5 m    |
     | KEYSTONES  1 slot                     |
     | [ Wipe Day Rush             Change > ]|
     | POCKETS  2 slots                      |
     | [ Rail Spur . all x2        Change > ]|
     | [ Empty                       Pick > ]|
     |   Slot 3: needs Sewn Lining, 40 scrap |
     | DARE  optional                        |
     | [ No Dare                     Pick > ]|
     | You keep 1,240 glass, 63 nodes, Mara, |
     | Dax and Ivo.                          |
     | [[             Rebuild              ]]|
     | [ Blast Map . 2 affordable ]          |
     +---------------------------------------+
```

- Shown only when it offers a choice: keystones from Wipe Day #10 (R3), Pockets once a slot is
  owned (R5, slot 1 from #2), Dares from #5 (R7). Without any, the postcard's "Rebuild" lands at
  once.
- **Keystones**: "Change" opens a picker (owned keystones, one per slot, three slots at most,
  resolution 3.9), each with its rule and its cost: "Afterglow holds ×5 for 60 min, then fades;
  Night Shift window halved".
- **Pockets** (resolution 3.10): a full slot shows its upgrade and "Change", an empty one "Pick";
  both open a picker of last run's shelf buys by suggested value, its top row crowned with "Pocket
  it" (05-meta-layers.md 4). The next slot not yet available shows its real reason. Swaps are free
  here and until the run's first purchase.
- **Dare**: "Pick" opens the Dare list with constraint, goal and reward in full.
- Rebuild: the rowboat lands, a sapling pokes out of the glassy crater, a lean-to pops up, and
  the Afterglow pill appears, "Afterglow ×3 · 30m", frozen until the first tap starts it
  (resolution 3.2).

### 2.9 The Blast Map overview

```
  64 +---------------------------------------+
     | < Island    BLAST MAP     [g 1,240]   |
     | Glow x15.2 . 63 of 201 lit            |
     | [Affordable 5][Taps][Offline][Auto]>  |  chips 44, scroll hint
     |               .  .  .  .              |
     |          .   ring 5 opens at  .       |
     |       .      Wipe Day #10        .    |
     |     .   \  GRIP  |  CREW   /   .      |  8 wedges, shipped rings;
     |    .  TIDE \   .-+-.   / WORKS  .     |  owned dots glow green,
     |    .  ------  ( GZ )  ------    .     |  wedges show fill and
     |    . BUNKER /  '-+-'  \ BLAST   .     |  affordable counts
     |     .   /  LOGBOOK | SCRAPYARD  .     |
     |       .         3      2      .       |
     |          .                .           |
     |               .  .  .  .              |
     | ^ Lucky Swing . Grip ring 3   77 glass|  the advisor's pick
     |   5% of taps crit x10                 |
     | [[           Buy . 77 glass         ]]|
 754 +---------------------------------------+
```

- An SVG disk about 370 px across: every node a 6 px dot, owned dots glass green, affordable ones
  ringed; each wedge shows its glyph, a fill arc and an affordable count, and opens its ladder.
- Locked rings are dashed with their gate along the ring; unshipped rings are not drawn and the
  lit count counts shipped nodes only (resolution 3.8: 73 in R2; 178, 191 and 201 through R3-R5;
  361 in R7).
- The pick card buys in place, with cost and effect shown first (rule 6.3.4). After the first
  nuke the map opens here with Ground Zero lit and the pick pulsing.
- Filter chips dim non-matching dots and narrow the pick; a right-edge fade shows the chip row
  scrolls (the open W3 item about sideways tabs).
- Late Tide (R6): when it applies, the header adds "Late Tide ×3", which expands to "You're below
  half your friends' middle glass ever (1,950). Wipe Days pay triple, never past 1,950." Only the
  player sees it: it never appears on boards, in the feed, in Visit or on any other shared surface
  (06-friends.md, errata E19).

### 2.10 The sector ladder

```
  64 +---------------------------------------+
     | < Map       (G) GRIP 5/25      <   >  |
     | Taps, Hustle, crits, Afterglow        |
     +---------------------------------------+
     | RING 4 . opens at Wipe Day #5         |
     |  ( )     ( )     ( )     ( )          |  dim, lock glyphs
     | RING 3 . 25-75 glass                  |
     |  (^)     (o)     (o)     ( )          |  ^ pick pulses orange
     | Lucky   Quick   Second  Split         |
     | Swing   Hands   Wind    Wood          |
     |   \       |      /                    |
     | RING 2 . 4-10 glass                   |
     |  (#)     (#)     (#)                  |  owned, filled green
     | Firm    Callus  Warm                  |
     | Grip    Pads    Up                    |
     |      \    |    /                      |
     | RING 1 . 1-2 glass                    |
     |      (#)          (#)                 |
     |   Calloused     Steady                |
     |     Hands       Swing                 |
 754 +---------------------------------------+
```

- Ring 1 at the bottom, opened at the lowest unfinished ring. At most 4 nodes per row, 56 px
  with two-line 11 px labels; rings of 5-7 wrap (3 + 2, 3 + 3, 4 + 3). Vertical scroll only.
  Node names here are placeholders (04-blast-map.md names them). Swipe or `<` `>` for the next
  sector. The header's count is of shipped nodes (Grip has 25 through rings 1-6).
- Node looks: locked (30% outline, lock); reachable (outline, cost under the label); affordable
  (glass-green ring, soft glow); the pick (orange ring, crown mark, a pulse every 1.6 s, one per
  map); owned (filled glass green); a slotted keystone adds a white outer ring.
- Frames, canon 17's five: circle (small stat), double ring (notable; completion adds a lit-ring
  badge, 04-blast-map.md 2.1), hexagon (keystone), rounded square (unlock), cog ring
  (automation). Edges are 2 px glass green along owned paths, 1 px `--border` elsewhere.

### 2.11 The node sheet and path buying

```
     +---------------------------------------+
     |                ----                   |
     | (^) Lucky Swing                  (x)  |
     |     Notable . Grip ring 3             |
     | 5% of your taps crit for x10.         |
     | Now: about +45% tap income            |
     | (+1.9M per tap on average)            |
     | 77 glass . you'll have 1,163 left     |
     | [[          Buy . 77 glass          ]]|
     +---------------------------------------+
```

- The effect is always in current numbers ("+38k/s now"). The ladder scrolls so the node sits
  above the sheet.
- Not affordable: Buy disabled, "Need 412 more glass". Ring gate: "Ring 4 opens at Wipe Day #5 (2
  to go)", no button.
- Far node: the path lights up on the ladder and the primary reads "Buy path · 4 nodes · 1,240
  glass"; if only part is affordable, "Buy the first 2 · 300 glass".
- Keystone (resolution 3.9): "A keystone works only when slotted." With a free slot: "It slots
  itself as soon as you buy it." With every slot in use: "Your 1 slot is in use. Swap keystones on
  the rebuild screen."
- Buying is predicted instantly (D64): the node fills, a glass chime, shards fly from the chip.

### 2.12 The Logbook (R4)

```
  64 +---------------------------------------+
     | Logbook                          (x)  |
     | 84 entries . Morale x2.68             |
     | ####################---- 16 more for  |
     | 1 scrap                               |
     +---------------------------------------+
     | The island 22/40     Eras 9/10        |  chapter list, 44 px
     | Flotsam 11/18        Flights 4/12     |  rows (not tabs)
     | Wipe Days 14/30      Secrets 3/30     |
     +---------------------------------------+
     | [tree] [rock] [ore ] [ ?? ] [vent]    |  72 px tiles, icon and
     | Fell   Crumb  Rich   ???    Pop       |  a two-line name
     | 100    500    vein          goes      |
     +---------------------------------------+
     | Flotsam odds: crate 45% . fuel drum   |  printed (guardrail 9)
     | 40% . adrenaline 6% . drone 7% ...    |
     +---------------------------------------+
```

- Tapping an entry: "Fell 100 trees · logged on Wipe Day #3 · Morale +2%". A secret shows "???"
  and, after nuke 15 (earlier with `old_maps`), one hint line: "Something about a storm and a
  launch."
- Shared first finds carry the finder's name: "First found by Hollis".
- Primary: "Done". A new entry adds a white dot to the nav item and a floater "Logbook +1".

### 2.13 Friends

Tabs: Feed (R2) · Boards (R6) · Freighter (R6). Unshipped tabs are hidden.

```
  64 +---------------------------------------+
     | Friends                          (x)  |
     | [Feed]  Boards  Freighter             |
     +---------------------------------------+
     | (Pa) Patrik pressed the Big Red.      |
     |      Wipe Day #4 on Saltmarsh: +12    |
     |      crater glass.        2h  [card]  |
     | (Ho) Hollis found a Logbook secret    |
     |      first. Hint: "The gulls are       |
     |      keeping score."              5h  |
     | (me) Your blast washed 9 crates onto  |
     |      3 islands.                   1d  |
     +---------------------------------------+
     | Saltmarsh has been nuked 214 times.   |
     | Next at 250: a gold lid.              |
     +---------------------------------------+
```

- **Feed**: canon 8.1 lines for counted Wipe Days only; small blasts post nothing and add nothing
  to the Island Count or the boards (resolution 3.1). From R6 nuke rows carry a postcard
  thumbnail. A name opens Visit. A feed line never names a secret: a first find gives the finder and the
  secret's hint, never its name (06-friends.md 2.3; errata E19).
- **Boards**: one card per board (canon 8.6) with the top three and your rank, and a "This month ·
  All time" switch; ties share a rank. Late Tide is never shown here.
- **Freighter**:

```
     | The Freighter . aground since Monday  |
     | hull  [####|#####|---]  2.6 loads avg |
     |        I     II    III                |
     | I and II reached: +2 scrap for you    |
     | You: 4 of 6 loads left this week      |
     | [[  Load . 1 h of output . 11.2Qa  ]] |
```

  The load button shows its cost in the player's own supplies (one hour of current output,
  resolution 3.23); the hull fills with drawn crates. Each tier reached pays 1 scrap to every
  loader. At 6 loads: "Done for this week · back Monday".
- **Visit** (R6 stretch): the friend's island in the scene, read only, with a header "< Back ·
  Hollis · Wipe Day #31 · Sheet Metal" and a bottom card (hands, Kettle stage, crater sign,
  loadout, nodes lit). No drawer, no taps.
- Primary: on Freighter, "Load" while loads remain; otherwise "Done".

### 2.14 Welcome back

After an hour away (canon 12.6), one card, one **Collect**. The counter keeps its old value until
Collect, then the gain flies in.

```
     +---------------------------------------+
     | Welcome back                          |
     | Away 2d 3h                            |
     | [n] Your hands worked the Night Shift |
     |     (12 h of it): +4.2T supplies.     |
     | [s] The Magnet hauled up 2 scrap.     |
     | [c] 3 friends nuked their islands:    |
     |     9 crates are waiting on your      |
     |     shore.                            |
     | [l] Logbook +2.                       |
     | [[            Collect               ]]|
     +---------------------------------------+
```

`[n]` is the `night_shift` icon, needed in R1 (resolution 3.22).

| Case | Lead line |
| --- | --- |
| Window not full | "Away 7h 12m. Your hands worked the whole time: +1.2T supplies." |
| Window full | "Away 2d 3h. Your hands worked the Night Shift (12 h of it): +4.2T supplies." |
| No hands | "Away 3h. Nobody was on shift: lines without a hand only run while you tap." Primary "Back to work", and the advisor crowns a hand row |

- The card has no other way out: Escape and the backdrop also collect, so a gain is never lost.
- Collect runs the Foreman's pass (R5), which keeps the crowned purchase's price in reserve
  (resolution 1.10); its buys show as one floater stack ("Foreman bought 38 lines"). The nuke is
  never this card's primary (12.3).

### 2.15 Settings

```
  64 +---------------------------------------+
     | Settings                         (x)  |
     | Sound                         [  on ] |
     | Volume        ------------o---        |
     | Vibration (this phone)        [  on ] |  Android only
     | Numbers   [ 1.23Qa ]  [ 1.23e15 ]     |
     | Motion  [Match device][Reduced][Full] |
     | NOTIFICATIONS ON THIS DEVICE  [  on ] |
     | Night Shift over              [  on ] |
     | Magnet full                   [ off ] |
     | A friend pressed the Big Red  [ off ] |
     | Freighter tier reached        [ off ] |
     | Quiet hours 22:00-08:00       [  on ] |
     | Patrik . [ Log out ]                  |
     | How it works >  Odds >  Wipe Day v2.0 |
     | [[             Done                 ]]|
     +---------------------------------------+
```

- Each notification kind has a one-line sub: "When your hands stop because the window is full."
  Kinds ship with their systems (Magnet full R5, Freighter R6). On iPhones without the Home Screen
  install, today's message from `net/push.ts` stays.
- **Quiet hours** (resolution 3.23, errata E19), on by default: "Pushes wait until 08:00 (this browser's
  time)."
- **Odds** (R1): a read-only sheet with the flotsam kinds and their chances (shipped kinds only)
  and, from R5, the Magnet's. Guardrail 9 needs them printed from the first build; the Logbook
  repeats the flotsam line from R4 (errata E8).
- **How it works** is the only help, six lines, never required; each ships with its system (line
  5 from R2):
  1. "Tap the target for supplies. Hold to keep working."
  2. "Buy lines. A line without a hand only runs while you tap."
  3. "Hire a hand and the line runs on its own, even while you're away."
  4. "Eras double everything and bring new lines."
  5. "The Big Red flattens your island for crater glass. Glass buys Blast Map nodes, kept forever."
  6. "Tap the supplies counter to see every multiplier."

### 2.16 The Multipliers sheet

Tapping the counter. The rows follow the evaluator's fixed order (canon 13.5); each row expands
to its sources.

```
     +---------------------------------------+
     | Supplies per second    3.10T/s   (x)  |
     | Lines, 412 units          1.22B/s     |
     | Flat bonuses              +0          |
     | Milestones                x96       > |
     | Bonuses                   +250%     > |
     | Multipliers               x16       > |
     | Glow (3,240 glass ever)   x15.2       |
     | Morale (84 entries)       x2.68       |
     | Buffs: Rally              x4 . 41s    |
     +---------------------------------------+
     | Per tap                   1.9M        |
     | Grip: 8 + 1.2% of your /s             |
     | Hustle x1.6 . Afterglow x1.5          |
     +---------------------------------------+
     | Night Shift: 12 h. If you leave now,  |
     | your hands work until 09:14.          |
     | Unmanned lines run only while you tap.|
     | [[             Done                 ]]|
     +---------------------------------------+
```

### 2.17 Smaller overlays

- **Refusal toast** (rule 6.3.5; rare, since buttons disable first): "Need 1.2M more supplies."
  with the button "Tap the ore seam", which closes sheets and pulses the target.
- **Flotsam claimed** (resolution 1.6): a Drift Crate pays `max(1 min, min(15% of held, 10 min))`
  of output, so its floater names the minutes paid ("+2 min of supplies" for run 1's guaranteed
  3:00 crate, which pays a flat 2 minutes, errata E1), then the amount ("+1.2M"). Missed: "It
  sank. More drifts in every few minutes." (run 1's crate: "It sank. Another one drifts in within 3 minutes."). Rally: pill "Rally ×4 ·
  60s" and a floater; Adrenaline: "Taps ×100 · 12s". Catching a kind that is running restarts its
  timer.
- **Friend toast**: "Hollis pressed the Big Red. 3 crates washed up on your shore." with "Show",
  which pans to the crates.
- **The Magnet card** (R5; the crane or the scrap chip opens it): its four states (growing, early,
  sure, tray) and copy are 05-meta-layers.md 2.5's. "Haul early" is secondary; "Haul" and "Take
  it" are primaries; growing has none.
- **Agenda unlock** (after a rebuild): a toast once per unlock: "New: hands for lines 1-3 stay
  through Wipe Days."

### 2.18 Rule check per screen

| Screen | The one primary | Closes or goes back by |
| --- | --- | --- |
| Island | the crowned row, chip, crates or skill; the tap hint otherwise (one crown, resolution 3.25) | (home) |
| Drawer, expanded | the crowned row | Close, drag, back |
| Crew | the crowned rank, else Done | `(x)`, Island, back |
| Kettle card | Back to work | `(x)`, backdrop |
| Cover card | none: "Flip the lid" is danger | Not yet, `(x)` |
| Hold | the Big Red itself | Not yet, release |
| Postcard | Open the Blast Map / Rebuild | its buttons |
| Rebuild | Rebuild | Blast Map and back |
| Pocket or keystone picker | Pocket it / Slot it | `(x)`, back |
| Blast Map overview | Buy the pick | `< Island` (`< Rebuild` while a crater) |
| Ladder / node sheet | Buy (or path) | `< Map`, `(x)` |
| Logbook, Settings, Multipliers | Done | `(x)`, back |
| Friends | Load (Freighter), else Done | `(x)`, Island |
| Magnet card | Haul / Take it, else none | `(x)`, backdrop |
| Welcome back | Collect | Collect, backdrop |

---

## 3. The visual language

### 3.1 Colour tokens

Changes to `apps/web/src/styles/tokens.css` (values are proposals; shots tune them). The orange
primary and the contrast fixes (`--muted`, `--panel-glass`) ship together as one R1 decision
(resolution 3.26).

| Token | Today | Proposal | Use |
| --- | --- | --- | --- |
| `--accent`, `--accent-glow` (lines 24-25) | `#cd412b`, red glow | removed; replaced by `--primary*` | |
| `--primary` | | `#f27a1a` signal orange | the crown: one button per view |
| `--primary-hi` / `--primary-lo` | | `#ff9a3c` / `#e46c12` | its gradient |
| `--primary-glow` | | `rgba(242, 122, 26, 0.5)` | its pulse |
| `--on-primary` | | `#1b1a18` | text on orange (dark, see 6.3) |
| `--big-red` / `--big-red-hi` | | `#d8261c` / `#ff4a3d` | the dome and the chip glyph only |
| `--danger` | `#f05252` | unchanged | destructive actions |
| `--hazard` / `--hazard-ink` | | `#ffd21f` / `#1b1a18` | hazard frames |
| `--glass` / `--glass-hi` / `--glass-deep` | | `#5fd38a` / `#a8f0c0` / `#1f7a4a` | crater glass, owned nodes |
| `--scrap` / `--scrap-hi` | | `#e6b44c` / `#ffe08a` | the scrap chip |
| `--afterglow` | | `#c3ef4a` | the Afterglow pill and HUD tint |
| `--hustle-lo` / `--hustle-hi` | | `#ffe7a8` / `#ff8c2a` | the Hustle arc |
| `--buff` | | `#ffc95c` | buff pills, Rally floaters |
| `--panel-glass` | `rgba(27,26,24,0.78)` | `rgba(27,26,24,0.86)` | contrast over bright skies |
| `--muted` | `#a49e93` | `#b5afa4` | contrast (6.3) |

Changes to `apps/web/src/styles/hud.css`:

| Line | Rule | Change |
| --- | --- | --- |
| 213-221, 238-250 | `.action.primary`, `@keyframes pulse` | the dock goes; the pulse moves to `.btn.primary.crowned` with `--primary-glow` |
| 401-406 | `.btn.primary` | `linear-gradient(180deg, var(--primary-hi), var(--primary-lo))`, `color: var(--on-primary)`, shadow `0 6px 18px rgba(242,122,26,0.4)` |
| 422-428 | `.progress > i` | default `var(--bar-color, var(--text))`; cycle bars set the era colour |
| 657 | range `accent-color` | `var(--primary)` |
| 951 | `--tier-color` fallback | `var(--muted)` |
| 985-988 | `.tab.on` (amber) | neutral: `rgba(236,232,223,0.14)` fill, `--text` border, so orange stays the crown's |
| 1121-1131 | `.crewchip.primary` | removed with the crew chip |
| 1182-1190 | `.clockchip .dot` (`#e0563d`) | becomes the nav's white unseen dot |
| 1591-1599, 1869-1872, 2004 | jackpot, raid alert, season line | removed with their systems |
| 1904-1915 | `.btn.danger` | kept; used by "Flip the lid" |

### 3.2 Red and hazard

Red means two things only: the Big Red and danger (destructive actions). Warnings, such as the
small-blast note, use `--warning` amber. **Hazard frames** (yellow and black 45° stripes, 7 px
each, a 3 px border) are reserved for the Big Red chip, the cover card, the hold ring, the Kettle
card and the Dead Hand switch. Errors are never hazard-framed.

```css
.hazard {
  border: 3px solid transparent;
  background:
    linear-gradient(var(--panel), var(--panel)) padding-box,
    repeating-linear-gradient(-45deg, var(--hazard) 0 7px, var(--hazard-ink) 7px 14px) border-box;
}
```

### 3.3 Era colours

The five tier tokens stay exactly as they are (`--tier-twig #c2a868`, `--tier-wood #b07840`,
`--tier-stone #9aa0a6`, `--tier-metal #6c97bc`, `--tier-hqm #45c2c0`) and mean the era everywhere:
the base, the era row's frame, cycle bars, the era badge, the postcard's era line. Timber's
`#b07840` is 4.08:1 on the panel, so era colours tint bars, frames and swatches, never small
text. The Blast Map's sectors have no hues; glyphs tell them apart and glass green means owned.

### 3.4 Typography

Roboto Condensed only (400 and 700), as today. Numbers use the existing `.num` rule
(`font-variant-numeric: tabular-nums`, `hud.css:42`); R1 checks in shots that the counter's
digits do not shift between frames.

| Role | Size / weight | Where |
| --- | --- | --- |
| Counter | 32 / 700 (40 desktop) | top bar |
| Big numbers | 32 / 700 | cover card gain, postcard |
| Titles | 20 / 700 | sheets, panels |
| Row names, buttons | 16 / 700 | drawer, sheets |
| Body | 14 / 400 | cards |
| Meta | 12 / 400, `--muted` | rate, milestone, sub-lines |
| Smallest | 11 / 700 | nav labels, node labels, Toolbelt labels |
| Floaters | 22 / 700 (tap 26, lines 16) | scene, screen space (D46) |

Uppercase with 0.06em tracking only for section heads ("KEPT", "RING 3") and the postcard front.

### 3.5 Numbers

One formatter for the web and the bot (canon 13.1): three significant digits, suffixes k, M, B,
T, Qa, Qi, Sx, Sp, Oc, No, Dc, then `1.23e36`.

| Value | Counter | Elsewhere | Scientific setting |
| --- | --- | --- | --- |
| 847.6 | `847` | `847` | `847` |
| 1,800 | `1.80k` | `1.8k` | `1.8k` |
| 31,234,567 | `31.2M` | `31.2M` | `3.12e7` |
| 1.2e15 | `1.20Qa` | `1.2Qa` | `1.2e15` |
| 9.99e35 | `999Dc` | `999Dc` | `9.99e35` |
| 1.234e36 | `1.23e36` | `1.23e36` | `1.23e36` |

- The counter keeps trailing zeros so its width does not jump; elsewhere they are trimmed. The
  scientific setting starts at 1e6.
- Rates: `0.4/s`, `8.25/s`, `45/s`, `+3.1T/s`. Multipliers: `×2`, `×2.35`, `×117`, `×1.23k`.
- Glass: grouped integers to 99,999 (`2,154`, `7,777`), then suffixes (`222k`, `7.77M`). Scrap,
  counts, entries and nukes: grouped integers.
- Durations: today's `duration` (`packages/domain/src/words.ts`) gives `45s`, `3m`, `3h 20m`,
  `2d 4h`; R0 extends it to show seconds under 10 minutes (`2m 10s`), since active timers count
  seconds.
- The `×` sign is U+00D7 everywhere, never the letter x.

### 3.6 Icons in the UI

- One icon per thing, from `packages/content/icons/<kind>/<id>.svg` (canon 17, resolution 3.22),
  drawn in `currentColor`. Sizes: 16 (inline), 20 (chips, product badges), 24 (nav), 48 (rows,
  sheets). The `Tile` placeholder (`hud/Icon.tsx`) stays the fallback, so a missing icon never
  breaks a row.
- **Product badges** (amendment A1): the same icon appears in the row's line 2, on the line's
  floater and as the product drawn in the scene. 02-the-run.md fixes the mapping.
- UI glyphs that are not entities live in one small set: the crown mark, lock, finger (unmanned),
  pocket, chevron, close, menu, and the five nav icons. 07-what-changes.md tells the owner what
  to draw.

### 3.7 Scene palette additions (`scene/palette.ts`)

| Palette | Values | Use |
| --- | --- | --- |
| `AFTERGLOW` | 03-the-big-red.md 9.3 (horizon `#cfe8a0`, ambient `#d8f0c0`) | mixed over the time of day, clearing over 10 min from the landing; ×0.6 at night |
| `BURNT` | tint `#d86a4a`, then ash `#8a6f7e` (03-the-big-red.md 7.2) | the cinematic from the flash |
| `ASH` | weather mode, grey flakes `#b8b8b0` / `#8a919c` | falls while the sky is green |

The target gets a rim light on the `lights` layer (D47) so it reads at night and in fog.

---

## 4. Juice and performance

### 4.1 Feedback map

Every tap changes something within one frame (rule 6.3.7).

| Event | Scene | Floater | Sound | Android |
| --- | --- | --- | --- | --- |
| Tap | squash, 3 particles, Hustle arc | running "+38" at the target | `tap` | none |
| Crit (R2+) | white spark | gold "+380!" | `crit` | none |
| Fell | fall, crumble, split, pop or burst; new target in 0.3 s | "Timber! +380" gold | `fell` | 20 ms |
| Line cycle | product appears at the building | "+1.2k" with product icon flies to the counter | none | none |
| Buy | building pops, count pill ticks | none | `buy` | none |
| Milestone | building redraws at 25 and 100 | "Beachcombers ×2" gold | `milestone` | 15-40-15 |
| Hand hired | the hand walks to the line | "Mara's on it" | `hand` | none |
| Era | base pop in the tier colour, target swap | "Stone era · ×2" gold | `era` | 30-50-30 |
| Flotsam | splash, coins | "+10 min of supplies" | `flotsam_claim` | 15 ms |
| Node bought | shards fly to the node | none | `glass` | none |

### 4.2 Floaters

- **Pooled `BitmapText`**: one bitmap font installed at start from Roboto Condensed Bold at twice
  the largest size, with the 20% ink stroke baked in, covering printable ASCII and `×`. A pool of
  16 objects, at most **12 live**; when full, the oldest fast-forwards its fade (today's
  `retire`).
- **Merging**: a tap within 250 ms of the last adds to the running floater at the target ("+1.2k"
  grows, with a 1.12 scale pop for 120 ms). It lives until 500 ms after the last tap, then rises
  40 px and fades over 600 ms.
- **Lines**: at most one floater per line every 2 s (cycles merge), and only the four lines with
  the biggest payout send one. They fly from the building to the counter on a 700 ms ease-in
  curve; the counter bumps (scale 1.04), at most four times a second.
- Priority when the pool is full: fell, era and milestone, then flotsam, then taps, then lines.
- Reduced motion: floaters fade in place, no rise and no pop.

### 4.3 Particles

A pool of 200 sprites, at most **160 live**; nothing is allocated in the frame loop. Bursts: tap
3, fell 24, buy 8 dust, flotsam 16 coins, era 40. Over the cap, new bursts spawn at half size. The
cinematic has its own pool (at most 120 live sprites, 03-the-big-red.md 7.6), freed when it ends.

### 4.4 The counter

The counter is a `<span class="num">` written by one rAF loop, not by React: `shown = settled +
rate × (nowMs − settledAtMs) / 1000`, formatted and written to `textContent` only when the string
changes. The `/s` line updates on change. A gain that "lands" (Collect, crate, line floater
arrival) eases the shown value up over 400 ms instead of jumping.

### 4.5 React discipline

- `tick()` stops calling `set({ now })` every frame (`store.ts:784-811`); frames read the clock
  directly and a `second` field bumps once a second for timers and pills.
- No component selects the whole `base`; selectors return primitives or shallow-equal slices (a
  row uses `useLineRow(id)`). Taps arrive as one batch a second (canon 13.4), not one per tap.
- Affordability without polling: each row computes `affordAt` from supplies and rate and sets
  one timer, so it re-renders only when it flips.
- Cycle bars are CSS animations with `--cycle` as the duration. A manned bar loops; an unmanned
  bar plays one cycle from its start to `readyAt` and stops empty (resolution 3.3), so a new
  cycle is one attribute change, not a per-frame update.
- `backdrop-filter` only on the drawer and sheets, never per row, and dropped under low frame
  rates.

### 4.6 Frame budget

Target: 60 fps on a mid phone (reference: a 2021 Android in the Pixel 5a class, and an iPhone 11)
with p95 frame time at or under 16.7 ms while tapping 8 times a second under Rally with 12
floaters. The cinematic may dip, never below 30 fps.

| Work per frame | Budget |
| --- | --- |
| Clock read, prediction, tap batching | ≤ 1.0 ms |
| Scene step (actors, ≤ 160 particles, ≤ 12 floaters, weather) | ≤ 3.5 ms |
| Pixi render (DPR capped at 2, as today) | ≤ 6.0 ms |
| Counter and Hustle writes | ≤ 0.2 ms |
| React commits | 0 on most frames; ≤ 4 ms on a buy |
| Headroom (GC, compositing) | ≥ 5 ms |

A dev-only `?perf` overlay shows fps, p95 frame time, live floaters and particles, React commits
per second and queued taps. If p95 stays above 20 ms for 3 s, the renderer drops to DPR 1.5 and
halves the particle cap. The owner's phone check is the acceptance (8.4).

---

## 5. Sound and haptics

### 5.1 Engine

- One `AudioContext`, created on the first touch (iOS needs a gesture): cue → bus (`sfx`, `ui`)
  → master gain → `DynamicsCompressor` → output, at most 8 voices (09-architecture.md 10.6),
  suspended while the tab is hidden.
- Where supported, `navigator.audioSession.type = "ambient"`, so the silent switch mutes the game
  and the player's music keeps playing.
- `tap` plays at most 15 times a second (the token bucket's rate); faster taps raise its gain
  instead of stacking voices.
- Each cue is a small function of oscillators, noise and envelopes. If
  `apps/web/public/sound/<cue>.ogg` exists it is used instead, so the owner can replace sounds one
  at a time (owner decision 15).

### 5.2 Cue list

| Cue | When | Sketch | Ships |
| --- | --- | --- | --- |
| `tap` | each credited tap | 25 ms noise burst through a bandpass per target (pine 700 Hz thock, outcrop 1.6 kHz tick, ore 2.4 kHz plus a 1.2 kHz triangle ping, vent 500 Hz puff, wreck 3 kHz clank); +0 to +4 semitones with Hustle; ±25 cents random | R1 |
| `buy` | a purchase | square 880 Hz for 35 ms then 1,320 Hz for 60 ms, lowpass 3.5 kHz; bulk adds 1,760 Hz | R1 |
| `milestone` | a milestone | triangle arpeggio 523, 659, 784 Hz, 60 ms each, with a soft noise shimmer | R1 |
| `fell` | the target falls | per era: creak (saw 180 → 90 Hz, 300 ms) and a 70 Hz thump; crumble (noise, lowpass 3 kHz → 300 Hz); vein (bell partials 1,047, 2,637, 3,951 Hz); pop (sine 300 → 900 Hz, 80 ms); crack (220, 563, 891 Hz, 700 ms) | R1 |
| `ui_open`, `ui_close`, `ui_toggle` | sheets, switches | highpass noise sweep 80 ms at gain 0.04; a 12 ms 2 kHz tick | R1 |
| `refuse` | a refusal | square 180 Hz, 90 ms, lowpass 600 Hz | R1 |
| `era` | an era | two detuned saws G4 → C5, lowpass opening 400 Hz → 3 kHz over 600 ms, plus the thump | R2 |
| `hand` | a hire | two-note whistle, sine 1,200 → 1,500 Hz glide, 180 ms, twice | R2 |
| `flotsam_in` | flotsam appears | sine 1,568 Hz bell, 1.2 s decay, panned −0.6 toward the sea | R2 |
| `flotsam_claim` | claimed | noise splash (bandpass 1.5 kHz, 200 ms) plus `buy` | R2 |
| `rally` | Rally or a buff starts / ends | saw 80 → 160 Hz rev over 600 ms with 8 Hz tremolo; the reverse at the end | R2 |
| `siren` | hold to launch | 03-the-big-red.md 6: two detuned saws 180 → 760 Hz over 2 s, a crank wobble; release winds down over 500 ms | R2 |
| `boom` | the flash | 03-the-big-red.md 7.2: low-passed noise 1.8 s plus a 48 Hz sine 1.2 s | R2 |
| `postcard` | the postcard lands | 50 ms paper flick (noise at 3 kHz), triangle 784 → 1,047 Hz | R2 |
| `glass` | a node bought | sines 2,093 and 3,136 Hz, 500 ms decay | R2 |
| `crit` | a crit | `tap` plus a 2.6 kHz ping, 120 ms | R2 |
| `logbook` | an entry | 120 ms pen-scratch noise and a 1,319 Hz bell | R4 |
| `scrap` | a haul or rank | clank (310 and 840 Hz) and a chain rattle | R5 |
| `crates` | Blowback | three soft thuds 80 ms apart | R6 |

Canon 12.4 sets tap, buy, milestone and fell in R1 and flotsam, siren and boom in R2; the other
R2 cues ride with them.

### 5.3 Settings

Sound on by default at 70%; one switch and one volume slider (2.15). Muted means no `AudioContext`
work at all.

### 5.4 Haptics

Android only (`navigator.vibrate`; iOS has no web API, so the setting is hidden there). On by
default.

| Moment | Pattern (ms) |
| --- | --- |
| Fell | 20 |
| Milestone | 15, 40, 15 |
| Era | 30, 50, 30 |
| Flotsam claimed | 15 |
| Hold to launch | tightening pulses (03-the-big-red.md 6) |
| Launch | 120, and 300 at the flash |
| Taps | never (battery and fatigue) |

---

## 6. Motion and accessibility

### 6.1 Motion tokens

`--t-fast: 120ms` (presses, squash), `--t-med: 220ms` (sheets, toasts), `--t-slow: 400ms`
(counter easing, bars). Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)` (today's toast-in); pops use
easeOutBack. Sheets slide 240 ms, as today. The crowned button pulses every 2.2 s, as today.

### 6.2 Reduced motion

A setting with three values, "Match device" by default, which follows `prefers-reduced-motion`.
Under reduced motion:

- no camera shake and no white flash; the cinematic becomes 2.5 s of cross-faded stills (2.6);
- floaters fade in place; the target blinks brighter instead of squashing;
- pulses become steady glows; sheets fade instead of sliding;
- particles at 25%; Afterglow's ash falls at half the count;
- the Hustle arc, cycle bars and timers still move: they carry information.

### 6.3 Contrast

Computed with the WCAG relative-luminance formula; panels are composited over the sky behind them
(R1 re-checks them in shots). The `--muted` and panel-alpha fixes ship with the R1 orange-primary
decision (resolution 3.26).

| Pair | Ratio | Verdict |
| --- | --- | --- |
| `--text` on today's glass panel (0.78) over the brightest sky (day horizon) | 7.57 | pass |
| `--muted` `#a49e93` on today's glass (0.78) over the day horizon | 3.48 | **fails 4.5** |
| proposed `--muted` `#b5afa4` on glass at 0.86, over the day horizon / Afterglow / white flash | 5.49 / 5.58 / 5.21 | pass |
| Ink on orange, `#ff9a3c` / `#e46c12` ends | 8.23 / 5.34 | pass |
| White on orange (`#e46c12` end) | 3.25 | fails, so orange buttons use ink text |
| White on the dome `#d8261c` | 4.98 | pass |
| Ink on hazard yellow | 12.0 | pass |
| Glass green / scrap gold / Afterglow lime / orange on the panel | 8.14 / 8.01 / 11.48 / 5.52 | pass |
| `--warning` on the panel (the small-blast note) | 6.95 | pass |
| `--danger` on the panel | 4.40 | bold 16 px or larger only; danger buttons keep `#ffc2b8` text (8.66) |
| Era colours on the panel: twig, wood, stone, metal, hqm | 6.62, 4.08, 5.79, 4.95, 7.09 | wood never as small text |
| White floater on the day horizon without its stroke | 1.23 | the 20% ink stroke is required |

Text that sits on the scene itself is limited to floaters (stroked), the Hustle label (stroked)
and the crater sign (drawn on its own board). Everything else sits on a panel, a chip or a pill
with its own fill. Shots check day, dusk, night, rain, fog, the Afterglow sky, the burnt-orange
cinematic and ash (8.3).

### 6.4 Touch targets

Every target is at least 44 × 44 CSS px (N27). Today's violations, fixed in R1:

| Element | Today | Where | Fix |
| --- | --- | --- | --- |
| Panel close | 32 × 32 | `hud.css:291-293` | 44 × 44, glyph stays 18 px |
| Tabs | 36 tall | `hud.css:972-975` | 44, padding 10 px 14 px |
| `.btn` | 38-40 tall | `hud.css:384-395` | `min-height: 44px` |
| `.btn.small` | about 30 tall | `hud.css:411-414` | 44 tall; only the font and side padding shrink |
| Toast button | 30 tall | `hud.css:901-904` | 44; the toast grows to 52 |
| Top bar chips | 30 px tiles | `hud.css:108-110` | the chip is the 44 px button; its tile is 20 |
| Rock hit areas | ore 44 × 27, stone 35 × 21, sulfur 38 × 23 | world-unit hit areas, `scene/nodes.ts:646` at scale 0.443 | the era target's fixed screen box (1.3) |
| Barrel | 28 × 49 | `scene/nodes.ts` barrel | gone; flotsam has a 64 px fixed circle |
| Crew gear selects | 36 tall | `hud.css:1310` | removed with the Squad panel |

The shots harness audits this automatically (8.1).

### 6.5 Labels, keyboard, screen readers

- Labels never wrap: every button and chip label is `white-space: nowrap` with ellipsis. A
  content test (proposal) caps strings by slot, with typical numbers filled in: row and chip
  buttons at 12 characters, full-width buttons at 36 ("Buy path · 4 nodes · 1,240 glass" is 32).
- An invisible HTML button sits over the target ("Tap the ore seam"), so keyboards and screen
  readers reach it; holding Space is hold to work (canon 4.5).
- The counter is `aria-live="off"`; a hidden summary updates every 10 s ("Supplies 31.2 million,
  rising 162 thousand a second"). Buy buttons carry full labels: "Buy 10 Furnaces for 1.21
  billion supplies".
- Focus stays visible (`base.css:30-34`).

---

## 7. Onboarding

### 7.1 The crown, as the player sees it

The advisor (canon 12.5) crowns exactly one thing per view (resolution 3.25); the first match
wins.

| # | Crown goes to | What the player sees |
| --- | --- | --- |
| 1 | The Big Red: the first nuke at yield 10; later a counted nuke that doubles glass ever, whose run's glass rate fell below 80% of its peak, or whose run is 20 h old (resolution 1.9) | the hazard chip with the crown above the drawer; the lid rattles, steam |
| 2 | The next era | the era row, orange, crown on its button |
| 3 | A hand for the top-earning unmanned line | the hand row, orange |
| 4 | The best-payback purchase | that line or upgrade row, orange |
| 5 | Waiting Blowback crates | a crown marker over the crates on the shore (R6) |
| 6 | A ready Toolbelt skill | the crown on the skill button (R5) |
| 7 | Otherwise | the hint "Tap the {target}." and a soft glow on the target |

Flotsam glows and bobs but never takes the crown, and welcome back never crowns the nuke. On the
Blast Map the crown is the one pulsing node.

### 7.2 Where hints appear

02-the-run.md 11.2 owns run 1's twenty hints and their triggers, 03-the-big-red.md the Kettle's
and the first nuke's, 04 and 05 their own. Every hint is one line, never modal, and retires after
two uses (D67's counter, `HINT_RETIRE_AFTER = 2` in `packages/domain/src/advisor.ts`). The screen
decides only where a hint sits:

| Place | Hints (examples) |
| --- | --- |
| The hint pill in the action band | "Tap the tree." (and each era's target), flotsam, hold to work, the Kettle's pad, Afterglow after a rebuild |
| Line 3 of the named row | unmanned ("Runs while you tap"), Grip, the first hand, the first era, Mk II, the bulk toggle |
| The Big Red chip's second line | "Flattens your island for crater glass." (first two crowns) |
| The Blast Map's pick card | "Glass buys nodes. Nodes are yours forever." |
| A toast, once | agenda unlocks ("New: hands for lines 1-3 stay through Wipe Days.") |

There are no tutorial screens and no arrows. The scene, the crown and these lines are the
tutorial (rule 6.3.6).

### 7.3 Never teasing unshipped content

A locked thing shows only real, reachable reasons; a thing whose phase has not shipped does not
exist on screen (resolution 3.7).

| Element | First visible in a build of |
| --- | --- |
| Drawer, eras 1-4, hands, Crew (roster), Settings with Odds, welcome back, 3 flotsam kinds | R1 |
| Kettle pad and drum, Big Red, small blasts and Fizzle, glass chip, Blast Map rings 1-3 of all eight sectors (73 nodes), Friends (feed), Armored era | R2 |
| Rings 4-6 (178 nodes in all), keystones, loadout on the rebuild screen, filter chips | R3 |
| Logbook, Morale in the Multipliers sheet, drone and bottle flotsam, the gull's pokes, the rings 4-6 nodes that need the Logbook (191) | R4 |
| Scrap chip, Magnet, ranks, Pockets and the rebuild screen's POCKETS block, Foreman, Dead Hand, Toolbelt, Sealed Locker, the remaining rings 4-6 nodes (201) | R5 |
| Boards, Freighter, Island Count, Blowback crates, Late Tide, Visit | R6 |
| Dares on the rebuild screen, rings 7-9 | R7 |

So an R1 build has no pad at minute 10 and a nav row of Island and Crew, and a postcard's NEXT
line never names a system from a phase that has not shipped.

---

## 8. The screenshot review plan

### 8.1 Harness changes (`apps/web/scripts/shots.mjs`, `apps/web/src/debug.ts`)

- **Clocks** (resolution 3.18): `time` pins the game clock and `wall` the real clock that
  Hustle, flotsam, buffs, Afterglow and the cinematic run on. CLAUDE.md 6.4 names `wall`, but
  `apps/web/src/state/clocks.ts` has only `game` (a 240× scaled clock today); R0 adds `wall` to
  `demoClocks`. The demo clock then runs at 1×, and the demo drawer jumps it +1 h, +6 h and to the
  next day (errata E7), so idle timers (Night Shift, Magnet, Toolbelt cooldowns) are reviewable while
  active-play timers stay on real seconds.
- **State keys**: `run` (a fixture played to a minute mark by the simulator's own greedy
  archetype, `{ minute: 10.5, taps: 6 }`, so a shot shows what a real player sees); `meta`
  (nukes, glass, nodes, scrap, entries); `drawer`, `tab`, `bulk`, `sheet`, `view`, `sector`,
  `node`, `filter`, `weather`, `hustle`, `buffs`, `afterglow`, `flotsam`, `welcome`, `settings`;
  `cinematic: { variant, at }` (ms or a phase name from 2.6, 03-the-big-red.md 7.5), which seeks
  the film and sets `frozen`.
- **Hooks** (09-architecture.md 10.8): `targetPoint()`, `tap(n)`, `pin`, `seed(n)`, plus
  `hitBoxes()` for the audits below. Reduced motion uses Playwright's `reducedMotion: "reduce"`.
- **Touch audit**: after each phone shot, every `button`, `a`, `[role=button]` and scene hit box
  under 44 × 44 is listed under the shot in the contact sheet.
- **Crown audit** (resolution 3.25): each shot counts its crowned elements (orange primaries, the
  pick's ring, the crown mark on the chip, crates or a skill); more than one fails, and so does
  none on a view whose rule (2.18) names one.
- **Groups**: each shot has a `phase`; `--group r2` renders one phase, and the contact sheet is
  sectioned by phase.

### 8.2 Pruning

All 140 current entries go: they show the dock, the panels, the nodes, the map, the Den, raids,
PvP, seasons and the Signal, all removed or reworked (canon 11). Only their viewports carry over
(`desktop` 1600 × 900, `laptop` 1366 × 768, `phone` 390 × 844 @3x, `phone_landscape`, `tablet`,
`desktop_ultrawide`). The new list starts at 31 shots in R1 and grows to about 95 by R7, below
the 125 that stopped fitting one 10-minute call in W6 (`docs/ui-review.md`); `--group` renders one
phase.

### 8.3 The new SHOTS list

Phone shots are 390 × 844 @3x unless noted. `__zoom` means a 1:1 crop is saved too. Times are the
P1 script's (resolution 3.29).

| Shot | Pins | Phase |
| --- | --- | --- |
| `phone_first_tap` | run 0:00, dawn, hint "Tap the tree.", no drawer, no nav | R1 |
| `phone_first_buy` | 6 supplies, drawer with one crowned row | R1 |
| `phone_taps__zoom` | 6 taps/s, running floater, Hustle 60% | R1 |
| `phone_fell__zoom` | the pine mid-fall, "Timber!" | R1 |
| `phone_timber_era` | 0:36, era pop, three locked rows | R1 |
| `phone_hand_hired` | 0:41, Mara walking, the nav row sliding in | R1 |
| `phone_bulk` | 1:30, second hand, bulk button "×10" | R1 |
| `phone_flotsam__zoom` | 3:00, the crate with its ring | R1 |
| `phone_rally_cap__zoom` | Rally ×4 and Adrenaline ×100, 12 floaters at the cap | R1 |
| `phone_drawer_lines` | expanded, Lines, era row pinned | R1 |
| `phone_drawer_upgrades` | expanded, Upgrades, a locked Mk II | R1 |
| `phone_locked_rows` | Stone era: lines 10-12 locked with prices, "Needs 25 Furnaces (12 now)" | R1 |
| `phone_stone_day` / `_dusk` / `_night` / `_rain` / `_fog` | 10:30 run, contrast set | R1 |
| `phone_numbers_dc` | supplies 9.99Dc, rate 1.23e36/s | R1 |
| `phone_numbers_sci` | the same with scientific notation | R1 |
| `phone_short` | 390 × 664, two collapsed rows | R1 |
| `phone_multipliers` | the sheet with Rally on | R1 |
| `phone_welcome_full` / `_short` / `_nohands` | three welcome-back cases (demo jumps) | R1 |
| `phone_crew` | roster, 6 on shift | R1 |
| `phone_settings` | settings with quiet hours and Odds | R1 |
| `desktop_day` | 1600 × 900, column, recentred camera | R1 |
| `desktop_night_metal`, `laptop`, `tablet`, `phone_landscape` | layout checks | R1 |
| `phone_kettle_pad` / `phone_kettle_card` | 500M made (errata E2); the locked card at minute 10 | R2 |
| `phone_bigred_chip` | crowned chip, steam, gulls | R2 |
| `phone_cover_first` / `phone_cover_small` | first launch; a small blast's note | R2 |
| `phone_hold` | lid open, ring at 60%, one-liner | R2 |
| `cine_scramble`, `cine_ignite`, `cine_liftoff`, `cine_flight_u_turn`, `cine_flight_loop_the_loop`, `cine_flight_sputter_drop`, `cine_fizzle`, `cine_flash`, `cine_fireball`, `cine_cloud`, `cine_settle` | each phase and R2 variant, phone | R2 |
| `cine_flash_night`, `cine_cloud_night`, `cine_flash_rain`, `cine_cloud_rain` | 03-the-big-red.md 7.5's weather minimum | R2 |
| `desktop_cine_fireball`, `desktop_cine_cloud`, `cine_reduced` | desktop; the reduced-motion midpoint | R2 |
| `phone_postcard_front` / `_back` / `_small` | Wipe Day #1; a small blast's puddle | R2 |
| `phone_rebuild_plain`, `phone_afterglow`, `desktop_afterglow` | the landing; the green sky with ash, pill frozen at ×3 | R2 |
| `phone_crater_27` | the deepened crater, "WIPE DAY #27" | R2 |
| `phone_armored_locked` | run 2, "Opens after Wipe Day #2" | R2 |
| `phone_map_first` | after nuke 1, pick pulsing, "< Rebuild" | R2 |
| `phone_sector_grip`, `phone_node_sheet`, `phone_node_far`, `phone_node_path_partial`, `phone_node_locked`, `phone_map_respec` | ladder, sheets, the respec card (04-blast-map.md 8.6) | R2 |
| `phone_friends_feed` | nuke news | R2 |
| `phone_map_mid`, `phone_map_filter`, `phone_ladder_wrap`, `phone_node_keystone`, `phone_rebuild_loadout`, `desktop_map` | rings 4-6 | R3 |
| `phone_logbook`, `phone_logbook_secret`, `phone_multipliers_morale` | Logbook | R4 |
| `phone_toolbelt`, `phone_flare_pick`, `phone_crew_ranks`, `phone_pockets`, `phone_rebuild_pockets`, `phone_magnet`, `phone_dead_hand` | slow layer; a blocked rank with its reason | R5 |
| `phone_blowback_shore`, `phone_boards`, `phone_freighter`, `phone_visit`, `phone_island_count`, `phone_late_tide` | friends (the Discord postcard is reviewed with `pnpm preview`) | R6 |
| `phone_map_full`, `phone_ladder_long`, `phone_rebuild_dare`, `desktop_map_full` | all 361 lit; ring 9's longest names; Dares | R7 |

### 8.4 The `docs/ui-review.md` checklist, adapted

The review loop of CLAUDE.md 6.4 stays; the checklist becomes:

1. **Hierarchy.** The counter and the target read first, the crown second. Nothing else glows
   orange.
2. **Legibility at 390 px.** Smallest text 11 px and bold. Counter digits do not shift between
   two frames.
3. **Spacing.** 16 px gutters, an 8 px grid in rows, nothing touching the safe areas.
4. **Overflow.** `999Dc`, `1.23e36/s`, "Charcoal Kiln", a 32-character player name in the feed,
   "Buy path · 12 nodes · 7.77M glass".
5. **Consistency.** One icon per thing: the product badge equals the floater icon equals the drawn
   product. The same formatter in the web and the bot.
6. **Contrast.** Day, dusk, night, rain, fog, the Afterglow sky, the burnt-orange cinematic, ash.
7. **Rules 6.3 as amended.** One crown per view (the crown audit is empty), the Big Red never
   orange, no dead end, real reasons only, nothing unshipped on screen, cost and outcome before
   any spend, Wipe Day or small blast named before the press.
8. **Juice.** A tap shows a floater within one frame; at most 12 floaters; product icons on line
   floaters.
9. **Touch.** The audit list under each phone shot is empty.
10. **Motion.** The reduced-motion stills reviewed beside the full cinematic.
11. **The phone itself.** Once per phase the owner plays on a real phone (sound, haptics, 60 fps,
    the hold) and screenshots it; those screenshots are bugs first (CLAUDE.md 2).

"Looks good" without specifics is still not a review.

---

## Open questions

None; settled by errata v3.

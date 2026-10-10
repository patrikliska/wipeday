# 03 The Big Red: the nuke, from first glimpse to rebuild

Status: proposal, 2026-10-07, awaiting the owner's approval. Expands canon sections 5 and 9 as
settled by the design director's resolutions (canon v2). Numbers marked *(sim)* are starting
constants `10-balance.md` may retune in data; worked numbers come from its P1 model. Screens are
drawn in `08-screens.md`; state, commands and settle in `09-architecture.md`; the tree in
`04-blast-map.md`; Logbook, Dead Hand and the Toolbelt in `05-meta-layers.md`; Blowback, Late
Tide and the Discord postcard in `06-friends.md`. Everything here ships in **R2** unless a row
says otherwise.

---

## 1. The formula

### 1.1 Glass ever and the delta

- `L` is lifetime supplies made across all runs since the last Crossing (taps, lines, flotsam
  and Blowback count; spending never lowers it).
- The **formula level** is `G(L) = floor((L / L0)^(1/5))`, `L0 = 5e5` *(sim)*: 10 glass at 50B
  supplies made. It is computed with a small epsilon so an exact threshold (5e10) lands on 10.
- A nuke pays the **delta**: `gain = floor((G(L) − level) × m)`, where `level` is the formula
  level already paid out and `m` the product of glass multipliers (Bigger Payload, Hot Core, Late
  Tide). Then `level = G(L)`, `glass ever += gain`, `glass held += gain`.
- **Glass ever** is the sum of every gain. **Glass held** is every gain plus granted glass minus
  what the Blast Map cost. Granted glass (the founders' 5, admin grants) goes to held only: it
  never moves Glow, the 10% rule or the first-nuke threshold.
- Doubling the level takes 32× the lifetime; a counted nuke (+10%) takes 1.61×. Early repeat
  nukes pay nothing extra: the delta only counts lifetime not yet paid for.

The delta subtracts the formula level, not glass ever, so multipliers are never clawed back by
the next nuke.

### 1.2 Glow

`Glow = 1 + k × √(glass ever)`, `k = 0.25` *(sim)*; Blast nodes raise `k` (Glow Lamp: 0.27). It
is a global multiplier in the effects fold (canon 13.5), shown on the glass chip (`×2.17`) and as
"before → after" on the cover card. **Spending glass never lowers Glow.** Ground Zero is granted
lit with the first nuke, so Glow works from Wipe Day #1.

### 1.3 Worked tables

Reference (`L0 = 5e5`, `k = 0.25`, no multipliers):

| Lifetime `L` | 5e5 | 5e10 | 1e12 | 1e13 | 5e15 | 5e20 | 5e25 | 5e30 | 5e35 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Formula level | 1 | 10 (first nuke) | 18 | 28 | 100 | 1,000 | 10k | 100k | 1M |
| Glow at that glass ever | ×1.25 | ×1.79 | ×2.06 | ×2.32 | ×3.50 | ×8.91 | ×26.0 | ×80.1 | ×251 |

In the P1 model the casual player has about 1.1k glass ever at day 7, 44k at day 30 and 655k at
day 180 (`10-balance.md` 4.7); glass ever runs ahead of the formula level by the multipliers.

A first week *(one seed of the P1 casual, three check-ins a day; `10-balance.md` owns the real
path)*. Glow is shown at `k = 0.25`:

| Nuke | When | `L` | `G(L)` | Delta | `m` (≈) | Gain | Glass ever | Glow | Gain vs ever | Crowned by |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | day 1, 21:00 | 5.8e10 | 10 | 10 | 1.00 | +10 | 0 → 10 | ×1.00 → ×1.79 | first | first nuke |
| 2 | day 2, 21:00 | 3.2e13 | 36 | 26 | 1.03 | +26 | 10 → 36 | ×1.79 → ×2.50 | 260% | doubling |
| 3 | day 3, 21:00 | 4.2e15 | 96 | 60 | 1.10 | +66 | 36 → 102 | ×2.50 → ×3.52 | 183% | doubling |
| 4 | day 4, 21:00 | 6.2e17 | 262 | 166 | 1.12 | +186 | 102 → 288 | ×3.52 → ×5.24 | 182% | doubling |
| 5 | day 5, 21:00 | 1.4e19 | 487 | 225 | 1.16 | +260 | 288 → 548 | ×5.24 → ×6.85 | 90% | a day's run |

The farming check: at `L = 5e25` (level 10,000), another 1% of lifetime gives level 10,019:
+19 glass, 0.2% of glass ever. It is pressable but a small blast (1.5). Counting needs +1,000,
so `L ≥ 8.05e25`.

### 1.4 Why the fifth root and √Glow

- **A power law on lifetime, paid as a delta,** is canon (Cookie Clicker's shape;
  `research/ref-patterns.md` 1.2). The exponent is the strongest early lever. With every other
  P1 value fixed (`10-balance.md` 3):

  | Exponent (`L0` set so 10 glass needs 50B) | Casual glass at day 30 | Optimal ÷ casual | Optimal tree lit at day 30 |
  | --- | --- | --- | --- |
  | cube root (old canon) | 405B | 2,877× | 100% |
  | fourth root | 36.7M | 2,300× | 100% |
  | **fifth root** | **43.7k** | **1.92×** | **37%** |

  Above 1/5 the loop gain passes 1 and nukes cascade (four casual runs of 30 s to 2.5 min on days
  3-4 under the cube root). The exponent must not go above 1/5 without a group-simulation proof.
  The square-root alternative is withdrawn: it makes the runaway worse.
- **√Glow** keeps the passive concave: Glow grows as `L^(1/10)`. Flattening is fixed by content
  (notables, agenda, the Crossing); a runaway is not.

### 1.5 The 10% rule: Wipe Days and small blasts

- **Pressable:** the first nuke at a formula delta of 10 or more; later nukes at a gain of 1.
- **Counted:** gain ≥ `ceil(0.10 × glass ever before)`, the gain after every multiplier (Late
  Tide included). The first nuke always counts.
- A counted nuke is a **Wipe Day**: it raises Wipe Day #N, moves the agenda, posts news, washes
  Blowback onto friends' shores, adds to the Island Count and the boards, and deepens the crater.
- A press below 10% is a **small blast**: it resets the island and pays its glass, quietly. No
  news, no Blowback, no counters, no agenda step; it plays the Fizzle flight (7.3) and a private
  postcard. The run number (internal: seeds and `stale_run`) still rises; nothing a player sees
  counts small blasts.
- The cover card always says which it is. Small blasts exist for re-picking keystones, starting a
  Dare or banking glass; the advisor never crowns one.

### 1.6 The Late Tide hook (R6)

Below 50% of the median glass ever of the **other** players active in the last 14 days (with two
players: below half of the other's), **Late Tide ×3** applies to the gain, and the bonus never
carries a player past that median: `gain = max(base, min(3 × base, median − glass ever))`, with
`base = floor(delta × m)` (`06-friends.md` 6 owns the rule and its display). The median is copied
from `World` (`World.lateTide`, a number; errata E18) into `meta` at each server settle, so the
client predicts with the last known value; if they move before the server answers, the server's number wins. The cover
card shows "Late Tide +{bonus} included". The first-nuke threshold uses the formula delta, so
Late Tide never moves the first nuke's timing (N1-N3); it can triple the payout (+30, up to the
median).

### 1.7 Data

`packages/content/data/prestige.json5` *(sim)*: `l0: 5e5`, `exponent: 0.2`, `glowK: 0.25`,
`firstMin: 10`, `laterMin: 1`, `countShare: 0.10`, `kettle: {padAt: 5e8, frameFirst: 5,
frameShare: 0.01}`, `crown: {rateShare: 0.8, minRunSeconds: 600, ageSeconds: 72000}`,
`afterglow: {bonus: 2, halfLife: 300, hold: 0, fadeSeconds: 1800}`, `sky: {clearAfter: 600}`, and
`flights` (id, unlockAt, weight, when, phase). The Late Tide factor and share live in the social
data (`06-friends.md`). Film timings are presentation and live in `apps/web`.

---

## 2. When to press

### 2.1 The live readout

The Big Red's card and the phone chip always show **"+12 now · 9/h now · peak 14/h"**:

- **+12 now:** the gain if pressed now, multipliers included.
- **9/h now:** this run's average, `yieldNow / max(runHours, 1/6)`, with `yieldNow` from the
  unfloored fifth root so it moves smoothly. Its peak is the classic best moment to reset
  (`ref-patterns.md` 1.4).
- **peak 14/h:** the highest average this run, sampled on a fixed one-minute grid from the run's
  start and at each command, stored as `run.peak`, so client, server and bot agree.

Rates under 10 show one decimal (`0.4/h`) through the shared rate formatter.

### 2.2 The advisor's crown rules

The Big Red is first in the advisor's list (canon 12.5). First match wins:

| # | Rule | Condition |
| --- | --- | --- |
| 1 | First nuke (guided) | no Wipe Day yet and formula delta ≥ 10 |
| 2 | Doubling | gain ≥ glass ever |
| 3 | Slowing down | run ≥ 10 min, rate now < 80% of peak, and the nuke counts |
| 4 | A day's run | the nuke counts and the run is ≥ 20 h old (from the previous nuke) |

Rule 4 sets the casual cadence: in the P1 model it gives the casual player about 25 Wipe Days by
day 30, inside the asserted band of 20-40 (errata E14); without it, 15, with 9-day late runs
(`10-balance.md` 4.1).

Rule 3's rate is the readout's run average (2.1); the P1 model measured it between check-ins.
Simulator v2 shares the advisor and re-checks the cadence with this definition; if rule 3 fires
too late for active players, it uses the rate over the last hour (the readout keeps the average).
An R2 tuning item (errata E28).

- **Sticky:** once crowned in a run it keeps the crown until pressed; it never flickers.
- **It waits** (the crown passes down the list, then returns) while a Rally, Adrenaline Kit,
  Drowned Drone or Rush runs, while a Dare's goal is unmet, and while welcome back is open:
  welcome back never crowns the nuke (its one action is Collect).
- **One crown per view:** while the Big Red holds the crown, the collapsed drawer shows no orange
  row; the hazard chip is the view's one crowned thing, and it is never primary-styled. The
  expanded drawer (a separate sheet) still crowns one row.

### 2.3 The first guided nuke

At a formula delta of 10 (5e10 supplies made; 48:00 at 6 taps/s in the P1 model, the 21:00
check-in for the casual) the Kettle gets its warhead, fuel and steam at once, the chip appears
and the hint reads "The Big Red is ready. Press it to see what it does." The cover card adds one
paragraph (5.2) and "Wipe Day #1 unlocks: the Blast Map, Glow and Afterglow". The film cannot be
skipped. The postcard's one button is **Open the Blast Map** (errata E6), on the advisor's
pulsing ring-1 pick, so 10 glass becomes 6-10 nodes in the same minute (N14). A player who keeps going sees the gain
creep up (+11 at 8.1e10, +12 at 1.25e11); the crown stays.

### 2.4 Dead Hand, later (R5)

Opt-in once the `dead_hand` node (Blast ring 6, 22.2k glass) becomes buyable at Wipe Day #25. It
fires at **25%, 50%, 100% (default) or 200%** of glass ever, or "when crowned"; the setting
travels in `set_loadout`.

- Only in a visible, focused tab and only for a counted nuke; never offline or from Discord; the
  full list of when it holds back is in `05-meta-layers.md` 6.
- A 5-second toast first: "Dead Hand: launching in 5 · +12k glass · Stop". Stop disarms it for
  this run.
- No film: a 300 ms thump, the short landing (9.2) and a toast: "Dead Hand pressed the Big Red.
  Wipe Day #31: +12k glass · Glow ×55.8 → ×62.2 · See postcard". The loadout stays; no Dare
  starts; glass waits on the Blast Map (no node autobuyer). The bot card shows "Dead Hand armed
  at 25%".

---

## 3. The Kettle

### 3.1 Placement

The Kettle takes the Signal's spot: world `(670, 440)`, `BASE_X − 330, GROUND − 120`
(`apps/web/src/scene/Scene.ts:225`), in the same slot of the world stack (after `terrain.back`,
behind the ground and the base). `scene/kettle.ts` replaces `scene/signal.ts` with its pattern:
a `container` in the world and a `light` container on `lights` (D47). The drum stands at `(735,
448)`, a step down toward the base. Sizes are world units (today's phone scale is 0.443; R1's
reframe changes it; x = 670 stays in the phone's view). Tap targets (D48): a fixed 56 × 56 CSS px
area on the drum, plus the Kettle's silhouette; both open the Big Red's card.

### 3.2 Stages and triggers

`T` is the counting threshold: 10 for the first nuke, later `ceil(10% of glass ever)`. Times are
run 1 at 6 taps/s in the P1 model.

| Stage (icon id) | Run 1 | Later runs | Meaning |
| --- | --- | --- | --- |
| Hidden | until `L ≥ 5e8` | never | n/a |
| Pad (`kettle_pad`) | `L ≥ 5e8` (about minute 9-10 over seeds; errata E2) | from the rebuild | locked, with its reason |
| Frame (`kettle_frame`) | gain ≥ 5 (13:16) | gain ≥ max(1, 1% of glass ever) | glass is coming |
| Warhead (`kettle_warhead`) | gain ≥ 10 (47:33) | the nuke counts: gain ≥ T | pressable and counted |
| Fuel and steam (`kettle_fuel`) | crowned | crowned | the advisor says now |

A lifetime threshold for the pad (not a clock) keeps client, server and bot in step and shows a
casual player the pad at the same progress point. `padAt` is a lever set to 5e8, so the
pad lands near the canon script's minute 10 (8:34-10:28 over 12 seeds; errata E2). The pad and its
locked card ship in R2 with the rest of the Kettle, not R1 (never tease). Stages never go
backwards inside a run. In later runs the Big Red can be pressable (a small blast) while the
Kettle still shows the pad or the frame.

### 3.3 Art direction (procedural; `palette.ts` additions)

New constants: `KETTLE_RUST 0xa0643a`, `KETTLE_RUST_DARK 0x7a4a2a`, `CONE 0xf26a1b`, `REFLECTIVE
0xf4f1e8`, `HAZARD 0xf2c230`, `HAZARD_DARK 0x1b1a18`, `BIG_RED 0xd8262b`, `BIG_RED_LIGHT
0xff6a5a`, `BIG_RED_DARK 0x8e1418`, `DRUM 0x3f5f7a`, `LID 0xe9e4d6`. Reused: the stone and timber
materials, `STEEL`/`STEEL_DARK` from `signal.ts`, the metal accent `0x6c97bc`, `TREE_TRUNK`.

- **Pad:** two stacked pallets (timber, 130 × 14) under a cracked concrete slab (stone, 120 × 10),
  hazard tape in 12-unit diagonal bands along the front, a ladder leaning on the left. "DO NOT" is
  a screen-space label (D46): 12 CSS px bold, white with a `BIG_RED` stroke, rotated −4°.
- **Frame:** four splayed stilts (90 tall, `STEEL`, `STEEL_DARK` cross-braces, the Signal
  lattice's look) carrying a boiler: a 64 × 110 rounded body in `KETTLE_RUST`, shaded right
  third, ellipse caps, two rows of rivets, a white pressure gauge with a red needle, a crooked
  chimney pipe.
- **Warhead:** a taped wooden crate (timber accent, grey duct-tape bands) with a painted face, a
  traffic-cone nose (40 tall, `CONE`, two `REFLECTIVE` bands), three sheet-metal fins in
  `0x6c97bc`. About 240 units tall in all, close to the Signal's 290.
- **Fuel and steam:** three olive jerrycans (`0x55684a`) and a dripping hose; steam puffs (white,
  alpha 0.6, every 0.4 s) from the chimney and a valve; the firebox glows `0xff8f5a` on `lights`;
  gulls on the cone; a crew member glances at it every 6-8 s; an amber beacon (`0xffb765`) blinks
  once a second on `lights`.

### 3.4 The yield floater

From the pad on, each time the gain's integer rises, a "+1" in glass green (`0x6fd0a0`, 13 CSS
px) rises from the Kettle with a quiet glass chime; rapid steps merge ("+12"), at most one every
2 s. The player watches the yield grow without opening anything (canon 4.1).

### 3.5 Night, rain and fog

Firebox, beacon and the Big Red's pilot light stay warm on `lights`; the cone's reflective bands
are also drawn there at `0.25 × darkness`, so they glint under the base lamps. Rain makes the
steam greyer and shorter; in fog only the beacon and firebox read. The day, dusk, night, rain and
fog shots check contrast (CLAUDE.md 6.4).

---

## 4. The Big Red

### 4.1 Art direction

- **Drum:** 36 × 50, faded `DRUM` blue, two ribs (`0x2c3a4a`), rust streaks (`0x8a4a2a`), a
  sheet-metal plate bolted on top.
- **Dome:** 22 × 12, `BIG_RED`, a `BIG_RED_LIGHT` highlight crescent, a `BIG_RED_DARK` rim. A
  pilot light glows on `lights` (`0xff3a2a`; alpha 0.4 pulsing at 1 Hz when ready, 0.7 crowned).
- **Lid (owner decision 3, 2026-10-10):** a hinged **toilet seat** in `LID` wrapped in hazard tape, with a yellow
  smiley sticker (`0xffd25a`) half peeled, one curled corner showing white backing.
- **Jam-jar alternative** (not chosen; kept only as an art fallback): an upturned jam jar (`0xcfe8f0` at alpha 0.35, a
  white highlight stroke), its red-and-white gingham lid as the base ring, a torn "JAM" label.

The `big_red` icon is the same drawing (one icon per thing, CLAUDE.md 6.2).

### 4.2 Never primary

Primary becomes signal orange; red means only the Big Red (canon 12.3). Its HUD treatment is a 6
px hazard frame (`HAZARD`/`HAZARD_DARK` bands) around a `BIG_RED` fill: the danger style of rule
6.3.1, which nothing else uses once raids and PvP are gone.

### 4.3 States

| State | When | Scene | Tap opens |
| --- | --- | --- | --- |
| Hidden | run 1 before the pad | no drum | n/a |
| Locked | pad up, not pressable | lid taped shut with an X; pilot light off | the locked card (5.4) |
| Ready, small | pressable, not counted | tape cut and hanging; pilot light pulses | the cover card with the small-blast note |
| Ready, counted | gain ≥ T | as above, warhead on the Kettle | the cover card |
| Crowned | 2.2 | lid rattles 2° every 3 s; the Kettle steams; chip on phones | the cover card |

### 4.4 The phone chip

When crowned, a chip sits above the drawer on the left (the Toolbelt is on the right from R5):
48 px tall, hazard frame, `big_red` icon and crown mark, two lines: **"Big Red: +12 glass"** and
"9/h now · peak 14/h". Desktop shows it at the top of the drawer column. It breathes (opacity 0.85
to 1 over 2 s; static under reduced motion) and never pulses like the orange primary.

---

## 5. The cover card

### 5.1 Layout (390 px bottom sheet, at most 88% of the height)

```
┌──────────────────────────────────────┐ hazard tape, 8 px
│ The Big Red                     [ x ]│ 18 px bold; close 44 px
│ Wipe Day #2 · Saltmarsh              │ 13 px muted
├──────────────────────────────────────┤
│ GAIN                                 │ 11 px caps
│ [glass] +12 crater glass             │ 28 px bold, glass green
│         Glow ×1.79 → ×2.17           │ 16 px
│ Wipe Day #2 unlocks: the Armored era │ 14 px
│ Counts as Wipe Day #2.               │ 13 px
├──────────────────────────────────────┤
│ KEPT                 LOST            │ two columns, 14 px
│ Crater glass, Glow   380B supplies   │
│ Blast Map (9 nodes)  312 line units  │
│ Mara (Old Friends)   14 upgrades     │
│ Wipe Days, records   Sheet Metal era │
│                      4 hands         │
├──────────────────────────────────────┤
│ notes, only when they apply          │ 13 px amber
├──────────────────────────────────────┤
│ "I *just* fixed the roof." Dax       │ 14 px italic
│ [  Not yet  ]   [ Flip the lid  ]    │ 48 px; danger on the right
└──────────────────────────────────────┘
```

The cover card names what **this** press unlocks; the postcard names what the **next** Wipe Day
unlocks (8.3). A small blast unlocks nothing, so its card shows the small-blast line instead.

### 5.2 Copy

| Key | Text |
| --- | --- |
| `big_red.title` / `.sub` / `.sub_small` | The Big Red / Wipe Day #{n} · {island} / A small blast · {island} |
| `big_red.gain` / `.glow` / `.late_tide` | +{gain} crater glass / Glow ×{before} → ×{after} / Late Tide +{bonus} included |
| `big_red.unlocks` | Wipe Day #{n} unlocks: {items} |
| `big_red.unlocks_later` | Nothing new this time. Wipe Day #{m} unlocks: {items} |
| `big_red.counts` | Counts as Wipe Day #{n}. |
| `big_red.small` | A small blast: +{gain} is {pct}% of your {ever} glass, so it resets your island quietly and does not count. Wipe Day #{n} needs +{need}. |
| `big_red.first` | Press it and your own missile flattens your island. Everything you built goes. The glass stays and makes the next island faster. |
| `big_red.note.blowback` | {k} Blowback crates stay on your shore. |
| `big_red.note.buff` / `.grit` | {buff} ends now ({s} s left). / Grit ends with the island ({x} stacks). |
| `big_red.note.flotsam` | The {flotsam} floating by sinks with the island. |
| `big_red.note.dare` | Your Dare ({dare}) ends unfinished. No reward, no penalty. |
| `big_red.not_yet` / `.flip` | Not yet / Flip the lid |

KEPT and LOST come from section 11 and list only shipped systems (no Logbook before R4, no scrap
before R5). Hands are named when three or fewer; amounts use the shared formatter.

### 5.3 Behaviour

Opening the card pauses the Foreman (R5) so the numbers hold; the gain still updates about once a
second from the prediction. "Flip the lid" turns the sheet into the hold view (section 6): the
gain block collapses to "+12 crater glass · Glow ×2.17", and "Not yet" and the close button stay.
The one emphasised action is the danger-styled "Flip the lid"; there is no orange primary here
(rule 6.3.1's destructive exception).

### 5.4 The locked card

Not danger-styled. "The Big Red · Taped shut", then:

- Run 1: "The first launch needs 10 crater glass. That comes at 50B supplies made (now 500M)."
  The bar is the yield itself, `(L / L0)^(1/5) / 10`, labelled "+3 of 10 glass": 40% at the pad
  (errata E2), 50% at the frame, 72% at 1e10. It moves at every check-in.
- Later: "Nothing to launch yet. The next glass comes at 34.7T supplies made (now 32.0T)."
- One primary: **Back to work** (closes).

### 5.5 Accessibility

`role="dialog"`, `aria-modal`, focus trapped, first focus on **Not yet**, Escape is Not yet. Lost
rows carry a minus icon, so meaning never rests on colour; text is at least 13 px; hazard yellow
sits only behind dark text. Settings → Accessibility → "Tap twice instead of holding" turns every
hold into "tap to arm, tap again within 3 s".

---

## 6. Hold to launch

| ms | What happens |
| --- | --- |
| 0 | Finger, Space or Enter down on the 120 px dome: the ring starts to fill, the dome sinks 6 px, the tap batch is flushed so the nuke includes every tap |
| 0-2,000 | Siren rises; Android vibrates in tightening pulses; the screen edge pulses red from 0.5 to 2 Hz (not under reduced motion) |
| released early | Cancel: the ring drains in 300 ms, the siren winds down over 500 ms, a relief line shows; nothing was sent |
| 2,000 | Launch: a 120 ms buzz; the idempotency key is minted; `nuke` is predicted and queued; the film starts |

Label "Hold to launch", helper "Hold 2 s. Let go to cancel."

- **Siren:** a procedural hand-cranked saw rising over the 2 s hold, respecting device mute and
  the sound toggle; the values are in `08-screens.md`'s sound table, and the owner may replace it
  (canon 12.4).
- **Haptics (Android):** `navigator.vibrate([20,180,30,150,40,120,50,90,60,60,80,40])`, then
  `[120]` at launch. iOS has no vibration API.

**Crew one-liners.** One per hold, spoken by a hand hired this run (any crew member if none),
picked from the seed and the run number, never repeating within six holds:

| # | Line | Speaker |
| --- | --- | --- |
| 1 | "I *just* fixed the roof." | Dax |
| 2 | "Is that ours?" | Ivo |
| 3 | "Somebody grab the toaster." | Mara |
| 4 | "Is that the good button?" | Rook |
| 5 | "I painted that drum. Twice." | Sela |
| 6 | "Wait, my socks are on the line." | Bram |
| 7 | "Every time. Every single time." | Wren |
| 8 | "Tell me we still have a boat." | Otto |
| 9 | "The gulls know. Look at the gulls." | Juno |
| 10 | "Who untaped it? Who untaped it?" | Pike |
| 11 | "I'll get the oars." | Hale |
| 12 | "Lid up means hands off!" | Tamsin |

Cancel lines: "Phew." · "Good call." · "Okay. Breathing again."

---

## 7. The cinematic

### 7.1 Camera and layers

- **Real time only** (`ticker.deltaMS`), never the demo or game clock (rule 6.3.9).
- Over the first 600 ms the camera eases out to at least x 150-1,350 and y 0-700, so the arc over
  the sea fits a phone; the HUD fades in 220 ms.
- `world`: the Kettle, crew, rowboat, cloud, debris. `lights` (D47): exhaust, fireball, the
  cloud's underside, crater glints. The flash is a CSS overlay above everything. Shake is an offset
  added where `world.position` is set (`Scene.ts:541`), which `lights`, `markers` and floaters
  already copy. Tints override `ambient.tint`.
- The rowboat is a shore prop from run 1, beside the skiff (today at `(548, 674)`) at about
  `(500, 660)`: the escape plan is visible all along.

### 7.2 Storyboard (U-Turn; impact `I` = 4,100 ms)

| ms | Beat | Layers | Sound | Crew |
| --- | --- | --- | --- | --- |
| 0-600 | HUD fades, camera eases out | CSS, world | siren holds, winds down to a clunk (400 ms) | look up |
| 0-900 | Scramble | world | footsteps, a gull | sprint to the rowboat; one runs back for the toaster (300-800) and dives in; 4 in the boat, the rest on a towed raft of drums (8 drawn at most) |
| 900-1,400 | Ignition: shudder ±2 units, three sputter puffs | world; firebox flare on `lights` | three coughs (60 ms noise, 300 Hz band-pass) | rowing |
| 1,400 | Liftoff | smoke every 40 ms; exhaust glow on `lights` | roar (noise, low-pass 200 Hz → 1.5 kHz) | pots on heads |
| 1,400-3,400 | The variant's path | world, `lights` | engine; a hiccup at the hover | one points |
| 3,400-4,100 | Back down onto the base (x 1,000) | world | whistle, 1.8 kHz → 500 Hz | all duck |
| I | Flash: CSS opacity to 1 in 80 ms, hold 60 ms, decay 600 ms; the island swaps to crater art at I+80 under full white | CSS | boom: low-passed noise (1.8 s) plus a 48 Hz sine (1.2 s); Android buzz 300 ms | |
| I+80 → I+1,300 | Fireball: three additive glow sprites (`0xfff3d0`, `0xffb765`, `0xff6f3c`, radius 60 → 520) | `lights` | rumble | |
| I+80 → I+800 | Shockwave ring (stroke 6, radius 40 → 900, alpha 0.8 → 0); 20 dust puffs along the ground | world | | boat rocks |
| I+80 → I+1,000 | Shake: 18 CSS px × e^(−t/250 ms), seeded; zoom punch 1.00 → 1.04 → 1.00 in 300 ms | camera | | |
| I+80 → I+3,000 | Tint: burnt orange `0xd86a4a`, ash `0x8a6f7e` from I+1,200, then the green of 9.3 | `ambient` | | |
| I+400 → I+2,600 | Mushroom cloud: 10 stem and 18 cap puffs (`puffTexture`), white → `0xffb765` → `0x6f7883`; underside glow `0xff8f5a` fading | world, `lights` | | |
| I+1,800 → I+2,600 | Ash begins; the "WIPE DAY #N" sign drops into the crater (I+2,300); a gull lands on it (I+2,500) | world, weather | debris patter; a 90 Hz thunk; a squawk | one waves the toaster |
| I+2,700 | The postcard slides up (300 ms) | React | paper swish | |

The U-Turn runs 7.1 s; impacts range from 2.6 s (Fizzle) to 4.8 s, so films run 5.6-7.8 s.

### 7.3 Flight variants

Drawn from `rng(seed(base, run))` so client and server agree; stored in the `nuked` payload and
the flights-seen list in `meta` from R2, so the Logbook backfills in R4. The first nuke is always
U-Turn; the first Wipe Day after an unlock plays the new one ("New flight: Loop-the-Loop" on the
postcard); otherwise unseen variants weigh ×3, none plays twice in a row, and Storm Rider flies
only in rain (then 50%), read from `island.json5`'s weather table so the server agrees. Small
blasts always play Fizzle. Each variant is one page of the Logbook's Flight log
(`05-meta-layers.md` 1.2).

| Variant (id) | How it flies | Impact | Unlocks | Ships |
| --- | --- | --- | --- | --- |
| U-Turn (`u_turn`) | climbs over the sea to x 260, hovers 300 ms, shrugs, turns and whistles home | 4,100 | #1 | R2 |
| Loop-the-Loop (`loop_the_loop`) | one full loop (radius 110) over the sea, then home | 4,300 | #2 | R2 |
| Sputter and Drop (`sputter_drop`) | rises 60 units, coughs, the engine dies, it tips and drops straight onto the base | 3,000 | #2 | R2 |
| Fizzle (`fizzle`) | small blasts: the frame hops off the pad, flops over, a modest pop and a smoke ring | 2,600 | any small blast | R2 |
| Boomerang (`boomerang`) | leaves on the left; 800 ms of whistle over an empty sky; returns from the right edge | 4,600 | #3 | R4 |
| Storm Rider (`storm_rider`) | rain only: lightning hits the cone at the apex (a bolt on `lights`), it spins home | 4,200 | #4 | R4 |
| Gull Strike (`gull_strike`) | a gull lands on the nose at the apex, the Kettle nods down under it, the gull leaves at the last moment | 4,400 | #5 | R4 |
| The Skipper (`skipper`) | skims the sea, skips three times like a flat stone, hops up the beach | 4,000 | #8 | R4 |
| Moonshot (`moonshot`) | straight up out of frame; a second of nothing and a twinkle (it passes the moon at night); straight down | 4,800 | #10 | R4 |
| Lawn Dart (`lawn_dart`) | flips at the apex, dives nose first, sticks upright in the yard for 400 ms, then goes off | 4,500 | #12 | R4 |
| Ricochet (`ricochet`) | clangs off the distant island's lighthouse (`terrain.back`) and bounces home | 4,500 | #15 | R4 |
| Rowboat Chaser (`rowboat_chaser`) | heads for the rowboat, the crew row like mad, it loses interest and turns home | 4,700 | #20 | R4 |

Canon names three variants for R2; Fizzle joins them because small blasts need it (resolution
3.1), and the other eight ship with the Logbook that collects them.

### 7.4 Skip and reduced motion

- No skip on Wipe Day #1. From #2 a **Skip** button (secondary, 44 px, top right) fades in after
  400 ms; only the button skips. It jumps to the I+2,600 frame and raises the postcard.
- **Reduced motion** (`prefers-reduced-motion` or the setting): no shake, flash, zoom punch or
  fast particles. The scene darkens to burnt orange over 600 ms with the Kettle as a still
  silhouette mid-air, cross-fades over 1,200 ms to the crater, sign and a still cloud, then the
  postcard: 2.5 s in all. Sound plays if on, the boom softened.

### 7.5 Pinning for `pnpm web:shots`

- The film is a pure function `frameAt(variant, seed, ms)` returning every position, alpha, tint
  and shake offset; particles derive from the seed, never `Math.random`.
- The dev hook gains `window.__wipeDay.cinematic.pin(variant, ms)`; a shot state takes
  `cinematic: { variant: "u_turn", at: 4180 }`; the demo drawer gets the same control.
- Named phases: `scramble` 600, `ignite` 1,100, `liftoff` 1,500, `flight` 2,800, `whistle` I−400,
  `flash` I+40, `fireball` I+400, `cloud` I+1,400, `settle` I+2,500. Minimum shots (full list in
  `08-screens.md`): every phase on a phone; `flash` and `cloud` at night and in rain; desktop
  `fireball` and `cloud`; one mid-flight frame per variant; the reduced-motion midpoint; the hold
  at 60%.

### 7.6 Performance on phones

At most 120 live pooled sprites (30 smoke, 28 cloud, 40 debris, 20 dust) from `glowTexture` and
`puffTexture`; no Pixi filters; the shockwave is one `Graphics`; the flash is CSS opacity; the HUD
is hidden, so its blur costs nothing; the crater swap is one redraw under the flash. Target 60
fps on a mid-range Android; if the first 500 ms average over 33 ms a frame, the film drops to
"lite" (half the particles, no shockwave).

### 7.7 Network failure, reload, two tabs

`nuke(state, now)` is pure (canon 13.2), so the client predicts the new run and plays the film
before the answer.

- **One key per hold**, minted when the hold completes and kept in `sessionStorage` with the
  command until answered. Retries and reloads resend the same key; a replay returns the stored
  outcome and the client adopts the current state (resolution 3.16), so one hold never becomes
  two nukes.
- **`nuke` carries the run number** (schema in `09-architecture.md`). A stale tab, or a replay
  after its 7-day record expired, is refused with `stale_run`, re-renders from the push and shows
  the real postcard.
- **Network failure mid-film:** the film and postcard run on the prediction with a small
  "Saving…" mark; the queue retries; the confirmed state replaces the prediction (if the gain
  differs, the postcard updates in place). A refusal cuts to the toast "That launch didn't go
  through: your island changed in another tab." with **Show island**.
- **Reload mid-film:** if the server has the nuke, the new run loads and the unseen postcard shows
  without the film; if not, the `sessionStorage` resend lands it. With no network at all and the
  tab closed, nothing happened: the old run is intact and the Big Red still crowned.
- **Two tabs:** the other tab gets the SSE push (the `bases` row keeps a monotonic `version`) and
  shows "Wipe Day #4 happened in another tab" with **See the postcard**.

---

## 8. The postcard

### 8.1 Front

A 3:2 card (358 × 239 CSS px on a phone): the player's own crater at that moment. The sky in the
palette of the nuke's time of day, the glassy crater with its **"WIPE DAY #N"** sign and gull, the
rowboat offshore, ash, and the flight path as a dotted line across the sky (the loop for
Loop-the-Loop, three splashes for The Skipper). The title in large-letter postcard style: "Greetings
from" (14 px bold, letter-spaced) over the place line (34 px bold block letters in glass green,
dark outline). A stamp with the Kettle silhouette and the gain; a round postmark "SALTMARSH · 07
OCT 2026". The picture is an SVG from one pure function, `postcardSvg(summary, look)`, in a shared
package (`packages/content` already shares `look.ts` with the bot; `09-architecture.md` decides),
so web and Discord show the same picture.

### 8.2 Title variants

| Title | When |
| --- | --- |
| Greetings from Ground Zero | Wipe Day #1, and the default |
| Wish You Were Here (It's Gone) · Having a Blast · Saltmarsh: Now With More Crater · The Toaster Made It | the default pool (seeded) |
| Greetings from Ground Zero, by Night | launched at night |
| Sunny Spells, Light Ash | launched in rain or fog |
| Having a Blast: New Record | a new best blast or fastest run |
| Postcard from a Puddle of Glass | a small blast (private; never posted) |

### 8.3 Back

It flips 1,500 ms after landing (a cross-fade under reduced motion); tapping flips it again.

```
Wipe Day #4 · Saltmarsh
Run time        23 h 41 m
Crater glass    +186           (Late Tide +x when it applied)
Glow            ×3.52 → ×5.24
Best line       Furnace, 41% of supplies
Flotsam caught  7
Flight          Loop-the-Loop (new)
Era reached     Sheet Metal

"Wish you were here. The toaster made it." Dax

NEXT: Wipe Day #5 unlocks ring 4 and a new flight.
```

The crew message rotates ("The gulls are fine.", "We kept the oars.", "Back soon. Very soon.").
Every number comes from the `nuked` event's run summary. The NEXT line names what the next Wipe
Day unlocks (shipped content only, section 12); a small blast's postcard repeats the cover card's
"Wipe Day #{n} needs +{need}".

### 8.4 Buttons (below the card)

- Wipe Day #1: one button, primary **Open the Blast Map** ("10 glass to spend"); the map's
  **< Rebuild** lands the boat (errata E6).
- From #2 (canon 5.4): primary **Rebuild**, secondary **Blast Map · 186 glass**. Nodes apply the
  moment they are bought, start-of-run nodes included, so rebuilding first never wastes glass.

### 8.5 Discord (R2 text, R6 image)

From R2 a counted Wipe Day's `nuked` event posts "Patrik pressed the Big Red. Wipe Day #4 on
Saltmarsh: +186 crater glass." to the feed and `#wipe-day-idle` (D124), subject to the news
throttle in `06-friends.md` 2.2. From R6 the post carries the postcard: the bot renders
`postcardSvg` with satori and resvg on its 600-unit phone layout (CLAUDE.md 11), with a stat strip
"+186 glass · Glow ×5.24 · 23 h 41 m · Loop-the-Loop". Small blasts post nothing. Late Tide is
never shown on the post, the boards or any shared surface; only the player sees it (errata E19).

---

## 9. The rebuild

### 9.1 The rebuild screen

Shown only when it offers a choice: Pockets (R5, from Wipe Day #2), keystone slots (R3, from #10)
or Dares (R7, from #5). Before that, Rebuild goes straight to the landing.

```
Rebuild Saltmarsh
POCKETS · 1 slot
[icon] Iron Tools (kept)      [Swap]
KEYSTONES · 2 slots
[icon] Wipe Day Rush          [Change]
       Afterglow holds ×5 for 60 min; Night Shift ×0.5
[empty] Pick a keystone       [Pick]
DARE (optional)
(•) No Dare
( ) Long Night: no Night Shift; flotsam ×2.
    Goal: reach Sheet Metal. Reward: Night Shift +4 h
[ Blast Map · 186 glass ]   [ Rebuild ]   one primary: Rebuild
```

The loadout defaults to the last; changes are free (canon 6.5) and travel in `set_loadout`
(`{keystones, foreman, deadHand}`). A keystone bought while a slot is empty slots itself at once,
so the screen only matters for changes. A full Pocket can be swapped here or later, until the
run's first purchase; an empty one fills any time (`05-meta-layers.md` 4). A chosen Dare, its
rules shown in full (canon 7.7), sends `start_dare`.

### 9.2 The landing (2.6 s; a tap skips it)

| ms | What happens |
| --- | --- |
| 0-1,200 | The rowboat paddles from x 420 to the shore |
| 1,200-1,500 | The crew hop out; one hauls the dented drum from the crater onto a fresh pad |
| 1,300-1,900 | A sapling pokes out of the glassy crater and grows into the Lone Pine (today's regrow pop) |
| 1,700-2,100 | A twig lean-to pops up (`Base.setTier("twig", true)`, squash and dust) |
| 2,100-2,600 | Kept hands walk to their lines (Mara to the tideline); Starter Kit lines (name on the naming-pass list; errata E27) pop in with badges |
| 2,400 | The HUD slides back; the drawer shows its crowned row; the Afterglow pill appears at ×3, waiting for the first tap |

Reduced motion: a 600 ms cross-fade. Dead Hand: a 1.2 s version. First time only, the hint
"Afterglow: taps ×3, fading. Tap!" (retires after two uses).

### 9.3 Green sky and ash

- **Sky:** the palette mixes toward an afterglow green (`skyTop 0x1f4a3a`, `skyMid 0x6fae6a`,
  `skyHorizon 0xcfe8a0`, `haze 0x8fbf7a`, `cloud 0xb8d8a0`, `ambient 0xd8f0c0`) by `1 − t / 600`,
  eased, `t` in real seconds since the landing (after a reload, since the run's start). At night
  the mix is ×0.6: a dark sky with a teal glow on the horizon. The sky is presentation; the
  Afterglow multiplier keeps its own clock (10.1).
- **Ash:** a new `ash` mode of `Weather` (`scene/effects.ts`): grey flakes (`0xb8b8b0`,
  `0x8a919c`), 70 on phones and 140 on desktop, falling 20-40 px/s, thinning with the green. Rain
  keeps drawing underneath (it changes flotsam odds, so it must stay visible).
- **Glints:** the crater rim's glass sparkles on `lights` (`0x6fd0a0`, at `0.3 × darkness`).

---

## 10. Afterglow and the crater

### 10.1 Formula and display

`Afterglow(t) = 1 + 2 × 2^(−t / 300)` *(sim)* on **tap value only** (canon 4.5): ×3 at the start,
the bonus halving every 5 minutes. `t` is real seconds since the **first tap of the new run**
(`run.afterglowFrom`, the first `taps` batch's `from`), so time on the postcard, Blast Map or
rebuild screen never wastes it. It ends 30 minutes in (×1.03), does nothing offline and never
speeds up with the demo clock. Taps arrive as commands, so settle needs no integral (canon 13.3).
Nodes change the constants through `afterglow`, `afterglow_half` and `afterglow_hold`
(`04-blast-map.md`): the general form is `1 + B × 2^(−max(0, t − hold) / h)`, ending 30 minutes
after the fade starts; the Wipe Day Rush keystone holds ×5 for 60 minutes, then fades.

| Time | 0 | 1 min | 5 min | 10 min | 15 min | 20 min | 30 min |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Taps × | 3.00 | 2.74 | 2.00 | 1.50 | 1.25 | 1.13 | 1.03, ends |

Display: a green pill under the rate in the top bar, `[afterglow] Afterglow ×2.4 · 6:40`, counting
down; an outer green arc around the target's Hustle arc shrinks with it; taps shed green sparks
and floaters are tinted `0xc8f0a0`.

### 10.2 The wipe-day rush

The first minutes of every run are the most tap-heavy of the game: only kept hands and Starter
Kit lines run, so taps carry most of the income, each ×3 Afterglow, ×Glow and the Grip nodes.
Purchases cascade: a Beachcomber on the first tap, Stone Tools within seconds, an era a minute in
*(illustrative; N5 and N11 are asserted)*. It is the brief's "click like crazy" beat, every run,
and it fades exactly as automation takes over.

### 10.3 The crater remembers

- **Depth:** a bowl under the base `6 × √N` world units deep (N = Wipe Days; small blasts do not
  deepen it), cut into `terrain.ground` from x 880 to 1,120 with a glassy rim (`0x2f6a5a`, glints
  `0x6fd0a0`). The drawing caps at N = 100 so the base stays readable; stats keep counting:
  "Crater depth: 5.0 m" at #25, 10.0 m at #100 (√N metres).
- **The sign** stands on the left rim. Its board is a world shape; its lettering is a screen-space
  label (D46): "WIPE DAY #12" on desktop, "#12" when the board is under 70 CSS px wide. Styles by
  count: nailed plank (1-9), painted board (10-24), metal (25-49), lit with bulbs on `lights`
  (50+); Island Count cosmetics add styles (R6).
- **A possible late power source:** option 2 of the late wall (resolution 3.24) may turn the depth
  into a small, capped bonus that grows with calendar time; `05-meta-layers.md` designs it and the
  simulator tests it before R7. Until the owner chooses, the crater is cosmetic.

---

## 11. Kept and lost (exhaustive)

| Thing | At a nuke | Ships |
| --- | --- | --- |
| Glass ever, glass held, formula level; Glow | kept | R2 |
| Blast Map nodes; keystones owned; the loadout (changed free at rebuild) | kept | R2 / R3 |
| Wipe Day count, the run number, records, lifetime stats | kept | R2 |
| Crater depth, sign style, flights seen, agenda unlocks | kept | R2 |
| Cosmetics, skins, titles | kept | R2 |
| Retired hints, the ×10/×100/Max toggle once unlocked, settings | kept | R1 |
| Hands kept by milestone (lines 1-3 from #3) and nodes (Old Friends, Old Crew) | kept; they walk to their lines at landing | R2 |
| Logbook entries, secrets, Morale | kept | R4 |
| Scrap (recorded from R2, 3 at the first Wipe Day; shown from R5), crew ranks, Pocket slots and contents (active from the first second) | kept | R5 |
| The Magnet's timer; Toolbelt unlocks and cooldowns | kept; they keep running | R5 |
| Foreman and Dead Hand settings | kept | R5 |
| Blowback crates waiting (no expiry; they pay on claim, relative to the run then) | kept | R6 |
| Blowback cursor, the Late Tide median (copied from `World.lateTide`, errata E18), Freighter loads this week | kept | R6 |
| Dares completed and their permanent effects | kept | R7 |
| Supplies held (already counted in lifetime) | lost | R1 |
| Every line unit, and so its milestones | lost | R1 |
| Shelf upgrades: Grip rungs, Line Mk II/III, island upgrades | lost, except pocketed ones | R1 |
| The era and target (back to Twig and the Lone Pine), fell progress | lost | R1 |
| Hands not kept; Hustle | lost | R1 |
| Buffs: Rally, Adrenaline Kit, Drowned Drone, Rush, Grit stacks | lost | R1 / R4 / R5 |
| Flotsam floating now; the run's flotsam schedule | lost; a new seeded schedule starts | R1 |
| Unmanned cycles in flight (`readyAt`), fractional remainders; the token bucket | lost / refilled | R1 |
| The Night Shift window | refills from the nuke | R1 |
| The previous Afterglow | replaced by a fresh one | R2 |
| The Kettle's stage; the run's peak rate | back to the pad / reset | R2 |
| An active Dare | goal met: reward granted; otherwise ends unfinished, free | R7 |

---

## 12. The agenda

Moved by counted Wipe Days only. The cover card names what this press unlocks ("Wipe Day #N
unlocks …"); the postcard names what the next one unlocks ("NEXT: Wipe Day #N+1 unlocks …").
When a count unlocks nothing, both name the next count that does.

| Wipe Day | Unlock | Ships |
| --- | --- | --- |
| 1 | Blast Map rings 1-2 and Ground Zero, Glow, Afterglow; the crater and sign; U-Turn | R2 |
| 1 | the Magnet; the first Wipe Day's 3 scrap appear | R5 |
| 2 | the Armored era; Loop-the-Loop, Sputter and Drop | R2 |
| 2 | Pocket slot 1 | R5 |
| 3 | hands for lines 1-3 survive nukes; ring 3 | R2 |
| 3 | Boomerang | R4 |
| 4 | Toolbelt: Rush | R5 |
| 4 | Storm Rider | R4 |
| 5 | ring 4 | R3 |
| 5 | Gull Strike | R4 |
| 5 | Dares | R7 |
| 7 | the Foreman for lines 1-6 | R5 |
| 8 | Toolbelt: Grit | R5 |
| 8 | The Skipper | R4 |
| 10 | ring 5, keystone slot 1, Night Shift +4 h | R3 |
| 10 | sign: painted board / Moonshot | R2 / R4 |
| 12 | Lawn Dart | R4 |
| 15 | Toolbelt: Flare | R5 |
| 15 | Logbook secret hints; Ricochet | R4 |
| 20 | ring 6, keystone slot 2 | R3 |
| 20 | the Foreman for all lines | R5 |
| 20 | Rowboat Chaser | R4 |
| 25 | Dead Hand (its node becomes buyable) | R5 |
| 25 | sign: metal | R2 |
| 25 | the Barge's keel, planks backfilled | when the Crossing ships (section 14) |
| 30 / 40 / 50 | rings 7 / 8 / 9; keystone slot 3 at 40 | R7 |
| 50 | sign: lit | R2 |

Rings 4-6 open in R3 with the nodes whose systems exist; R4 and R5 add the rest of their nodes as
those systems ship (`04-blast-map.md`). Rings 7-9 sit in data from R3, hidden until R7.

**Shipped only.** `agenda.json5` rows are added in the phase that ships their content, and a
content check refuses a row whose id the build lacks. Nobody reads about something that does not
exist yet (canon 12.3).

**Players past a gate** get later content when its phase deploys: a player at Wipe Day #9 when R5
ships gets the Magnet, 3 scrap, Pocket slot 1, Rush, Grit and the Foreman (1-6) at once. Their
next visit shows one "New on Saltmarsh" card (up to five lines, one primary **Show me**) and logs
`agenda_backfill`. The one-line hints then appear one at a time, each when its thing first matters,
and retire after two uses. Logbook entries derivable from records (eras, Wipe Days, flights seen)
are granted the same way when R4 ships.

---

## 13. Run lengths and edge cases

### 13.1 Targets (canon 5.7 with the amended N-numbers, asserted by the simulator)

| Phase | Run, active (P1) | Run, casual (P1) | N11: run N+1 passes run N in (median) | N12: combined power per nuke |
| --- | --- | --- | --- | --- |
| First nuke | 48 min continuous; the active archetype 20 online min over 5 h | the day-1 21:00 check-in | n/a | n/a |
| Early (nukes 1-5) | 20-40 online min over 5-13 h | a day | ≤ 65% | ×1.5-2.5 |
| Mid (to day 30) | about a day | a day | ≤ 95% | ×1.15-1.6 |
| Late (days 31-180) | about 4 days | about 4.5 days | ≤ 100% | ×1.1-1.5 |

N11 is warn-only until R7. No first nuke under 25 minutes on the wall clock, autoclicker included
(N2; P1: 40:30). N14: 6-10 nodes at the first nuke, a median of at least 2 later. The flattening
alarm (N13) fails the build when the product of five consecutive nukes' combined gains is under
×1.3 with nothing opening in the next three; it is also an input to the Crossing's trigger.

### 13.2 Edge cases

| Case | What happens |
| --- | --- |
| Flotsam floating at launch | It sinks with the island; the card's notes said so. A new schedule starts. |
| Blowback crates waiting | Kept; each pays `max(1 min of output, min(15% of held, 10 min of output))` when claimed (the Drift Crate's formula), so before or after is the player's call. The card says they stay. |
| Rally or Adrenaline running | The crown waits until it ends. Pressing anyway loses it; the card listed it. |
| Grit stacks or Rush active | Lost with the island, listed on the card; cooldowns keep running. |
| Afterglow still running | Replaced by the new run's fresh one; never stacked. |
| An active Dare | Goal met: reward granted at the nuke. Not met: ends unfinished, free; Dead Hand will not fire. |
| Double tap or double hold | The hold is the guard; the card closes at launch; one hold mints one key; a replayed key returns the stored outcome. |
| Two tabs | 7.7: the stale tab is refused (`stale_run`), re-renders and shows the postcard. |
| Taps in flight | Flushed when the hold starts, so the server's gain includes them. |
| Welcome back open | Its primary is Collect (rule 6.3.10) and it never crowns the nuke; the Big Red cannot open behind it. Offline production is already in lifetime. |
| Founders' 5 glass | Added to glass held only: no Glow, no effect on the 10% rule; the first nuke still needs a delta of 10. |
| A balance patch between press and answer | The server's numbers win; the postcard shows them. |
| The Discord bot | No nuke from Discord (owner decision 18): the bot's command route accepts only `collect`. Card v2 shows the yield, the readout and "Crowned: open the game"; a counted Wipe Day posts the news; a bot Collect after a nuke collects the new run and runs the Foreman pass when `meta.prefs.foreman` is on (errata E18). |
| Away at the peak | Nothing fires: Dead Hand is online only, and a full Night Shift window stops accrual, so a stalled run waits for its press. Rule 4 crowns it for the next visit. |

---

## 14. The Crossing (second layer, design hook only)

**Not built until its trigger fires**; nothing below appears in the game before then (the
never-tease rule).

- **Build trigger (a simulator call):** N13 firing (the product of five consecutive nukes under
  ×1.3 with nothing opening in the next three) plus a share of the Blast Map lit. Canon says 70%.
  The late wall (`10-balance.md` 5) is an owner decision before R7; the recommended option 1
  keeps a slow outer tree and lowers the trigger to **45% lit and N13 firing**, which the P1
  casual reaches around months 4-6 (47% lit at day 180). Option 2 (a fair calendar-time power
  source, 10.3) is designed and simulated before R7 either way. The trigger becomes a roadmap
  decision (`11-roadmap.md`, "Later, gated").
- **The Barge:** shown only once the Crossing ships. Every player past Wipe Day #25 then finds its
  keel on the beach east of the skiff (about x 600-720), with one plank per counted Wipe Day since
  #25, backfilled from the count, and one more per Wipe Day after. Planks read in steps: ribs
  (1-8), hull (9-16), deck (17-20), mast (21-23), sail (24-25). Its card: "The Barge · 14/25
  planks · Blast Map 38% lit (needs 45%)". Crossing needs both *(proposal; open question 2)*, so
  Wipe Day #50 at the earliest.
- **Sea Charts** `= floor(5 × log10(glass ever / C0))`, paid at the Crossing. Canon's `C0` is 1e6,
  set for the cube root; under P1 a first Crossing comes at glass ever about 5e5-4e6, where that
  pays nothing. `C0` is a data lever set to **1e4** *(sim)* (errata E21):

  | Glass ever | 5e5 | 1e6 | 4e6 | 1e7 | 1e8 | 2.9e9 (whole tree) |
  | --- | --- | --- | --- | --- | --- | --- |
  | Canon, `C0` 1e6 | 0 | 0 | 3 | 5 | 10 | 17 |
  | Set, `C0` 1e4 | 8 | 10 | 13 | 15 | 20 | 27 |

  A first Crossing at 45-57% lit pays about 8-13. The lit-share gate stops cheap repeat crossings.
- **Resets:** glass ever, held and the formula level, Glow, every node, keystone and the loadout,
  lifetime `L`, the run and the island. **Stays** (resolution 3.24): Dare rewards, Logbook pages
  (and so Morale), the Wipe Day count, agenda unlocks, scrap, ranks, Pockets and cosmetics, plus
  records and Saltmarsh's crater history. The Magnet, the Toolbelt, the Foreman and the keystone
  slots are agenda unlocks, so they stay and the second layer automates the first
  (`ref-patterns.md` 1.6); Dead Hand is a node, so it must be bought again.
- **The new island** (**Ironreef**, proposal): its own palette, five targets, lines and cost
  curve, so numbers fall back to the millions (N23). Charts buy **Chart nodes** that amplify whole
  sectors ("Grip sector effects ×1.5") and **island traits** for later islands: Sulfur Flats (the
  Furnace line ×100), Fogbound (flotsam ×3, offline −50%), Iron Shore (start in the Stone era),
  Long Chains (lines need inputs: the only place multi-good chains may return, canon 9).
- **Reserved in data now** (R0): an `island` field on lines, eras and targets, and
  `keepOnCrossing` on `meta` fields.

---

## Open questions

1. **Canon's cover-card example does not compute.** "+12 glass, Glow ×1.79 → ×2.35" (canon 5.4):
   from 10 glass ever, +12 gives ×2.17; ×2.35 needs +19. This file uses consistent numbers; fix
   the example when the canon moves into `docs/game-design.md` in R0.
2. **The Crossing's player gate.** 25 planks plus the trigger's lit share (45% under option 1, 70%
   otherwise) extends canon 9, which only gates the build. It waits for the late-wall decision
   before R7.

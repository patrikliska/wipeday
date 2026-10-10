# UI review log

One entry per card. Each iteration: what was wrong when I looked at the PNGs
(full size and 400 px), and what changed. Checklist: CLAUDE.md 4.6.

## `demo` (Phase 0) — prototype of the base overview card

States: `empty`, `normal`, `full`, plus `noassets`. Template: `src/render/cards/demo.tsx`.

### Iteration 1 — 4-column grid, icon + amount + rate per cell
- **Placeholder safety: failed.** With no icons supplied the cells read `MO`, `MF`, `SO`,
  `SU`: unidentifiable. Even with real icons, metal/sulfur/HQM ore look alike at the
  28 px they get on a phone. A cell must not depend on its icon to be understood.
- **Spacing.** 11 resources in 4 columns left a hole bottom-right. Bottom padding was
  28 px against 32 px on the sides.
- **Bug.** `12.4k/ 20k`: the space before the slash collapsed.
- **Empty state.** Eleven dimmed `0` cells plus an empty "Upkeep" bar for a tier that has
  no upkeep. It read as "everything is broken", the opposite of a welcoming first screen.
- *Fine:* 32-char name ellipsises cleanly; `9.9M` fits; FULL and DECAYING dominate the
  card in the worst-case state, which is the intended hierarchy.

### Iteration 2 — 3 columns, names in cells, tool tile, conditional upkeep
- Cells became: amount (30 bold) + rate (22 muted, right-aligned) on line one, resource
  **name** on line two. Every cell is now identifiable with zero art.
- A 12th "tool" tile (outlined in its tier colour) closes the grid: no hole, and it shows
  the thing that drives every rate above it.
- View model carries only discovered resources (decision D15); the empty state is now one
  calm row: Wood, Stone, Rock. Upkeep section is omitted when the tier has none.
- **Still wrong:** `Metal Fragmen…` and `Salvaged T…` truncated with visible room to
  spare (text column too narrow). The no-assets render fell back to a **serif** font.

### Iteration 3 — text column, font fallback
- Icon 56 -> 52 px and tighter insets gave the text column ~10 px more: "Metal Fragments"
  and "Salvaged Tools" fit; truncation now only happens where it should (32-char name).
- Font fallback fixed; later superseded by bundling Roboto Condensed (decision D7), so a
  zero-asset deployment now renders in the real card font.
- Shortened two locale names that could never fit a cell: "High Quality Metal" -> "HQM",
  "Jackhammer & Chainsaw" -> "Power Tools".

### Iteration 4 — port to satori/JSX (stack change)
Re-implemented as flexbox JSX; compared against the iteration-3 PNGs state by state.
- Same hierarchy and spacing. Flexbox `text-overflow: ellipsis` measures real glyph runs,
  so the 32-char name shows more characters than my manual advance-sum fitting did.
- Tier thumbnail placeholder now takes its initials from the entity (`ST` for stone)
  rather than the file name (`TS` for `tier_stone`).
- Checked at 400 px (`demo__full@mobile.png`): smallest text (22 px -> 11 px) is the
  `+1.2M/h` rate; legible, and it is the least important text on the card.
- Render time: 18 to 44 ms per state, warm (budget 150 ms).

### Owner screenshot, desktop (2026-09-22, live `/idle-debug card`)
- Works end to end: ephemeral Components V2 container, accent strip, card, detail line,
  three buttons with one primary. First cold render on the real bot: 130 ms (budget 150).
- **Finding:** on desktop Discord shows the 800x754 card at only ~370 px wide inside a
  ~530 px container: tall, near-square images get scaled down to a height cap. Legibility
  at that size was already checked (it is the @mobile render), so nothing is broken, but
  it means a card's *width* on desktop is set by its height. Phase 1 base card: keep the
  aspect wider (aim for at most ~4:3), or split very tall content across screens.
- Phone screenshot still to come.

### Known limits, accepted for Phase 0
- Emoji and non-Latin characters in player names have no glyphs in Roboto Condensed and
  will render as missing-glyph boxes. Needs a fallback font or stripping; must be solved
  before the Phase 1 base card ships, since real Discord names go on it.
- Accent (`#CD412B`) and danger (`#F05252`) are both reds. They never sit side by side on
  this card; on any future card where they would, danger gets an icon or label as well.

## `base` (Phase 1) — the home card

States: `empty`, `normal`, `full`, plus `noassets`. Template: `src/render/cards/base.tsx`.
Grew out of the Phase 0 demo card; what changed is driven by the desktop finding above
(tall cards shrink) and by the card's new job: show what the player *has*. Rates and
what is waiting to be collected moved into message text, so the PNG only re-renders
when stock changes.

### Iteration 1 — 4-column grid, tool as the last cell
- **Overflow: failed.** At 176 px per cell the tool tile lost its two most important
  words (`Stone To…` / `Gatherin…`, `Power To…`), and `Metal Fra…`, `Low Grad…` truncated.
- **Hierarchy: mismatch.** In the full state the status line said "collect now" while the
  advisor made *Tools* the primary button. Fixed in the advisor: a full storage is the
  check-in signal, so Collect leads there, before an affordable upgrade.
- Copy: `Nakeds's base`. The preview's "locked" tools fixture was actually affordable.
- *Fine:* 800x544 (3:2) at 11 resources; FULL in danger red is the first thing the eye
  lands on; the 32-char name ellipsises.

### Iteration 2 — tool strip, 3-row grid, slang names
- The tool became a full-width strip under the storage bar (icon, name in bold 26,
  "Gathering tool" in the tier colour on the right): no truncation possible at any
  tier name, and it reads as "this is what drives the numbers below".
- Two resource names shortened to what Rust players actually say: `Metal Frags`,
  `Low Grade`. Every name now fits its cell at the worst case.
- Vertical rhythm tightened (cells 76, gaps 10, margins 18) so 11 resources stay at
  800x592, inside 4:3; the empty state is 800x420.
- Possessive: `Nakeds' base`.
- Mobile (`base__normal@mobile.png`): amounts at 14 px effective are read first; names
  at 11 px are legible; the tool strip reads as one line.
- Placeholder safety (`base__noassets`): identical layout; tinted tiles carry initials
  and the names carry the meaning. Nothing depends on art.

### Iteration 3 (Phase 2) — per-resource storage
Storage became per resource (decision D26), so the card had to say *which* resource is
the problem.
- Storage row now names the binding resource: `Wood 964 / 1.5k`, or `Wood FULL` in
  danger red. A single anonymous percentage would send the player looking for the wrong
  thing.
- Every resource cell got a 4 px fill bar under the name, toned like the big bar. At a
  glance the whole grid shows which resources are near their cap; in the full state all
  eleven bars are red, which reads as "everything is capped" without a single word.
- Cell line heights tightened (30/24) to fit the bar in the same 76 px.
- Checked at 400 px: the hairline bars are still visible; `Wood FULL` is unmistakable.

## `inventory` (Phase 2)

States: `empty`, `normal`, `full`. Template: `src/render/cards/inventory.tsx`.

### Iteration 1 — 4 columns, count + name
- **Overflow: failed.** Half the names truncated (`Wood Sto…`, `Assault R…`, `Medical
  S…`, `Timed Ex…`). Unlike resources, items have no colour or icon the player knows
  yet; the name *is* the identity.
- `29388 items` bypassed the number formatter.
- *Fine:* hierarchy (count in bold 28 is the first thing read), tier-coloured frames
  separate rarities without shouting, the empty state is a calm dashed panel with one
  sentence pointing at the workbench.

### Iteration 2 — 3 columns, Rust names
- Three columns give each name ~160 px: everything fits at the worst case except
  `Coffee Can Helmet` (17 chars), which ellipsises after "Hel…" and stays recognisable.
- Fifteen item names shortened to what players say (`C4`, `Semi Rifle`, `Wood Box`,
  `Workbench 1`, `Syringe`, `Landmine`). These names also appear in the craft select, so
  the shorter forms help there too.
- `29.3k items` via the shared formatter.
- Worst case (24 kinds) is 1600x1714 at 2x: taller than wide, so desktop shows it
  smaller. Accepted: it is a hoarder's inventory, and the phone render (the common case)
  is unaffected.

### `base` (home), `tools`, `tools_done` component screens
Outlines: `preview/screens/base__{empty,normal,affordable,full}.txt`,
`tools__{locked,normal,maxed}.txt`, `tools_done__normal.txt`. Lint: ok in every state.
- One primary per state and it follows the advisor: Gather on a fresh base, Collect while
  on cooldown or when storage is full, Tools once the upgrade is affordable. The hint
  under the card explains exactly that button, and retires after two uses.
- Gather on cooldown stays visible as `Gather · on cooldown` (disabled) with the live
  `<t:R>` countdown in the details, never in the label (labels cannot tick).
- Locked upgrade: `Upgrade · need 180 wood, 80 stone` (34 chars, within the 38 allowed
  for disabled labels); Back becomes primary because leaving is the only useful move.
- Both sub-screens carry Back and Home. Four buttons on home, one row.

## Component screens

### `debug_card`
Outlines: `preview/screens/debug_card__{empty,normal,full}.txt`. Lint: ok in all states.
One primary per state, and it is always a state the viewer is *not* looking at ("Worst
case" from normal, "New player" from full, "Typical player" from empty); "Render again"
stays secondary because re-rendering what is on screen is only useful to watch the cache
hit. 3 buttons, one row, longest label 14 chars. Root screen, so no Back/Home.

### Owner screenshot, desktop (2026-09-22, live `/base`, Phase 1)
- Confirmed: exactly one home message after repeated `/base`; the wider card now fills
  ~565 px of the container (the 800x754 demo card got ~370).
- **Bug: "looks a bit blurry."** Cause: the PNG was rasterised at the 800 px design width
  and the owner's display is HiDPI, so Discord *upscaled* it (~565 CSS px = ~1130 device
  px). Fix: `layout.renderScale = 2`; cards are laid out in 800 units and rasterised at
  1600 px. Cost: 34-47 ms per card, 80-113 KB per PNG. Layout code is untouched.

### Phase 2 screens: `build`, `furnace`, `craft`, `inventory`, and the home additions
Outlines: `preview/screens/{build,furnace,craft,inventory}__*.txt`, `base__{furnace,building,decaying}.txt`.
Lint: ok in all 28 states.
- Home grew a second row (Furnace, Craft, Inventory) that only appears once the mechanic
  is relevant: ore in stock, a recipe affordable, an item owned. A fresh player still sees
  one row and one glowing button.
- Build status replaces the storage line while a build runs (`Upgrading to Stone · done
  <t:R>`); upkeep is one line (`Upkeep 🪵 -30/h · stock covers 2d 10h`) and turns into a
  red `DECAYING … drops a tier <t:R>` only after a full unpaid hour.
- Found in review: the base flashed DECAYING for up to 59 minutes every hour because
  upkeep is settled in whole hours. Fixed in the domain (`isDecaying` needs a full unpaid
  hour; decay production starts with that hour too).
- Furnace: one line per slot with a live finish time; the select lists each ore with
  `→ output · fuel · time` in its description, so the choice is fully informed without a
  confirm step. Take out is primary only when something is ready.
- Craft: affordable recipes first, locked ones marked 🔒 with what is missing; higher
  levels listed as one line each so the tree is visible (rule 3: nothing hidden).
- Build: cost vs stock, build time, what the tier unlocks, upkeep after, stock after.

### Phase 2b screens: `node`, `tasks`, and the home additions
Outlines: `preview/screens/node__{running,faded}.txt`, `tasks__normal.txt`,
`base__{barrel,tasks}.txt`. Lint: ok.
- Node run: four buttons `1`..`4`, the marker primary and the other three secondary; status
  carries the live fade timer; a hint line says what one hit banks. Once over, the four are
  disabled and Home is primary; the tone says perfect (green) or faded/missed (neutral).
- Home with a barrel: a details line with the live "gone" timer and a primary `Break barrel`
  in the second row; the hint explains it once. Home with tasks: one summary line with the two
  nearest unfinished tasks, and a `Tasks` button.
- Tasks: one line per task, `⬜/✅`, a five-block bar, `progress/target`, the reward with
  emoji. Back is primary because everything on it is done elsewhere.
- Checked against rule 9: the home message is now two rows of at most five; the node screen
  is two rows of four and two.

## Web prototype (apps/web), reviewed through `pnpm web:shots`

### Scene (desktop 1600×900, phone 390×844)
- **Iteration 1.** Sun glow was a 700 px white blob washing out half the sky; the node timer ring
  drew a stray line from the canvas origin (`arc` without `moveTo`); the shore was a hard diagonal
  wedge with wave lines crossing the sand; the ground was one flat green field; floating gains used
  muted resource colours and were hard to read.
- **Iteration 2.** Glow halved and dimmed; ring fixed; organic waterline (`shoreAt(y)`) with wet
  sand, foam and waves that stop at the water; hills sink below the horizon on the left so the bay
  opens onto the sea with an island and lighthouse; path from the door to the shore, tufts, flowers,
  pebbles; gains white with a dark stroke; camera zooms in 12% on desktop and puts the ground line
  at 72% of the viewport.
- **Iteration 3.** At noon the sun hid behind the top bar (arc lowered); rain kept a bright blue sky
  (new `gloom()` greys the palette by rain and fog and dims the sun); the Armored base's four
  furnaces plus kiln and press reached into the sea (furnaces now sit two by two with a back row
  and the whole station strip is scaled to 85%); night sand and foam read as a white strip (foam
  now fades with the light); grass doubled in density and size, dirt patch softened; phone ground
  line moved from 58% to 66% so the base fills the middle of the screen.
- **Iteration 4.** Dock sub-label "need 38k ingots" wrapped over the button name on the Sheet Metal
  tier; the dock drops the "need" prefix, clips with an ellipsis and buttons are 4 px wider.

### HUD
- **Iteration 1.** Dock sub-labels wrapped on phones and the demo toggle overlapped the dock; the
  bottom-sheet panel hid its last card under the dock; the craft panel recommended crafting a second
  Workbench.
- **Iteration 2.** Phones hide dock sub-labels, the toggle moves under the resource strip, the sheet
  body pads for the dock; stations and utilities read "Built" once owned and sort below craftable
  items; landscape phones get a compact top bar and dock.
- Checklist status: one primary button per screen (advisor: gather → upgrade → furnace → craft);
  every disabled button carries its reason; all text ≥ 11 px on phones; nothing touches the edges.

### Floating gains (`desktop_gains` 1920×1080, `phone_gains` 390×844 @3x, crops `*__zoom.png`)
- **Owner screenshot (desktop).** `+43 Iron Ore / +169 Stone / +222 Timber` over the base was
  blurry. Cause: floaters lived in the zoomed world, so Pixi rasterised 22 px text and the camera
  stretched it 1.35× on a 1080p screen (1.8× at 1440p), outline included. Reproduced in the first
  `desktop_gains__zoom.png`. The same crop showed two more faults: each line had its own random
  sideways jitter, so the stack looked ragged, and the smallest gain sat on top.
- **Iteration 1.** Floaters moved to screen space (D46): rasterised at the display's resolution,
  drawn 1:1 and snapped to whole device pixels; only the anchor follows the camera. Size in CSS
  px, 22 on phones and laptops up to 28 on big screens (the old formula reached 40 px at 1440p);
  outline 20% of the size. One jitter per stack, lines centred in one column, biggest gain on top,
  line height 1.2 so outlines never touch.
- **Checked.** 1080p crop: sharp glyph edges, clean outline, stack centred over the roof. Phone
  crop: as sharp as the rest of the canvas. Accepted limits: the 0.2 s pop at the start scales
  the text up to 1.22× (soft for a moment, while it moves); on 3× phones the whole canvas renders
  at 2× and the browser scales it, text included.

### Furnace (`furnace_idle`, `furnace_lit`, `furnace_night_hqm`, crops `*__zoom.png`)
- **Owner screenshot.** The furnace read as a grey blob: a dome with a brick grid spilling past
  its outline, a plain black rounded box for a mouth, and no chimney although smoke rose from it.
- **Iteration 1.** Redrawn as a stone smelter: plinth with a contact shadow, a tapered body whose
  stones follow the taper (varied widths and tones), light from the left and shade on the right,
  an iron band with rivets, a capstone, a chimney pipe (smoke now leaves from its top), and an
  arched mouth with a voussoir ring and a grate. Working: lit interior, ember bed, flames.
- **Iteration 2.** At night the four top-tier furnaces bleached almost white and their flames
  turned olive: the night tint (`0x4a5a8a`, multiply) sits over the whole world, so no fire
  colour survived it. Station fire and glows now live on a light layer above the tint (D47);
  the furnace glow shrank (150 → 120) and dimmed at night so four of them do not merge into one
  blob. Checked: day idle and lit read as one object, night flames stay orange.

### Node marker (`node_marker`, crop `node_marker__zoom.png`)
- **Owner screenshot.** The marker was so big that tapping the middle of a rock always hit:
  hit radius 36 world units against a spread of ±30 × 32, so there was nothing to aim at.
- **Iteration 1.** Hit radius in screen pixels (D48): 14 for a mouse, 22 for a finger; the white
  ring is drawn at exactly that radius, the timer arc just outside, a centre dot, and the next
  spot lands at least 2.5 radii from the last. Glow still flooded the ring.
- **Iteration 2.** Glow reduced to 2.6× the radius and dimmer: the ring edge is the first thing
  seen, the arc second.
- **Owner screenshots, round 2.** (a) The hit text (`+12 Timber`) and the count (`2/5`) appeared
  at two fixed spots, sometimes far from the node; (b) the marker could be hidden behind smoke or
  other effects, and taps on it were lost.
- **Iteration 3.** The marker, ring and a circular tap target moved to a top layer (above
  particles, the foreground, the night tint and the weather), aligned with the world; a tap
  inside the ring always counts, even where another node overlaps it. A hit's gain and count now
  rise together from the hit point, 22 px above it, and the next hit fades the previous text
  out, so quick hits never pile up (`node_hits` shows two hits at night: one clean stack, the
  marker bright and on top).
- Found, not changed: a hit on a rock banks Timber too, because the prototype store pays a slice
  of the tool's whole production for any node. The real domain (W1) should pay the node's own
  resource.
- **Owner feedback, round 3.** "Perfect!" and "Missed" still appeared at a fixed spot high above
  the node, and the 14 px ring was too small. **Iteration 4.** Both texts now appear at the
  marker's last position ("Perfect!" 62 px above it, over the bonus gain; "Missed" just above
  it), the previous hit text fades when the run ends, and the ring grew to 18 px (26 on touch).
  `node_perfect` shows a full run: "Perfect!" and "+12 Timber" right above the rock.

### Survivors (`survivors`, 2× crop `survivors__zoom.png`)
- **Owner screenshot.** Walking legs swung from the feet (pivot at the ground), and the figure
  itself was a capsule with stick legs and arms fused to the torso.
- **Fix.** Legs pivot at the hip. Redrawn as a three-quarter figure facing where it walks: jacket
  lit from the left with a collar, seam, pocket and belt; trousers and boots with toes; hair,
  ear, nose and a hint of cheek; a hat shape per survivor (cap, beanie, bush hat) in their hat
  colour; perk props (scavenger backpack, mule big pack, medic armband, demolition hi-vis,
  marksman rifle). Arms hang from the shoulder: they swing against the legs when walking, chop
  while working, and hug a crate at chest height when carrying (it used to float over the head).
- **Iteration 2.** The front arm hung down the middle of the chest over the buckle and read as a
  stump; both arms moved to the shoulder edges. Checked at 2×: three survivors tell apart at a
  glance by hat, colours and props. Walking and carrying are not in any shot (actors move on
  their own timers); check them live.
- **Owner screenshot, round 2.** "Something behind the head": the hair was a larger circle behind
  the face, so a dark crescent stuck out past the back of the head. **Iteration 3.** Hair is now
  a patch inside the head's outline (back of the head and a sideburn, under the hat).

### Ore and sulfur rocks (`ore_node`, `sulfur_node`, 2× crops)
- **Owner screenshot.** A flat grey polygon with orange polka dots; the largest dot spilled past
  the outline at the top.
- **Iteration 1.** A small outcrop: a faceted main boulder (lit top, dark right side, a ridge
  line), a second rock behind, pebbles at the foot; ore as nuggets along three cracks, sulfur as
  crystal clusters. The veins read as a connect-the-dots diagram (thin dark lines between
  nuggets), and the white glints looked like dots.
- **Iteration 2.** Veins became mineral bands that taper at both ends, in a darker vein tone;
  nugget glints smaller and softer; the iron ore colour warmed to rust (`0xa8603a`). Checked at
  2×: iron reads as rusty seams, sulfur as yellow crystals, nothing leaves the silhouette.
- **Owner feedback.** The round pebbles and the oval shadow looked out of place next to the
  faceted boulder. **Iteration 3.** Pebbles are small faceted stones with a lit top; the shadow
  is an irregular flat polygon hugging the base, longer on the right (away from the light), with
  a darker contact band under the boulder. No rounded shape is left on the rocks.

### Node rim (experiment, after commit 540baaf)
- **Owner request.** Nodes should look clickable. **Iteration 1.** A white rim behind every node:
  eight silhouette copies offset 2.2 world units (thinned to 1.4 on owner feedback), whitened by one `ColorMatrixFilter`, at 50%
  alpha, easing to 95% under the pointer. The rim follows the tree sway and the hit shake;
  shadows and pebbles are left out so it traces only the rock or tree. Checked in `desktop_day`
  and the rock crops: every node reads as interactive at a glance; the rim is soft rather than
  crisp and also runs along the rock's base line. Kept or dropped after the owner tries it.
- **Owner feedback.** Rim thinned to 1.4 world units: "looks great now".

### Fibre patch removed
- **Owner request.** The fibre node (tall stalks with round heads) read as "weird grass". Removed
  from the scene (`fibre_1` in `Scene.ts`). Nothing is lost in the prototype: fibre accrues at the
  same rate, since any node pays the tool's whole production mix. `drawFibre` stays for a proper
  flax or hemp plant when W1 gives each node its own resource.

### Beach rebuilt (owner: "so weird, few items are too small few are overflowing")

- Iteration 1 (what was wrong): the sea was a plain rectangle that ran ~200 units past the waterline, so deep water showed on both sides of the sand strip and ended in a hard vertical edge against the grass. The sand looked like a road through the sea. The shoreline barely slanted, the barrel sat mid-sand, and the ore rock sat on the sand edge.
- Iteration 2 (what changed): the sea sprite is now masked to the waterline, so nothing shows past the beach. The shoreline slants toward the viewer (0.2 per unit) and moved right (SHORE_X 540) and the beach widens with depth (`duneAt`). The beach has dry sand, a sun-bleached upper band, wind ripples, wet sand, a faint tide line, driftwood and faceted beach stones. A fringe of sandy dune grass hides the seam where sand meets meadow. The barrel moved onto the wet sand (x 540) and the ore rock moved inland (x 705). Phone focus moved from 930 to 845, so a phone sees the water, the beach and the barrel next to the base (the first try at 880 showed the beach but no water).
- Checked in Chrome (1456 px) and on desktop_night: the beach reads as one coherent strip, and the night tint keeps it readable.

### Barrel on the shore (owner: "improve how barrel on shore looks like")

- Before: a flat blue rounded rectangle with three stripes and an orange dot. It bobbed up and down as if floating, even though it sits on sand.
- Iteration 1: redrawn as an oil drum.
  - Tipped over a little, with cylinder shading in vertical strips.
  - Two rolled ribs that curve because we see the drum from slightly above.
  - An elliptical lid with a rolled rim and a bung.
  - Chipped paint, rust patches and kelp draped over the rim.
  - The white rim outline the nodes use, which strengthens on hover because the barrel is tappable.
  - No more bobbing: the drum only rocks slowly. The tag is a badge with a dark edge.
  - Problem found: the sand heap in front was a flat grey-brown slab that read as a ramp, and its shadow stuck out.
- Iteration 2:
  - The drift became a curved mound of dry sand with a light crest and a soft base line.
  - The shadow shrank to a short damp patch on the lee side.
  - A rust band runs along the foot of the drum where it sits in the wet sand.
- New `barrel` shot (2x crop). The ore moved, so the ore, node run and marker shot clicks and crops were re-aimed. node_hits confirms the click starts a run.
- Iteration 3 (owner: "dialog window arrow is a little bit out of box", "barrel is a little bit overflowing sand"):
  - Badge: it was a stroked rounded rectangle with a separately filled pointer, so the dark edge stopped at the pointer and the pointer looked detached. Badge and pointer are now one path with a rounded join, filled and stroked as a single shape. It also gains a soft drop shadow, a darker lower half and a top highlight.
  - Sand: the tilted drum's lower corner poked out below the mound. The drum now sits 1 unit lower, and the mound is wider and taller (peak -11, base at +4) with a curved underside, so both corners are buried.

### Stone node and worked-out nodes (owner: "add stone node and make all nodes destroyed when user collects them")

- New `stone_1` (x 1150, in the clearing, visible on phones too): the same faceted boulder with no mineral. Instead it has cracks, a pale chipped facet and a cap of moss, so it reads as "just rock" next to the ore and sulfur.
- Each node now pays only its own resource (`NODE_TYPES` in `world.ts`): trees give timber, stone gives stone, ore gives iron ore, sulfur gives sulfur ore. A stone by-product on ore and sulfur was tried and dropped. At a share of 0.2 it still out-yielded the sulfur ore, so a sulfur run showed "+14 Stone" (owner screenshot).
- A run with at least one hit uses the node up. The tree tips over away from the base, slowly at first and then fast, and lands in dust and leaves. A rock crumbles flat in a burst of chunks. Regrow times are in real seconds whatever the game speed (owner: "player must play the game not wait"): tree 20 s, stone 20 s, ore 45 s, sulfur 2 min. They run on `realClock` in the store, which follows the wall clock rather than the game clock. It keeps counting while the tab is hidden (owner: timers should keep running offline).
- Iteration 1 (`nodes_depleted`), what was wrong:
  - The rubble was four small pebbles and could not be read at desktop scale.
  - Both tree stumps were hidden behind the furnace and the crates.
  - The 9 px regrow clocks sat inside the node layer, so the same stations covered them.
- Iteration 2, what changed:
  - Rubble is the broken-off foot of the boulder: a jagged, paler top and a dark side, with chunks around it and flecks of ore or sulfur crystals (moss for stone).
  - The clocks moved to the marker overlay, above everything, at 11 px with a dark disc and a white rim. The pie is in the colour of what grows back.
  - tree_1 moved 14 units right, so its stump peeks out between the furnace and the box.
  - All five clocks now read at 1080p. The tree_2 stump stays behind the crates, but its clock marks the spot.
- Tapping a stump or rubble floats "Iron Ore back in 32s" (or "1m 40s"). Survivors skip worked-out nodes and stop working at a node that goes. The Gather button's shake picks a tree that is still standing.
- New shots: `stone_node` (2x crop) and `nodes_depleted`.

### W0: injected clocks (no visual change intended)

The store's fake clock was replaced by injected demo clocks (D51), so every shot was re-run and
compared with the previous set.
- Iteration 1, what was wrong: every shot that jumps the time (night, dusk, other days, the
  build in progress) showed an "A barrel washed up on the shore." toast. The old `paused: true`
  skipped `tick()` entirely. With stopped clocks `tick()` still ran its barrel expiry and spawn
  checks against the jumped time.
- Iteration 2, what changed: `tick()` returns early when neither clock has moved, which is
  exactly the old pause. All 40 shots match the previous set again: time of day, day number, the
  "lands in 3h" build timer, the welcome-back deltas, and the rubble, stumps and regrow pies in
  `nodes_depleted` (checked on two repeat runs; the crops differ only by the walking survivors).

### W1: the client on the server (HUD rewritten on the domain, login, welcome back)

Every HUD component now reads the domain (craft status, furnace progress, the advisor) and the
locale; the scene reads the store's `base`. Reviewed all 40 shots (demo mode) plus a live
end-to-end run against the API (login screen, a fresh base after logging in as a test player).
- Iteration 1, what was wrong:
  - Resource tiles took their letters from the names, so Iron Ore and Iron Ingots read "IO"
    and "II".
  - The advisor's hint line sat at 112 px and slid under the dock when the primary Gather
    button made the dock taller (twig base, 1600x900).
  - The full-storage hint said "Collect" while the glowing button was Gather (which banks too).
  - Kiln and press descriptions said "(W3)", a planning code players should never see.
  - End to end: a fresh base showed "Storage is full" (advisor fallback, D67).
- Iteration 2, what changed:
  - Fixed tile letters per resource (TI, ST, OR, IN, SO, SU, FI, HI, FA, FU, SC).
  - Hint line at 128 px on desktop, 96 px on phones; clear of the dock in every shot.
  - Hint texts rewritten to match the button that glows; station effects say "comes later".
  - Advisor fallback fixed and tested.
- Still open: when the advisor points at the barrel, no dock button is primary (the barrel's
  badge in the scene carries it). A disabled Gather can be the primary while it counts down;
  the label says when it is ready.
- New states: the login card (over the dusk scene) and the Welcome back modal with the away
  time and gains; both read well on a phone.

### W2: buildings around the base, the build panel

New shots: `buildings_level1`, `buildings_level3`, `buildings_night`, `buildings_construction`,
`phone_buildings`, `phone_buildings_full`, `desktop_panel_buildings`, `phone_panel_buildings`,
`phone_panel_buildings_busy`. Reviewed all 49 shots over three iterations.
- Iteration 1, what was wrong:
  - Phone (390 px): the camera showed x 465 to 1225, so everything right of the door
    (workbench, crates, kitchen, loom, tannery, radio mast) was cut off. A full base spans about
    880 world units.
  - Left of the house, the watchtower, dock, barrel, bunkhouse, kiln, generator and furnaces
    piled into one blob, and the dock sat behind the barrel.
  - The slope buildings were drawn after the wall, so the fence cut through them. At level 1,
    most of them hid behind the furnaces.
  - The radio mast and loom were invisible behind the kitchen at level 3.
- Iteration 2, what changed:
  - Phone view widened to 880 units and centred on x 905 (D75).
  - Kiln and press moved up the slope. The tannery moved to the yard, the crates to the house
    wall left of the door, and the dock out over the water left of the barrel.
  - Slope buildings now draw before the wall, so they peek over it. The kitchen lost its side
    table and fits the strip.
  - The ore rock moved forward to the sand's edge, clear of the furnaces.
- Iteration 3, what was still wrong, and what changed:
  - The kitchen was cut at the phone's right edge: focus moved to x 915.
  - The loom was still hidden: the loom and generator went further up the slope.
  - The sulfur rock showed half a rock at the edge: moved inside the view.
  - The level 3 electric furnaces were the same blue-grey as the Armored wall: now warm dark
    steel.
  - The workbench lamp flared white at night: smaller and dimmer.
- Build panel:
  - The tier card said "1 furnace slots · 1 builders": now "furnace slots 1 · builders 1".
  - Construction bars were the accent red, which reads as danger: now the builder amber, the
    scaffold's colour in the scene.
  - On phones, the advisor's hint pill sat on top of the open bottom sheet: it now hides while
    a panel is open.
- Harness:
  - The furnace shots showed unlit furnaces: their jobs predated `perHour`, so progress was NaN.
  - After the camera move, every crop and node click point moved about 59 CSS px at 1920 wide.
    All of them were re-aimed.
  - New `scrollTo` option to shoot the Buildings section of the panel.
- Still open:
  - On phones the scene sits in the lower half, under a lot of sky, and the crew are small
    (about 17 CSS px). A full base needs the width. Raising the ground line on tall screens is
    a camera change for later.
  - The tannery racks stand in front of the furnace block and read a little like a table.

### W3 M0: worn nodes (owner: a missed streak must not destroy the node)

New shot `worn_nodes` (2x crop): the ore rock at 3 hits, tree_1 at 4, the stone at 2.
- Iteration 1, what was wrong: the rock cracks were plain dark lines that read as drawn on. The
  tree's axe notch sat at the foot of the trunk, hidden behind the crates by the cupboard.
- Iteration 2, what changed: each crack has a pale lip under it, so it looks cut into the
  rock. The notch moved to chest height, where it shows between the crates and the canopy.
- The miss floater now says how far the node is ("Missed · 3/5"), and the cracks grow live with
  every hit of a run.

### W3: the recipe browser, parts in the inventory, stations at work

New shots:
- craft: `phone_craft`, `desktop_craft_busy`, `phone_recipe_bow`, `phone_recipe_bow_tree`,
  `desktop_recipe_frames`;
- inventory: `phone_inventory`;
- scene: `stations_busy` (with a crop), `stations_busy_night`.

`desktop_building` was fixed: it still set the pre-W2 `build` field, so it had shown no
scaffold since W2. The panel shots moved to the new crafting state. All 58 shots were
reviewed over three iterations.

- Iteration 1, what was wrong:
  - The station tabs were squeezed to a thin line with no labels: the panel body shrinks its
    children, and the tab row had no `flex: none`.
  - Wording counted runs ("Makes 10 per batch unit", "6 of 20 units", stepper "1", "All you
    can · 0"): jargon a player should never see.
  - The web bundle never loaded `crafting.json5` and silently ran on defaults (1 slot, runs of
    1). Found in code while wiring the panel; now an error (D81).
- Iteration 2, what changed and what was still wrong:
  - Everything is counted in outputs: "Planks ×200 · 60 of 200 done", stepper "2", "All you can
    · 8".
  - Still wrong:
    - the cost chips were unstyled outside a card ("PL 10IN 8");
    - the locked button said "Need need 5 rope";
    - the recipe header said "Makes 2 at a time" and "2 every 4m";
    - "Used for" ran to three lines.
- Iteration 3, what changed:
  - Cost chips styled anywhere in a panel.
  - "Make · need 5 rope".
  - The header says "Makes 2 every 4m" once.
  - "Used for" names six and adds "and 6 more".
  - The Parts heading in the inventory was a whole sentence in capitals; now a short heading
    and a hint.
- Scene:
  - The progress ring over the workbench sat inside its level 2 tool board (its footprint
    height predated the board): raised.
  - At night the ring's dark disc vanished against the sky: it has a pale rim now.
  - The kiln and press used to smoke all the time, so smoke meant nothing: now only while
    they work.
- Checked against 6.3:
  - One primary per view: Make Planks, the part the next tier needs; in a recipe, the Make
    button.
  - Every locked recipe says why: "Build a Tannery first", "Needs Workbench level 2",
    "Blueprint needed".
  - Every short input has a Make or Furnace button.
  - The detail view has a back button to its station.
- Still open:
  - The scene floater from a station behind the side panel (desktop) is partly covered.
  - Station tabs past the fifth scroll sideways on a phone with no visible hint that more
    exist.

### W4a: the island map, the trip confirm, the report card, the crew

New shots:
- map: `map_fresh`, `map_desktop`, `map_site_desktop`, `phone_map`, `phone_map_region`,
  `phone_map_site`, `phone_map_site_odds`;
- reports: `phone_report_success`, `phone_report_fail`;
- crew: `phone_crew`.

68 shots in all, no console errors.

- Map, iteration 1, what was wrong:
  - The five known regions were still under fog in every shot: the fog eased out over a few
    seconds even on the first frame.
  - The ruins were hidden under the fog.
  - The advisor's barrel hint sat over the map.
- Map, iteration 2, what changed and what was still wrong:
  - Fog snaps to its state on first show and parts slowly only when a scout returns.
  - The hint pill hides while the map is open.
  - Still wrong:
    - ruin markers were oversized, about 30 CSS px, the Beach Wreck's covering the holdfast;
    - "Quarry · 1h 30m" ran into "Pine Ridge";
    - the island left room unused on a phone.
- Map, iteration 3, what changed:
  - Markers are drawn 22 px across, with a 48 px tap area kept apart from the drawing (D48).
  - The holdfast sits north of its region's centre, its name above its roof.
  - Regions without ruins centre their name.
  - The island fills the phone's width.
- Trip confirm:
  - The loot line read "24–144 food, 36–216 fibre", which suggests all of it. It now says "3
    hauls, each one of: 24–48 food, 36–72 fibre…", which is the truth.
  - "There and back" wrapped in the odds box: now "Time".
  - The party picker dims and explains who can't go ("Out on a mission", "Hurt: resting").
  - One primary button: Send.
- Report card: the outcome in its colour, a story line with every name, loot chips, what was
  mapped, XP and level-ups, injuries in amber, and "Send again" or "See it on the map".
- Crew panel: gear dropdowns for survivors away looked enabled: now dimmed.
- Still open:
  - On desktop the side panel covers the island's east coast; it can be panned.
  - The map has no night look yet.
  - The crew panel's big faces are placeholders until portraits exist.

### W4b: the crew at work, the far north and the sea, the feed

New shots:
- crew: `phone_crew_jobs`, `phone_crew_tired`, `phone_crew_chip`;
- map: `phone_map_north`, `map_north_desktop`;
- sites: `phone_map_sea_site`, `phone_map_sea_odds`, `phone_site_keycode_locked`,
  `phone_region_open_water`;
- reports: `phone_report_events`;
- feed: `phone_feed`, `desktop_feed`, `phone_feed_dot`;
- scene: `scene_workers`, `scene_workers_night`.

83 shots in all. The shot fixtures now carry jobs and shifts.

- Squad, iteration 1, what was wrong:
  - The status line repeated the job ("TREE · +36 TIMBER/H") right above the job dropdown
    that says the same.
  - The new crew chip in the top bar squeezed to "7/7 · 2" next to "Sheet Metal base".
- Squad, iteration 2, what changed and what was still wrong:
  - The status line says how they are, not what they do: "At work" (green), "Tired: half
    pace until they rest" (amber), "Asleep · up in 5h", or free.
  - The job dropdown is teal and shows what it adds ("Tree · +36 timber/h", "Workbench · 45%
    faster", "Guard · +10 defence"), with the Rest button beside it.
  - "Rest the tired (n) · 8h" is the panel's one primary button when anyone is tired.
  - Still wrong: with the identity allowed to grow, the clock dropped to a second row.
- Squad, iteration 3: the identity takes only what the crew chip and clock leave (flex basis
  0); its tier line ellipsizes ("Sheet Meta…") while the chip reads "7/7 · 6 tired" in full.
- Crew chip: the blue SQ tile was unreadable on the red glow; it turns white like the dock's
  primary glyph. The hint text was four lines, now one sentence.
- Map:
  - The north is tundra with rails and snow, the sea regions are open water with a red buoy,
    and sea lanes are white dashes.
  - Open Water sat under the desktop top bar; it moved south to (55, 240).
- Confirm screen:
  - "Might happen on the way" tags (ambush in amber, cache, the stranger) and the bonds in
    green.
  - A keycode block: what is spent and what is left, or which site drops one, with a button
    there (rule 2, never a dead end).
  - A locked site pointed at the Cannery (15%) instead of the Ferry Terminal (40%): the
    likeliest source comes first now.
- Report card:
  - "Mara found someone hiding… Wren joins the crew" said the rescue twice. The event line
    now names them: "Mara found Wren hiding in the ruins and brought them home to the crew."
  - Keycodes found are in green.
- Scene, iteration 1: workers bunched at the door, because newcomers walked to the house
  before their post and node workers carried every haul home.
- Scene, iteration 2:
  - Newcomers walk straight to their post, and the first cast starts there.
  - A node worker carries a haul home about one turn in three.
  - Sleepers lie by the fire with a "z" (drawn the right way round whichever way they face).
  - Workers keep at it through the night; the free rest.
  - Fibre has no node drawn, so fibre workers work by the loom.
- Feed:
  - Each line names the player ("You" on a tinted row with a YOU tile).
  - Long names wrap cleanly.
  - The clock chip carries a red dot for news.
  - The notification settings sit under the feed, with "Turn on" as the one primary when
    this device is off.
- Still open:
  - The scene does not say who works where on a tap. Tapping a survivor could open their
    card (W6 or later).
  - The map has no night look yet (carried over).

## W5: the Den (market, contracts, games, ranks)

New shots:
- the Den: `phone_den_market`, `phone_den_players`, `phone_den_sell`, `phone_den_sell_pick`,
  `phone_den_contracts`, `phone_den_closed`, `desktop_den`;
- the games: `phone_den_wheel`, `phone_den_slots`, `phone_den_bones`, `phone_den_capped`,
  `desktop_den_wheel`;
- ranks: `phone_ranks`;
- scene and map: `skiff_day`, `skiff_night` (both with a `__zoom` crop), `skiff_desktop`,
  `map_den_locked`.

Fixture: `DEN()` in `shots.mjs` is a Stone holdfast on day 9 with the Den open, one
contract to deliver and one listing up.

- Market, iteration 1, what was wrong:
  - "From other players" was empty. The demo's seller listed at page load, so by the
    shot's day 9 everything had expired.
  - A big gap between each section header and its one-line hint.
  - The scrap wallet was a full-width card. It pushed the counter below the fold.
- Market, iteration 2, what changed:
  - Hollis's demo listings are made fresh on every look.
  - Each listing says how it compares with the Den's rate ("Below the Den's rate · 1d 6h
    left").
  - The wallet is a chip at the end of the tab row ("SC 640").
  - The hint sits under its header.
  - One primary per view: the counter's offer the next upgrade lacks ("Your next upgrade
    needs planks"), else "Sell something".
- Sell form: a 14-day bar chart of what players paid, with the Den's rate as a dashed
  line. Below it, steppers for the amount and the price ("Den rate 25" resets it), then one
  line on the terms ("The Den keeps 2 scrap now. You get 40 when it sells; unsold, it comes
  home after 48 h"). The list button says what and for how much, or why not ("The Den will
  not go below 18").
- Contracts: the flavour line in italics, a have/need bar, the pay in the corner and
  "Deliver · +12 scrap" as the primary. A dot on the Contracts tab when one is ready.
- Games, iteration 1, what was wrong: on a phone the limits, the chips and the game tabs
  came first. The wheel and every bet button sat below the fold.
- Games, iteration 2, what changed:
  - The game comes first: wheel, reels or dice, then the outcome, then the options.
  - The chips sit right above the one primary bet button ("Bet 10 on Gull · wins 22").
  - Today's limit bar and the fine print go last.
  - The wheel is 168 px on phones; the reels and dice shrink too.
- Wheel: slices in proportion to their odds, the pointer at 12 o'clock and a 0:30
  countdown. The last spins show as coloured dots, newest ringed. Each segment row gives
  its pay, its chance and who is on it ("HO 10", "You 10").
- Slots: the jackpot banner states the rule and the odds ("Three Beacons: 200× your bet plus
  the jackpot · about 1 in 6.3k"). The paytable is compact under the reels, and the return
  (93%) sits right above the button.
- Bones: real dice faces. Each option gives its chance and return ("42% chance · returns
  92%").
- Capped: the limit bar turns red and the button says "Today's limit reached · resets in
  13h". Chips over the tier's biggest bet stay visible, dashed and disabled, with the reason
  in the row and as their tooltip.
- Ranks: the season card first (tier, "1st in Wealth", six numbers, ranks of how many),
  then the category tabs and the table, with the player's row tinted.
- Skiff, iteration 1, what was wrong:
  - Too small and flat at phone scale.
  - It faded in so slowly that a slow frame caught it half-transparent.
  - Its mast poked into the barrel.
- Skiff, iteration 2: drawn a quarter bigger with a lighter strake, and the mast lies along
  the boat. Still wrong: on desktop it sat behind the dock bar.
- Skiff, iteration 3: moved up the beach beside the barrel, bow to the sea, so the lantern
  and pennant face the holdfast. Still wrong: the lantern post stood in front of the ore rock.
- Skiff, iteration 4:
  - The post moved inboard.
  - The lantern glow is larger and lights the beach at night.
  - On phones the bow runs off the left edge; the lantern, pennant and crate stay in view.
- Map: the Den's flag sat under the Tidal Flats cloud. It moved south-east of the landing,
  dimmed with "The Den · opens at Stone" until the Den opens.
- Full run: 100 shots, no console errors. The older shots of late bases now show the skiff.
- Still open:
  - With the dock and watchtower built (`desktop_hqm_night`, `phone_buildings_full`), the
    skiff crowds the boathouse at the shore. Mooring it at the dock would put it off the
    phone view, which is the only scene way into the Den on phones; it needs its own spot.
  - The tab row scrolls sideways on phones when there are many tabs, with no hint (rank
    categories past Lucky; carried over from the station tabs).
  - Slot symbols and the Den's goods are lettered placeholder tiles like every other icon.
  - In demo mode the wheel turns on the 240× demo clock, so a round passes in a blink (as
    node regrow does, D65). The live game is real time.

## W6: raids and defence (the Defence panel, PvP, raid reports, the scene)

Shots: `raid_warned_day`, `raid_warned_night`, `phone_raid_warned(_night)`,
`phone_defence_warned`, `phone_defence_damaged`, `phone_defence_calm`, `desktop_damaged`,
`phone_raid_report_breached`, `phone_raid_report_held`, `phone_pvp_locked`, `phone_pvp_join`,
`phone_pvp_targets`, `phone_pvp_shielded`, `phone_pvp_revenge`, `phone_pvp_report_in`,
`phone_pvp_report_won`, `phone_camp_confirm`, `map_camps`, `desktop_defences(_night)`,
`desktop_defence_panel`.

- Iteration 1, what was wrong:
  - The breached wall did not show: both breaches were drawn behind the house and the
    workbench.
  - The turret stood behind the house, so it was invisible.
  - The traps sat under the stone node's rock.
  - The shield badge overlapped the level-3 watchtower's roof and flag.
  - On the map, camp labels ran into the ruins' labels (Observatory / Cinder Fort,
    Cannery / Saltpan Camp).
  - A revenge raid's button said "Raid Hollis", like any raid.
- Iteration 2, what changed:
  - The breaches moved to where the wall shows: between the furnaces and the house, and
    past the workbench. Each is a dark notch with rubble at its foot (stakes knocked flat
    on the timber wall).
  - The turret moved to the wall's east end. Its level-3 searchlight is on the lights layer.
  - The traps stand across the yard in front of the door.
  - The badge sits beside the watchtower's top.
  - A first try moved the camps to a fixed offset, but at phone zoom they then hit the region
    labels. So camps got a `pin` in `sites.json5` (map units from the region's centre).
    Saltpan, Driftwood and Cinder Fort now stand clear on `map_camps`.
  - Revenge reads "Strike back at Hollis · 3 charges".
- What works:
  - **Hierarchy:** the banner under the top bar ("Raiders sighted · land in 6h 30m · 82% to
    hold") is the first thing seen on both phone and desktop. In the panel the defence score
    leads, with its parts beside it, damaged parts in amber.
  - **Story:** the torches gather on the ridge behind the house, figures by day and glows at
    night, and the shield over the walls changes with the state: calm, sighted (pulsing
    flame), broken (crack), shielded (blue).
  - **Cost and outcome before commitment (6.3 rule 4):**
    - the raid card shows the chance to hold, both sides' points and what a breach takes;
    - a PvP target shows the chance to get in, their defence, the charges and what is left
      after, and what a breach brings home;
    - the camp's confirm shows the charges in its rations and the charges left after.
  - **One primary action:** the advisor's `defend` and `repair` light the Defence button on
    desktop and the banner on phones. PvP buttons use a separate danger style (red outline),
    never the primary red.
  - **Nothing hidden:** before Stone the Defence button says "Opens at Stone"; before Sheet
    Metal the Raids tab shows the rules and the tier it opens at.
  - **No dead ends:** every report card ends on the follow-up (repair the defences, strike
    back, or the Defence panel).
- Still open:
  - On phones the demo drawer's button overlaps the right end of the banner. Demo only; the
    live game has no such button.
  - The shield badge sits at the left edge of the phone view (the watchtower is there).
    It stays fully in view.
  - The figures on the ridge are small at phone size; their glow at night carries the
    meaning.
  - The full shot run no longer fits in one 10-minute call (now about 125 shots). Run it
    with `--only` in parts.

## W7: seasons and the legacy layer (the season-over card, Legacy, Hall of fame, the Signal)

Shots: `phone_legacy`, `phone_legacy_bought`, `phone_hall`, `phone_season_over`,
`desktop_season_over`, `phone_season_ends`, `phone_signal_closed`, `phone_signal_open`,
`phone_signal_lit`, `desktop_signal_tower`, `desktop_signal_lit_night`, `desktop_skin_beacon`,
`desktop_skin_rust`.

- Iteration 1, what was wrong:
  - **Top bar:** the clock chip's new season line ("Season 2 · Rich Tides") widened the chip,
    and on phones the identity chip was cut to "Su…" / "Tim…".
  - **Season-over card:** the archived season card still said "Your season so far".
  - **Plurals:** "Kept: 1 blueprints · 1 veterans".
  - **The Signal tower:** at the foundation stage it was invisible, because its footing
    stood behind the furnaces.
- Iteration 2, what changed:
  - The season line is short: the modifier's name, or "Season ends in 4d 9h" once announced.
    The season's number is in the Legacy tab. The identity chip reads in full again.
  - `SeasonCard` takes a label: "Your season 1".
  - "Kept: blueprints 1 · veterans 1", with no plural to get wrong.
  - The tower stands higher on the slope; its stone footing shows above the strip.
- What works:
  - **One primary action (6.3 rule 1):**
    - the season-over card leads with the season's card and ends on one primary action,
      "Begin season 2" (with "Spend points" beside it);
    - the Signal makes the give button for the good you can cover best the primary;
    - perks are secondary buttons: buying is optional and never the advice.
  - **Disabled buttons explain themselves (rule 3):** "Need 3 more", "Top rank", "No frames
    to give". Skins not earned stay visible with how to earn them.
  - **The base tells the story:** the tower rises by stage on the slope, and once lit, its
    beam sweeps over the sea at night. The Beacon and Rust skins recolour the roof and trim,
    and the tier still reads from the walls.
- Still open:
  - The Signal's stages draw only what is finished. A stage under way could show scaffolding
    (later, with commissioned art).
  - Titles are shown only in the Legacy tab. Showing the worn title beside names in the
    feed and ranks is for W8 (the bot shows names too).

## W8: the Discord companion (`/base`, DMs, the feed channel, season news)

Reviewed with `pnpm preview` (`preview/discord/index.html`): every message drawn from the
payload the bot sends, in Discord's dark theme at phone (390 px) and desktop (640 px) width,
plus the card alone at phone size. States: `new`, `waiting`, `filling`, `banked`, `busy`,
`full`, `cooldown`, `long`; DMs `party_back`, `raided`; four feed lines; both season news.

- Iteration 1, what was wrong:
  - **Legibility (checklist 2):** the card was laid out on 800 units like the old bot's, but
    a phone shows it only about 290 px wide, so resource names came out near 8 px.
  - **One obvious action (6.3 rule 1):** when the advisor's step is in the game, the primary
    is the "Open the game" link, which Discord draws grey like every link. It sat third in
    its row, and the step itself was small print under the details.
  - **Hierarchy:** the status line said "Your crew keeps working while you are away" on
    every card: the place the eye lands said nothing.
  - **Wording:** "8× Planks and 1 more" (more what?); "DMs: on. Which kinds is set in the
    game, under notifications."
  - **Fixtures:** the "full" state was not full (the cap is 5k at Timber, not 4k), so the
    locked "Collect · store full" was never seen.
- Iteration 2, what changed:
  - The card is laid out on 600 units with three resources a row: names at 24 units (about
    11.6 px on a phone), amounts at 30, nothing under 22.
  - The status line is the last click's result, or else the one next step ("Next, in the
    game: post a guard, raiders are coming."); the primary button leads row 1 whatever its
    kind. With a result in the status line, the step moves to the small print.
  - "8× Planks, 6× Rope, the first done in 40 minutes"; "DMs on. Pick which ones in the
    game's notification settings."
  - The full fixture fills to the real cap; a new `filling` fixture shows Collect as the
    primary.
- What works:
  - **Locked buttons say why (rule 3):** "Gather · 8m", "Collect · nothing yet",
    "Collect · store full".
  - **Feedback (rule 7):** a click answers in place within the second: "Banked +214 Timber,
    +80 Stone, +12 Iron Ore.", "Gather is ready again in 4 minutes."
  - **No dead end (rule 2):** every DM offers the base right there, the game at the report,
    and DMs off; a stale button from the old bot answers with the base as it is now.
  - **Consistency (checklist 5):** the same tile, colour and letters per resource as the web
    (`@wipe-day/content/look`), the tier's colour on the card's strip and the message's
    accent, numbers through the one formatter, and feed lines in the web feed's own words.
  - **Overflow (checklist 4):** a 32-character name truncates on the card and wraps in the
    title; seven-digit stocks read `1.2M`; names with markdown characters are escaped.
  - **The web, unchanged:** `phone_feed`, `desktop_feed`, `phone_feed_dot` and
    `phone_inventory` render as before with the feed's sentences and the tiles now coming
    from the shared modules. They showed "finished a Armored base" (a grammar slip from W4b,
    now in both places), which reads "finished the Armored base" now.
- Still open:
  - The mock is an approximation: Discord's font is gg sans, and the real app may wrap
    buttons a little differently. The owner's first live `/base` on a phone is the real check.
  - Titles still show only in the web's Legacy tab, not beside names in the feed (carried
    over from W7).

## R0: the redesign closes the W-phase open items

The redesign (D127) deletes or replaces the screens the "Still open" lists above belong to. Each
is closed here; nothing above is edited.

- **Moot, D137** (the system is gone): the barrel and Gather as the advisor's pick; the tannery
  racks, station floaters and station tabs; the map's night look; the skiff crowding the
  boathouse, the Den's tabs, slot symbols and the 240× wheel; the shield badge, the ridge's
  raiders and the raid banner; the Signal's stages; titles in the Legacy tab.
- **Carried into the redesign's phases:**
  - The phone scene sits low under a lot of sky: R1's camera reframe (the tap target on the rise
    at about 40% height, `docs/redesign/08-screens.md`).
  - The desktop side panel covers the east coast: R1's 420 px drawer column with the scene
    recentred left of it.
  - Crew portraits and every lettered tile: the owner's icons by phase (D141).
  - Tab rows that scroll with no hint: the drawer has two tabs and the Blast Map a ladder, so
    the pattern is not reused; any new scroller gets an edge fade.
  - Titles beside names: R6's boards and the Friends tab.
  - The full shot run's length: `SHOTS` is rebuilt per phase from `08-screens.md` 8 (R0 has the
    bare island only).
  - The bot's mock versus the real Discord app: still the owner's live check, now of card v2 in
    R2.

## R0: the bare island, the demo drawer and `/base` until R2

Shots (`pnpm web:shots`, `preview/web/`): `bare_island`, `phone_bare_island`,
`phone_bare_island_tapping`, `phone_bare_island_big` (1.23e36 supplies), `bare_island_night`
(999,999 supplies), `bare_island_drawer`, `phone_bare_island_drawer`, each with a `__zoom` crop
of the counter, the floater or the drawer. Shots now render in UTC and pin two clocks: `time`
(the game) and `wall` (animation, D138). Bot: `pnpm preview` (`preview/discord/`).

- Iteration 1, what was wrong:
  - The counter's rate line read `0/s` on a fresh island: a number that says nothing, under
    the one that matters.
  - The counter pill kept 112 px for its figures, so `0` sat in a wide pill with a hole on its
    right.
  - The drawer offered "Pause" while the clock was paused: it read the clock once, when it
    mounted, not when it opened.
  - The drawer's clock read "10:00 · 1": nothing said the 1 was a day.
  - `/base` (Discord) said "Everything new happens in the game for now" without naming the
    action; Discord draws the "Open the game" link grey like every link, so the words must
    carry it (as W8 found, D125).
- What changed:
  - The rate line shows only once something runs by itself; an empty line keeps the pill's
    height, so the counter never jumps when the first hand is hired.
  - The figures' minimum width is 56 px; the pill grows with the number (tabular figures, so
    a ticking value keeps its width within a magnitude).
  - The drawer reads the clock on every render, and its clock reads "Day 1 · 10:00".
  - `/base` now says "The island is being rebuilt. Open the game to see it and tap it."
- Iteration 2: the counter fits `0`, `1.24k`, `999k` and `1.23e36` at 390 px with its tile; the
  night sky keeps it readable (light text on the glass pill); the floater `+6` rises from the
  finger in the land's middle; the tap hint is gone after the first tap; the drawer's six
  buttons are 44 px tall and fit three a row at 390 px; the DM keeps "Show my island" as its one
  primary. All seven web shots and four bot screens pass, no console errors, no lint findings.
- Still open (by design or for R1):
  - The phone view is mostly sky with an empty land: R1's camera reframe puts the tap target on
    the rise at about 40% of the height, and R1's scene fills the land with lines and hands.
  - The counter's icon is the lettered `SU` tile until the owner's `currency/supplies` icon
    (D141, R1's list).
  - The tap hint is the R0 stand-in for "Tap the tree." (R1's era target); it is drawn as a
    pulsing pill, not the signal-orange primary, which arrives with R1's contrast pass (D138).

## Icons: R1's first set (`packages/content/icons`, branch `icons-r1`)

54 hand-drawn icons (25 more below), in the order of `07-what-changes.md` 8: `currency/scrap`,
`currency/supplies`, the 14 `product/` badges, the 14 `line/` buildings, the 5 `tier/` eras, the
5 `tool/` Grip tools, `target/` tree, stone, ore, sulfur, wreck, `flotsam/crate`, `ui/hustle`,
`ui/hand`, `ui/night_shift`, and the 5 `nav/` items. Sheet: `pnpm icons` (`preview/icons/`): each
icon at 16, 24 and 48 px, white on `--bg` and dark on `--text`, the 16 px render zoomed 4x without
smoothing, and `strip16-*.png` with all of them side by side at a real 16 px. The script lints
every file against D141 (viewBox, no width/height, no text, raster, filters, gradients, refs or
ids, at most one accent and only from `palette.ts`/`tokens.css`, strokes of at least 3, ink inside
the 2-unit margin) and prints each icon's ink share, so visual weight can be compared by number.

- Iteration 1, what was wrong:
  - Look-alikes at 16 px: `tier/wood` (palisade) and `tier/metal` (corrugated ridges) were both
    a row of vertical bars; `nav/blast_map` (a burst with six spoked nodes) was a snowflake.
  - Misreads: `tier/hqm` (shield, two rivets over a bar) was a face, or a "!" warning sign;
    `product/plates` (square plate, three holes) was a die; `product/timber` (three log ends
    with a hole) was coins; `currency/supplies` (sack with a lashing band) was an urn with a lid;
    `line/furnace` (tower with a flame on top) was a lighthouse; `target/wreck` (hull and mast
    with a yard) was a sailboat; `ui/night_shift` was too fat a crescent, a bitten cookie;
    `product/fibre` (solid sheaf) was a trophy.
  - Weak or small: `product/ingots` filled only the lower half (y 18-44); `tool/iron_tools`'
    pick head was a hairline at 16 px; `product/cell` read as a door frame; `tool/rock`'s two
    cut-out chips read as holes.
  - Margins: `tier/twig` and `tool/stone_tools` reached past the 2-unit margin (the lint
    caught both).
- What changed (iteration 2):
  - `tier/metal` became one plate with scalloped top and bottom edges (the corrugation profile)
    and three slots; the palisade keeps its points, so the two differ in outline, not only in
    stripes. `tier/hqm` became a shield with two chevron seams (plated, no face).
  - `product/timber` is a woodpile: three log ends in front of their half-tone bodies. `plates`
    became a riveted slab in perspective with a second slab under it. `supplies` lost the band:
    a plain sack with a tied, flared neck. `furnace` became a block with a chimney and a glowing
    mouth, so it no longer competes with the kiln's dome. `wreck` lists 17 degrees with a holed
    hull and a snapped mast. The crescent is thinner. `fibre` is five stalks with seed heads,
    bound in the middle.
  - Ingots are taller (y 16-44), the pick head is thicker, `cell` is a canister with a window
    onto its glowing core, `rock` is a knapped stone in two tones instead of holes.
- Iteration 2, still wrong: `target/stone`'s crack read as a lightning bolt; the new
  `nav/blast_map` (burst inside a ring with four nodes) read as a lifebuoy; `line/shipbreaker`
  (hull split in two with a spark) read as a basket with a star.
- Iteration 3: the stone lost its crack (the moss cap and the dome carry it); the blast map is a
  burst at the foot of three ringed nodes, a tree growing from the blast; the ship breaker is a
  crane hook over a cut hull. The stroke-drawn tools and the twig were the lightest icons
  (15-17% ink against 30-44% for their neighbours); the twig, the hatchet and the pick got
  heavier strokes (now 17-18%).
- Still open, and what I would redo:
  - `product/plates` reads as a slab or a sandwich, not "steel": the weakest product.
  - `line/loom` is a framed grid (a crib, a barcode) at 16 px; `line/press` passes but is busy.
  - `nav/blast_map` is legible but abstract: it needs the Blast Map screen beside it to mean
    anything, and the burst could be the Big Red's red once the nav's accent policy is set.
  - `product/cell` and `product/battery` are both "power" at a glance; they differ in shape
    (canister with a teal core, box with posts and a bolt) but share a meaning.
  - `product/charcoal` (lumps with an ember) and `target/ore` (rock with copper nuggets) are both
    rocks with a warm accent; they never meet in one view (shop badge against tap target).
  - Visual weight still spans 15-58% ink: line-drawn things (tools, broadcast, the fish) stay
    lighter than solid ones (`tier/metal`, `product/plates`); R1's shop rows should be checked
    with the real 40/18 px badge sizes before this is evened out further.

### Icons, second batch: the rest of R1's list and the redo list (79 in all)

New: the 14 hand portraits (`crew/`), `flotsam/fuel_drum` and `flotsam/adrenaline`, and the UI
glyphs `ui/crown`, `lock`, `finger`, `chevron`, `close`, `menu`, `upgrade`, `buy_max`, `roster`.
A portrait is the face in half tone, the person's one sign in full, and shared shoulders, so the
headgear carries the silhouette. `ui/pocket` waits for R5.

- Iteration 1, what was wrong:
  - Look-alike portraits at 16 px: Mara's sun hat, Pike's sou'wester and Otto's cap were all
    "a hat with a brim"; Dax's pompom and Sela's bun were both a ball on top; Juno's braids and
    Tamsin's headset were both blocks at the sides of the face.
  - The spec draws the Rally drum (`flotsam/fuel_drum`) as "a red-banded drum", the same picture
    as `product/fuel`. The Adrenaline tin with a cut-out bolt was the battery's box and bolt.
  - The redo list: `product/plates` (one slab, four holes) was a die again; `line/loom` with a
    straight shuttle was one more bar in the crib.
- What changed:
  - Pike wears a diver's helmet with a porthole onto the face; Gus a welding helmet pushed up
    (visor slit); Sela a ponytail swinging out behind. Otto keeps the one-sided flat cap and Mara
    the round sun hat.
  - All flotsam floats: the crate, the drum and the tin sit on the same wave, now drawn in
    `currentColor` (the crate's sea blue went), so the family reads at once and the drum keeps its
    red band as its one accent. The drum lies on its side and tilts; `product/fuel` stands upright.
    The tin's bolt is filled in fire orange, not cut out, and the tin has a lid seam and no posts.
  - Plates became three thin sheets with half-tone edges, two cut holes on the top one; the
    loom's shuttle is boat-shaped, tilted 18 degrees across half-tone warp threads.
- Iteration 2: Juno's first fix (two buns) made a famous cartoon-mouse silhouette (D43), so Juno
  wears a long stocking cap drooping to the left with a tassel. The 14 portraits now differ at
  16 px.
- Still open: `product/plates` is legible as a stack of sheets but sits close to `planks` at
  16 px (thin slanted sheets against thick boxes): still the one I would redo, ideally after the
  owner's naming pass (an I-beam would say "steel" but not "plates"). The `loom` is better but
  still busy. Mara (round brim) and Otto (one-sided brim) are the closest pair of portraits.

### Icons, third batch: R2's list, drawn ahead (103 in all)

New, none of them shown before R2 (D140; the icons are not wired in): `currency/glass`,
`ui/glow`, `ui/big_red`, the Kettle stages `ui/kettle_pad`, `kettle_frame`, `kettle_warhead`,
`kettle_fuel`, `ui/afterglow`, `ui/ground_zero`, the sector glyphs `sector/grip`, `crew`, `works`,
`tide`, `bunker`, `blast`, `logbook`, `scrapyard`, the six node-type frames `node_type/stat`,
`notable`, `keystone`, `unlock`, `automation`, `completion` (04-blast-map.md 2.1), and
`skin/founder`. `pnpm icons --only sector,node_type` now draws a subset into the sheets.

- Iteration 1, what was wrong:
  - `ui/ground_zero` (a sign planted in a crater) was a golf flag in its hole.
  - `ui/kettle_pad` (ladder, taped slab, two pallets) was a busy fence at 16 px: the ladder
    competed with the hazard stripes, which are the pad's identity.
  - `ui/big_red`'s dome (r 8) was too small to carry the icon at 16 px against the drum.
  - `ui/glow` was the lightest icon in the set (15% ink): a speck with dotted rays.
  - Fine on the first pass: the sector glyphs (fist, hard hat, factory roof, curling wave,
    pillbox, mushroom cloud, pencil, tyre) all name themselves at 16 px; the frames differ by
    outline (circle, double ring, hexagon, rounded square, cog ring, double ring with badge);
    the glass shard and the scrap nut differ in shape and colour.
- What changed: Ground Zero is a crater with blast rays and no flag; the pad is one wide
  hazard-striped slab on a pallet; the dome grew to r 11 with the hinged seat behind it; the glow
  is a bigger shard with heavier rays (19%). All four read at 16 px in iteration 2.
- Choices: `sector/works` is a sawtooth factory roof, not a cog, because a works node inside the
  automation frame (a cog ring) would be a cog in a cog. `sector/crew` is a hard hat alone, so it
  differs from `nav/crew` (a person). The Big Red's dome and the glass use R2's `BIG_RED` and
  `GLASS` (03-the-big-red.md 3.3, 3.4), now in `palette.ts`.
- Still open: the seat behind the Big Red's dome reads as a hook at 16 px (the dome carries the
  icon, the seat only shows at 48); `ui/kettle_frame` could be a water tower; `sector/scrapyard`
  (a tyre) is close in outline to the automation frame's cog, but one is filled and one is a ring.

### Icons at their real sizes: the shop rows

`pnpm icons` now also draws `shop-dark.png` and `shop-light.png`: the 14 lines as R1's shop rows
at a 390 px phone width (2x), from the real data and locale, with each building at 40 px, its
product badge at 18 px on a panel-coloured disc at the lower right (02-the-run.md 1.2), the name,
"makes <product>", and the hand's portrait at 24 px on a round chip.

- Iteration 1, what was wrong: the loom's shuttle, tilted 18 degrees right across the frame,
  read at 40 px as a "crossed out" stripe over the building: next to rows that are disabled
  with a reason (CLAUDE.md 6.3.3), a line must never look struck through.
- What changed: the shuttle is level again, shorter and inside the frame, an eye-shaped boat
  with its bobbin slot, so it reads as an object, not a bar or a strike.
- Fine at the real sizes: every badge names its product at 18 px on its disc (the fish, the
  sheaf, the coil, the pelt, the drum's red band, the battery's bolt and the broadcast rings
  the most); the 14 portraits differ at 24 px; the warm accents (campfire, kiln, furnace) and
  the mast's red light give the list a rhythm without competing with the orange primary, which
  is a button, never an icon. Visual weight across rows is even enough at 40 px that the 15-58%
  ink spread from the 48 px sheet does not show; nothing needs evening out before R1.
- Still open: the badge disc covers the building's lower right corner, which hides the furnace's
  and reactor's doors partly; R1 may move the badge 2 px outward if the doors matter.

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

# Code-web report: the web client today, and what an idle/clicker redesign can reuse

Reader: the redesign planner. Scope: `apps/web/src` (read in full or in the parts that matter),
`docs/web-prototype.md`, `docs/screens/*.md`, the last ~250 lines of `docs/ui-review.md`, the
roadmap's open items, and 13 screenshots in `preview/web/` (taken 2026-10-05/06, demo mode).
Nothing in the repo was changed.

Stack (from `apps/web/package.json`): Vite 8, React 19.3, PixiJS ^8.21, Zustand 5, TypeScript 7,
Playwright for screenshots. No audio, no haptics, no `prefers-reduced-motion` handling, no
BitmapText, no SVG loading anywhere in `apps/web/src` (grep: zero hits).

---

## 0. The 15 facts that matter most for the redesign

1. **Two layers, cleanly split.** One PixiJS `Application` draws the world (`scene/Scene.ts`);
   React draws the HUD on top (`App.tsx`: `.scene` canvas, `.vignette`, `.hud` with
   `pointer-events: none` except its widgets, `styles/base.css:95-105`). Game state only changes
   through store actions; the scene reads the store once per frame (`Scene.step`, `Scene.ts:503`).
2. **There is no real "clicker" verb today.** "Gather" is a dock button with a 10-minute cooldown
   that banks accrued production plus 30 minutes of bonus (`packages/content/data/tools.json5`,
   every tool `bonusMinutes: 30, cooldownMinutes: 10`; `Dock.tsx:114-132`). The closest thing to
   clicking is the node mini-game: tap a tree/rock, a glowing marker appears, hit it 5 times with
   at most 4.5 s between hits (`data/active.json5` `node`), a perfect run gives a bonus, the node
   then falls and regrows in 20-120 *real* seconds (`data/nodes.json5`). Hits pay full only until
   180 minutes of production per UTC day, then 10% (`dailyHaulMinutes`, `afterHaulPercent`).
3. **Every tap is a server command** (`store.send`, `store.ts:813`): predicted locally through the
   same domain function, then POSTed with an idempotency key; the queue is flushed **one command
   at a time** (`flush`, `store.ts:427`) and every answer re-applies the whole remaining queue
   (`rebase`, `store.ts:318`). Fine for a tap every few seconds; at clicker rates (5-15 taps/s on a
   200 ms mobile RTT) the queue grows without bound and rebase is O(n²). A clicker needs a
   **batched click command** (e.g. "N clicks since T", server-capped per second).
4. **Feedback toolkit is good and reusable:** screen-space floating numbers with stroke, pop and
   stacking (`Floaters`, `scene/effects.ts:222`), 7 particle kinds (`Particles`, `effects.ts:25`),
   node shake, tree fall/rock crumble/regrow pop, building "pop up" with easeOutBack, pulsing
   scaffolds, chimney smoke, glows that follow the night. But nothing is pooled: each float is a
   new `Text`, each particle a new `Graphics`. Clicker spam needs pooling + `BitmapText`.
5. **The dock is the advisor's stage**: 5 actions on phones (Gather, Upgrade, Craft, Furnace,
   Map), 11 on desktop (+ Squad, Inventory, Den, Defence, Feed, Tasks) (`Dock.tsx`, D45/D88). The
   advisor picks exactly one primary (`DOCK_FOR`, `Dock.tsx:38`). This shape does not fit a
   clicker's "big tap target + always-visible buy list"; it must be redesigned, not extended.
6. **The phone layout wastes ~40% of the screen.** At 390x844 the camera scale is 0.443
   (`Scene.layout`, `Scene.ts:311-329`: `min(vh/800, vw/880)`); the whole base, even fully built
   Armored, is a band ~100-160 CSS px tall at 66% down; the sky between the resource strip and the
   horizon (~250 CSS px) is empty (`phone_day.png`, `phone_buildings_full.png`; ui-review W2
   "Still open"). That empty sky is exactly where a clicker's main tap target or a generator
   list can go.
7. **A pan/zoom full-screen Pixi view already exists**: the island map (`map/MapView.ts`, D88)
   with drag-pan, pinch and wheel zoom (1x-3x), fixed-CSS-px tap targets (D48), screen-space labels
   (D46), HUD insets read from the DOM, and a tap that opens a React panel with details and one
   primary. That is the template for the prestige tree view.
8. **The nuke cinematic has natural homes**: world container (missile, cloud, debris), the
   `lights` layer above the night tint (fireball glow, D47), a stage-level screen-space layer or a
   CSS overlay (white flash), the per-frame camera position (shake), `ambient.tint` (nuclear
   dusk), `Base.setTier(tier, animate)` (rebuild pop), and the season-over modal pattern
   (`SeasonOver.tsx`) for the "you earned X" card.
9. **Colour collision:** the primary-action style *is red* (`.btn.primary` / `.action.primary`
   gradient `#e0563d -> #b8351f`, `--accent #cd412b`, `styles/hud.css:213, 401`), and danger is red
   too (`--danger #f05252`). A "weird red button" must get a bespoke look (dome under a flip
   cover, hazard stripes) or it will read as "the advisor's next step".
10. **Number formatter tops out at B.** `abbrev` (`packages/domain/src/words.ts:11`) has units
    `k, M, B` only: 1e12 -> `1000B`, 1.234e15 -> `1234000B`, 1e100 -> `1e+91B`, Infinity ->
    `InfinityB`, and it truncates fractions (0.5 -> `0`, 12.7 -> `12`). State is integers by design
    (CLAUDE.md section 4), JS numbers are exact only to 9.007e15. Shared with the Discord bot.
11. **Icons are placeholders everywhere.** HUD: one `Tile` component (tinted rounded square with two
    letters, `hud/Icon.tsx`), colours/letters from `@wipe-day/content/look` (`packages/content/src/
    look.ts`), shared with the Discord cards. Dock glyphs are literal strings ("GA", "UP", "CR"...).
    Scene art is 100% procedural `Graphics` (D41). There is no SVG pipeline yet: the owner's SVGs
    have no home, which is a decision for the plan (proposal in section 8).
12. **Touch-target violations exist today**: panel close 32x32 px (`hud.css:291`), `.btn.small`
    ~30 px, tabs 36 px (`hud.css:972`), toast button 30 px; on phones the rock nodes' tap areas
    are ~35-44 px wide but only ~21-27 px tall (world-unit hit areas in `nodes.ts:640-647` x scale
    0.443). Only the marker (26 px radius), shield badge (26 px radius) and skiff (>=64 px) honour
    D48. A clicker whose core verb is tapping must fix this first.
13. **Per-frame store churn:** `tick()` does `set({ now })` every frame (`store.ts:784-811`), so
    every Zustand selector runs 60x/s. Most are bucketed (`Math.floor(now/60)`), but some do real
    work each frame (TopBar's crew selector calls `advise()` and `crewSummary()`, `TopBar.tsx:38-48`;
    `RaidAlert` calls `raidWarned`/`npcOdds`) and two components re-render at 60 fps while open
    (`Den.tsx:523`, `Games.tsx:185`). Components that select the whole `base` (Dock, Build, Craft,
    Defence) re-render on every command, i.e. **on every click** in a clicker.
14. **Season UI is spread thin and easy to remove**: TopBar season line, `SeasonOver.tsx`, the
    Legacy and Hall tabs inside the "The island" panel (`Feed.tsx`), `SignalPanel` + `SignalTower`
    in the scene, store fields `season/legacy/signal/seasonSeen`, demo helpers. The Legacy panel
    (points, perks with pips, "Need 3 more") is the closest existing UI to a prestige shop.
15. **Review loop is mandatory and heavy**: `pnpm web:shots` (Playwright via `window.__wipeDay`),
    ~125 shots, no longer fits one 10-minute call (ui-review W6). A redesign should prune and
    rebuild the `SHOTS` list in `apps/web/scripts/shots.mjs`, and every animated thing (nuke
    phases, tree states) needs a way to be pinned for a screenshot.

---

## 1. File map (what lives where)

| Area | File | Lines | Role |
| --- | --- | --- | --- |
| Entry | `src/main.tsx`, `src/App.tsx` | 21, 51 | waits for Roboto Condensed (canvas text needs it), mounts App: scene div, vignette, HUD (TopBar, Toasts, Panel, Dock, DemoDrawer, AwayModal, ReportCard, SeasonOver, Login) |
| Debug hook | `src/debug.ts` | 38 | `window.__wipeDay` in dev: store, demo clocks, frame counter, `frozen`, `nodeMarker()` |
| Store | `src/state/store.ts` | 981 | Zustand: confirmed/queue/base prediction, actions, panel/view/tab state, Den, raids, seasons |
| Content | `src/state/world.ts` | 175 | shared data + locale validated in the browser (`parseContent`), names, colours, `abbrev`/`duration` re-export |
| Messages | `src/state/messages.ts` | 542 | refusal -> one-line toast with a button to where the missing thing comes from (rule 5); event -> toast |
| Events | `src/state/events.ts` | 26 | tiny emitter: domain events + `node_respawned`, `weather` -> scene effects |
| Clocks | `src/state/clocks.ts` | 20 | demo `scaledClock` (starts day 4 09:00, 240x) |
| Net | `src/net/backend.ts`, `http.ts`, `local.ts`, `push.ts` | 101/194/592/72 | Backend interface; HTTP with retries + server clock + SSE; LocalBackend = whole game in browser for demo/shots; Web Push |
| Scene | `src/scene/Scene.ts` | 729 | Pixi app, camera, layer stack, store sync per frame, event -> effect mapping |
| Scene parts | `scene/base.ts` (747), `buildings.ts` (795), `nodes.ts` (1195), `actors.ts` (497), `effects.ts` (414), `sky.ts` (166), `terrain.ts` (448), `palette.ts` (263), `textures.ts` (75), `den.ts` (149), `raids.ts` (157), `signal.ts` (119), `station.ts` (19), `util.ts` (64) | | see section 2 |
| Map | `src/map/MapView.ts` | 639 | full-screen island chart, pan/pinch/zoom |
| HUD | `src/hud/*.tsx`, `src/hud/panels/*.tsx` | ~5,800 | TopBar, Dock, Panel (11 panels), Toasts, modals |
| Styles | `src/styles/tokens.css` (42), `base.css` (71), `hud.css` (2143) | | tokens, reset, all HUD CSS |
| Shots | `apps/web/scripts/shots.mjs` | 1687 | `SHOTS` list; fixtures; contact sheet |
| App icons | `apps/web/scripts/icons.mjs` | 46 | renders the PWA icons from one inline SVG via Playwright |

`docs/screens/*.md` (base, build, craft, debug_card, furnace, gather, help, inventory, node, tasks,
tools) describe the **old Discord bot's** Components-V2 screens (`src/ui/screens/*.ts`, `<t:R>`
timers, Back/Home rows). They are history, not a web spec; the only still-valid content is the
advisor's priority idea and the node mini-game's purpose.

---

## 2. The screen layout today

### 2.1 Scene (PixiJS)

Camera (`Scene.ts:44-58, 311-329`; D42, D75): design stage 1600x900, horizon y=520, ground y=560,
shore x=540, base door x=1000; sky and ground extend 800 units past the stage. Scale =
`min(vh / 800, vw / 880)`; phones always see >= 880 units across, centred on x=915; the ground
line sits at 66% (tall) to 72% (wide) of the viewport. Desktop mouse parallax nudges the world
6 px (`onPointer`, `Scene.ts:305`). DPR capped at 2 (`Scene.ts:264`).

Stage order (`Scene.ts:242-256, 273-281`), bottom to top:

1. `world` container (scaled by the camera):
   sky -> terrain.back (parallax ridges, distant island with lighthouse) -> Signal tower ->
   raider torches -> terrain.ground -> back nodes (4 trees) -> base (structure, stations, wall,
   crates) -> front nodes (ore, stone, sulfur rocks) -> actors (crew, gulls) -> barrel -> skiff ->
   particles -> terrain.front.
2. `ambient`: a full-screen white rect with `blendMode = "multiply"`, tinted per frame with
   `palette.ambient` (white by day, `0x4a5a8a` at night) = the night tint (`Scene.ts:241, 563`).
3. `lights`: world-aligned, **above** the tint, so fire and glows stay warm (D47): Signal lamp,
   torches, station fires/glows (`Base.lights`), skiff lantern.
4. `floaters`: screen space (D46): floating text rasterised at display resolution, only the anchor
   follows the camera.
5. `weather`: rain streaks (160 drops), fog puffs (9 sprites), screen space.
6. `markers`: world-aligned top layer: node marker/ring/tap target, regrow clocks, station work
   rings, the shield badge. Nothing can cover them (D48).
7. `map.container`: the island chart; when `view === "map"` every layer above is hidden and the
   base "rests" (`Scene.ts:508-525`).

Time of day: `palette.ts` keyframes (night 0-0.2, dawn 0.2-0.27, day 0.4-0.6, dusk 0.74-0.82,
night 0.9-1), `gloom()` greys for rain/fog. In server mode the day follows the player's local
clock (`seasonTime`, `store.ts:970-974`), so day/night is real. Tier materials: `MATERIALS` per
tier (Twig, Timber, Stone, Sheet Metal, Armored) + 3 skins (`palette.ts:193-244`).

What the scene contains (from `docs/web-prototype.md` and the code):
- Base structure per tier (`base.ts drawStructure`), with window glows and an HQM floodlight.
- 18 building types x 3 levels drawn procedurally (`buildings.ts makeBuilding`), each at a fixed
  spot: 14 in `SPOTS` (slope behind: watchtower, bunkhouse, warehouse, kiln, press, radio mast,
  generator, loom, turret; yard in front: dock, tannery, garden, lights, traps), plus the strip
  around the door (cupboard, furnaces two-by-two, workbench, campfire/kitchen), the wall
  (`WALL_SPAN -390..410`), crates by the door (`base.ts:34-57, 506-644`, D75).
- Scaffolds pulse over anything under construction; chimneys smoke; kiln/press smoke only while
  busy; a progress ring (fixed 9 px) over each working station (`Scene.syncWork`).
- 7 resource nodes (4 trees, ore, stone, sulfur) at fixed positions (`Scene.ts:60-70`); barrel on
  the shore; the Den's skiff from Stone; the Signal tower (W7); raider torches (W6).
- Crew figures (simple shapes, hat colour per survivor, `world.ts:151-175`) walking to their
  posts, sleeping by the fire with a "z", leaving for the shore on missions; gulls.

### 2.2 HUD (React)

- **Top bar** (`hud/TopBar.tsx`, `hud.css:48-153`): identity chip (YOU tile, name, "Timber base"
  in the tier colour; opens Tasks), resources strip (up to 7 known resources, each chip: tile,
  amount, `+pending` in green, label, storage bar that turns amber at the cap; opens Inventory;
  scrolls sideways on phones with 3 visible), crew chip (count/cap, "3 free"; glows when the
  advisor says crew; phones only), clock chip (HH:MM, "DAY 4 · CLEAR", season line, well-fed
  line, red dot for unseen feed; opens the feed panel). Under it the raid banner (`RaidAlert.tsx`).
- **Dock** (`hud/Dock.tsx`, `hud.css:155-251`): bottom centre glass bar; buttons 82x78 desktop,
  62x62 phones (primary 92 / 74 px, red gradient, 2.2 s pulse). Phones show only the first five,
  no sub-labels (`.extra { display:none }`, `.action .sub { display:none }` at <=720 px).
  Desktop shows sub-labels ("need 4.7k stone", "Make Planks", "Opens at Stone"). The advisor's
  one-line hint sits in a pill above the dock while no panel is open (`.advice`).
- **Panel** (`hud/Panel.tsx`): one at a time, opened by dock/top bar/scene/toasts; desktop: right
  side panel 420 px wide between top bar and dock with slide-in; phones: bottom sheet, max 70vh,
  rounded top, body padded 96 px so the dock does not hide the last card (`hud.css:254-310,
  690-702, 813-823`). Panel ids (`state/messages.ts:28-40`): build, craft, furnace, inventory,
  tasks, squad, map, feed ("The island": Feed / Ranks / Legacy / Hall of fame tabs), den (Market /
  Contracts / Games), defence (Defence / Raids), signal. Header with title and a 32 px "x".
- **Toasts** (`hud/Toasts.tsx`): pills under the top bar, last 4 kept, 4.5 s each, tone border,
  optional button ("Make Planks", "Read report", the panel to go to).
- **Modals** (`.modal-backdrop`): Welcome back (`AwayModal.tsx`: away time, what happened, gain
  chips, "Collect everything" primary + "Leave it"), report card (`ReportCard.tsx`: trips and
  raids, always ending on the follow-up), season over (`SeasonOver.tsx`), login (`Login.tsx`).
- **Demo drawer** (`DemoDrawer.tsx`): the "✦" button; time scale, pause, +1h/+6h, weather, tier,
  barrel, give everything, end season. Demo/dev only.
- **Map view**: the dock's fifth button toggles the base <-> island chart ("Map"/"Holdfast").

### 2.3 What the screenshots show (looked at 13 PNGs)

- `phone_day.png` / `phone_night.png` (390x844 @3x): top bar takes the top ~170 CSS px; then
  ~250 px of empty sky; the base sits in a thin band around 55-66% height; grass below; the
  advisor pill and the 5-button dock at the bottom. In this fixture the advisor points at the
  barrel, so **no dock button is primary** (a known open item). Night: deep navy, warm campfire
  and window glows on the lights layer, legible HUD.
- `phone_buildings_full.png` (Armored, all buildings level 3): the base still fits one band
  ~120-160 CSS px tall; crew figures ~17 px; identity chip ellipsised "Armored ba…".
- `phone_gains.png`: a Gather's stacked floaters "+366 Timber / +274 Stone / +91 Iron Ore" rising
  from above the roof, large (22 px CSS) bold white with a dark stroke; "+10 Planks" from the
  workbench. Very readable; this is the strongest "juice" in the game.
- `node_marker.png`, `node_perfect__zoom.png`: a small glowing gold dot with a thin ring on the
  rock; "Perfect!" in gold; coins burst. The marker is visually small at desktop zoom.
- `desktop_day.png`, `desktop_hqm_night.png`: 11-button dock across the bottom centre, resource
  strip with 7 chips, scene fills the rest; the night base with lamp posts, floodlight and torch
  glows looks good.
- `phone_panel_build.png`: the bottom sheet covers the lower ~60%; cards with tier tiles, cost
  chips in red when short, "Upgrade · need 4.7k stone" disabled with reason, "Make Planks"; the
  next card's cost row is visible under the dock bar (the sheet scrolls behind the dock).
- `phone_legacy.png`: the closest thing to a prestige screen: "14 LEGACY POINTS", perks as cards
  with 3 pips and "Buy · 3 points" secondary buttons, the 25% cap stated.
- `phone_map.png`: the chart with cloud-covered regions, "Too far"/"Scout" badges, a dashed
  route with "Quarry · 1h 30m", ruin markers, the Den's flag; dock shows "HOLDFAST".
- `desktop_away.png`: Welcome back modal over a dimmed scene, gain chips, one red primary.

Overall impression: polished, calm, legible, consistent; reads as a cosy management sim, not as a
frantic clicker. Little moves on its own at the HUD level; numbers change once a second.

---

## 3. How interactions feel today

### 3.1 Gather / Collect (dock button)

`Dock.tsx:111-132`: label "Gather" with sub "+30 min bonus" when ready; while on cooldown and
something has piled up it becomes "Collect +N"; otherwise disabled with "ready in 8m". Tapping it
sends `gather`/`collect`; the scene answers (`Scene.handle`, `Scene.ts:589-602, 637-639`): the
nearest standing tree shakes and sheds 14 leaves, and a stack of up to 3 gain lines rises from
above the house (`BASE_X, GROUND-210`). The top bar's pending `+244` folds into the stock. One tap
per 10 minutes: an idle verb, not a clicker verb.

### 3.2 Working a node (the only tap-tap-tap verb)

`scene/nodes.ts:1-7, 699-760`, `Scene.ts:157-213`, domain `hit_node`/`end_node_run`:
- Tap a standing tree/rock: it shakes; `store.startRun` checks the node (`tool` refusal floats
  "needs better tools" over the node); a gold glow marker appears at a random spot on it.
- Tap inside the ring (26 px radius on touch, 18 px mouse, D48): `+N Timber` and `2/5` rise from
  the tap point (the previous hit's text is retired so they never pile up), 10 debris particles
  burst, the node shakes, axe notches/cracks deepen per hit (`drawWear`). The marker jumps at
  least 2.5 radii away.
- 5 hits within 4.5 s of each other: "Perfect!" in gold + 12 coins, the tree falls (1.1 s) or the
  rock crumbles (0.45 s), leaving a stump/rubble with a pie regrow clock (fixed 11 px); it pops
  back after 20-120 real seconds (`node_respawned`).
- Miss or let the marker fade: "3/5 · keeps its wear" (D76); the node stays up with its wear.
- Tapping a stump: "Tree back in 14s".
- Every hit is a predicted command sent to the server (one POST per hit).

### 3.3 Other scene taps

Barrel on the shore (break it: splash, coins, gain stack), the skiff (opens the Den), the shield
badge over the wall (Defence), the Signal tower (Signal panel). **Buildings, the house and the
crew are not tappable** (grep of `eventMode`/`pointertap` in `src/scene`); a building is reached
only through the Build panel. ui-review W4b open item: tapping a survivor could open their card.

### 3.4 Floating deltas (`scene/effects.ts:195-309`)

- `Floaters.add/addStack(x, y, lines, color, size)`: world anchor, screen-space `Text`, Roboto
  Condensed 700, white (gold for "Perfect!" / tier / building names, grey for info), stroke 20% of
  size in `#1b1a18`, one random x jitter per stack, line height 1.2, biggest gain on top.
- Motion: rise with `vy = -2.1 * size` decaying 0.97 per frame, a 0.15 s scale pop (1.225 ->
  1), fade over the last 30% of a 1.4 s life. `retire(group)` fast-forwards a stack to its fade.
- Size: `floatSize()` 22 CSS px on phones/laptops, up to 28 on big screens (`Scene.ts:567`).
- Events mapped to floats (`Scene.handle`): gathered, collected, tool_upgraded, building_done,
  build_done ("Stone base"), crafted (`+10 Planks` at the station), furnace_out, barrel_broken,
  node_hit, task_done, plus refusal/info floats over nodes.
- HUD-side feedback: toasts, chip `+pending` text, bar width transitions (400 ms), badge counts.

### 3.5 Particles and ambient motion

- `Particles.spawn(kind, x, y, count, color)`: smoke (puff sprite, grows), sparks, leaves,
  stone chips, dust (puff), splash, coins; gravity, drag, wind, spin, fade (`effects.ts:23-193`).
  Allocates a new `Graphics`/`Sprite` per particle, destroys it on death; no pool, no cap.
- Ambient: clouds, sun/moon arcs, stars, wind-driven canopy sway, waves/foam/sparkle, chimney
  smoke every 0.28 s, flame flicker, glows modulated by darkness, crew walk cycles, gulls,
  rain/fog transitions, the Signal's sweeping beam, the skiff lantern, torches.
- Build/landing: `Base.setTier(tier, true)` squashes the structure from 0.75x0.6 back to 1 with
  easeOutBack plus dust; `building_done` = dust + sparks + the name rising in gold.
- CSS: primary button pulse (2.2 s box-shadow), panel slide-in 220 ms, sheet-in 240 ms, toast-in
  240 ms, modal fade 200 ms, hover lift on dock buttons.
- None of it reacts to `prefers-reduced-motion`; there is no sound and no vibration.

### 3.6 The client-prediction pipeline (`state/store.ts`)

- `send(command)`: if server-only (`SERVER_ONLY`: market buy, casino rolls, PvP, perks, Signal),
  queue it and show it pending; else `applyCommand` locally -> new `base`, play its events
  (effects + toasts) at once, queue `{key, command, at}`, `flush()`.
- `flush()`: one request at a time; each answer replaces `confirmed` and rebases the remaining
  queue; a refusal the prediction missed rolls back with a one-line toast; a network error clears
  the queue and reloads.
- `tick()` (called by the scene every frame): sets `now`; if a timer is due (`nextEventAt`) or a
  node regrew, settles locally with `settleAll` and plays the events once (`timedKey` +
  `played` set, so the server's copy of the same moment does not replay them).
- SSE push from other tabs/timers rebases onto the queue (`onPush`).
- `sentKeys` and `played` are module-level Sets that are never pruned (`store.ts:279-281`):
  harmless today, a slow leak at clicker volumes.

---

## 4. What is directly reusable for a clicker / incremental UI

| Piece | Where | How it serves the redesign |
| --- | --- | --- |
| Screen-space floating numbers | `scene/effects.ts` `Floaters`; `Scene.floatSize` | the "+214" from the tap point is already right (crisp, stacked, retire-on-next-hit). Add pooling, BitmapText, combo colouring, and a cap of live floats. |
| Particle system | `scene/effects.ts` `Particles` | coins/sparks/leaves/stone/dust/smoke bursts per click. Needs a pool and a max-live budget for click spam. |
| Fixed-size tap targets (D48) | `nodes.ts hitRadius`, `raids.ts TAP_PX`, `den.ts MIN_TAP`, `MapView SITE_TAP_PX` | the pattern "hit area in CSS px converted through the world transform" is exactly what a big clickable object needs at any zoom. |
| Node shake / fall / crumble / regrow pop / wear cracks | `scene/nodes.ts` | per-click squash-and-shake of the click target; "damage" states on a clickable object; regrow as a soft cooldown. |
| Building spots with 3 drawn levels each | `scene/base.ts SPOTS`, `scene/buildings.ts makeBuilding` | generators/automations can be the 18 buildings; visual level 1/2/3 at milestone counts (e.g. 1, 25, 100 owned) plus a count badge. "The base tells the story" holds. |
| Station work rings (fixed 9 px pies) | `Scene.syncWork` | per-generator cycle progress ring (AdCap's production bars) in the scene. |
| Scaffolds + build pop | `Base.showScaffold`, `Base.setTier(..., true)` | "buying" feedback; rebuild after the nuke. |
| Night tint + lights layer | `Scene.ambient`, `Scene.lights` (D47) | free atmosphere; the nuke's fireball and the red button's glow belong on `lights`. |
| Day/night + weather | `palette.ts`, `sky.ts`, `effects.ts Weather` | idle ambience; can host an "ash fall" weather after a nuke. |
| Crew actors | `scene/actors.ts` | workers walking to posts = visible automation (Egg, Inc./AdCap managers). |
| Full-screen pan/zoom Pixi view | `map/MapView.ts` (D88) | template for the prestige tree (section 6). |
| Map tap -> React detail panel with one primary | `store.focusMap` + `MapPanel.tsx` | template for "tap a tree node -> bottom sheet: cost, effect, Buy". |
| Welcome back modal | `hud/AwayModal.tsx` | offline earnings card ("you were away 3h · +X"), one Collect primary. |
| Season-over modal | `hud/SeasonOver.tsx` | template for the post-nuke results card (points earned, what is kept, "Begin again"). |
| Legacy panel | `hud/panels/Legacy.tsx` | prestige shop row pattern: name, pips, effect now -> next, disabled-with-reason Buy. |
| Cost chips + "Make X" + needLabel | `hud/Cost.tsx` | rule 3/4 compliant cost display for every buyable. |
| Advisor + hints that retire after 2 uses | `domain/advisor.ts` (`HINT_RETIRE_AFTER = 2`), `Dock.tsx` | onboarding by revealing the next mechanic (rule 6) fits incremental games well. |
| Storage bars and pending counts | `TopBar.tsx` chips | resource strip with caps; needs smooth counting (section 5.3). |
| Client prediction | `store.send/flush/rebase` | instant local response to taps; keep, but batch clicks. |
| LocalBackend (whole game in browser) | `net/local.ts` | demo mode and screenshots without the API; also a natural offline/single-player harness. |
| Demo clock controls | `state/clocks.ts`, `DemoDrawer.tsx` | speed/pause/jump for tuning idle curves by eye. |
| Screenshot harness | `scripts/shots.mjs`, `debug.ts` (`frozen`, `frames`, `nodeMarker`) | mandatory review loop; extend with cinematic/tree states. |
| Tokens | `styles/tokens.css` | tier colours, success/warning/danger, glass panels, radius; keep as the base theme. |

---

## 5. What would need to change

### 5.1 The dock's five actions

Today the dock is a navigation bar to five management panels, one of which the advisor lights
up. A clicker wants (AdCap/Egg, Inc./Clicker Heroes pattern) one huge tap target in the scene and
an always-visible, scrollable buy list with "x1 / x10 / x100 / Max" and progress bars. Options:
- Phones: replace the dock with a bottom "shop drawer" (collapsed: next 1-2 affordable buys +
  a handle; expanded: the full generator/upgrade list) and move navigation (Tree, Map/expeditions
  if kept, Inventory, Settings) to a slim tab row. Keep the 44 px and "labels never wrap" rules.
- The "exactly one primary per view" rule (6.3.1) conflicts with a shop where 3-10 rows are
  affordable at once. Plan: the advisor still crowns one row (the best value), the rest are
  secondary-but-enabled; or amend the rule in `docs/decisions.md` for the shop view.
- Gather's 10-minute cooldown and "Collect" must go or change meaning: in an incremental game
  production auto-banks (or banks on any tap) and the click is the active verb.

### 5.2 Panels

The single-panel model (`state.panel`, one `<aside>` at a time, toggled) suits occasional deep
dives (craft recipe tree, Den, Defence). A clicker needs the buy list **persistently visible next
to the tap target**. On desktop that is a permanent right column (the scene camera should then
centre in the remaining width; today the side panel simply covers the scene, cf. ui-review W3
"floater behind the side panel"); on phones a drawer that shares the screen with the scene
instead of covering 70% of it. `hudInsets()` (`Scene.ts:87-91`) already reads the top bar and
dock rects from the DOM for the map; the base camera would need the same treatment.

### 5.3 The resource strip and number refresh

- Stock and pending are split (`1.8k +244`): accrued production waits to be collected
  (`hud/derived.ts pendingOf`, cached per second). Incremental games show one number that grows
  smoothly. Either auto-collect in the domain, or display stock+pending as one animated total.
- Numbers update at most once per second (the cache) or on a command. A smooth counter that
  interpolates every frame must **not** go through React state: write `textContent` from a rAF or
  the Pixi ticker via a ref (or draw it in Pixi), keeping narrow selectors intact.
- `abbrev` drops fractions: rates like "0.4/s" cannot be shown; add a rate formatter.

### 5.4 Clicks as commands

Batch: accumulate taps client-side for ~0.5-1 s and send one `clicks` command (count, first/last
time); the server validates against a max clicks/second and an anti-autoclicker ceiling; the
client still predicts each tap locally. Without this, `flush()`'s serial queue + `rebase()` and
the whole-`base` subscribers (Dock, Build, Craft, Defence panels re-render on every new `base`)
turn click spam into jank.

### 5.5 Feedback budget for spam

- Pool `Text` floaters (or switch to `BitmapText` with a dynamically installed bitmap font from
  Roboto Condensed) and cap live floats (e.g. 12), merging rapid gains into a running "+1.2k"
  combo label at the tap point.
- Pool particles; cap per burst at clicker rates (10 per hit x 15 hits/s = 150 allocations/s
  today).
- Add sound (WebAudio, a handful of short procedural or owner-supplied sounds) and
  `navigator.vibrate` on Android; neither exists. Respect `prefers-reduced-motion` (none today).

### 5.6 Things that go if seasons/systems go

Client pieces tied to seasons: TopBar season line (`TopBar.tsx:23-30`), `SeasonOver.tsx`, the
Legacy and Hall tabs (`panels/Feed.tsx` `FEED_TABS`, `panels/Legacy.tsx`), `panels/Signal.tsx`
and `scene/signal.ts` (tower on the slope), store fields/actions `season`, `legacy`, `signal`,
`seasonSeen`, `markSeasonSeen`, `loadLegacy`, `loadSignal`, `buyPerk`, `setCosmetic`,
`giveSignal`, `demoNewSeason`, `demoSeason`; `seasonDay` drives "DAY 4" in the clock chip;
`LocalBackend` W7 demo data (`net/local.ts`). The day/night cycle does not depend on seasons in
server mode (local time), so it survives.
Den (market, contracts, casino: `panels/Den.tsx`, `Games.tsx`, `scene/den.ts`), raids
(`panels/Defence.tsx`, `scene/raids.ts`, `RaidAlert.tsx`), map/expeditions (`map/MapView.ts`,
`panels/MapPanel.tsx`, `ReportCard.tsx`), crew (`panels/Squad.tsx`, `scene/actors.ts`, `hud/
crew.ts`) and crafting (`panels/Craft.tsx`, `Furnace.tsx`) are each self-contained panels plus a
scene object; removing any is mostly deleting files + dock entries + `Panel` union members.

### 5.7 The red button vs. the red primary

Primary = red gradient pulse (`hud.css:213-250, 401-406`); `--accent #cd412b`; "YOU" tile red;
`--danger #f05252` and PvP uses a red outline. The nuke button needs its own visual language
(physical domed button under a hinged safety cover, yellow-black hazard frame, wobble/glow) and
must never be the advisor's primary; under rule 6.3.1 it is a "destructive" action, so danger
styling is allowed, and rule 4 requires a confirm with what is gained/kept/lost first.

---

## 6. Where a big pan/zoom prestige tree can live

### 6.1 Recommended: a third Pixi view beside base and map

- Add `view: "base" | "map" | "tree"` (`store.ts:115`, `setView`), and in `Scene.step` hide the
  world layers and show a `TreeView.container` exactly as the map does (`Scene.ts:508-525`).
- Copy MapView's proven input code (`MapView.ts:548-639`): pointer map for multi-touch, drag with
  an 8 px move threshold so taps are not eaten, pinch, wheel zoom around the cursor, clamped pan,
  `dragStart.moved` guard on node taps. Widen the zoom range (MapView clamps 1-3x; a "massive"
  tree wants ~0.25-2x) and add a minimap or "jump to affordable" buttons.
- Nodes as fixed-on-screen tap targets (D48: >= 44 CSS px, i.e. radius >= 22) with the drawing
  scaled by zoom; labels in a screen-space `labels` container (D46) with level-of-detail: hide
  labels below a zoom threshold, show only icon + state ring, so 300-1000 nodes stay readable.
- Performance (60 fps on phones): mark the tree container as a v8 render group
  (`isRenderGroup = true`) so pan/zoom is a single transform; draw edges once into one
  `Graphics` (or cache it as a texture; check v8.21's `cacheAsTexture`) and redraw only on state
  change; cull off-screen node containers; keep per-frame work to the camera and a few pulsing
  "affordable" glows. `Text` per node is the expensive part: use `BitmapText` or only label
  nodes near the viewport centre.
- Node states need distinct looks: locked (dim, padlock), reachable (outline), affordable (glow,
  the advisor's pick pulses), owned/maxed (filled, tier colour), plus edges lit along owned paths.
- Tap -> React bottom sheet / side panel with the node's icon, name, effect now -> next, cost
  in prestige currency, "Buy" (one primary) or the disabled reason ("Need 12 more fragments"):
  the `focusMap` -> `MapPanel` pattern (`store.ts:871-873`). The sheet must not cover the tapped
  node: pan the camera so the focused node sits above the sheet (MapView already reserves HUD
  insets; add the sheet height).
- Buy is a server command (today's `buy_perk` is server-only; prestige points live server-side),
  so the sheet shows pending until the answer, as Legacy does (`Legacy.tsx:38-40`).
- Screenshots: add `tree` to the shots `state` keys (view, camera x/y/zoom, focused node).

### 6.2 Alternative: DOM/SVG tree in React

A `transform: translate/scale` container of absolutely positioned buttons/SVG paths is simpler
for accessibility, crisp text, inline SVG icons and 44 px buttons, and fine up to a few hundred
nodes with `will-change: transform`. It breaks the established pattern (D88 chose Pixi for the
chart) and pinch handling would have to be rewritten in React. Recommendation: Pixi, reusing
MapView, unless the tree is small (< ~150 nodes).

---

## 7. Where a dramatic nuke cinematic can live

All of it can be done with the current engine; no assets are required (procedural like D41),
and the owner's SVGs can replace parts later.

| Beat | Layer / hook | Notes |
| --- | --- | --- |
| The red button appears | scene object on a new spot in `SPOTS` (`base.ts:34`), e.g. a silo hatch on the slope, glow on `lights`, fixed-size tap target (D48), or a HUD element | "the base tells the story": it should rise out of the ground when prestige unlocks; on phones the scene object can be the way in, as the skiff and shield are today |
| Confirm (rule 4) | React modal (`.modal-backdrop` pattern) | points to gain, what is kept (tree, fragments) and lost (everything else), a hold-to-confirm or flip-cover-then-press; danger styling, never the advisor's primary |
| Siren, HUD leaves | React flag `cinematic` hides TopBar/Dock/Panel (CSS fade); red pulse overlay | HUD is a sibling of the canvas (`App.tsx`), easy to fade |
| Missile launch and arc | new container in `world` above the base (or after `particles`) | smoke trail via `Particles.spawn("smoke")`; exhaust glow on `lights`; it can come from the sea (left, x<480) towards the base at x=1000 |
| Flash | screen-space white `Graphics` added to the stage above `weather`/`markers`, or a CSS overlay `div` over everything (covers the HUD too) | 0 -> 1 in ~80 ms, decay ~600 ms; avoid filters on phones |
| Fireball + shockwave | glow sprites (`glowTexture`) on `lights` (D47, above the night tint so it burns orange, not olive); an expanding ring `Graphics`; dust along the ground line | `ambient.tint` override to a hot orange then a brown "nuclear dusk" (`Scene.ts:563`) |
| Camera shake | offset added where `world.position` is set each frame (`Scene.ts:541`); `lights`/`markers`/floaters copy it already | decaying random offset, maybe a brief zoom-in punch (`world.scale`) |
| Mushroom cloud | stack of `puffTexture` sprites (stem + cap), tinted from white/orange to grey, rising and spreading; lit underside glow on `lights` | `Particles` smoke already grows and fades; a dedicated emitter shapes the cap |
| Island wiped | `Base.setTier` to a new "crater/ruins" drawing; `setStations` with no buildings; nodes forced depleted; `actors.sync([])`; charred ground tint; `Weather` gets an "ash" mode (grey slow flakes) | all are existing setters; the store's real reset arrives from the server |
| Results card | React modal modelled on `SeasonOver.tsx` | "+42 Blueprint Fragments", run stats, "Rebuild" primary, "Open the tree" secondary |
| Rebuild | `Base.setTier("twig", true)` pop + dust; first node regrows with its pop; actors walk up from the shore (existing "arrive" behaviour) | shows the new run starting from nothing |

Engineering notes:
- Run the timeline on real time (`ticker.deltaMS`), never on the demo/game clock (rule 9; the
  memory note "active-play timers are real seconds").
- Make it skippable after the first viewing and short (~6-8 s); offer a reduced-motion version
  (no shake/flash, a fade), which the codebase has no precedent for yet.
- Screenshots: add a debug hook to pin the cinematic at a phase/time (like `frozen` + `time`)
  so `web:shots` can capture launch, flash, cloud, wasteland, rebuild.
- Sound would carry half the drama; there is no audio code at all yet.

---

## 8. Number formatter and icon system

### 8.1 `abbrev` and `duration` (`packages/domain/src/words.ts:11-38`)

```ts
export function abbrev(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const magnitude = Math.trunc(Math.abs(amount));
  if (magnitude < 1000) return `${sign}${magnitude}`;
  const units = ["k", "M", "B"];
  ...
}
```

Measured (same code run in Node):

| input | output |
| --- | --- |
| 999 / 1234 / 12400 | `999` / `1.2k` / `12.4k` |
| 1.2e6 / 1.5e9 / 999e9 | `1.2M` / `1.5B` / `999B` |
| 1e12 | `1000B` |
| 1.234e15 | `1234000B` |
| 9.007e15 (MAX_SAFE_INTEGER) | `9007000B` |
| 1e21 | `1000000000000B` |
| 1e100 | `1e+91B` |
| 1.79e308 / Infinity | `1.79e+299B` / `InfinityB` |
| 0.5 / 12.7 | `0` / `12` (truncated) |

So it does **not** handle 1e15 or 1e100. Extending the suffix list (T, Qa, Qi, Sx, Sp, Oc, No, Dc,
then `1.23e45` or "aa, ab..." letters) is a ten-line change with tests in `words.test.ts`, and it
reaches the Discord bot too (it imports the same `words`). The real constraint is upstream:
- State amounts are integers by rule (CLAUDE.md section 4), stored in SQLite INTEGER, sent as JSON
  numbers. Exact only to 9.007e15; doubles max out at 1.8e308.
- A Cookie Clicker / AdCap / Realm Grinder curve passes 1e15 within hours and 1e100 in weeks.
  That needs a big-number type (e.g. break_infinity/break_eternity style mantissa+exponent)
  across domain, DB, wire, simulator and bot words: a large change.
- A Melvor-style curve (linear-ish, numbers stay in the millions/billions, depth from breadth)
  fits the current integer design and formatter with only the suffix extension.
This is a design decision the planner must make early; the web side is cheap either way.

`duration`: `2d 4h`, `3h 20m`, `45s`; no years, fine for idle timers.

### 8.2 Icons today

- HUD: `hud/Icon.tsx` `Tile` = "Placeholder icon: a tinted rounded square with initials. Real art
  drops in here later." `ResourceIcon` (colour + fixed initials from `@wipe-day/content/look`,
  `packages/content/src/look.ts`: 23 resources), `ItemIcon` (item tier colour + initials of the
  name). Used in 15 files (TopBar 3, Build 4, Den 3, Furnace 3, Inventory 3, ReportCard 3, ...).
- Dock and chips: literal two-letter glyphs passed to `Tile` (`Dock.tsx`: GA/CO, UP, CR, FU, MA,
  SQ, IN, DE, DF, FE, TA; TopBar: "YOU", "SQ").
- Casino segments/symbols: colours in `state/world.ts:177-196` (gull, crab, anchor, lighthouse,
  crown, tide; bolt, gear, fish, anchor, lantern, beacon), lettered tiles.
- Scene: everything procedural (`Graphics`), no textures except runtime gradients/glow/puff
  (`scene/textures.ts`).
- Discord: the same tiles from `look.ts`, drawn by satori (`apps/discord/src/ui/home.ts`).
- PWA icons: one inline SVG in `apps/web/scripts/icons.mjs` rendered to PNG.
- No `.svg` file exists in the repo (`git ls-files`, `find`).

Rules that apply (CLAUDE.md 6.2/7, decisions): every resource, item, building, site and action has
exactly one icon used identically in scene, panels, buttons (and Discord); every entity id is its
locale key and asset name (lowercase `snake_case`, 2-32 chars); D6 (old bot) prefixed tiers
`tier_{id}` and perks `perk_{id}` because `wood`/`stone` tiers collide with resources; D43: no
icons from another game.

### 8.3 Where the owner's SVGs should go (proposal for the plan)

- One shared folder, so web and bot use the same files: e.g. `packages/content/icons/<kind>/<id>.svg`
  (or a new `packages/art`), with a test that every id in the data files has an icon (like the
  locale cross-checks in `packages/content/src/load.ts`), falling back to today's tile.
- Conventions to agree on with the owner: one square `viewBox` (24 or 48), no embedded raster,
  shapes in `currentColor` where they should take the tier/resource colour, a fixed safe padding,
  legible at 16 px (top bar mini tiles are 16 px: `.tile.mini`) and at 44-48 px.
- React: replace the inside of `Tile`/`ResourceIcon`/`ItemIcon` with an inline SVG (import via
  Vite `?raw` or a generated sprite sheet `<svg><symbol id=...>` + `<use href>`), keeping the
  tinted frame as the tier/rarity border. One component change upgrades all 15 call sites.
- Pixi: icons in the scene or the tree view can be parsed as vector (`Graphics.svg(...)` /
  `Assets.load` with `parseAsGraphicsContext`) or rasterised at device resolution; draw them in
  screen space like text (D46) so zoom never blurs them.
- Discord: satori renders inline SVG/data URIs; keep the bot on the same files (W8 consistency).

Ids that need an icon today (from `packages/content/data`):
- resources (23): timber, stone, ore, ingots, sulfur_ore, sulfur, fibre, hide, fat, food, scrap,
  planks, rope, cloth, leather, charcoal, fuel, plates, frames, gears, springs, gunpowder, charge
- items (15): crate, large_crate, strongbox, bandage, first_aid_kit, bow, spear, crossbow,
  leather_vest, roast, stew, feast, tin_keycode, copper_keycode, brass_keycode
- buildings (18): workbench, furnace, campfire, warehouse, garden, loom, bunkhouse, lights,
  tannery, kiln, press, watchtower, walls, traps, turret, generator, radio_mast, dock
- tools (5): rock, stone_tools, iron_tools, salvaged_tools, power_tools
- base tiers (5, prefix `tier_`): twig, wood, stone, metal, hqm; furnaces (3): furnace,
  large_furnace, electric_furnace
- node kinds (5): tree, stone, ore, sulfur, fibre
- sites (15) and regions (13), crew (12, portraits), traits (11), perks (8, prefix `perk_`),
  skins (3), modifiers (4), casino segments (6) and symbols (6), Den goods/contracts (~25 lots)
- actions (no data file, D8 said emoji for the bot): gather, collect, upgrade/base, craft,
  furnace, map/holdfast, squad, inventory, den, defence, feed, tasks, close/back.
A redesign that cuts systems should cut this list first, so the owner does not draw icons for
features that disappear (sites, Den lots, casino, raids, perks). New ones it will need: the click
target, prestige currency (fragments), the red button, tree branches/nodes, generators.

---

## 9. Mobile-first constraints the redesign must respect

Hard rules (CLAUDE.md 6.1-6.4, decisions):
- Designed at 390 px first; phones: <=720 px breakpoint (`hud.css` `@media (max-width: 720px)`),
  short landscape <=520 px height compacts the top bar and dock. Manifest is portrait
  (`public/manifest.webmanifest`). Safe areas via `--safe-top/--safe-bottom`.
- Touch targets >= 44 CSS px; labels never wrap over buttons; legible text (all >= 11 px today).
- Five dock actions on phones (D45/D88) - a rule the redesign will replace, so it needs a new D.
- Scene text in screen space (D46); fire/glows on the lights layer (D47); scene tap targets fixed
  on screen (D48).
- 60 fps scene; the HUD reads the store through narrow selectors; the scene calls `tick()` once
  per frame; per-frame derived values go through `hud/derived.ts` (cached per second).
- Active-play timers (node regrow, mini-games) are real seconds to minutes and never speed up with
  the demo clock (rule 9; D65; memory note).
- Exactly one primary per view, no dead ends, disabled buttons say why, cost/outcome before
  commitment, helpful errors, onboarding through one glowing action, feedback within a second,
  welcome-back summary with one collect (rules 6.3.1-6.3.10).
- Every visual change reviewed with `pnpm web:shots` and written up in `docs/ui-review.md`.

Measured today (phone 390x844, scale 0.443):
- Under 44 px: panel close button 32x32 (`hud.css:291`); `.btn` ~38-40 px tall (14 px text + 10
  px padding), `.btn.small` ~30 px (`hud.css:384-414`); tabs 36 px (`hud.css:972`); toast button
  30 px (`hud.css:901`).
- Scene hit areas in world units (`nodes.ts:640-647`, `den.ts`, `nodes.ts Barrel`): tree ~44x75
  CSS px (ok); ore rock 44x27; stone rock 35x21; sulfur rock 38x23; barrel 28x49. The marker
  (r 26 px), shield (r 26 px), skiff (>= 64 px) and map sites (r 24 px) are fixed on screen.
- Crew figures ~17 CSS px tall; a fully built base is ~120-160 px tall (`phone_buildings_full`).
- Selectors that do real work every frame: TopBar crew (`advise`, `crewSummary`, `crewCap`),
  `storageCap` in TopBar, RaidAlert (`raidWarned`, `npcOdds`, `advise`); 60 fps re-renders while
  open: `Den.tsx:523`, `Games.tsx:185`; once-a-second re-renders: ReportCard (even when closed,
  `ReportCard.tsx:28`), MapPanel, Squad, Craft, Games, DemoDrawer.
- Allocation per effect: new `Text` per floater line, new `Graphics` per particle; `sentKeys` and
  `played` Sets never shrink.
- Renderer resolution capped at 2x; antialias on; `backdrop-filter: blur(14px)` on every glass
  element (a known cost on low-end Android when many glass rows scroll).

---

## 10. Open UI issues from `docs/ui-review.md` (and roadmap open items), against a redesign

| Open item (source) | Effect of an idle/clicker redesign |
| --- | --- |
| On phones the scene sits in the lower half under a lot of sky; crew ~17 px (W2) | **Must be solved**: the empty sky is where the clicker target / shop should go; a camera change (raise ground line or zoom on the base) |
| When the advisor points at the barrel no dock button is primary; a disabled Gather can be primary while counting down (W1) | **Moot** if Gather's cooldown goes and the click target is always the obvious action |
| Scene floater from a station behind the side panel partly covered (W3, desktop) | **Worse** with a persistent shop column unless the camera recentres in the free area |
| Station tabs past the fifth scroll sideways without a hint (W3; roadmap) | Moot if the crafting web is cut; **worse** if the shop/tree adds category tabs; needs a visible scroll affordance either way |
| Den tab row (rank categories) scrolls sideways without a hint (W5) | Moot if Den/ranks are cut |
| Desktop side panel covers the island's east coast (W4a; roadmap) | Same pattern would hit a tree view: panel/sheet must be part of the camera insets |
| The map has no night look (W4a/W4b; roadmap) | Moot if the map is cut; unchanged otherwise |
| Crew faces are placeholders (W4a; roadmap) | Unchanged or moot (portraits = icons/art pass) |
| The scene does not say who works where on a tap (W4b) | Tappable buildings/workers become important for an automation game (tap a generator to upgrade it) |
| Skiff crowds the boathouse at the shore (W5) | Moot if the Den goes |
| Slot symbols and Den goods are lettered placeholder tiles (W5) | Solved by the SVG icon pass; moot if casino goes |
| Wheel turns on the demo clock (W5) | Moot if casino goes |
| Demo drawer button overlaps the raid banner on phones (W6) | Demo only; moot if raids go |
| Shield badge at the left edge of the phone view; ridge figures small (W6) | Moot if raids go |
| Full shot run > 10 minutes (~125 shots) (W6) | The redesign should prune obsolete shots; **worse** if added on top |
| The Signal draws only finished stages (W7; roadmap) | Moot if seasons/Signal go |
| Titles shown only in the Legacy tab (W7/W8; roadmap) | Moot if titles go; a prestige count/rank beside names could replace them |
| Discord mock is an approximation; owner's first live `/base` on a phone is the real check (W8) | Unchanged; any formatter/icon change also changes the bot's cards |
| Tannery racks read like a table (W2) | Art pass; unchanged |

Roadmap note: owner screenshots are bugs with priority over features; the plan agreed on
2026-10-07 was W9 live ops then a research tree (`docs/game-design.md` 5.5: "notes", five
branches, 6-8 nodes each, never more than +10% per node, reset each season). The "MASSIVE tree"
request supersedes that sizing.

---

## 11. Suggested keep / change / remove list for the web client

Keep: the Pixi + React split, layer stack, camera rules (with a phone re-framing), palette and
tokens, procedural art (until the owner's art lands), floaters/particles (pooled), tap-target
pattern (D48) everywhere, MapView's input code (for the tree), client prediction + LocalBackend +
demo clock + screenshot harness, AwayModal/SeasonOver/Legacy patterns, advisor + retiring hints.

Change: dock -> shop drawer + slim nav; Gather/Collect -> click verb + auto-bank; resource strip
-> smooth totals + rate per second; commands -> batched clicks; formatter suffixes (+ big-number
decision); primary colour vs. red button; panels -> persistent list on desktop and a shared-space
drawer on phones; touch-target fixes (close, small buttons, tabs, rock hit areas); per-frame
selectors made cheap; Text/particle pooling; sound, haptics, reduced motion.

Remove if the design drops them: season UI (TopBar line, SeasonOver, Legacy/Hall tabs, Signal),
Den (market, contracts, casino), raids/PvP UI, map/expeditions/report cards, crew panels, the
crafting web - each is a self-contained set of panel + scene object + store fields + shots.

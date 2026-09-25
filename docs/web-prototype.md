# Web prototype (`apps/web`)

A visual, non-playable prototype of Wipe Day as a web app: a living side-on base on a shore,
a day cycle, weather, survivors that walk to nodes, and the HUD that the real game will use.
Numbers and rules inside it are placeholders; the real domain package replaces them later.

## Run

```
pnpm install
pnpm web            # dev server on http://localhost:5173 (also reachable on the LAN)
pnpm web:typecheck  # strict TypeScript
pnpm web:shots      # headless screenshots into preview/web/ (needs the dev server running)
pnpm web:build      # production bundle into apps/web/dist
```

The `✦` button (bottom left on desktop, under the resource strip on phones) opens the demo
drawer: time speed, pause, +1 h / +6 h, weather, base tier, spawn a barrel, give everything.

## What is in the scene

| Layer | File | Notes |
| --- | --- | --- |
| Sky | `src/scene/sky.ts` | gradient from the palette, sun and moon arcs, stars, clouds |
| Terrain | `src/scene/terrain.ts` | parallax ridges with treelines, island with lighthouse, ground with path, grass, pebbles, organic shoreline, waves, foam, sparkle |
| Base | `src/scene/base.ts` | one structure per tier (Twig, Timber, Stone, Sheet Metal, Armored), stations placed around it from the store (cupboard, furnaces, kiln, press, workbench, crates, campfire, lantern), window glows, scaffold while building, chimney smoke |
| Nodes | `src/scene/nodes.ts` | clickable trees, rocks, fibre; the "hit the marker" mini-game; the barrel on the shore |
| Actors | `src/scene/actors.ts` | survivors with hat colours walking between the base and nodes, resting at night; gulls |
| Effects | `src/scene/effects.ts` | particles (smoke, sparks, leaves, dust, splash, coins, stone), floating gains, glows, rain and fog |
| Palette | `src/scene/palette.ts` | time-of-day keyframes, `gloom()` for weather, tier materials, ground/sea colours |
| Scene | `src/scene/Scene.ts` | Pixi application, camera rules, layer order, store sync, event → effect mapping |

The store (`src/state/store.ts`, Zustand) holds the fake world and a fake clock (240 game
seconds per real second by default). The HUD (`src/hud/*`) reads it with narrow selectors so
the scene can tick at 60 fps without re-rendering React every frame.

## Camera rules

- Design stage 1600×900, ground line at y=560, base at x=1000, sea left of x≈480.
- Wide screens: scale so that 800 stage units fill the height (a 12% zoom); the ground line sits
  at 72% of the viewport.
- Tall screens: never fewer than 760 stage units across, centred on x=930; the ground line sits
  at 66% of the viewport.
- Sky and ground extend 800 units past the stage so no aspect ratio shows an edge.

## Review loop

`pnpm web:shots` writes 26 PNGs and `preview/web/index.html`. States covered: morning, noon,
dusk, night, rain, fog, every tier, a build in progress, every panel, the welcome-back modal,
ultrawide, laptop, phone portrait and landscape, tablet. Notes per iteration live in
`docs/ui-review.md`. Extend `SHOTS` in `apps/web/scripts/shots.mjs` when a new state appears.

# Web client (`apps/web`)

Wipe Day in the browser: a side-on island on a shore, a day cycle and weather, and the HUD. The
state lives on the server (`apps/api`) and every rule comes from `@wipe-day/domain`, the same
code the server runs, so the client predicts every command and the server's answer wins (D64).

After R0 the client is a **bare island**: sky, sea and land, a supplies counter, and taps on the
land that travel on the slim taps path. R1 brings the run (the tap target, lines, the drawer),
R2 the Big Red and the Blast Map (`docs/redesign/08-screens.md`).

## Run

```
pnpm install
pnpm dev            # API on :8787 and the web client on http://localhost:5173 (also on the LAN)
pnpm web            # the web client alone: without an API it falls back to demo mode
pnpm web:typecheck  # strict TypeScript
pnpm web:shots      # headless screenshots into preview/web/ (needs `pnpm web` running)
pnpm web:build      # production bundle into apps/web/dist (the API serves it in production)
```

Locally the login card offers "Test 1/2/3" (dev-only test players); Discord login appears once
`DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are set. Open `http://localhost:5173/?demo` for
demo mode: the whole game in the browser, with the `✦` demo drawer.

## Clocks (D138)

- `game`: the clock the domain is given. In demo mode it runs at **1×**; the drawer pauses it
  and jumps it +1 h, +6 h or to the next 08:00. A jump is time passing for everything the domain
  times (the Night Shift, Hustle, buffs), exactly as on the server. Against the API it is the
  server-synced clock (`net/http.ts`).
- `wall`: a 1× clock for animation only (sky drift, floaters, particles, later the cinematic).
  The domain never reads it, so a jump never moves a real-second animation (rule 6.3.9).
- Both are on `window.__wipeDay.clocks` in development, and shots pin them separately (`time`
  and `wall`).

## How state flows

| Piece | File | Does |
| --- | --- | --- |
| Content | `src/state/world.ts` | loads the shared data and locale (Vite JSON5 plugin), validates them, `words` (the formatter) |
| Backend | `src/net/http.ts`, `src/net/local.ts` | the API (fetch, retries with the same key, event stream, server clock) or demo mode (the domain in the browser) |
| Store | `src/state/store.ts` | `confirmed` server state plus the queue of sent commands; `base` = what the player sees (D64) |
| Taps | `src/state/taps.ts` | coalesces taps into the queue's open tail (D134) |
| Messages | `src/state/messages.ts` | refusals and happenings as one-line toasts, with a button to where the missing thing comes from |
| Events | `src/state/events.ts` | the domain's events that the scene turns into effects |

**The taps path.** A tap (or every 250 ms of a held press) adds to the queue's open tail entry
`{type: "taps", count, from, to}`. The tail closes when it is 1 s old, holds 30 taps, another
command is queued behind it, or the tab hides; only then does it get its idempotency key. The
store predicts by applying the merged tail to a snapshot taken when the tail opened, so the
visible base always equals what the server computes for that batch. Commands are sent one at a
time, in order. A network error, a 5xx or a 429 keeps the entry and retries it with the same key
("Reconnecting… your taps are saved"); nothing predicted is dropped. The server credits taps
through a token bucket (15 a second, burst 45) and answers with the outcome and the state; other
tabs get a version-only push and refetch.

## What is in the scene

| Layer | File | Notes |
| --- | --- | --- |
| Sky | `src/scene/sky.ts` | gradient from the palette, sun and moon arcs, stars, clouds |
| Terrain | `src/scene/terrain.ts` | parallax ridges with treelines, the islet with its lighthouse, ground with path, grass, pebbles, organic shoreline, waves, foam, sparkle |
| Effects | `src/scene/effects.ts` | particles, floating gains, glows, rain and fog |
| Palette | `src/scene/palette.ts` | time-of-day keyframes, `gloom()` for weather, era materials, ground/sea colours |
| Scene | `src/scene/Scene.ts` | Pixi application, camera rules, layer order, store sync, the land's tap area, event → effect mapping |

The drawings of the old base, buildings, nodes and crew (`scene/base.ts`, `buildings.ts`,
`nodes.ts`, `actors.ts`) stay in the repo for R1, which redraws them as lines at 1, 25 and 100
owned, the era target and the hands walking to their lines.

The HUD (`src/hud/*`) reads the store with narrow selectors so the scene can tick at 60 fps
without re-rendering React every frame. The supplies counter is a `<span>` written by a rAF loop
from `suppliesAt` (closed-form settle), never by React.

## Camera rules

- Design stage 1600×900, ground line at y=560, sea left of x≈480.
- Wide screens: scale so that 800 stage units fill the height (a 12% zoom); the ground line sits
  at 72% of the viewport.
- Tall screens: never fewer than 880 stage units across, centred on x=915 (D75); the ground line
  sits at 66% of the viewport. R1 reframes the phone view around the tap target (on the rise at
  about 40% of the height, at least 120 CSS px tall).
- Sky and ground extend 800 units past the stage so no aspect ratio shows an edge.

## Review loop

`pnpm web:shots` writes the shots in `SHOTS` (plus `__zoom` crops) and `preview/web/index.html`.
Shots run in demo mode (`?demo`) and pin the demo clocks through `window.__wipeDay.clocks`:
`time` is seconds on the game clock (the demo starts at the epoch), `wall` the animation clock;
HUD keys set the HUD and every other key overwrites that field of the run. `--only <text>`
renders just the shots whose name contains it. Notes per iteration live in `docs/ui-review.md`.
The list per phase is `docs/redesign/08-screens.md` section 8; R0 has the bare island only.

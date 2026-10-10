# 09 Architecture: the engineering spec

Status: proposal, 2026-10-07, revised against the design director's resolutions (canon v2);
awaiting the owner's approval. Reader: the coding agent in R0-R7. On approval it lives at
`docs/redesign/09-architecture.md` and CLAUDE.md points to it (resolution 3.27). It turns canon 13
(architecture) into code-level rules, grounded in `main` at `58533e4`; line numbers are from that
commit. Rules of play live in `02`-`06`; numbers in `10-balance.md`; screens and the `SHOTS` list
in `08-screens.md`; phases and acceptance in `11-roadmap.md`. A number marked *(sim)* is owned by
`10-balance.md`. "Resolution x.y" means the director's resolutions.

---

## 1. Principles

### 1.1 Kept

| Principle | Where it lives today | What stays |
| --- | --- | --- |
| Pure domain | `packages/domain` (no IO, CLAUDE.md 3) | State + `now` + seed in, state + events out. Every rule is reachable from a unit test and the simulator. |
| Injected `Clock` | `packages/domain/src/clock.ts:15-25`, D51 | Domain functions take a plain whole-second `now`, read once per action. |
| Seeded randomness | `rng.ts` (`rng`, `seedOf`, `pickWeighted`) | Crits, flotsam gaps and kinds, Magnet hauls, flight variants: all from seeds with numeric tags (3.1), so the client predicts them. |
| Idempotent commands | `apps/api/src/game.ts:601-675`, D59 | One transaction, keyed by the client; a replay never repeats an effect. |
| Lazy settle | `settle.ts:23-74` (`settleAll`), `base.ts:591` (`settle`) | Rates piecewise constant, values computed on read, closed form. |
| Client prediction | `apps/web/src/state/store.ts:813-845`, D64 | Same `applyCommand` on both ends; the server's answer wins. |
| `World` for server knowledge | `world.ts:22` | Now: friends' Wipe Days, the Late Tide median, the Island Count, the Freighter, first finds. |
| One writer | D52; `season-cli.ts:24-36` calls the API over loopback | The API is the only process that opens the database while it runs. |
| Outbox after commit | `game.ts` `flush` (lines 422-427) | Pushes, feed and notifications leave only after the commit. |
| `event_log` | `store/schema.ts` `eventLog` | Append-only; its id sequence is never reset (the bot's cursor, `game.ts:474-498`), not even at the cut-over (13). |

### 1.2 Amended (each a decision in R0, from D127)

| Was | Becomes |
| --- | --- |
| "Integers in state" (CLAUDE.md 4) | Amounts are finite doubles behind `Amount`; counts stay integers (section 2). |
| D59: every replay returns the identical stored response, 7 days | Every command stores an outcome-only record without state; a replay gets the outcome and the current state. 1 h for taps and pings, 7 days for the rest (resolution 3.16). |
| "Every state change is logged" | Rare events are logged; taps, pings and purchases roll up into stats and the run summary (7.3). |
| One base per player per season, a monthly reset | One perpetual season row; the nuke overwrites the same `bases` row. |
| Storage caps, Collect to bank, upkeep | Production auto-banks; the Night Shift window bounds offline time. |
| Prestige bought server-side (`buy_perk` in `SERVER_ONLY`, `commands.ts:121-129`) | `meta` lives in the base; tree buys and the nuke are predicted. |
| The 25% legacy cap, four enforcements | Effect bounds and monotonicity tests (5.5). |
| `nextEventAt` lands builds and crafts | It only wakes the scheduler for notifications. |
| Weather is client demo state (`store.ts` `setWeather`); the live sky follows each player's time zone (`store.ts:970-974`) | Weather and the island's clock are domain data in `island.json5` (6.5, resolution 3.17). |
| The demo clock runs up to 2,400× with a speed slider (`state/clocks.ts`, `DemoDrawer.tsx`) | 1× with jumps, plus a `wall` clock (10.7, resolution 3.18). |

---

## 2. Numbers

### 2.1 `Amount` and the finite guard

`packages/domain/src/amount.ts` *(new)*:

```ts
/** A quantity of supplies or glass: a finite double, never negative unless named `delta`. */
export type Amount = number;

export function finite(value: Amount, what: string): Amount {
  if (!Number.isFinite(value)) throw new Error(`non-finite ${what}: ${value}`);
  return value;
}

/** Walks a state and throws on any non-finite number (NaN, ±Infinity). */
export function assertFiniteState(state: unknown, path = "state"): void { /* recursive */ }
```

- `finite()` wraps every value that can grow without bound: settle's sums, tap value, buy-k and
  buy-max costs, the nuke's gain.
- `assertFiniteState` runs after every simulator step and test command, and in the API's `save()`
  (`game.ts:267-288`) before `JSON.stringify`, which writes `Infinity` as `null`. A failure
  aborts the transaction with a 500 and reaches the owner (section 15).
- A later switch to a mantissa/exponent type is a type change behind `Amount`.

### 2.2 Counts and whole numbers

- **Integers** (`z.int()`, `Number.isInteger` asserted in tests): owned units, hands, nodes,
  nukes, Wipe Days, the glass level, scrap, ranks, Pocket slots, Logbook entries, taps, pokes,
  Freighter loads.
- **Glass** is an `Amount` that is always whole (gains are floored, grants are whole). It is exact
  below 2^53 (about 9e15 glass, a lifetime of about 3e85 under the fifth root); above that it
  stays a whole double. Tests assert integrality only below 2^53.
- **Fractional remainders stay.** Supplies are never floored in state (D19 retires). Display
  floors.

### 2.3 Content schema changes (`packages/content/src/schema.ts`)

- `const amounts = z.record(z.string(), z.int().min(0))` (line 21) is deleted with the
  resource economy. New helpers:

  ```ts
  const amount = z.number().finite().nonnegative();
  const count = z.int().min(0);
  const factor = z.number().finite().positive();      // multipliers, growth
  const seconds = z.number().finite().positive();     // cycles, buffs
  ```

- Lines, milestones and costs are validated as formulas, not rows (section 8.2). A content
  check proves every cost a player can reach is finite: `c_i × g_i^maxOwned < 1e200`.
- `perkBonusSchema` (`schema.ts:603-610`, max 25 per rank) and `checkLegacy`
  (`parse.ts:1001-1024`) are deleted.

### 2.4 The formatter (`packages/domain/src/words.ts`, replacing `abbrev` at lines 11-27)

One module for the web and the bot, so both print the same thing.

| Function | Use | Rule |
| --- | --- | --- |
| `fmt(x, mode)` | supplies, costs, gains | Below 1,000: a whole number (held amounts floor, others round). From 1,000: 3 significant digits with a suffix, trailing zeros kept so a ticking counter never changes width. |
| `fmtRate(x)` | `/s` under the counter, row rates | Below 10: up to 3 significant digits, trailing zeros trimmed (`0.4/s`, `8.25/s`). From 10: as `fmt`. |
| `fmtCount(n)` | glass, scrap, nukes, owned | Below 1,000,000: digits with separators (`2,154`). From there: as `fmt`. |
| `duration(s)` | timers | Unchanged (`2d 4h`, `45s`). |

- Suffixes: k, M, B, T, Qa, Qi, Sx, Sp, Oc, No, Dc (1e3 to 1e33), then `1.23e36`. They live in
  the locale as `format.suffixes` (CLAUDE.md 7).
- Rounding: **held amounts floor** (never claim what you lack); costs, rates and gains round
  half up, and a mantissa of 1,000 promotes (`999,999` is `1.00M`, not `1000k`). The buy
  button's state is authoritative; its reason prints the shortfall (`need 2`).
- **Scientific toggle** (settings, localStorage): from 1e6, `1.23e6`.
- `NaN` and `Infinity` print `—` and log in development.

| Input | `fmt` (held) | `fmt` (cost) | `fmtRate` | Scientific on (cost) |
| --- | --- | --- | --- | --- |
| 0.4 | 0 | 0 | 0.4/s | 0 |
| 8.25 | 8 | 8 | 8.25/s | 8 |
| 999.6 | 999 | 1.00k | 1.00k/s | 1.00k |
| 1,234 | 1.23k | 1.23k | 1.23k/s | 1.23k |
| 12,400 | 12.4k | 12.4k | 12.4k/s | 12.4k |
| 999,999 | 999k | 1.00M | 1.00M/s | 1.00e6 |
| 1.5e15 | 1.50Qa | 1.50Qa | 1.50Qa/s | 1.50e15 |
| 2.7e16 | 27.0Qa | 27.0Qa | 27.0Qa/s | 2.70e16 |
| 9.99e35 | 999Dc | 999Dc | 999Dc/s | 9.99e35 |
| 1.23e36 | 1.23e36 | 1.23e36 | 1.23e36/s | 1.23e36 |

Tests in `words.test.ts` cover every row, the promotion edge, negatives (`-1.23k`) and `NaN`.

---

## 3. State

### 3.1 Types (`packages/domain/src/state.ts`, new; replaces `BaseState` at `base.ts:78-168`)

```ts
export interface BaseState {
  v: 2;                            // anything else loads as absent (3.3)
  seed: number;                    // fixed at creation (randomInt on the server)
  createdAt: number;
  run: RunState;                   // lost on every nuke
  meta: Meta;                      // kept forever
}

export interface RunState {
  n: number;                       // run number: meta.nukes + 1 (every press counts)
  seed: number;                    // seedOf(base seed, meta.nukes)
  island: IslandId;                // "saltmarsh"; reserved for the Crossing
  createdAt: number;               // the nuke, or the base's creation
  startedAt: number | null;        // first taps or purchase; null = fresh. The run clock: records,
                                   //   the glass rate, the Dare's clock, the crown's 20 h rule
  afterglowFrom: number | null;    // the first taps batch's from' (resolution 3.2)
  firstBuyAt: number | null;       // the first purchase; null = rebuilding (6.2)
  settledAt: number;
  activeAt: number;                // last command: the Night Shift window's anchor
  madeAtActive: Amount;            // `made` at activeAt; welcome back shows made - madeAtActive
  supplies: Amount;
  made: Amount;                    // earned this run from every source
  era: TierId;                     // twig, wood, stone, metal, hqm
  eraAt: Partial<Record<TierId, number>>;   // seconds after startedAt each era landed
  lines: Partial<Record<LineId, number>>;   // owned units (integers)
  hands: LineId[];                 // manned lines, in hire order
  readyAt: Partial<Record<LineId, number>>; // unmanned lines: end of the cycle in flight (4.4)
  roster: number;                  // roster milestones reached; kept for the run (resolution 3.4)
  upgrades: UpgradeId[];           // shelf upgrades bought this run, Grip rungs included
  target: { taps: number; felled: number }; // toward the next fell; fells this run
  hustle: { value: number; at: number };    // meter 0..100 and the last tap's second
  bucket: { tokens: number; at: number };   // the tap credit (6.3)
  taps: number;                    // credited this run: the crit seed's index
  buffs: Buff[];
  grit: number;                    // 0..10 stacks (R5)
  flotsam: { k: number; at: number; caught: number;           // the cursor (6.4)
             flare: { at: number; kind: FlotsamId } | null };
  dare: { id: DareId; state: "on" | "done" | "failed" } | null;   // clock: startedAt (R7)
  peak: { rate: number; at: number };       // best glass per hour on the minute grid (4.6)
}

export interface Buff {
  kind: "rally" | "drone" | "adrenaline" | "rush";
  until: number;                   // whole seconds
  line?: LineId;                   // the drone's line
}

export interface Meta {
  nukes: number;                   // every press: run numbers and seeds
  wipeDays: number;                // counted nukes: Wipe Day #N, the agenda (resolution 3.1)
  lifetime: Amount;                // supplies made in finished runs since the last Crossing
  glass: { ever: Amount; held: Amount; level: number; spent: Amount };   // level: G(L) paid (6.2)
  nodes: NodeId[];                 // owned Blast Map nodes
  loadout: NodeId[];               // slotted keystones, at most 3 (R3)
  prefs: { foreman: boolean;
           deadHand: { on: boolean; at: 25 | 50 | 100 | 200 | "crowned"; stoppedRun: number | null } };
                                   // set_loadout (R5); presets: % of glass ever, default 100
                                   //   (errata E12); Stop sets stoppedRun to this run (`05` 6)
  logbook: { entries: LogbookId[]; hints: LogbookId[] };   // in the order earned; opened hints (R4)
  scrap: number;                   // recorded from R2, shown from R5 (resolution 3.20)
  ranks: Partial<Record<LineId, number>>;   // the line's hand, ranks 1-5 (R5)
  pockets: (UpgradeId | null)[];   // one entry per bought slot (R5)
  magnet: { since: number; n: number; tray: number };   // cycle start, hauls, scrap waiting (R5)
  toolbelt: Partial<Record<SkillId, number>>;   // ready-at, game clock; survive nukes (R5)
  dares: DareId[];                 // completed (R7)
  freighter: { week: number; loads: number; paid: number };            // (R6)
  blowback: { cursor: number; crates: { from: number; at: number }[] }; // at most 9 (R6)
  news: { at: number; folded: number; glass: Amount };   // the feed throttle (`06` 2.2)
  world: WorldCopy;                // section 7.1
  hints: Record<string, number>;   // uses per hint, retired after 2 (advisor.ts:51)
  agendaSeen: number;              // highest gate whose hint was shown
  records: { fastestNuke: number | null; bestBlast: number; biggestGain: Amount; bestMade: Amount };
  stats: { taps: number; felled: number; flotsam: number; hands: number; nodes: number;
           blowback: number; loads: number; blasts: number; pokes: Record<PokeId, number>;
           flights: string[]; month: { key: string } & Record<string, number> };  // lifetime
  skin: string | null;             // chosen cosmetic; owned ones live in the legacy row
}
```

- `IslandId`, `LineId`, `TierId` (from `packages/content/src/tiers.ts`), `UpgradeId`, `NodeId`,
  `LogbookId`, `PokeId`, `SkillId`, `FlotsamId` and `DareId` are string aliases checked against
  content. `stats.month` holds `06`'s monthly board counters, reset lazily when `key` changes.
- **Seeds.** `seedOf` takes numbers only, so every roll is `seedOf(run.seed, SEED.<tag>, index)`
  with tags from one `SEED` table in `rng.ts`: `crit` (tap index), `flotsam` (arrival index),
  `kind`, `drone`, `flight`. The Magnet spans runs and uses the base seed:
  `seedOf(seed, SEED.magnet, magnet.n)`. No clock value enters a roll.
- **`KEEP_ON_CROSSING`** in `state.ts` marks each `Meta` field (canon 9, resolution 3.24): kept
  are logbook, scrap, ranks, pockets, skin, records, stats, dares, and the Wipe Day count with its
  agenda unlocks; reset are glass, nodes, loadout and lifetime; the rest carries on. It is unused
  until the Crossing exists.

### 3.2 What lives where

| Data | Where | Why |
| --- | --- | --- |
| `run`, `meta` | `bases.state_json` | One document, one transaction, predicted on the client |
| Owned skins and titles, the season-1 legacy | `legacy` row (`legacyStore.ts:13-24`) | Server truth for cosmetics (canon 13.2); read-only otherwise |
| Season-1 cards, hall of fame | `season_archive`, `hall_of_fame` | History ("the old world") |
| `lastSeenAt`, notification switches, time zone, held pushes, `discord_dm` | `players` | Per-player server facts (7.2) |
| Bot feed cursor, VAPID keys, the casino secret | `settings` | Unchanged |
| Group view: medians, Island Count, Freighter totals, first finds | Memory in `Game`, rebuilt by the minute tick and after each Wipe Day or load | Derived; copied into `meta.world` (7.1) |
| The Foreman switch, Dead Hand's setting | `meta.prefs` | One setting on every device (resolution 3.15) |
| Sound, scientific notation | localStorage | Per device |
| Boards | Computed from `bases` and `event_log` in JS, as `ranks()` does (`game.ts:1091-1117`) | No new table |

### 3.3 `normalizeState` (D73 pattern, a clean version)

- `normalizeState(content, stored)` returns `null` when `stored.v !== 2`. `load()` then builds
  `newBase` but marks the row **stored**, so `save()` updates it and `version` keeps rising
  (`store.ts:419` drops pushes that do not raise it). It logs `base_reset {from: 1}`. This is
  the safety net behind the cut-over wipe.
- Within v2, each phase adds fields with defaults: a deep merge over `newBase`'s shape fills
  what is missing. Unknown line, upgrade and hand ids are dropped. Unknown node ids are dropped;
  a patch that removes nodes must run `respec_all` (9.6), which refunds `glass.spent`. Unknown
  Logbook ids are kept but do not count for Morale.
- Tests: `normalize(normalize(x))` equals `normalize(x)`; `normalize(newBase())` equals
  `newBase()`; a v1 fixture (today's `BaseState`) loads as a fresh base with the old version + 1.

### 3.4 Size budget

Today a day-30 base is 14.0 KB (code-domain 1). Target: **at most 24 KB** of JSON for the
optimal archetype on day 180 with the full tree, 250 Logbook entries and 9 waiting crates,
asserted by a simulator test. Node ids are kept as strings (361 × about 18 bytes, about 6.5 KB)
because ids survive content edits and bitsets do not.

---

## 4. Settle

### 4.1 The function (`packages/domain/src/settle.ts`, rewritten; today's `settle` is in `base.ts`)

```ts
export function settle(content: Content, state: BaseState, now: number, world?: World):
  { state: BaseState; events: GameEvent[]; changed: boolean } {
  let s = world ? applyWorld(content, state, world, now) : state;   // server only (7.1)
  const run = s.run;
  if (now <= run.settledAt) return { state: s, events: [], changed: s !== state };
  let t = run.settledAt, gain = 0;
  for (const cut of [...splitPoints(content, s, t, now), now]) {
    gain += mannedRate(content, s, t) * (cut - t);   // constant on [t, cut): evaluated at t
    t = cut;
  }
  gain += payoutsDue(content, s, run.settledAt, now);   // unmanned cycles ending by now (4.4)
  finite(gain, "settle gain");
  // supplies += gain; made += gain; settledAt = now; drop buffs with until <= now; then the
  // timed events of 4.6; night_shift_over if the window end fell inside (settledAt, now].
}
```

- `mannedRate(content, s, t)` is the sum over manned lines of `owned × perUnit × conditions(t)`
  from the effects fold (section 5), times 0 when `t >= windowEnd`.
- `suppliesAt(content, s, t)` is the same arithmetic without building a new state. The HUD and
  the scene call it every frame (10.2). A test asserts it equals `settle(s, t).state.run.supplies`.
- `settleAll`'s craft, mission, arrival, barrel, task, node, listing, Den, contract, wheel and
  raid settlers (`settle.ts:53-73`) are deleted with their modules.

### 4.2 Split points (all whole seconds)

| Split point | Why |
| --- | --- |
| Each buff's `until` (Rally, drone) | Production multipliers end |
| `activeAt + 330` | `when: online` / `offline` effects switch (a visible tab pings every 300 s; 30 s grace) |
| `activeAt + nightShiftSeconds` | Production stops |
| The moment Afterglow's bonus drops under 10% (from `afterglowFrom`) | Only when an active effect has `when: afterglow` |
| Weather blocks and night boundaries | Only when an active effect has `when: rain` or `night` (6.5) |

Unmanned payouts at `readyAt` (4.4) are points, not rate changes, so they cut no segment.
Afterglow and Hustle multiply taps only; taps arrive as commands, so they need no integral
(canon 13.3).

### 4.3 The Night Shift window

- `windowEnd = activeAt + nightShift(content, s)` (12 h at the start, resolution 1.11; 48 h
  ceiling; Bunker nodes add hours). Every command, `ping` included, sets `activeAt = now` and
  `madeAtActive = made`. `GET /state` does not.
- A full window stops accrual and destroys nothing. The first command after it restarts it.

### 4.4 Unmanned lines: started by taps, paid at the cycle's end (resolution 3.3)

Each unmanned line keeps `run.readyAt[i]`, the end of its cycle in flight. A `taps` batch, after
the bucket (6.3), starts cycles on every owned unmanned line `i`:

```
s0 = max(from', readyAt_i)                 // a busy line starts nothing until it is free
k  = s0 > to' ? 0 : min(credited, floor((to' − s0) / cycle_i) + 1)
readyAt_i = s0 + k × cycle_i               // set only when k > 0
```

- The first `k − 1` cycles ended inside the batch and pay in the command. The last pays when it
  ends: in the command if `readyAt_i <= now`, otherwise in settle at `readyAt_i`. At most one
  cycle per line is ever in flight, and it finishes even if tapping stopped or the tab closed.
- A cycle pays `rate_i × cycle_i`: the line's folded rate at that second (units owned then, so a
  unit bought mid-cycle counts) times its cycle. `cycle_i` is floored at 0.1 s (canon 4.3).
- A hire, and a nuke, pay the cycle in flight at once and clear `readyAt_i`. Without the busy
  check, one tap a second on the 19 s Kiln would pay a whole cycle every second.

### 4.5 Fractional remainders, no buying

- Supplies, made and lifetime are doubles; no per-settle flooring, so many small settles equal
  one big one.
- **Nothing buys inside settle.** The Foreman buys through `buy_line` commands while the page is
  open, and Collect runs its one pass inside the `collect` command (6.2). Dead Hand sends `nuke`
  from the client. The server never nukes.

### 4.6 Timed events settle may apply

These change no production rate, so they keep the segments intact:

- **Unmanned payouts** (4.4) at each `readyAt` in `(settledAt, now]`.
- **The flotsam cursor** (6.4) moves past every arrival whose window has closed.
- **Magnet auto-haul** (R5, `05` 2.1): for each full cycle (`magnet_hours`, 24 h base) since
  `magnet.since`, roll a Sure haul with `seedOf(seed, SEED.magnet, n)` into `tray`, `n += 1`,
  `since += cycle`. Emits `scrap_hauled {auto: true}` per haul.
- **Freighter week roll** (R6): when `weekOf(now) !== freighter.week`, reset `loads` and `paid`.
- **The peak rate** (`03` 2.1): the glass rate at each whole minute since `startedAt` that the
  settle passes, kept in `run.peak` when higher. Closed form, one evaluation per minute passed.

Logbook entries are awarded only in commands, never in settle, so `per: entries` effects stay
constant between commands.

### 4.7 `nextEventAt` (notifications only)

`nextEventAt = min(windowEnd if not passed, the next Magnet auto-haul if "Magnet full" is on)`.
The API's 60-second tick (`main.ts:69-83`, `game.ts:1048-1076`) settles bases whose time has
come. That emits `night_shift_over`, which `notifyKindOf` maps to the default-on notification.
Settling at the tick changes nothing else, because settle is path-independent. Quiet hours hold
the push, never the settle (7.2).

### 4.8 Property tests (R0, before content; N24)

Written with the repo's own `rng.ts`, like W6's property tests. No new dependency.

1. **Generator.** `randomState(rng, content)`: 0-300 owned per line, a random manned subset,
   `readyAt` on some unmanned lines, 0-3 buffs, `activeAt` up to 20 h back, a Night Shift of
   12-48 h, a flotsam cursor, random nodes, upgrades and ranks, a weather seed. 10,000 cases.
2. **Path independence.** For `t0 < t1 < t2` up to 60 h apart, placed around window, buff and
   `readyAt` ends: `rel(settle(settle(s, t1), t2), settle(s, t2)) <= 1e-9` on supplies, made and
   lifetime, with `rel = |a − b| / max(1, |a|, |b|)`. Every other field is deep-equal; events
   match as a multiset. The same over random command sequences (buys, hires, taps, pings).
3. **Tick oracle.** An independent loop over whole seconds computes the manned rate from first
   principles (owned × per-unit rate × buffs active that second × in-window), adds each unmanned
   cycle's payout at its end second, and sums; it agrees with `settle` within 1e-6 over 1,000
   states × 48 h and shares no code with it.
4. **`suppliesAt` agreement** at random `t`.

---

## 5. The effects evaluator (`packages/domain/src/effects.ts`, replacing `modifiers.ts`)

### 5.1 Vocabulary (the registry, resolution 3.12)

An effect is `{stat, op: "add" | "inc" | "more" | "set" | "unlock", value, scope?, per?, max?,
when?}` (canon 13.5, with `04-blast-map.md` 4.1's extensions).

- `scope`: a line id, an era id or `all`; for shelf stats an upgrade kind (`grip`, `line_mk`,
  `island`) or id; for flotsam stats a kind; for Toolbelt stats a skill.
- `per`: `owned` (units of the scope), `hands`, `nukes` (Wipe Days), `entries` or
  `sector:<id>`. **Every `per` effect carries a `max`.**
- `when`: `online`, `offline`, `afterglow` (while Afterglow adds at least 10%), `rain`, `night`,
  `hustle_full`, `dare:<id>`.
- `feature:<id>` (new code, budgeted per phase) is allowed only on unlock, automation and keystone
  nodes.

Each stat is registered once, with a direction, so `set` and the tests know what "better" means.
Data uses these names only (`output`, not `line_output`; `tap_share`, not `tap_rate_share`).
Ceilings for nodes are in `04-blast-map.md` 4.2.

| Stat | Applies to (base) | Ops | Better |
| --- | --- | --- | --- |
| `output` | line production per unit (scoped) | add, inc, more | higher |
| `speed` | line cycle (scoped; rate × speed) | more | higher |
| `line_cost`, `hand_cost`, `upgrade_cost`, `era_cost` | prices (scoped by line, shelf kind or id) | more (< 1) | lower; `upgrade_cost` floored at ×0.25 per shelf kind, `era_cost` at ×0.5 (errata E25) |
| `milestone_x2`, `roster_x2`, `mk_mult` | what a ×2 milestone, a ×2 roster milestone and a Line Mk pay (2, 2, 3) | set | higher |
| `tap_flat` | the flat part of a tap (1; ×2 per Grip rung) | more | higher |
| `tap` | the whole tap value (tap nodes; Adrenaline, Rush and Dare factors as transient `more`) | inc, more | higher |
| `tap_share` | `p`, share of the full rate per tap (0.4% per Grip rung) | add | higher |
| `hustle_max` | Hustle's top multiplier (2; at most 2.25) | add, set | higher |
| `hustle_hold`, `hustle_drain`, `hustle_gain` | grace (2 s), loss per second (10), gain per tap (1) | add; more; add | higher; lower; higher |
| `crit_chance`, `crit_mult` | Lucky Swing and kin | add, set | higher |
| `fell_taps`, `fell_bonus` | taps per fell; taps a fell pays (10) | more; add | lower; higher |
| `afterglow`, `afterglow_half`, `afterglow_hold` | start multiplier (3); half-life (300 s); seconds held first (0) | set; add; set | higher |
| `flotsam_rate`, `flotsam_float`, `flotsam_effect` | the Tide | more; add; inc | higher |
| `flotsam_weight` | one kind's odds (scoped; never `sealed_locker`) | more, set | n/a (odds stay printed) |
| `rally_mult` | the Fuel Drum's Rally (×4) | add | higher |
| `night_shift` | window hours (12, at most 48) | add (more: keystones) | higher |
| `offline` | output while away | more | higher |
| `glass_gain` | the nuke's multiplier `m` | inc, more | higher |
| `glow_k` | Glow's `k` (0.25) | add, set | higher |
| `morale_per`, `morale` | Morale per entry (0.02); a factor on Morale | add; more | higher |
| `rank_mult` | each crew rank's factor (×2) | set | higher |
| `magnet_hours` | the Magnet's auto-haul hour (24) | set | lower |
| `rush_mult`, `rush_seconds`, `rush_cooldown`, `grit_step`, `grit_cap`, `grit_cooldown`, `flare_cooldown` | the Toolbelt (`05` 7) | add, more, set | cooldowns lower, the rest higher |
| `start_owned`, `start_era`, `start_upgrade` | units, era and shelf upgrades at run start (scoped) | set; set; unlock | higher |
| `keep_hand` | hands that survive a nuke (scoped) | unlock | n/a |
| `foreman_lines` | the Foreman's line scope (6, then all) | set | higher |
| `hand_cap` | most hands at once (keystone downsides only) | set | higher |
| `feature:<id>` | `flare_gun`, `foreman`, `dead_hand`, `logbook_hints`, `bulk_buy`, ... | unlock | n/a |

- `set` replaces the base with the best value among all sets for that stat. Outside keystones, a
  `set` must beat the base and a `more` on a "higher" stat must be at least 1 (content check), so
  buying a non-keystone node never makes a stat worse. Keystones carry their printed downsides.
- **Keystone slots are not a stat:** exactly three, from the agenda at Wipe Days 10, 20 and 40
  (resolution 3.9). Nor are agenda unlocks: `unlocked(content, meta, id)` reads `agenda.json5`.

### 5.2 Fold order and the tap formula

For a scoped production stat:

```
base → + Σadd → × milestones (per line, then roster) → × (1 + Σinc)
     → × Πmore (eras, Line Mk, island upgrades, ranks, Grit, Dares)
     → × Glow → × Morale → × transient buffs (Rally, drone) → × offline (when offline)
```

- **Glow** `= 1 + k × √(glass ever)`, `k` from `glow_k`. **Morale** `= (1 + morale_per × entries)
  × Πmore(morale)`. A rank is one `more` on its line, `rank_mult^rank`, manned or not. Grit is
  a run-scoped `more` (1.05 per stack).
- **Tap value** (`02` 7.1; the same in `10-balance.md`):

  ```
  tap = (tapFlat × global + p × fullRate) × T × hustle(h) × afterglow(t) × crit
  ```

  - `tapFlat` = the `tap_flat` fold (2^grip, pocketed rungs included); `p` = the `tap_share` fold;
  - `global` = the flat tap's global fold: eras, island upgrades, roster, Grit, Glow and Morale
    (errata E23), and nothing else;
  - `fullRate` = every owned line as if manned, with every multiplier in force (Rally and the
    drone included); it already carries the global set, so `p × fullRate` gets no second fold;
  - `T` = the `tap` fold, tap nodes plus the transient tap buffs;
  - `hustle(h) = 1 + h/100 × (hustleMax − 1)`;
  - `afterglow(t) = 1 + (A − 1) × 2^(−max(0, t − hold) / half)`, `t` the real seconds since
    `afterglowFrom`, `A = 3`, `half = 300 s`, `hold = 0` *(sim)*; 1 in run 1 and after
    `prestige.json5`'s `endsAfter` (30 min at the base);
  - a fell pays `10 × tap` without the crit.

### 5.3 Sources

Effects come from content and are selected by state: shelf upgrades in `run.upgrades` and
`meta.pockets`, eras up to `run.era`, milestones from `run.lines` and `run.roster`, Blast Map
nodes in `meta.nodes` (keystones only when in `meta.loadout`), ranks, Logbook entries (Morale),
Dare rewards in `meta.dares`, the active Dare's constraint, and Grit. One function lists them all:
`activeEffects(content, state)`.

### 5.4 Caching

`fold(content, state)` returns a `Rates` object (per-line rate, cycle and cost factor; the tap
fold; `p`; Hustle's numbers; crit; the Night Shift; the flotsam numbers; glass gain; Glow;
Morale). It is cached like `modifiers.ts:86-97`: a `WeakMap` on `meta.nodes`, checked against
the identity of `run.lines`, `run.roster`, `run.upgrades`, `run.hands`, `run.era`, `run.grit`,
`run.dare`, `meta.loadout`, `meta.ranks`, `meta.pockets`, `meta.dares`, `meta.logbook`,
`meta.wipeDays` and `meta.glass`. **Coding rule:** updates keep untouched sub-objects by
reference, so a `taps` batch (new `run`, same `run.lines`) hits the cache. Conditions and
transient buffs apply after the cached fold, per segment or batch.

### 5.5 Tests (replacing `legacy.test.ts:63-101` and the 25% checks)

- **One test per op** in fold order (add before milestones, inc summed, more multiplied, set takes
  the best).
- **Monotonicity:** 10,000 seeded random effect sets. Adding any one non-keystone node, upgrade,
  rank or entry never makes a "higher" stat lower or a "lower" stat higher.
- **Upper bound per stat:** for every stat, the product of all `more` factors × (1 + Σ all inc) ×
  Σ add, at full ownership, stays below its ceiling (`04` 4.2) and the steady tap coefficient
  stays at most 0.6 at 6 taps a second (resolution 1.5). Global magnitude is the simulator's job
  (N23).
- Deleted: `checkLegacy` (`parse.ts:1001-1024`), `perkBonusSchema`'s max (`schema.ts:603-610`),
  `legacy.test.ts`'s 12,288 combinations, the simulator's veteran floor (`pacing.json5`), and
  CLAUDE.md section 8's 25% line.

---

## 6. Commands

### 6.1 The pipeline (`commands.ts`, rewritten; shape of `commands.ts:476-511` kept)

`applyCommand(content, state, command, now, world?)`:

1. `settle` to `now`, with `world` on the server.
2. **Run start.** If `startedAt` is null and the command is `taps` or a purchase (`buy_line`,
   `buy_upgrade`, `buy_era`, `hire_hand`), set `startedAt = now`. The first `taps` also sets
   `afterglowFrom = from'`; the first purchase sets `firstBuyAt = now`. `buy_node` and the
   setting commands start nothing.
3. Run the rule; a failure returns the settled state and a typed `Refusal`.
4. On success: set `activeAt` and `madeAtActive`; run `logbook(content, before, after, events)`,
   one pure function that finds new pages at the end of **every** command, taps included
   (resolution 3.14, `05` 1.3); count hint use; `assertFiniteState` in tests.

`Refusal = {reason, need?: Amount, have?: Amount, at?: number, gate?: {kind: "wipe_day" | "era" |
"owned", value}, goto?: PanelId}`. Each reason has a locale line `refusal.<reason>` with one
sentence and a button to where the missing thing comes from (rule 6.3.5).

### 6.2 Every command

"Pred." means predicted on the client (D64). Record classes are in 9.4: slim or standard, and
neither holds state.

| Command | Payload | Refusals (what is missing) | Pred. | Record | Logged event |
| --- | --- | --- | --- | --- | --- |
| `taps` | `count` 1-120, `from`, `to` (whole s), `pokes?` (R4) | none: clamps (6.3) | yes | slim | none; `logbook_entry` if a page is found |
| `ping` | — | none | yes | slim | none |
| `buy_line` | `line`, `count`: 1, 10, 100 or `"max"` | `locked {gate: era}`, `supplies {need, have}`, `max_owned` | yes | standard | none (`milestone` is client-only) |
| `hire_hand` | `line` | `locked`, `no_units`, `hired`, `hand_cap`, `supplies` | yes | standard | `hand_hired` |
| `buy_upgrade` | `upgrade` | `locked {gate: owned 25 of X}`, `owned`, `supplies` | yes | standard | none |
| `buy_era` | `era` | `not_next`, `locked {gate: Wipe Day 2}`, `supplies` | yes | standard | `era_reached` |
| `claim_flotsam` | `run`, `k` (the arrival), or `flare: true` | `gone {at}`, `claimed`, `stale_run` | yes | standard | `flotsam_claimed` |
| `nuke` | `run` (the run number meant) | `stale_run`, `not_ready {need, have}` (10 for the first, then 1) | yes | standard | `nuked` or `small_blast` |
| `buy_node` | `node`, or `path: NodeId[]` | `owned`, `locked {gate: Wipe Day N}`, `unreachable`, `hidden` (a later wave), `glass {need, have}`; a path is all or nothing | yes | standard | none (the run summary counts them) |
| `set_loadout` | `keystones?`, `foreman?`, `deadHand?` (resolution 3.15) | `not_rebuilding` (keystones only), `slots {have}`, `not_owned`, `locked` | yes | standard | none |
| `start_dare` | `dare` | `locked {gate: Wipe Day 5}`, `not_rebuilding`, `dare_on` | yes | standard | none |
| `abandon_dare` | — | `no_dare` | yes | standard | none |
| `collect` | — | none | yes | standard | none |
| `claim_blowback` | — | `nothing_waiting` | yes | standard | `blowback_claimed` |
| `haul_magnet` | — | `magnet {at}` (growing, tray empty) | yes (seeded) | standard | `scrap_hauled` |
| `rank_hand` | `line` | `locked`, `max_rank`, `ranks_together` (two above the lowest, resolution 1.7), `scrap {need, have}` | yes | standard | none |
| `set_pocket` | `slot`, `upgrade` or null | `locked`, `scrap` (buys the slot on first use), `not_pocketable` (eras), `pocket_full` (a full slot after the first purchase) | yes | standard | none |
| `use_tool` | `tool`: rush, grit or flare; `kind?` (Flare with `flare_gun`) | `locked`, `cooldown {at}` | yes | standard | none |
| `load_freighter` | — | `freighter_full {have: 6}`, `supplies {need, have}` | yes | standard | `freighter_loaded` (`tier` when one is crossed) |
| `set_cosmetic` (kept) | `skin` | server-only, as today | no | standard | none |
| `grant` (admin) | `player`, `glass?`, `scrap?`, `skin?`, `title?`, `note` | admin only | n/a | standard | `granted` |
| `respec_all` (admin) | `note` | admin only | n/a | standard | `respecced` per base |

Notes:

- **Rebuilding** means no purchase yet this run (`firstBuyAt === null`): from the nuke to the
  first purchase, taps allowed. Keystone changes (`set_loadout`), a Dare (`start_dare`) and
  swapping a full Pocket (`set_pocket`, resolution 3.10) are accepted only then; the Foreman and
  Dead Hand settings, an empty Pocket and Blast Map buys any time. A keystone bought while a slot
  is empty slots itself at once (resolution 3.9). Afterglow starts at the run's first tap and the
  Dare's clock at its first action, so time on the postcard costs nothing.
- **`nuke`** carries the run number, so a replay after its record expired refuses `stale_run`.
  It is pure: settle, pay every cycle in flight, compute the gain, fold the run into `meta`, then
  `newRun(content, meta', seedOf(seed, meta'.nukes), now)`. The gain (resolutions 1.1, 1.2, 1.8):
  - `G(L) = floor((L / L0)^a)`, `a = 1/5`, `L0 = 5e5` *(sim)*, `L = meta.lifetime + run.made`;
  - `base = floor((G(L) − glass.level) × m)`, `m` the `glass_gain` fold (Bigger Payload, ...);
  - Late Tide (R6): with `median = world.lateTide` (errata E18), when `glass.ever < 0.5 ×
    median`, `gain = max(base, min(3 × base, median − ever))`, so the bonus never carries a player
    past the median; otherwise `gain = base`;
  - then `level = G(L)`, `ever += gain`, `held += gain`. Multipliers are never clawed back by the
    next delta; grants never touch `ever` or `level`.
  - Pressable: the first at `G(L) − level >= 10`, later at a gain of 1 or more.
  - **Counted** when `gain >= ceil(0.10 × ever before)` (the first always): `wipeDays += 1`, logs
    `nuked`. Otherwise a **small blast** (resolution 3.1): it resets the island and pays its
    glass, logs `small_blast`, and moves no agenda, news, Blowback or Island Count. Both raise
    `nukes`.
  - The first Wipe Day adds `ground_zero` and 3 scrap (resolution 3.20). A met Dare's reward is
    granted. Kept and lost follow `03-the-big-red.md` 11.
- **`collect`** settles, empties the Magnet's tray and, with the Foreman unlocked and
  `meta.prefs.foreman` on, runs `foremanPass` (`05` 5.4): chunked greedy buy-max that keeps the
  crowned purchase's price in reserve (resolution 1.10), at most 2,000 steps. The web's welcome
  back and Discord's button send the same command.
- **`buy_line` "max"** uses `k = floor(log_g(1 + S(g − 1) / (c × g^n × costFactor)))` and steps
  down one if rounding overshot. The server's `k` wins.
- **`load_freighter`** costs one hour of the idle rate at the server's moment (resolution 3.23).

### 6.3 The taps transport in full (canon 13.4)

**Client (`apps/web/src/state/taps.ts`, new, pure and unit-tested):**

1. A tap (or each 250 ms of a held press: 4 a second) goes to the queue's open tail entry
   `{key: null, command: {type: "taps", count, from, to, pokes}}`. A tap on a scene object (the
   gull, the Kettle) adds to `pokes` instead (R4). `from` and `to` are whole seconds on the
   server-synced clock (`http.ts:32-42`).
2. The tail closes when it is 1 s old, holds 30 taps, another command is queued behind it, or the
   tab hides (`visibilitychange`). A key is assigned **only at the first send attempt**. A keyed
   entry is never merged or changed: a retry resends the same content under the same key.
3. **Prediction without drift.** When the tail opens, the store snapshots the base before it; each
   tap recomputes `apply(snapshot, mergedTail)` (about 0.01 ms, code-domain 5.4). The visible base
   always equals what the server computes for that batch; the floater shows the delta between
   recomputes, and crits are known per tap (server step 5).
4. **Never drop predicted taps.** The queue wipe at `store.ts:475-479` goes. On a network error or
   5xx the store shows "Reconnecting... your taps are saved" and retries the head with its key
   (0.5 s, 1.5 s, 4 s, then every 10 s). A 429 is retryable too (`http.ts:96-99` treats every
   4xx as final today). Only a 400 (a bug) drops its one entry, with a toast and a reload.
5. **Pruning.** `sentKeys` (`store.ts:279`) drops a key once its answer and push are in, or after
   10 minutes; `played` (`store.ts:281`) keeps the newest 500 keys.

**Server (`packages/domain/src/taps.ts`, new):**

1. Clamp the times: `to' = max(bucket.at, min(to, now))`, `from' = max(bucket.at, min(from, to'))`.
2. Refill: `tokens = min(45, bucket.tokens + 15 × (to' − bucket.at))`; then
   `credited = min(count, floor(tokens))`, `tokens −= credited`; pokes take the whole tokens left,
   in id order; `bucket.at = to'`.
3. Hustle, with hold `H`, drain `D` and gain `g` from the fold (2 s, 10/s, 1):
   `h0 = max(0, hustle.value − D × max(0, from' − hustle.at − H))`; tap `k` (1..credited) runs at
   `min(100, h0 + g × k)`; then `hustle = {value: min(100, h0 + g × credited), at: to'}`.
4. The run's first batch sets `afterglowFrom = from'`. Afterglow and tap buffs are evaluated at
   `to'` (5.2).
5. Crit for tap `k`: `rng(seedOf(run.seed, SEED.crit, run.taps + k)).next() < critChance`.
6. Felling: `target.taps += credited`; each time it passes `fellTaps(era)` it pays 10 taps' value
   and emits `felled`.
7. Unmanned cycles start and pay as in 4.4.
8. Record: `run.taps += credited`, `meta.stats.taps += credited`, `meta.stats.pokes` per id.
   Events for the client only: `tapped {credited, value, crits, cycles}` and `felled`. The
   pipeline's Logbook check follows (6.1).

**Properties.** Over any interval `[T0, T1]` the server credits at most `45 + 15 × (T1 − T0)`
taps and pokes together, whatever the client claims: `to'` never passes `now` and `bucket.at`
never moves back. An honest tapper (at most 15 a second, times in order) is never clamped, so no
rollback toast fires (N10). A batch replayed after its record expired gets no refill and can only
spend leftover tokens, which is bounded and tested.

**Storage and pushes.** `taps` and `ping` store a slim record `{ok, version, credited}` for 1 h
(9.4), write no `event_log` row unless the batch found a Logbook page (then that one
`logbook_entry`), and push only `{version, serverNow, origin}` to the player's other tabs, which
refetch `GET /api/state` at most once every 2 s. The sender's HTTP answer still carries the state
(Caddy compresses it, `encode gzip zstd`); a replay returns the stored outcome with the current
state.

**Ping.** A visible tab sends `ping` 5 minutes after its last command, and once after a page
load unless the welcome-back card is up (its Collect does the same).

### 6.4 Flotsam schedule (seeded, one arrival at a time)

`run.flotsam` is a cursor: arrival `k` at time `at` (`02-the-run.md` 8.2 states the rules; this
is their implementation).

- `gap(k)` is uniform in 4-10 minutes *(sim)* from `rng(seedOf(run.seed, SEED.flotsam, k))`,
  divided by 1.5 when `weatherAt(at)` is rain and by the `flotsam_rate` fold. The first arrival
  comes `gap(0)` after `createdAt`. Two arrivals never float at once (the shortest gap, 2:40,
  outlasts the 13 s float).
- **Run 1** (resolution 1.6): while `caught === 0`, every gap is exactly 180 s and every arrival a
  Drift Crate paying a flat 2 minutes of output (errata E1): the first at 3:00, then every 3
  minutes until one is caught.
- **Settle** moves the cursor past each arrival whose window has closed (`at + float + 3 < now`),
  drawing the next gap with the fold in force (constant between commands, so settle stays
  path-independent). A claim moves it too. Arrivals while nobody looks simply pass.
- **Kind:** `pickWeighted(rng(seedOf(run.seed, SEED.kind, k)), weights)` over the kinds present
  in `flotsam.json5`, so unshipped kinds are absent and their weight is redistributed. The
  drone's line is drawn at claim from the lines then owned (`SEED.drone`).
- **Flare** (resolution 3.11): `use_tool flare` sets `flare = {at: now, kind}`, the kind chosen
  with `flare_gun` or seeded; it floats beside the schedule.
- `claim_flotsam` succeeds when the arrival is the cursor's (or the flare) and
  `at <= now <= at + float + 3` (13 s plus a 3 s grace, as `nodes.ts:81-84` grants today). It pays
  per `02` 8.1 (Rally ×4 for 60 s, Adrenaline ×100 for 12 s; a running buff restarts, different
  kinds multiply).

### 6.5 Weather and the island's clock in the domain (resolution 3.17)

Rain changes the economy, so weather moves from the client into
`packages/domain/src/weather.ts`, driven by `island.json5`:

- `weatherAt(t)`: a pure function of the 30-minute block index and the island's seed, drawn from
  the table's weights (about 70% clear, 20% rain, 10% fog *(sim)*), the same for everyone.
- `isNight(t)` and the scene's time of day use the island's UTC offset, not the player's time
  zone (today's `seasonTime`, `store.ts:970-974`). Saltmarsh's offset is UTC+1 with no daylight
  saving (errata E9; the owner may change it), so in summer the island's night runs an hour off
  local time.
- The scene reads the same functions, so the sky the player sees is the sky the rules use, and
  "launch during a storm" agrees on client and server. Ash in Afterglow is presentation only.

---

## 7. World inputs, events and the log

### 7.1 World (`world.ts`, rewritten)

```ts
export interface World {
  self: number;
  blowback?: { nukes: { id: number; from: number }[]; newest: number };  // friends' `nuked` rows
                                                 // after the cursor, oldest first, at most 3
  lateTide?: number;                             // glass ever: median of the OTHER players
                                                 // active in the last 14 days (errata E18)
  islandCount?: number;                          // Wipe Days by everyone; small blasts never
                                                 // count (errata E18)
  freighter?: { week: number; groupLoads: number; players: number; tier: number };
  firstFinds?: LogbookId[];                      // secrets someone has logged
}

export interface WorldCopy {
  at: number; lateTide: number | null; islandCount: number;
  freighter: { week: number; groupLoads: number; players: number; tier: number };
  firstFinds: LogbookId[];
}
```

- `applyWorld` runs first in every server settle and command: it copies the values into
  `meta.world`; runs `arrive` (`06` 3.2), adding `min(3, 9 − waiting)` crates per friend's Wipe
  Day, tagged with the sender, and setting `cursor = newest`; and pays Freighter scrap for tiers
  above `freighter.paid` if the player loaded this week. The client predicts with the last copy;
  the server's answer corrects it.
- A new base's cursor starts at the newest `nuked` id: no history for newcomers.
- The API builds `World` from its group cache (3.2) plus one indexed query for Blowback
  (`type = 'nuked' AND id > ? AND player_id != ?`, oldest first, limit 3, and the newest id); it
  never parses every base per command. `small_blast` rows never match.
- With two players `lateTide` is the other player's glass ever (resolution 1.8).
- `SERVER_ONLY` (`commands.ts:121-129`) shrinks to `set_cosmetic`.

### 7.2 Events

| Event | Logged | Feed | Notify kind | Notes |
| --- | --- | --- | --- | --- |
| `nuked` | yes | when `news` | `friend_nuked` (off) | A Wipe Day. The run summary: n, Wipe Day #, times, made, gain, glass and Glow before and after, era times, lines bought, upgrades, nodes bought, flotsam, felled, taps, hands, Dare, flight, Late Tide (shown to that player only, never on boards, the feed or any shared surface; errata E19), `by` (Dead Hand). Flags: `news` (the domain, from `meta.news`), `record` and `islandCount` (the API, from its group cache). Postcards, boards, Blowback and analysis read it. |
| `small_blast` | yes | no | none | The same summary for a nuke under 10% |
| `era_reached` | yes | when `first` (first Armored ever) | none | `{era, at, first}` |
| `hand_hired` | yes | no | none | |
| `flotsam_claimed` | yes | no | none | `{kind}` |
| `logbook_entry` | yes | when `firstFind` | none | `{entry, firstFind}`, set by the server from `World.firstFinds`; the feed line gives the hint, never names the secret (errata E19) |
| `scrap_hauled` | yes | no | `magnet_full` (off) | `{amount, early, rich, auto}` |
| `blowback_claimed` | yes | no | none | `{from}` |
| `freighter_loaded` | yes | when `tier` | `freighter_tier` (off, loaders only) | `{tier?}` |
| `dare_done` | yes | no | none | |
| `night_shift_over` | yes | no | `night_shift_over` (**on**) | from the tick |
| `granted`, `respecced`, `base_reset`, `agenda_backfill` | yes | no | none | admin, cut-over and phase-deploy trail |
| `tapped`, `felled`, `milestone`, `bought`, `buff_started` | **no** | no | none | client feedback only |

- `FEED_TYPES` (`feed.ts:14`) becomes `nuked`, `era_reached`, `logbook_entry` and
  `freighter_loaded`, with `isFeedWorthy` reading the flags (`06` 2.1). `NOTIFY_KINDS`
  (`feed.ts:64`) becomes the four kinds above. `players.notify_json` merges over the new
  defaults (`notifyPrefs`, `feed.ts:108`), so old kinds are ignored.
- **Quiet hours** (resolution 3.23): 22:00-08:00 in the browser's time zone, on by default,
  switched by a "Quiet hours 22:00-08:00" row in Settings (errata E19). The
  client saves its IANA zone with the switches in `players.notify_json`; a push due in quiet hours
  waits in `notify_json.held` (one per kind, the latest wins) and the minute tick sends it at
  08:00. DMs follow the same rule.
- The welcome-back list (`WHILE_AWAY`, `game.ts:102-121`) becomes `scrap_hauled`, friends'
  `nuked`, `logbook_entry`, `freighter_loaded` and `night_shift_over`.

### 7.3 `event_log` policy

- No row per tap, ping or purchase; a `taps` batch writes a row only for a page it found.
  Purchases roll up into the `nuked` and `small_blast` run summaries. That is what balance
  analysis needs, at about 40 rows per run instead of thousands.
- The id sequence is **never** reset: no `DELETE FROM sqlite_sequence WHERE name = 'event_log'`
  in any recipe. The bot's cursor (`settings.discord_feed`) and Blowback cursors depend on it.
- Rows are never updated. Pruning, if ever needed, is an R7 decision and never touches `nuked`,
  `small_blast` or feed types.

---

## 8. Content

### 8.1 Files in `packages/content/data`

| File | Fate | Holds |
| --- | --- | --- |
| `lines.json5` | new (replaces `buildings`) | the formula block (output ×4.75 per rung, resolution 1.4) and 14 lines: id, rung, era, hand, product, island, overrides, `maxOwned` |
| `eras.json5` | new (replaces `base_tiers`) | 5 eras: cost, effects, target, gate (Armored: Wipe Day 2) |
| `targets.json5` | new (replaces `nodes`) | 5 targets (`fellTaps`, cry key) and the tap block (bucket, hold, Hustle) |
| `upgrades.json5` | new | the shelf: Line Mk II/III rules, island upgrades |
| `milestones.json5` | new | per-line and roster thresholds and effects |
| `flotsam.json5` | new (replaces `active`) | kinds, weights, effects, the gap band, float, the rain factor, run 1's crates |
| `prestige.json5` | new | `l0` 5e5, `exponent` 1/5, `glowK` 0.25, the first-nuke minimum, the count share, Afterglow, the crown, flight variants |
| `island.json5` | new (resolution 3.17) | id, UTC offset, seed, the weather table in 30-minute blocks |
| `blastmap.json5` | new (replaces `legacy`'s perks) | sectors, rings, bands, ceilings, `shippedWave`, reserved slots, nodes |
| `agenda.json5` | new | Wipe Day gates and their unlocks, keystone slots at 10/20/40 |
| `logbook.json5` | new, R4 | entries, conditions, secrets, hints, poke ids |
| `magnet.json5`, `toolbelt.json5` | new, R5 | cycle and odds; three skills |
| `dares.json5` | new, R7 (reuses the `seasons` modifier ids) | constraint and goal effects, reward |
| `social.json5` | new, R6 | Blowback, Freighter, Late Tide, Island Count, the news throttle, notification defaults, quiet hours |
| `cosmetics.json5` | new (the skins from `legacy.json5`) | skins and titles: Founder, Island Count, pennant |
| `pacing.json5` | rewritten | v2 targets (`10-balance.md` 7.4) |
| `tools.json5` | kept, reshaped | the five Grip rungs (the shelf's tool ids) |
| `crew.json5` | slimmed (resolution 3.19) | 14 hand ids: the 12 kept, `gus` and `vera` new |
| `resources.json5` | slimmed (resolution 3.19) | currencies (`supplies`, `glass`, `scrap`, `sea_charts`) and the 14 product ids: ten kept, `roast` moved from `items.json5`, `battery`, `broadcast` and `cell` new (resolutions 3.21, 3.22) |
| `traits.json5` | parked until R5 (owner decision 19) | |
| `recipes`, `crafting`, `furnaces`, `items`, `den`, `raids`, `sites`, `regions`, `events`, `active`, `nodes`, `seasons`, `buildings`, `base_tiers`, `legacy` | deleted | behind `pre-redesign` |

**A feature ships when its data is there.** The client derives what to show from content: no
`logbook.json5` entries means no Logbook nav item, and an unshipped flotsam kind is simply absent.
The one exception is the Blast Map's `wave` (resolution 3.8): rings 7-9 are in data from R3 with
`wave: 3`, content-checked and simulated (N15 on the full tree), but hidden and unbuyable until
R7 raises `shippedWave`. Nothing unshipped is ever shown (canon 12.3).

### 8.2 Schema sketches (zod, in `schema.ts`)

```ts
const effect = z.strictObject({
  stat: statId, op: z.enum(["add", "inc", "more", "set", "unlock"]), value: z.number().finite(),
  scope: scopeId.optional(), per: perId.optional(), max: z.number().finite().optional(),
  when: whenId.optional(),
});   // refined: `max` is required whenever `per` is set

const linesSchema = z.strictObject({
  formula: z.strictObject({                      // canon 4.2; per-line overrides allowed
    costBase: amount, costRatio: factor,         // c_i = 6 × 16^(i−1)
    rateBase: amount, rateRatio: factor,         // r_i = 1.5 × 4.75^(i−1)
    cycleBase: seconds, cycleRatio: factor,      // t_i = 0.6 × 2^(i−1)
    cycleFloor: seconds,                         // 0.1 s
    growthBase: factor, growthStep: z.number().finite(),   // g_i = 1.15 − 0.006 (i−1)
    handFactor: factor,                          // h_i = 300 × c_i
  }),
  stages: z.array(count),                        // drawn at [1, 25, 100]
  lines: z.array(z.strictObject({
    id, rung: z.int().min(1).max(14), era: tier, hand: id, product: id,
    island: id.default("saltmarsh"), maxOwned: count.default(2000),
    cost: amount.optional(), rate: amount.optional(), cycle: seconds.optional(),
    growth: factor.optional(),
  })),
});

const nodeSchema = z.strictObject({
  id, sector: sectorId, ring: z.int().min(1).max(9), slot: count,
  type: z.enum(["stat", "notable", "keystone", "unlock", "automation", "completion"]),
  effects: z.array(effect).min(1), cost: amount, scene: z.boolean().default(false),
  wave: z.int().min(1).max(3),                   // rings 7-9: 3, hidden until R7
  gate: count.optional(),                        // a Wipe Day count above the ring's (`04` 1.4)
  series: id.optional(), conflicts: z.array(id).default([]),
  links: z.array(id).default([]),                // extra outward edges; the rest by the layout rule
});
```

The other files follow the same pattern: ids, counts as `z.int()`, amounts finite, effects in the
one vocabulary. Flotsam kinds are a discriminated union on `kind` (`crate`, `buff`, `scrap`,
`bottle`).

### 8.3 Content checks (`parse.ts`, new `checkRun`, `checkBlastMap`, `checkAgenda`, `checkIsland`)

- **Formulas:** per rung, costs rise, output rises, payback (cost ÷ rate) rises; `1 < g <= 1.2`;
  hand price above the base cost; `c × g^maxOwned < 1e200`; milestone thresholds ascend and
  factors are at least 1.
- **Eras:** exactly the five tier ids in order (the check at `parse.ts:383-390` stays); costs
  rise; each era's target exists.
- **Blast Map** (the full list is `04` 9.3): 8 sectors × ring sizes 2, 3, 4, 5, 5, 6, 6, 7, 7,
  every slot of a ring in data filled or reserved. Edges run only outward (ring r−1 to r by the
  layout rule, plus outward `links` within the sector), so the graph is **acyclic by
  construction**; every node is reachable from `ground_zero`. On the full tree: 187 small, 70
  notable, 16 keystone (2 per sector, rings 5-9), 36 unlock, 36 automation, 16 completion
  (resolution 3.8). **Never three small nodes in a row** on any path (dynamic programming over
  the DAG); a `scene: true` node per sector per band of three rings; costs inside their ring's
  band × type factor, bands rising; rings 7-9 carry `wave: 3`.
- **Effects:** every `stat`, `per`, `when` and `scope` is registered and the op is allowed for
  the stat; every `per` has a `max`; `feature:*` only on unlock, automation and keystone nodes;
  outside keystones nothing worsens a stat (5.1); ceilings hold (`04` 4.2); every stat has a
  locale template `effect.<stat>`.
- **Agenda:** every unlock names an existing id; gates ascend; no row for unshipped content.
- **Island:** weather weights sum to 100; the offset is a whole hour in −12..14.
- **Locale:** every id has its name key (`line.<id>.name`, `node.<id>.name` or the series name);
  notables and keystones have a blurb; small nodes use templated names.
- Deleted: `checkRecipes`, `checkCrewAndMap`, `checkDen`, `checkRaids`, `checkLegacy`, the price
  table checks and `RTP_RANGE`.

### 8.4 Icons

`packages/content/icons/<kind>/<id>.svg` (canon 17, resolution 3.22): a square 48 viewBox,
`currentColor`, no raster. One loader serves the web (Vite `?raw` into a `<symbol>` sprite) and
the bot (satori inline SVG). A content test **fails** on a malformed file (wrong viewBox,
`<image>`, `<script>`) and **prints** the ids still missing; those render today's tile
(`hud/Icon.tsx`).

---

## 9. API and DB

### 9.1 Routes

| Route | Fate |
| --- | --- |
| `/api/health`, `/api/config`, `/api/auth/*`, `/api/dev/login`, `/api/me` | kept |
| `GET /api/state` | changed: `season` and `seasonStartedAt` go; `welcomeBack` becomes `{awaySeconds, gain, nightShift: {used, full}, events}` |
| `POST /api/commands` | changed: the new schema (`commandSchema.ts`, the `satisfies` check kept), outcome-only records, rate limit |
| `GET /api/events` (SSE) | kept; `PushMessage.state` becomes optional (version-only pushes) |
| `GET /api/feed`, `/api/push/*` | kept, new kinds |
| `GET` / `PUT /api/notify` | kept, new kinds; `PUT` also takes the time zone and the quiet-hours switch |
| `GET /api/ranks` | replaced by `GET /api/boards` with `window` set to `month` or `all` (scale-free boards, `06`) |
| `GET /api/legacy` | replaced by `GET /api/hall` (season 1's archive and hall of fame, own cosmetics and titles) |
| `GET /api/visit/:player` | new, R6 stretch: a read-only island summary |
| `GET /api/den`, `/api/den/history`, `/api/raids`, `/api/signal` | removed |
| `/api/bot/*` | kept; `/home` returns the v2 card data (section 11); `POST /api/bot/commands` accepts only `collect` and refuses the rest with `not_on_discord` (resolution 3.23) |
| `/api/admin/season/*` | removed on `redesign`; the cut-over runs it once on the old build |
| `POST /api/admin/grant`, `POST /api/admin/respec` | new (9.6) |

### 9.2 Tables

| Table | Fate |
| --- | --- |
| `players`, `sessions`, `login_links`, `push_subscriptions`, `settings` | kept (`players.notify_json` gains the time zone and held pushes) |
| `bases` | kept; PK `(player_id, season_id)` stays; one perpetual season row (`currentSeason`, `game.ts:191-195`) |
| `commands` | kept; outcome-only records; `expires_at` added (9.3) |
| `event_log` | kept; never pruned, sequence never reset |
| `seasons` | kept: row 1 (season 1, ended at the cut-over) and row 2 (perpetual) |
| `legacy`, `season_archive`, `hall_of_fame` | kept as read models (cosmetics, titles, the old world) |
| `listings`, `trades`, `wheel_bets`, `signal`, `signal_gifts` | dormant: emptied at the cut-over, no code; dropped in R7 by migration after the R7 export |

### 9.3 Migrations

One additive migration at the cut-over, `0005_redesign` (`pnpm db:generate` after editing
`store/schema.ts`; 0000-0004 exist today):

```sql
ALTER TABLE commands ADD COLUMN expires_at integer;
CREATE INDEX commands_expires ON commands (expires_at);
```

Adding a nullable column needs no table rebuild. It runs at boot (`store/db.ts:22`). The old code
ignores the column, so a rollback that restores the pre-cut-over file never sees it.

### 9.4 Command records and TTL (resolution 3.16)

| Class | Commands | Stored | TTL | `event_log` | Push to other tabs |
| --- | --- | --- | --- | --- | --- |
| slim | `taps`, `ping` | `{ok, version, credited, refusal?}` | 1 h | only a found page's `logbook_entry` | version only |
| standard | every other command, admin included | `{ok, version, events, refusal?}` | 7 days | rare events (7.2) | full state |

- No record holds state. A replay returns the stored outcome with the **current** state and
  version; the client adopts whatever state arrives anyway (`store.ts:438-444`). This keeps the
  Foreman's buy a second from writing about 10 KB each (about 20 MB a day per heavy player).
- Prune in the minute tick: `expires_at < now`, or `expires_at IS NULL AND at < now − 7 days`
  for rows written before the migration (replacing `game.ts:1066-1069`).
- The double `JSON.stringify` compare (`game.ts:629-630`) gives way to `changed` from the
  domain.

### 9.5 The nuke on the server

`nuke` is an ordinary command: one transaction, the same `bases` row overwritten by `save()`, so
`version` rises (code-api 7.4). No escrow, bets or listings exist any more, so nothing needs
closing. No backup is taken per nuke. For a Wipe Day the API adds the `record` and `islandCount`
flags from its group cache, and runs `arrive` read-only over each active friend's stored `meta`
to count the crates that land for the postcard ("Your blast washed 7 crates onto 3 islands",
`06` 3.2); it writes nothing to their rows. After the commit, the outbox broadcasts the feed line
when `news` is set, the bot posts it, and the group cache updates (Island Count, medians). A small
blast does none of this.

### 9.6 Admin: grant and respec

- Routes under the existing admin guard (`app.ts:105-137`: `ADMIN_TOKEN`, or loopback without
  it). CLI `apps/api/src/admin-cli.ts` *(proposal)* replaces `season-cli.ts` and calls them over
  loopback, as today:
  `docker exec -w /app/apps/api wipeday node_modules/.bin/tsx src/admin-cli.ts grant --player 1 --glass 5 --skin founder --note founders`.
- `grant` runs through the command path with a key the CLI generates (`--key` to retry). Glass
  goes to `glass.held` only, so a gift never changes Glow, `ever` or the nuke formula
  (resolution 1.2). Scrap goes to `meta.scrap`. Skins and titles go to the `legacy` row. One
  transaction; logs `granted`; pushes the full state.
- `respec_all` loads every base in one transaction: `held += spent`, `spent = 0`,
  `nodes = ["ground_zero"]` when `wipeDays >= 1`, `loadout = []`; each base saved (version + 1),
  `respecced` logged and pushed. It is used only with a decision entry (canon 6.5).

### 9.7 Rate limiting

There is none today (code-api 6). Add an in-memory token bucket per player on
`POST /api/commands`: 10 a second, burst 30. Above it the API answers `429 {error: "slow_down",
retryAfterMs}`, which the client retries with the same key. The domain's tap bucket bounds
credit; this bounds CPU and disk against a runaway tab. Auth routes keep their OAuth state checks.

---

## 10. Web client

### 10.1 Store (`apps/web/src/state/store.ts`)

- **Removed:** `season`, `legacy`, `signal`, `seasonSeen`, `weather` (now `weatherAt`), the Den,
  raids, `roll`, report and map fields and their actions (code-web 5.6).
- **Added:** the tap tail and its snapshot (6.3); `cinematic {phase, startedAt, from, result}`;
  `blastMap {sector, node}`; `sheet`; `reconnecting`.
- **Queue:** entries `{key: string | null, command, at, predicted}`. Coalescing is in `taps.ts`.
  `flush` stays one at a time and in order, with no wipe on error (6.3).
- **Narrow selectors.** `tick()` stops calling `set({now})` every frame (`store.ts:784-811`):
  animation reads the clock in the frame loop, and the store publishes `second` once a second for
  cooldowns. No component selects the whole base (rows select `base.run.lines[id]`), which ends
  the per-tap re-renders of code-web fact 13.

### 10.2 The counter outside React

`hud/Counter.tsx` renders a `<span>` once; a rAF loop writes `fmt(suppliesAt(content, base,
nowSeconds), "held")` and the rate into it, in tabular numerals, with no React render. While the
welcome-back card is up it shows `supplies − gain`, and Collect animates it up. The gain is
already in state; this is display only.

### 10.3 Scene (`apps/web/src/scene`)

- **Camera:** a phone reframing so the target stands on the rise at about 40% of the height, at
  least 120 CSS px tall (N27). Desktop recentres in the area left of the 420 px drawer, reading
  insets from the DOM as `hudInsets()` does (`Scene.ts:87-91`).
- **Sky and weather** read `isNight` and `weatherAt` from the domain (6.5).
- **`target.ts`** (replaces `nodes.ts`): one tap target per era with today's fall, crumble and
  regrow art; a fixed on-screen hit area (D48); the Hustle arc; the 0.3 s pop-up during which
  taps still count. Pokeable objects (the gull, the Kettle) get fixed hit areas from R4.
- **Lines:** `buildings.ts` drawings remapped from levels 1/2/3 to owned 1/25/100, with a count
  badge and a cycle bar (an unmanned bar fills only while a cycle is in flight). New drawings for
  `beachcomber`, `shipbreaker` and `reactor`. Each cycle drops the line's product (pooled
  sprites, amendment A1); the product icon flies with the floater to the counter.
- **`kettle.ts`** (new): the pad, the Kettle's four stages (`kettleStage(content, state)` from
  the domain, resolution 3.5), the Big Red's drum and lid, on the Signal's old slope spot. It
  ships in R2 with the pad's locked card, never earlier; the pad appears at 5e8 lifetime supplies
  in run 1 and from the start of later runs (errata E2).
- **`flotsam.ts`** (new): drifting objects left of x≈480 from `flotsamAt(content, state, t)`,
  with a fixed tap target.
- **The cinematic** (`cinematic.ts`, new): missile and mushroom puffs in `world`; the fireball on
  `lights` (D47); the flash as a CSS overlay; shake where `world.position` is set
  (`Scene.ts:541`); the tint through `ambient` (`Scene.ts:563`); a timeline on the `wall` clock
  (10.7). The scene draws the **old** run (`cinematic.from`) until the flash, though the
  prediction already holds the new one; the postcard waits for the server's answer.
- **Removed:** `den.ts`, `raids.ts`, `signal.ts`, `station.ts`, the barrel and the node marker
  (section 12).

### 10.4 The Blast Map (React DOM and SVG, canon 6.6)

- `hud/blast/Overview.tsx`: one SVG disk of the shipped nodes, laid out by a pure
  `blastLayout(content)` (sector, ring, slot to polar coordinates, shared with tests and shots).
  Node state is a CSS class; owned glow is a second circle with a radial gradient (no SVG filters
  on phones); only the advisor's pick pulses. Nodes above `shippedWave` are not rendered.
- `SectorLadder.tsx`: a vertical ladder of 56 px buttons, at most 4 a row. `NodeSheet.tsx`: the
  effect "in your numbers" from `effectNow(content, state, node)` (fold with the node minus
  without, cached per state), the cost, one primary or its reason, and the path purchase.
- Code-split with `React.lazy`, like the cinematic. While the map is open, the Pixi ticker drops
  to 10 fps.

### 10.5 Pooling and budgets

Floaters: pooled `BitmapText` from Roboto Condensed, at most 12 live, rapid gains merged into one
running label. Particles: one pool, at most 160 live, at most 6 per tap. Product sprites: at most
40 live. Initial JS at most 450 KB gzipped (checked in `pnpm web:build`).

### 10.6 Sound and haptics (`apps/web/src/sound`, new)

- One `AudioContext`, created on the first gesture; a master gain; the toggle in localStorage
  (default on).
- Procedural voices in `voices.ts`: tap (pitch rising with Hustle), buy, milestone, fell (R1);
  flotsam, siren, boom (R2). At most 8 voices; tap sounds throttled to 15 a second.
- An owner file at `apps/web/public/sound/<id>.ogg`, if present, replaces a voice.
- `navigator.vibrate` on fell, milestone and the hold-to-launch. `prefers-reduced-motion` swaps
  shake and flash for fades.

### 10.7 LocalBackend, the demo clocks and the drawer

- `net/local.ts` is rewritten on the new domain. It plays a fake friend, Hollis (kept from W6),
  who makes a Wipe Day every 20 game minutes (feed, Blowback, Island Count), and a fake group for
  Late Tide and the Freighter, building `World` locally.
- **The demo game clock runs at 1×** (resolution 3.18). The speed slider (1-2,400×) goes; pause,
  +1 h and +6 h stay, and "next day" (08:00) is added. Idle timers are reviewed by jumping;
  active-play timers stay real seconds (rule 6.3.9). A jump is time passing for everything, as on
  the server: a buff, Afterglow or Hustle whose time is up has ended.
- **`wall`** joins `demoClocks` in R0: a 1× clock the scene's animation, floaters and the
  cinematic timeline read through `nowMs()`. Shots pin `time` (game) and `wall` separately, as
  CLAUDE.md 6.4 already describes; the domain never reads `wall`.
- The drawer: Wipe Day count, glass and scrap grants, era, a flotsam kind on demand, the Kettle's
  stage, "next rain" and "next fog" (jumps to the next such block, so scene and rules agree), a
  cinematic phase replayed or pinned, reset run.

### 10.8 Debug hooks for shots (`debug.ts`)

`window.__wipeDay` keeps `store`, `clocks` (now `game` and `wall`), `frames` and `frozen`, and
gains: `pin {cinematic?: {phase, t}, flotsam?: {kind, t}, kettle?: stage, blast?: {sector,
node}}`; `target()` (the target's screen box); `hitBoxes()` (scene tap targets, for the 44 px
audit); `tap(n)` (taps through the store); and `seed(n)`. The shots list and state keys are in
`08-screens.md` 8.1.

---

## 11. Discord bot (`apps/discord`)

- **Card v2 at R2** (`ui/home.ts`, `render/cards/base.tsx`; fields in `06` 10.2): the idle
  rate, the Night Shift fill ("7h 12m of 12h" or "Full: Collect to restart"), the Big Red's yield
  ("+12 glass now", no button). **Collect** leads when the window is stalled or at least half
  used, otherwise **Open the game**. No taps and no nuke from Discord (owner decision 18).
- Collect sends `{type: "collect"}` keyed `discord:{interaction id}` (D121). Like any command it
  restarts the Night Shift window, and it runs the Foreman's pass when `meta.prefs.foreman` is
  on. The API refuses any other command from the bot (`not_on_discord`, 9.1).
- Numbers and sentences come from `@wipe-day/domain/words` (section 2.4), so they match the web.
- **Boundary test** (`boundary.test.ts`, `06` 10.6): today's blocklist `RULEBOOK` (it names
  `nodes`, `missions`, `market`, `casino` and `raids`, all leaving) becomes an allowlist: value
  imports from `@wipe-day/domain/*` only from `glance` (new, read-only: rate, window fill, Big Red
  yield, Magnet, crates, Freighter; shared with the web's top bar), `advisor`, `words` and
  `clock` (the bot's `systemClock`); the preview fixtures (`render/fixtures.ts`) may also call
  `newBase`; everything else type-only (`06` 10.6, errata E18). The `raidWarned` allowance goes. One constant
  `BOT_COMMANDS = ["collect"]`, and no other command `type` literal in `apps/discord/src`.
- `seasonDay` and the season news go; the stream carries feed items, DMs and one monthly post.
- **R6:** a Wipe Day's feed item renders a postcard card through satori.

---

## 12. Deletion plan (on `redesign`, after `pre-redesign` is tagged on `main`)

| Area | Deleted (with their tests) | Rewritten |
| --- | --- | --- |
| `packages/domain/src` | `active`, `buildings`, `casino`, `contracts`, `craft`, `crew`, `den`, `goods`, `jobs`, `market`, `missions` (parked), `nodes`, `raids`, `recipes`, `signal`, `modifiers`, `legacy` | `base` → `state`, `settle`, `commands`, `advisor`, `events`, `feed`, `normalize`, `stats`, `leaderboard` → `boards`, `words`, `wire`, `world`. New: `amount`, `effects`, `lines`, `taps`, `flotsam`, `weather`, `nuke`, `blastmap`, `glance`, `foreman`, `magnet`, `toolbelt`, `dares`, `social`, `logbook` |
| `packages/content` | the data files in 8.1; `odds.ts`; `checkRecipes`, `checkCrewAndMap`, `checkDen`, `checkRaids`, `checkLegacy` | `schema.ts`, `parse.ts`, `look.ts` (fallback tiles) |
| `packages/sim` | `rtp.ts`, `rtp.test.ts`; the gambler, raider and veteran | `sim.ts` → lifetime loop (`10-balance.md`) |
| `apps/api/src` | `den.ts`, `den.test.ts`, `raid.test.ts`, `season-cli.ts` (the cut-over runs it from the old build) | `game.ts` (Den, raid, Signal and season paths go), `commandSchema.ts`, `push.ts` (quiet hours), `legacyStore.ts` (cosmetics only), `season.test.ts` → `nuke.test.ts` |
| `apps/web/src/hud` | `Dock.tsx`, `RaidAlert.tsx`, `ReportCard.tsx`, `SeasonOver.tsx`, `crew.ts`; panels `Build`, `Craft`, `Defence`, `Den`, `Furnace`, `Games`, `Inventory`, `MapPanel`, `Signal`, `Squad`, `Tasks`, `Legacy`, `Ranks` | `TopBar`, `AwayModal`, `Toasts`, `Panel`, `Cost`, `Icon`, `DemoDrawer`, `derived.ts`; panels `Feed` → Friends |
| `apps/web/src/scene`, `map` | `den.ts`, `raids.ts`, `signal.ts`, `station.ts`, `map/MapView.ts` (parked) | `Scene.ts`, `base.ts`, `buildings.ts`, `sky.ts` (island clock), `nodes.ts` → `target.ts`, `effects.ts` (pooled), `actors.ts` (hands) |
| `apps/web/src/state` | — | `store.ts`, `clocks.ts` (1× and `wall`), `world.ts` |
| `apps/web/scripts` | obsolete `SHOTS` entries | `shots.mjs` (list in `08`) |
| `apps/discord` | the season-news path | `ui/home.ts`, `cards/base.tsx`, `boundary.test.ts` |

Everything deleted stays reachable at `pre-redesign`. Parked systems (expeditions, `MapView`)
return from that tag if a sea layer is built.

---

## 13. The cut-over runbook (end of R2)

Run it end to end on a copy of the live database first (the rehearsal, `11-roadmap.md` 4.3). A
message in `#wipe-day-idle` beforehand is optional: nobody plays season 1 now (decision 7). `KEY` is the owner's
deploy key; `S` is `ssh -i ~/.ssh/$KEY vpsuser@37.46.209.127`.

| # | Step | Command | Check |
| --- | --- | --- | --- |
| 1 | Off-server backup | `$S 'docker exec -w /app/apps/api wipeday node -e "const D=require(\"better-sqlite3\"); new D(\"/app/var/wipeday.db\").backup(\"/app/var/backups/wipeday-pre-cutover.db\").then(()=>console.log(\"ok\"))"'`, then the R0 copy job (`rclone copy` to the remote) and `scp` a second copy to the deploying computer | The remote lists the file; `pragma integrity_check` on the local copy says `ok` |
| 2 | Tag the old game | `git switch main && git tag season-1-final && git push origin season-1-final` | Tag on GitHub |
| 3 | End season 1 quietly (no `season announce`, errata E3; decision 7) | `$S 'cd ~/wipeday && docker compose --profile bot stop wipeday-bot'`, then `$S 'docker exec -w /app/apps/api wipeday node_modules/.bin/tsx src/season-cli.ts end'` | It writes `wipeday-pre-season-1.db`; `seasons` has row 2 running; the bot stays stopped (its season news is live-only, so nothing wrong is posted); the owner may post the optional message by hand (`07` has the text) |
| 4 | Stop the game | `$S 'cd ~/wipeday && docker compose --profile bot stop wipeday wipeday-bot'` (the bot is already stopped) | Our project only: never touch `~/tk-toolkit` |
| 5 | Record the sequence | `$S 'cd ~/wipeday && docker compose run --rm --no-deps -w /app/apps/api wipeday node -e "const D=require(\"better-sqlite3\"); const db=new D(\"/app/var/wipeday.db\",{readonly:true}); console.log(db.prepare(\"select seq from sqlite_sequence where name=?\").get(\"event_log\"), db.prepare(\"select max(id) m from event_log\").get())"'` | Note both numbers |
| 6 | Wipe (API stopped, so one writer) | the same `docker compose run` with the recipe below | `wiped` |
| 7 | Merge and deploy | `git merge --no-ff redesign`; the deploy checklist (`docs/deploy.md:40-57`); `DEPLOY_KEY=~/.ssh/$KEY scripts/deploy.sh` | Health `{"ok":true}`; migration 0005 applied; four sites answer 200 |
| 8 | Verify | Step 5's query again; log in as the owner; `/base` in Discord | Sequence and max id unchanged; a fresh v2 base; card v2 renders |
| 9 | Founders' gift | `$S 'docker exec -w /app/apps/api wipeday node_modules/.bin/tsx src/admin-cli.ts grant --player <id> --glass 5 --skin founder --note founders'` for each player with a season 1 base (decision 8) | `granted` in `event_log`; 5 glass held, glass ever still 0 |
| 10 | Push and announce | `git push origin main`; a post in `#wipe-day-idle` | — |

The recipe (step 6), one transaction:

```js
const D = require("better-sqlite3");
const db = new D("/app/var/wipeday.db");
db.transaction(() => {
  for (const t of ["commands", "bases", "trades", "listings", "wheel_bets", "signal_gifts", "signal"])
    db.prepare(`DELETE FROM ${t}`).run();
})();
console.log("wiped");
```

It deletes run state only (resolution 3.28): bases, their idempotency records and the removed
systems' rows. It differs from today's recipe (`docs/deploy.md:173-181`) on purpose:

- It keeps `players`, `sessions`, `login_links`, `push_subscriptions` and `settings` whole (the
  VAPID keys, the casino secret, the Discord cursor; the casino's `jackpot` row stays, inert).
- It keeps `event_log` rows (season-1 history; every query is scoped by season or by new types)
  and **never** touches `sqlite_sequence`.
- It keeps `seasons`, `legacy`, `season_archive` and `hall_of_fame`, because foreign keys
  (`db.ts:20`) tie the archive and `event_log.season_id` to the season rows, and canon keeps the
  old world.
- A base that slips in between the steps is still safe: `normalizeState` resets any non-v2
  row in place (3.3).

**Rollback** (within the first day only; after that, fix forward):

1. `docker compose --profile bot stop wipeday wipeday-bot`.
2. Keep the failed state: move `wipeday.db` with its `-wal` and `-shm` files into
   `var/backups/failed-redesign/`.
3. Restore `wipeday-pre-cutover.db` as `var/wipeday.db`, with no `-wal` or `-shm` beside it.
4. From a clean worktree at `season-1-final`, run `scripts/deploy.sh` (it ships `HEAD`).
5. Check health and the four sites. The restored file predates migration 0005, and season 1
   resumes where it stood.

---

## 14. Testing strategy

| Layer | What | Where |
| --- | --- | --- |
| Unit | Every rule with `manualClock` and seeded `rng`: formulas, buy-k and buy-max (the overshoot step), milestones and kept roster tiers, Hustle, felling, crits, Afterglow from `afterglowFrom`, unmanned cycles (a busy line starts nothing; the cycle in flight pays once; a hire or a nuke pays it at once), the flotsam cursor, claim window and run 1's crates, weather and night from `island.json5`, the Night Shift, the Magnet, the Toolbelt, Dares, the rebuild window, ranks rising together, Late Tide's cap at the median, Logbook detection in every command, the advisor's crown order, refusals with their `need` | `packages/domain/src/*.test.ts` |
| Property (N24, N10) | Path independence (1e-9); the tick oracle (1e-6, payouts included); `suppliesAt` agreement; **the bucket never over-credits** (adversarial `count`, `pokes`, `from` and `to`: taps plus pokes at most `45 + 15 × elapsed`; honest sequences never clamped); effects monotonicity and bounds | `settle.test.ts`, `taps.test.ts`, `effects.test.ts` |
| Invariants | **A nuke keeps `meta` exactly**: every field except `nukes`, `wipeDays`, `lifetime`, `glass`, `nodes` and `scrap` (the first Wipe Day), `dares` (a met goal), `news`, `records` and `stats` is deep-equal before and after; the gain equals the formula of 6.2 exactly; a grant never moves `ever`, `level` or Glow. `newRun` is deterministic. Supplies never negative. `assertFiniteState` after every simulated step. `normalize` is idempotent | `nuke.test.ts`, `state.test.ts` |
| Idempotency (API) | Every command twice with one key: one effect, same outcome, the current state; no record holds state. A stale prediction is judged by the current state. A slim record expires after 1 h, a standard one after 7 days. A `taps` replay after expiry credits nothing beyond the bucket. A `nuke` replay after expiry refuses `stale_run`. 50 parallel `taps` from two tabs: the server total equals the bucket bound. `version` rises across a nuke and a v1 reset. The bot route refuses all but `collect`. Quiet hours hold a push and the tick sends it at 08:00 | `apps/api/src/app.test.ts`, `nuke.test.ts`, `bot.test.ts` |
| Client pure parts | Tap coalescing (merge before key, close rules, pokes); the drift-free prediction (snapshot + merged tail equals rebase); queue pruning | `apps/web/src/state/taps.test.ts` (new; vitest is already in the workspace) |
| Content | The checks of 8.3 on the real data (rings 7-9 included from R3), plus broken fixtures for each rule | `packages/content/src/load.test.ts` |
| Simulator | `pnpm sim check` asserts `pacing.json5` v2 inside `pnpm test` (D56) in under 10 s (errata E4); determinism per archetype; the 24 KB state budget; N15 on the full tree from R3 | `packages/sim/src/sim.test.ts` |
| Bot | Boundary test (the allowlist); card snapshots; `pnpm preview` | `apps/discord` |
| Visual | `pnpm web:shots` with pinned phases and both clocks; notes in `docs/ui-review.md` | `08-screens.md` |

---

## 15. Ops

- **One process, one writer, no new service** (canon 13.10). The API keeps the scheduler, SSE,
  the group cache, held pushes and backups. Never touch the tk-toolkit containers
  (`docs/deploy.md`).
- **Load.** Ten players tapping send about 10 batches and at most 10 Foreman buys a second, at
  about 1 ms each on the VPS: about 2% of a core.
- **Memory.** The API is unchanged in kind and the bot stays capped at 320 MB
  (`deploy/compose.yml`). The risk is the image build on the 1.9 GB box (the web build,
  `pnpm --filter @wipe-day/web build`, in the `Dockerfile`). In R1, measure its peak during
  `deploy.sh` and set `NODE_OPTIONS=--max-old-space-size=768` there. Above about 900 MB, build
  `apps/web/dist` on the deploying computer and ship it in the archive; the Dockerfile skips the
  web build when `dist` exists.
- **DB growth** (10 active players):

  | Table | Per heavy player a day | Kept | Steady state |
  | --- | --- | --- | --- |
  | `commands`, slim | about 10,800 rows × 150 B | 1 h | under 1 MB each |
  | `commands`, standard | about 2,000 rows × 400 B | 7 days | about 6 MB each |
  | `event_log` | about 120 rows × 200 B | forever | about 90 MB a year in all |
  | `bases` | 1 row, at most 24 KB | — | negligible |

  With full responses stored, one heavy tapper would leave 0.7-1.2 GB in `commands` (code-api
  0.2).
- **Backups.** The nightly online copy and its 14 dated files stay (`backup.ts`,
  `KEEP_BACKUPS`). R0 adds the off-server copy: a user crontab on the VPS (no `sudo`) running
  `rclone copy ~/wipeday/var/backups <remote>:wipeday --max-age 48h` after the nightly copy, to
  the owner's encrypted remote (`11-roadmap.md` R0), plus a restore drill in `docs/deploy.md`.
  The pre-cut-over and pre-season copies are kept forever off the box. If the database passes
  200 MB, R7 moves to 7 daily and 4 weekly copies on the box.
- **Errors.** A failed finite guard, a 500 or a failed scheduler run goes to the owner by bot DM
  (R2, `11-roadmap.md`), carried on the bot's stream as an `ops` message.

---

## Open questions

None; settled by errata v3.

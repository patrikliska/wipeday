# 04b Tide: the 45 nodes of the Tide sector (proposal)

Tide (`tide`), "The sea always brings something". It covers flotsam, the sea lines and the weather.
Every name is a proposal for the owner's pass. The data is in `04b-tide.json`, one object per node in
the shape the orchestrator asked for, plus `series`, `gate`, `conflicts`, `dataFrom` (when a node
joins the data file before it is shown) and `flavour` (an optional line under the blurb, 04 10.3).
Tide has none of canon 6.7's anchor nodes.

**What the sector does to a run**

- **Rings 1-3 (R2): more time to catch.** Lucky Tide and Rally Cry use all of the tree's flotsam
  frequency and payout (×1.05 each). The rest is float time (13 → 19 s, 29 s in rain), the Lookout
  Post's bell and gulls that circle whatever floats.
- **Rings 4-6 (R3): new kinds and catching help.** These rings add the Life Raft kind, the Drag Line
  (a miss waits on the shore) and the Beachcomber's Net (crates catch themselves). Float time reaches
  its ceiling (25 s, 40 s in rain). The first lines share comes in two flavours. Rain: Storm Harvest
  and Rain Barrels make lines ×2.8 in rain. The sea lines: Breakwater. The keystone is Scavenger's Eye.
- **Rings 7-9 (R7): cargo, the tide clock and the weather buoy.** Lost Cargo, Bottle Post and the
  Rogue Wave bring more in from the sea. Tide Tables and the Weather Buoy turn the sea and the sky
  into a schedule you can plan around. Ship Breakers reach ×6, so the Ship Breaker rivals the
  Reactor. Wreckers' Moon, the keystone, brings crates to players who are away.

Rain is the sector's signature. In rain, flotsam already comes 1.5× as often. With Tide it floats
40 s and the lines run ×2.8. The Weather Buoy shows when the next rain comes. Rain output applies to
everyone at the same time, offline included, so it does not move N9 (active against idle in the
same weather) or the gaps between archetypes (N16).

## 1. Budget tracking (per ring)

**Shares used.** Tide's lines share is `04-blast-map.md` 7.2's: ×1.2 in ring 5 and ×1.5 in each
of rings 6-9. `10-balance.md` 6.3 gives Tide no `output` at all, but allows sectors to trade inside a
ring when the ring's product holds. 04 7.2's split is that trade: rings 5 and 6-9 come to ×10.2 and
×1,013, against ×10 and ×1,000. **Recorded trade:** Tide takes ×1.2 / ×1.5 of the `output` column
from the shares 10-balance 6.3 gives Works, Crew, Logbook, Bunker and Scrapyard, as 04 7.2 lists
them. King Tide's fixed ×1.2 already needs a Tide share.

**How a node is counted** (10-balance 6.2, authoritative):

- An effect on all lines counts in full.
- `when: rain` counts at 0.2.
- Line 13, the Ship Breaker, counts at its mid-game share of 0.15.
- Docks (line 10), Beachcombers (line 1) and the Twig era count at 0. They shorten run openings,
  which the simulator measures.

The table gives two readings:

- **Per node:** each node's own count, multiplied.
- **Compounded:** the sector's fold with the ring lit over the fold without it, lower rings lit. A
  stacked rain or Ship Breaker multiplier then counts at its growing share. This is the stricter
  reading and the one kept within the share.

| Ring (opens) | Flotsam often `flotsam_rate`: budget / used | Flotsam pays `flotsam_effect`: budget / used | Float, clear / rain, cumulative (ceiling 25 / 40 s) | Kind weights (printed odds stay at 100%) | Lines share | Lines used: per node / compounded | Lines cumulative: used / budget |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 (#1) | ×1.05 / ×1.05 (Lucky Tide) | – | 14 / 14 s | – | none | ×1.00 / ×1.00 | 1.00 / 1.00 |
| 2 (#1) | – | ×1.05 / ×1.05 (Rally Cry) | 14 / 14 s | – | none | ×1.00 / ×1.00 (Driftwood I: Beachcombers, 0) | 1.00 / 1.00 |
| 3 (#3) | – | – | 19 / 29 s | – | none | ×1.00 / ×1.00 | 1.00 / 1.00 |
| 4 (#5) | – | – | 25 / 38 s | Life Raft 4%, from the crate | none | ×1.00 / ×1.00 | 1.00 / 1.00 |
| 5 (#10) | – | – | 25 / 40 s | – | ×1.2 | ×1.188 / ×1.188 (Sea Wall I ×1.1; Storm Harvest rain ×1.4) | 1.188 / 1.200 |
| 6 (#20) | – | – | 25 / 40 s | – | ×1.5 | ×1.419 / ×1.489 (Rain Barrels; Breakwater; Tide Mill) | 1.769 / 1.800 |
| 7 (#30) | – | – | 25 / 40 s | Lost Cargo 3%, from the crate | ×1.5 | ×1.391 / ×1.463 (Sea Wall II, III; Cutting Torch I) | 2.589 / 2.700 |
| 8 (#40) | – | – | 25 / 40 s | Bottle 0.5 → 1%, from the crate | ×1.5 | ×1.265 / ×1.481 (Sea Wall IV; Cutting Torch II) | 3.833 / 4.050 |
| 9 (#50) | – | – | 25 / 40 s | – | ×1.5 | ×1.452 / ×1.452 (King Tide ×1.2; Sea Wall V; Relit Lighthouse) | 5.566 / 6.075 |
| **Sector** | **×1.05 / ×1.05** | **×1.05 / ×1.05** | **25 / 40 s** | **neutral** | **×6.08** | | **×5.57** |

- **Every other column is zero in every ring:** `tap`, tap internals, line, hand, shelf and era
  prices, hours, offline, glass, `glow_k` and Morale. No node touches `rally_mult`, the Sealed
  Locker's weight, Blowback or scrap.
- **End state of the sector.** All lines ×2.34. Rain ×2.8. Ship Breakers ×6. Docks ×12.
  Beachcombers about ×13 (Driftwood's +110%, then ×6). The Twig era ×2.9.
- **Float** reaches its ceiling at High Water (4.3). Rain float reaches +15 s at Storm Harvest (5.2).
  After ring 2, no node raises frequency, payout or Rally (04 6.6).
- **New kinds** pay about a crate (canon 13.5; 10-balance 6.1). Their weight comes from the Drift
  Crate, so the Sealed Locker keeps exactly 1.5%.
- **The two keystones** are outside the shares (keystone rule; see section 3).
- **10% rule** (from ring 3, lower rings owned):

  | Node | Before → after | Gain |
  | --- | --- | --- |
  | Slow Current II | 14 → 16 s | +14% |
  | Storm Drift | 29 → 32 s in rain | +10.3% |
  | Slow Current III | 19 → 22 s | +16% |
  | Driftwood II (Beachcombers) | Σinc about 2.0 → 2.6 | +30% |

  Every ring-5+ small is a `more` of ×1.1 or more.

## 2. The 45 nodes

**How to read the table.**

- `requires` is OR. A completion needs all of the previous ring (AND).
- "scene" marks a node with a drawing (04 2.5): every band has several.
- "data Rn" is when the node joins the data file before it is shown.

**Small-node series** (each numbered outward; 04 10.1):

| Series | Stat | Nodes |
| --- | --- | --- |
| Slow Current | `flotsam_float` | I-III |
| Driftwood | Beachcombers | I-IV |
| Beach Camp | Twig era | I-III |
| Sea Wall | all lines | I-V |
| Deep Nets | Docks | I-III |
| Cutting Torch | Ship Breakers | I-II |

Two smalls are one-offs: Storm Drift (rain float) and Rain Barrels (rain output).

**Checks run** (a scratch script, not in the repo):

- The type quotas match: 22 small, 9 notable, 2 keystone, 7 unlock, 3 automation, 2 completion.
- The slot table matches 04 6.6, and every node's parents follow 04 1.3's default wiring.
- The longest run of small nodes on any chain is 2, and consecutive smalls never share a series.
- Every price is on the ladder.
- Names are at most 24 characters, and every blurb and flavour line at most 80.
- `feature:` appears only on unlock, automation and keystone nodes.

| Slot | Id | Type | Name | Text | Glass | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `lucky_tide` | notable | Lucky Tide | Flotsam drifts in 5% more often. | 3 | `ground_zero` | R2 |
| 1.2 | `slow_current_1` | small | Slow Current I | Flotsam floats 1 s longer. | 1 | `ground_zero` | R2 |
| 2.1 | `lookout_post` | unlock | Lookout Post | A lookout points and a bell rings 3 s before flotsam drifts in. | 7 | `lucky_tide` | R2 (scene) |
| 2.2 | `driftwood_1` | small | Driftwood I | Beachcombers +50%. | 4 | `lucky_tide`, `slow_current_1` | R2 |
| 2.3 | `rally_cry` | notable | Rally Cry | Flotsam pays 5% more, Rallies included; the crew cheer each Rally. | 9 | `slow_current_1` | R2 (scene) |
| 3.1 | `slow_current_2` | small | Slow Current II | Flotsam floats 2 s longer. | 44 | `lookout_post` | R2 |
| 3.2 | `rainmaker` | notable | Rainmaker | In rain, flotsam floats 10 s longer. | 55 | `lookout_post`, `driftwood_1` | R2 |
| 3.3 | `circling_gulls` | notable | Circling Gulls | Gulls circle anything afloat: flotsam floats 3 s longer. | 66 | `driftwood_1`, `rally_cry` | R2 (scene) |
| 3.4 | `driftwood_2` | small | Driftwood II | Beachcombers +60%. | 25 | `rally_cry` | R2 |
| 4.1 | `life_raft` | unlock | Life Raft | New flotsam (4%): a castaway rows in and mans your top unmanned line for 10 min. | 333 | `slow_current_2` | R3 (scene) |
| 4.2 | `storm_drift` | small | Storm Drift | In rain, flotsam floats 3 s longer. | 222 | `slow_current_2`, `rainmaker` | R3 |
| 4.3 | `high_water` | completion | High Water | Flotsam floats 3 s longer (25 s, the most); the tide line rises. | 555 | all of ring 3 | R3 (scene) |
| 4.4 | `slow_current_3` | small | Slow Current III | Flotsam floats 3 s longer. | 333 | `circling_gulls`, `driftwood_2` | R3 |
| 4.5 | `drag_line` | automation | Drag Line | Flotsam you miss snags on a line and waits on the shore, one at a time. | 444 | `driftwood_2` | R3 (scene) |
| 5.1 | `beach_camp_1` | small | Beach Camp I | Twig-era lines ×1.3. | 2,222 | `life_raft` | R3 |
| 5.2 | `storm_harvest` | notable | Storm Harvest | In rain, all lines ×1.4 and flotsam floats 2 s longer. | 5,555 | `storm_drift` | R3 |
| 5.3 | `scavengers_eye` | keystone | Scavenger's Eye | Every flotsam is a Fuel Drum (Sealed Lockers aside): no crates, kits or bottles. | 7,777 | `high_water` | R3 |
| 5.4 | `beachcombers_net` | automation | Beachcomber's Net | Drift Crates catch themselves while the page is open. | 3,333 | `slow_current_3` | R3 (scene) |
| 5.5 | `sea_wall_1` | small | Sea Wall I | All lines ×1.1. | 4,444 | `drag_line` | R3 |
| 6.1 | `deep_nets_1` | small | Deep Nets I | Docks ×2. | 22.2k | `beach_camp_1` | R3 |
| 6.2 | `flare_gun` | unlock | Flare Gun | Choose what your Flare calls: any kind but the Sealed Locker and the Bottle. | 33.3k | `beach_camp_1`, `storm_harvest` | R5 (gate 15) |
| 6.3 | `breakwater` | notable | Breakwater | Beachcombers, Docks and Ship Breakers ×1.5; car hulks shelter the bay. | 77.7k | `storm_harvest`, `scavengers_eye` | R3 (scene) |
| 6.4 | `rain_barrels` | small | Rain Barrels | In rain, all lines ×2. | 44.4k | `scavengers_eye`, `beachcombers_net` | R3 |
| 6.5 | `tide_mill` | notable | Tide Mill | Every line cycles 10% faster; a tide mill turns at the water's edge. | 55.5k | `beachcombers_net`, `sea_wall_1` | R3 (scene) |
| 6.6 | `driftwood_3` | small | Driftwood III | Beachcombers ×2. | 33.3k | `sea_wall_1` | R3 |
| 7.1 | `rogue_wave` | unlock | Rogue Wave | Once a run, tap the surf: a big wave rolls in carrying a Drift Crate. | 333k | `deep_nets_1` | R7 (scene) |
| 7.2 | `sea_wall_2` | small | Sea Wall II | All lines ×1.1. | 444k | `flare_gun` | R7 |
| 7.3 | `cutting_torch_1` | small | Cutting Torch I | Ship Breakers ×2. | 333k | `breakwater` | R7 |
| 7.4 | `beach_camp_2` | small | Beach Camp II | Twig-era lines ×1.5. | 222k | `rain_barrels` | R7 |
| 7.5 | `sea_wall_3` | small | Sea Wall III | All lines ×1.1. | 555k | `tide_mill` | R7 |
| 7.6 | `lost_cargo` | unlock | Lost Cargo | New flotsam (3%): a shipping container; line units cost half for 5 min. | 444k | `driftwood_3` | R7 (scene) |
| 8.1 | `sea_wall_4` | small | Sea Wall IV | All lines ×1.1. | 4.44M | `rogue_wave` | R7 |
| 8.2 | `cutting_torch_2` | small | Cutting Torch II | Ship Breakers ×2. | 5.55M | `rogue_wave`, `sea_wall_2` | R7 |
| 8.3 | `bottle_post` | notable | Bottle Post | Messages in a Bottle wash up twice as often (1%); each still holds a crate. | 4.44M | `sea_wall_2`, `cutting_torch_1` | R7 (data R4) |
| 8.4 | `wreckers_moon` | keystone | Wreckers' Moon | A Drift Crate washes up for each hour away, up to 12; online flotsam ×0.5. | 7.77M | `cutting_torch_1`, `beach_camp_2` | R7 (scene) |
| 8.5 | `auto_flare` | automation | Auto Flare | Your Flare fires itself when it's ready and nothing floats, page open. | 3.33M | `beach_camp_2`, `sea_wall_3` | R7 (gate 15, data R5) |
| 8.6 | `deep_nets_2` | small | Deep Nets II | Docks ×2. | 3.33M | `sea_wall_3`, `lost_cargo` | R7 |
| 8.7 | `driftwood_4` | small | Driftwood IV | Beachcombers ×2. | 2.22M | `lost_cargo` | R7 |
| 9.1 | `beach_camp_3` | small | Beach Camp III | Twig-era lines ×1.5. | 22.2M | `sea_wall_4` | R7 |
| 9.2 | `tide_tables` | unlock | Tide Tables | A tide clock shows when the next three flotsam arrive, and what they are. | 33.3M | `cutting_torch_2` | R7 |
| 9.3 | `sea_wall_5` | small | Sea Wall V | All lines ×1.1. | 44.4M | `bottle_post` | R7 |
| 9.4 | `king_tide` | completion | King Tide | All lines ×1.2; the sea floods the low beach. | 55.5M | all of ring 8 | R7 (scene) |
| 9.5 | `relit_lighthouse` | notable | Relit Lighthouse | All lines ×1.1; the lighthouse on the far island burns again at night. | 77.7M | `auto_flare` | R7 (scene) |
| 9.6 | `weather_buoy` | unlock | Weather Buoy | A buoy shows the island's next 24 h of weather, so you can plan for rain. | 44.4M | `deep_nets_2` | R7 (scene) |
| 9.7 | `deep_nets_3` | small | Deep Nets III | Docks ×2. | 22.2M | `driftwood_4` | R7 |

**Glass per ring.** Ring 1: 4. Ring 2: 20. Ring 3: 190. Ring 4: 1,887. Ring 5: 23.3k. Ring 6:
266k. Ring 7: 2.33M. Ring 8: 31.1M. Ring 9: 300M. The sector costs about 333M, in line with 04 3.2's
ring totals divided by eight.

## 3. Rules behind the feature nodes and keystones

Eleven features, each budgeted in its phase.

**R2:** `lookout_post`.

**R3:**

- **Life Raft:**
  - "Top unmanned line" is the unmanned line that would earn most if manned.
  - The castaway mans it for 10 minutes of real time, offline included.
  - If every line is manned, he leaves a Drift Crate instead.
- **Drag Line:**
  - It holds only misses made while the page is open; it never fills while you are away.
  - One catch waits at a time. A later miss sinks as usual.
  - The waiting catch stays until tapped or the next nuke.
  - A waiting Fuel Drum or Adrenaline Kit starts its buff when tapped, so a player can set up the
    Rally × Adrenaline combo (02 8.1 wants that combo to be set up, never natural).
  - The advisor never crowns it.
- **Beachcomber's Net:** it catches Drift Crates only (buffs want the player). The client sends the
  ordinary `claim_flotsam`.

**R5:**

- **Flare Gun** (gate 15) follows 04 6.6: any shipped kind but the Sealed Locker and the Bottle.
  `05-meta-layers.md` 7 lists crate, drum and kit only. Either is a one-line data choice for the
  owner.
- `auto_flare` joins the data here (gate 15). It waits until nothing floats and uses the Flare
  Gun's choice.

**R7:**

- **Rogue Wave:** a tap target on the surf, not a Toolbelt button. It waits while anything floats.
- **Lost Cargo:** a 5-minute `line_cost` ×0.5 buff. Catching another restarts it; it never stacks.
- **Tide Tables:** natural arrivals only (not the Flare or the Rogue Wave). A mark moves if a
  purchase changes the schedule.
- **Weather Buoy:** reads `weatherAt` for the next 48 blocks, the same for every friend.
- **Wreckers' Moon:** see the keystone below.

**Scavenger's Eye** (5.3, targets the active player; conflicts with `bunker_mentality`).

- **Mechanics.** It sets the Fuel Drum to 98.5 and every other kind but the Sealed Locker to 0, so
  the Locker keeps exactly 1.5% and scrap does not move. Kinds not yet in `flotsam.json5` are inert.
  Registering all eight kind ids from R3 keeps the node's data unchanged when the drone, the bottle
  and the cargo ship, so no respec is needed.
- **Gain.** Estimated about ×1.1 on the active hour, the simulator row to confirm before R3. A
  player who spends everything sees crates pay near their 1-minute floor, while a drum is a 60 s
  Rally on the lines and on `p × fullRate` taps.
- **Cost.** The casual player's 10-minute check-in crates, and every Adrenaline Kit.

**Wreckers' Moon** (8.4, targets the casual player; conflicts with `bunker_mentality`).

- **Mechanics.**
  - One Drift Crate per full hour counted as away (from 6 minutes after the last command).
  - Never past the Night Shift window, and at most 12 per absence.
  - They lie on the shore as their own pile with its own drawing, apart from Blowback's.
  - The welcome-back card lists them, and Collect cracks them with the crate formula.
- **Gain.** Check-ins at 08:00, 13:00 and 21:00 bring about 24 crates a day at 10 minutes each,
  about 4 hours of output on top of a day's: an estimated ×1.15-1.2.
- **Cost.** The active player loses half of their online flotsam, about 11-14% of an active hour.

## 4. Open questions

1. **Tide's lines share.** This catalog uses `04-blast-map.md` 7.2 (×1.2, then ×1.5 a ring) as a
   trade under 10-balance 6.3. If the owner keeps 10-balance's split (no Tide `output`), these nodes
   need their value moved to zero-share scopes (Twig, Docks): Sea Wall I-V, Storm Harvest's rain
   part, Rain Barrels, Breakwater, Cutting Torch I-II, Tide Mill and Relit Lighthouse. King Tide's
   fixed ×1.2 would then also be over.
2. **Counting weights.** With 04 7.3's rough planning weights (any one line at a quarter), Deep
   Nets and Breakwater's Dock part would count ×1.25 each and put rings 6-9 near ×2. With
   10-balance 6.2.3's model shares (Docks 0), they are free. The content check should state which
   it uses. The fallback is a data change: Deep Nets becomes more Driftwood and Beach Camp (Twig).
3. **Rain float steps.** Storm Drift gives +3 s in rain at ring 4. That is the "+2-3 s" float step
   of rings 3-4 with `when: rain`; the step table's "rain +5 s" starts at ring 5. It passes the 10%
   rule at +10.3%.
4. **No Drowned Drone node.** Every vocabulary lever on the drone either raises payout (its effect)
   or lowers it. A drone on a random line pays about a twentieth of a crate, so more drones in
   place of crates is a loss, and float time is at its ceiling. If a drone node is wanted later, it
   should show the drone's line before you catch it (information). That needs a feature slot, and
   Tide's are all taken.
5. **Weight semantics.** 09 5.1 should state that added weight comes from the Drift Crate (the
   residual kind). Kind ids `life_raft` and `lost_cargo` equal their node ids, in different
   namespaces (`flotsam.*` against `node.*`).
6. **Rain on the lines.** `when: rain` output needs settle to split at 30-minute weather blocks.
   The Logbook's Weather Log needs the same from R2.

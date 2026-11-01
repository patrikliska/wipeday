# 04b Grip: "Your hands are the first machine" (proposal)

The 45 nodes of the Grip sector of the Blast Map. The data is `04b-grip.json`. Everything here is a
proposal: names need the owner's pass, and the simulator may move numbers in data. It follows
`04-blast-map.md` (slot template, sector brief 6.3, price ladder, waves), `10-balance.md` 6 (the
budget) and resolutions 1.5, 3.8, 3.9, 3.12 and 3.13.

## 1. The sector

Grip is taps, Hustle, crits, felling and Afterglow. It owns the whole tap budget of the tree, and
spends it in rings 1-4: Calloused Hands (taps +50%), Whetstone and Iron Palms (`p` +19%), Quick
Fingers (Hustle ×2.25) and Lucky Swing (crits +45%). From ring 5 nothing raises the steady tap
coefficient `c` (N9), so the outer rings do two things:

- **Make tapping feel better.** Hustle holds longer, drains slower and fills faster (Steady Breath,
  Slow Burn, Rhythm), until Muscle Memory reaches every Hustle limit at ring 9.
- **Turn the wipe-day rush into a whole run.** Tap hard in the first minutes and keep it: the 20th
  fell drops a Golden Chip (lines ×1.5 for the run), each fell stacks a log on the Woodpile, a run
  with 50 fells hangs a trophy. Afterglow itself grows: Work Song and Long Dawn hold it at ×3,
  Afterburn stretches it, Masks On and Green Sky run the lines harder under the green sky, and
  Clear-Cut halves the taps a fell needs while it lasts.

Two keystones bend the rules for the active player: **Wipe Day Rush** (anchor, Afterglow ×5 for an
hour, Night Shift halved) and **Fever Pitch** (Hustle peaks at ×6, but it holds 1.5 s less and
drains three times as fast: stop for breath and it is gone).

The ladder (ring 1 at the bottom; `S` small, `N` notable, `K` keystone, `U` unlock, `A`
automation, `C` completion; default wiring of `04` 1.3):

```
r9  Rh6  MusMem  GS2  [IRON GRIP]  Rh7  TrophyRack  GS3     C needs all of ring 8
r8  HG2  HG3  Clear-Cut  <FEVER PITCH>  Apprentice  HG4  HG5
r7  LongDawn  Rh4  SB3  Rh5  GS1  Woodpile
r6  SBr4  HairTrigger  Rh2  SB2  GoldenChip  Rh3
r5  HG1  WorkSong  <WIPE DAY RUSH>  MasksOn  SBr3
r4  ToolRack  SB1  [IRON PALMS]  SBr2  Afterburn            C needs all of ring 3
r3  SBr1  LuckySwing  HeavyHaft  Rh1
r2  Whetstone  QuickFingers  KeepSwinging
r1  SecondWind  CallousedHands
    (SBr Steady Breath, SB Slow Burn, Rh Rhythm, HG Hard Graft, GS Green Sky)
```

Left flank: lines (Hard Graft) and the Afterglow hold (Long Dawn). Centre: the keystones and the
Hustle feel. Right flank: the fell unlocks (Golden Chip, Woodpile, Trophy Rack) and the Afterglow
line bonuses. Path examples: Lucky Swing from nothing is 3 nodes for 83 glass (Calloused Hands,
Quick Fingers, Lucky Swing); Wipe Day Rush from nothing is 10 nodes for 8,562 glass.

**Quotas** (`04` 2.2): 24 small, 10 notable, 2 keystone, 3 unlock, 4 automation, 2 completion = 45.
**Scene-changing nodes:** Whetstone (rings 1-3); Work Song, Masks On, Golden Chip (rings 4-6);
Woodpile, Apprentice, Trophy Rack (rings 7-9). **Series:** Steady Breath I-IV (`hustle_hold`),
Slow Burn I-III (`hustle_drain`), Rhythm I-VII (`hustle_gain`), Hard Graft I-V (`output`), Green
Sky I-III (`output` while Afterglow lasts); one-offs `steady_hands` and `quick_fingers` keep their
legacy perk ids.

Checked by script over the data: ring sizes and slot types match the template; `requires` matches
the default wiring; no chain has three small nodes in a row, and no two consecutive smalls share a
series; every price is on the ladder; every small passes the 10% rule; every ceiling below holds;
only unlock, automation and keystone nodes use `feature:<id>`; non-small texts are at most 80
characters.

## 2. Budget tracking

### 2.1 Grip's own columns (`10-balance.md` 6.1 and 6.3)

| Ring | `tap` budget / used | `tap_share` (`p`) budget / used | `hustle_max` budget / used | Crits budget / used | Fells | Steady `c` after the ring |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ×1.5 / ×1.5 (Calloused Hands) | – | – | – | – | 0.288 |
| 2 | – | ×1.10 / ×1.10 (Whetstone, +0.16%) | +0.25 / +0.25 (Quick Fingers) | – | – | 0.356 |
| 3 | – | – | – | +45% / +45% (Lucky Swing) | Heavy Haft: `c` ×1.019 | 0.527 |
| 4 | – | ×1.09 / ×1.085 (Iron Palms, +0.15%) | – | – | – | **0.572** |
| 5-9 | – | – | – | – | Clear-Cut only while Afterglow lasts (a burst, outside `c`) | 0.572 |
| **Tree** | **×1.5 / ×1.5** | **×1.2 / ×1.194** | **×2.25 / ×2.25** | **+45% / +45%** | **≤ ×1.07 / ×1.019** | **≤ 0.6 / 0.572** |

`c = 6 taps/s × p (0.0191 at Power Tools) × T (1.5) × Hustle (2.25) × crit (1.45) × fell
(1.019)`. Heavy Haft is the only node past the anchors that raises `c` (by 1.9%, the 10-balance 6.6
allowance for a fell node); it moves N9's weighted hour from about 2.95 to 2.97.

### 2.2 The lines share (`04` 7.2: Grip ×1.15 in ring 5, ×1.5 in each of rings 6-9)

| Ring | Share | Nodes, as counted (`04` 7.3, `10-balance.md` 6.2) | Product | Cumulative / budget |
| --- | --- | --- | --- | --- |
| 1-4 | – | none | ×1.000 | ×1.00 / ×1.00 |
| 5 | ×1.15 | Hard Graft I ×1.12; Masks On ×2 while Afterglow lasts (×1.020) | **×1.142** | ×1.142 / ×1.150 |
| 6 | ×1.5 | Golden Chip ×1.5 (at its cap) | **×1.500** | ×1.714 / ×1.725 |
| 7 | ×1.5 | Woodpile ×1.4 (cap, 20 logs); Green Sky I ×1.25 while Afterglow lasts (×1.010) | **×1.414** | ×2.423 / ×2.588 |
| 8 | ×1.5 | Hard Graft II-V ×1.1 each | **×1.464** | ×3.547 / ×3.881 |
| 9 | ×1.5 | Trophy Rack ×1.2 (cap, 5 trophies); Iron Grip ×1.2; Green Sky II-III ×1.25 while Afterglow lasts (×1.027) | **×1.479** | **×5.247 / ×5.822** |

- **Afterglow-only effects** count at `04` 7.3's weight 0.02 on the combined factor `A` (the
  product of every "while Afterglow lasts" line effect owned): a ring counts `(0.98 + 0.02 ×
  A_after) / (0.98 + 0.02 × A_before)`. `A` is 2 after ring 5, 2.5 after ring 7, 3.9 after ring 9.
- **Run-long bonuses** count at their cap (`04` 7.3). The caps sit inside a casual player's first
  check-in of a run (N16): at 4 taps a second for 5 minutes, 1,200 taps make 12-37 fells (32-96
  taps a fell with Heavy Haft), so Golden Chip (20 fells) and the Woodpile's 20 logs both land in
  it, sooner with Clear-Cut; 50 fells (a trophy) come on the casual's first day of a run.
- **The trade.** `10-balance.md` 6.3 gives Grip no `output` share; `04` 7.2 gives Grip ×1.15 and
  ×1.5, taken from Works, Crew, Logbook, Bunker and Scrapyard. Both rows keep the ring products
  (`04`: ×10.2 and ×1,014; `10`: ×9.96 and ×986), which 10-balance 6.3 allows ("two sectors may
  trade shares inside a ring if the ring's product holds; `04b` records the trade"). This catalog
  follows `04` 7.2 and uses 90% of it (×5.25 of ×5.82); the unused ×1.11 can go back to Works.

### 2.3 Capped, unbudgeted pools (`04` 4.2), cumulative after each ring

| Ring | `hustle_hold` (2 → ≤ 6 s) | `hustle_drain` (10 → ≥ 5 a second) | `hustle_gain` (1 → ≤ 3) | `afterglow_hold` (0 → ≤ 120 s, best set) | `afterglow_half` (Grip's part of the shared +600 s) |
| --- | --- | --- | --- | --- | --- |
| 1 | 3.0 (Second Wind) | 8.0 (Second Wind) | 1.0 | 0 | 0 |
| 2 | 3.0 | 8.0 | 1.0 | 0 | 0 |
| 3 | 3.5 | 8.0 | 1.25 | 0 | 0 |
| 4 | 4.5 (Iron Palms +0.5) | 7.2 | 1.25 | 0 | +120 (Afterburn) |
| 5 | 5.0 | 7.2 | 1.25 | 60 (Work Song) | +120 |
| 6 | 5.5 | 6.48 | 1.75 | 60 | +120 |
| 7 | 5.5 | 5.83 | 2.25 | 120 (Long Dawn) | +120 |
| 8 | 5.5 | 5.83 | 2.25 | 120 | +120 |
| 9 | **6.0** (Muscle Memory) | **5.25** (Iron Grip) | **3.0** (Muscle Memory) | **120** | **+120** |

With the whole sector a full Hustle meter lasts 6 + 100 / 5.25 = 25 s after the last tap, and fills
in 34 taps. Blast's Souvenir Jar and Warm Embers keep +480 s of the shared half-life ceiling.

### 2.4 Keystones (outside the shares; keystone rule, resolution 3.13)

| Keystone | Gain | Cost | Targets | Simulator row must show |
| --- | --- | --- | --- | --- |
| Wipe Day Rush (5.3, 7,777, anchor) | Afterglow ×5, held 60 min, then the normal fade: about 90 min of "while Afterglow lasts", so Masks On and Green Sky run that long too | Night Shift window ×0.5 | active | about ×1.05-1.1 for the active player with Masks On owned (`10-balance.md` 6.5 estimates ×1.05 without it); the casual loses nights. Conflicts: Hot Core |
| Fever Pitch (8.4, 7.77M) | Hustle peaks at ×6 (×6.25 with Quick Fingers): taps ×2.78 at full Hustle, `c` 0.57 → 1.59 while tapping | hold −1.5 s, drain ×3: any pause past the hold empties a full meter in 4-6 s | active | about ×1.05-1.08 a day for the active archetype (online income is about 12% of its day); the cost needs a pause model (open question 3). Synergy: Lone Wolf |

## 3. The nodes

| Slot | Id | Type | Name | Effect | Glass | Requires | Wave |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `second_wind` | notable | Second Wind | Hustle holds 3 s (was 2) and drains 20% slower | 2 | `ground_zero` | R2 |
| 1.2 | `steady_hands` | small | Calloused Hands | Taps +50% (anchor) | 1 | `ground_zero` | R2 |
| 2.1 | `whetstone` | notable | Whetstone | Taps carry +0.16% of supplies/s; a whetstone by the target throws sparks (scene) | 11 | `second_wind` | R2 |
| 2.2 | `quick_fingers` | small | Quick Fingers | Hustle tops out at ×2.25 (was ×2) | 5 | `second_wind`, `steady_hands` | R2 |
| 2.3 | `keep_swinging` | automation | Keep Swinging | Unmanned lines keep running while Hustle is above zero, not just while you tap | 7 | `steady_hands` | R2 |
| 3.1 | `steady_breath_1` | small | Steady Breath I | Hustle holds +0.5 s | 33 | `whetstone` | R2 |
| 3.2 | `lucky_swing` | notable | Lucky Swing | 5% of your taps crit for ×10 (anchor) | 77 | `whetstone`, `quick_fingers` | R2 |
| 3.3 | `heavy_haft` | notable | Heavy Haft | Fells need 20% fewer taps | 55 | `quick_fingers`, `keep_swinging` | R2 |
| 3.4 | `rhythm_1` | small | Rhythm I | Hustle +0.25 a tap | 44 | `keep_swinging` | R2 |
| 4.1 | `tool_rack` | automation | Tool Rack | Grip rungs buy themselves the moment you can afford them (page open) | 333 | `steady_breath_1` | R3 |
| 4.2 | `slow_burn_1` | small | Slow Burn I | Hustle drains 10% slower | 222 | `steady_breath_1`, `lucky_swing` | R3 |
| 4.3 | `iron_palms` | completion | Iron Palms | Taps carry +0.15% more of supplies/s; Hustle holds 0.5 s longer | 555 | all of ring 3 | R3 |
| 4.4 | `steady_breath_2` | small | Steady Breath II | Hustle holds +0.5 s | 333 | `heavy_haft`, `rhythm_1` | R3 |
| 4.5 | `afterburn` | notable | Afterburn | Afterglow's half-life 5 → 7 min | 777 | `rhythm_1` | R3 |
| 5.1 | `hard_graft_1` | small | Hard Graft I | All lines ×1.12 | 3,333 | `tool_rack` | R3 |
| 5.2 | `work_song` | notable | Work Song | Afterglow holds its full ×3 for the first minute; the crew sing while you work (scene) | 5,555 | `slow_burn_1` | R3 |
| 5.3 | `wipe_day_rush` | keystone | Wipe Day Rush | Afterglow holds ×5 for 60 min, then fades. Night Shift window ×0.5 (anchor) | 7,777 | `iron_palms` | R3 |
| 5.4 | `masks_on` | notable | Masks On | All lines ×2 while Afterglow lasts; the crew work on in gas masks (scene) | 7,777 | `steady_breath_2` | R3 |
| 5.5 | `steady_breath_3` | small | Steady Breath III | Hustle holds +0.5 s | 2,222 | `afterburn` | R3 |
| 6.1 | `steady_breath_4` | small | Steady Breath IV | Hustle holds +0.5 s | 22,200 | `hard_graft_1` | R3 |
| 6.2 | `hair_trigger` | automation | Hair Trigger | Rush fires itself the moment Hustle fills (page open) | 33,300 | `hard_graft_1`, `work_song` | R5 |
| 6.3 | `rhythm_2` | small | Rhythm II | Hustle +0.25 a tap | 33,300 | `work_song`, `wipe_day_rush` | R3 |
| 6.4 | `slow_burn_2` | small | Slow Burn II | Hustle drains 10% slower | 22,200 | `wipe_day_rush`, `masks_on` | R3 |
| 6.5 | `golden_chip` | unlock | Golden Chip | A run's 20th fell drops a golden chip: all lines ×1.5 for the rest of the run (scene) | 44,400 | `masks_on`, `steady_breath_3` | R3 |
| 6.6 | `rhythm_3` | small | Rhythm III | Hustle +0.25 a tap | 33,300 | `steady_breath_3` | R3 |
| 7.1 | `long_dawn` | notable | Long Dawn | Afterglow holds its full ×3 for the first 2 minutes | 555,000 | `steady_breath_4` | R7 |
| 7.2 | `rhythm_4` | small | Rhythm IV | Hustle +0.25 a tap | 222,000 | `hair_trigger` | R7 |
| 7.3 | `slow_burn_3` | small | Slow Burn III | Hustle drains 10% slower | 333,000 | `rhythm_2` | R7 |
| 7.4 | `rhythm_5` | small | Rhythm V | Hustle +0.25 a tap | 333,000 | `slow_burn_2` | R7 |
| 7.5 | `green_sky_1` | small | Green Sky I | All lines ×1.25 while Afterglow lasts | 444,000 | `golden_chip` | R7 |
| 7.6 | `woodpile` | unlock | Woodpile | Each fell this run stacks a log by the cabin: all lines +2% a log, up to +40% (scene) | 444,000 | `rhythm_3` | R7 |
| 8.1 | `hard_graft_2` | small | Hard Graft II | All lines ×1.1 | 3.33M | `long_dawn` | R7 |
| 8.2 | `hard_graft_3` | small | Hard Graft III | All lines ×1.1 | 4.44M | `long_dawn`, `rhythm_4` | R7 |
| 8.3 | `clear_cut` | notable | Clear-Cut | While Afterglow lasts, fells need half the taps | 5.55M | `rhythm_4`, `slow_burn_3` | R7 |
| 8.4 | `fever_pitch` | keystone | Fever Pitch | Hustle peaks at ×6, not ×2; it holds 1.5 s less and drains ×3 as fast | 7.77M | `slow_burn_3`, `rhythm_5` | R7 |
| 8.5 | `apprentice` | automation | Apprentice | While the page is open and you aren't tapping, an apprentice taps once a second (scene) | 3.33M | `rhythm_5`, `green_sky_1` | R7 |
| 8.6 | `hard_graft_4` | small | Hard Graft IV | All lines ×1.1 | 4.44M | `green_sky_1`, `woodpile` | R7 |
| 8.7 | `hard_graft_5` | small | Hard Graft V | All lines ×1.1 | 3.33M | `woodpile` | R7 |
| 9.1 | `rhythm_6` | small | Rhythm VI | Hustle +0.25 a tap | 22.2M | `hard_graft_2` | R7 |
| 9.2 | `muscle_memory` | notable | Muscle Memory | Hustle holds 0.5 s longer and fills 0.25 a tap faster (the tree's limits) | 44.4M | `hard_graft_3` | R7 |
| 9.3 | `green_sky_2` | small | Green Sky II | All lines ×1.25 while Afterglow lasts | 33.3M | `clear_cut` | R7 |
| 9.4 | `iron_grip` | completion | Iron Grip | All lines ×1.2; Hustle drains 10% slower | 55.5M | all of ring 8 | R7 |
| 9.5 | `rhythm_7` | small | Rhythm VII | Hustle +0.25 a tap | 22.2M | `apprentice` | R7 |
| 9.6 | `trophy_rack` | unlock | Trophy Rack | Each run with 50+ fells hangs a trophy: all lines +4% a trophy, up to +20% (scene) | 33.3M | `hard_graft_4` | R7 |
| 9.7 | `green_sky_3` | small | Green Sky III | All lines ×1.25 while Afterglow lasts | 44.4M | `hard_graft_5` | R7 |

Sector cost: rings 1-3 235 glass, ring 4 2,220, ring 5 26.7k, ring 6 189k, ring 7 2.33M, ring 8
32.2M, ring 9 255M; 290M for the whole sector (in line with `04` 3.2's per-sector shares).

## 4. Features (new code, by phase)

| Feature | Node | Phase | What it needs |
| --- | --- | --- | --- |
| `keep_swinging` | Keep Swinging | R2 | the taps transport (`09` 6.3 step 7): an unmanned line may start cycles until the batch's Hustle reaches zero, in closed form from `hustle` at `to` |
| `autobuy` (scope `grip`) | Tool Rack | R3 | a visible tab sends `buy_upgrade` for the next Grip rung when it is affordable; one feature with Works' Standing Orders (scope `line_mk`) |
| `golden_chip` | Golden Chip | R3 | the taps batch sets `run.goldenChip` at the run's 20th fell and registers `when: golden_chip`; the chip is a show (no claim, so no `pokes`, which arrive in R4) |
| `hair_trigger` | Hair Trigger | R5 | a visible tab sends `use_tool rush` when Hustle reaches 100 and Rush is ready (`05` 7) |
| `woodpile` | Woodpile | R7 (in data from R3) | a run fell counter `run.fells` (the Logbook's fell pages want it too); registers `per: logs` |
| `apprentice` | Apprentice | R7 | a visible tab adds one tap a second to the taps queue after 3 s without a tap; same bucket, same batch |
| `trophy_rack` | Trophy Rack | R7 | `meta.trophies` +1 at a nuke (Wipe Day or small blast) when the run had 50 or more fells, counted from the purchase; registers `per: trophies` |

## 5. Changes from `04`'s Grip brief, and why

1. **Iron Palms holds +0.5 s, not +1 s,** so Steady Breath IV still adds 10% (5.0 → 5.5 s) and
   Muscle Memory ends the hold exactly at the 6 s ceiling.
2. **Iron Grip drains 10% slower, not 20%,** so three Slow Burns fit above the 5-a-second floor
   (10 × 0.8 × 0.9³ × 0.9 = 5.25).
3. **Hustle series capacity.** `04` asks for Hustle smalls in every ring (about 17), but the three
   ceilings and the 10% rule allow 14 (4 hold, 3 drain, 7 gain). The other smalls are Hard Graft
   (one in ring 5, four in ring 8, as `04`) and a new Green Sky series (lines ×1.25 while
   Afterglow lasts), which is Grip's own theme and nearly free in the budget.
4. **Quick Hands becomes Rhythm,** so the series cannot be confused with Quick Fingers.
5. **`second_breath` becomes Long Dawn (`long_dawn`)** (Second Wind is kept; three "Second ..."
   names would blur), and **`in_the_zone` is dropped**: the gain ceiling (1 → 3) is spent on
   Rhythm I-VII and Muscle Memory; a conditional +1 would cut Rhythm to four.
6. **New notables:** Masks On (5.4), Clear-Cut (8.3), Muscle Memory (9.2).
7. **Golden Chip is granted at the 20th fell** rather than by tapping the chip, so it ships in R3
   without `pokes` (R4). The chip still flies, glints and pins itself over the cabin door.
8. **Woodpile:** +2% a log up to +40% (20 logs), not +1% up to +50% (50 logs). 50 logs is more
   than a casual makes in a day (N16), and ring 7 keeps room for Green Sky I.
9. **Trophy Rack:** 50 fells a run (20 is trivial with Clear-Cut), +4% a trophy up to +20% (five
   runs, about three weeks for a casual), so ring 9 stays inside its share with Iron Grip.
10. **Fever Pitch** prints "holds 1.5 s less" (`add −1.5`) rather than "holds 0.5 s": the fold
    adds node seconds after any `set`, so an absolute 0.5 s cannot be printed truthfully. At the
    base hold it is 0.5 s.
11. **Hair Trigger** carries no node `gate`: ring 6's gate (Wipe Day #20) is above Rush's #4, and
    check 15 wants a node gate at or above its ring's. It joins the data in R5; its slot is
    reserved in R3-R4. Rhythm IV (7.2) waits behind it, which check 3 allows for a hidden wave-3 node.

## Open questions

1. **Feature-registered conditions.** Golden Chip, Woodpile and Trophy Rack write their payoff as
   data (`when: golden_chip`, `per: logs`, `per: trophies`) so the budget check reads them. `09`
   5.1 should register these ids with their features; the alternative is to hard-code the numbers
   in the features.
2. **Afterglow-only effects** (Masks On, Green Sky, Clear-Cut) are counted at `04` 7.3's 0.02 and
   left to the simulator's N11, as `10-balance.md` 6.2 says. Two follow-ups: the Wipe Day Rush row
   must include them (its Afterglow lasts about 90 minutes); and `09` 5.5's upper-bound test must
   measure `c` outside bursts, or Clear-Cut's `fell_taps` ×0.5 fails it (`c` would read 0.62).
3. **Fever Pitch's cost needs pauses.** The model's Hustle "never lapses mid-session", so the
   drain and hold downsides cost nothing there. Its simulator row needs a pause model (for example
   a 3 s pause every 30 s for buying and flotsam). Also confirm a negative `add` on `hustle_hold`
   is fine on a keystone (`09` 5.1: "keystones carry their printed downsides").
4. **`tap_flat`.** `10-balance.md` 6.1 and 6.6 suggest a `tap_flat` series for Grip; `04` 4.2 says
   "no node". This catalog uses none. If R3 wants faster run openings from taps, a Strong Wrists
   series on `tap_flat` could replace Green Sky.
5. **Apprentice** keeps Hustle full at one tap a second (taps come inside the hold), so an idle
   online hour gains about 9.5% (lowering N9's ratio, about +1% overall at `online`'s weight
   0.1). Unbudgeted automation; the simulator should measure it.
6. **The idler** taps only while nothing runs by itself, so it never earns the fell bonuses. It
   reaches about 14 Wipe Days in a year (`10-balance.md` 4.7) and never opens ring 6 (#20), so
   N16 is unaffected today; it matters if the agenda's ring gates move.

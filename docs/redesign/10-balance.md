# 10. Balance: the numerical model, tuned constants and the simulator v2

Status: proposal, revised 2026-10-08 against canon v2. P1, the tuned parameter set of the first
version of this section, is canon (resolutions 1-2). This revision re-runs the model with the
inputs the resolutions added, revises the Blast Map budget for resolution 3.8, adds a lockstep
group simulation, and restates the scorecard. Everything still waits for the owner's approval
(amendment A3). Changes of canon that the numbers call for are under "Open questions".

The model lives in `docs/redesign/working/model/`.
Paths below are relative to that folder. `python -I run_v2.py` regenerates every canon v2 table
in about four and a half minutes on 28 workers; `run_all.py` still regenerates P1's.

| File | What it is |
| --- | --- |
| `wipe_model.py` | the model: run economy, taps, flotsam and weather, Night Shift, prestige, Late Tide, Blowback, Blast Map budget, meta layers, archetypes |
| `configs.py` | `CANON` (canon v1 constants), `PROPOSAL` (P1 as first published), `V2` (P1 with the resolutions' rules and budget) and `V2_ALONE` (no friends) |
| `group.py` | the lockstep group simulation: friends on one clock, Late Tide and Blowback from their Wipe Days |
| `run_v2.py`, `v2_stages.py` | every canon v2 table (`out/report_v2.txt`, `out/v2_extra.txt`); each resolution's effect alone (`out/v2_stages.txt`) |
| `run_all.py`, `horizon.py`, `late_wall*.py`, `elasticity.py`, `n9_*.py`, `literal.py` | P1's tables and the experiments that found its levers |

---

## 1. Summary

- **Canon v1's constants run away.** The active first nuke comes at 22 minutes, nukes cascade, and
  at day 30 the optimal player has 287,000 times the casual player's glass. The cause is
  measurable (section 3). **P1 fixes it in data** and is now canon: a fifth-root glass formula
  with `L0` 5e5, output ×4.75 per rung, lean taps and flotsam, ranks ×2 that rise together, the
  20-hour crown, the Foreman's reserve and Late Tide ×3.
- **This revision adds what the resolutions changed:** the 1-minute crate floor, run 1's flat
  crate at 3:00 (modelled at 10 minutes; 2 minutes by errata E1), Afterglow from the first tap,
  rain in 20% of the day (flotsam ×1.5), Late Tide over the other active players and capped at
  the median, Blowback from friends' counted Wipe Days, Morale out of the Logbook's wave-1 rings, shelf and era cost columns, and 04's
  automation slots. It reports two profiles: a player **alone**, and a **group of five** (idler,
  casual, active, optimal, late joiner) in lockstep, plus pairs.
- **Passes:** N1-N8, N12-N15, N21 and N23; N9 on the weather-weighted hour (2.95); N16 in every
  group (five players at days 30/90: active 1.06/1.17, optimal 1.34/1.50, idler 0.67/0.98); N17
  for two players (9-12 days); N19's averages.
- **Moved, and settled by errata v3:** run 1's 3:00 crate pays a flat 2 minutes, so Sorting Tables
  comes at 3:01, Stone at 4:30 and the first nuke at about 46-48 minutes (E1); a rain hour is 3.42×
  an idle hour, a warning (E13); alone, the idler's doubling sawtooth dips to 0.41-0.45 of the
  casual, a warning (E11); N17 takes 12-14 days in a group of five, a warning (E16); the casual
  makes 24-25 Wipe Days by day 30 alone and 20-22 in groups, inside the new 20-40 band (E14); in a
  group that starts together, Late Tide lifts the casual's first week to about 10k glass, and the
  first-week band is asserted alone (E14); single 7-day scrap windows reach 2.57 (active) and 3.14
  (optimal), a warning (E15). Only the late wall stays open (section 10).
- **The budget (section 6) is authoritative,** per ring, per column and per sector, with counting
  rules. 04's draft catalog is far over it in taps, flotsam, glass and offline output (6.6).
- **The late wall stays** (section 5): casual runs of about 4.5 days in months 2-6 and about 10
  days after; 47% of the tree lit at day 180, 57% at day 365. The group simulation now rules out
  option 3: with ×3,000 outer rings the optimal player reaches 5.2× the casual by day 365 even with
  Late Tide.

---

## 2. The model

### 2.1 What it implements

| Canon part | Model |
| --- | --- |
| 14 lines (4.2) | `c_i = 6·16^(i−1)`, `r_i = 1.5·4.75^(i−1)`, `t_i = 0.6·2^(i−1)`, `g_i = 1.15 − 0.006(i−1)`, hand `300·c_i`; buy-k in closed form |
| Milestones (4.3) | ×2 at 10 and 100, speed ×2 at 25 and 50, ×3 at 200 and 300, ×4 at 400, ×2 every 100 after, ×5 at 1,000; roster ×2/×2/×3 at 25/100/250 of every unlocked line, kept for the run once reached (resolution 3.4) |
| Shelf and eras (4.4) | Grip 60/6k/6M/6B (each ×2 base tap and +p), Line Mk II/III ×3 at base×1e4/1e8 (25/50 owned), island upgrades ×2 at 1e6…1e34, eras ×2 at 1.5k/3M/20B/400T, Armored from Wipe Day #2 |
| Taps (4.5) | `(2^grip·fold + p·fullRate)·T·Hustle·crit·fell·Afterglow·buffs` (09 5.2); the fold is eras, island upgrades, roster, Grit, Glow and Morale (errata E23); Hustle +1 per tap to 100; a fell pays 10 taps per 40-120; one-second batches |
| Unmanned lines (4.5) | credited only while tapping, one cycle in flight per line, through a busy-until time (resolution 3.3) |
| Flotsam (4.6) | every 4-10 min while tapping, ×1.5 as often in rain; all six kinds at canon weights, caught every time; run 1's first at 3:00 is a crate paying a flat 10 min of output in these tables (2 min in the game, errata E1); crates pay `max(1 min, min(15% of held, 10 min))` of output |
| Weather | rain in 20% of 30-minute blocks, seeded once for the island (resolution 3.17); fog changes nothing |
| Night Shift (4.8) | manned lines at 100% offline, inside 12 h + Deep Cellars 4 h + Wipe Day #10's 4 h + Bunker hours, cap 48 h |
| Prestige (5.1) | `G = floor((L/5e5)^(1/5))`; gain = level delta × glass multipliers, then Late Tide; Glow `1 + 0.25√(glass ever)`; first nuke at 10 |
| Afterglow (5.6) | taps `1 + 2·2^(−t/300 s)` from the run's first tap (resolution 3.2) |
| Agenda (5.8) | rings at Wipe Days 1/1/3/5/10/20/30/40/50; hands 1-3 kept at 3; Rush/Grit/Flare at 4/8/15; Foreman at 7/20; Night Shift +4 h at 10 |
| Blast Map (6) | 361 nodes, ring sizes 2…7 per sector, costs log-spread in canon's bands (notables ×2, keystones ×3), bought cheapest first; each ring's budget (section 6) arrives in proportion to the glass spent in it |
| Logbook, scrap, ranks (7) | entries `37·ln(1 + 2·days)` of the player's own play (cap 250); Morale `1 + 0.02·entries`; Magnet 1 scrap per 23-24 h (10% rich), +1 per 25 entries, Freighter 2 tiers a week in a group, Sealed Locker 1.5% of flotsam (1% in the game, errata E15; its effect is in 4.8), 3 for the first Wipe Day; ranks 1/2/4/8/16 scrap, ×2 each, rising together |
| Toolbelt (7.6) | Rush at each chance while tapping, Grit at check-ins (8 h cooldown, 10 stacks), Flare at session start |
| Social (8) | **Group:** Late Tide ×3 below half the median glass ever of the other players active in the last 14 days, never past that median; Blowback 3 crates per friend's counted Wipe Day, at most 9 waiting, claimed at check-ins. **Alone:** neither, and no Freighter |

### 2.2 Archetypes (canon 13.9) and their policies

| Archetype | Sessions | Taps | Nuke rule | Other policy |
| --- | --- | --- | --- | --- |
| idler | 08:00 and 21:00, 3 min | 4/s only while nothing runs by itself (resolution 3.30) | gain ≥ glass ever (canon); the crown as a variant | ranks rise together; Freighter 1 tier a week; Magnet 24 h |
| casual | 08:00, 13:00, 21:00, 5 min | 4/s | the crown (resolution 1.9) | |
| active | 07, 09, 12, 15, 17, 19, 21, 23 h, 10 min | 6/s | the crown | |
| optimal | every hour, 5 min | 6/s | best timing: nuke when this interval's glass rate falls below the run's average and the nuke counts | |
| late joiner | casual from day 30 | 4/s | the crown | |
| first hour | one 3-hour session | 6/s | the crown | the canon 4.9/4.10 scenario |
| autoclicker | one 3-hour session | 15/s (the bucket) | the crown | N2's floor |

**Buyer:** greedy best payback with waiting. Every purchase (one unit, units to the next
milestone, a hand, a unit plus its hand, a shelf item, an era) scores
`wait until affordable + cost / added income`. The player buys the best score when it is
affordable and otherwise saves. Added income for an unmanned line counts only the share of the
day the player taps (casual 1%, active 5.6%, optimal 8.3%); a hand counts the rest.

**Profiles.** *Alone* runs each archetype by itself: the economy without friends, and the profile
for N1-N15. *G5* runs the five archetypes in lockstep on one clock: each check-in first reads the
World inputs, as the server's settle does (13.6). *Pairs* run the casual with one other archetype:
season 1's group is two players. Group tables use seeds 7, 11 and 23 and give geometric means.

### 2.3 What the model simplifies or assumes

Each of these could move a number by tens of percent. None of them changes a conclusion.

- Archetypes are mechanical: fixed sessions, every flotsam caught, no misclicks, no days off.
- The Blast Map is a budget, not a catalog: no paths, adjacency or sector choices. Keystones,
  Dares, Pockets, hand traits and Visit are not played.
- Kits, kept hands and starts arrive at fixed points (6.4).
- Logbook entries follow the formula above for everyone, scaled by idler 0.75, active 1.1,
  optimal 1.15. A late joiner logs at the same pace from its own day 1; shared first finds would
  speed it up.
- No archetype ever presses a small blast: every crown rule needs a counting nuke, so Wipe Days
  and nukes are the same count here.
- Crits are an average multiplier. Hustle builds at the tap rate and never lapses mid-session.
- **Combined power per nuke (N12)** is the income of the finished island with the meta before and
  after the nuke (Glow, tree output, Morale, ranks). Kits, taps, cost cuts and starts show in N11.

---

## 3. Canon v1 constants: what the model showed

From P1's first run, with every canon v1 number and P1's tree budget. Re-run under the canon v2
rules and budget, the same constants still give 113,000× between the active and casual players at
day 30 (section 8).

| Measure | Canon v1 constants | Target |
| --- | --- | --- |
| First nuke, continuous 6 taps/s | 22:00 | N1 40-60 min |
| First nuke, 15 taps/s autoclicker | 13:30 | N2 ≥ 25 min |
| Supplies made at 10:00 of run 1 | 4.25B | canon 4.9: 31M |
| Casual day 3: glass / nukes | 233k / 9; four of runs 6-11 last 30 s to 2.5 min | 4.10: week 1 ends at 300-2,000 |
| Whole Blast Map lit | optimal day 12, active day 15, casual day 88 | N15 ≤ 45% at day 30 |
| Glass gap at day 30: active / optimal / idler vs casual | 65,937× / 287,352× / 0.01× | N16 ≤ 2 / ≤ 2.5 / ≥ 0.5 |
| Active hour vs idle online hour | 6.28× (taps alone 3.21×) | N9 1.5-3× |

The mechanism is in `elasticity.py`. It fixes the meta power and measures one casual day-run:

| Power multiplier | 1 → 1e2 | 1e2 → 1e4 | 1e4 → 1e6 | 1e6 → 1e8 | 1e8 → 1e10 | 1e10 → 1e12 |
| --- | --- | --- | --- | --- | --- | --- |
| Supplies per run ∝ power^β, β = | 3.86 | 1.91 | 1.69 | 1.46 | 1.27 | 1.18 |

Early in the game a little power buys a lot of lifetime, because rungs, eras, island upgrades and
milestones are still ahead. With `G ∝ L^(1/3)` and Glow ∝ √G, the loop gain exceeds 1 and nukes
cascade. Late in the game the same formula stalls. The exponent is the strongest lever (section 8).

---

## 4. P1 under canon v2: results

### 4.1 The constants and the new inputs

P1's levers, adopted by resolutions 1.1-1.9 (the "why" is the evidence):

| Lever | Canon v1 | P1 (canon v2) | Why |
| --- | --- | --- | --- |
| Output ratio per rung (`lines.json5`) | ×5.5 | **×4.75** | N1: continuous first nuke 22:00 → 48:00 (46:00 with v2's crates and the 2-minute run-1 crate, errata E1) |
| p per Grip rung | 1% | **0.4%** | N8/N9: canon p with full Hustle makes taps 28% of run-1 income from minute 10 |
| Hustle ceiling with Grip nodes | ×5 | **×2.25** | N9: ×5 more than doubles the steady tap coefficient (0.56 → 1.25) |
| Rush / Rally / Adrenaline | ×10 / ×6 / ×300 | **×5 / ×4 / ×100** | N9 |
| Drift Crate cap | 15 min of output | **10 min** (1-min floor) | N9 |
| Glass formula | cube root, `L0` 1e8 | **fifth root, `L0` 5e5** | the early runaway; 10 glass at 50B; the casual nukes at 21:00 on 12 of 12 seeds |
| Glow factor `k` | 0.25 | 0.25 | unchanged; it trades the idler against the active players (section 8) |
| Crew ranks | ×3, free order | **×2, rising together** | rank focus is the optimal player's biggest lead |
| Crown (advisor 5.2) | doubling, or < 80% of peak and ≥ 10% | **also: counts and the run is 20 h old** | the canon rule gives 15-16 casual nukes by day 30 and late runs of 8-9 days |
| Late Tide | ×2 below 50% of the median | **×3**, over the others, never past the median | N17 |

The new "Base /s" column (×4.75 per rung): 1.5, 7.13, 33.8, 161, 764, 3.63k, 17.2k, 81.9k, 389k,
1.85M, 8.78M, 41.7M, 198M, 941M.

What each canon v2 input does on its own, from P1 as published (`v2_stages.py`; seed 11,
archetypes alone with P1's 9 Blowback crates a day; gaps at days 30/90):

| Input (resolution) | N1 | Casual glass d7 / d30 / d90 | Active gap | Optimal gap | Idler gap |
| --- | --- | --- | --- | --- | --- |
| P1 as published | 48:00 | 1,104 / 43.7k / 246k | 1.42 / 1.36 | 1.92 / 1.59 | 1.00 / 0.71 |
| Crate floor 1 min (1.6) | 47:00 | 1,107 / 43.7k / 247k | 1.43 / 1.37 | 1.97 / 1.54 | 1.00 / 0.71 |
| Run 1's 3:00 crate, flat 10 min (1.6; 2 min by errata E1) | 47:00 | unchanged | unchanged | unchanged | unchanged |
| Afterglow from the first tap (3.2) | 48:00 | unchanged | unchanged | unchanged | unchanged |
| Rain 20% (3.17) | 48:00 | 1,104 / 42.4k / 259k | 1.50 / 1.34 | 2.02 / 1.49 | 1.03 / 0.68 |
| All rules together | 44:30 | 1,105 / 42.4k / 259k | 1.61 / 1.30 | 2.02 / 1.49 | 1.03 / 0.68 |
| + Morale out of rings 1-3 (3.8) | 44:30 | 955 / 37.3k / 218k | 1.68 / 1.43 | 2.23 / 1.76 | 0.81 / 0.56 |
| + Logbook history output, rings 2-3 | 44:30 | 1,106 / 39.0k / 266k | 1.74 / 1.38 | 2.06 / 1.69 | 1.13 / 0.68 |
| + shelf and era cost columns (= canon v2) | 44:30 | 1,029 / 54.5k / 279k | 1.34 / 1.26 | 1.59 / 1.61 | 0.79 / 0.62 |
| 04's automation slots instead of P1's | identical to day 180 | | | | |

### 4.2 Run 1 (continuous play, 6 taps/s)

| Moment | Canon v1 script | P1 (resolution 3.29) | Canon v2 |
| --- | --- | --- | --- |
| First Beachcomber / Stone Tools / 10 Beachcombers | 0:05 / 0:12 / 0:25 | 0:02 / 0:08 / 0:12 | 0:02 / 0:08 / 0:12 |
| Timber era (1.5k) / first hand (Mara) | 2:00 / 1:42 | 0:36 / 0:41 | 0:36 / 0:41 |
| Second hand (bulk toggle) | 3:18 | 1:30 | 1:30 |
| First flotsam | 3:00 | 3:00 (any kind) | 3:00, a crate paying 2 min of output (errata E1) |
| Sorting Tables (1M) / Stone era (3M) | 6:42 / 8:42 | 4:50 / 6:22 | **3:01 / 4:30** |
| Supplies made at 10:00 | 31M | 374M | 963M (10-min crate) |
| The Kettle's pad (3e7 in resolution 3.5; 5e8 by errata E2) | minute 10 | 7:56 (3e7) | 8:34-10:28 over 12 seeds (5e8) |
| Yield 1 / yield 5 glass | about 13 min / n/a | 2:55 / 13:16 | 2:55 / 12:21 |
| 5th hand / Sheet Metal era (20B) | by 18 / 38 min | 9:36 / 45:46 | 8:12 / 42:38 |
| Flotsam caught before the nuke | 6-8 | 8 | 7 |
| **First nuke (10 glass)** | **40-60 min** | **48:00** | **46:00** (about 46-48 min, errata E1) |

The rows marked "10-min crate" and the yield, 5th-hand and flotsam rows were measured with the
flat 10-minute crate; simulator v2 re-measures them with the 2-minute crate (errata E1). With the
10-minute crate, over 12 seeds the continuous first nuke fell between 40:00 and 46:00 (median
44:30, 50.7B made); the autoclicker's between 32:30 and 39:30 (median 38:00). The casual player
nukes at the day-1 21:00 check-in on 12 of 12 seeds, with 10-11 glass.

The flat 10-minute crate paid 7.6M at 3:00 against 0.55M made so far, which bought Sorting Tables
and the Stone era in the same moment and passed a 3e7 pad at 4:25. The settled 2-minute crate keeps
them apart (Sorting Tables 3:01, Stone 4:30, first nuke 46:00; errata E1), as 02-the-run.md found.
The Kettle's pad appears at **5e8** lifetime in run 1 (8:34-10:28 over 12 seeds with either
crate) and from the start of later runs; the pad and its locked card ship in R2 (errata E2).

### 4.3 First nukes and purchase cadence (N1-N7)

| Archetype (alone) | First nuke (wall) | Online before it | Glass |
| --- | --- | --- | --- |
| first hour (6/s) | 46:00 (2-min crate, errata E1; 44:30 with 10 min) | 46:00 | 10 |
| autoclicker (15/s) | 37:00 (10-min crate) | 37:00 | 10 |
| active | 12:00 day 1 (3rd session) | 20 min | 14 |
| optimal | 03:00 day 1 (4th hourly session) | 15 min | 11 |
| casual | 21:00 day 1 | 10 min | 11 |
| idler | 21:00 day 2 | 12 min | 10 |

The first hand comes at 0:41 (N4 ≤ 2 min). N2 is read on the wall clock: the active archetype
nukes after 20 online minutes, but 5 hours after its first tap.

| Cadence | Canon v2 | Target |
| --- | --- | --- |
| Longest online stretch with nothing affordable, runs 1-5 | 1-8 s | N5 (amended) ≤ 30 s, N6 ≤ 120 s: pass |
| Longest gap between the greedy buyer's purchases, first 10 online min of runs 1-5 | 62-239 s | information only |
| Casual check-ins (days 1-30) with at least one purchase | 84 of 90 (93%) | N7 (amended) ≥ 90%: pass |

The empty check-ins are midday check-ins when the best purchase is hours away. The Foreman's
Collect pass fills some of them; without its reserve (resolution 1.10) it costs the optimal and
idler players about half their glass (section 8).

### 4.4 Taps (N8) and the active hour (N9)

| Tap share | Canon v2 | N8 (amended) |
| --- | --- | --- |
| Run 1, minute 0-1, tap-driven (taps plus unmanned lines) | 55% (direct 19%) | ≥ 50%: pass |
| Run 1, from minute 10, outside bursts, direct | 14% | 5-25%: pass |
| Runs 2-5, outside bursts, direct | 20-26% | n/a |

**Active hour vs idle online hour** (the active archetype's state at its first session on days
14, 30 and 60; six flotsam seeds; idle means the page is open with no taps and no flotsam; the
three days give the same ratios):

| Part of the active hour | Clear or fog | Rain | Weather-weighted (80/20) |
| --- | --- | --- | --- |
| Taps, Hustle and Rush only | 1.73× | 1.73× | 1.73× |
| Plus flotsam (all kinds) | 2.83× | **3.42×** | **2.95×** (N9 1.5-3: pass) |
| Same at the casual's 4 taps/s | 2.49× | 3.03× | 2.60× |
| Tap share outside bursts / flotsam share | 38% / 22% | 38% / 28% | |

Rain is new in canon v2 and makes N9 the tightest number in the game: 2% of headroom on the
weighted hour, and a rain hour above 3×. No single lever brings a rain hour to 3× (rain ×1.25:
3.17; Rally ×3: 3.28; crates capped at 8 min: 3.23; Adrenaline ×50: 3.28). N9 is asserted on the
weather-weighted hour and rain hours are a warning (errata E13). N9 binds the
Grip and Tide sectors hardest of all (section 6).

### 4.5 Runs 1-10 per archetype (alone, seed 11) and run-to-run speed (N11)

N11 is the time run N+1 needs to pass run N's supplies, as a share of run N's duration.

| Run | Casual: length / gain / glass ever / N11 | Active: length (online) / glass ever / N11 | Optimal: length (online) / glass ever / N11 | Idler: length / glass ever / N11 |
| --- | --- | --- | --- | --- |
| 1 | 13 h / 10 / 10 / – | 5 h (20 m) / 12 / – | 3 h (15 m) / 11 / – | 37 h / 10 / – |
| 2 | 16 h / 17 / 27 / 0.74 | 5 h (20 m) / 29 / 0.28 | 6 h (30 m) / 51 / 0.49 | 35 h / 30 / 0.50 |
| 3 | 24 h / 37 / 64 / 0.55 | 6 h (30 m) / 67 / 0.41 | 22 h (1h50) / 691 / 0.50 | 37 h / 68 / 0.55 |
| 4 | 24 h / 61 / 125 / 0.77 | 13 h (30 m) / 150 / 1.39 | 15 h (1h15) / 2,646 / 0.23 | 2.0 d / 182 / 0.80 |
| 5 | 24 h / 140 / 265 / 0.79 | 7 h (30 m) / 301 / 0.31 | 16 h (1h20) / 4,955 / 0.35 | 2.0 d / 410 / 0.62 |
| 6 | 24 h / 348 / 613 / 0.44 | 14 h (40 m) / 710 / 0.58 | 27 h (2h15) / 8,318 / 0.62 | 2.5 d / 1,036 / 0.73 |
| 7 | 24 h / 305 / 918 / 0.81 | 10 h (50 m) / 1,423 / 0.44 | 26 h (2h10) / 10.6k / 0.58 | 2.5 d / 2,111 / 0.64 |
| 8 | 24 h / 206 / 1,124 / 0.89 | 17 h (40 m) / 2,957 / 1.17 | 32 h (2h40) / 12.7k / 0.75 | 2.5 d / 5,472 / 0.59 |
| 9 | 24 h / 374 / 1,498 / 0.82 | 19 h (1 h) / 5,544 / 0.35 | 2.3 d (4h35) / 18.3k / 0.63 | 3.5 d / 12.1k / 0.74 |
| 10 | 24 h / 1,663 / 3,161 / 0.79 | 14 h (1 h) / 6,777 / 0.59 | 2.9 d (5h45) / 34.4k / 0.52 | 5.5 d / 25.8k / 0.59 |

The casual player nukes once a day at a fixed check-in, so N11 is quantised: run N+1 passes run
N at its second or third check-in. The idler's doubling rule makes its runs grow to about 10 days
by day 26 and 20 days by day 35.

### 4.6 Per-nuke steps by phase (N11-N14)

Early is runs 1-5, mid is later runs that end by day 30, late is days 31-180. Power is the
geometric mean of the per-nuke output power. Alone, seed 11:

| Archetype | Phase | Nukes | Power per nuke | N11 median | Run length median | Nodes per nuke (median) |
| --- | --- | --- | --- | --- | --- | --- |
| casual | early / mid / late | 5 / 19 / 27 | 1.60 / 1.24 / 1.20 | 0.77 / 0.82 / 0.86 | 24 h / 24 h / 4.5 d | 8 / 3 / 2 |
| active | early / mid / late | 5 / 22 / 25 | 1.63 / 1.24 / 1.21 | 0.41 / 0.79 / 0.85 | 6 h / 26 h / 4.2 d | 9 / 3 / 2 |
| optimal | early / mid / late | 5 / 9 / 17 | 2.43 / 1.35 / 1.37 | 0.49 / 0.63 / 0.72 | 15 h / 2.9 d / 7.1 d | 19 / 5 / 2 |
| idler | early / mid / late | 5 / 5 / 4 | 1.68 / 2.01 / 2.62 | 0.62 / 0.64 / 0.43 | 37 h / 2.5 d / 38.5 d | 9 / 14 / 13 |

| Number (amended, resolution 2) | Target | Canon v2 | Verdict |
| --- | --- | --- | --- |
| N11 | ≤ 65% / 95% / 100% (medians), warn-only until R7 | casual 0.55-0.77 / 0.75-0.82 / 0.78-0.86 (seeds 7 and 11); active and optimal inside | casual early warns on seed 11 |
| N12 | ×1.5-2.5 / ×1.15-1.6 / ×1.1-1.5 | casual, active, optimal inside (seed 11; the casual also on seed 7 and in G5: 1.92 / 1.26 / 1.32) | pass |
| N13 | 5-nuke product < ×1.3 with nothing opening in 3 → fail | 0 alarms | pass |
| N14 | 6-10 at the first nuke; later median ≥ 2 | 8-9; 2-3 | pass |

The month-1 cadence (20-40 Wipe Days by day 30, P1's figures replacing canon 4.10's; errata E14, E26)
and N15 together cap the per-nuke step near
×1.2-1.3 mid-game, which is why resolution 2 amended N11-N14.

### 4.7 Glass ever, the tree and the gaps (N15, N16)

Cells read glass ever / Wipe Days / share of the tree lit; geometric means over seeds 7, 11, 23.

| Profile | Archetype | Day 7 | Day 30 | Day 90 | Day 180 | Day 365 |
| --- | --- | --- | --- | --- | --- | --- |
| alone | idler | 227 / 4 / 11% | 35.5k / 10 / 33% | 145k / 12 / 40% | 366k / 13 / 42% | 581k / 14 / 42% |
| alone | casual | 1,050 / 7 / 17% | 41.6k / 24 / 34% | 238k / 41 / 43% | 594k / 50 / 47% | 3.87M / 69 / 57% |
| alone | active | 10.8k / 12 / 28% | 68.6k / 27 / 36% | 336k / 43 / 44% | 801k / 52 / 48% | 6.11M / 73 / 60% |
| alone | optimal | 14.2k / 9 / 29% | 77.3k / 15 / 37% | 403k / 25 / 45% | 985k / 32 / 49% | 6.84M / 50 / 60% |
| G5 | idler | 807 / 4 / 16% | 43.2k / 8 / 31% | 293k / 11 / 42% | 600k / 12 / 42% | 1.21M / 13 / 42% |
| G5 | casual | 10.4k / 8 / 27% | 64.2k / 21 / 36% | 298k / 36 / 43% | 716k / 45 / 47% | 4.76M / 64 / 58% |
| G5 | active | 10.9k / 12 / 28% | 68.3k / 28 / 36% | 348k / 44 / 44% | 830k / 53 / 48% | 6.29M / 74 / 60% |
| G5 | optimal | 13.3k / 9 / 29% | 85.9k / 17 / 37% | 447k / 27 / 45% | 1.13M / 35 / 50% | 7.69M / 52 / 61% |
| G5 | late joiner | – | 21 / 1 / 4% | 257k / 25 / 43% | 663k / 35 / 47% | 4.72M / 55 / 58% |

| Gap vs casual (N16) | Day 30 | Day 90 | Day 180 | Target |
| --- | --- | --- | --- | --- |
| G5, Late Tide on: active / optimal / idler | 1.06 / 1.34 / 0.67 | 1.17 / 1.50 / 0.98 | 1.16 / 1.58 / 0.84 | ≤ 2 / ≤ 2.5 / ≥ 0.5: pass |
| G5, Late Tide off | 1.62 / 1.90 / 0.94 | 1.34 / 1.68 / 0.63 | 1.33 / 1.66 / 0.49 | pass at days 30 and 90 |
| Pairs, Late Tide on: casual with active / optimal / idler | 1.15 / 1.14 / 0.77 | 1.18 / 1.15 / 0.56 | 1.25 / 1.45 / 0.79 | pass |
| Alone (no friends to compare to) | 1.65 / 1.86 / 0.85 | 1.42 / 1.70 / 0.61 | 1.35 / 1.66 / 0.62 | pass on the means |

**The idler's sawtooth.** The idler doubles its glass at each nuke, days apart, so its ratio to
the casual swings between about 0.45 and 1.0 (`idler_saw.py`). The lowest value in days 25-35
and 85-95 is 0.48 / 0.53 in G5 with Late Tide, 0.52 / 0.52 in the pair, and 0.45 / 0.41 alone.
Alone, seed 11 reads 0.46 at day 90 itself. N16 is asserted in the group of five with Late Tide;
the solo gaps and the doubling idler's trough are warnings, and the late idler gaps are asserted
for an idler following the crown (errata E11).

**Late Tide in a starting group.** Five friends who start the same day split fast: by day 3 the
active and optimal players have 20-80× the casual's glass (alone, seed 11). In G5 Late Tide then
pays the casual and the idler ×3 from their first Wipe Days, so the casual's first week ends at
about 10k glass instead of 1k, and its month at 20-22 Wipe Days instead of 24-25 (a larger glass
ever needs a larger gain to count). The day-30 tree is about the same (36% against 34%). That is
catch-up working. The month-1 band becomes 20-40 Wipe Days by day 30, and the first-week band is
asserted alone (errata E14); R0's rewrite replaces canon 4.10's figures with P1's (errata E26).

**N15:** the optimal player has 36-37% of the tree at day 30 in every profile (≤ 45%: pass) and
60-61% at day 365, so the full tree is never lit in the first year (pass). The casual player has
47% at day 180 (the 45% warning holds).

**Blowback in a real group.** The P1 model gave every player 9 crates a day. In G5 the casual
claims 5.1 crates a day in month 1 and 1.6 a day over 180 days; with one active friend 2.6 and
0.8; with one optimal friend 1.1 and 0.4 (seed 7). Blowback moves the gaps by about as much as
seed noise (section 8).

### 4.8 Late joiner, scrap, magnitude (N17, N19, N23)

| Late joiner (casual from day 30): days to reach the day-30 casual's glass ever (seeds 7 / 11 / 23) | Days |
| --- | --- |
| Pair with the casual, Late Tide ×3 below 50%, never past the median (canon v2) | **12 / 9 / 10** (N17 ≤ 12: pass) |
| G5, canon v2 | 14 / 12 / 13 (2 of 3 seeds over; a warning, errata E16) |
| G5, ×3 below 75% of the median | 12 / 11 / 11 |
| G5, no Late Tide | 33 / 31 / 30 |
| Alone against the casual's curve (P1's method): ×3 / ×2 below 50% / no Late Tide | 9 / 14 / 31 |

Capping the bonus at the median changed no day count in the runs checked. In G5 the joiner reaches
half the others' median in about 8 days; Late Tide then stops, and the last half comes at the
normal mid-game pace of about 10% a Wipe Day.

**Scrap (N19 as amended: a 7-day average from day 2, the first Wipe Day's 3 excluded).** Alone has
no Freighter; G5 has 2 tiers a week (1 for the idler).

| Profile, archetype | 7-day average: mean / 90th percentile / highest | By day 30 (+3 one-off) | By day 180 |
| --- | --- | --- | --- |
| alone, casual | 1.30 / 1.57 / 2.14 | 47 | 236 |
| alone, active / optimal | 1.56 / 2.00 / 2.57; 1.72 / 2.14 / 2.57 | 51; 45 | 285; 302 |
| G5, casual | 1.55 / 1.86 / 2.43 | 54 | 291 |
| G5, active / optimal | 1.75 / 2.00 / 2.57; 1.98 / 2.43 / 3.14 | 50; 55 | 311; 354 |
| G5, Sealed Locker 1% (the game's weight, errata E15): casual / active / optimal | 1.52 / 2.00; 1.66 / 2.29; 1.83 / 2.86 (mean / highest) | | |

The averages pass (casual 0.8-2, at least 25 by day 30, nobody above 2.5). Single windows do not:
one rich haul in ten pays 2-3, and the weekly Freighter lands in one window, so a lucky week
reaches 2.4-3.1. N19 asserts the averages; single 7-day windows are warnings (errata E15). Ranks reach 4-5 on every hand by day 180, so maxing all 14
(434 scrap) takes seven to nine months, as resolution 1.7 says. Under ×2 ranks that is ×16-32 a
line; under ×3 it would be ×81-243.

**Magnitude (N23):** run 1 ends at 5.1e10-1.4e11 supplies made (N23 amended: 1e10-1e12). The
largest number is 7.2e34 by day 180 and 1.2e39 by day 365 (the optimal player in G5); every value
stayed finite. The whole tree's 3e9 glass ever needs 1.2e53 lifetime under the fifth root. Numbers
pass 1e36, where the formatter switches from Dc to scientific notation, in the second half-year.

### 4.9 Scorecard (canon v2 numbers)

| # | Target (as amended by resolution 2) | Canon v2 | Verdict |
| --- | --- | --- | --- |
| N1 | active first nuke 40-60 min | 46:00 with the 2-min crate (errata E1); 40:00-46:00 over 12 seeds with the 10-min crate | pass |
| N2 | ≥ 25 min, any archetype, wall clock | autoclicker 32:30-39:30 | pass |
| N3 | casual by the day-1 21:00 check-in | 12 of 12 seeds | pass |
| N4 | first hand ≤ 2 min | 0:41 | pass |
| N5 | nothing affordable ≤ 30 s, first 10 online min of runs 1-5 | ≤ 8 s | pass |
| N6 | online with nothing affordable ≤ 120 s | ≤ 8 s | pass |
| N7 | ≥ 90% of casual check-ins in days 1-30 buy something | 93% | pass |
| N8 | minute 0-1 tap-driven ≥ 50%; direct 5-25% from minute 10 | 55%; 14% | pass |
| N9 | active hour 1.5-3× an idle online hour | 2.95× weighted; 3.42× in rain | pass weighted; rain warns (errata E13) |
| N11 | ≤ 65% / 95% / 100% (warn-only until R7) | casual early 0.55-0.77 | warns on seed 11 |
| N12 | ×1.5-2.5 / ×1.15-1.6 / ×1.1-1.5 | inside | pass |
| N13 | 5-nuke product < ×1.3, nothing opening in 3 → fail | 0 | pass |
| N14 | 6-10 at the first nuke; later median ≥ 2 | 8-9; 2-3 | pass |
| N15 | optimal ≤ 45% at day 30; 100% not before day 90; casual ≥ 45% at day 180 (warning) | 36-37%; never in a year; 47% | pass |
| N16 | days 30, 90: active ≤ 2, optimal ≤ 2.5, idler ≥ 0.5 × casual | G5 1.06 / 1.34 / 0.67 and 1.17 / 1.50 / 0.98 | pass in groups; alone the idler's trough is 0.41-0.45, a warning (errata E11) |
| N17 | late joiner reaches the day-30 casual within 12 days | pair 9-12; G5 12-14 | pass for two players; G5 warns (errata E16) |
| N19 | casual 0.8-2 a day, ≥ 25 by day 30, nobody above 2.5 (7-day averages) | means 1.30-1.98; by day 30 47-54 | pass on means; single windows to 3.14 warn (errata E15) |
| N21 | fifth root, `L0` 5e5, Glow 1 + 0.25√G | as modelled | pass |
| N23 | run 1 ends at 1e10-1e12; < 1e150 over 180 days; finite | 5.1e10-1.4e11; 7.2e34 | pass |
| 4.10 | first week: nukes 2-8, glass 300-2,000, asserted alone (errata E14) | alone 7, 0.9-1.05k; G5 8, about 10k | pass |
| 4.10 | first month: 20-40 Wipe Days by day 30, casual (errata E14, E26) | alone 24-25; G5 20-22; pairs 19-25 | pass alone and in G5; pairs dip to 19 |

N10, N18, N20, N22 and N24-N27 are domain tests, data checks and the shots review (7.4).

---

## 5. The late wall (the main open problem)

From about day 100 the casual player's runs stretch. Under the fifth root a counting nuke needs
lifetime ×1.61 (10% more glass). The late economy's elasticity is about 1.2, so steady day-long
runs need output power ×1.45 per nuke. Glow adds ×1.05 per 10%; ranks and Morale saturate around
day 150; the rest must come from the ring being bought. Rings 6-9 at ×1,000 each come to ×1.15 per
node, and the casual player buys about two nodes per nuke. Canon v2 changes little here: casual
runs last about 4.5 days in months 2-6 and about 10 days after day 180.

365 days, seed 11, everything else canon v2; gaps at day 365 (the idler's is the bottom of a
sawtooth whose runs last months):

| Rings 6-9, each | Alone: casual lit / Wipe Days d180-365 / gaps active, optimal, idler | G5 with Late Tide: same |
| --- | --- | --- |
| ×30 | 50% / 7 / 1.15, 1.17, 0.39 | 50% / 6 / 1.07, 1.26, 0.90 |
| ×300 | 52% / 10 / 1.55, 2.33, 0.29 | 54% / 10 / 1.29, 2.07, 0.55 |
| **×1,000 (canon v2)** | **57% / 19 / 1.49, 1.61, 0.11** | **58% / 19 / 1.25, 1.58, 0.20** |
| ×3,000 | 62% / 28 / 2.42, 7.07, 0.04 | 65% / 29 / 2.21, 5.15, 0.07 |

Steady late runs need a loop gain near 1, and a loop gain near 1 amplifies any difference in
activity. Every row that keeps runs short splits the group; every row that keeps it together
walls. Late Tide lifts the players below half the median but cannot hold the optimal player.

**Options for R7** (rings 7-9 ship there; nobody reaches them before about day 150):

1. **Accept a slow outer tree.** Rings 7-9 become a year-long goal. The Crossing's trigger (canon
   9) moves from "70% lit" to "45% lit and N13 firing", so the second layer arrives around month
   4-6 as the release valve.
2. **Add a fair late power source** that grows with calendar time and is the same for every
   archetype, the way ranks and Morale are early: for example the deepening crater giving +x% per
   Wipe Day, capped per day. New mechanic, designed in 05-meta-layers.md.
3. **Stronger outer rings carried by Late Tide.** The group simulation rules it out: at ×3,000 the
   optimal player is 5.2× the casual at day 365 in G5.

Resolution 3.24 records the recommendation: option 1 for R3, option 2 designed and simulated
before R7, the owner deciding before R7. The simulator asserts the wall as a warning (7.4).

---

## 6. The Blast Map power budget (authoritative)

This section replaces 04-blast-map.md's provisional section 7. The `04b` writers split each ring
across the eight sectors with 6.3 and count every node with 6.2. Stat names are 09-architecture.md
5.1's.

### 6.1 The budget: what each ring may add when fully lit

Multiplicative columns are the product of all node effects in the ring; additive columns are sums.

| Ring (opens at Wipe Day) | `output` (lines, global) | `tap` (whole value) | Tap internals | `line_cost`, `hand_cost` (each) | `upgrade_cost` (per shelf kind) | `era_cost` | Flotsam | `night_shift` / `offline` | `glass_gain` | `glow_k` | `morale_per` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 (#1) | ×1.3 | ×1.5 | – | ×0.95 | ×0.85 | – | `flotsam_rate` ×1.05 | +4 h (Deep Cellars) / – | ×1.10 | – | – |
| 2 (#1) | ×1.54 | – | `tap_share` ×1.10; `hustle_max` +0.25 | ×0.90 | ×0.85 | – | `flotsam_effect` ×1.05 | – / – | ×1.05 | +0.01 | – |
| 3 (#3) | ×1.76 | – | crits +45% average (Lucky Swing) | ×0.90 | ×0.85 | – | – | +4 h / – | ×1.10 | +0.02 | – |
| 4 (#5) | ×2.0 | – | `tap_share` ×1.09 | ×0.85 | ×0.9 | ×0.9 | – | – / ×1.10 | ×1.10 | +0.02 | +0.005 |
| 5 (#10) | ×10 | – | – | ×0.85 | ×0.9 | ×0.9 | – | +4 h / ×1.10 | ×1.10 | +0.03 | +0.005 |
| 6 (#20) | ×1,000 | – | – | ×0.85 | ×0.9 | ×0.9 | – | +8 h / ×1.10 | ×1.10 | +0.03 | +0.005 |
| 7 (#30) | ×1,000 | – | – | ×0.85 | ×0.9 | ×0.9 | – | +4 h / ×1.10 | ×1.10 | +0.04 | +0.005 |
| 8 (#40) | ×1,000 | – | – | ×0.85 | ×0.9 | ×0.9 | – | +8 h / ×1.10 | ×1.10 | +0.04 | +0.005 |
| 9 (#50) | ×1,000 | – | – | ×0.85 | ×0.9 | ×0.9 | – | – / ×1.10 | ×1.10 | +0.05 | +0.005 |
| **Whole tree** | **×7.0e13** | **×1.5** | **p ×1.2, Hustle ×2.25, crit +45%** | **×0.29** | **×0.33** | **×0.53** | **×1.05 / ×1.05** | **32 h (12 + 4 + 32 = 48) / ×1.77** | **×2.25** | **0.25 → 0.49** | **0.02 → 0.05** |

Changes from P1's budget, all for resolution 3.8 (the Logbook's and Scrapyard's rings 1-3 hold only
R2 things): Morale per entry leaves rings 2-3 and arrives at +0.005 in each of rings 4-9 (the same
+0.03); rings 2-3's `output` rises from ×1.4 / ×1.6 to ×1.54 / ×1.76, the Logbook's history nodes
taking over the ×1.1 a ring that Morale gave; shelf and era costs become columns (Scrapyard's wave
1 is the shelf). Of four budgets compared over three seeds (`v2_seeds.py`), this one gave the
narrowest active and optimal gaps at day 30 with the casual's first week inside canon 4.10. Night Shift hours follow 04's window plan (+4, +4, +4, +8, +4, +8 in rings 1, 3,
5, 6, 7, 8); no archetype is away longer than 13 hours, so hours past Deep Cellars move no number.

Two hard limits sit across rings:

- **The steady tap coefficient** `c` (taps per second × p × Hustle × tap value × crits, at full
  Hustle, outside bursts) stays ≤ 0.6 at 6 taps/s with the whole tree (resolution 1.5, content
  check). The column values give 0.56. With rain, N9 binds first: the weighted hour is 2.95 at
  0.56, so **no Grip node past the anchors may raise `c` at all**. Grip's other nodes change how
  taps feel: `tap_flat`, Hustle hold, drain and gain, fell timing, Afterglow, hold-to-work.
- **Flotsam frequency and payout** add at most ×1.05 each over the whole tree, `rally_mult` and
  crate pay included. Tide nodes add kinds (at no more than the crate's expected value per catch),
  float time, warnings, catching, Flare choices and crates for check-ins.

**Price cut caps (errata E25).** Shelf and era price cuts are capped: `upgrade_cost` at ×0.25 per
shelf kind and `era_cost` at ×0.5 over the whole tree (the columns above stay inside both). The
simulator measures them before R3, each ring at the casual player's typical state while it buys
that ring: rings 1-3 in week 1 (runs ending in Sheet Metal), rings 4-5 from week 2 to about day
90, ring 6 from about day 90, rings 7-9 from about day 150 (Armored era, lines 13-14 carrying the
income, 6.2 rule 3).

### 6.2 Counting rules

1. **Cumulative, never earlier.** Through every ring `r`, a column's running product (or sum) may
   not exceed the budget's running total through `r`. Moving power to a later ring is allowed;
   moving it earlier is not (the early runaway). The content check allows +10% per ring. `inc`
   effects add inside `(1 + Σinc)` (09 5.2), so a ring's `inc` nodes count as the ratio of that
   sum with and without them, every lower ring owned (04's worked example 10.4).
2. **Conditions** count at these shares of the value (canon v2 model, mid-game; `pnpm sim` prints
   them):
   - `when: night` (about 19:10-05:30, the scene's night today): 0.4; in rings 1-3, 0.1 (in the
     first week income comes late in each day-long run);
   - `when: rain`: 0.2;
   - `offline`: the `offline` column first, then Bunker's `output` share at full value (offline
     is 85-99% of every archetype's supplies);
   - `when: online` (page open, not tapping): 0.1;
   - while tapping (`hustle_full`, Rush, Rally, Adrenaline): in the `tap` column, a "+v on lines
     while tapping" as `tap` ×(1 + 1.6v) (lines are 62% of an active hour outside bursts, taps
     38%). Afterglow-only effects are outside N9's hour; they count against N11 in the simulator;
   - `per` effects: at their `max`.
3. **Scopes** count at their share of line income. Mid-game (days 9-180, every archetype): line 14
   0.8, line 13 0.15, line 12 0.03, lines 1-11 0; the Armored era 0.97, Sheet Metal 0.03, earlier
   eras 0. In week 1 the casual's runs end in Sheet Metal (Radio Mast 0.58, Sheet Metal 0.83).
   Low-line and early-era nodes are free in the budget; they still pass the 10% rule and speed up
   run openings, which the simulator measures.
4. **Pays:** `milestone_x2` from 2 to x counts as `output` ×(x/2)³ (top lines own 300-500, past
   two or three ×2 milestones); `roster_x2` ×(x/2)²; `mk_mult` from 3 to x ×(x/3)²; `rank_mult`
   from 2 to x ×(x/2)⁵; `speed` on all lines as `output`.
5. **Felling:** a fell paying `b` taps every `F` counts as `tap` ×(1 + b/F) / (1 + 10/F) at the
   Armored target (F = 120).
6. **Starts, kits, kept hands and auto-buy** are not multipliers. They follow 6.4; one not listed
   there goes no earlier than the ring of its nearest row.
7. **Keystones** sit outside the budget under the keystone rule (6.5). Completions count in their
   ring. Glass and Glow nodes count in their own columns, never in `output`.

### 6.3 The per-sector split

Single-owner columns: `tap`, `tap_share`, `hustle_max`, crits and felling belong to **Grip**;
flotsam to **Tide**; `offline` and `night_shift` to **Bunker**; `glass_gain` and `glow_k` to
**Blast**; `morale_per` and `morale` to **Logbook**; `upgrade_cost` and `era_cost` to
**Scrapyard**; `line_cost` to **Works** and `hand_cost` to **Crew**, each up to the column. The
shared `output` column splits like this (the product across a row is the ring's budget):

| Ring | Works | Crew | Logbook | Bunker (night, rain, beyond `offline`) | Scrapyard (Mk, ranks) | Ring |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ×1.15 | – | ×1.13 | – | – | ×1.3 |
| 2 | ×1.2 | ×1.1 | ×1.17 | – | – | ×1.54 |
| 3 | ×1.5 | – | ×1.17 | – | – | ×1.76 |
| 4 | ×1.5 | ×1.1 | ×1.1 | ×1.1 | – | ×2.0 |
| 5 | ×2.8 | ×1.6 | ×1.4 | ×1.26 | ×1.26 | ×10 |
| 6, 7, 8, 9 (each) | ×22 | ×4 | ×2.8 | ×2 | ×2 | ×1,000 |

Grip, Tide and Blast take no `output`: their power is in their own columns. Two sectors may trade
shares inside a ring if the ring's product holds; `04b` records the trade. In rings 1-4 a share is
one or two nodes (the 10% rule still holds), so most early nodes are automation, unlocks, starts,
feel and scene changes. In rings 6-9 a sector has 6-7 nodes, so its large shares come from `more`
notables and completions; `inc` smalls add less as Σinc grows.

### 6.4 Automation and start-of-run schedule

The model places these at 04-blast-map.md's slots (bought in price order, so a node arrives when
that share of its ring is lit):

| Ring | Node (04 slot) | Effect | Ring share |
| --- | --- | --- | --- |
| 1 | Starter Kit (Works 1.1), Old Friends (Crew 1.1), Deep Cellars (Bunker 1.2) | 10 Beachcombers and 5 Campfires; Mara kept; +4 h | first 3 nodes |
| 2 | Tool Bag (Scrapyard 2.1) | start with Stone Tools | 25% |
| agenda #3 | | hands 1-3 kept | |
| 3 | Old Crew I (Crew 3.2), Iron Bag (Scrapyard 3.3), Prefab Walls (Works 3.3) | hands 1-6 kept; Iron Tools; Timber start | 25% / 50% / 75% |
| 5 | Old Crew II (Crew 5.2), Bigger Kit (Works 5.2), First Shelf (Scrapyard 5.4) | hands 1-10 kept; 25 / 25 / 10 of lines 1-3; Sorting Tables | 50% |
| 6 | Stone Foundations (Works 6.5) | Stone start | 75% |
| 7 | Old Crew III (Crew 7.1), Mk Kit (Scrapyard 7.1) | every hand kept; Line Mk II on lines 1-6 | 25% |
| 8 | Standing Crew (Crew 8.5), Power Kit (Scrapyard 8.5) | kept hands' lines start with 10; Salvaged Tools | 50% |

P1's schedule (a kit at ring 4, Stone start at 5, Old Crew III at 6, a Sheet Metal start at 7)
gives the same numbers to day 180 (`v2_stages.py`): starts are worth little once runs last a day,
and the casual player only enters ring 6 around day 90. Moving any row more than one ring earlier
needs a simulator run (P1 measured 10-30% on run lengths).

### 6.5 Anchor nodes and the keystone rule

| Anchor (resolution 3.13) | Counts as | Budget |
| --- | --- | --- |
| Calloused Hands (Grip 1), taps +50% | `tap` ×1.5 | all of ring 1's `tap` |
| Bigger Payload (Blast 1), +10% glass | ×1.10 | all of ring 1's `glass_gain` |
| Deep Cellars (Bunker 1), +4 h | +4 h | ring 1's hours |
| Lucky Swing (Grip 3), 5% of taps crit ×10 | crits +45% | all of ring 3's crits |
| Glow Lamp (Blast 3), k 0.25 → 0.27 | +0.02 | all of ring 3's `glow_k` |
| Union Rules (Works 4), ×2 milestones pay ×2.2 | `output` ×1.21-1.33 | inside Works' ring-4 ×1.5 |
| Lone Wolf (Crew 8, keystone), no hands, taps ×50 | ×1.6 for the active player, ×0.2 for the casual | keystone rule |
| Dead Hand (Blast 6), 22.2k | automation | none |

**Keystone rule:** a slotted keystone may at most double the income of the archetype it targets,
measured by the simulator, and must cost that archetype or another one at least as much elsewhere.
Wipe Day Rush (about ×1.05 for the active player) and Bunker Mentality (about ×1.47 for the casual)
fit by P1's estimates; every R3 keystone gets its simulator row before it ships.

### 6.6 04's draft catalog against the budget

04-blast-map.md's sector briefs (as drafted before this revision) put these nodes over budget.
`04b` fixes them, or trades shares (6.3) and records it.

| Node(s) | As drafted | Counts as | Budget | Fix |
| --- | --- | --- | --- | --- |
| Strong Wrists series; 04's `tap` ceiling ×200 | `tap` inc to ×13.75 | `tap` (the whole value, 09 5.1) ×13.75 | ×1.5 whole tree | write the series on `tap_flat` (first minutes of a run only) |
| `heavy_haft` | +5% of supplies/s per tap | `tap_share` ×4 | ×1.10 in ring 2 | cut, or `tap_flat` |
| `deep_cuts`, `in_the_zone`, Keen Eye | crits ×25, +5%, a crit series | crits | +45% is Lucky Swing | feel only |
| `whetstone` | a fell pays 25 taps | `tap` ×1.12 | none in ring 2 | a fell pays 12 (×1.02), or feel only |
| `work_song` | lines +50% while Hustle is full | `tap` ×1.8 | none | cut, or Hustle drains slower |
| `lucky_tide`, `crater_lake`, `rainmaker`, Sharp Lookout | flotsam ×1.25, ×1.25, ×2 in rain, a series | `flotsam_rate` | ×1.05 whole tree | one ×1.05 node; the rest float time and warnings |
| `rally_cry`, `salvage_eye`, `high_water`, `king_tide`, Rich Pickings | Rally ×8; crates 25% / 25 min; effects ×1.5, ×2 | `flotsam_effect` | ×1.05 whole tree | cut, or crates that wait for check-ins |
| `souvenir_jar`, `glass_garden`, `double_barrel`, `second_sun`; 04's ceiling ×8 | +2%/Wipe Day to +50%; ×1.25; ×1.25; ×1.5 | `glass_gain` | ×1.10 a ring, ×2.25 whole tree | the jar cosmetic; the rest +10% a ring |
| `tally_wall` | lines +4%/Wipe Day to +100% | `output` ×2 | Logbook ring 1 ×1.13 | +1% a Wipe Day to +13% |
| `personal_best` | lines ×2 once past the last run | about ×1.5 (the last 15-50% of a run) | Logbook ring 2 ×1.17 | +15% |
| `records_board`, `well_read` | +10%/record to +50%; +3%/Wipe Day to +150% | ×1.5; ×2.5 | Logbook ring 4 ×1.1 | +10%, or rings 6-9 |
| `pep_talk` | +3% per hand hired | ×1.42 at 14 hands | Crew ring 2 ×1.1 | +0.7% a hand, max +10% |
| `hiring_board`, `fair_wages`, `full_crew` | hands ×0.5, ×0.5, ×0.25 | `hand_cost` ×0.06 by ring 4 | ×0.65 by ring 4 | ×0.9 steps; Full Crew ×0.85 |
| `insulated_walls`, `snug`, `deep_sleep`, Night Rations | offline ×1.5, ×1.5, ×2, to ×3 | `offline` | none before ring 4; ×1.77 whole tree, plus Bunker's `output` share | ×1.1 at ring 4; completions within the share |
| `night_lamps` | lines +50% at night (ring 2) | ×1.05 | Bunker has no ring-2 share | +25% at night, ring 4 |
| `shop_floor` | all lines ×2 (ring 4) | ×2 | Works ring 4 ×1.5 with Union Rules | ×1.1, or ×2 in ring 6 |
| `scrap_heap` | shelf ×0.75 | `upgrade_cost` | ×0.85 a ring | ×0.85 |
| `spare_parts`, `brass_polish`, `yard_boss` | Mk ×4; ranks ×3.5; ×4 | `output` ×1.78; ×16; ×32 | Scrapyard ×1.26 (ring 5), ×2 (rings 8-9) | Mk ×3.35; ranks ×2.3 at most, both nodes together |

---

## 7. The simulator v2 (built in R0)

### 7.1 Shape

- `packages/sim` keeps its harness (manual clock, deterministic seeds, `pnpm sim`, `pnpm sim
  check`, the test in `sim.test.ts`, D56). It plays lifetimes through the real domain: `newRun`,
  settle, the `taps` command, `buy_line`, `hire_hand`, `buy_upgrade`, `buy_era`, `claim_flotsam`,
  `nuke`, `buy_node`, `collect`, `haul_magnet`, `rank_hand`, `use_tool`, `claim_blowback` and
  `load_freighter`. There is no second economy in the simulator: if a number differs from the
  game, the domain is wrong. `rtp.ts` and its test are removed with the casino.
- Archetypes and policies are those of 2.2, as data in `pacing.json5`. The buyer is the advisor's
  logic (12.5), shared from the domain so the crown and the simulator agree.
- Taps arrive as the client sends them: `taps` batches of up to 1 s and 30 taps through the token
  bucket. Flotsam arrives on the seeded schedule, weather from `island.json5`, and is claimed
  inside its 13 s window.
- **Profiles:** *alone* (each archetype by itself: no Blowback, Freighter or Late Tide); *G5*, the
  lockstep group (idler, casual, active, optimal, late joiner) ordered by session time, each
  settle copying the World inputs into `meta` (13.6): friends' counted Wipe Days past the Blowback
  cursor, the Late Tide median of the other players active in the last 14 days, the Island Count
  and the Freighter's loads; *pairs* (the casual with one friend).
- Output: `pnpm sim [days]` prints per-day and per-run tables per archetype (the shape of section
  4) and writes CSV to `var/sim/`; `pnpm sim levers` prints section 8's table; the scope shares of
  6.2 print with `--scopes`.

### 7.2 Metrics

Per run: start, end, online time, supplies made, glass gain (and Late Tide's part), glass ever,
Glow, tree output, Morale, ranks, power per nuke, N11 ratio, nodes bought, nodes lit, era reached,
hands, tap share (direct and tap-driven), flotsam caught and share, longest nothing-affordable
stretch, purchase times in the first 10 online minutes.

Per day: glass ever, Wipe Days, lit, scrap and its 7-day average, ranks, Blowback claimed, Night
Shift window, largest number. Per scenario: run-1 timeline marks (4.2), the active hour on days
14, 30 and 60 in clear weather and in rain (six flotsam seeds), late-joiner catch-up, group gaps
with Late Tide on and off, the idler's trough.

### 7.3 Determinism and runtime

- Seeds derive from `(archetype, run index, flotsam index)` through the domain's `rng`; weather
  from the island's seed. There is no `Date.now()` and no `Math.random`. The determinism test keeps
  its shape: every archetype for 7 days twice, deep-equal.
- **In `pnpm test`** (the `test` profile): 90 days, seed 11, the four archetypes alone, the
  first-hour and autoclicker scenarios, the late-joiner pair, and G5. Tap batches are 1 s in the first 10
  online minutes of a run and 5 s after; offline is closed form. **Budget: under 10 s** (errata E4), against
  about 1 s today (D56). If it grows past that, the horizon drops to 60 days before any assertion
  is weakened.
- **`pnpm sim check --full`** (outside `pnpm test`): 365 days, seeds 7, 11 and 23, alone, G5 and
  the pairs, the levers and CSV. It runs before every balance decision and before R2, R3 and R7
  ship.

### 7.4 `pacing.json5` v2 (draft)

```json5
// Targets the simulator asserts (`pnpm sim check`; the `test` profile runs inside `pnpm test`).
// Times are wall-clock from the player's first tap. "day N" is the N-th calendar day of play.
// Each target names the canon number it covers (canon.md section 15 as amended by resolutions.md
// section 2). `warn: true` prints WARN and does not fail the check (D25's pattern).
{
  profiles: {
    test: { days: 90, seeds: [11], alone: true, group: "g5" },
    full: { days: 365, seeds: [7, 11, 23], alone: true, group: "g5", pairs: true },
  },
  groups: { g5: ["idler", "casual", "active", "optimal", "lateJoiner"] },
  archetypes: {
    idler: { sessions: ["08:00+3m", "21:00+3m"], tapsPerSecond: 0, tapsWhileNothingRuns: 4, nuke: "double" },
    casual: { sessions: ["08:00+5m", "13:00+5m", "21:00+5m"], tapsPerSecond: 4, nuke: "crown" },
    active: {
      sessions: ["07:00+10m", "09:00+10m", "12:00+10m", "15:00+10m", "17:00+10m", "19:00+10m", "21:00+10m", "23:00+10m"],
      tapsPerSecond: 6,
      nuke: "crown",
    },
    optimal: { sessions: "hourly+5m", tapsPerSecond: 6, nuke: "best" },
    lateJoiner: { like: "casual", startDay: 30 },
    firstHour: { sessions: ["00:00+180m"], tapsPerSecond: 6, nuke: "crown" },
    autoclicker: { sessions: ["00:00+180m"], tapsPerSecond: 15, nuke: "crown" },
  },
  run1: {
    firstNukeMinutes: { firstHour: { min: 40, max: 60 }, anyArchetype: { min: 25 } }, // N1, N2
    casualFirstNuke: { day: 1, checkIn: "21:00" }, // N3
    firstHandMaxSeconds: 120, // N4
    tapDrivenShareFirstMinute: { min: 0.5 }, // N8: taps plus unmanned lines
    directTapShareFromMinute10: { min: 0.05, max: 0.25 }, // N8: outside bursts
    suppliesAtFirstNuke: { min: 1e10, max: 1e12 }, // N23
  },
  cadence: {
    nothingAffordableMaxSeconds: 30, // N5: first 10 online minutes, runs 1-5
    onlineNothingAffordableMaxSeconds: 120, // N6
    casualCheckInsWithPurchase: { min: 0.9, days: 30 }, // N7
  },
  activeHour: { days: [14, 30, 60], ratio: { min: 1.5, max: 3.0 }, weather: "weighted", rainMax: { max: 3.0, warn: true } }, // N9 (errata E13)
  runs: {
    archetypes: ["casual", "active", "optimal"], // alone
    passPreviousRun: { early: 0.65, mid: 0.95, late: 1.0, warn: true }, // N11
    powerPerNuke: { early: [1.5, 2.5], mid: [1.15, 1.6], late: [1.1, 1.5] }, // N12
    flattening: { window: 5, minProduct: 1.3, unlockLookahead: 3 }, // N13
    casualWipeDaysByDay30: { min: 20, max: 40 }, // canon 4.10 as replaced by P1's figures (errata E14, E26)
    casualFirstWeekGlass: { min: 300, max: 2000, profile: "alone" }, // canon 4.10; asserted alone (errata E14)
    casualRunDaysAfterDay30: { max: 3, warn: true }, // canon 5.7 late; canon v2: 4.5 (section 5)
  },
  tree: {
    nodesAtFirstNuke: { min: 6, max: 10 }, // N14
    laterNodesMedian: { min: 2 }, // N14
    optimalLitShareDay30: { max: 0.45 }, // N15
    fullTreeNotBeforeDay: 90, // N15
    casualLitShareDay180: { min: 0.45, warn: true }, // N15 warning; the late wall
  },
  gaps: { profile: "g5", days: [30, 90], activeMax: 2.0, optimalMax: 2.5, idlerMin: 0.5 }, // N16 (errata E11)
  gapsAlone: { days: [30, 90], activeMax: 2.0, optimalMax: 2.5, idlerMin: 0.5, warn: true },
  idlerTrough: { windows: [[25, 35], [85, 95]], min: 0.4, warn: true }, // the doubling sawtooth (errata E11)
  idlerLate: { profile: "g5", idlerNuke: "crown", days: [180, 365], idlerMin: 0.5 }, // N16 late (errata E11)
  lateJoiner: { profile: "pair", reachDay30CasualWithinDays: 12, g5Warn: true }, // N17 (errata E16)
  scrap: { average: "7-day from day 2, one-offs excluded", casualMean: [0.8, 2.0], casualByDay30: { min: 25 },
           anyMeanMax: 2.5, anyWindowMax: { max: 2.5, warn: true } }, // N19 (errata E15)
  magnitude: { max: 1e150 }, // N23
}
```

`pnpm sim check` also prints, as warnings, the late-run length, lit share at days 180 and 365,
the active and optimal gaps and the doubling idler's gap at days 180 and 365, and the group gaps with Late Tide off. The content test (not the
simulator) checks the Blast Map against section 6: per ring, column and sector, the running
product of node effects stays within the budget plus 10% under the counting rules of 6.2, `c ≤
0.6`, and every keystone has a simulator-measured keystone-rule row.

| Canon number | Asserted by v2 |
| --- | --- |
| N1-N9, N11-N17, N19, N23 | `pacing.json5` (above) |
| N10, N20, N22, N25 | domain tests (bucket, timers, 10% rule, batches) |
| N18, N21, N26 | content checks (Night Shift sums to 48 h, the prestige shape, ring bands and mix) |
| N24 | settle property tests |
| N27 | shots review |

---

## 8. Tuning levers and their effects

One change at a time from canon v2, a player alone, 180 days, seed 11 (`out/v2_extra.txt`). Gaps
are against the casual player at days 30/90. "Late run" is the casual's median run length after
day 30. The idler column swings ±50% with its sawtooth (4.7); read it across rows, not alone.
These runs use the flat 10-minute run-1 crate; the 2-minute crate (errata E1) moves the canon v2
first nuke to about 46:00.

| Lever | First nuke | Casual d30 / Wipe Days | Active gap | Optimal gap | Idler gap | Late run |
| --- | --- | --- | --- | --- | --- | --- |
| **canon v2** | 44:30 | 43.3k / 25 | 1.59 / 1.42 | 1.66 / 1.62 | 0.60 / 0.46 | 4.5 d |
| canon v1 run constants | 19:00 | 29.6B / 26 | 113,133 / 71.7 | 622,636 / 181 | 0.03 / 0.00 | 2.3 d |
| `L0` ×2 (1e6) | 50:00 | 30.2k / 22 | 1.69 / 1.51 | 2.08 / 2.17 | 0.91 / 0.72 | 5.0 d |
| exponent 1/4 (`L0` 5e6) | 44:30 | 36.5M / 29 | 165 / 1.54 | 1,544 / 1.69 | 0.04 / 0.00 | 2.0 d |
| exponent 1/3 (`L0` 5e7) | 44:30 | 403B / 37 | 2,381 / 1.35 | 3,053 / 1.47 | 0.00 / 0.00 | 1.8 d |
| k 0.15 | 44:30 | 23.9k / 26 | 2.30 / 1.98 | 2.93 / 2.52 | 1.15 / 0.83 | 4.0 d |
| k 0.35 | 44:30 | 55.2k / 24 | 1.37 / 1.25 | 1.53 / 1.62 | 0.84 / 0.65 | 4.5 d |
| output ×5.0 per rung | 36:00 | 63.7k / 22 | 1.37 / 1.37 | 2.18 / 1.67 | 0.62 / 0.47 | 4.8 d |
| output ×4.5 per rung | 52:30 | 19.6k / 25 | 2.11 / 1.63 | 3.21 / 2.59 | 0.88 / 0.62 | 4.7 d |
| ring 5 ×15 | 44:30 | 43.6k / 25 | 1.66 / 1.33 | 1.67 / 1.54 | 0.59 / 0.36 | 3.7 d |
| rings 1-4 ×2 each | 44:30 | 73.4k / 24 | 1.37 / 1.35 | 1.98 / 1.50 | 0.66 / 0.48 | 4.5 d |
| ranks ×3, rising together | 44:30 | 71.3k / 23 | 1.43 / 1.38 | 2.22 / 1.76 | 0.81 / 0.43 | 4.0 d |
| ranks ×2, focus allowed | 44:30 | 43.3k / 25 | 1.59 / 1.42 | **4.94 / 3.04** | 0.60 / 0.46 | 4.5 d |
| crown canon v1 (80% of peak only) | 44:30 | 52.2k / **16** | 1.44 / 1.22 | 1.37 / 1.35 | 0.49 / 0.38 | **7.8 d** |
| crown "any 10%" | 44:30 | 36.8k / 33 | 1.79 / 1.51 | 1.95 / 1.73 | 0.70 / 0.49 | 4.5 d |
| Night Shift base 8 h | 44:30 | 43.3k / 25 | 1.59 / 1.42 | 1.66 / 1.62 | **0.48** / 0.72 | 4.5 d |
| era costs ×3 | 45:00 | 36.6k / 24 | 1.92 / 1.74 | 2.22 / 1.87 | 1.10 / 0.82 | 4.5 d |
| milestones 200-400 at ×2 | 44:30 | 27.6k / 24 | 1.85 / 1.42 | 2.31 / 1.90 | 0.86 / 0.91 | 7.0 d |
| Morale 1% per entry | 44:30 | 19.1k / 26 | 2.82 / 1.91 | 3.19 / 2.33 | 0.96 / 1.11 | 4.0 d |
| Blowback 9 crates a day | 44:30 | 43.8k / 25 | 1.58 / 1.32 | 1.86 / 1.74 | 0.51 / 0.71 | 4.5 d |
| p 1% per Grip rung | 37:00 | 45.9k / 24 | 1.50 / 1.35 | 1.91 / 1.80 | 0.56 / 0.43 | 5.0 d |
| canon v1 flotsam and Rush | 40:30 | 45.3k / 25 | 1.55 / 1.32 | 2.06 / 1.87 | 0.57 / 0.42 | 4.0 d |
| no rain | 44:30 | 36.5k / 24 | 1.67 / 1.62 | 2.33 / 1.98 | 0.71 / 0.53 | 4.5 d |
| Foreman pass without the reserve | 44:30 | 45.3k / 26 | 1.49 / 1.35 | **0.87 / 1.42** | **0.47 / 0.38** | 5.0 d |
| optimal awake 07-23 only | | | | 1.59 / 1.59 | | |

How to read it when tuning:

- **The exponent** sets the whole curve's stability. Above 1/5 the early game runs away and the
  group splits by thousands. It is the last lever to touch.
- **Output per rung** sets N1 (±0.25 moves the first nuke by about 8 minutes) and the gaps.
- **`L0`** moves the casual's first nuke across the 21:00 check-in; 5e5 holds on 12 of 12 seeds.
- **k** trades the idler against the active players: a lower k widens the active and optimal gaps
  (k 0.15 breaks N16), a higher one narrows them.
- **Ranks** are the optimal player's main edge. Keep "rising together" whatever the multiplier.
- **The crown** sets cadence. The canon v1 rule makes 16 Wipe Days a month and 8-day late runs.
- **Time-based layers** (Morale, ranks) help the casual player most; weaker Morale widens every
  gap. Rain helps the casual player too: more flotsam per short check-in.
- **The Night Shift base** must cover the idler's 13-hour gap between check-ins.
- **The Foreman's reserve** is load-bearing: without it the optimal player falls behind the casual.

### 8.1 Tuning order for the R-phase sessions

The levers interact, so the order matters. Each step is tuned in data, re-run with
`pnpm sim check --full`, and logged as a decision before the next step starts.

1. **Run economy (R1).** Output per rung, first-rung price, era costs, hand prices and the run-1
   crate, against N1-N4 and the run-1 timeline. Check 12 seeds: N1's floor and N3 move with the
   flotsam draw.
2. **Taps and flotsam (R1).** p, the Hustle ceiling, Rush, Rally, Adrenaline, the crate cap and the
   weather table, against N8 and N9 (clear, rain, weighted) at days 14, 30 and 60. The R1 check
   uses the section-6 budget as a stand-in for the tree.
3. **Prestige (R2).** `L0` and the exponent, against N3 and the first week. `k` comes last, as the
   balancing weight between the idler and the active player. The crown's rate rule (03 2.2
   rule 3, slowing down) is re-checked with the advisor's own definition; if it fires too late for active players, it uses
   the last-hour rate (errata E28).
4. **Rings 1-3 (R2), then 4-6 (R3-R5).** The catalog against 6.1-6.3, then N12-N16 and the first
   month. Re-check N9 whenever a Grip or Tide node changes.
5. **Meta layers (R4-R6).** Morale, ranks, scrap sources, Blowback and Late Tide, with G5 and the
   pairs. These move gaps more than anything except the exponent and rank focus.
6. **Rings 7-9 and the late wall (R7).** After the owner's choice in section 5.

A change that fixes one N-number and breaks another is not tuned; it goes back to the lever table
with both effects written down.

### 8.2 Risks the model shows

| Risk | Where it shows | Guard |
| --- | --- | --- |
| **Runaway cascades** | canon v1 constants: casual runs of 30 s to 2.5 min on days 3-4; ×113,000 gaps | fifth root; lean early rings; the cumulative budget rule (6.2); N12, N13 asserted |
| **Late wall** | after day 100; idler from day 30 | section 5; warnings in v2; the Crossing or a fair late source |
| **N9 at the edge** | weighted hour 2.95, rain hours 3.42 | no tap or flotsam power past the anchors (6.1); N9 on the weighted hour, rain warns (errata E13) |
| **A catalog over budget** | 04's draft: taps ×13.75, glass ×8, flotsam ×2-4, offline ×3 | 6.6; the content check per ring, column and sector |
| **Knife-edge late balance** | outer rings ×3,000: optimal 5.2-7.1× the casual at day 365 | budget table; group simulation before R7 |
| **Rank focus** | ×2 ranks focused give the optimal player 4.9× at day 30 | ranks rising together |
| **Foreman buy-max starving the crown** | optimal 0.87×, idler 0.47× of the casual | the reserve (resolution 1.10) |
| **Late Tide reshaping week 1 in groups** | casual's first week 10× faster in G5 | first-week band asserted alone (errata E14) |
| **Single-seed noise** | the idler's sawtooth; N9 hours vary ±0.3 | three seeds in `--full`; six flotsam seeds for N9; troughs printed |

---

## 9. What the other plan files take from this one

- **02-the-run.md:** the canon v2 run-1 timeline (4.2) with the flat 2-minute crate (errata E1):
  Timber 0:36, Mara 0:41, second hand 1:30, first crate 3:00, Sorting Tables 3:01, Stone 4:30, the
  first nuke at about 46-48 minutes.
- **03-the-big-red.md:** the pad at 5e8 lifetime in run 1 and from the start of later runs,
  shipping in R2 (errata E2); Late Tide's
  gain as modelled: `min(3 × base, max(base, median − glass ever))`, with `base` after Blast nodes.
- **04-blast-map.md and 04b:** section 6 replaces 04's provisional section 7: the budget (6.1),
  the counting rules (6.2), the per-sector split (6.3), the schedule (6.4), the anchors (6.5) and
  the overruns to fix (6.6). `tap` is the whole value (09), so tap series use `tap_flat`.
- **05-meta-layers.md:** N19 measured as resolution 2 reads it (4.8), on the averages, with the Sealed
  Locker at 1% (errata E15); Morale per entry from ring 4 on, +0.005 a ring; ranks 4-5 everywhere by day 180.
- **06-friends.md:** Late Tide and Blowback as modelled (2.1); Blowback pace in a real group of
  five: about 5 crates a day in month 1 and 1.6 a day over 180 days; with one friend 1.1-2.6 a day
  in month 1 and 0.4-0.8 over 180 days; Late Tide paying a starting group's casual and idler from
  week 1 (4.7).
- **09-architecture.md:** `island.json5`'s weather table is a balance input (rain moves N9); the
  simulator's profiles (alone, G5, pairs) and its `pnpm test` budget, under 10 s (7.3, errata E4); `Amount` reaches about
  1e39 in a year, far under the 1e150 budget.
- **11-roadmap.md:** simulator v2 in R0 with the alone and G5 profiles in `pnpm test`; the tuning
  order in 8.1 as acceptance steps for R1-R3; the re-check of the crown's rate rule (03 2.2 rule 3) as an R2 tuning item
  (errata E28); the late wall (section 10) as the owner's decision before R7.

---

## 10. Open questions

Resolutions 1-3 settled the first version's questions 1-11, 13 and 14 (exponent, amended N-numbers,
crown, N8, tap and flotsam values, the Foreman's reserve, busy-until, multipliers on the delta, the
Kettle's frame, ranks, Late Tide, anchors, roster milestones). Errata v3 settled this revision's
questions 1-7 (E1, E2, E11, E13-E16). This one remains:

1. **The late wall (section 5)** needs the owner's choice before R7 (resolution 3.24): option 1 for
   R3, with option 2 designed and simulated before R7. The group simulation has ruled out option 3.

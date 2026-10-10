# Canon v2: the design director's resolutions (2026-10-07)

These settle every open question raised by the 11 section writers. They have the same authority as
canon.md and amendments.md, and they WIN where they disagree. Every plan file must be revised to
match them. Numbers marked (sim) stay simulator levers; everything else is fixed.

## 0. The owner's brief, verbatim (for 01-vision.md's ask-by-ask table)

> "Hi, our game is nearly finished as a beta version for testing! Currently i work on svg icons to
> fill. from you i need to investigate and think about game. I dont like now the process. Whole game
> should be idle game, automatization with MASSIVE tree where ppl will spend their "ascending points"
> (we can call them another way) and whole idle game should be more flexible, player should feel and
> want to play game more and more, so starting from nearly nothing clicking like crazy to get things
> moving and automated. Take inspiration from games like Cookie clicker Melvor Idle and Melvor Idle 2,
> AdVenture Capitalist, Clicker Heroes, Realm Grinder, Egg, Inc.
> If you think its good idea to remove seasons or other stuff let me know.
> I was players to ascend the way that they will do something like = player will be given option
> (after progressing in the game) to push "weirdly looking red button" which will basically fire
> nuclear missile and destroys whole island with them. this will be funny like concept how to ascend.
> Then they will get ascending points, we can rework Scrap to make it more RARE or we can add
> something else, like blueprint fragmets etc etc.. This game is highly inspirated by
> postapocaliptic world and game called RUST.
> Create a plan how to improve this whole scenario, dont code the game, just full planning"

Asks to answer explicitly: idle + automation; MASSIVE tree for ascension points (renamable); more
flexible; "want to play more and more"; start from nearly nothing, click like crazy, then automate;
the six reference games (say what each one contributed); remove seasons or other stuff (answer);
the weird red button nuke as ascension (funny); ascension points; scrap rarer or blueprint fragments
(answer both); post-apocalyptic, Rust-inspired; a full plan, no code; the owner is drawing SVG icons
right now (tell them what to draw).

## 1. Economy constants (adopt P1 from 10-balance.md)

1. Prestige: glass level `G(L) = floor((L / L0)^a)`, **a = 1/5, L0 = 5e5** (sim); 10 glass at 50B
   lifetime supplies. The shape (power law on lifetime, paid as a delta, concave Glow) is canon; the
   exponent is a lever that must not go above 1/5 without a group-simulation proof. The square-root
   alternative is withdrawn (it worsens the runaway). Doubling glass takes 32x the lifetime.
2. Gain = `(G(L) − level) × glassMultipliers` (Bigger Payload, Late Tide...); then `level = G(L)`,
   `glass ever += gain`, `glass held += gain`. Multipliers are never clawed back by the next delta.
   Granted glass (founders, admin) goes to **held only** and never moves Glow.
3. Glow = `1 + k·√(glass ever)`, k = 0.25 (sim). Spending never lowers Glow.
4. Lines: base output ratio **×4.75 per rung** (sim) (new "Base /s": 1.5, 7.13, 33.8, 161, 764,
   3.63k, 17.2k, 81.9k, 389k, 1.85M, 8.78M, 41.7M, 198M, 941M). Costs, growth, cycles, hands unchanged.
5. Taps: p = **0.4% per Grip rung** (sim); Hustle ×1-×2 base, **×2.25 at most** with nodes; the steady
   tap coefficient c ≤ 0.6 at 6 taps/s with the whole tree (content check).
6. Flotsam and skills: Rally (Fuel Drum) **×4 for 60 s**; Adrenaline **taps ×100 for 12 s**; Drift
   Crate pays `max(1 min of output, min(15% of held supplies, 10 min of output))` (the 1-minute floor
   also applies to Blowback crates, which share the formula); run 1's guaranteed 3:00 crate pays a flat
   10 min of output and returns every 3 min until caught; **Rush taps ×5 for 30 s**. Re-catching a
   running buff restarts its timer; buffs of different kinds multiply.
7. Crew ranks: **×2 per rank**, 5 ranks at 1/2/4/8/16 scrap, and **ranks rise together** (no hand may
   be two ranks above the lowest-ranked hand). Maxing all 14 takes about 7-9 months.
8. Late Tide: **×3 glass below 50% of the median**, the bonus never carries a player past the median;
   the median is taken over the OTHER players active in the last 14 days (with two players: below half
   of the other player). Shown openly.
9. The crown on the Big Red (advisor): (a) gain ≥ glass ever (doubling), or (b) the run's glass rate
   fell below 80% of its peak and the nuke counts, or (c) **the nuke counts and the run is ≥ 20 h old**.
   The first nuke is guided at yield 10. Welcome back never crowns the nuke.
10. The Foreman's Collect pass keeps the crowned purchase's price in reserve (greedy buy-max otherwise).
11. Night Shift base stays 12 h (covers the casual night; the idler's 13 h gap is covered by Deep
    Cellars, 1 glass, ring 1).

## 2. N-numbers (amended, as 10-balance.md 4.9)

N5: nothing affordable for ≤ 30 s in the first 10 online minutes of runs 1-5. N7: ≥ 90% of casual
check-ins in days 1-30 contain a purchase. N8: minute 0-1 of run 1 counts tap-driven income (taps +
unmanned lines) ≥ 50%; direct taps 5-25% from minute 10 outside bursts. N11: ≤ 65% / 95% / 100%
(medians), warn-only until R7. N12: ×1.5-2.5 / ×1.15-1.6 / ×1.1-1.5. N13: the product of 5
consecutive nukes < ×1.3 with nothing opening in the next 3 → fail. N14: 6-10 at the first nuke;
later median ≥ 2. N15: keep, plus "casual ≥ 45% lit at day 180" as a warning. N19: per day = 7-day
average from day 2, one-offs excluded. N21: fifth root, L0 5e5, Glow 1 + 0.25√G. N23: run 1 ends at
1e10-1e12 supplies made; < 1e150 over 180 days; always finite. All other N-numbers unchanged.

## 3. Rules settled

1. **Wipe Days vs small blasts.** A nuke that adds ≥ 10% to glass ever is a counted **Wipe Day**: it
   raises Wipe Day #N, moves the agenda, posts news, washes Blowback, adds to the Island Count and
   the boards. A nuke below 10% is a **small blast**: it resets the island and pays its glass, quietly
   (no news, no Blowback, no counters, the "Fizzle" flight variant). The cover card says which it is.
2. **Afterglow** = `1 + 2 × 2^(−t/300 s)` on taps (×3 at start, the bonus halves every 5 min, ~30 min
   long), t counted from the run's first tap (`run.afterglowFrom`), on real seconds.
3. **Unmanned lines:** each line has `readyAt` (busy-until). A tap starts a cycle only when the line
   is idle; at most one cycle in flight per unmanned line; the cycle pays at its end even if tapping
   stopped (a scheduled payout settled in closed form). A taps batch can therefore start at most
   `floor((to − max(from, readyAt)) / t_i) + 1` cycles, capped by `count`. Manned lines accrue
   continuously.
4. **Roster milestones** are kept for the rest of the run once reached (buying an era never lowers
   income).
5. **The Kettle's stages:** pad at 3e7 lifetime supplies in run 1 (about minute 10), from the start
   of later runs; frame at yield ≥ 5 in run 1, later at yield ≥ max(1, 1% of glass ever); warhead when
   the nuke counts (pressable); fuel and steam when crowned.
6. **Cover card vs postcard:** the cover card names what THIS press unlocks; the postcard names what
   the NEXT Wipe Day unlocks.
7. **Never tease unshipped content.** The Barge's keel is not shown until the Crossing ships (planks
   backfilled from the count). The nav row is hidden at 0:00 and appears when its first destination
   unlocks.
8. **Blast Map waves:** R2 ships rings 1-3 of all eight sectors (73 nodes), with the Logbook and
   Scrapyard wedges' rings 1-3 built from things that exist in R2 (history, shelf, run counters). Rings
   4-6 reach 178 / 191 / 201 nodes across R3 / R4 / R5 as their systems ship (no orphans, no teasing).
   Rings 7-9 are written into data from R3 with a `wave` field and hidden until R7, so the simulator
   asserts N15 on the full tree. Counts: 187 small, 70 notable, 16 keystone, 36 unlock, 36 automation,
   16 completion = 361.
9. **Keystone slots:** exactly three (agenda nukes 10/20/40). No fourth slot node (replace any
   `fourth_socket` with another Blast-sector notable). A keystone bought while a slot is empty slots
   itself at once; otherwise loadouts change on the rebuild screen.
10. **Pockets:** three slots costing 5 / 15 / 40 scrap. Slot 1 is available from Wipe Day #2 (R5);
    slots 2 and 3 become available through the Scrapyard nodes `deep_pockets` and `sewn_lining`. An
    empty slot can be filled any time; a full slot can be swapped only before the run's first purchase
    (the rebuild screen shows a POCKETS block from R5).
11. **Flare:** the Toolbelt's Flare is granted by the agenda at Wipe Day #15 (R5); the `flare_gun`
    node lets the player choose the flotsam kind a Flare calls.
12. **Effect vocabulary:** 04-blast-map.md's extensions are adopted (a `max` on every `per`; shelf,
    flotsam and skill scopes; stats hustle_hold, hustle_drain, hustle_gain, afterglow_hold,
    upgrade_cost, era_cost, milestone_x2, roster_x2, mk_mult, start_upgrade, flotsam_weight,
    rally_mult, foreman_lines, hand_cap, rank_mult, morale; `set` on hustle_max). 09 registers them.
    Only unlock, automation and keystone nodes may use `feature:<id>` (new code, budgeted per phase).
13. **Anchor nodes re-tuned:** Glow Lamp k 0.25 → 0.27; Union Rules "×2 milestones become ×2.2";
    Lone Wolf "no hands; taps ×50". Dead Hand costs 22.2k. Keystone rule: a slotted keystone may at
    most double the income of the archetype it targets and must cost something elsewhere.
14. **Logbook detection:** pages are found by one pure function at the end of every command; a taps
    batch that finds a page writes that one `logbook_entry` row. The taps batch gains an optional
    `pokes` field (taps on scene objects such as the gull or the Kettle), clamped by the same bucket.
15. **Preferences:** `set_loadout` carries `{keystones, foreman, deadHand}`; stored in meta.
16. **Idempotency records:** every command stores an outcome-only record (no state; the client adopts
    the current state on replay): 7-day TTL for ordinary commands, 1 h for taps and pings (D59
    amended).
17. **Weather and island clock** become domain data (`island.json5`: UTC offset, a weather table in
    30-minute blocks, about 70% clear / 20% rain / 10% fog (sim)), so rain ×1.5 flotsam is server-checked.
18. **Demo clock:** 1× with time jumps (+1 h, +6 h, next day) in the demo drawer; active-play timers
    stay real seconds; CLAUDE.md 6.4's `wall` clock is added to the demo clocks in R0.
19. **Content files kept slim:** `crew.json5` (the 14 hand ids) and `resources.json5` (currencies and
    the product ids) are slimmed, not deleted, so locale keys and icons survive.
20. **Scrap before R5:** scrap is recorded in `meta` from R2 (3 for the first Wipe Day, +1 per 25
    Logbook pages from R4); the scrap chip appears in R5 when its sinks ship.
21. **The Radio Mast's product** is `broadcast` (not `signal`, the removed season system's id).
22. **Icons:** root `packages/content/icons/<kind>/<id>.svg` with 07-what-changes.md's kind list; the
    `night_shift` icon is needed in R1. Product ids: timber, roast, fibre, rope, planks, charcoal,
    ingots, leather, fuel, food, plates (existing) and battery, broadcast, cell (new).
23. **Social:** quiet hours 22:00-08:00 (browser time zone) on by default, holding pushes until 08:00;
    the bot's command route accepts only `collect` (no nuke, no taps from Discord); the Freighter's
    load = 1 h of current output (accepted as is).
24. **Crossing:** Dare rewards, Logbook pages, the Wipe Day count, agenda unlocks, scrap, ranks,
    Pockets and cosmetics survive a Crossing. Its trigger stays a simulator call; the late-wall choice
    (10-balance.md section 5) is an owner decision before R7, recommended: option 1 (slow outer tree,
    Crossing trigger lowered to "45% lit and N13 firing") with option 2 (a fair calendar-time power
    source, such as the deepening crater) designed in 05-meta-layers.md and simulated before R7.
25. **One crown per view:** while the crown is on the Big Red, crates, a Toolbelt skill or the tap
    hint, the collapsed drawer shows no orange row; the expanded drawer (a separate sheet) always crowns
    one row.
26. **Contrast fixes** (`--muted` #b5afa4, panel glass alpha 0.86) ship with the R1 orange-primary
    decision.
27. **Where the plan lives:** `docs/redesign/` (README plus these files). On approval, R0 rewrites
    CLAUDE.md, docs/game-design.md and docs/roadmap.md from it, archives the old design as
    `docs/archive/game-design-v1.md`, and logs decisions from D127. The engineering spec stays as
    `docs/redesign/09-architecture.md` (CLAUDE.md points to it).
28. **The cut-over wipe** keeps `players`, sessions, push devices, settings (VAPID, casino secret,
    Discord cursor), `seasons`, `season_archive`, `hall_of_fame`, `legacy` and `event_log` with its
    sequence; it deletes run state only (09's runbook, not deploy.md's W7 recipe).
29. **First ten minutes:** the script's times come from the P1 model (Timber about 0:36, Mara 0:41,
    second hand 1:30, first flotsam 3:00, Sorting Tables 4:50, Stone 6:22, yield 5 at 13:16, Sheet
    Metal 45:46, first nuke 48:00). R1 may slow the very first minute (e.g. raise the Timber era's cost)
    if playtests say it is too rushed, within the N-asserts. The crown order is era before hand.
30. **The idler archetype** taps 4/s only while nothing runs by itself (to start a run).

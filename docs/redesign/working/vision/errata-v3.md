# Errata v3 (design director, 2026-10-08): final settlements of the revisers' open questions

Same authority as resolutions.md and wins over it where they differ.

E1. Run 1's guaranteed 3:00 crate pays a flat **2 minutes** of output (not 10) and returns every
    3 min until caught. First-ten-minutes script times: Timber ~0:36, Mara ~0:41, 2nd hand ~1:30,
    first crate 3:00, Sorting Tables ~3:01, Stone ~4:30, first nuke ~46-48 min (P1 model, sim).
E2. The Kettle's pad appears at **5e8 lifetime supplies** in run 1 (about minute 9-10 over seeds),
    from the start of later runs. The pad and its locked card ship in **R2**, not R1 (never tease).
E3. Season 1's end: **no `season announce`**. At the cut-over the bot is kept stopped while
    `season end` runs (its season news is live-only, so nothing wrong is posted). Season 1 ends
    quietly; the owner's message (07 provides the text) is optional (owner decision 7,
    2026-10-10). No commits on frozen `main` for this.
E4. Simulator budget inside `pnpm test`: **under 10 s** (both 09 and 10 say so).
E5. Hiring: a separate **hand row** under each line (one button and one price per row), as 08.
E6. The first postcard has **one** button, "Open the Blast Map"; the map's "< Rebuild" lands the boat.
E7. Demo time jumps: **+1 h, +6 h, next day**.
E8. Flotsam odds: an **Odds sheet in Settings from R1**, repeated in the Logbook from R4.
E9. Saltmarsh's clock: **UTC+1, no daylight saving** (owner may change; owner decision list).
E10. Long Night's reward stays **+4 h**.
E11. N16 is asserted in the **group of five with Late Tide**; solo gaps and the doubling idler's
     trough are warnings. The late idler gaps are asserted for an idler **following the crown**.
E12. Dead Hand: **presets** 25 / 50 / 100 / 200% of glass ever, or "when crowned".
E13. N9 is asserted on the **weather-weighted hour**; rain hours are a warning.
E14. Month-1 band: **20-40 Wipe Days** by day 30 (casual); the first-week band is asserted solo.
E15. N19 asserts the **averages**; single 7-day windows are warnings; the Sealed Locker weight is
     **1%** (not 1.5%).
E16. N17 is asserted for **two players**; five players is a warning.
E17. Island Count tiers: **10 / 25 / 50 / 100 / 175 / 250** (re-checked by the group simulation).
E18. Architecture: `meta.blowback` holds crates `[{from, at}]`; `World.lateTide` carries the median
     as a number; `World.islandCount` counts Wipe Days only; Discord Collect runs the Foreman pass
     when `meta.foreman` is on; the bot uses an **allowlist** boundary test (06's version).
E19. 08: no Late Tide tag on boards or any shared surface (only the player sees it); feed lines never
     name a secret; Settings gets a "Quiet hours 22:00-08:00" row.
E20. 11: R6's acceptance uses crates `max(1 min, min(15% held, 10 min))` and Late Tide ×3 against the
     other active players' median, capped at it.
E21. Sea Charts divisor is a data lever set to **1e4**: `floor(5 × log10(glass ever / 1e4))`.
E22. Storm Season's Hustle reward counts **inside** the ×2.25 Hustle ceiling (c stays ≤ 0.6).
E23. The flat tap's global fold is **eras, island upgrades, roster, Grit, Glow, Morale** (the
     p × supplies-per-second part already carries them); 09's evaluator names this set.
E24. 05 adopts 04's placements: Old Maps is a ring-4 unlock; Dog-eared Pages is "Morale ×1.2";
     Morale smalls in rings 4-9; winches in rings 5-8; Deep Pockets in ring 4; ranks from ring 6.
E25. Shelf and era price cuts are capped (×0.25 per shelf kind, ×0.5 for eras) and measured by the
     simulator before R3; 10-balance lists the typical state it measures each ring at.
E26. Canon 4.10's first week and month are replaced by the P1 figures in R0's rewrite (01 4.6-4.8).
E27. "Starter Kit" (`packed_crate`) goes on the naming-pass list (common phrase, but also a Cookie
     Clicker upgrade name); the id stays.
E28. The crown's rate (rule c) is re-checked by simulator v2 with the advisor's own definition; if it
     fires too late for active players, it uses the last-hour rate. Noted as an R2 tuning item.

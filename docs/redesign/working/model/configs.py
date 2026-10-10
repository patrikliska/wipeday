"""The parameter sets the plan reports: canon constants and the tuned proposal (P1).

Both use the same Blast Map budget shape (the canon defines no budget), so "canon" isolates the
canon's run, prestige, tap and flotsam constants.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import HOUR

COLS = ("lines", "tap", "p_mult", "hustle_add", "crit", "cost", "flot_freq", "flot_eff", "off_h",
        "off_mult", "glass", "glow_k", "morale")

# The proposed Blast Map budget: what each ring adds when fully lit (plan 10-balance.md, section D).
# lines: global line output; tap: whole tap value; p_mult: x on the share of supplies/s per tap;
# hustle_add: Hustle max (base x2); crit: average extra tap value from crits; cost: line and hand
# prices; flot_freq / flot_eff: flotsam frequency / effects; off_h: Night Shift hours; off_mult:
# offline output; glass: glass gain; glow_k: added to k; morale: added per Logbook entry.
BUDGET_ROWS = [
    # lines tap   p_m   hust  crit  cost  ffreq feff  off_h offm  glass glow_k morale
    [1.3, 1.50, 1.00, 0.00, 0.00, 0.95, 1.05, 1.00, 0.0, 1.00, 1.10, 0.000, 0.000],  # ring 1
    [1.4, 1.00, 1.10, 0.25, 0.00, 0.90, 1.00, 1.05, 4.0, 1.00, 1.05, 0.010, 0.003],  # ring 2
    [1.6, 1.00, 1.00, 0.00, 0.45, 0.90, 1.00, 1.00, 4.0, 1.00, 1.10, 0.020, 0.003],  # ring 3
    [2.0, 1.00, 1.09, 0.00, 0.00, 0.85, 1.00, 1.00, 4.0, 1.10, 1.10, 0.020, 0.004],  # ring 4
    [10.0, 1.00, 1.00, 0.00, 0.00, 0.85, 1.00, 1.00, 4.0, 1.10, 1.10, 0.030, 0.004],  # ring 5
    [1000.0, 1.00, 1.00, 0.00, 0.00, 0.85, 1.00, 1.00, 4.0, 1.10, 1.10, 0.030, 0.004],  # ring 6
    [1000.0, 1.00, 1.00, 0.00, 0.00, 0.85, 1.00, 1.00, 4.0, 1.10, 1.10, 0.040, 0.004],  # ring 7
    [1000.0, 1.00, 1.00, 0.00, 0.00, 0.85, 1.00, 1.00, 4.0, 1.10, 1.10, 0.040, 0.004],  # ring 8
    [1000.0, 1.00, 1.00, 0.00, 0.00, 0.85, 1.00, 1.00, 0.0, 1.10, 1.10, 0.050, 0.004],  # ring 9
]


def budget(lines=None, **cols):
    out = []
    for r, row in enumerate(BUDGET_ROWS):
        d = dict(zip(COLS, row))
        if lines is not None:
            d["lines"] = lines[r]
        for k, v in cols.items():
            d[k] = v[r]
        out.append(d)
    return out


CANON = dict(budget=budget())  # every other constant is canon.md's default in Params

PROPOSAL = dict(
    # run
    out_ratio=4.75,          # canon 5.5: output x4.75 per rung (the "Base /s" column)
    grip_p=0.004,            # canon 0.01: each Grip rung adds 0.4% of supplies/s to a tap
    rush=(5.0, 30, 600),     # canon taps x10: Rush taps x5 for 30 s, 10 min cooldown
    rally=(4.0, 60),         # canon x6: Fuel Drum Rally all lines x4 for 60 s
    adren=(100.0, 12),       # canon x300: Adrenaline taps x100 for 12 s
    crate_secs=600.0,        # canon 15 min: Drift Crate min(15% held, 10 min of output)
    # prestige
    expo=0.2,                # canon 1/3: glass ever = floor((L / L0)^(1/5))
    L0=5e5,                  # canon 1e8: 10 glass at 50B supplies made
    # meta
    rank_mult=2.0,           # canon x3: each crew rank x2 to its line
    rank_rule="spread",      # proposal: ranks rise together (no hand two ranks above the lowest)
    crown_mode="hybrid",     # canon rule, plus: crowned when the nuke counts and the run is 20 h old
    crown_age=20 * HOUR,
    late_tide=3.0,           # canon x2: Late Tide x3 glass per nuke
    late_tide_below=0.5,     # canon: below 50% of the group's median glass ever
    budget=budget(),
)


# ------------------------------------------------------------------------------------------------
# Canon v2 (resolutions.md): P1's constants plus the rules the resolutions added, and the budget
# revised for resolution 3.8 (Logbook and Scrapyard rings 1-3 hold only R2 things).

V2_RULES = dict(
    crate_floor=60.0,            # res. 1.6: crates (and Blowback) pay at least 1 min of output
    first_crate_secs=600.0,      # res. 1.6: run 1's 3:00 crate pays a flat 10 min of output
    afterglow_from="first_tap",  # res. 3.2
    rain_share=0.2,              # res. 3.17: about 70% clear / 20% rain / 10% fog
    late_tide_cap=True,          # res. 1.8: never past the median
)

# Morale per entry leaves rings 2-3 (the Logbook's wave 1 is history) and arrives in rings 4-9.
# Shelf costs (Grip, Line Mk, island upgrades; per kind) and era costs become budgeted columns.
#          ring:   1     2     3     4     5     6     7     8     9
MORALE_V2 = [0.0, 0.0, 0.0, 0.005, 0.005, 0.005, 0.005, 0.005, 0.005]
# Rings 2-3 lines x1.54 / x1.76 (P1 x1.4 / x1.6): the Logbook's history nodes take over the x1.1 per
# ring that rings 2-3's Morale per entry gave in P1 (v2_seeds.py).
LINES_V2 = [1.3, 1.54, 1.76, 2.0, 10.0, 1000.0, 1000.0, 1000.0, 1000.0]
SHELF_V2 = [0.85, 0.85, 0.85, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]
ERA_V2 = [1.0, 1.0, 1.0, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]

# Automation and start-of-run nodes at 04-blast-map.md's slots: (ring index, share of the ring
# bought, key). Ring index 0 is ring 1.
AUTO_V2 = [(0, 3 / 16, "kit1"), (0, 3 / 16, "old_friend"), (0, 3 / 16, "deep_cellars"),
           (1, 0.25, "grip1"),                                          # Tool Bag
           (2, 0.25, "old_crew_1"), (2, 0.5, "grip2"), (2, 0.75, "start_timber"),  # Iron Bag, Prefab Walls
           (4, 0.5, "old_crew_2"), (4, 0.5, "kit_big"), (4, 0.5, "island1"),       # Bigger Kit, First Shelf
           (5, 0.75, "start_stone"),                                    # Stone Foundations
           (6, 0.25, "old_crew_3"), (6, 0.25, "mk2_6"),                 # Mk Kit
           (7, 0.5, "standing_crew"), (7, 0.5, "grip3")]                # Power Kit
AUTO_P1 = [(0, 3 / 16, "kit1"), (0, 3 / 16, "old_friend"), (0, 3 / 16, "deep_cellars"),
           (2, 0.25, "old_crew_1"), (2, 0.75, "start_timber"), (3, 0.5, "kit2"),
           (4, 0.5, "old_crew_2"), (4, 0.75, "start_stone"), (5, 0.5, "old_crew_3"),
           (6, 0.5, "start_metal")]


def budget_v2(lines=LINES_V2, morale=MORALE_V2, shelf=SHELF_V2, era=ERA_V2):
    out = budget(lines)
    for r, d in enumerate(out):
        d["morale"] = morale[r]
        d["shelf_cost"] = shelf[r]
        d["era_cost"] = era[r]
    return out


V2A = dict(PROPOSAL, **V2_RULES)                                               # rules only
V2B = dict(V2A, budget=budget_v2(lines=[1.3, 1.4, 1.6, 2.0, 10.0, 1000.0, 1000.0, 1000.0, 1000.0],
                                 shelf=[1.0] * 9, era=[1.0] * 9))             # + Morale moved
V2B2 = dict(V2A, budget=budget_v2(shelf=[1.0] * 9, era=[1.0] * 9))           # + Logbook history lines
V2C = dict(V2A, budget=budget_v2())                                            # + shelf and era costs
V2 = dict(V2A, budget=budget_v2(), auto=AUTO_V2)                               # + 04's automation slots

# A player alone: no friends, so no Blowback, no Freighter tiers and no Late Tide (the solo tables).
V2_ALONE = dict(V2, blowback_per_day=0.0, freighter_scale=0.0)

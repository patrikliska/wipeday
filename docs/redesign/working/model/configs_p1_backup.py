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

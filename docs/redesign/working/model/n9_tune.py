import sys, os, copy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import PROPOSAL, budget, BUDGET_ROWS, COLS
from n9_debug import snap_at, hour

def tuned_budget(hustle=(0, .25, 0, .25, 0, 0, 0, 0, 0), ffreq=(1.077, 1, 1.077, 1, 1.077, 1, 1, 1, 1),
                 feff=(1, 1.077, 1, 1.077, 1, 1.077, 1, 1, 1), pm=(1, 1.1, 1, 1.09, 1, 1, 1, 1, 1)):
    b = budget()
    for r in range(9):
        b[r]["hustle_add"] = hustle[r]; b[r]["flot_freq"] = ffreq[r]; b[r]["flot_eff"] = feff[r]; b[r]["p_mult"] = pm[r]
    return b

if __name__ == "__main__":
    variants = [
        ("P1 budget", dict(PROPOSAL)),
        ("tight tap+flotsam", dict(PROPOSAL, budget=tuned_budget())),
        ("tight + rush x5", dict(PROPOSAL, budget=tuned_budget(), rush=(5.0, 30, 600))),
        ("tight + rush x5 + adren x100", dict(PROPOSAL, budget=tuned_budget(), rush=(5.0, 30, 600), adren=(100.0, 12))),
        ("tight + rush x5 + crate 10min", dict(PROPOSAL, budget=tuned_budget(), rush=(5.0, 30, 600), crate_secs=600.0)),
        ("tight + rush x5 + adren x100 + crate 10 min", dict(PROPOSAL, budget=tuned_budget(), rush=(5.0, 30, 600), adren=(100.0, 12), crate_secs=600.0)),
    ]
    for lab, over in variants:
        out = []
        for day in (14, 30):
            snap, t = snap_at(over, day)
            idle = hour(snap, t, 0.0, False)[0]
            full = hour(snap, t, 6.0, True)
            taps = hour(snap, t, 6.0, False)[0]
            buy_a = hour(snap, t, 6.0, True, buy=True)[0]
            buy_i = hour(snap, t, 0.0, False, buy=True)[0]
            cas = hour(snap, t, 4.0, True)[0]
            out.append("d%d taps %.2f full %.2f (flot %.0f%%) buy %.2f casual-rate %.2f" % (day, taps / idle, full[0] / idle, 100 * full[3] / full[0], buy_a / buy_i, cas / idle))
        print("%-46s %s" % (lab, " | ".join(out)))

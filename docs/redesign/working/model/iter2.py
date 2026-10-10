import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from calib import *
from probe_life import life as life_table

COLS = ("lines", "tap", "p_mult", "hustle_add", "crit", "cost", "flot_freq", "flot_eff", "off_h",
        "off_mult", "glass", "glow_k", "morale")


def mk_budget(lines, **over):
    rows = [
        # lines tap  p_m   hust  crit  cost  ffreq feff  off_h offm  glass glow_k morale
        [1.0, 1.5, 1.00, 0.00, 0.00, 0.95, 1.10, 1.00, 0.0, 1.00, 1.10, 0.000, 0.000],
        [1.0, 1.0, 1.10, 0.25, 0.00, 0.90, 1.00, 1.10, 4.0, 1.00, 1.05, 0.010, 0.003],
        [1.0, 1.0, 1.00, 0.25, 0.45, 0.90, 1.10, 1.10, 4.0, 1.00, 1.10, 0.020, 0.003],
        [1.0, 1.0, 1.15, 0.25, 0.00, 0.85, 1.00, 1.10, 4.0, 1.10, 1.10, 0.020, 0.004],
        [1.0, 1.0, 1.00, 0.25, 0.00, 0.85, 1.10, 1.10, 4.0, 1.10, 1.10, 0.030, 0.004],
        [1.0, 1.0, 1.00, 0.00, 0.00, 0.85, 1.00, 1.10, 4.0, 1.10, 1.10, 0.030, 0.004],
        [1.0, 1.0, 1.00, 0.00, 0.00, 0.85, 1.10, 1.10, 4.0, 1.10, 1.10, 0.040, 0.004],
        [1.0, 1.0, 1.00, 0.00, 0.00, 0.85, 1.00, 1.10, 4.0, 1.10, 1.10, 0.040, 0.004],
        [1.0, 1.0, 1.00, 0.00, 0.00, 0.85, 1.10, 1.10, 0.0, 1.10, 1.10, 0.050, 0.004],
    ]
    out = []
    for r in range(9):
        d = dict(zip(COLS, rows[r]))
        d["lines"] = lines[r]
        for k, v in over.items():
            d[k] = v[r]
        out.append(d)
    return out


RUN = dict(out_ratio=4.75, grip_p=0.005)

if __name__ == "__main__":
    lines = [float(x) for x in sys.argv[3].split(",")] if len(sys.argv) > 3 else [1.3, 1.5, 2, 3, 4, 6, 8, 10, 12]
    over = dict(RUN, budget=mk_budget(lines))
    which = sys.argv[1] if len(sys.argv) > 1 else "summary"
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 60
    if which == "summary":
        run_set("lines " + ",".join(str(x) for x in lines), over, days)
    else:
        life_table("v", which, days, 70, **over)

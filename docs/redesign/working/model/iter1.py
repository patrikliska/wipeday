import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from calib import *
from probe_life import life as life_table

lean = budget_from(
    lines=[1.3, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0, 10.0, 12.0],
    tap=[1.5, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    cost=[0.95, 0.9, 0.9, 0.85, 0.85, 0.8, 0.8, 0.8, 0.8],
    glass=[1.1, 1.05, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1],
    glow_k=[0, 0.01, 0.02, 0.02, 0.03, 0.03, 0.04, 0.04, 0.05],
)

if __name__ == "__main__":
    over = dict(out_ratio=4.5, budget=lean)
    which = sys.argv[1] if len(sys.argv) > 1 else "summary"
    if which == "summary":
        run_set("lean", over, int(sys.argv[2]) if len(sys.argv) > 2 else 60)
    else:
        life_table("lean", which, int(sys.argv[2]), 60, **over)

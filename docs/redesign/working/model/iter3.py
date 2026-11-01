import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from calib import *
from iter2 import mk_budget
from probe_life import life as life_table

RUN3 = dict(out_ratio=4.75, grip_p=0.005, expo=0.2, L0=1e6)

if __name__ == "__main__":
    lines = [float(x) for x in sys.argv[3].split(",")] if len(sys.argv) > 3 else [1.3, 1.5, 2, 3, 4, 6, 8, 10, 12]
    over = dict(RUN3, budget=mk_budget(lines))
    which = sys.argv[1] if len(sys.argv) > 1 else "summary"
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 60
    if which == "summary":
        run_set("a=0.2 lines " + ",".join(str(x) for x in lines), over, days)
    else:
        life_table("v", which, days, 90, **over)

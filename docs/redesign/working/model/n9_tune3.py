import sys, os
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import PROPOSAL
from n9_tune import tuned_budget
from n9_tune2 import job

if __name__ == "__main__":
    base = dict(PROPOSAL, grip_p=0.004, budget=tuned_budget(), rush=(5.0, 30, 600), adren=(100.0, 12), rally=(4.0, 60), crate_secs=600.0)
    V = [
        ("f (4-10 min)", base),
        ("g: f + flotsam 5-12 min", dict(base, flot_min=300.0, flot_max=720.0)),
        ("h: f, crate 15 min, flotsam 5-12", dict(base, flot_min=300.0, flot_max=720.0, crate_secs=900.0)),
        ("i: canon flotsam, taps f", dict(base, adren=(300.0, 12), rally=(6.0, 60), crate_secs=900.0)),
        ("j: f, no flotsam freq/eff nodes", dict(base, budget=tuned_budget(ffreq=(1,) * 9, feff=(1,) * 9))),
    ]
    with Pool(len(V)) as pool:
        for lab, out in pool.map(job, V):
            print("%-40s %s" % (lab, " | ".join(out)))

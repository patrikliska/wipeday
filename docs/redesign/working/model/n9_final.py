import sys, os
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import PROPOSAL, budget
from n9_tune2 import job

if __name__ == "__main__":
    h025 = budget(hustle_add=[0, 0.25, 0, 0, 0, 0, 0, 0, 0])
    V = [
        ("L0 5e5, Hustle max 2.5", dict(PROPOSAL, L0=5e5)),
        ("L0 5e5, Hustle max 2.25", dict(PROPOSAL, L0=5e5, budget=h025)),
        ("L0 5e5, Hustle 2.25, Tide 1/1", dict(PROPOSAL, L0=5e5, budget=budget(hustle_add=[0, 0.25, 0, 0, 0, 0, 0, 0, 0], flot_freq=[1] * 9, flot_eff=[1] * 9))),
    ]
    with Pool(len(V)) as pool:
        for lab, out in pool.map(job, V):
            print("%-34s %s" % (lab, " | ".join(out)))

import sys, os, copy, random
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import PROPOSAL
from n9_debug import snap_at
from n9_tune import tuned_budget

def hour_avg(snap, t, tps, flot, seeds=6):
    tot = 0.0
    for sd in range(seeds):
        q = copy.deepcopy(snap); q.settle_offline(t); q.recalc()
        q.rng = random.Random(1000 + sd)
        q.run.flot_timer = q.next_flot_gap()
        q.no_buy = True; q.no_flot = not flot
        S0 = q.run.S
        for s in range(3600):
            q.step(t + s, tps)
        tot += q.run.S - S0
    return tot / seeds

def job(args):
    lab, over = args
    out = []
    for day in (14, 30, 60):
        snap, t = snap_at(over, day)
        idle = hour_avg(snap, t, 0.0, False, 1)
        taps = hour_avg(snap, t, 6.0, False, 1)
        full = hour_avg(snap, t, 6.0, True)
        cas = hour_avg(snap, t, 4.0, True)
        out.append("d%d taps %.2f full %.2f casual %.2f" % (day, taps / idle, full / idle, cas / idle))
    return lab, out

if __name__ == "__main__":
    nohust = (0,) * 9
    V = [
        ("P1", dict(PROPOSAL)),
        ("a: p.4%, H2.5, rush5, adr100", dict(PROPOSAL, grip_p=0.004, budget=tuned_budget(), rush=(5.0, 30, 600), adren=(100.0, 12))),
        ("b: p.3%, H2.5, rush5, adr300", dict(PROPOSAL, grip_p=0.003, budget=tuned_budget(), rush=(5.0, 30, 600))),
        ("c: p.4%, H2, rush5, adr100", dict(PROPOSAL, grip_p=0.004, budget=tuned_budget(hustle=nohust), rush=(5.0, 30, 600), adren=(100.0, 12))),
        ("d: c + rally x4", dict(PROPOSAL, grip_p=0.004, budget=tuned_budget(hustle=nohust), rush=(5.0, 30, 600), adren=(100.0, 12), rally=(4.0, 60))),
        ("e: p.5%, H2, rush5, adr100, rally4", dict(PROPOSAL, budget=tuned_budget(hustle=nohust), rush=(5.0, 30, 600), adren=(100.0, 12), rally=(4.0, 60))),
        ("f: p.4%, H2.5, rush5, adr100, rally4, crate10", dict(PROPOSAL, grip_p=0.004, budget=tuned_budget(), rush=(5.0, 30, 600), adren=(100.0, 12), rally=(4.0, 60), crate_secs=600.0)),
    ]
    with Pool(len(V)) as pool:
        for lab, out in pool.map(job, V):
            print("%-44s %s" % (lab, " | ".join(out)))

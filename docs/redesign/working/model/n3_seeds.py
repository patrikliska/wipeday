import sys, os
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import PROPOSAL, budget

def job(args):
    lab, over, name, seed = args
    p = Params(**over)
    pl = Player(p, archetype(name), seed=seed)
    pl.play(2)
    r = pl.runs[0] if pl.runs else None
    return lab, name, seed, (r["t1"] - pl.t_first) if r else None, pl.L

if __name__ == "__main__":
    V = [("P1", dict(PROPOSAL)), ("L0 7e5", dict(PROPOSAL, L0=7e5)), ("L0 5e5", dict(PROPOSAL, L0=5e5)),
         ("out 4.8", dict(PROPOSAL, out_ratio=4.8)), ("grip .5%", dict(PROPOSAL, grip_p=0.005))]
    tasks = [(lab, over, n, sd) for lab, over in V for n in ("casual", "first_hour", "autoclicker") for sd in range(1, 13)]
    with Pool(26) as pool:
        res = pool.map(job, tasks)
    for lab, _ in V:
        for n in ("casual", "first_hour", "autoclicker"):
            ts = [r[3] for r in res if r[0] == lab and r[1] == n]
            ok = [t for t in ts if t is not None]
            if n == "casual":
                hit = sum(1 for t in ts if t is not None and t <= 13 * HOUR + 600)
                print("%-10s %-11s first nuke by the 21:00 check-in in %d/12 seeds; times %s" % (lab, n, hit, sorted(hms(t) for t in ok)))
            else:
                print("%-10s %-11s first nuke min %s median %s max %s" % (lab, n, hms(min(ok)), hms(sorted(ok)[len(ok)//2]), hms(max(ok))))

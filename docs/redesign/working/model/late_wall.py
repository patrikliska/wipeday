import sys, os, time
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import PROPOSAL, budget
from run_all import w_life, e_at

NAMES = ("idler", "casual", "active", "optimal")

if __name__ == "__main__":
    V = []
    for b5 in (10.0, 30.0):
        for bl in (300.0, 1000.0, 3000.0):
            V.append(("b5=%g b6-9=%g" % (b5, bl), dict(PROPOSAL, budget=budget([1.3, 1.4, 1.6, 2.0, b5, bl, bl, bl, bl]))))
    V.append(("b5=30 b6=300 b7-9=3000", dict(PROPOSAL, budget=budget([1.3, 1.4, 1.6, 2.0, 30, 300, 3000, 3000, 3000]))))
    tasks = [(over, n, {}, 365, 11, None) for lab, over in V for n in NAMES]
    t = time.time()
    with Pool(26) as pool:
        pls = pool.map(w_life, tasks)
    p = Params(**PROPOSAL)
    for i, (lab, over) in enumerate(V):
        L = dict(zip(NAMES, pls[i * 4:(i + 1) * 4]))
        c = L["casual"]
        g = lambda n, d: e_at(L[n], d)["E"] / e_at(c, d)["E"]
        full = {n: next((s["day"] for s in L[n].daily if s["lit"] >= p.tree_count), None) for n in NAMES}
        print("== " + lab)
        print("   gaps d30/90/180/365: active %.2f/%.2f/%.2f/%.2f optimal %.2f/%.2f/%.2f/%.2f idler %.2f/%.2f/%.2f/%.2f" % tuple(
            g(n, d) for n in ("active", "optimal", "idler") for d in (30, 90, 180, 365)))
        for n in ("casual", "optimal"):
            pl = L[n]
            print("   %-8s " % n + " | ".join("d%d %s/%d/%.0f%%" % (d, fmt(e_at(pl, d)["E"]), e_at(pl, d)["nukes"], 100 * e_at(pl, d)["lit"] / p.tree_count) for d in (30, 90, 180, 270, 365)) + " | full %s | max %s" % (full[n], fmt(pl.max_number)))
    print("%.0fs" % (time.time() - t))

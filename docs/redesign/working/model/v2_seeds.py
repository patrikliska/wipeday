import sys, os, math
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import PROPOSAL, V2, budget_v2
from run_all import w_life, e_at, run_rows, phase, med
NAMES = ("idler", "casual", "active", "optimal")
SEEDS = (7, 11, 23)
def gmean(xs): return math.exp(sum(math.log(x) for x in xs) / len(xs))
if __name__ == "__main__":
    L = lambda r2, r3: [1.3, r2, r3, 2.0, 10.0, 1000.0, 1000.0, 1000.0, 1000.0]
    S85 = [0.85, 0.85, 0.85, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]
    V = [("P1", PROPOSAL), ("V2 (r2-3 x1.4/1.6, shelf .75)", V2),
         ("V2-L (r2-3 x1.54/1.76, shelf .75)", dict(V2, budget=budget_v2(L(1.54, 1.76)))),
         ("V2-S (r2-3 x1.4/1.6, shelf .85)", dict(V2, budget=budget_v2(shelf=S85))),
         ("V2-LS (r2-3 x1.54/1.76, shelf .85)", dict(V2, budget=budget_v2(L(1.54, 1.76), shelf=S85)))]
    tasks = [(over, n, {}, 180, s, None) for _, over in V for s in SEEDS for n in NAMES]
    with Pool(28) as pool:
        pls = pool.map(w_life, tasks)
    k = 0
    for lab, over in V:
        res = []
        for s in SEEDS:
            res.append(dict(zip(NAMES, pls[k:k + 4]))); k += 4
        def gap(n, d): return gmean([e_at(r[n], d)["E"] / e_at(r["casual"], d)["E"] for r in res])
        def tr(d0, d1): return min(min(e_at(r["idler"], d)["E"] / e_at(r["casual"], d)["E"] for d in range(d0, d1 + 1)) for r in res)
        cas = lambda d: gmean([e_at(r["casual"], d)["E"] for r in res])
        nk = [e_at(r["casual"], 30)["nukes"] for r in res]
        late = [med([x["dur"] for x in run_rows(r["casual"]) if phase(x) == "late"]) / DAY for r in res]
        print("%-36s cas d7 %s d30 %s d90 %s nukes30 %s | act %.2f/%.2f opt %.2f/%.2f idl %.2f/%.2f trough %.2f/%.2f | late %s" % (
            lab, fmt(cas(7)), fmt(cas(30)), fmt(cas(90)), nk, gap("active", 30), gap("active", 90), gap("optimal", 30), gap("optimal", 90),
            gap("idler", 30), gap("idler", 90), tr(25, 35), tr(85, 95), ["%.1f" % x for x in late]))

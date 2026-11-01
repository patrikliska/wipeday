import sys, os, time
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import V2, budget_v2, AUTO_V2
from run_all import w_life, e_at, run_rows, phase, med
NAMES = ("idler", "casual", "active", "optimal")
def trough(idl, cas, d0, d1):
    return min(e_at(idl, d)["E"] / max(1, e_at(cas, d)["E"]) for d in range(d0, d1 + 1))
if __name__ == "__main__":
    L = lambda r2, r3, r1=1.3, r4=2.0: [r1, r2, r3, r4, 10.0, 1000.0, 1000.0, 1000.0, 1000.0]
    V = [("V2", V2),
         ("V2 lines r2-3 x1.54/x1.76", dict(V2, budget=budget_v2(L(1.54, 1.76)))),
         ("V2 lines r2-3 x1.5/x1.7", dict(V2, budget=budget_v2(L(1.5, 1.7)))),
         ("V2 lines r2-3 x1.6/x1.8", dict(V2, budget=budget_v2(L(1.6, 1.8)))),
         ("V2 shelf r1-3 x0.85", dict(V2, budget=budget_v2(shelf=[0.85, 0.85, 0.85, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]))),
         ("V2 lines x1.54/1.76 shelf x0.85", dict(V2, budget=budget_v2(L(1.54, 1.76), shelf=[0.85, 0.85, 0.85, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]))),
         ]
    tasks = []
    for lab, over in V:
        for n in NAMES:
            tasks.append((over, n, {}, 180, 11, None))
        tasks.append((over, "first_hour", {}, 1, 7, None))
    with Pool(26) as pool:
        pls = pool.map(w_life, tasks)
    for i, (lab, over) in enumerate(V):
        idl, cas, act, opt, fh = pls[i * 5:(i + 1) * 5]
        g = lambda x, d: e_at(x, d)["E"] / e_at(cas, d)["E"]
        rows = run_rows(cas)
        late = med([r["dur"] for r in rows if phase(r) == "late"])
        print("%-34s N1 %s cas d7 %s d30 %s (%d nukes) d90 %s | act %.2f/%.2f opt %.2f/%.2f idl %.2f/%.2f trough25-35 %.2f 85-95 %.2f | late %.1fd lit30 %.0f%%" % (
            lab, hms(fh.runs[0]["dur"]), fmt(e_at(cas, 7)["E"]), fmt(e_at(cas, 30)["E"]), e_at(cas, 30)["nukes"], fmt(e_at(cas, 90)["E"]),
            g(act, 30), g(act, 90), g(opt, 30), g(opt, 90), g(idl, 30), g(idl, 90), trough(idl, cas, 25, 35), trough(idl, cas, 85, 95),
            late / DAY, 100 * e_at(opt, 30)["lit"] / 361))

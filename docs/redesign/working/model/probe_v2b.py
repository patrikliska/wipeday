import sys, os, copy, random
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import V2, V2_ALONE
from run_all import w_life, e_at
from run_v2 import w_hour_w, w_scope

if __name__ == "__main__":
    with Pool(28) as pool:
        lifes = pool.map(w_life, [(V2_ALONE, n, {}, 180, 11, None) for n in ("casual", "active")])
        hrs = pool.map(w_hour_w, [(dict(V2, rain_flot=1.25), 30, True), (dict(V2, rally=(3.0, 60)), 30, False),
                                  (dict(V2, rally=(3.0, 60)), 30, True), (dict(V2, crate_secs=480.0), 30, True),
                                  (dict(V2, adren=(50.0, 12)), 30, True)])
        sc = pool.map(w_scope, [(V2_ALONE, "casual", 8), (V2_ALONE, "active", 8)])
    for name, pl in zip(("casual", "active"), lifes):
        for d in (7, 30, 90, 180):
            rs = [r for r in pl.runs if (r["t1"] - pl.t_first) / DAY <= d][-3:]
            print(name, "runs ending by day", d, "owned at nuke (lines 12-14):", [r["owned"][11:] for r in rs], "era", [r["era"] for r in rs])
    for lab, (day, rain, res) in zip(("rain x1.25 (rain hour)", "Rally x3 clear", "Rally x3 rain", "crate cap 8 min rain", "Adrenaline x50 rain"), hrs):
        print("%-24s active/idle %.2f" % (lab, res["active"]["S"] / res["idle"]["S"]))
    eras = [(0, 3), (3, 6), (6, 9), (9, 12), (12, 14)]
    for name, marks in sc:
        prev = None
        for d in sorted(marks):
            bl, ni, tot = marks[d]
            if prev is not None:
                dl = [a - b for a, b in zip(bl, prev[0])]; dt = tot - prev[2]
                sh = [x / dt for x in dl]
                top = sorted(range(NL), key=lambda i: -sh[i])[:4]
                print("%-8s to day %d: top lines %s; eras %s" % (name, d, ", ".join("%d: %.0f%%" % (i + 1, 100 * sh[i]) for i in top),
                      " ".join("%.0f%%" % (100 * sum(sh[a:b])) for a, b in eras)))
            prev = (bl, ni, tot)

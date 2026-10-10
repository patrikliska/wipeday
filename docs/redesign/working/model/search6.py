import sys, os
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from iter2 import mk_budget
import search4
from search4 import job

search4.NAMES = [("idler_dbl", "idler", {}), ("casual", "casual", {}), ("active", "active", {}), ("optimal", "optimal", {})]

def configs_old():
    out = []
    for a in (0.2, 0.22):
        L0 = 1e11 / 10 ** (1 / a)
        for early in ((1.3, 1.4, 1.6, 2.0), (1.6, 1.8, 2.0, 2.5), (2.0, 2.2, 2.5, 3.0)):
            for b5 in (10.0, 20.0):
                for bl in (30.0, 60.0):
                    lines = list(early) + [b5, bl, bl, bl, bl]
                    over = dict(out_ratio=4.75, grip_p=0.005, expo=a, L0=L0, rank_mult=2.0, crown_mode="hybrid",
                                rank_rule="spread", budget=mk_budget(lines))
                    out.append(("a=%.2f early=%s b5=%g bl=%g" % (a, ",".join("%g" % x for x in early), b5, bl), over))
    return out


def configs():
    out = []
    for early in ((1.3, 1.4, 1.6, 2.0), (1.4, 1.6, 1.8, 2.2)):
        for b5 in (10.0, 15.0):
            for age in (16, 20, 24):
                lines = list(early) + [b5, 30.0, 30.0, 30.0, 30.0]
                over = dict(out_ratio=4.75, grip_p=0.005, expo=0.2, L0=1e6, rank_mult=2.0, crown_mode="hybrid",
                            crown_age=age * HOUR, rank_rule="spread", budget=mk_budget(lines))
                out.append(("early=%s b5=%g age=%dh" % (",".join("%g" % x for x in early), b5, age), over))
    return out

if __name__ == "__main__":
    days = int(sys.argv[1])
    cfgs = configs()
    NAMES = search4.NAMES
    tasks = [(cid, over, lab, n, days, ao) for cid, (label, over) in enumerate(cfgs) for (lab, n, ao) in NAMES]
    with Pool(26) as pool:
        res = pool.map(job, tasks)
    tab = {}
    for cid, lab, m in res:
        tab.setdefault(cid, {})[lab] = m
    out = []
    for cid, (label, over) in enumerate(cfgs):
        t = tab[cid]
        c = t["casual"]
        out.append("=== " + label)
        out.append("    gaps d30/d90/d180: active %.2f/%.2f/%.2f optimal %.2f/%.2f/%.2f idler %.2f/%.2f/%.2f" % tuple(
            x for k in ("active", "optimal", "idler_dbl") for x in (t[k]["E30"] / c["E30"], t[k]["E90"] / c["E90"], t[k]["E180"] / c["E180"])))
        for k in ("casual", "active", "optimal"):
            m = t[k]
            out.append("    %-9s E d7 %-7s d30 %-7s d90 %-7s d180 %-7s | nukes d7 %-2s d30 %-3s d90 %-3s d180 %-3s | lit d30 %-3s d180 %-3s | p e/m/l %.2f/%.2f/%.2f | nodes med %s | late dur %.1f d | first %.1fh" % (
                k, fmt(m["E7"]), fmt(m["E30"]), fmt(m["E90"]), fmt(m.get("E180")), m["n7"], m["n30"], m["n90"], m.get("n180"), m["lit30"], m.get("lit180"),
                m["p_early"], m["p_mid"], m["p_late"] or 0, m["nodes_med"], m["dur_late_med"] or 0, m["first"]))
    open("search6.txt", "w", newline="").write("\n".join(out) + "\n")
    print("\n".join(out))

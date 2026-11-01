import sys, os
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from iter2 import mk_budget
from search import metrics, SNAPS

NAMES = [("idler", "idler", {"rule": "crown"}), ("idler_dbl", "idler", {}), ("casual", "casual", {}),
         ("active", "active", {}), ("optimal", "optimal", {}), ("optimal_c", "optimal", {"rule": "crown"})]

def job(args):
    cid, over, label, name, days, aover = args
    p = Params(**over)
    pl = Player(p, archetype(name, **aover), seed=11)
    pl.play(days, snapshot_days=[d for d in SNAPS if d <= days])
    return cid, label, metrics(pl)

def configs():
    out = []
    for mode in ("marginal", "hybrid", "eager"):
        for b5, bl in ((10.0, 30.0), (30.0, 100.0)):
            for rr in (None, "spread"):
                lines = [1.3, 1.4, 1.6, 2.0, b5, bl, bl, bl, bl]
                over = dict(out_ratio=4.75, grip_p=0.005, expo=0.2, L0=1e6, rank_mult=2.0, crown_mode=mode,
                            rank_rule=rr, budget=mk_budget(lines))
                out.append(("mode=%s b5=%g bl=%g ranks=%s" % (mode, b5, bl, rr or "policy"), over))
    return out

if __name__ == "__main__":
    days = int(sys.argv[1])
    cfgs = configs()
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
        out.append("    gaps d30/d90: active %.2f/%.2f optimal %.2f/%.2f optimal_c %.2f/%.2f idler %.2f/%.2f idler_dbl %.2f/%.2f" % tuple(
            x for k in ("active", "optimal", "optimal_c", "idler", "idler_dbl") for x in (t[k]["E30"] / c["E30"], t[k]["E90"] / c["E90"])))
        for k in ("casual", "optimal", "optimal_c"):
            m = t[k]
            out.append("    %-9s E d7 %-7s d30 %-7s d90 %-7s d180 %-7s | nukes d30 %-3s d90 %-3s d180 %-3s | lit d30 %-3s full %-5s | p e/m/l %.2f/%.2f/%.2f | nodes med %s | late dur %.1f d" % (
                k, fmt(m["E7"]), fmt(m["E30"]), fmt(m["E90"]), fmt(m.get("E180")), m["n30"], m["n90"], m.get("n180"), m["lit30"], m["full"],
                m["p_early"], m["p_mid"], m["p_late"] or 0, m["nodes_med"], m["dur_late_med"] or 0))
    open("search4.txt", "w", newline="").write("\n".join(out) + "\n")
    print("\n".join(out))

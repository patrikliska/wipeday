"""Parallel search over the meta levers, scored against the canon N-targets.

python -I search.py <days> <out.txt>
"""
import sys, os, math, itertools, json
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from iter2 import mk_budget

SNAPS = (1, 7, 14, 30, 60, 90, 120, 180)


def metrics(pl):
    snaps = {round(s["day"]): s for s in pl.daily}
    m = {}
    for d in SNAPS:
        if d in snaps:
            m["E%d" % d] = snaps[d]["E"]
            m["n%d" % d] = snaps[d]["nukes"]
            m["lit%d" % d] = snaps[d]["lit"]
    full = None
    for s in pl.daily:
        if s["lit"] >= pl.p.tree_count and full is None:
            full = s["day"]
    m["full"] = full
    ph = {"early": [], "mid": [], "late": []}
    nodes_later = []
    durs_late = []
    for r in pl.runs:
        day = (r["t1"] - pl.t_first) / DAY
        key = "early" if r["index"] <= 5 else ("mid" if day <= 30 else "late")
        ph[key].append(r["power"])
        if r["index"] >= 2:
            nodes_later.append(r["nodes"])
        if day > 30:
            durs_late.append(r["dur"])
    for k, v in ph.items():
        m["p_" + k] = math.exp(sum(math.log(x) for x in v) / len(v)) if v else None
    m["nodes_med"] = sorted(nodes_later)[len(nodes_later) // 2] if nodes_later else None
    m["dur_late_med"] = sorted(durs_late)[len(durs_late) // 2] / DAY if durs_late else None
    m["first"] = pl.runs[0]["t1"] / HOUR if pl.runs else None
    m["max"] = pl.max_number
    return m


def job(args):
    cid, over, name, days, aover = args
    p = Params(**over)
    a = archetype(name, **aover)
    pl = Player(p, a, seed=11)
    pl.play(days, snapshot_days=[d for d in SNAPS if d <= days])
    return cid, name, metrics(pl)


def configs():
    out = []
    for a in (0.2, 0.25):
        L0 = 1e11 / 10 ** (1 / a)
        for b5 in (4.0, 10.0):
            for bl in (30.0, 100.0, 300.0, 1000.0):
                lines = [1.3, 1.4, 1.6, 2.0, b5, bl, bl, bl, bl]
                over = dict(out_ratio=4.75, grip_p=0.005, expo=a, L0=L0, budget=mk_budget(lines))
                out.append(("a=%.2f b5=%g bl=%g" % (a, b5, bl), over))
    return out


def score(res):
    c, ac, op, idl = res["casual"], res["active"], res["optimal"], res["idler"]
    s = []
    for d in (30, 90):
        k = "E%d" % d
        if k in c and c[k]:
            s.append("act/cas d%d %.2f" % (d, ac[k] / c[k]))
            s.append("opt/cas d%d %.2f" % (d, op[k] / c[k]))
            s.append("idl/cas d%d %.2f" % (d, idl[k] / c[k]))
    return ", ".join(s)



def run_search(cfgs, days, outp, names=None):
    names = names or [("idler", {"rule": "crown"}), ("casual", {}), ("active", {}), ("optimal", {})]
    tasks = []
    for cid, (label, over) in enumerate(cfgs):
        for (n, ao) in names:
            tasks.append((cid, over, n, days, ao))
    with Pool(min(26, len(tasks))) as pool:
        results = pool.map(job, tasks)
    table = {}
    for cid, name, m in results:
        table.setdefault(cid, {})[name] = m
    lines = []
    for cid, (label, over) in enumerate(cfgs):
        res = table[cid]
        lines.append("=== " + label)
        lines.append("    gaps: " + score(res))
        for n, _ in names:
            m = res[n]
            lines.append("    %-8s E d7 %-8s d30 %-8s d90 %-8s d120 %-8s | nukes d30 %-3s d90 %-3s | lit d30 %-3s full %-5s | p e/m/l %s/%s/%s | nodes med %s | late dur %s d" % (
                n, fmt(m.get("E7")), fmt(m.get("E30")), fmt(m.get("E90")), fmt(m.get("E120")),
                m.get("n30"), m.get("n90"), m.get("lit30"), m.get("full"),
                "%.2f" % m["p_early"] if m["p_early"] else "-", "%.2f" % m["p_mid"] if m["p_mid"] else "-",
                "%.2f" % m["p_late"] if m["p_late"] else "-", m.get("nodes_med"),
                "%.1f" % m["dur_late_med"] if m["dur_late_med"] else "-"))
    with open(outp, "w", newline="") as f:
        f.write("\n".join(lines) + "\n")
    return table


if __name__ == "__main__":
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 120
    outp = sys.argv[2] if len(sys.argv) > 2 else "search_out.txt"
    run_search(configs(), days, outp)
    print(open(outp).read())

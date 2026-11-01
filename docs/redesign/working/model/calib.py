"""Compact lifetime summary for tuning: one line per archetype."""
import sys, os, time, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *

SNAPS = (1, 3, 7, 14, 30, 60, 90, 120, 180)


def budget_from(lines, base=None, **cols):
    b = base or canon_budget()
    out = []
    for r in range(9):
        row = dict(b[r])
        row["lines"] = lines[r]
        for k, v in cols.items():
            row[k] = v[r]
        out.append(row)
    return out


def life(over, name, days, seed=11, group=None):
    p = Params(**over)
    a = archetype(name)
    pl = Player(p, a, seed=seed, group=group)
    pl.play(days, snapshot_days=[d for d in SNAPS if d <= days])
    return pl


def phase_of(run, pl):
    day = (run["t1"] - pl.t_first) / DAY
    if run["index"] <= 5:
        return "early"
    if day <= 30:
        return "mid"
    return "late"


def summary(pl, days):
    rows = []
    snaps = {round(s["day"]): s for s in pl.daily}
    e = " ".join("d%d:%s/%d" % (d, fmt(snaps[d]["E"]), snaps[d]["nukes"]) for d in SNAPS if d in snaps)
    ph = {"early": [], "mid": [], "late": []}
    for r in pl.runs[1:]:
        ph[phase_of(r, pl)].append(r)

    def gm(xs):
        xs = [x for x in xs if x > 0]
        return math.exp(sum(math.log(x) for x in xs) / len(xs)) if xs else float("nan")

    pw = " ".join("%s x%.2f [%.2f-%.2f] dur %s" % (k, gm([r["power"] for r in v]),
                                                   min([r["power"] for r in v] or [0]), max([r["power"] for r in v] or [0]),
                                                   hms(sorted(r["dur"] for r in v)[len(v) // 2]) if v else "-")
                  for k, v in ph.items() if v)
    lit30 = snaps.get(30, {}).get("lit")
    full = None
    for s in pl.daily:
        if s["lit"] >= pl.p.tree_count and full is None:
            full = s["day"]
    return "%s\n      %s | lit d30=%s (%.0f%%) full=%s max=%s" % (
        e, pw, lit30, 100 * (lit30 or 0) / pl.p.tree_count, full, fmt(pl.max_number))


def run_set(label, over, days=90, names=("idler", "casual", "active", "optimal")):
    print("=== " + label)
    out = {}
    for n in names:
        t = time.time()
        pl = life(over, n, days)
        out[n] = pl
        print("  %-8s (%4.1fs) %s" % (n, time.time() - t, summary(pl, days)))
    return out


if __name__ == "__main__":
    base = dict(out_ratio=4.5)
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    run_set("out 4.5, model budget v0", base, days)

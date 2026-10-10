"""Sensitivity of the casual's first week to each lever."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from iter2 import mk_budget, RUN

BASE_LINES = [1.3, 1.5, 2, 3, 4, 6, 8, 10, 12]


def week(label, name="casual", days=10, **over):
    o = dict(RUN)
    o["budget"] = mk_budget(BASE_LINES)
    o.update(over)
    p = Params(**o)
    pl = Player(p, archetype(name), seed=11)
    pl.play(days, snapshot_days=(1, 2, 3, 5, 7, 10))
    s = " ".join("d%g:%s/%d" % (x["day"], fmt(x["E"]), x["nukes"]) for x in pl.daily)
    pw = " ".join("%.1f" % r["power"] for r in pl.runs[:10])
    ls = " ".join("%.0f" % (pl.runs[i]["S"] / max(1, pl.runs[i - 1]["S"])) for i in range(1, min(10, len(pl.runs))))
    print("%-34s %s | power %s | S ratio %s" % (label, s, pw, ls))


if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else "casual"
    week("base", name)
    week("exponent 1/4 (L0 1e7)", name, expo=0.25, L0=1e7)
    week("exponent 1/5 (L0 1e6)", name, expo=0.2, L0=1e6)
    week("era costs x10 (Stone on)", name, era_costs=[1.5e3, 3e7, 2e11, 4e15])
    week("era costs x100 (Metal on)", name, era_costs=[1.5e3, 3e6, 2e12, 4e17])
    week("armored at nuke 4", name, armored_nukes=4)
    week("tree lines all 1", name, budget=mk_budget([1.0] * 9))
    week("no afterglow, no rush", name, afterglow=1.0, rush=(1.0, 30, 600))
    week("glow k 0.10", name, glow_k=0.10)
    week("milestones 200-400 x2", name, ms_pay={10: 2.0, 100: 2.0, 200: 2.0, 300: 2.0, 400: 2.0})
    week("growth +0.02", name, g1=1.17)
    week("night base 8h", name, night_base=8.0)

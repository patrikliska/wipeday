"""Scan run-economy levers for N1-N4: continuous first-nuke time vs the casual's day-1 yield."""
import sys, os, itertools
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *


def first_day(over, arch_over=None):
    res = {}
    p = Params(**over)
    # continuous active, 6 taps/s
    a = archetype("first_hour", **(arch_over or {}))
    pl = Player(p, a, seed=7)
    pl.play(1)
    r1 = pl.runs[0] if pl.runs else None
    res["cont_first"] = r1["dur"] if r1 else None
    ev = r1["events"] if r1 else pl.run.events
    hands = [e[1] for e in ev if e[2].startswith("hand")]
    res["hand1"] = hands[0] if hands else None
    eras = {e[2]: e[1] for e in ev if e[2].startswith("era")}
    res["eras"] = eras
    res["tap_share"] = r1["tap_share"] if r1 else None
    # casual and idler: yield at the 21:00 check-in
    for name in ("casual", "idler"):
        p2 = Params(**over)
        a2 = archetype(name)
        pl2 = Player(p2, a2, seed=7)
        pl2.play(1)
        first = pl2.runs[0] if pl2.runs else None
        res[name + "_first"] = first["t1"] if first else None
        res[name + "_L24"] = pl2.L
    return res


def show(label, over, arch_over=None):
    r = first_day(over, arch_over)
    print("%-48s first(cont)=%-7s hand1=%-6s timber=%-6s stone=%-6s metal=%-6s | casual nuke=%-7s idler nuke=%-7s" % (
        label, hms(r["cont_first"]) if r["cont_first"] else "-", hms(r["hand1"]) if r["hand1"] else "-",
        hms(r["eras"].get("era 1", 0)), hms(r["eras"].get("era 2", 0)), hms(r["eras"].get("era 3", 0)),
        hms(r["casual_first"]) if r["casual_first"] else "-", hms(r["idler_first"]) if r["idler_first"] else "-"))
    return r


if __name__ == "__main__":
    show("canon", {})
    show("L0 1e9", dict(L0=1e9))
    show("L0 3e9", dict(L0=3e9))
    show("cost_ratio 20", dict(cost_ratio=20.0))
    show("out_ratio 5", dict(out_ratio=5.0))
    show("cost 20, out 5", dict(cost_ratio=20.0, out_ratio=5.0))
    show("grip_p 0.005", dict(grip_p=0.005))
    show("hustle 1.5", dict(hustle_max=1.5))
    show("era x3 costs", dict(era_costs=[4.5e3, 9e6, 6e10, 1.2e15]))
    show("hand x1000", dict(hand_factor=1000.0))
    show("g1 1.17", dict(g1=1.17, g_step=0.007))

import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *


def life(label, name, days, show_runs=40, **over):
    t = time.time()
    p = Params(**over)
    a = archetype(name)
    pl = Player(p, a, seed=11)
    pl.play(days, snapshot_days=(1, 7, 14, 30, 60, 90, 180))
    print("== %s / %s / %d days  (%.1fs)" % (label, name, days, time.time() - t))
    print("  #  start    dur      online  gain     E        L         power  nodes lit glow   tree   morale ranks era tap%  flot%")
    for r in pl.runs[:show_runs]:
        print("  %-3d %-8s %-8s %-7s %-8s %-8s %-9s %-6.2f %-5d %-3d %-6s %-6s %-6.2f %-5d %-3d %-5.1f %-5.1f" % (
            r["index"], hms(r["t0"]), hms(r["dur"]), hms(r["online"]), fmt(r["gain"]), fmt(r["E"]), fmt(r["L"]),
            r["power"], r["nodes"], r["lit"], fmt(r["glow"]), fmt(r["tree_lines"]), r["morale"], r["ranks"], r["era"],
            100 * r["tap_share"], 100 * r["flot_share"]))
    for s in pl.daily:
        print("  day %-4g E=%-9s nukes=%-4d lit=%-4d L=%-9s scrap=%d" % (s["day"], fmt(s["E"]), s["nukes"], s["lit"], fmt(s["L"]), s["scrap"]))
    return pl


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "canon"
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    arch = sys.argv[3] if len(sys.argv) > 3 else "casual"
    sets = {
        "canon": {},
        "out45": dict(out_ratio=4.5),
    }
    life(which, arch, days, **sets[which])

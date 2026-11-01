import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *


def trace(label, minutes=20, **over):
    arch_over = over.pop("arch", {})
    p = Params(**over)
    a = archetype("first_hour", **arch_over)
    pl = Player(p, a, seed=7)
    pl.t_first = 0
    pl.last_t = 0
    pl.last_cmd = 0
    pl.new_run(0)
    print("==", label)
    marks = {}
    for s in range(minutes * 60):
        pl.step(s, a["tps"])
        if pl.L >= 1e8 and "1e8" not in marks:
            marks["1e8"] = s
        if pl.L >= 1e11 and "1e11" not in marks:
            marks["1e11"] = s
        if s % 120 == 119:
            r = pl.run
            print("%5s L=%8s man=%8s unm=%8s tap/s=%8s era=%d grip=%d isl=%d roster=%d owned=%s mk=%s" % (
                hms(s + 1), fmt(pl.L), fmt(pl.man), fmt(pl.unm),
                fmt(pl.tap_steady(pl.man + pl.unm) * a["tps"]), r.era, r.grip, r.island, r.roster,
                r.owned[:9], r.mk[:9]))
    print("marks", {k: hms(v) for k, v in marks.items()})
    return pl


if __name__ == "__main__":
    trace("canon")
    trace("no hustle, no fell, no flotsam", hustle_max=1.0, fell_bonus=0.0, flot_first=1e9, flot_min=1e9, flot_max=1e9)

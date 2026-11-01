"""Run 1 without nuking: when does lifetime cross each decade? (continuous and casual)"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *


def decades(label, arch="first_hour", days=1, **over):
    arch_over = over.pop("arch_over", {})
    p = Params(first_min=10**12, **over)
    a = archetype(arch, **arch_over)
    pl = Player(p, a, seed=7)
    marks = {}

    orig_add = pl.add

    def add(x, kind):
        before = pl.L
        orig_add(x, kind)
        for e in range(6, 20):
            v = 10.0 ** e
            if before < v <= pl.L and e not in marks:
                marks[e] = pl.last_t if arch != "first_hour" else None
    pl.add = add
    # track time with a hook through step
    orig_step = pl.step

    def step(t, tps):
        before = pl.L
        orig_step(t, tps)
        for e in range(6, 20):
            v = 10.0 ** e
            if before < v <= pl.L and e not in marks2:
                marks2[e] = t
    marks2 = {}
    pl.step = step
    orig_settle = pl.settle_offline

    def settle(t):
        before = pl.L
        t0 = pl.last_t
        orig_settle(t)
        for e in range(6, 20):
            v = 10.0 ** e
            if before < v <= pl.L and e not in marks2:
                marks2[e] = ("offline before", t)
    pl.settle_offline = settle
    pl.play(days)
    ev = pl.run.events
    print("==", label)
    print("  decades:", ", ".join("1e%d@%s" % (e, hms(v) if not isinstance(v, tuple) else "<" + hms(v[1])) for e, v in sorted(marks2.items())))
    keys = [e for e in ev if e[2].startswith("era") or e[2].startswith("hand") or e[2].startswith("island") or e[2].startswith("grip")]
    print("  events:", ", ".join("%s %s" % (hms(e[1]), e[2]) for e in keys[:40]))
    print("  caught", pl.run.caught, "tap share", round(pl.run.tap_inc / pl.run.S, 3), "flot share", round(pl.run.flot_inc / pl.run.S, 3))
    return pl


if __name__ == "__main__":
    decades("canon, continuous 6 taps/s")
    decades("canon, continuous, no Hustle", hustle_max=1.0)
    decades("canon, casual day 1", arch="casual")
    decades("canon, idler day 1", arch="idler")

"""In-run elasticity: supplies made in one casual day-run as a function of a fixed power multiplier."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from iter2 import mk_budget


def day_run(P, over, name="casual", hours=24, kit=True):
    p = Params(**over)
    a = archetype(name, blowback=False)
    pl = Player(p, a, seed=3)
    # fixed meta: power P applied as tree lines; no nukes during the run
    pl.eff["lines"] = P
    if kit:
        pl.auto |= {"kit1", "old_friend", "deep_cellars"}
    pl.nukes = 1  # Afterglow and the Magnet, no agenda tools
    pl.want_nuke = lambda t, c: False
    pl.update_tree = lambda: None
    sched = [(21 * HOUR + o - 21 * HOUR, d) for (o, d) in a["sessions"]]
    t0 = 21 * HOUR
    pl.t_first = 0
    pl.last_t = t0
    pl.last_cmd = t0
    pl.new_run(t0)
    times = []
    for day in range(2):
        for (off, dur) in a["sessions"]:
            t = day * DAY + off
            if t < t0 or t >= t0 + hours * HOUR:
                continue
            times.append((t, dur))
    for (t, dur) in times:
        pl.session(t, dur, a["tps"])
    pl.settle_offline(t0 + hours * HOUR)
    return pl.run.S, pl.run.max_era


if __name__ == "__main__":
    base = dict(out_ratio=4.75, grip_p=0.005, budget=mk_budget([1] * 9))
    variants = {
        "tuned run": base,
        "canon run (out 5.5, p 1%)": dict(budget=mk_budget([1] * 9)),
        "ms 200-400 x2": dict(base, ms_pay={10: 2.0, 100: 2.0, 200: 2.0, 300: 2.0, 400: 2.0}),
        "growth 1.20": dict(base, g1=1.20, g_step=0.008),
        "island x1.5": dict(base, island_mult=1.5),
        "eras x1.5": dict(base, era_mult=1.5),
    }
    which = sys.argv[1:] or list(variants)
    for name in which:
        over = variants[name]
        prev = None
        row = []
        for e in range(0, 13, 2):
            P = 10.0 ** e
            S, era = day_run(P, over)
            el = (math.log10(S) - math.log10(prev)) / 2 if prev else float("nan")
            row.append("P=1e%d S=%s (el %.2f)" % (e, fmt(S), el))
            prev = S
        print("%-28s %s" % (name, " | ".join(row)))

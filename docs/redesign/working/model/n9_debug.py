import sys, os, copy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import PROPOSAL

def snap_at(over, day, name="active"):
    p = Params(**over)
    pl = Player(p, archetype(name), seed=11)
    holder = {}
    def before(pl_, t):
        if "snap" not in holder and t >= (day - 1) * DAY + 7 * HOUR:
            holder["snap"] = (copy.deepcopy(pl_), t)
    pl.play(day, hooks={"before_session": before})
    return holder["snap"]

def hour(snap, t, tps, flot, buy=False, **flags):
    q = copy.deepcopy(snap)
    q.settle_offline(t); q.recalc()
    for k, v in flags.items():
        setattr(q.p, k, v)
    q.recalc()
    q.no_buy = not buy; q.no_flot = not flot
    r = q.run
    S0, t0_, l0, f0 = r.S, r.tap_inc, r.line_inc, r.flot_inc
    for s in range(3600):
        q.step(t + s, tps)
    return r.S - S0, r.tap_inc - t0_, r.line_inc - l0, r.flot_inc - f0, q

if __name__ == "__main__":
    for day in (14, 30):
        snap, t = snap_at(PROPOSAL, day)
        q0 = copy.deepcopy(snap); q0.settle_offline(t); q0.recalc()
        print("day", day, "nuke", snap.nukes, "run age h", (t - snap.run.t0) / 3600, "manned", fmt(q0.man), "unmanned", fmt(q0.unm), "hands", sum(snap.run.manned), "owned", snap.run.owned)
        idle = hour(snap, t, 0.0, False)
        print("  idle      S %s" % fmt(idle[0]))
        for lab, tps, flot, fl in (("taps only", 6.0, False, dict(rush=(1.0, 30, 600))),
                                   ("taps+rush", 6.0, False, {}),
                                   ("taps+rush+flotsam", 6.0, True, {}),
                                   ("flotsam no crates", 6.0, True, dict(crate_secs=0.0)),):
            S, tp, ln, fo, q = hour(snap, t, tps, flot, **fl)
            print("  %-20s S %-8s ratio %.2f | taps %.0f%% lines %.0f%% flotsam %.0f%% | caught %d" % (lab, fmt(S), S / idle[0], 100 * tp / S, 100 * ln / S, 100 * fo / S, q.run.caught))

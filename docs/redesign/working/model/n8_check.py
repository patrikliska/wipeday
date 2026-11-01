import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import PROPOSAL

def shares(over):
    p = Params(**over)
    pl = Player(p, archetype("first_hour"), seed=7, record_seconds=True)
    pl.play(1)
    s = [x for x in pl.seconds if x[0] == 1]
    def sh(sel, driven):
        t = sum(x[2] + (x[5] if driven else 0) for x in sel)
        tot = sum(x[2] + x[3] for x in sel)
        return 100 * t / tot
    m1 = [x for x in s if x[1] <= 60]
    m10 = [x for x in s if x[1] >= 600 and not x[4]]
    return sh(m1, False), sh(m1, True), sh(m10, False), sh(m10, True), pl.runs[0]["dur"], [e for e in pl.runs[0]["events"] if e[2] == "hand 1"][0][0]

for lab, over in (("P1", PROPOSAL), ("P1 tap base 2", dict(PROPOSAL, tap_base=2.0)), ("P1 tap base 3", dict(PROPOSAL, tap_base=3.0)), ("P1 tap base 5", dict(PROPOSAL, tap_base=5.0))):
    a, b, c, d, dur, h1 = shares(over)
    print("%-16s minute 0-1: direct taps %.0f%%, tap-driven (taps + unmanned lines) %.0f%% | from minute 10 outside bursts: direct %.0f%%, tap-driven %.0f%% | first nuke %s, first hand %s" % (lab, a, b, c, d, hms(dur), hms(h1)))

p = Params(**PROPOSAL)
pl = Player(p, archetype("casual"), seed=11)
pl.play(30)
zero = [(hms(t - pl.t_first), ri) for (t, n, ri) in pl.checkins if n == 0]
print("casual check-ins with no purchase (time since start, run):", zero)

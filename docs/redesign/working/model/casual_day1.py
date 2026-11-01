import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import PROPOSAL, CANON
for lab, over in (("P1", PROPOSAL), ("canon", CANON)):
    p = Params(**over)
    pl = Player(p, archetype("casual"), seed=11)
    rows = []
    def before(pl_, t):
        if t < 2 * DAY:
            pl_.settle_offline(t)
            r = pl_.run
            rows.append("%s: made %s, era %d, hands %d, yield %d" % (hms(t), fmt(pl_.L), r.era, sum(r.manned), pl_.yield_now(t)))
    pl.play(2, hooks={"before_session": before})
    print(lab, "|", " ; ".join(rows[:4]))
    r1 = pl.runs[0]
    print("   first nuke at", hms(r1["t1"]), "gain", r1["gain"], "events:", ", ".join("%s %s" % (hms(e[1]), e[2]) for e in r1["events"] if e[2].startswith(("era", "hand", "island"))))

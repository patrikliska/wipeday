import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import PROPOSAL
for rule in ("busy", "literal"):
    for name in ("first_hour", "casual", "active"):
        p = Params(**dict(PROPOSAL, batch_rule=rule))
        pl = Player(p, archetype(name), seed=7)
        pl.play(3)
        r = pl.runs[0]
        print("%-8s %-10s first nuke wall %-8s online %-8s | runs by day 3: %d, glass ever %s" % (rule, name, hms(r["t1"] - pl.t_first), hms(r["online"]), len(pl.runs), fmt(pl.E)))

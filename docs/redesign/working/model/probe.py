import sys, time, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *

def run1(arch_name="first_hour", **over):
    p = Params(**over)
    a = archetype(arch_name)
    pl = Player(p, a, seed=7, record_seconds=True)
    pl.play(1)
    return pl

if __name__ == "__main__":
    t = time.time()
    pl = run1()
    print("elapsed", round(time.time() - t, 2))
    for rr in pl.runs[:2]:
        print("run", rr["index"], "dur", hms(rr["dur"]), "S", fmt(rr["S"]), "gain", rr["gain"], "tap share", round(rr["tap_share"], 3))
        for ev in rr["events"][:60]:
            print("   ", hms(ev[0]), ev[2])
    r = pl.run
    print("current run", r.index, "online", r.online, "L", fmt(pl.L))

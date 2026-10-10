import sys, os
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import V2
from run_all import w_run1, e_at
from group import play_group, G5

def w_g(args):
    seed, = args
    return play_group(V2, G5, 50, seed=seed)

if __name__ == "__main__":
    with Pool(12) as pool:
        r1 = pool.map(w_run1, [(dict(V2, first_crate_secs=s), "first_hour", {}) for s in (600.0, 300.0, 180.0, 120.0)])
        gs = pool.map(w_g, [(7,), (11,), (23,)])
    for s, (pl, marks, snaps) in zip((600, 300, 180, 120), r1):
        ev = pl.runs[0]["events"]
        f = lambda k: next((hms(on) for (on, w, x) in ev if x == k), "-")
        L = pl.L
        # time when lifetime passed 3e7 and 1e9 is not tracked; use snaps
        print("first crate %4ds: Timber %s Mara %s 2nd hand %s Sorting %s Stone %s SheetMetal %s yield5 %s nuke %s; made at 5:00 %s, 10:00 %s" % (
            s, f("era 1"), f("hand 1"), f("hand 2"), f("island 1"), f("era 2"), f("era 3"), hms(marks[5][0]) if 5 in marks else "-",
            hms(pl.runs[0]["dur"]), fmt(snaps.get(300)), fmt(snaps.get(600))))
    for seed, g in zip((7, 11, 23), gs):
        lj = g["late"]
        cas30 = e_at(g["casual"], 30)["E"]
        print("seed", seed, "casual d30", fmt(cas30))
        for r in lj.runs[:20]:
            print("   late run %d day %.1f gain %s E %s" % (r["index"], (r["t1"]) / DAY, fmt(r["gain"]), fmt(r["E"])))

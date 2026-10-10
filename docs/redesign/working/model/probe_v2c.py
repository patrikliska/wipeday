import sys, os, math
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import V2, V2_ALONE
from run_all import e_at
from group import w_group, G5
from run_v2 import w_hour_w, scrap_windows, gmean

TH = (3e7, 1e8, 3e8, 5e8, 1e9)
def w_pad(args):
    seed, = args
    pl = Player(Params(**V2_ALONE), archetype("first_hour"), seed=seed)
    marks = {}
    orig = pl.add
    def add(x, kind):
        b = pl.L
        orig(x, kind)
        for v in TH:
            if b < v <= pl.L and v not in marks:
                marks[v] = pl.run.online
    pl.add = add
    pl.play(1)
    return marks

if __name__ == "__main__":
    LOCK1 = [("crate", 0.455), ("fuel_drum", 0.40), ("adrenaline", 0.06), ("drowned_drone", 0.07), ("sealed_locker", 0.01), ("bottle", 0.005)]
    with Pool(28) as pool:
        pads = pool.map(w_pad, [(s,) for s in range(1, 13)])
        hrs = pool.map(w_hour_w, [(dict(V2, rain_flot=1.25, rally=(3.0, 60)), 30, False), (dict(V2, rain_flot=1.25, rally=(3.0, 60)), 30, True)])
        g75 = pool.map(w_group, [(dict(V2, late_tide_below=0.75), G5, 60, s, True, True) for s in (7, 11, 23)])
        glk = pool.map(w_group, [(dict(V2, flot=LOCK1), G5, 180, s, True, True) for s in (7, 11, 23)])
    for v in TH:
        ts = sorted(m[v] for m in pads)
        print("lifetime %s at online %s .. %s (median %s)" % (fmt(v), hms(ts[0]), hms(ts[-1]), hms(ts[len(ts) // 2])))
    c, r = hrs[0][2], hrs[1][2]
    print("rain x1.25 + Rally x3: clear %.2f rain %.2f weighted %.2f" % (c["active"]["S"] / c["idle"]["S"], r["active"]["S"] / r["idle"]["S"],
          0.8 * c["active"]["S"] / c["idle"]["S"] + 0.2 * r["active"]["S"] / r["idle"]["S"]))
    reach = []
    for g in g75:
        tgt = e_at(g["casual"], 30)["E"]
        reach.append(next((round(s["day"] - 29) for s in g["late"].daily if s["day"] >= 30 and s["E"] >= tgt), None))
    print("G5 Late Tide below 75%%: late joiner reaches the day-30 casual after %s days; casual d7 %s d30 %s; gaps d30 active %.2f optimal %.2f idler %.2f" % (
        reach, fmt(gmean([e_at(g["casual"], 7)["E"] for g in g75])), fmt(gmean([e_at(g["casual"], 30)["E"] for g in g75])),
        gmean([e_at(g["active"], 30)["E"] / e_at(g["casual"], 30)["E"] for g in g75]),
        gmean([e_at(g["optimal"], 30)["E"] / e_at(g["casual"], 30)["E"] for g in g75]),
        gmean([e_at(g["idler"], 30)["E"] / e_at(g["casual"], 30)["E"] for g in g75])))
    for n in ("casual", "active", "optimal"):
        ss = [scrap_windows(g[n]) for g in glk]
        print("G5 Sealed Locker 1%%: %-8s 7-day mean %.2f p90 %.2f max %.2f" % (n, sum(s["mean"] for s in ss) / 3, max(s["p90"] for s in ss), max(s["max"] for s in ss)))

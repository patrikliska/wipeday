import sys, os
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from iter2 import mk_budget
from search import metrics

def job(args):
    label, over, name, aover = args
    p = Params(**over)
    pl = Player(p, archetype(name, **aover), seed=11)
    pl.play(90, snapshot_days=(7, 30, 90))
    m = metrics(pl)
    return label, name, m

if __name__ == "__main__":
    base = dict(out_ratio=4.75, grip_p=0.005, expo=0.2, L0=1e6, budget=mk_budget([1.3, 1.4, 1.6, 2, 10, 100, 100, 100, 100]))
    waking = [(h * HOUR, 300) for h in range(7, 24)]
    tasks = [
        ("casual", base, "casual", {}),
        ("optimal (canon)", base, "optimal", {}),
        ("optimal spread ranks", base, "optimal", {"rank_policy": "spread"}),
        ("optimal crown rule", base, "optimal", {"rule": "crown"}),
        ("optimal 07-23 only", base, "optimal", {"sessions": waking}),
        ("optimal 3 taps-free", base, "optimal", {"tps": 0.0}),
        ("optimal all three", base, "optimal", {"rank_policy": "spread", "rule": "crown", "sessions": waking}),
        ("casual 6 checkins", base, "casual", {"sessions": [(h * HOUR, 300) for h in (8, 10, 13, 16, 19, 22)]}),
    ]
    with Pool(len(tasks)) as pool:
        res = pool.map(job, tasks)
    cas = res[0][2]
    for label, name, m in res:
        print("%-24s E d7 %-8s d30 %-8s d90 %-8s | /casual d30 %.2f d90 %.2f | nukes d30 %s d90 %s" % (
            label, fmt(m["E7"]), fmt(m["E30"]), fmt(m["E90"]), m["E30"] / cas["E30"], m["E90"] / cas["E90"], m["n30"], m["n90"]))

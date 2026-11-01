import sys, os, time
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import PROPOSAL
from run_all import w_life, e_at

if __name__ == "__main__":
    p = Params(**PROPOSAL)
    print("ring totals (glass):", [fmt(c[1][-1]) for c in p.nodes], "tree total", fmt(p.tree_total), "nodes", p.tree_count)
    print("ring node costs min/max:", [(fmt(c[0][0]), fmt(c[0][-1])) for c in p.nodes])
    print("lifetime supplies for glass ever G: L = L0 * G^5 ->", {g: fmt(p.L0 * g ** 5) for g in (10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 3e9)})
    t = time.time()
    with Pool(4) as pool:
        pls = pool.map(w_life, [(PROPOSAL, n, {}, 365, 11, None) for n in ("casual", "optimal", "active", "idler")])
    for n, pl in zip(("casual", "optimal", "active", "idler"), pls):
        cells = []
        for d in (180, 240, 300, 365):
            s = e_at(pl, d)
            cells.append("d%d E %s nukes %d lit %.0f%%" % (d, fmt(s["E"]), s["nukes"], 100 * s["lit"] / p.tree_count))
        full = next((s["day"] for s in pl.daily if s["lit"] >= p.tree_count), None)
        print("%-8s %s | full %s | largest number %s" % (n, " | ".join(cells), full, fmt(pl.max_number)))
    print("%.0fs" % (time.time() - t))

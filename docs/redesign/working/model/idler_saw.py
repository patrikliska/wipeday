import sys, os
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from configs import PROPOSAL, V2B, V2C, V2
from run_all import w_life, e_at
if __name__ == "__main__":
    cf = [("P1", PROPOSAL), ("V2B", V2B), ("V2C", V2C), ("V2", V2)]
    tasks = [(o, n, {}, 120, 11, None) for _, o in cf for n in ("idler", "casual")]
    with Pool(8) as pool:
        pls = pool.map(w_life, tasks)
    for i, (lab, _) in enumerate(cf):
        idl, cas = pls[2 * i], pls[2 * i + 1]
        print(lab, "idler/casual by day:", " ".join("d%d %.2f" % (d, e_at(idl, d)["E"] / max(1, e_at(cas, d)["E"])) for d in range(20, 101, 4)))
        print("    idler nukes (day):", [round((r["t1"] - idl.t_first) / DAY, 1) for r in idl.runs])

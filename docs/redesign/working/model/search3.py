import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from iter2 import mk_budget
from search import run_search

def configs():
    out = []
    a = 0.2
    L0 = 1e6
    for mode in ("marginal", "eager", "average"):
        for b5 in (10.0, 30.0, 100.0):
            for bl in (30.0, 100.0, 300.0):
                for rm in (2.0, 3.0):
                    lines = [1.3, 1.4, 1.6, 2.0, b5, bl, bl, bl, bl]
                    over = dict(out_ratio=4.75, grip_p=0.005, expo=a, L0=L0, rank_mult=rm, crown_mode=mode, budget=mk_budget(lines))
                    out.append(("mode=%s b5=%g bl=%g rank=%g" % (mode, b5, bl, rm), over))
    return out

if __name__ == "__main__":
    run_search(configs(), int(sys.argv[1]), sys.argv[2])
    print(open(sys.argv[2]).read())

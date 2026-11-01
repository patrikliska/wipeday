import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from iter2 import mk_budget
from search import run_search

def configs():
    out = []
    for a in (1/3, 0.29, 0.25):
        L0 = 1e11 / 10 ** (1 / a)
        for me in (0.01, 0.02):
            for rm in (2.0, 3.0):
                for b5, bl in ((3.0, 10.0), (6.0, 30.0)):
                    lines = [1.2, 1.3, 1.5, 2.0, b5, bl, bl, bl, bl]
                    over = dict(out_ratio=4.75, grip_p=0.005, expo=a, L0=L0, morale_entry=me, rank_mult=rm, budget=mk_budget(lines))
                    out.append(("a=%.2f morale=%.2f rank=%g b5=%g bl=%g" % (a, me, rm, b5, bl), over))
    return out

if __name__ == "__main__":
    run_search(configs(), int(sys.argv[1]), sys.argv[2])
    print(open(sys.argv[2]).read())

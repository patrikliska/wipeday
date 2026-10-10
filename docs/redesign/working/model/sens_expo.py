import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sens_early import week
from iter2 import mk_budget

if __name__ == "__main__":
    for name in ("casual", "optimal"):
        print("##", name)
        for a, L0 in ((0.25, 1e7), (0.2, 1e6)):
            for k in (0.25, 0.15, 0.10):
                week("a=%.2f k=%.2f" % (a, k), name, 14, expo=a, L0=L0, glow_k=k)

import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sens_early import week
from iter2 import mk_budget

if __name__ == "__main__":
    small = mk_budget([1.1, 1.2, 1.3, 1.5, 3, 10, 10, 10, 10])
    for name in ("casual", "optimal"):
        print("##", name)
        week("a=1/3 base", name, 30, expo=1/3, L0=1e8, budget=small)
        week("a=1/3 morale 0.01", name, 30, expo=1/3, L0=1e8, budget=small, morale_entry=0.01)
        week("a=1/3 rank x2", name, 30, expo=1/3, L0=1e8, budget=small, rank_mult=2.0)
        week("a=1/3 no morale, no ranks", name, 30, expo=1/3, L0=1e8, budget=small, morale_entry=0.0, rank_mult=1.0)
        week("a=1/3 no morale/ranks/blowback", name, 30, expo=1/3, L0=1e8, budget=small, morale_entry=0.0, rank_mult=1.0, blowback_per_day=0.0)
        week("a=1/3 none + no AG/rush", name, 30, expo=1/3, L0=1e8, budget=small, morale_entry=0.0, rank_mult=1.0, blowback_per_day=0.0, afterglow=1.0, rush=(1.0, 30, 600))
        week("a=1/4 none", name, 30, expo=0.25, L0=1e7, budget=small, morale_entry=0.0, rank_mult=1.0, blowback_per_day=0.0)

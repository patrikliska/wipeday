"""Configurable iteration: python -I iter4.py <mode> <days> key=value ...

mode: summary | <archetype name> (run table)
keys: lines=1,2,... (ring lines budget), any Params field as python literal.
"""
import sys, os, ast
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from calib import *
from iter2 import mk_budget
from probe_life import life as life_table

BASE = dict(out_ratio=4.75, grip_p=0.005, expo=0.25, L0=1e7)
BASE_LINES = [1.3, 1.4, 1.6, 2, 4, 30, 100, 300, 600]


def parse(args):
    over = dict(BASE)
    lines = list(BASE_LINES)
    cols = {}
    for a in args:
        k, v = a.split("=", 1)
        if k == "lines":
            lines = [float(x) for x in v.split(",")]
        elif k.startswith("col_"):
            cols[k[4:]] = [float(x) for x in v.split(",")]
        else:
            over[k] = ast.literal_eval(v)
    over["budget"] = mk_budget(lines, **cols)
    return over, lines


if __name__ == "__main__":
    mode = sys.argv[1]
    days = int(sys.argv[2])
    over, lines = parse(sys.argv[3:])
    if mode == "summary":
        run_set(" ".join(sys.argv[3:]) or "base", over, days)
    else:
        life_table("iter4", mode, days, 120, **over)

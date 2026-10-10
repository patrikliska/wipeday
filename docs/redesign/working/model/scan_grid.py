import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *


def first_nuke(over, name, days=2):
    p = Params(**over)
    a = archetype(name)
    pl = Player(p, a, seed=7)
    pl.play(days)
    if not pl.runs:
        return None, pl
    return pl.runs[0], pl


if __name__ == "__main__":
    print("cost out  | cont 6/s | auto 15/s | casual  | idler   | hand1 | metal(cont) | L run1 peak")
    for cr in (16.0, 18.0, 20.0):
        for orr in (4.5, 5.0, 5.5):
            over = dict(cost_ratio=cr, out_ratio=orr)
            c, plc = first_nuke(over, "first_hour", 1)
            au, _ = first_nuke(over, "autoclicker", 1)
            ca, _ = first_nuke(over, "casual", 3)
            idl, _ = first_nuke(over, "idler", 4)
            hand1 = [e[1] for e in c["events"] if e[2].startswith("hand")][0] if c else None
            metal = [e[1] for e in c["events"] if e[2] == "era 3"] if c else []
            print("%4.0f %4.1f | %8s | %9s | %7s | %7s | %5s | %11s | %s" % (
                cr, orr, hms(c["dur"]) if c else "-", hms(au["dur"]) if au else "-",
                hms(ca["t1"]) if ca else "-", hms(idl["t1"]) if idl else "-",
                hms(hand1) if hand1 else "-", hms(metal[0]) if metal else "-", fmt(c["S"]) if c else "-"))

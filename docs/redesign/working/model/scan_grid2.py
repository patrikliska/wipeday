import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wipe_model import *
from scan_grid import first_nuke

if __name__ == "__main__":
    print("cost out  gp    | cont 6/s | auto 15/s | casual  | idler   | hand1 | metal(cont) | tap share r1")
    for (cr, orr, gp) in [(16, 4.5, 0.005), (16, 4.75, 0.005), (16, 5.0, 0.005), (18, 5.0, 0.005), (16, 4.5, 0.0075)]:
        over = dict(cost_ratio=float(cr), out_ratio=orr, grip_p=gp)
        c, plc = first_nuke(over, "first_hour", 1)
        au, _ = first_nuke(over, "autoclicker", 1)
        ca, _ = first_nuke(over, "casual", 3)
        idl, _ = first_nuke(over, "idler", 4)
        hand1 = [e[1] for e in c["events"] if e[2].startswith("hand")][0] if c else None
        metal = [e[1] for e in c["events"] if e[2] == "era 3"] if c else []
        print("%4.0f %4.2f %.4f | %8s | %9s | %7s | %7s | %5s | %11s | %.2f" % (
            cr, orr, gp, hms(c["dur"]) if c else "-", hms(au["dur"]) if au else "-",
            hms(ca["t1"]) if ca else "-", hms(idl["t1"]) if idl else "-",
            hms(hand1) if hand1 else "-", hms(metal[0]) if metal else "-", c["tap_share"] if c else 0))

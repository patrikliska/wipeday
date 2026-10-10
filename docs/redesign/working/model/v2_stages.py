"""Canon v2: what each resolution input does, one stage at a time (solo archetypes, 180 days).

python -I v2_stages.py   -> out/v2_stages.txt
"""
import sys, os, time
from multiprocessing import Pool
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from wipe_model import *
from configs import PROPOSAL, V2A, V2B, V2B2, V2C, V2, V2_RULES, AUTO_P1, budget_v2
from run_all import w_life, e_at, run_rows, phase, med

NAMES = ("idler", "casual", "active", "optimal")
DAYS = 180

STAGES = [
    ("P1 (as published)", PROPOSAL),
    ("+ crate floor 1 min", dict(PROPOSAL, crate_floor=60.0)),
    ("+ run-1 crate flat 10 min", dict(PROPOSAL, first_crate_secs=600.0)),
    ("+ Afterglow from first tap", dict(PROPOSAL, afterglow_from="first_tap")),
    ("+ rain 20%", dict(PROPOSAL, rain_share=0.2)),
    ("V2A: all rules", V2A),
    ("V2B: + Morale in rings 4-9", V2B),
    ("+ Logbook history lines r2-3", V2B2),
    ("V2C: + shelf/era cost columns", V2C),
    ("V2: + 04's automation slots", V2),
    ("V2 with P1's automation slots", dict(V2, auto=AUTO_P1)),
]


def main():
    tasks = []
    for lab, over in STAGES:
        for n in NAMES:
            tasks.append((over, n, {}, DAYS, 11, None))
        tasks.append((over, "first_hour", {}, 1, 7, None))
    t0 = time.time()
    with Pool(26) as pool:
        pls = pool.map(w_life, tasks)
    out = ["# Canon v2 stages (solo archetypes, no Late Tide, Blowback 9 crates a day)", "",
           "  %-32s %-7s %-8s %-15s %-6s %-14s %-14s %-14s %-8s %-6s" % (
               "stage", "N1", "cas 1st", "cas d7/30/90", "n d30", "active 30/90", "optimal 30/90",
               "idler 30/90", "late", "lit30")]
    for i, (lab, over) in enumerate(STAGES):
        idl, cas, act, opt, fh = pls[i * 5:(i + 1) * 5]

        def g(x, d):
            return e_at(x, d)["E"] / e_at(cas, d)["E"]
        rows = run_rows(cas)
        late = med([r["dur"] for r in rows if phase(r) == "late"])
        out.append("  %-32s %-7s %-8s %-15s %-6d %-14s %-14s %-14s %-8s %.0f%%" % (
            lab, hms(fh.runs[0]["dur"]), hms(cas.runs[0]["t1"] - cas.t_first),
            "%s/%s/%s" % (fmt(e_at(cas, 7)["E"]), fmt(e_at(cas, 30)["E"]), fmt(e_at(cas, 90)["E"])),
            e_at(cas, 30)["nukes"], "%.2f/%.2f" % (g(act, 30), g(act, 90)), "%.2f/%.2f" % (g(opt, 30), g(opt, 90)),
            "%.2f/%.2f" % (g(idl, 30), g(idl, 90)), "%.1f d" % (late / DAY) if late else "-",
            100 * e_at(opt, 30)["lit"] / opt.p.tree_count))
    out.append("")
    out.append("done in %.0fs" % (time.time() - t0))
    txt = "\n".join(out) + "\n"
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    open(os.path.join(HERE, "out", "v2_stages.txt"), "w", newline="").write(txt)
    print(txt)


if __name__ == "__main__":
    main()

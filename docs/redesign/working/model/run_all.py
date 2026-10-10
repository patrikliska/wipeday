"""Every table plan/10-balance.md cites, for the canon constants and for the proposal (P1).

python -I run_all.py            -> out/report_canon.txt, out/report_proposal.txt, out/levers.txt, out/summary.json
"""
import sys, os, math, copy, json, time
from multiprocessing import Pool
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from wipe_model import *
from configs import CANON, PROPOSAL, budget

OUT = os.path.join(HERE, "out")
DAYS = 180
AGENDA = {1, 2, 3, 4, 5, 7, 8, 10, 15, 20, 25, 30, 40, 50}


# ----------------------------------------------------------------------------------------------
# workers

def w_life(args):
    over, name, aover, days, seed, group = args
    p = Params(**over)
    pl = Player(p, archetype(name, **aover), seed=seed, group=group)
    pl.play(days, snapshot_days=list(range(1, days + 1)))
    return pl


def w_run1(args):
    over, name, aover = args
    p = Params(**over)
    a = archetype(name, **aover)
    pl = Player(p, a, seed=7, record_seconds=(name in ("first_hour",)))
    marks = {}
    thr = {y: p.L0 * y ** (1.0 / p.expo) for y in (1, 5, 10)}
    orig_add = pl.add

    def add(x, kind):
        before = pl.L
        orig_add(x, kind)
        for y, v in thr.items():
            if before < v <= pl.L and y not in marks:
                marks[y] = (pl.run.online, pl.cur_t - pl.t_first)
    pl.add = add
    snaps = {}
    orig_step = pl.step

    def step(t, tps):
        orig_step(t, tps)
        if pl.run.index == 1 and pl.run.online in (300, 600, 1200, 1800, 2400, 3600):
            snaps[pl.run.online] = pl.L
    pl.step = step
    pl.play(2 if name not in ("idler",) else 4)
    pl.add = orig_add
    pl.step = orig_step
    return pl, marks, snaps


def w_hour(args):
    over, day = args
    p = Params(**over)
    pl = Player(p, archetype("active"), seed=11)
    holder = {}

    def before(pl_, t):
        if "snap" not in holder and t >= (day - 1) * DAY + 7 * HOUR:
            holder["snap"] = (copy.deepcopy(pl_), t)
    pl.play(day, hooks={"before_session": before})
    snap, t = holder["snap"]
    res = {}
    import random as _random
    for label, tps, buy, flot in (("active", 6.0, False, True), ("idle", 0.0, False, False),
                                  ("active_buy", 6.0, True, True), ("idle_buy", 0.0, True, False),
                                  ("casual_tap", 4.0, False, True), ("taps_only", 6.0, False, False)):
        acc = dict(S=0.0, tap=0.0, line=0.0, tap_nb=0.0, line_nb=0.0, flot=0.0)
        seeds = 6 if flot else 1
        for sd in range(seeds):
            q = copy.deepcopy(snap)
            q.settle_offline(t)
            q.recalc()
            q.rng = _random.Random(1000 + sd)
            q.run.flot_timer = q.next_flot_gap()
            q.no_buy = not buy
            q.no_flot = not flot
            q.record_seconds = True
            q.seconds = []
            S0 = q.run.S
            F0 = q.run.flot_inc
            for s in range(3600):
                q.step(t + s, tps)
            acc["S"] += (q.run.S - S0) / seeds
            acc["tap"] += sum(x[2] for x in q.seconds) / seeds
            acc["line"] += sum(x[3] for x in q.seconds) / seeds
            acc["tap_nb"] += sum(x[2] for x in q.seconds if not x[4]) / seeds
            acc["line_nb"] += sum(x[3] for x in q.seconds if not x[4]) / seeds
            acc["flot"] += (q.run.flot_inc - F0) / seeds
        res[label] = dict(S=acc["S"], tap=acc["tap"], line=acc["line"],
                          share_nb=acc["tap_nb"] / max(1e-300, acc["tap_nb"] + acc["line_nb"]),
                          flot=acc["flot"])
    res["nukes"] = snap.nukes
    res["E"] = snap.E
    return res


# ----------------------------------------------------------------------------------------------
# metrics

def pass_time(trace, target):
    prev = (0.0, 0.0)
    for (t, s) in trace:
        if s >= target:
            t0, s0 = prev
            if s == s0:
                return t
            return t0 + (t - t0) * (target - s0) / (s - s0)
        prev = (t, s)
    return None


def run_rows(pl):
    rows = []
    for i, r in enumerate(pl.runs):
        d = dict(index=r["index"], day=(r["t0"] - pl.t_first) / DAY + 1, end_day=(r["t1"] - pl.t_first) / DAY + 1,
                 dur=r["dur"], online=r["online"], gain=r["gain"], E=r["E"], power=r["power"],
                 nodes=r["nodes"], lit=r["lit"], S=r["S"], era=r["era"], tap=r["tap_share"],
                 E_before=r["E_before"])
        if i >= 1:
            prev = pl.runs[i - 1]
            pt = pass_time(r["trace"], prev["S"])
            d["n11"] = pt / prev["dur"] if pt is not None and prev["dur"] > 0 else None
            # effective speed-up: supplies made in the previous run's duration
            T = min(prev["dur"], r["dur"])
            s_at = None
            for (t, s) in r["trace"]:
                if t <= T:
                    s_at = s
            d["speed"] = (s_at / prev["S"]) * (prev["dur"] / T) if s_at and prev["S"] > 0 and T > 0 else None
        rows.append(d)
    return rows


def phase(row):
    if row["index"] <= 5:
        return "early"
    if row["end_day"] <= 30:
        return "mid"
    return "late"


def gm(xs):
    xs = [x for x in xs if x and x > 0]
    return math.exp(sum(math.log(x) for x in xs) / len(xs)) if xs else None


def med(xs):
    xs = sorted(x for x in xs if x is not None)
    return xs[len(xs) // 2] if xs else None


def e_at(pl, day):
    for s in pl.daily:
        if round(s["day"]) == day:
            return s
    return None


def f2(x):
    return "-" if x is None else "%.2f" % x


def flat_alarms_product(rows):
    count = 0
    for i in range(len(rows) - 4):
        win = rows[i:i + 5]
        prod = 1.0
        for w in win:
            prod *= w["power"]
        if prod < 1.3:
            n_last = win[-1]["index"]
            if not any(n in AGENDA for n in range(n_last + 1, n_last + 4)):
                count += 1
    return count


def flat_alarms(rows):
    count = 0
    for i in range(len(rows) - 4):
        win = rows[i:i + 5]
        if all(w["power"] < 1.3 for w in win):
            n_last = win[-1]["index"]
            if not any(n in AGENDA for n in range(n_last + 1, n_last + 4)):
                count += 1
    return count


# ----------------------------------------------------------------------------------------------

def report(label, over, pool):
    lines = []
    W = lines.append
    W("# Model report: %s" % label)
    W("")
    # --- run 1 timelines
    r1 = pool.map(w_run1, [(over, "first_hour", {}), (over, "autoclicker", {}), (over, "casual", {}),
                           (over, "active", {}), (over, "optimal", {}), (over, "idler", {}),
                           (dict(over, batch_rule="literal"), "first_hour", {})])
    names = ["first_hour", "autoclicker", "casual", "active", "optimal", "idler", "first_hour literal batch"]
    W("## Run 1, continuous play at 6 taps/s (first_hour)")
    pl, marks, snaps = r1[0]
    run1 = pl.runs[0]
    ev = run1["events"]

    def first(prefix):
        for (on, wall, txt) in ev:
            if txt == prefix:
                return on
        return None
    keymap = [("Beachcomber bought", "line 1"), ("Stone Tools", "grip 1"), ("10 Beachcombers", "line 1 x10"),
              ("Campfire", "line 2"), ("First hand (Mara)", "hand 1"), ("Timber era", "era 1"),
              ("Second hand", "hand 2"), ("Sorting Tables (island 1)", "island 1"), ("Stone era", "era 2"),
              ("Iron Tools", "grip 2"), ("Salvaged Tools", "grip 3"), ("5th hand", "hand 5"),
              ("Sheet Metal era", "era 3"), ("Power Tools", "grip 4")]
    for name, key in keymap:
        W("  %-28s %s" % (name, hms(first(key)) if first(key) is not None else "-"))
    W("  %-28s %s" % ("First flotsam", hms(run1["first"].get("first_flotsam", 0))))
    for y in (1, 5, 10):
        if y in marks:
            W("  %-28s %s" % ("Yield %d glass" % y, hms(marks[y][0])))
    for s in sorted(snaps):
        W("  %-28s %s" % ("Supplies made at %s" % hms(s), fmt(snaps[s])))
    W("  %-28s %s (S %s, gain %d, flotsam caught %d, tap share %.0f%%)" % (
        "First nuke", hms(run1["dur"]), fmt(run1["S"]), run1["gain"], run1["caught"], 100 * run1["tap_share"]))
    # N8 from recorded seconds
    secs = [x for x in pl.seconds if x[0] == 1]
    t1 = sum(x[2] for x in secs if x[1] <= 60)
    l1 = sum(x[3] for x in secs if x[1] <= 60)
    t10 = sum(x[2] for x in secs if x[1] >= 600 and not x[4])
    l10 = sum(x[3] for x in secs if x[1] >= 600 and not x[4])
    u1 = sum(x[5] for x in secs if x[1] <= 60)
    u10 = sum(x[5] for x in secs if x[1] >= 600 and not x[4])
    W("  N8 tap share run 1, minute 0-1: %.0f%% direct, %.0f%% tap-driven (taps + unmanned lines); from minute 10 outside bursts: %.0f%% direct, %.0f%% tap-driven" % (
        100 * t1 / max(1e-300, t1 + l1), 100 * (t1 + u1) / max(1e-300, t1 + l1),
        100 * t10 / max(1e-300, t10 + l10), 100 * (t10 + u10) / max(1e-300, t10 + l10)))
    for k in (2, 3, 4, 5):
        sk = [x for x in pl.seconds if x[0] == k]
        if sk:
            tk = sum(x[2] for x in sk)
            lk = sum(x[3] for x in sk)
            tnb = sum(x[2] for x in sk if not x[4])
            lnb = sum(x[3] for x in sk if not x[4])
            W("  N8 run %d tap share: %.0f%% overall, %.0f%% outside bursts (Afterglow counts as a burst)" % (
                k, 100 * tk / max(1e-300, tk + lk), 100 * tnb / max(1e-300, tnb + lnb)))
    W("  continuous runs 1-6 (online): " + ", ".join("%d: %s" % (r["index"], hms(r["dur"])) for r in pl.runs[:6]))
    W("")
    W("## First nuke per archetype (N1-N3)")
    for nm, (plx, mk, sn) in zip(names, r1):
        if plx.runs:
            rr = plx.runs[0]
            W("  %-26s wall %-8s online %-8s glass %d" % (nm, hms(rr["t1"] - plx.t_first), hms(rr["online"]), rr["gain"]))
        else:
            W("  %-26s none in the horizon" % nm)
    # casual day 1 detail
    plc = r1[2][0]
    W("  casual day 1 check-ins: " + "; ".join("%s: %d buys" % (hms(t), n) for (t, n, ri) in plc.checkins[:4]))
    W("")
    # --- lifetimes
    archs = [("idler", {}), ("casual", {}), ("active", {}), ("optimal", {}), ("idler_crown", {"rule": "crown"})]
    lifes = pool.map(w_life, [(over, n.split("_")[0], ao, DAYS, 11, None) for n, ao in archs])
    L = {n: pl for (n, _), pl in zip(archs, lifes)}
    cas = L["casual"]
    group = [(s["t"], s["E"]) for s in cas.daily]
    late, late_nt, late_50, late_x3 = pool.map(w_life, [
        (over, "late", {}, DAYS, 11, group), (over, "late", {"late_tide": False}, DAYS, 11, group),
        (dict(over, late_tide_below=0.5, late_tide=2.0), "late", {}, DAYS, 11, group),
        (dict(over, late_tide_below=0.75, late_tide=2.0), "late", {}, DAYS, 11, group)])
    hour = pool.map(w_hour, [(over, 14), (over, 30), (over, 60)])

    W("## Runs 1-12 per archetype (day = calendar day the run started; N11 = time for run N+1 to pass run N's supplies / run N's time)")
    for n in ("idler", "casual", "active", "optimal"):
        rows = run_rows(L[n])
        W("### " + n)
        W("  #   day   dur      online   gain     E        power  speed  N11   nodes lit")
        for d in rows[:12]:
            W("  %-3d %-5.1f %-8s %-8s %-8s %-8s %-6.2f %-6s %-5s %-5d %d" % (
                d["index"], d["day"], hms(d["dur"]), hms(d["online"]), fmt(d["gain"]), fmt(d["E"]),
                d["power"], f2(d.get("speed")), f2(d.get("n11")), d["nodes"], d["lit"]))
    W("")
    W("## Phases (N11, N12, N14): geometric mean power per nuke, median N11 ratio, median run length")
    W("  archetype phase  nukes power  speed  N11-med N11-max dur-med   nodes-med")
    phase_tab = {}
    for n in ("idler", "casual", "active", "optimal"):
        rows = run_rows(L[n])
        for ph in ("early", "mid", "late"):
            rs = [r for r in rows if phase(r) == ph]
            if not rs:
                continue
            n11 = [r.get("n11") for r in rs if r.get("n11") is not None]
            ent = dict(n=len(rs), power=gm([r["power"] for r in rs]), speed=gm([r.get("speed") for r in rs]),
                       n11=med(n11), n11max=max(n11) if n11 else None, dur=med([r["dur"] for r in rs]),
                       nodes=med([r["nodes"] for r in rs if r["index"] > 1]))
            phase_tab[(n, ph)] = ent
            W("  %-9s %-6s %-5d %-6s %-6s %-7s %-7s %-9s %s" % (
                n, ph, ent["n"], f2(ent["power"]), f2(ent["speed"]), f2(ent["n11"]), f2(ent["n11max"]),
                hms(ent["dur"]) if ent["dur"] else "-", ent["nodes"]))
    W("")
    W("## Glass ever by day (N16), nukes and lit nodes")
    days = (1, 3, 7, 14, 30, 60, 90, 120, 180)
    W("  " + "%-12s" % "archetype" + "".join("%-14s" % ("d%d" % d) for d in days))
    for n in ("idler", "idler_crown", "casual", "active", "optimal"):
        cells = []
        for d in days:
            s = e_at(L[n], d)
            cells.append("%-14s" % ("%s/%d/%d" % (fmt(s["E"]), s["nukes"], s["lit"]) if s else "-"))
        W("  %-12s" % n + "".join(cells))
    W("  (cells: glass ever / nukes / nodes lit of %d)" % cas.p.tree_count)
    W("  gaps vs casual:")
    gaps = {}
    for n in ("active", "optimal", "idler", "idler_crown"):
        g = []
        for d in (30, 90, 180):
            a_, c_ = e_at(L[n], d), e_at(cas, d)
            g.append(a_["E"] / c_["E"] if a_ and c_ and c_["E"] else None)
        gaps[n] = g
        W("    %-12s d30 %s  d90 %s  d180 %s" % (n, f2(g[0]), f2(g[1]), f2(g[2])))
    W("")
    W("## Late joiner (N17): casual from day 30; the group median is the casual's glass ever")
    target = e_at(cas, 30)["E"]
    for lab, lp in (("this config", late), ("no Late Tide", late_nt), ("x2 below 50% (canon)", late_50),
                    ("x2 below 75%", late_x3)):
        reach = None
        for s in lp.daily:
            if s["E"] >= target and s["day"] >= 30:
                reach = s["day"] - 29
                break
        W("  %-18s reaches the day-30 casual's %s glass after %s days; at d60 %s (casual %s), d90 %s (casual %s)" % (
            lab, fmt(target), reach, fmt(e_at(lp, 60)["E"]), fmt(e_at(cas, 60)["E"]), fmt(e_at(lp, 90)["E"]), fmt(e_at(cas, 90)["E"])))
    W("")
    W("## Active hour vs idle online hour (N9), active archetype at the first session of day 14 and day 30")
    for lab, h in zip(("day 14", "day 30", "day 60"), hour):
        W("  %s (nuke %d, glass %s): active/idle %.2f (taps, Hustle, Rush only %.2f); with buying %.2f; casual 4 taps/s %.2f; tap share outside bursts %.0f%%; crate share %.0f%%" % (
            lab, h["nukes"], fmt(h["E"]), h["active"]["S"] / h["idle"]["S"], h["taps_only"]["S"] / h["idle"]["S"],
            h["active_buy"]["S"] / h["idle_buy"]["S"],
            h["casual_tap"]["S"] / h["idle"]["S"], 100 * h["active"]["share_nb"], 100 * h["active"]["flot"] / max(1e-300, h["active"]["S"])))
    W("")
    W("## Purchase cadence (N5-N7)")
    for n in ("active", "casual", "optimal"):
        pl = L[n]
        gaps5 = []
        idle5 = []
        for r in pl.runs[:5]:
            pt = [0] + list(r["purchase_times"])
            gp = max((b - a for a, b in zip(pt, pt[1:])), default=None)
            gaps5.append(gp)
            idle5.append(r["max_idle"])
        W("  %-8s max purchase gap in the first 10 online minutes of runs 1-5: %s s; longest online stretch with nothing affordable, runs 1-5: %s s" % (
            n, gaps5, idle5))
    plf = r1[0][0]
    gaps_f = []
    for r in plf.runs[:5]:
        pt = [0] + list(r["purchase_times"])
        gaps_f.append(max((b - a for a, b in zip(pt, pt[1:])), default=None))
    W("  first_hour max purchase gap, first 10 min of runs 1-5: %s s; nothing affordable: %s s" % (gaps_f, [r["max_idle"] for r in plf.runs[:5]]))
    ci = [x for x in cas.checkins if x[0] - cas.t_first < 30 * DAY]
    W("  casual check-ins in days 1-30 with at least one purchase: %d of %d (min %d)" % (
        sum(1 for x in ci if x[1] >= 1), len(ci), min(x[1] for x in ci)))
    W("")
    W("## Tree (N13-N15)")
    for n in ("casual", "active", "optimal", "idler"):
        pl = L[n]
        rows = run_rows(pl)
        full = next((s["day"] for s in pl.daily if s["lit"] >= pl.p.tree_count), None)
        later = [r["nodes"] for r in rows[1:]]
        W("  %-8s nodes at nuke 1: %d; later median %s, max %s, share of later nukes in 3-8: %.0f%%; lit d30 %.0f%%, d90 %.0f%%, d180 %.0f%%; full tree day %s; flattening alarms (N13 per nuke) %d, (5-nuke product < 1.3) %d" % (
            n, rows[0]["nodes"] if rows else 0, med(later), max(later) if later else None,
            100 * sum(1 for x in later if 3 <= x <= 8) / max(1, len(later)),
            100 * e_at(pl, 30)["lit"] / pl.p.tree_count, 100 * e_at(pl, 90)["lit"] / pl.p.tree_count,
            100 * e_at(pl, 180)["lit"] / pl.p.tree_count, full, flat_alarms(rows), flat_alarms_product(rows)))
    W("")
    W("## Scrap (N19) and magnitude (N23)")
    for n in ("idler", "casual", "active", "optimal"):
        pl = L[n]
        s30 = e_at(pl, 30)["scrap"]
        s180 = e_at(pl, 180)["scrap"]
        W("  %-8s scrap by d30 %d (%.2f/day), d30-180 %.2f/day; ranks at d180 %s; largest number %s; run 1 supplies %s" % (
            n, s30, s30 / 30, (s180 - s30) / 150, e_at(pl, 180)["ranks"], fmt(pl.max_number), fmt(pl.runs[0]["S"])))
    W("")
    summary = dict(label=label, gaps=gaps, phase={"%s/%s" % k: v for k, v in phase_tab.items()},
                   first={nm: (plx.runs[0]["t1"] - plx.t_first if plx.runs else None) for nm, (plx, mk, sn) in zip(names, r1)},
                   E={n: {d: e_at(L[n], d)["E"] for d in days} for n in L},
                   nukes={n: {d: e_at(L[n], d)["nukes"] for d in days} for n in L},
                   hour=[(h["active"]["S"] / h["idle"]["S"], h["active_buy"]["S"] / h["idle_buy"]["S"]) for h in hour])
    return "\n".join(lines) + "\n", summary


def lever_rows(pool):
    P = PROPOSAL
    variants = [
        ("P1 (proposal)", dict(P)),
        ("canon constants", dict(CANON)),
        ("L0 x2 (1e6)", dict(P, L0=1e6)),
        ("exponent 1/4 (L0 5e6)", dict(P, expo=0.25, L0=5e6)),
        ("exponent 1/3 (L0 5e7)", dict(P, expo=1 / 3, L0=5e7)),
        ("k 0.15", dict(P, glow_k=0.15)),
        ("k 0.35", dict(P, glow_k=0.35)),
        ("output x5.0 per rung", dict(P, out_ratio=5.0)),
        ("output x4.5 per rung", dict(P, out_ratio=4.5)),
        ("ring 5 x15", dict(P, budget=budget([1.3, 1.4, 1.6, 2.0, 15, 1000, 1000, 1000, 1000]))),
        ("rings 6-9 x30", dict(P, budget=budget([1.3, 1.4, 1.6, 2.0, 10, 30, 30, 30, 30]))),
        ("early rings x2 each", dict(P, budget=budget([2, 2, 2, 2, 10, 1000, 1000, 1000, 1000]))),
        ("ranks x3 (canon), together", dict(P, rank_mult=3.0)),
        ("ranks x2, focus allowed", dict(P, rank_rule=None)),
        ("crown canon (80% of peak)", dict(P, crown_mode="marginal")),
        ("crown eager (any 10%)", dict(P, crown_mode="eager")),
        ("Night Shift base 8 h", dict(P, night_base=8.0)),
        ("Night Shift base 16 h", dict(P, night_base=16.0)),
        ("era costs x3", dict(P, era_costs=[4.5e3, 9e6, 6e10, 1.2e15])),
        ("milestones 200-400 x2", dict(P, ms_pay={10: 2.0, 100: 2.0, 200: 2.0, 300: 2.0, 400: 2.0})),
        ("Morale 1% per entry", dict(P, morale_entry=0.01)),
        ("no Blowback", dict(P, blowback_per_day=0.0)),
        ("grip p 1% (canon)", dict(P, grip_p=0.01)),
        ("canon flotsam and Rush", dict(P, rush=(10.0, 30, 600), rally=(6.0, 60), adren=(300.0, 12), crate_secs=900.0)),
        ("optimal 07-23 only", dict(P)),
        ("no Foreman pass", dict(P, foreman=False)),
        ("Foreman pass without reserve", dict(P, foreman_reserve=False)),
    ]
    tasks = []
    waking = {"sessions": [(h * HOUR, 300) for h in range(7, 24)]}
    for vi, (lab, over) in enumerate(variants):
        for n in ("idler", "casual", "active", "optimal"):
            ao = waking if (n == "optimal" and lab == "optimal 07-23 only") else {}
            tasks.append((over, n, ao, DAYS, 11, None))
        tasks.append((over, "first_hour", {}, 1, 7, None))
    pls = pool.map(w_life, tasks)
    out = ["# Levers: one change at a time from P1 (180 days)", "",
           "  %-28s %-8s %-8s %-9s %-9s %-7s %-14s %-14s %-14s %-9s %-8s" % (
               "variant", "cont N1", "casual", "cas d30", "cas d90", "n d30", "active d30/90", "optimal d30/90",
               "idler d30/90", "late dur", "opt lit30")]
    for vi, (lab, over) in enumerate(variants):
        idl, cas, act, opt, fh = pls[vi * 5: vi * 5 + 5]

        def g(x, d):
            a_, c_ = e_at(x, d), e_at(cas, d)
            return a_["E"] / c_["E"] if c_["E"] else float("nan")
        rows = run_rows(cas)
        late = med([r["dur"] for r in rows if phase(r) == "late"])
        out.append("  %-28s %-8s %-8s %-9s %-9s %-7d %-14s %-14s %-14s %-9s %.0f%%" % (
            lab, hms(fh.runs[0]["dur"]) if fh.runs else "-", hms(cas.runs[0]["t1"] - cas.t_first) if cas.runs else "-",
            fmt(e_at(cas, 30)["E"]), fmt(e_at(cas, 90)["E"]), e_at(cas, 30)["nukes"],
            "%.2f/%.2f" % (g(act, 30), g(act, 90)), "%.2f/%.2f" % (g(opt, 30), g(opt, 90)),
            "%.2f/%.2f" % (g(idl, 30), g(idl, 90)), "%.1f d" % (late / DAY) if late else "-",
            100 * e_at(opt, 30)["lit"] / opt.p.tree_count))
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    t0 = time.time()
    with Pool(26) as pool:
        summ = {}
        for lab, over, fn in (("proposal P1", PROPOSAL, "report_proposal.txt"), ("canon constants", CANON, "report_canon.txt")):
            txt, s = report(lab, over, pool)
            open(os.path.join(OUT, fn), "w", newline="").write(txt)
            summ[lab] = s
            print(txt)
        if "--no-levers" not in sys.argv:
            lv = lever_rows(pool)
            open(os.path.join(OUT, "levers.txt"), "w", newline="").write(lv)
            print(lv)
    json.dump(summ, open(os.path.join(OUT, "summary.json"), "w", newline=""), indent=1, default=str)
    print("done in %.0fs" % (time.time() - t0))

"""Canon v2 tables for plan/10-balance.md: P1's constants under the resolutions' rules and budget.

python -I run_v2.py   -> out/report_v2.txt (alone: run 1, archetypes, phases, cadence, tree)
                         out/v2_extra.txt  (N9 by weather, seeds, scope shares, N19, groups,
                                            horizon, late wall, levers)
"Alone" is a player with no friends: no Blowback, no Freighter, no Late Tide. Groups play in
lockstep (group.py).
"""
import sys, os, math, copy, time, random
from multiprocessing import Pool
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from wipe_model import *
from configs import V2, V2_ALONE, CANON, budget_v2, LINES_V2, V2_RULES
from run_all import w_life, report, e_at, run_rows, phase, gm, med, f2, flat_alarms_product
from group import w_group, G5

OUT = os.path.join(HERE, "out")
NAMES = ("idler", "casual", "active", "optimal")
SEEDS = (7, 11, 23)


def gmean(xs):
    xs = [x for x in xs if x and x > 0]
    return math.exp(sum(math.log(x) for x in xs) / len(xs)) if xs else float("nan")


# ---------------------------------------------------------------------------------------------- N9

def w_hour_w(args):
    over, day, rain = args
    p = Params(**over)
    pl = Player(p, archetype("active"), seed=11)
    holder = {}

    def before(pl_, t):
        if "snap" not in holder and t >= (day - 1) * DAY + 7 * HOUR:
            holder["snap"] = (copy.deepcopy(pl_), t)
    pl.play(day, hooks={"before_session": before})
    snap, t = holder["snap"]
    res = {}
    for label, tps, flot in (("active", 6.0, True), ("idle", 0.0, False), ("taps_only", 6.0, False),
                             ("casual_tap", 4.0, True)):
        S = F = tap_nb = line_nb = 0.0
        seeds = 6 if flot else 1
        for sd in range(seeds):
            q = copy.deepcopy(snap)
            q.settle_offline(t)
            q.recalc()
            q.rng = random.Random(1000 + sd)
            q.run.flot_timer = q.next_flot_gap()
            q.no_buy = True
            q.no_flot = not flot
            q.force_rain = rain
            q.record_seconds = True
            q.seconds = []
            S0, F0 = q.run.S, q.run.flot_inc
            for s in range(3600):
                q.step(t + s, tps)
            S += (q.run.S - S0) / seeds
            F += (q.run.flot_inc - F0) / seeds
            tap_nb += sum(x[2] for x in q.seconds if not x[4]) / seeds
            line_nb += sum(x[3] for x in q.seconds if not x[4]) / seeds
        res[label] = dict(S=S, F=F, share=tap_nb / max(1e-300, tap_nb + line_nb))
    return day, rain, res


# ---------------------------------------------------------------------------------------------- run 1

def w_first(args):
    over, name, seed = args
    pl = Player(Params(**over), archetype(name), seed=seed)
    marks = {}
    orig_add = pl.add

    def add(x, kind):
        before = pl.L
        orig_add(x, kind)
        for v in (3e7, 1e9):
            if before < v <= pl.L and v not in marks and pl.run.index == 1:
                marks[v] = pl.run.online
    pl.add = add
    pl.play(2)
    r = pl.runs[0] if pl.runs else None
    return name, seed, (r["t1"] - pl.t_first) if r else None, (r["gain"] if r else None), marks


# ---------------------------------------------------------------------------------------------- scope shares

class Tracker(Player):
    """Per-line and night bookkeeping of line income (for the budget's counting rules)."""

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self.by_line = [0.0] * NL
        self.night = 0.0
        self.total = 0.0

    @staticmethod
    def night_overlap(a, b):
        tot = 0.0
        for d in range(int(a // DAY), int(b // DAY) + 1):
            for lo, hi in ((d * DAY, d * DAY + 0.23 * DAY), (d * DAY + 0.8 * DAY, (d + 1) * DAY)):
                tot += max(0.0, min(b, hi) - max(a, lo))
        return tot

    def settle_offline(self, t):
        if t > self.last_t and self.run is not None:
            end = min(t, self.last_cmd + self.window())
            secs = end - self.last_t
            if secs > 0:
                m = self.eff["off_mult"]
                for i in range(NL):
                    if self.run.manned[i]:
                        self.by_line[i] += self.out[i] * m * secs
                x = self.man * m * secs
                self.total += x
                self.night += x * self.night_overlap(self.last_t, end) / secs
        super().settle_offline(t)

    def step(self, t, tps):
        before = self.run.line_inc
        super().step(t, tps)
        x = self.run.line_inc - before
        if x > 0:
            sm = sum(self.out) or 1.0
            for i in range(NL):
                self.by_line[i] += x * self.out[i] / sm
            self.total += x
            frac = (t % DAY) / DAY
            if frac < 0.23 or frac > 0.8:
                self.night += x


def w_scope(args):
    over, name, days = args
    pl = Tracker(Params(**over), archetype(name), seed=11)
    marks = {}

    def before(pl_, t):
        d = int(t // DAY)
        if d in (8, 30, 90) and d not in marks:
            marks[d] = (list(pl_.by_line), pl_.night, pl_.total)
    pl.play(days, hooks={"before_session": before})
    marks[days] = (list(pl.by_line), pl.night, pl.total)
    return name, marks


# ---------------------------------------------------------------------------------------------- N19

def scrap_windows(pl):
    first_day = next((round(s["day"]) for s in pl.daily if s["nukes"] >= 1), None)
    S = {}
    for s in pl.daily:
        d = round(s["day"])
        S[d] = s["scrap"] - (pl.p.first_nuke_scrap if (first_day is not None and d >= first_day) else 0)
    avgs = [(S[k + 6] - S[k - 1]) / 7.0 for k in range(2, max(S) - 5) if (k - 1) in S and (k + 6) in S]
    avgs.sort()
    return dict(min=avgs[0], mean=sum(avgs) / len(avgs), p90=avgs[int(0.9 * (len(avgs) - 1))], max=avgs[-1],
                d30=S.get(30), d180=S.get(180))


# ---------------------------------------------------------------------------------------------- groups

def group_block(W, title, res, labels):
    W("### " + title)
    for lab in labels:
        cells = []
        for d in (7, 30, 90, 180, 365):
            vals = [e_at(g[lab], d) for g in res]
            vals = [v for v in vals if v]
            if not vals:
                continue
            cells.append("d%d %s/%d/%.0f%%" % (d, fmt(gmean([v["E"] for v in vals])),
                                              round(sum(v["nukes"] for v in vals) / len(vals)),
                                              100 * sum(v["lit"] for v in vals) / len(vals) / 361))
        W("  %-8s " % lab + "  ".join(cells))
    for lab in labels:
        if lab == "casual":
            continue
        parts = []
        for d in (30, 90, 180, 365):
            xs = [e_at(g[lab], d)["E"] / e_at(g["casual"], d)["E"] for g in res if e_at(g[lab], d) and e_at(g["casual"], d)]
            if xs:
                parts.append("d%d %.2f" % (d, gmean(xs)))
        line = "  gap %-8s %s" % (lab, " ".join(parts))
        if lab == "idler":
            tr1 = min(min(e_at(g["idler"], d)["E"] / e_at(g["casual"], d)["E"] for d in range(25, 36)) for g in res)
            tr2 = min(min(e_at(g["idler"], d)["E"] / e_at(g["casual"], d)["E"] for d in range(85, 96)) for g in res)
            line += "; trough d25-35 %.2f, d85-95 %.2f" % (tr1, tr2)
        if lab == "late":
            reach = []
            for g in res:
                tgt = e_at(g["casual"], 30)["E"]
                reach.append(next((round(s["day"] - 29) for s in g["late"].daily if s["day"] >= 30 and s["E"] >= tgt), None))
            line += "; reaches the day-30 casual after %s days" % reach
        W(line)
    cas = res[0]["casual"]
    rows = run_rows(cas)
    W("  casual (seed 7): Wipe Days by d7 %d, d30 %s (all seeds); Blowback %.1f crates a day (d1-30), %.1f (d1-180); power per nuke %s/%s/%s; N11 %s/%s/%s; later nodes median %s; 5-nuke alarms %d" % (
        e_at(cas, 7)["nukes"], [e_at(g["casual"], 30)["nukes"] for g in res],
        getattr(cas, "bb30", 0) / 30.0, getattr(cas, "bb180", getattr(cas, "blowback_claimed", 0)) / 180.0,
        f2(gm([r["power"] for r in rows if phase(r) == "early"])), f2(gm([r["power"] for r in rows if phase(r) == "mid"])),
        f2(gm([r["power"] for r in rows if phase(r) == "late"])),
        f2(med([r.get("n11") for r in rows if phase(r) == "early" and r.get("n11")])),
        f2(med([r.get("n11") for r in rows if phase(r) == "mid" and r.get("n11")])),
        f2(med([r.get("n11") for r in rows if phase(r) == "late" and r.get("n11")])),
        med([r["nodes"] for r in rows[1:]]), flat_alarms_product(rows)))
    if "optimal" in res[0]:
        W("  optimal lit at d30: %s" % ["%.0f%%" % (100 * e_at(g["optimal"], 30)["lit"] / 361) for g in res])
    W("")


def w_group30(args):
    """A group plus the casual's Blowback count over days 1-30."""
    g = w_group(args)
    return g


# ---------------------------------------------------------------------------------------------- levers

def lever_variants():
    P = V2_ALONE
    LV = list(LINES_V2)
    return [
        ("canon v2 (alone)", dict(P)),
        ("canon run constants", dict(CANON, **V2_RULES, budget=budget_v2(), blowback_per_day=0.0, freighter_scale=0.0)),
        ("L0 x2 (1e6)", dict(P, L0=1e6)),
        ("exponent 1/4 (L0 5e6)", dict(P, expo=0.25, L0=5e6)),
        ("exponent 1/3 (L0 5e7)", dict(P, expo=1 / 3, L0=5e7)),
        ("k 0.15", dict(P, glow_k=0.15)),
        ("k 0.35", dict(P, glow_k=0.35)),
        ("output x5.0 per rung", dict(P, out_ratio=5.0)),
        ("output x4.5 per rung", dict(P, out_ratio=4.5)),
        ("ring 5 x15", dict(P, budget=budget_v2(LV[:4] + [15.0] + LV[5:]))),
        ("rings 1-4 x2 each", dict(P, budget=budget_v2([2.0, 2.0, 2.0, 2.0] + LV[4:]))),
        ("ranks x3, together", dict(P, rank_mult=3.0)),
        ("ranks x2, focus allowed", dict(P, rank_rule=None)),
        ("crown canon v1 (80% of peak only)", dict(P, crown_mode="marginal")),
        ("crown any 10%", dict(P, crown_mode="eager")),
        ("Night Shift base 8 h", dict(P, night_base=8.0)),
        ("era costs x3", dict(P, era_costs=[4.5e3, 9e6, 6e10, 1.2e15])),
        ("milestones 200-400 at x2", dict(P, ms_pay={10: 2.0, 100: 2.0, 200: 2.0, 300: 2.0, 400: 2.0})),
        ("Morale 1% per entry", dict(P, morale_entry=0.01)),
        ("Blowback 9 crates a day", dict(P, blowback_per_day=9.0)),
        ("p 1% per Grip rung", dict(P, grip_p=0.01)),
        ("canon v1 flotsam and Rush", dict(P, rush=(10.0, 30, 600), rally=(6.0, 60), adren=(300.0, 12), crate_secs=900.0)),
        ("no rain", dict(P, rain_share=0.0)),
        ("Foreman pass without reserve", dict(P, foreman_reserve=False)),
    ]


def main():
    os.makedirs(OUT, exist_ok=True)
    t0 = time.time()
    lines = []
    W = lines.append
    with Pool(28) as pool:
        txt, summ = report("canon v2, a player alone (P1 constants, the resolutions' rules and budget)", V2_ALONE, pool)
        open(os.path.join(OUT, "report_v2.txt"), "w", newline="").write(txt)
        print(txt)

        hour = pool.map(w_hour_w, [(V2, d, r) for d in (14, 30, 60) for r in (False, True)])
        firsts = pool.map(w_first, [(V2_ALONE, n, s) for n in ("first_hour", "autoclicker", "casual") for s in range(1, 13)])
        scope = pool.map(w_scope, [(V2_ALONE, "casual", 180), (V2_ALONE, "active", 180)])
        alone = pool.map(w_life, [(V2_ALONE, n, {}, 365, s, None) for s in SEEDS for n in NAMES])
        pairs = {"casual+active": [("casual", "casual", {}), ("active", "active", {})],
                 "casual+optimal": [("casual", "casual", {}), ("optimal", "optimal", {})],
                 "casual+idler": [("casual", "casual", {}), ("idler", "idler", {})],
                 "casual+late": [("casual", "casual", {}), ("late", "late", {})]}
        gtasks = [(V2, G5, 365, s, True, True) for s in SEEDS] + [(V2, G5, 180, s, False, True) for s in SEEDS]
        for nm, mem in pairs.items():
            gtasks += [(V2, mem, 180, s, True, True) for s in SEEDS]
        wall = {"x30": [30.0] * 4, "x300": [300.0] * 4, "x3,000": [3000.0] * 4}
        for lab, outer in wall.items():
            gtasks += [(dict(V2, budget=budget_v2(LINES_V2[:5] + outer)), G5, 365, 11, True, True)]
        gres = pool.map(w_group, gtasks)
        wtasks = []
        for lab, outer in wall.items():
            wtasks += [(dict(V2_ALONE, budget=budget_v2(LINES_V2[:5] + outer)), n, {}, 365, 11, None) for n in NAMES]
        wres = pool.map(w_life, wtasks)
        LVS = lever_variants()
        ltasks = []
        waking = {"sessions": [(h * HOUR, 300) for h in range(7, 24)]}
        for lab, over in LVS:
            ltasks += [(over, n, {}, 180, 11, None) for n in NAMES] + [(over, "first_hour", {}, 1, 7, None)]
        ltasks += [(V2_ALONE, "optimal", waking, 180, 11, None)]
        lres = pool.map(w_life, ltasks)

    W("# Canon v2: extra tables")
    W("")
    W("## N9 by weather (active archetype at its first session of the day; 6 flotsam seeds)")
    for day, rain, res in hour:
        W("  day %d %-5s active/idle %.2f (taps, Hustle, Rush only %.2f; at 4 taps/s %.2f); tap share outside bursts %.0f%%; flotsam share %.0f%%" % (
            day, "rain" if rain else "clear", res["active"]["S"] / res["idle"]["S"], res["taps_only"]["S"] / res["idle"]["S"],
            res["casual_tap"]["S"] / res["idle"]["S"], 100 * res["active"]["share"], 100 * res["active"]["F"] / res["active"]["S"]))
    for d in (14, 30, 60):
        c = [h for h in hour if h[0] == d and not h[1]][0][2]
        r = [h for h in hour if h[0] == d and h[1]][0][2]
        W("  day %d weather-weighted (80%% clear or fog, 20%% rain): %.2f" % (d, 0.8 * c["active"]["S"] / c["idle"]["S"] + 0.2 * r["active"]["S"] / r["idle"]["S"]))
    W("")
    W("## Run 1 and the first nuke over 12 seeds (N1-N3), alone")
    for n in ("first_hour", "autoclicker", "casual"):
        xs = [x for x in firsts if x[0] == n]
        ts = sorted(x[2] for x in xs if x[2] is not None)
        W("  %-12s first nuke wall min %s median %s max %s; glass %s" % (n, hms(ts[0]), hms(ts[len(ts) // 2]), hms(ts[-1]),
                                                                     sorted(set(x[3] for x in xs))))
        if n == "first_hour":
            for v in (3e7, 1e9):
                tt = sorted(x[4][v] for x in xs if v in x[4])
                W("    lifetime %s passed at online min %s median %s max %s" % (fmt(v), hms(tt[0]), hms(tt[len(tt) // 2]), hms(tt[-1])))
        if n == "casual":
            ok = sum(1 for x in xs if x[2] is not None and x[2] <= 13 * HOUR + 600)
            W("  casual first nuke by the day-1 21:00 check-in: %d of 12 seeds" % ok)
    W("")
    W("## Scope shares of line income (alone, seed 11): top lines, eras Twig..Armored, night 19:12-05:31")
    eras = [(0, 3), (3, 6), (6, 9), (9, 12), (12, 14)]
    for name, marks in scope:
        prev = ([0.0] * NL, 0.0, 0.0, 0)
        for d in sorted(marks):
            bl, ni, tot = marks[d]
            dl = [a - b for a, b in zip(bl, prev[0])]
            dt = tot - prev[2]
            sh = [x / dt for x in dl]
            top = sorted(range(NL), key=lambda i: -sh[i])[:4]
            W("  %-7s days %3d-%-3d lines %s; eras %s; night %.0f%%" % (
                name, prev[3] + 1, d, ", ".join("%d: %.0f%%" % (i + 1, 100 * sh[i]) for i in top),
                " ".join("%.0f%%" % (100 * sum(sh[a:b])) for a, b in eras), 100 * (ni - prev[1]) / dt))
            prev = (bl, ni, tot, d)
    W("")
    A = [dict(zip(NAMES, alone[i * 4:(i + 1) * 4])) for i in range(len(SEEDS))]
    k = 0
    G5on = gres[k:k + 3]; k += 3
    G5off = gres[k:k + 3]; k += 3
    PR = {}
    for nm in pairs:
        PR[nm] = gres[k:k + 3]; k += 3
    WALLG = gres[k:k + 3]
    W("## N19: scrap as a 7-day average from day 2, the first Wipe Day's 3 excluded (min / mean / p90 / max; by d30, d180)")
    for lab, src in (("alone", A[1]), ("G5", G5on[1])):
        for n in NAMES:
            s = scrap_windows(src[n])
            W("  %-6s %-8s %.2f / %.2f / %.2f / %.2f; %s, %s" % (lab, n, s["min"], s["mean"], s["p90"], s["max"], s["d30"], s["d180"]))
    W("")
    W("## Alone, seeds 7/11/23 (cells: geometric mean glass ever / mean Wipe Days / lit share)")
    group_block(W, "alone (no friends)", A, ["idler", "casual", "active", "optimal"])
    W("## Groups (lockstep, seeds 7/11/23)")
    group_block(W, "G5 with Late Tide, Blowback from friends' Wipe Days (365 days)", G5on, ["idler", "casual", "active", "optimal", "late"])
    group_block(W, "G5 without Late Tide", G5off, ["idler", "casual", "active", "optimal", "late"])
    for nm, res in PR.items():
        group_block(W, "pair " + nm + ", Late Tide on", res, [m[0] for m in pairs[nm]])
    W("## Late wall: rings 6-9 lines budget, 365 days (seed 11); v2 is x1,000 each")
    for i, (lab, outer) in enumerate(wall.items()):
        L = dict(zip(NAMES, wres[i * 4:(i + 1) * 4]))
        c = L["casual"]
        late_n = e_at(c, 365)["nukes"] - e_at(c, 180)["nukes"]
        W("  alone %-7s casual lit d365 %.0f%%, Wipe Days d180-365 %d; gaps d365 active %.2f optimal %.2f idler %.2f" % (
            lab, 100 * e_at(c, 365)["lit"] / 361, late_n, e_at(L["active"], 365)["E"] / e_at(c, 365)["E"],
            e_at(L["optimal"], 365)["E"] / e_at(c, 365)["E"], e_at(L["idler"], 365)["E"] / e_at(c, 365)["E"]))
    for lab, g in zip(wall, WALLG):
        c = g["casual"]
        W("  G5    %-7s casual lit d365 %.0f%%, Wipe Days d180-365 %d; gaps d365 active %.2f optimal %.2f idler %.2f late %.2f" % (
            lab, 100 * e_at(c, 365)["lit"] / 361, e_at(c, 365)["nukes"] - e_at(c, 180)["nukes"],
            e_at(g["active"], 365)["E"] / e_at(c, 365)["E"], e_at(g["optimal"], 365)["E"] / e_at(c, 365)["E"],
            e_at(g["idler"], 365)["E"] / e_at(c, 365)["E"], e_at(g["late"], 365)["E"] / e_at(c, 365)["E"]))
    for lab, src in (("alone x1,000 (seed 11)", A[1]), ("G5 x1,000 (seed 11)", G5on[1])):
        c = src["casual"]
        W("  %-22s casual lit d365 %.0f%%, Wipe Days d180-365 %d; gaps d365 active %.2f optimal %.2f idler %.2f" % (
            lab, 100 * e_at(c, 365)["lit"] / 361, e_at(c, 365)["nukes"] - e_at(c, 180)["nukes"],
            e_at(src["active"], 365)["E"] / e_at(c, 365)["E"], e_at(src["optimal"], 365)["E"] / e_at(c, 365)["E"],
            e_at(src["idler"], 365)["E"] / e_at(c, 365)["E"]))
    W("")
    W("## Horizon (seed 11): glass ever / Wipe Days / lit at days 180, 240, 365; largest number")
    for lab, src in (("alone", A[1]), ("G5", G5on[1])):
        for n in list(NAMES) + (["late"] if lab == "G5" else []):
            pl = src[n]
            W("  %-5s %-8s %s | largest %s" % (lab, n, " | ".join(
                "d%d %s/%d/%.0f%%" % (d, fmt(e_at(pl, d)["E"]), e_at(pl, d)["nukes"], 100 * e_at(pl, d)["lit"] / 361)
                for d in (180, 240, 365)), fmt(pl.max_number)))
    W("")
    W("## Levers: one change at a time from canon v2, a player alone, 180 days (seed 11)")
    W("  %-34s %-7s %-8s %-6s %-12s %-12s %-12s %-6s" % ("lever", "N1", "cas d30", "n d30", "active 30/90", "optimal 30/90", "idler 30/90", "late"))
    for i, (lab, over) in enumerate(LVS):
        idl, cas, act, opt, fh = lres[i * 5:(i + 1) * 5]
        if lab == "canon v2 (alone)":
            opt_w = lres[-1]
        g = lambda x, d: e_at(x, d)["E"] / e_at(cas, d)["E"]
        rows = run_rows(cas)
        late = med([r["dur"] for r in rows if phase(r) == "late"])
        W("  %-34s %-7s %-8s %-6d %-12s %-12s %-12s %s" % (
            lab, hms(fh.runs[0]["dur"]) if fh.runs else "-", fmt(e_at(cas, 30)["E"]), e_at(cas, 30)["nukes"],
            "%.2f/%.2f" % (g(act, 30), g(act, 90)), "%.2f/%.2f" % (g(opt, 30), g(opt, 90)), "%.2f/%.2f" % (g(idl, 30), g(idl, 90)),
            "%.1f d" % (late / DAY) if late else "-"))
    base_cas = lres[1]
    W("  %-34s optimal %.2f/%.2f" % ("optimal awake 07-23 only", e_at(opt_w, 30)["E"] / e_at(base_cas, 30)["E"], e_at(opt_w, 90)["E"] / e_at(base_cas, 90)["E"]))
    W("")
    W("done in %.0fs" % (time.time() - t0))
    out = "\n".join(lines) + "\n"
    open(os.path.join(OUT, "v2_extra.txt"), "w", newline="").write(out)
    print(out)


if __name__ == "__main__":
    main()

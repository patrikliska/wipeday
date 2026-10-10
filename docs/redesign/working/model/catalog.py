"""Builds plan/04b-blast-map-catalog.md and plan/04b-blast-map.json from the eight sector files.

Run after fix_04b.py and a clean treecheck.py:  python -I catalog.py
"""
import json
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fix_04b  # noqa: E402  (the change log and the serializer)
import treecheck as T  # noqa: E402

OUT_MD = os.path.join(T.PLAN, "04b-blast-map-catalog.md")
OUT_JSON = os.path.join(T.PLAN, "04b-blast-map.json")
SECTOR_NAME = {"grip": "Grip", "crew": "Crew", "works": "Works", "tide": "Tide", "bunker": "Bunker",
               "blast": "Blast", "logbook": "Logbook", "scrapyard": "Scrapyard"}
SECTOR_LINE = {
    "grip": "Your hands are the first machine",
    "crew": "Every line has a name on it",
    "works": "Build it once, build it bigger",
    "tide": "The sea always brings something",
    "bunker": "Lock up, sleep well, wake up rich",
    "blast": "Bigger bangs, brighter glass",
    "logbook": "Write it down; it pays",
    "scrapyard": "Nothing is junk if you keep it",
}
COL_LABEL = {
    "output": "`output` (lines)", "tap": "`tap`", "tap_share": "`tap_share` (p)",
    "hustle_max": "`hustle_max` (+)", "crit": "crits (average)", "line_cost": "`line_cost`",
    "hand_cost": "`hand_cost`", "upgrade_cost:grip": "`upgrade_cost` Grip rungs",
    "upgrade_cost:line_mk": "`upgrade_cost` Line Mks", "upgrade_cost:island": "`upgrade_cost` island",
    "era_cost": "`era_cost`", "flotsam_rate": "`flotsam_rate`", "flotsam_effect": "`flotsam_effect`",
    "night_shift": "`night_shift` (+h)", "offline": "`offline`", "glass_gain": "`glass_gain`",
    "glow_k": "`glow_k` (+)", "morale_per": "`morale_per` (+)",
}


def fmt_glass(v):
    """fmtCount: separators below a million, then 3 significant digits (09 2.4, 04 3.1)."""
    v = float(v)
    if v < 1e6:
        return f"{int(round(v)):,}"
    for div, suf in ((1e12, "T"), (1e9, "B"), (1e6, "M")):
        if v >= div:
            x = v / div
            s = f"{x:.3g}"
            if "e" in s:
                s = f"{x:.0f}"
            return s + suf
    return str(v)


def fmt_x(v):
    if v >= 1e4:
        m, e = f"{v:.3e}".split("e")
        return f"×{float(m):.2f}e{int(e)}"
    if v >= 100:
        return f"×{v:,.0f}"
    return f"×{v:.3g}" if v >= 10 else f"×{v:.3f}".rstrip("0").rstrip(".") if False else f"×{v:.3g}"


def fmt_add(v):
    return f"+{v:g}" if v else "0"


def esc(s):
    return str(s).replace("|", "\\|")


def wave_cell(n):
    w = n["wave"]
    bits = [w]
    if n["ring"] >= 7 and n.get("data_from"):
        bits.append(f"data {n['data_from']}")
    if n.get("gate") is not None:
        bits.append(f"gate {n['gate']}")
    return ", ".join(bits)


def type_cell(n):
    t = n["type"]
    extra = []
    if n.get("anchor"):
        extra.append("anchor")
    if n.get("scene"):
        extra.append("scene")
    return t + (f" ({', '.join(extra)})" if extra else "")


def requires_cell(n, byid):
    if n["type"] == "completion":
        return f"all of ring {n['ring'] - 1} (AND)"
    return ", ".join(f"`{r}`" for r in n["requires"])


def text_cell(n):
    t = n["text"].strip()
    if n.get("counts_as"):
        ca = "; ".join(f"{e['stat']} ×{e['value']:g}" for e in n["counts_as"])
        t += f" *[counts as {ca}]*"
    if n.get("conflicts"):
        t += f" *[conflicts: {', '.join(n['conflicts'])}]*"
    return esc(t)


def main():
    nodes = T.load()
    R, B = T.run_checks(nodes)
    errs = R.errors()
    if errs:
        print("checker has errors; fix them first")
        for e in errs:
            print(e)
        return 1
    warns = [i for i in R.items if i[0] == "WARN"]
    notes = [i for i in R.items if i[0] == "NOTE"]
    byid = {n["id"]: n for n in nodes}
    sec = [n for n in nodes if n["id"] != "ground_zero"]
    order = [nodes[0]] + sorted(sec, key=lambda n: (T.SECTORS.index(n["sector"]), n["ring"], n["slot"]))

    # --- JSON (ground_zero first)
    gz = dict(nodes[0])
    body = ",\n".join(fix_04b.dumps_node(n) for n in order)
    text = "[\n" + body + "\n]\n"
    assert len(json.loads(text)) == 361
    with open(OUT_JSON, "w", encoding="utf-8", newline="") as f:
        f.write(text)

    # --- change log (re-derived from the backup, so it matches the files)
    data = fix_04b.load_backup()
    fix_04b.CHANGES.clear()
    fix_04b.apply(data)
    changes = list(fix_04b.CHANGES)

    L = []
    w = L.append
    w("# 04b The Blast Map: the full catalog (proposal)")
    w("")
    w("All 361 nodes of the Blast Map in one place: Ground Zero and the eight sectors of "
      "`04-blast-map.md`, as written in `04b-<sector>.json` and checked by "
      "`model/treecheck.py`. The data is `04b-blast-map.json` (one array, `ground_zero` first). "
      "Names are proposals for the owner's pass; numbers are starting values that the simulator may "
      "retune in data. The readable sector notes (`04b-<sector>.md`) explain each writer's choices; "
      "where this catalog and a sector note differ, this catalog is current (section 4 lists every "
      "change).")
    w("")
    w(f"**Check result:** 361 nodes, **0 errors**, {len(warns)} warnings (section 5). Generated "
      "from the JSON by `model/catalog.py`; do not edit by hand.")
    w("")
    w("## 1. How to read it")
    w("")
    w("- **Place.** `ring.slot`: ring 1 is next to Ground Zero, ring 9 is the rim; slots run 1..n "
      "clockwise across the sector's wedge (ring sizes 2, 3, 4, 5, 5, 6, 6, 7, 7).")
    w("- **Type.** `small` (one stat from the step table, no blurb), `notable` (a named mechanic, "
      "×2 price), `keystone` (rule-bending, works only when slotted, ×3 price, at 5.3 and 8.4), "
      "`unlock` and `automation` (may need new code: `feature:<id>`), `completion` (needs every node "
      "of the previous ring, at 4.3 and 9.4). \"anchor\" marks canon 6.7's fixed nodes; \"scene\" a "
      "node that changes the island (its drawing is in the JSON's `scene`).")
    w("- **Text.** The player-facing line (the blurb for every node that is not small). "
      "*[counts as …]* is the node's `counts_as`: what a feature is worth to the power budget at "
      "its cap, which the simulator also uses. *[conflicts …]* names keystones the rebuild screen "
      "warns about.")
    w("- **Cost** is crater glass, printed as `fmtCount` does (separators below a million).")
    w("- **Requires** is OR: one owned parent is enough. A completion needs all of the previous "
      "ring (AND). Every edge runs from the previous ring of the same sector (`04` 1.3's default "
      "wiring; no extra links).")
    w("- **Wave** is the build that shows the node (resolution 3.8): R2 rings 1-3, R3-R5 rings 4-6, "
      "R7 rings 7-9. \"data Rn\" is when a hidden ring 7-9 node joins `blastmap.json5`. \"gate n\" "
      "is the node's own Wipe Day gate (at least its system's agenda count and its ring's gate).")
    w("")
    w("What `treecheck.py` asserts (`04` 9.3, `10-balance.md` 6, resolutions 1.5, 3.8, 3.12, 3.13):")
    w("")
    w("| Check | Rule |")
    w("| --- | --- |")
    for a, b in (
            ("Structure", "361 nodes; 45 per sector; ring sizes 2-7; slots unique; types equal `04` 6's slot tables and 2.2's quotas; keystones at 5.3 and 8.4, completions at 4.3 and 9.4; `04` 6's fixed nodes at their slots"),
            ("Ids and words", "unique `snake_case` ids, 2-32 characters, never a sector, line, era, target, flotsam kind or shelf upgrade id; the eight legacy perk ids present; names at most 24 characters, blurbs at most 80"),
            ("Edges", "parents exist, sit in the previous ring of the same sector, include the default wiring, number 1-3 (a completion: the whole ring); acyclic; every node reachable from `ground_zero`"),
            ("Chains", "never three small nodes in a row on any path (dynamic programming over the graph); consecutive smalls change series (warning)"),
            ("Costs", "on `04` 3.1's ladder and inside the ring's band × type factor; keystones 7,777 and 7.77M; completions 555 and 55.5M; Dead Hand 22,200"),
            ("Waves", "73 shown in R2, 178 by R3, 191 by R4, 201 by R5, 361 in R7; `04` 1.4's R4 and R5 node lists; no node in data before its system ships; no orphan in any build"),
            ("Effects", "every stat, op, `per`, `when` and `scope` registered (`09` 5.1); every `per` has a `max`; `feature:*` only on unlock, automation and keystone nodes; outside keystones nothing worsens a stat; small nodes have one effect"),
            ("Gates", "a node touching Rush, Grit, the Flare, the Foreman, Dares or Dead Hand carries at least that agenda count, and no gate sits below its ring's"),
            ("Keystones", "a printed downside (an effect that lowers a stat, or a feature, which warns); conflicts name keystones and run both ways"),
            ("Anchors", "canon 6.7's nodes with resolution 3.13's values: Glow Lamp `k` +0.02, Union Rules ×2.2, Lone Wolf taps ×50 and no hands, Dead Hand 22,200"),
            ("Ceilings", "`04` 4.2 over all non-keystone nodes: Hustle ×2.25, hold 6 s, drain 5/s, gain 3; Afterglow 900 s and 120 s held; float 25 s (40 s in rain); Night Shift exactly +32 h; offline ×1.772; glass ×2.25; `k` 0.49; Morale per page 0.05, Morale ×1.5; prices ×0.29 / ×0.25 per shelf kind / ×0.5 for eras; flotsam ×1.05 / ×1.05; milestone, roster, Mk and rank pays; no node on the Sealed Locker"),
            ("10% rule", "each small from ring 3 raises its stat and scope at least 10% over the lower rings (the Magnet's winches are a timer and exempt, note)"),
            ("Budget", "per ring and column, the running product (or sum) of node effects through each ring stays within `10-balance.md` 6.1's running budget +10%; each sector within its share (section 3.3)"),
            ("Taps", "the steady tap coefficient `c` = 6 taps/s × p × tap value × Hustle × crits × fells ≤ 0.6 with the whole tree"),
    ):
        w(f"| {a} | {b} |")
    w("")

    # --- 2. summary: counts
    w("## 2. Counts")
    w("")
    w("### 2.1 By sector and type")
    w("")
    w("| Sector | Small | Notable | Keystone | Unlock | Automation | Completion | Total |")
    w("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for s in T.SECTORS:
        c = Counter(n["type"] for n in sec if n["sector"] == s)
        w(f"| {SECTOR_NAME[s]} | " + " | ".join(str(c[t]) for t in T.TYPES) + f" | {sum(c.values())} |")
    w("| Ground Zero | 0 | 0 | 0 | 1 | 0 | 0 | 1 |")
    tc = Counter(n["type"] for n in nodes)
    w("| **Total** | " + " | ".join(f"**{tc[t]}**" for t in T.TYPES) + " | **361** |")
    w("| Share | " + " | ".join(f"{tc[t] / 361 * 100:.1f}%" for t in T.TYPES) + " | 100% |")
    w("")
    w("### 2.2 By ring")
    w("")
    w("| Ring | Opens at Wipe Day | Nodes | Small | Notable | Keystone | Unlock | Automation | Completion | Running total (with GZ) |")
    w("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
    run = 1
    for r in range(1, 10):
        rn = [n for n in sec if n["ring"] == r]
        c = Counter(n["type"] for n in rn)
        run += len(rn)
        w(f"| {r} | #{T.RING_GATE[r]} | {len(rn)} | " + " | ".join(str(c[t]) for t in T.TYPES) + f" | {run} |")
    w("")
    w("### 2.3 By build (resolution 3.8)")
    w("")
    w("\"Shown\" counts nodes drawn and buyable in that build (with Ground Zero); \"in data\" adds the "
      "hidden ring 7-9 nodes already in `blastmap.json5`, which the simulator counts (N15).")
    w("")
    w("| Build | New nodes shown | Shown (running) | Target | In data (running) | What arrives |")
    w("| --- | --- | --- | --- | --- | --- |")
    def names(ids):
        return ", ".join(byid[i]["name"] for i in ids)

    joins = {b: [n["id"] for n in order if n["id"] != "ground_zero" and n["ring"] >= 7
                 and n.get("data_from") == b] for b in ("R3", "R4", "R5", "R7")}
    shown_in = {b: [n["id"] for n in order if n["id"] != "ground_zero" and n["wave"] == b]
                for b in ("R4", "R5")}
    what = {
        "R2": "Ground Zero and rings 1-3 of all eight sectors",
        "R3": f"rings 4-6 except 23 reserved slots; {len(joins['R3'])} ring 7-9 nodes join the data, hidden",
        "R4": f"shown: {names(shown_in['R4'])}; joining the data: {names(joins['R4'])}",
        "R5": f"shown: {names(shown_in['R5'])}; joining the data: {names(joins['R5'])}",
        "R7": f"rings 7-9 shown; joining the data last: {names(joins['R7'])}",
    }
    prev = 0
    for b in ["R2", "R3", "R4", "R5", "R7"]:
        shown = sum(1 for n in nodes if T.PH[n["wave"]] <= T.PH[b])
        indata = shown + sum(1 for n in sec if n["ring"] >= 7 and T.PH[n.get("data_from", "R3")] <= T.PH[b]
                             and T.PH[n["wave"]] > T.PH[b])
        w(f"| {b} | {shown - prev} | {shown} | {T.BUILD_TOTALS[b]} | {indata} | {what[b]} |")
        prev = shown
    w("")
    w("Per sector and build (nodes shown):")
    w("")
    w("| Sector | R2 | R3 | R4 | R5 | R7 |")
    w("| --- | --- | --- | --- | --- | --- |")
    for s in T.SECTORS:
        c = Counter(n["wave"] for n in sec if n["sector"] == s)
        w(f"| {SECTOR_NAME[s]} | " + " | ".join(str(c[b]) for b in ["R2", "R3", "R4", "R5", "R7"]) + " |")
    w("")

    # --- 3. budget
    w("## 3. The power budget (`10-balance.md` 6)")
    w("")
    w("How a node is counted (`10-balance.md` 6.2, the rules the check uses):")
    w("")
    w("- Multiplicative columns are the product of node effects; `inc` effects count as the ratio of "
      "`(1 + Σinc)` with and without the ring, every lower ring owned; additive columns are sums. "
      "Every column is checked **cumulatively**: the running product through ring r may exceed the "
      "budget's running product by at most 10%. Moving power to a later ring is allowed.")
    w("- Each effect counts at its typical state: `night` at 0.1 in rings 1-3 and 0.4 from ring 4, "
      "`rain` 0.2, `afterglow` 0.02 (`04` 7.3), `online` 0.1, `offline` at full value; `per` effects "
      "at their `max`; features at their `counts_as`.")
    w("- Scopes count at their share of line income. Rings 4-9 (mid-game): Reactor 0.82, Ship Breaker "
      "0.15, Radio Mast 0.03, other lines 0 (Armored 0.97, Sheet Metal 0.03). Rings 1-3 (week 1): Radio "
      "Mast 0.58 and Sheet Metal 0.83 as 10 gives them; the other week-1 lines are this checker's "
      "estimates (Generator 0.18, Dock 0.07, Stone era 0.155, Timber 0.012, Twig 0.003) until "
      "`10-balance.md` publishes them.")
    w("- `milestone_x2` counts ×(x/2)³, `roster_x2` ×(x/2)², `mk_mult` ×(x/3)², `rank_mult` ×(x/2)⁵, "
      "`speed` and `morale` as `output`. Keystones sit outside the budget.")
    w("- **Night Shift hours** are checked against `04`'s window plan (+4 h in each of rings 1-8), "
      "which `10-balance.md` 6.1's text says its column follows; its table row (+4, 0, +4, 0, +4, +8, "
      "+4, +8, 0) runs 4 h behind the plan in rings 2-7 and should be corrected (note 3).")
    w("")
    w("### 3.1 The lines column, ring by ring")
    w("")
    w("| Ring | Budget | Tree (linear count) | Running | Running budget | Used | Time-weighted fold (diagnostic) | Fold running |")
    w("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for r in range(1, 10):
        f, b, run, runb = B["ring"][r]["output"]
        cf, crun = B["compound"][r]
        w(f"| {r} | {fmt_x(b)} | {fmt_x(f)} | {fmt_x(run)} | {fmt_x(runb)} | {run / runb * 100:.0f}% | "
          f"{fmt_x(cf)} | {fmt_x(crun)} |")
    w("")
    w(f"The tree ends at {fmt_x(B['ring'][9]['output'][2])} of the budget's "
      f"{fmt_x(B['ring'][9]['output'][3])} ({B['ring'][9]['output'][2] / B['ring'][9]['output'][3] * 100:.0f}%). "
      "Rings 1-4 run well behind (the early runaway guard), so rings 5, 8 and 9 may each pass their own "
      "ring's figure while every running total holds. The diagnostic columns fold conditions together "
      "per line and per time slice instead of counting each effect on its own; see note 1.")
    w("")
    w("### 3.2 Every other column (running total through the ring / running budget)")
    w("")
    hdr = "| Column | " + " | ".join(f"r{r}" for r in range(1, 10)) + " | Whole tree |"
    w(hdr)
    w("| --- |" + " --- |" * 10)
    for col, (kind, bud) in T.BUDGET.items():
        if col == "output":
            continue
        cells = []
        for r in range(1, 10):
            f, b, run, runb = B["ring"][r][col]
            if kind == "add":
                cells.append(f"{run:g} / {runb:g}")
            else:
                cells.append(f"{run:.3g} / {runb:.3g}")
        f, b, run, runb = B["ring"][9][col]
        tot = f"{run:g}" if kind == "add" else f"×{run:.3g}"
        w(f"| {COL_LABEL[col]} | " + " | ".join(cells) + f" | {tot} |")
    w("")
    cp = B["c_parts"]
    w(f"**Steady tap coefficient:** c = 6 × p {cp['p']:.4f} × tap value {cp['T']:.2f} × Hustle "
      f"{cp['H']:.2f} × crits {cp['crit']:.2f} × fells {cp['fell']:.4f} = **{B['c']:.3f}** "
      "(ceiling 0.6, resolution 1.5). Nothing past ring 4 raises `c`; Clear-Cut's fells are a "
      "burst while Afterglow lasts and sit outside it.")
    w("")
    w("### 3.3 The lines share by sector (factor used in the ring / share)")
    w("")
    w("`04` 7.2 and `10-balance.md` 6.3 split the lines column differently (each multiplies to the "
      "ring's budget). Grip, Tide and Blast record `04` 7.2's split as a trade (10 gives them no "
      "`output`); Works, Crew, Logbook, Bunker and Scrapyard follow 10. A sector's share here is the "
      "larger of its two figures, checked cumulatively at +10%; the ring totals in 3.1 decide whether "
      "the trades hold. They did not until Works gave back part of its ×22 a ring (section 4, the "
      "Works row): Works is `04` 7.2's donor for that trade. Small scoped effects on early lines "
      "(Twig, Timber, Docks, Beachcombers) count near zero here and show as –.")
    w("")
    w("| Sector | " + " | ".join(f"r{r}" for r in range(1, 10)) + " | Sector total | Share (04 / 10) |")
    w("| --- |" + " --- |" * 11)
    for s in T.SECTORS:
        cells = []
        for r in range(1, 10):
            f, sh, run, runb = B["sector"][s][r]
            cells.append("–" if abs(f - 1) < 5e-3 and abs(sh - 1) < 1e-9 else f"{f:.3g} / {sh:.3g}")
        p04 = p10 = 1.0
        for r in range(9):
            p04 *= T.SHARE_04[s][r]
            p10 *= T.SHARE_10[s][r]
        tot = B["sector"][s][9][2]
        w(f"| {SECTOR_NAME[s]} | " + " | ".join(cells) + f" | {fmt_x(tot)} | {fmt_x(p04)} / {fmt_x(p10)} |")
    w("")

    # --- 3.4 costs
    w("### 3.4 What the tree costs (glass)")
    w("")
    w("| Ring | " + " | ".join(SECTOR_NAME[s] for s in T.SECTORS) + " | Ring | Running |")
    w("| --- |" + " --- |" * 10)
    run = 0
    tot_s = Counter()
    for r in range(1, 10):
        cells = []
        rt = 0
        for s in T.SECTORS:
            c = sum(n["cost"] for n in sec if n["sector"] == s and n["ring"] == r)
            tot_s[s] += c
            rt += c
            cells.append(fmt_glass(c))
        run += rt
        w(f"| {r} | " + " | ".join(cells) + f" | {fmt_glass(rt)} | {fmt_glass(run)} |")
    w("| **Sector** | " + " | ".join(f"**{fmt_glass(tot_s[s])}**" for s in T.SECTORS) +
      f" | **{fmt_glass(run)}** | |")
    w("")
    w(f"Lighting the whole map takes {fmt_glass(run)} glass (`04` 3.2 estimated about 2.9B). Wave 1 "
      f"(rings 1-3) costs {fmt_glass(sum(n['cost'] for n in sec if n['ring'] <= 3))}; the first "
      "nuke's 10 glass buys the guided basket of ring-1 nodes (`04` 3.4).")
    w("")

    # --- 4. changes
    w("## 4. What the checker changed in the sector files")
    w("")
    w("Every change is in `model/fix_04b.py`, applied to the writers' originals (kept in "
      "`model/backup_04b/`). All eight files were also re-serialised in one layout, with no change "
      "to any other value.")
    w("")
    groups = []  # one row per reason, in first-seen order
    for s, nid, what_, why in changes:
        for g in groups:
            if g["why"] == why:
                g["items"].append((s, nid, what_))
                break
        else:
            groups.append({"why": why, "items": [(s, nid, what_)]})
    w("| # | Nodes and change | Why |")
    w("| --- | --- | --- |")
    for k, g in enumerate(groups, 1):
        parts = []
        for s, nid, what_ in g["items"]:
            where = "all sectors" if s == "all" else SECTOR_NAME[s]
            label = nid if s == "all" else f"`{nid}`"
            parts.append(f"{where} {label}: {esc(what_)}")
        w(f"| {k} | " + "<br>".join(parts) + f" | {esc(g['why'])} |")
    w("")
    w(f"{len(changes)} changes in {len(groups)} groups. The Works trim (the row naming Elbow Grease IV-VI, "
      "Retooling IV-VI, Smokestacks and Rivet Gun) is the only change of power; every other row is "
      "vocabulary, data hygiene or a gate that moves nothing.")
    w("")

    # --- 5. warnings and notes
    w("## 5. Warnings and open items")
    w("")
    w("The check passes. These are warnings it prints and items for other plan files:")
    w("")
    st = B["stack"]
    lin9 = B["ring"][9]["output"][2]
    c9 = B["compound"][9][1]
    b9 = B["ring"][9]["output"][3]
    items = [
        f"**Stacked conditions (for `10-balance.md` 6.2; Bunker's open question 1).** Counted one "
        f"effect at a time, as 6.2 says, the lines column ends at {fmt_x(lin9)} against {fmt_x(b9)}. "
        f"Folded together per line and per time slice, the same nodes read {fmt_x(c9)}, about "
        f"×{c9 / lin9:.1f} more, because conditions multiply inside themselves: at the full tree night "
        f"pays ×{st['night']:.0f} the day (Logbook's Night Log I-VI and Almanac, Bunker's Night Lamps, "
        "Lantern Oil I-IV, Moonshine Still and Night Owls) and rain ×"
        f"{st['rain']:.1f} (Weather Log, Storm Harvest, Rain Barrels, Rainy Day Fund). Removing night "
        "and rain effects brings the two readings within ×1.5. Proposal for 10: count each condition "
        "by its fold (`1 + w × (Π f − 1)`, cumulatively), or cap each condition over all non-keystone "
        "nodes (night ×4, rain ×3, like the flotsam column). Either way the fix is in data: Night Log "
        "III-VI and Rainy Day Fund move most of their value to all-line effects of the same linear "
        "count. This catalog keeps the writers' values because 6.2's rule, as written, passes them.",
        "**Keystones whose downside lives in a feature:** Mass Production (the speed milestones pay "
        "nothing), Tall Tales (lines lose Morale while Hustle runs) and Sentimental (one Pocket slot "
        "fewer). Check 5 must read a feature's printed downside, or `09` 5.1 registers a stat for it "
        "(Scrapyard's `pocket_cap`). Every keystone still needs its simulator row (resolution 3.13).",
        "**Night Shift hours row.** `10-balance.md` 6.1's table gives the window +4, 0, +4, 0, +4, +8, "
        "+4, +8, 0 h; its text, `04` 4.2, 6.7, 7.1 and 10.4 give +4 h in each of rings 1-8. The tree "
        "never runs ahead of the plan (Bunker puts Root Cellar III in ring 6 beside Cold Storage, so "
        "ring 5 adds nothing and ring 6 adds +8 h). Against the table row it runs 4 h ahead in rings "
        "2-7. The row should read +4 in rings 1-8; hours past Deep Cellars move no simulated number.",
        "**Week-1 line shares.** Rings 1-3 are counted with the estimates in 3; `10-balance.md` should "
        "publish the shares it measures each ring at (`04` open question 2). Every ring 1-4 total is "
        "far under its budget, so no estimate changes the result.",
        "**Line Mk IV and `mk_mult`.** Mk IV counts ×3. If it pays `mk_mult` like Mk II and III "
        "(Works open question 4), Spare Parts, Double Rivets and Yard Boss lift it too (×3.7 to ×4 "
        "late) and Yard Boss's Mk part counts (x/3)³; about ×1.4 more at ring 9, inside the remaining "
        "room only if the simulator agrees. Simplest: Mk IV pays a flat ×3.",
        "**The Magnet's winches** (Quick Winch, Greased Cable, Heavy Coil, Night Crane) add 4-5% each "
        "and are exempt from the 10% rule as a timer (Scrapyard open question 1); `04` 9.3 check 12 "
        "should say so.",
        "**Gates.** Node gates now equal the larger of the system's agenda count and the ring's gate "
        "(Hair Trigger 20, Wake-up Call 10, Flare Gun 20, Auto Flare 40, Double Dare 30, Dare Ledger "
        "40, Foreman's Mate 20, Dead Hand 25). Nothing opens earlier or later; `04` 1.4's table "
        "(\"gate 4\", \"gate 15\" ...) names the system count, which the agenda line still shows.",
        "**Names for the naming pass.** Rain Barrels (Tide 6.4) and Cutting Torch (Tide 7.3, 8.2) "
        "repeat the Garden's and Ship Breaker's Mk II subtitles (`02` 5.3); one of each should change. "
        "Scavenger's Eye's blurb names Bottles and Sealed Lockers, which ship after it (R4, R5): its "
        "R3 locale line should leave them out (resolution 3.7).",
        "**Lines share left unused** (room for the simulator): Works ends at "
        f"{fmt_x(B['sector']['works'][9][2])}, Logbook {fmt_x(B['sector']['logbook'][9][2])}, Scrapyard "
        f"{fmt_x(B['sector']['scrapyard'][9][2])}; the tree as a whole at "
        f"{B['ring'][9]['output'][2] / B['ring'][9]['output'][3] * 100:.0f}% of its budget.",
    ]
    for i, it in enumerate(items, 1):
        w(f"{i}. {it}")
    w("")
    w("Checker warnings, verbatim:")
    w("")
    for lvl, chk, msg in warns + notes:
        w(f"- {lvl} [{chk}] {esc(msg)}")
    w("")

    # --- 6. nodes
    w("## 6. The nodes")
    w("")
    w("### 6.0 Ground Zero")
    w("")
    w("| Ring.slot | Id | Type | Name | Text | Cost | Requires | Wave |")
    w("| --- | --- | --- | --- | --- | --- | --- | --- |")
    g = nodes[0]
    w(f"| 0 | `ground_zero` | unlock (anchor, scene) | Ground Zero | {esc(g['text'])} | free (the first "
      f"nuke) | – | R2 |")
    w("")
    for i, s in enumerate(T.SECTORS, 1):
        ns = [n for n in order if n["id"] != "ground_zero" and n["sector"] == s]
        cost = sum(n["cost"] for n in ns)
        w(f"### 6.{i} {SECTOR_NAME[s]} (`{s}`): \"{SECTOR_LINE[s]}\"")
        w("")
        c = Counter(n["type"] for n in ns)
        w(f"{c['small']} small, {c['notable']} notable, {c['keystone']} keystone, {c['unlock']} unlock, "
          f"{c['automation']} automation, {c['completion']} completion; {fmt_glass(cost)} glass to "
          f"light. Sector notes: `04b-{s}.md`.")
        w("")
        w("| Ring.slot | Id | Type | Name | Text | Cost | Requires | Wave |")
        w("| --- | --- | --- | --- | --- | --- | --- | --- |")
        for n in ns:
            w(f"| {n['ring']}.{n['slot']} | `{n['id']}` | {type_cell(n)} | {esc(n['name'])} | {text_cell(n)} | "
              f"{fmt_glass(n['cost'])} | {requires_cell(n, byid)} | {wave_cell(n)} |")
        w("")

    with open(OUT_MD, "w", encoding="utf-8", newline="") as f:
        f.write("\n".join(L).rstrip() + "\n")
    print(f"wrote {OUT_MD} and {OUT_JSON}; {len(changes)} changes listed; {len(warns)} warnings")
    return 0


if __name__ == "__main__":
    sys.exit(main())

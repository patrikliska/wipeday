"""Applies the checker-driven fixes to plan/04b-<sector>.json (from the originals in backup_04b/).

Every change is listed in CHANGES and printed; re-running starts again from the backup, so the
script is idempotent. Run: python -I fix_04b.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PLAN = os.path.normpath(os.path.join(HERE, "..", "plan"))
BACKUP = os.path.join(HERE, "backup_04b")
SECTORS = ["grip", "crew", "works", "tide", "bunker", "blast", "logbook", "scrapyard"]

KEY_ORDER = ["id", "sector", "ring", "slot", "type", "name", "series", "text", "effects",
             "counts_as", "cost", "requires", "wave", "data_from", "gate", "feature", "conflicts",
             "anchor", "scene", "flavour"]

CHANGES = []  # (sector, id, what, why)


def log(sector, nid, what, why):
    CHANGES.append((sector, nid, what, why))


def load_backup():
    data = {}
    for s in SECTORS:
        with open(os.path.join(BACKUP, f"04b-{s}.json"), encoding="utf-8") as f:
            data[s] = json.load(f)
    return data


def find(data, nid):
    for s, ns in data.items():
        for n in ns:
            if n["id"] == nid:
                return s, n
    raise KeyError(nid)


def dumps_value(v):
    return json.dumps(v, ensure_ascii=False)


def fmt_num(v):
    if isinstance(v, float) and v.is_integer() and abs(v) < 1e15:
        return str(int(v))
    return json.dumps(v)


def dumps_effect(e):
    parts = []
    for k in ("stat", "op", "value", "scope", "per", "max", "when"):
        if k in e:
            val = fmt_num(e[k]) if isinstance(e[k], (int, float)) and not isinstance(e[k], bool) else dumps_value(e[k])
            parts.append(f'"{k}": {val}')
    for k in e:
        if k not in ("stat", "op", "value", "scope", "per", "max", "when"):
            parts.append(f'"{k}": {dumps_value(e[k])}')
    return "{" + ", ".join(parts) + "}"


def dumps_node(n):
    keys = [k for k in KEY_ORDER if k in n] + [k for k in n if k not in KEY_ORDER]
    lines = []
    head = ", ".join(f'"{k}": {dumps_value(n[k])}' for k in ("id", "sector", "ring", "slot", "type") if k in n)
    lines.append(head)
    rest = [k for k in keys if k not in ("id", "sector", "ring", "slot", "type")]
    tail_group = []
    for k in rest:
        if k in ("effects", "counts_as"):
            effs = n[k]
            lines.append(f'"{k}": [\n      ' + ",\n      ".join(dumps_effect(e) for e in effs) + "\n    ]")
        elif k in ("cost",):
            lines.append(f'"cost": {fmt_num(n[k])}, "requires": {dumps_value(n["requires"])}, "wave": {dumps_value(n["wave"])}'
                         + (f', "data_from": {dumps_value(n["data_from"])}' if "data_from" in n else "")
                         + (f', "gate": {fmt_num(n["gate"])}' if "gate" in n else ""))
        elif k in ("requires", "wave", "data_from", "gate"):
            continue
        else:
            lines.append(f'"{k}": {dumps_value(n[k])}')
    return "  {\n    " + ",\n    ".join(lines) + "\n  }"


def write(data):
    for s in SECTORS:
        body = ",\n".join(dumps_node(n) for n in data[s])
        text = "[\n" + body + "\n]\n"
        json.loads(text)  # must stay valid JSON
        with open(os.path.join(PLAN, f"04b-{s}.json"), "w", encoding="utf-8", newline="") as f:
            f.write(text)


def apply(data):
    # --- 1. vocabulary: feature-registered conditions are not in 09 5.1's registry
    for nid, fac, was in (("golden_chip", 1.5, "output ×1.5, when: golden_chip"),
                          ("woodpile", 1.4, "output +2% a log, per: logs, max ×1.4"),
                          ("trophy_rack", 1.2, "output +4% a trophy, per: trophies, max ×1.2")):
        s, n = find(data, nid)
        n["effects"] = [e for e in n["effects"] if e["stat"].startswith("feature:")]
        n["counts_as"] = [{"stat": "output", "op": "more", "value": fac, "scope": "all"}]
        log(s, nid, f"`{was}` moved from `effects` to `counts_as` (output ×{fac:g} at its cap); the feature carries the rule",
            "`when: golden_chip`, `per: logs` and `per: trophies` are not registered (09 5.1); "
            "the budget still counts the bonus at its cap (04 7.3)")

    # --- 2. counts_as for the other power-bearing features, as their writers counted them
    for nid, fac, why in (
            ("personal_best", 1.075, "+15% for the rest of a run, counted at half as 10 6.6 does"),
            ("pay_day", 1.02, "04b-crew 1"),
            ("crew_photo", 1.4, "04b-crew 1"),
            ("relief_crew", 1.5, "04b-crew 1"),
            ("line_mk_iv", 3, "04b-works 2.1"),
            ("lights_out", 1.1, "04b-bunker 2.1")):
        s, n = find(data, nid)
        n["counts_as"] = [{"stat": "output", "op": "more", "value": fac, "scope": "all"}]
        log(s, nid, f"added `counts_as` output ×{fac:g}", "a feature's power the writer counted in the share (" + why + "), now visible to the check")

    # --- 3. ids: `tide_mill` is the island upgrade's id (02 5.4) and its scene prop
    s, n = find(data, "tide_mill")
    n["id"] = "tide_pump"
    n["name"] = "Tide Pump"
    n["text"] = n["text"].replace("a tide mill turns", "a tide pump creaks").replace("tide mill", "tide pump")
    if n.get("scene"):
        n["scene"] = ("a timber tide pump at the water's edge, its rocking beam nodding with the "
                      "waves and faster in rain (the island's Tide Mill upgrade keeps the waterwheel)")
    for ns in data.values():
        for m in ns:
            m["requires"] = ["tide_pump" if r == "tide_mill" else r for r in m["requires"]]
    log(s, "tide_mill", "renamed `tide_pump` (Tide Pump, \"a tide pump creaks at the water's edge\"); Sea Wall III's requires follows",
        "`tide_mill` is island upgrade 6's id and its prop (02 5.4): one id would name two scene drawings")

    # --- 4. data_from on every wave-3 node; dataFrom -> data_from
    late = {"campfire_stories": ("R4", "`per: entries` needs the Logbook"),
            "lost_cargo": ("R7", "the `lost_cargo` flotsam kind and its code ship in R7"),
            "bottle_post": ("R4", "the Bottle kind ships in R4"),
            "auto_flare": ("R5", "the Flare ships in R5"),
            "heavy_coil": ("R5", "the Magnet ships in R5"), "night_crane": ("R5", "the Magnet ships in R5"),
            "brass_polish": ("R5", "ranks ship in R5"), "yard_boss": ("R5", "ranks ship in R5"),
            "sentimental": ("R5", "Pockets ship in R5"), "junk_drawer": ("R5", "Pockets ship in R5"),
            "golden_hook": ("R5", "the Magnet ships in R5")}
    added_default = []
    for s in SECTORS:
        for n in data[s]:
            if "dataFrom" in n:
                n["data_from"] = n.pop("dataFrom")
                log(s, n["id"], "`dataFrom` renamed `data_from`", "one key name in all eight files")
            if n["ring"] >= 7:
                if n["id"] in late:
                    want, why = late[n["id"]]
                    if n.get("data_from") != want:
                        log(s, n["id"], f"data_from {n.get('data_from', '(none, read as R3)')} → {want} ({why})",
                            "no node joins the data before its system ships (04 1.4, 9.3 check 16)")
                        n["data_from"] = want
                elif "data_from" not in n:
                    n["data_from"] = "R3"
                    added_default.append(n["id"])
    log("all", f"{len(added_default)} ring 7-9 nodes", "`data_from: \"R3\"` written out where it was implicit",
        "04 1.4: rings 7-9 join the data in R3 unless their system ships later; now explicit in every file")

    # --- 5. gates: at least the system's agenda count and at least the ring's gate (04 9.3 check 15)
    for nid, g, was, why in (
            ("hair_trigger", 20, None, "Rush (#4) on a ring-6 node (#20)"),
            ("wake_up_call", 10, 8, "Grit (#8) on a ring-5 node (#10)"),
            ("flare_gun", 20, 15, "the Flare (#15) on a ring-6 node (#20)"),
            ("auto_flare", 40, 15, "the Flare (#15) on a ring-8 node (#40)"),
            ("double_dare", 30, 5, "Dares (#5) on a ring-7 node (#30)"),
            ("dare_ledger", 40, 5, "Dares (#5) on a ring-8 node (#40)")):
        s, n = find(data, nid)
        n["gate"] = g
        log(s, nid, f"gate {was if was is not None else '(none)'} → {g} ({why})",
            "04 9.3 check 15: a gate carries the system's agenda count and is at least its ring's gate; "
            "nothing opens earlier or later than before")

    # --- 7. budget: Works pays the lines trade that Grip, Tide and Blast recorded (04 7.2 names
    # Works as the donor, x22 -> x6.5). Rings 7-9 come down from x16.2 / x19.9 / x21.6 to about
    # x6.1 / x12.0 / x16.3, so the output column's running product through ring 9 holds 10 6.1's
    # x7.0e13. The fixed nodes keep their values (The Works x3, Line Mk IV x3, Overtime x2).
    for nid, field, new, old_txt, new_txt in (
            ("elbow_grease_4", None, 1.3, "×1.5", "×1.3"),
            ("elbow_grease_5", None, 1.3, "×1.5", "×1.3"),
            ("elbow_grease_6", None, 1.3, "×1.5", "×1.3"),
            ("retooling_4", None, 1.3, "×1.5", "×1.3"),
            ("retooling_5", None, 1.3, "×1.5", "×1.3"),
            ("retooling_6", None, 1.3, "×1.5", "×1.3"),
            ("smokestacks", None, 2, "×4", "×2"),
            ("rivet_gun", None, 2, "×2.5", "×2")):
        s, n = find(data, nid)
        e = n["effects"][0]
        was = e["value"]
        e["value"] = new
        assert old_txt in n["text"], (nid, n["text"])
        n["text"] = n["text"].replace(old_txt, new_txt, 1)
        log(s, nid, f"{e['stat']} {e['op']} ×{was:g} → ×{new:g} (scope {e.get('scope', 'all')})",
            "the lines column ran ×5.5 over 10 6.1 through ring 9 once the writers' feature bonuses "
            "were counted: Works spent 10's ×22 a ring while Grip, Tide and Blast took 04 7.2's trade, "
            "whose donor is Works; Works rings 7-9 now ×6.1 / ×12.0 / ×16.3, the tree ends at 94% of its budget")

    # --- 6. keystone conflicts both ways (04 5: the rebuild screen warns from either side)
    for nid, add in (("lone_wolf", ["bunker_mentality", "archivist"]), ("fever_pitch", ["archivist"])):
        s, n = find(data, nid)
        n["conflicts"] = sorted(set(n.get("conflicts", [])) | set(add))
        log(s, nid, f"conflicts + {', '.join(add)}", "conflicts run both ways, so the rebuild screen warns from either keystone (04 5)")


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    data = load_backup()
    apply(data)
    write(data)
    for c in CHANGES:
        print(" | ".join(str(x) for x in c))
    print(f"{len(CHANGES)} changes")

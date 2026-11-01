"""Blast Map catalog checker (04-blast-map.md 9.3, 10-balance.md 6, resolutions 1.5, 3.8, 3.12, 3.13).

Loads the eight sector files plan/04b-<sector>.json plus an implicit `ground_zero` root and checks
structure, mix, edges, costs, waves, vocabulary, gates, anchors, ceilings, the 10% rule, the
power budget (per ring, per column, per sector, cumulative, +10%) and the steady tap coefficient.

Run:  python -I treecheck.py            (exit 1 on any ERROR)
      python -I treecheck.py --quiet    (summary only)

Importable: catalog.py uses load(), run_checks() and budget().
"""
import itertools
import json
import math
import os
import re
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
PLAN = os.path.normpath(os.path.join(HERE, "..", "plan"))

SECTORS = ["grip", "crew", "works", "tide", "bunker", "blast", "logbook", "scrapyard"]
RING_SIZES = [2, 3, 4, 5, 5, 6, 6, 7, 7]
RING_GATE = {1: 1, 2: 1, 3: 3, 4: 5, 5: 10, 6: 20, 7: 30, 8: 40, 9: 50}  # 03 12
PHASES = ["R2", "R3", "R4", "R5", "R6", "R7"]
PH = {p: i for i, p in enumerate(PHASES)}
TYPES = ["small", "notable", "keystone", "unlock", "automation", "completion"]
TYPE_LETTER = {"small": "S", "notable": "N", "keystone": "K", "unlock": "U", "automation": "A",
               "completion": "C"}
TYPE_FACTOR = {"small": 1, "notable": 2, "keystone": 3, "unlock": 1, "automation": 1, "completion": 1}

# 04 2.2 (exact, per sector; ground_zero is the 36th unlock)
QUOTAS = {
    "grip":      {"small": 24, "notable": 10, "keystone": 2, "unlock": 3, "automation": 4, "completion": 2},
    "crew":      {"small": 22, "notable": 8, "keystone": 2, "unlock": 3, "automation": 8, "completion": 2},
    "works":     {"small": 24, "notable": 9, "keystone": 2, "unlock": 4, "automation": 4, "completion": 2},
    "tide":      {"small": 22, "notable": 9, "keystone": 2, "unlock": 7, "automation": 3, "completion": 2},
    "bunker":    {"small": 24, "notable": 9, "keystone": 2, "unlock": 4, "automation": 4, "completion": 2},
    "blast":     {"small": 24, "notable": 9, "keystone": 2, "unlock": 4, "automation": 4, "completion": 2},
    "logbook":   {"small": 24, "notable": 8, "keystone": 2, "unlock": 6, "automation": 3, "completion": 2},
    "scrapyard": {"small": 23, "notable": 8, "keystone": 2, "unlock": 4, "automation": 6, "completion": 2},
}
TOTALS = {"small": 187, "notable": 70, "keystone": 16, "unlock": 36, "automation": 36, "completion": 16}

# 04 section 6 slot tables (binding in shape)
SLOT_TABLE = {
    "grip":      ["NS", "NSA", "SNNS", "ASCSN", "SNKNS", "SASSUS", "NSSSSU", "SSNKASS", "SNSCSUS"],
    "crew":      ["AS", "NSN", "SANS", "USCSA", "SAKNS", "SAASNS", "NSSSSU", "SSNKASS", "SUSCNAS"],
    "works":     ["US", "NSU", "SNUS", "ASCSN", "SAKNS", "SNSSAS", "ASSSSN", "SSNKNSS", "SNSCSUS"],
    "tide":      ["NS", "USN", "SNNS", "USCSA", "SNKAS", "SUNSNS", "USSSSU", "SSNKASS", "SUSCNUS"],
    "bunker":    ["US", "NSN", "SNNS", "ASCSN", "SNKAS", "SNSSUS", "ASSSSU", "SSNKASS", "SNSCSUS"],
    "blast":     ["NS", "ASN", "SNUS", "ASCSN", "SNKNS", "SASSUS", "NSSSSU", "SSNKASS", "SUSCSNS"],
    "logbook":   ["NS", "USN", "SNNS", "USCSN", "SNKAS", "SNSSUS", "ASSSSU", "SSNKASS", "SUSCSUS"],
    "scrapyard": ["NS", "ASN", "SNAS", "USCSA", "SNKAS", "SNNSUS", "ASSSSN", "SSNKASS", "SUSCSUS"],
}

# 04 1.3 default wiring: parents (previous-ring slots) by ring and slot
def default_parents(ring, slot, size_prev):
    if ring == 1:
        return None
    if ring == 2:
        return {1: [1], 2: [1, 2], 3: [2]}[slot]
    if ring == 3:
        return {1: [1], 2: [1, 2], 3: [2, 3], 4: [3]}[slot]
    if ring == 4:
        return {1: [1], 2: [1, 2], 3: "all", 4: [3, 4], 5: [4]}[slot]
    if ring in (5, 7):
        return [slot]
    if ring == 6:
        return {1: [1], 2: [1, 2], 3: [2, 3], 4: [3, 4], 5: [4, 5], 6: [5]}[slot]
    if ring == 8:
        return {1: [1], 2: [1, 2], 3: [2, 3], 4: [3, 4], 5: [4, 5], 6: [5, 6], 7: [6]}[slot]
    if ring == 9:
        return "all" if slot == 4 else [slot]
    raise ValueError(ring)

# 04 3.1 price ladder: allowed prices per ring and type factor
LADDER_X1 = {1: [1, 2], 2: [4, 5, 7, 9], 3: [25, 33, 44, 55, 66], 4: [222, 333, 444, 555],
             5: [2222, 3333, 4444, 5555], 6: [22200, 33300, 44400, 55500],
             7: [222e3, 333e3, 444e3, 555e3], 8: [2.22e6, 3.33e6, 4.44e6, 5.55e6],
             9: [22.2e6, 33.3e6, 44.4e6, 55.5e6]}
LADDER_X2 = {1: [2, 3, 4], 2: [9, 11, 15, 19], 3: [55, 66, 77, 99, 111, 150],
             4: [444, 555, 777, 999, 1111], 5: [4444, 5555, 7777, 9999, 11100],
             6: [44400, 55500, 77700, 99900, 111000], 7: [444e3, 555e3, 777e3, 999e3, 1.11e6],
             8: [4.44e6, 5.55e6, 7.77e6, 9.99e6, 11.1e6], 9: [44.4e6, 55.5e6, 77.7e6, 99.9e6, 111e6]}
BAND_X1 = {1: (1, 2), 2: (4, 10), 3: (25, 75), 4: (200, 600), 5: (2e3, 6e3), 6: (2e4, 6e4),
           7: (2e5, 6e5), 8: (2e6, 6e6), 9: (2e7, 6e7)}
KEYSTONE_PRICE = {5: 7777, 8: 7.77e6}
COMPLETION_PRICE = {4: 555, 9: 55.5e6}

# The run (02-the-run.md 2.2, 5, 6.1, 8.1)
LINES = ["beachcomber", "campfire", "garden", "loom", "workbench", "kiln", "furnace", "tannery",
         "press", "dock", "generator", "radio_mast", "shipbreaker", "reactor"]
LINE_NUM = {l: i + 1 for i, l in enumerate(LINES)}
ERA_LINES = {"twig": [1, 2, 3], "wood": [4, 5, 6], "stone": [7, 8, 9], "metal": [10, 11, 12],
             "hqm": [13, 14]}
ERA_OF = {n: e for e, ls in ERA_LINES.items() for n in ls}
ERA_ORDER = ["twig", "wood", "stone", "metal", "hqm"]
TARGETS = ["tree", "stone", "ore", "sulfur", "wreck"]
TOOLS = ["rock", "stone_tools", "iron_tools", "salvaged_tools", "power_tools"]
ISLAND = ["sorting_tables", "handcarts", "rope_lift", "rail_spur", "diesel_crane", "tide_mill",
          "cable_car", "steam_hammer"]
MK = [f"{l}_mk{k}" for l in LINES for k in (2, 3)]
UPGRADE_KIND = {**{t: "grip" for t in TOOLS}, **{i: "island" for i in ISLAND},
                **{m: "line_mk" for m in MK}}
FLOTSAM = ["crate", "fuel_drum", "adrenaline", "drowned_drone", "sealed_locker", "bottle",
           "life_raft", "lost_cargo"]
FLOTSAM_PHASE = {"crate": "R2", "fuel_drum": "R2", "adrenaline": "R2", "drowned_drone": "R4",
                 "bottle": "R4", "sealed_locker": "R5", "life_raft": "R3", "lost_cargo": "R7"}
FLOTSAM_OWNER = {"life_raft": "life_raft", "lost_cargo": "lost_cargo"}  # node that adds the kind
SKILLS = ["rush", "grit", "flare"]
LEGACY_IDS = ["steady_hands", "old_friend", "packed_crate", "deep_cellars", "quick_fingers",
              "hot_coals", "war_stories", "old_maps"]
RESERVED_IDS = set(SECTORS) | set(LINES) | set(ERA_ORDER) | set(TARGETS) | set(TOOLS) | set(ISLAND) | set(MK)

# 09 5.1 + 04 4.2 vocabulary: stat -> allowed ops
VOCAB = {
    "output": {"add", "inc", "more"}, "speed": {"more"},
    "line_cost": {"more"}, "hand_cost": {"more"}, "upgrade_cost": {"more"}, "era_cost": {"more"},
    "milestone_x2": {"set"}, "roster_x2": {"set"}, "mk_mult": {"set"},
    "tap_flat": {"more"}, "tap": {"inc", "more"}, "tap_share": {"add"},
    "hustle_max": {"add", "set"}, "hustle_hold": {"add"}, "hustle_drain": {"more"},
    "hustle_gain": {"add"}, "crit_chance": {"add", "set"}, "crit_mult": {"add", "set"},
    "fell_taps": {"more"}, "fell_bonus": {"add"},
    "afterglow": {"set"}, "afterglow_half": {"add"}, "afterglow_hold": {"set"},
    "flotsam_rate": {"more"}, "flotsam_float": {"add"}, "flotsam_effect": {"inc"},
    "flotsam_weight": {"more", "set"}, "rally_mult": {"add"},
    "night_shift": {"add", "more"}, "offline": {"more"},
    "glass_gain": {"inc", "more"}, "glow_k": {"add", "set"},
    "morale_per": {"add"}, "morale": {"more"}, "rank_mult": {"set"}, "magnet_hours": {"set"},
    "rush_mult": {"add", "more", "set"}, "rush_seconds": {"add", "more", "set"},
    "rush_cooldown": {"add", "more", "set"}, "grit_step": {"add", "more", "set"},
    "grit_cap": {"add", "more", "set"}, "grit_cooldown": {"add", "more", "set"},
    "flare_cooldown": {"add", "more", "set"},
    "start_owned": {"set"}, "start_era": {"set"}, "start_upgrade": {"unlock"},
    "keep_hand": {"unlock"}, "foreman_lines": {"set"}, "hand_cap": {"set"},
}
LOWER_IS_BETTER = {"line_cost", "hand_cost", "upgrade_cost", "era_cost", "hustle_drain",
                   "fell_taps", "magnet_hours", "rush_cooldown", "grit_cooldown", "flare_cooldown"}
KEYSTONE_ONLY = {("afterglow", "set"), ("hustle_max", "set"), ("night_shift", "more"),
                 ("hand_cap", "set")}
WHENS = {"online", "offline", "afterglow", "rain", "night", "hustle_full"}
PERS = {"owned", "hands", "nukes", "entries"} | {f"sector:{s}" for s in SECTORS}

# Phase a system ships in (09 8.1, 04 1.4, 11-roadmap): a node must not be in data before it
STAT_PHASE = {"morale_per": "R4", "morale": "R4", "rank_mult": "R5", "magnet_hours": "R5",
              "foreman_lines": "R5", "rush_mult": "R5", "rush_seconds": "R5", "rush_cooldown": "R5",
              "grit_step": "R5", "grit_cap": "R5", "grit_cooldown": "R5", "flare_cooldown": "R5"}
FEATURE_PHASE = {"logbook_hints": "R4", "field_guide": "R4", "bottle_reader": "R4",
                 "hint_lamp": "R4", "treasure_map": "R4", "tall_tales": "R4",
                 "pocket_slot_2": "R5", "pocket_slot_3": "R5", "sentimental": "R5",
                 "junk_drawer": "R5", "golden_hook": "R5", "hair_trigger": "R5",
                 "wake_up_call": "R5", "flare_gun": "R5", "auto_flare": "R5",
                 "foreman_unmanned": "R5", "dead_hand": "R5", "double_dare": "R7",
                 "dare_ledger": "R7"}
# Agenda count of the system a node touches (04 1.4, 9.3 check 15)
FEATURE_GATE = {"hair_trigger": 4, "wake_up_call": 8, "flare_gun": 15, "auto_flare": 15,
                "double_dare": 5, "dare_ledger": 5, "foreman_unmanned": 7, "dead_hand": 25}
STAT_GATE = {"rush_mult": 4, "rush_seconds": 4, "rush_cooldown": 4, "grit_step": 8, "grit_cap": 8,
             "grit_cooldown": 8, "flare_cooldown": 15, "foreman_lines": 7}

# 04 1.4 build table: what each later build adds
R4_IDS = None  # all Logbook rings 5-6 plus old_maps and war_stories (computed)
R5_IDS = {"deep_pockets", "quick_winch", "greased_cable", "gold_braid", "sewn_lining",
          "hair_trigger", "foremans_mate", "wake_up_call", "flare_gun", "dead_hand"}
BUILD_TOTALS = {"R2": 73, "R3": 178, "R4": 191, "R5": 201, "R7": 361}

# Anchors: canon 6.7 with resolution 3.13's re-tuned values
ANCHORS = {
    "steady_hands": dict(sector="grip", ring=1, type="small", cost=1,
                         eff=[("tap", "inc", 0.5)]),
    "old_friend": dict(sector="crew", ring=1, type="automation", cost=2,
                       eff=[("keep_hand", "unlock", None, "beachcomber")]),
    "packed_crate": dict(sector="works", ring=1, type="unlock", cost=2,
                         eff=[("start_owned", "set", 10, "beachcomber"),
                              ("start_owned", "set", 5, "campfire")]),
    "deep_cellars": dict(sector="bunker", ring=1, type="small", cost=1,
                         eff=[("night_shift", "add", 4)]),
    "bigger_payload": dict(sector="blast", ring=1, type="small", cost=2,
                           eff=[("glass_gain", "inc", 0.1)]),
    "lucky_swing": dict(sector="grip", ring=3, type="notable", cost=77,
                        eff=[("crit_chance", "add", 0.05), ("crit_mult", "set", 10)]),
    "old_crew_1": dict(sector="crew", ring=3, type="automation", cost=33,
                       eff=[("keep_hand", "unlock", None, "twig"),
                            ("keep_hand", "unlock", None, "wood")]),
    "glow_lamp": dict(sector="blast", ring=3, type="notable", cost=77,
                      eff=[("glow_k", "add", 0.02)]),           # 0.25 -> 0.27 (3.13)
    "union_rules": dict(sector="works", ring=4, type="notable", cost=777,
                        eff=[("milestone_x2", "set", 2.2)]),    # x2 -> x2.2 (3.13)
    "wipe_day_rush": dict(sector="grip", ring=5, slot=3, type="keystone", cost=7777,
                          eff=[("afterglow", "set", 5), ("afterglow_hold", "set", 3600),
                               ("night_shift", "more", 0.5)]),
    "bunker_mentality": dict(sector="bunker", ring=5, slot=3, type="keystone", cost=7777,
                             eff=[("offline", "more", 1.5), ("flotsam_rate", "more", 0)]),
    "dead_hand": dict(sector="blast", ring=6, slot=2, type="automation", cost=22200,
                      eff=[("feature:dead_hand", "unlock", None)], gate=25),  # 22.2k (3.13)
    "lone_wolf": dict(sector="crew", ring=8, slot=4, type="keystone", cost=7.77e6,
                      eff=[("tap", "more", 50), ("hand_cap", "set", 0)]),     # x50 (3.13)
}

# 04 section 6 fixed nodes: (sector, ring.slot) -> (id, type); "?" = writer's id
FIXED = {
    "grip": {"1.1": ("second_wind", "notable"), "1.2": ("steady_hands", "small"),
             "2.1": ("whetstone", "notable"), "2.2": ("quick_fingers", "small"),
             "2.3": ("keep_swinging", "automation"), "3.2": ("lucky_swing", "notable"),
             "3.3": ("heavy_haft", "notable"), "4.1": ("tool_rack", "automation"),
             "4.3": ("iron_palms", "completion"), "4.5": ("afterburn", "notable"),
             "5.2": ("work_song", "notable"), "5.3": ("wipe_day_rush", "keystone"),
             "6.2": ("hair_trigger", "automation"), "6.5": ("golden_chip", "unlock"),
             "7.6": ("woodpile", "unlock"), "8.4": ("fever_pitch", "keystone"),
             "8.5": ("apprentice", "automation"), "9.4": ("iron_grip", "completion"),
             "9.6": ("trophy_rack", "unlock")},
    "crew": {"1.1": ("old_friend", "automation"), "2.1": ("hiring_board", "notable"),
             "2.3": ("pep_talk", "notable"), "3.2": ("old_crew_1", "automation"),
             "3.3": ("fair_wages", "notable"), "4.1": ("pay_day", "unlock"),
             "4.3": ("full_crew", "completion"), "4.5": ("roll_call", "automation"),
             "5.2": ("old_crew_2", "automation"), "5.3": ("skeleton_crew", "keystone"),
             "5.4": ("bunkhouse", "notable"), "6.2": ("foremans_mate", "automation"),
             "6.3": ("old_crew_3", "automation"), "7.6": ("crew_photo", "unlock"),
             "8.4": ("lone_wolf", "keystone"), "8.5": ("standing_crew", "automation"),
             "9.2": ("relief_crew", "unlock"), "9.4": ("crew_legends", "completion"),
             "9.6": ("lifers", "automation")},
    "works": {"1.1": ("packed_crate", "unlock"), "1.2": ("hot_coals", "small"),
              "2.1": ("first_light", "notable"), "2.3": ("bulk_buttons", "unlock"),
              "3.2": ("conveyor", "notable"), "3.3": ("prefab_walls", "unlock"),
              "4.1": ("big_kit", "automation"), "4.3": ("shop_floor", "completion"),
              "4.5": ("union_rules", "notable"), "5.2": ("stone_foundations", "automation"),
              "5.3": ("mass_production", "keystone"), "6.2": ("full_roster", "notable"),
              "6.5": ("standing_orders", "automation"), "7.1": ("tin_roofs", "automation"),
              "8.4": ("monoculture", "keystone"), "9.4": ("the_works", "completion"),
              "9.6": ("line_mk_iv", "unlock")},
    "tide": {"1.1": ("lucky_tide", "notable"), "2.1": ("lookout_post", "unlock"),
             "2.3": ("rally_cry", "notable"), "3.2": ("rainmaker", "notable"),
             "4.1": ("life_raft", "unlock"), "4.3": ("high_water", "completion"),
             "4.5": ("drag_line", "automation"), "5.3": ("scavengers_eye", "keystone"),
             "5.4": ("beachcombers_net", "automation"), "6.2": ("flare_gun", "unlock"),
             "7.1": ("rogue_wave", "unlock"), "7.6": ("lost_cargo", "unlock"),
             "8.4": ("wreckers_moon", "keystone"), "8.5": ("auto_flare", "automation"),
             "9.2": ("tide_tables", "unlock"), "9.4": ("king_tide", "completion"),
             "9.6": ("weather_buoy", "unlock")},
    "bunker": {"1.1": ("hot_breakfast", "unlock"), "1.2": ("deep_cellars", "small"),
               "2.1": ("night_lamps", "notable"), "2.3": ("insulated_walls", "notable"),
               "4.1": ("night_porter", "automation"), "4.3": ("snug", "completion"),
               "5.3": ("bunker_mentality", "keystone"), "5.4": ("wake_up_call", "automation"),
               "6.2": ("cold_storage", "notable"), "6.5": ("lights_out", "unlock"),
               "7.1": ("snooze", "automation"), "7.6": ("night_crew", "unlock"),
               "8.3": ("bunk_beds", "notable"), "8.4": ("graveyard_shift", "keystone"),
               "8.5": ("shift_report", "automation"), "9.4": ("deep_sleep", "completion"),
               "9.6": ("bunker_door", "unlock")},
    "blast": {"1.1": ("souvenir_jar", "notable"), "1.2": ("bigger_payload", "small"),
              "2.1": ("forecast", "automation"), "3.2": ("glow_lamp", "notable"),
              "3.3": ("flight_school", "unlock"), "4.1": ("quick_rebuild", "automation"),
              "4.3": ("glass_garden", "completion"), "4.5": ("crater_lake", "notable"),
              "5.3": ("hot_core", "keystone"), "6.2": ("dead_hand", "automation"),
              "6.5": ("postcard_album", "unlock"), "7.6": ("double_barrel", "unlock"),
              "8.4": ("chain_reaction", "keystone"), "8.5": ("kettle_watch", "automation"),
              "9.2": ("nose_art", "unlock"), "9.4": ("second_sun", "completion"),
              "9.6": ("sunburst", "notable")},
    "logbook": {"1.1": ("tally_wall", "notable"), "2.1": ("personal_best", "unlock"),
                "2.3": ("weather_log", "notable"), "3.2": ("almanac", "notable"),
                "4.1": ("old_maps", "unlock"), "4.2": ("war_stories", "small"),
                "4.3": ("well_read", "completion"), "4.5": ("long_memory", "notable"),
                "5.3": ("tall_tales", "keystone"), "5.4": ("field_guide", "automation"),
                "6.2": ("dog_eared", "notable"), "6.5": ("bottle_reader", "unlock"),
                "7.1": ("hint_lamp", "automation"), "7.6": ("double_dare", "unlock"),
                "8.4": ("archivist", "keystone"), "8.5": ("dare_ledger", "automation"),
                "9.2": ("treasure_map", "unlock"), "9.4": ("full_log", "completion"),
                "9.6": ("postcard_pen", "unlock")},
    "scrapyard": {"1.1": ("scrap_heap", "notable"), "2.1": ("tool_bag", "automation"),
                  "2.3": ("bargain_bin", "notable"), "3.2": ("patched_sail", "notable"),
                  "3.3": ("iron_bag", "automation"), "4.1": ("deep_pockets", "unlock"),
                  "4.3": ("sorted_yard", "completion"), "4.5": ("salvage_cart", "automation"),
                  "5.1": ("quick_winch", "small"), "5.2": ("spare_parts", "notable"),
                  "5.3": ("hoarder", "keystone"), "5.4": ("first_shelf", "automation"),
                  "6.1": ("greased_cable", "small"), "6.3": ("?", "notable"),
                  "6.5": ("sewn_lining", "unlock"), "7.1": ("mk_kit", "automation"),
                  "8.3": ("brass_polish", "notable"), "8.4": ("sentimental", "keystone"),
                  "8.5": ("power_kit", "automation"), "9.2": ("junk_drawer", "unlock"),
                  "9.4": ("yard_boss", "completion"), "9.6": ("golden_hook", "unlock")},
}

GROUND_ZERO = {
    "id": "ground_zero", "sector": None, "ring": 0, "slot": 0, "type": "unlock",
    "name": "Ground Zero",
    "text": "Lit by the first nuke: the map opens and Glow works from Wipe Day #1.",
    "effects": [{"stat": "feature:glow", "op": "unlock", "value": 1}],
    "cost": 0, "requires": [], "wave": "R2", "anchor": True, "feature": "feature:glow",
    "scene": "the crater and its sign",
}

# ---------------------------------------------------------------------------------------------
# Power budget (10-balance.md 6.1), per ring 1..9. "add" columns are per-ring increments.
BUDGET = {
    "output":         ("mul", [1.3, 1.54, 1.76, 2.0, 10, 1000, 1000, 1000, 1000]),
    "tap":            ("mul", [1.5, 1, 1, 1, 1, 1, 1, 1, 1]),
    "tap_share":      ("mul", [1, 1.10, 1, 1.09, 1, 1, 1, 1, 1]),
    "hustle_max":     ("add", [0, 0.25, 0, 0, 0, 0, 0, 0, 0]),
    "crit":           ("mul", [1, 1, 1.45, 1, 1, 1, 1, 1, 1]),
    "line_cost":      ("cost", [0.95, 0.9, 0.9, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85]),
    "hand_cost":      ("cost", [0.95, 0.9, 0.9, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85]),
    "upgrade_cost:grip":    ("cost", [0.85, 0.85, 0.85, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]),
    "upgrade_cost:line_mk": ("cost", [0.85, 0.85, 0.85, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]),
    "upgrade_cost:island":  ("cost", [0.85, 0.85, 0.85, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]),
    "era_cost":       ("cost", [1, 1, 1, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]),
    "flotsam_rate":   ("mul", [1.05, 1, 1, 1, 1, 1, 1, 1, 1]),
    "flotsam_effect": ("mul", [1, 1.05, 1, 1, 1, 1, 1, 1, 1]),
    # 10 6.1's text: "Night Shift hours follow 04's window plan" (+4 h in each of rings 1-8,
    # 04 4.2, 6.7, 7.1, 10.4). Its table row (+4, -, +4, -, +4, +8, +4, +8, -) is shown as
    # NIGHT_SHIFT_10_ROW and reported, not enforced (see the catalog's notes).
    "night_shift":    ("add", [4, 4, 4, 4, 4, 4, 4, 4, 0]),
    "offline":        ("mul", [1, 1, 1, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1]),
    "glass_gain":     ("mul", [1.10, 1.05, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10, 1.10]),
    "glow_k":         ("add", [0, 0.01, 0.02, 0.02, 0.03, 0.03, 0.04, 0.04, 0.05]),
    "morale_per":     ("add", [0, 0, 0, 0.005, 0.005, 0.005, 0.005, 0.005, 0.005]),
}
NIGHT_SHIFT_10_ROW = [4, 0, 4, 0, 4, 8, 4, 8, 0]
TOL = 1.10  # +10% (10-balance 6.2.1, 7.4)
EPS = 1e-9

# Shared `output` column split: 04 7.2 and 10 6.3. A sector's share is the larger of the two
# (10 6.3 allows trades inside a ring if the ring's product holds; the ring total is checked
# against 10 6.1 separately, so a trade that overflows the ring still fails).
SHARE_04 = {
    "works": [1.1, 1.1, 1.2, 1.65, 2.6, 6.5, 6.5, 6.5, 6.5],
    "crew": [1, 1.05, 1.1, 1, 1.5, 4.4, 4.4, 4.4, 4.4],
    "logbook": [1.2, 1.1, 1.1, 1.1, 1.3, 2.5, 2.5, 2.5, 2.5],
    "bunker": [1, 1.1, 1.1, 1.1, 1.1, 1.5, 1.5, 1.5, 1.5],
    "grip": [1, 1, 1, 1, 1.15, 1.5, 1.5, 1.5, 1.5],
    "tide": [1, 1, 1, 1, 1.2, 1.5, 1.5, 1.5, 1.5],
    "blast": [1, 1, 1, 1, 1.1, 1.4, 1.4, 1.4, 1.4],
    "scrapyard": [1, 1, 1, 1, 1.2, 3, 3, 3, 3],
}
SHARE_10 = {
    "works": [1.15, 1.2, 1.5, 1.5, 2.8, 22, 22, 22, 22],
    "crew": [1, 1.1, 1, 1.1, 1.6, 4, 4, 4, 4],
    "logbook": [1.13, 1.17, 1.17, 1.1, 1.4, 2.8, 2.8, 2.8, 2.8],
    "bunker": [1, 1, 1, 1.1, 1.26, 2, 2, 2, 2],
    "scrapyard": [1, 1, 1, 1, 1.26, 2, 2, 2, 2],
    "grip": [1] * 9, "tide": [1] * 9, "blast": [1] * 9,
}
SHARE = {s: [max(a, b) for a, b in zip(SHARE_04[s], SHARE_10[s])] for s in SECTORS}

# Typical state (10-balance 6.2): rings 1-3 are week 1, rings 4-9 mid-game (days 9-180).
# Line shares of line income. Mid-game: line 14 0.8 (0.82 here so that Armored = 0.97 with
# line 13 at 0.15), line 13 0.15, line 12 0.03, lines 1-11 0. Week 1: Radio Mast 0.58 and Sheet
# Metal 0.83 are 10's; the other week-1 lines are this checker's estimates (10 should publish).
LINE_SHARE = {
    "w1": {12: 0.58, 11: 0.18, 10: 0.07, 9: 0.11, 8: 0.035, 7: 0.01, 6: 0.008, 5: 0.003,
           4: 0.001, 3: 0.002, 2: 0.0007, 1: 0.0003},
    "mid": {14: 0.82, 13: 0.15, 12: 0.03},
}
COND_W = {"rain": 0.2, "afterglow": 0.02, "online": 0.1, "offline": 1.0}


def state_of(ring):
    return "w1" if ring <= 3 else "mid"


def night_w(ring):
    return 0.1 if ring <= 3 else 0.4


def cond_w(when, ring):
    if when is None:
        return 1.0
    if when == "night":
        return night_w(ring)
    if when in COND_W:
        return COND_W[when]
    if when.startswith("dare:"):
        return 0.0
    if when == "hustle_full":
        return None
    return 0.0  # unregistered condition: the vocabulary check reports it


def scope_w(scope, ring):
    st = state_of(ring)
    if scope in (None, "all"):
        return 1.0
    if scope in LINE_NUM:
        return LINE_SHARE[st].get(LINE_NUM[scope], 0.0)
    if scope in ERA_LINES:
        return sum(LINE_SHARE[st].get(i, 0.0) for i in ERA_LINES[scope])
    raise KeyError(scope)


def lines_of(scope):
    if scope in (None, "all"):
        return list(range(1, 15))
    if scope in LINE_NUM:
        return [LINE_NUM[scope]]
    if scope in ERA_LINES:
        return ERA_LINES[scope]
    raise KeyError(scope)


# ---------------------------------------------------------------------------------------------
def load(plan=PLAN):
    nodes = [dict(GROUND_ZERO)]
    for s in SECTORS:
        with open(os.path.join(plan, f"04b-{s}.json"), encoding="utf-8") as f:
            data = json.load(f)
        for n in data:
            nodes.append(n)
    return nodes


def effects_of(n, budget=False):
    """Effects as data; with budget=True also the node's `counts_as` (a feature's power at its cap)."""
    effs = list(n.get("effects", []))
    if budget:
        effs += list(n.get("counts_as", []))
    return effs


def is_feature(e):
    return e["stat"].startswith("feature:")


def eff_value(e):
    """A per-effect's value at its max (10 6.2.2: per effects count at their max)."""
    if "per" in e:
        return e["max"]
    return e["value"]


def phase_of_data(n):
    """The build in which the node is in data (shown for rings 1-6; joins the file for 7-9)."""
    if n["ring"] >= 7:
        return n.get("data_from", "R3")
    return n["wave"]


def required_phase(n):
    req = "R2"
    for e in effects_of(n, budget=True):
        st = e["stat"]
        p = None
        if st in STAT_PHASE:
            p = STAT_PHASE[st]
        if is_feature(e):
            p = FEATURE_PHASE.get(st.split(":", 1)[1])
        if e.get("per") == "entries":
            p = "R4"
        if e.get("when", "").startswith("dare:"):
            p = "R7"
        if st == "flotsam_weight" and e.get("scope") in FLOTSAM_PHASE:
            kp = FLOTSAM_PHASE[e["scope"]]
            if not (e["op"] == "more" and e["value"] == 0):  # zeroing an unshipped kind is inert
                p = kp
        if p and PH[p] > PH[req]:
            req = p
    return req


def required_gate(n):
    g = 0
    for e in effects_of(n):
        st = e["stat"]
        if is_feature(e):
            g = max(g, FEATURE_GATE.get(st.split(":", 1)[1], 0))
        g = max(g, STAT_GATE.get(st, 0))
        if e.get("when", "").startswith("dare:"):
            g = max(g, 5)
    return g


# ---------------------------------------------------------------------------------------------
class Report:
    def __init__(self):
        self.items = []  # (level, check, message)

    def err(self, check, msg):
        self.items.append(("ERROR", check, msg))

    def warn(self, check, msg):
        self.items.append(("WARN", check, msg))

    def note(self, check, msg):
        self.items.append(("NOTE", check, msg))

    def errors(self):
        return [i for i in self.items if i[0] == "ERROR"]


def run_checks(nodes):
    R = Report()
    byid = {}
    for n in nodes:
        if n["id"] in byid:
            R.err("ids", f"duplicate id {n['id']}")
        byid[n["id"]] = n
    sec_nodes = [n for n in nodes if n["id"] != "ground_zero"]

    # 1. counts, ring sizes, slots
    if len(nodes) != 361:
        R.err("count", f"{len(nodes)} nodes, want 361")
    for s in SECTORS:
        ns = [n for n in sec_nodes if n["sector"] == s]
        if len(ns) != 45:
            R.err("count", f"{s}: {len(ns)} nodes, want 45")
        for r in range(1, 10):
            rs = sorted(n["slot"] for n in ns if n["ring"] == r)
            if rs != list(range(1, RING_SIZES[r - 1] + 1)):
                R.err("rings", f"{s} ring {r}: slots {rs}, want 1..{RING_SIZES[r - 1]}")
    for n in sec_nodes:
        if n.get("sector") not in SECTORS:
            R.err("rings", f"{n['id']}: unknown sector {n.get('sector')}")

    # 2. ids, names, texts
    idre = re.compile(r"^[a-z][a-z0-9]*(_[a-z0-9]+)*$")
    for n in nodes:
        i = n["id"]
        if not (2 <= len(i) <= 32 and idre.match(i)):
            R.err("ids", f"{i}: not snake_case 2-32")
        if i in RESERVED_IDS:
            R.err("ids", f"{i}: equals a sector, line, era, target or shelf upgrade id")
        if i in FLOTSAM and FLOTSAM_OWNER.get(i) != i:
            R.err("ids", f"{i}: equals a flotsam kind id")
        if len(n.get("name", "")) > 24:
            R.err("names", f"{i}: name '{n['name']}' over 24 characters")
        if n["type"] != "small" and len(n.get("text", "")) > 80:
            R.err("names", f"{i}: blurb over 80 characters ({len(n['text'])})")
        if n["type"] not in TYPES:
            R.err("types", f"{i}: unknown type {n['type']}")
    for lid in LEGACY_IDS:
        if lid not in byid:
            R.err("ids", f"legacy perk id {lid} missing")

    # 3. type quotas and slot template
    tc = Counter(n["type"] for n in nodes)
    for t, want in TOTALS.items():
        if tc[t] != want:
            R.err("quota", f"total {t}: {tc[t]}, want {want}")
    for s in SECTORS:
        c = Counter(n["type"] for n in sec_nodes if n["sector"] == s)
        for t, want in QUOTAS[s].items():
            if c[t] != want:
                R.err("quota", f"{s} {t}: {c[t]}, want {want}")
        for n in sec_nodes:
            if n["sector"] != s:
                continue
            want = SLOT_TABLE[s][n["ring"] - 1][n["slot"] - 1]
            got = TYPE_LETTER[n["type"]]
            if got != want:
                lvl = R.err if (want != "S" and got == "S") or want in "KC" or got in "KC" else R.warn
                lvl("template", f"{s} {n['ring']}.{n['slot']} {n['id']}: {got}, slot table says {want}")
            fx = FIXED[s].get(f"{n['ring']}.{n['slot']}")
            if fx and fx[0] != "?" and fx[0] != n["id"]:
                R.warn("fixed", f"{s} {n['ring']}.{n['slot']}: id {n['id']}, 04 fixes {fx[0]}")
            if fx and fx[1] != n["type"]:
                R.err("fixed", f"{s} {n['ring']}.{n['slot']}: type {n['type']}, 04 fixes {fx[1]}")
    for n in sec_nodes:
        if n["type"] == "keystone" and (n["ring"], n["slot"]) not in ((5, 3), (8, 4)):
            R.err("keystones", f"{n['id']}: keystone at {n['ring']}.{n['slot']}")
        if n["type"] == "completion" and (n["ring"], n["slot"]) not in ((4, 3), (9, 4)):
            R.err("completions", f"{n['id']}: completion at {n['ring']}.{n['slot']}")

    # 4. edges: exist, same sector, previous ring, default wiring, completions AND
    slot_of = {(n["sector"], n["ring"], n["slot"]): n for n in sec_nodes}
    for n in sec_nodes:
        req = n.get("requires", [])
        if len(set(req)) != len(req):
            R.err("edges", f"{n['id']}: duplicate requires")
        for p in req:
            if p not in byid:
                R.err("edges", f"{n['id']}: requires unknown {p}")
                continue
            pn = byid[p]
            if n["ring"] == 1:
                if p != "ground_zero":
                    R.err("edges", f"{n['id']}: ring 1 must require ground_zero")
            else:
                if pn.get("sector") != n["sector"]:
                    R.err("edges", f"{n['id']}: requires {p} in another sector")
                if pn["ring"] != n["ring"] - 1:
                    R.err("edges", f"{n['id']}: requires {p} not in the previous ring")
        if n["ring"] == 1:
            if req != ["ground_zero"]:
                R.err("edges", f"{n['id']}: ring-1 requires {req}")
            continue
        size_prev = RING_SIZES[n["ring"] - 2]
        dp = default_parents(n["ring"], n["slot"], size_prev)
        if dp == "all":
            want = {slot_of[(n["sector"], n["ring"] - 1, k)]["id"] for k in range(1, size_prev + 1)
                    if (n["sector"], n["ring"] - 1, k) in slot_of}
            if set(req) != want:
                R.err("edges", f"{n['id']}: completion must require all of ring {n['ring'] - 1}")
            if n["type"] != "completion":
                R.err("edges", f"{n['id']}: AND slot holds a {n['type']}")
        else:
            want = {slot_of[(n["sector"], n["ring"] - 1, k)]["id"] for k in dp
                    if (n["sector"], n["ring"] - 1, k) in slot_of}
            if not want <= set(req):
                R.err("edges", f"{n['id']}: misses default parents {sorted(want - set(req))}")
            if not 1 <= len(req) <= 3:
                R.err("edges", f"{n['id']}: {len(req)} parents (1-3 allowed)")
            extra = set(req) - want
            if extra:
                R.note("edges", f"{n['id']}: extra links {sorted(extra)}")

    # 5. acyclic (topological order by ring) and reachable
    order = sorted(nodes, key=lambda n: n["ring"])
    seen = {"ground_zero"}
    for n in order[1:]:
        req = n.get("requires", [])
        if n["type"] == "completion":
            ok = all(p in seen for p in req)
        else:
            ok = any(p in seen for p in req)
        if ok:
            seen.add(n["id"])
        else:
            R.err("reach", f"{n['id']}: unreachable from ground_zero")
    # acyclic: every edge goes from ring r-1 to r (checked above), so a cycle is impossible;
    # also verify with a DFS over requires
    color = {}

    def dfs(i, stack):
        color[i] = 1
        for p in byid[i].get("requires", []):
            if p not in byid:
                continue
            if color.get(p) == 1:
                R.err("acyclic", f"cycle through {i} -> {p}")
            elif color.get(p) is None:
                dfs(p, stack)
        color[i] = 2

    for n in nodes:
        if color.get(n["id"]) is None:
            dfs(n["id"], [])

    # 6. never three small nodes in a row; soft rule: consecutive smalls change series
    run = {"ground_zero": 0}
    for n in order[1:]:
        if n["type"] == "small":
            run[n["id"]] = 1 + max(run.get(p, 0) for p in n["requires"])
            for p in n["requires"]:
                pn = byid.get(p)
                if pn and pn["type"] == "small" and pn.get("series") and pn.get("series") == n.get("series"):
                    R.warn("series", f"{p} -> {n['id']}: consecutive smalls of one series")
        else:
            run[n["id"]] = 0
        if run[n["id"]] >= 3:
            R.err("three_smalls", f"{n['id']}: {run[n['id']]} small nodes in a row")

    # 7. costs
    for n in sec_nodes:
        r, t, c = n["ring"], n["type"], n["cost"]
        if n["id"] == "dead_hand":
            if c != 22200:
                R.err("costs", "dead_hand must cost 22,200")
            continue
        if t == "keystone":
            if abs(c - KEYSTONE_PRICE.get(r, -1)) > 0.5:
                R.err("costs", f"{n['id']}: keystone costs {c}")
            continue
        if t == "completion":
            if abs(c - COMPLETION_PRICE.get(r, -1)) > 0.5:
                R.err("costs", f"{n['id']}: completion costs {c}, want {COMPLETION_PRICE.get(r)}")
            continue
        ladder = LADDER_X2[r] if TYPE_FACTOR[t] == 2 else LADDER_X1[r]
        if not any(abs(c - x) < 0.5 for x in ladder):
            R.err("costs", f"{n['id']}: {c} is not on ring {r}'s ladder for a {t} ({ladder})")
        lo, hi = BAND_X1[r]
        f = TYPE_FACTOR[t]
        if not lo * f - 0.5 <= c <= hi * f * 1.0 + 0.5 and not (r == 1 and f == 2 and c <= 4):
            R.err("costs", f"{n['id']}: {c} outside ring {r}'s band x{f}")

    # 8. waves (resolution 3.8, 04 1.4)
    for n in nodes:
        w = n.get("wave")
        if w not in PH:
            R.err("waves", f"{n['id']}: wave {w}")
            continue
        r = n["ring"]
        if r <= 3 and w != "R2":
            R.err("waves", f"{n['id']}: ring {r} must ship in R2")
        if 4 <= r <= 6 and w not in ("R3", "R4", "R5"):
            R.err("waves", f"{n['id']}: ring {r} must ship in R3-R5")
        if r >= 7:
            if w != "R7":
                R.err("waves", f"{n['id']}: ring {r} must ship in R7")
            if "dataFrom" in n:
                R.err("schema", f"{n['id']}: 'dataFrom' (use data_from)")
            df = n.get("data_from")
            if df is None:
                R.warn("waves", f"{n['id']}: wave-3 node without data_from (reads as R3)")
            elif df not in ("R3", "R4", "R5", "R6", "R7"):
                R.err("waves", f"{n['id']}: data_from {df}")
        elif "data_from" in n or "dataFrom" in n:
            R.err("waves", f"{n['id']}: data_from on a ring 1-6 node")
        # systems shipped in its build
        need = required_phase(n)
        have = phase_of_data(n) if r >= 7 else w
        if have in PH and PH[have] < PH[need]:
            R.err("waves", f"{n['id']}: in data from {have} but uses a {need} system")
    cum = {}
    for b in ["R2", "R3", "R4", "R5", "R7"]:
        cum[b] = sum(1 for n in nodes if n.get("wave") in PH and PH[n["wave"]] <= PH[b])
        if cum[b] != BUILD_TOTALS[b]:
            R.err("waves", f"nodes shown by {b}: {cum[b]}, want {BUILD_TOTALS[b]}")
    r4 = {n["id"] for n in sec_nodes if n["wave"] == "R4"}
    want_r4 = {n["id"] for n in sec_nodes if n["sector"] == "logbook" and n["ring"] in (5, 6)} | \
              {"old_maps", "war_stories"}
    if r4 != want_r4:
        R.err("waves", f"R4 set differs from 04 1.4: extra {sorted(r4 - want_r4)}, missing {sorted(want_r4 - r4)}")
    r5 = {n["id"] for n in sec_nodes if n["wave"] == "R5"}
    if r5 != R5_IDS:
        R.err("waves", f"R5 set differs from 04 1.4: extra {sorted(r5 - R5_IDS)}, missing {sorted(R5_IDS - r5)}")
    # no orphans per build: every shown node reachable through nodes shown in that build
    for b in ["R2", "R3", "R4", "R5"]:
        shown = {n["id"] for n in nodes if PH[n["wave"]] <= PH[b]}
        reach = {"ground_zero"}
        for n in order[1:]:
            if n["id"] not in shown:
                continue
            req = n["requires"]
            ok = all(p in reach for p in req) if n["type"] == "completion" else any(p in reach for p in req)
            if ok:
                reach.add(n["id"])
            else:
                R.err("orphans", f"{b}: {n['id']} is shown but unreachable through shown nodes")
    # wave-1 features (04 2.4.3: at most 10)
    w1f = [n["id"] for n in sec_nodes if n["ring"] <= 3 and any(is_feature(e) for e in n["effects"])]
    if len(w1f) > 10:
        R.err("features", f"{len(w1f)} wave-1 feature nodes (at most 10)")

    # 9. vocabulary, ops, per/when/scope, feature placement
    for n in nodes:
        key_only = n["type"] == "keystone"
        feat_nodes = n["type"] in ("unlock", "automation", "keystone")
        if not n.get("effects"):
            R.err("vocab", f"{n['id']}: no effects")
        if n["type"] == "small" and len(n["effects"]) != 1:
            R.err("vocab", f"{n['id']}: a small node has exactly one effect")
        feats = [e["stat"] for e in n["effects"] if is_feature(e)]
        if n.get("feature") and n["feature"] not in feats:
            R.err("features", f"{n['id']}: feature field {n['feature']} without its effect")
        if feats and n.get("feature") != (feats[0] if len(feats) == 1 else feats):
            R.err("features", f"{n['id']}: feature effect {feats} but feature field {n.get('feature')}")
        if (feats or n.get("feature")) and not feat_nodes:
            R.err("features", f"{n['id']}: feature on a {n['type']} node")
        for src, effs in (("effects", n["effects"]), ("counts_as", n.get("counts_as", []))):
            for e in effs:
                st, op = e.get("stat"), e.get("op")
                extra_keys = set(e) - {"stat", "op", "value", "scope", "per", "max", "when"}
                if extra_keys:
                    R.err("vocab", f"{n['id']}: effect keys {sorted(extra_keys)}")
                if st.startswith("feature:"):
                    if src == "counts_as":
                        R.err("vocab", f"{n['id']}: counts_as cannot hold a feature")
                    if op != "unlock":
                        R.err("vocab", f"{n['id']}: {st} op {op}")
                    if not re.match(r"^feature:[a-z][a-z0-9_]*$", st):
                        R.err("vocab", f"{n['id']}: bad feature id {st}")
                    continue
                if st not in VOCAB:
                    R.err("vocab", f"{n['id']}: unknown stat {st}")
                    continue
                if op not in VOCAB[st]:
                    R.err("vocab", f"{n['id']}: op {op} not allowed for {st}")
                if (st, op) in KEYSTONE_ONLY and not key_only:
                    R.err("vocab", f"{n['id']}: {st} {op} is keystones-only")
                if "per" in e:
                    if e["per"] not in PERS:
                        R.err("vocab", f"{n['id']}: per '{e['per']}' not registered")
                    if "max" not in e:
                        R.err("vocab", f"{n['id']}: per without max")
                elif "max" in e:
                    R.err("vocab", f"{n['id']}: max without per")
                if "when" in e and e["when"] not in WHENS and not str(e["when"]).startswith("dare:"):
                    R.err("vocab", f"{n['id']}: when '{e['when']}' not registered")
                sc = e.get("scope")
                if sc is not None:
                    if st in ("output", "speed", "keep_hand", "start_owned", "line_cost", "hand_cost"):
                        ok = sc == "all" or sc in LINE_NUM or sc in ERA_LINES
                    elif st == "upgrade_cost":
                        ok = sc in ("grip", "line_mk", "island") or sc in UPGRADE_KIND
                    elif st == "start_upgrade":
                        ok = sc in UPGRADE_KIND and sc != "rock"
                    elif st == "flotsam_weight":
                        ok = sc in FLOTSAM
                        if sc == "sealed_locker":
                            R.err("guarded", f"{n['id']}: touches the Sealed Locker's weight")
                    elif st.startswith(("rush", "grit", "flare")):
                        ok = sc in SKILLS
                    else:
                        ok = False
                    if not ok:
                        R.err("vocab", f"{n['id']}: scope '{sc}' not valid for {st}")
                elif st in ("start_owned", "keep_hand", "start_upgrade", "flotsam_weight"):
                    R.err("vocab", f"{n['id']}: {st} needs a scope")
                if st == "start_era" and e["value"] not in ("wood", "stone", "metal"):
                    R.err("ceilings", f"{n['id']}: start_era {e['value']} (Sheet Metal at most)")
                # monotonicity outside keystones (09 5.1)
                if not key_only and op in ("more", "inc", "add") and isinstance(e["value"], (int, float)):
                    v = eff_value(e)
                    if op == "more":
                        bad = (v < 1 - EPS) if st not in LOWER_IS_BETTER else (v > 1 + EPS)
                    else:
                        bad = (v < 0) if st not in LOWER_IS_BETTER else (v > 0)
                    if bad:
                        R.err("vocab", f"{n['id']}: {st} {op} {e['value']} worsens a stat outside a keystone")

    # 10. gates (04 1.4, 9.3 check 15)
    for n in sec_nodes:
        need = required_gate(n)
        g = n.get("gate")
        if need:
            if g is None:
                R.err("gates", f"{n['id']}: touches a system gated at #{need} but has no gate")
            elif g < need:
                R.err("gates", f"{n['id']}: gate {g} below its system's #{need}")
        if g is not None and g < RING_GATE[n["ring"]]:
            R.err("gates", f"{n['id']}: gate {g} below ring {n['ring']}'s gate #{RING_GATE[n['ring']]}")
        if g is not None and not need:
            R.warn("gates", f"{n['id']}: gate {g} on a node that touches no gated system")

    # 11. keystones: a lowering effect (or a feature downside), conflicts name keystones, symmetric
    keys = {n["id"]: n for n in sec_nodes if n["type"] == "keystone"}
    for k, n in keys.items():
        lowers = False
        for e in n["effects"]:
            if is_feature(e):
                continue
            st, op, v = e["stat"], e["op"], eff_value(e)
            if op == "more" and ((st not in LOWER_IS_BETTER and v < 1) or (st in LOWER_IS_BETTER and v > 1)):
                lowers = True
            if op == "add" and v < 0:
                lowers = True
            if op == "set" and st in ("hand_cap",):
                lowers = True
        if not lowers:
            if any(is_feature(e) for e in n["effects"]):
                R.warn("keystones", f"{k}: downside lives in its feature only (check 5 must read it)")
            else:
                R.err("keystones", f"{k}: no effect lowers a stat or turns something off")
        for c in n.get("conflicts", []):
            if c not in keys:
                R.err("keystones", f"{k}: conflicts names {c}, not a keystone")
            elif k not in keys[c].get("conflicts", []):
                R.err("keystones", f"{k} conflicts {c} but not the other way round")
    for n in sec_nodes:
        if n.get("conflicts") and n["type"] != "keystone":
            R.err("keystones", f"{n['id']}: conflicts on a non-keystone")

    # 12. anchors (canon 6.7, resolution 3.13)
    for a, spec in ANCHORS.items():
        n = byid.get(a)
        if not n:
            R.err("anchors", f"anchor {a} missing")
            continue
        for k in ("sector", "ring", "slot", "type", "gate"):
            if k in spec and n.get(k) != spec[k]:
                R.err("anchors", f"{a}: {k} {n.get(k)}, want {spec[k]}")
        if abs(n["cost"] - spec["cost"]) > 0.5:
            R.err("anchors", f"{a}: cost {n['cost']}, want {spec['cost']}")
        effs = n["effects"]
        for want in spec["eff"]:
            st, op, val = want[0], want[1], want[2]
            sc = want[3] if len(want) > 3 else None
            hit = [e for e in effs if e["stat"] == st and e["op"] == op
                   and (sc is None or e.get("scope") == sc)
                   and (val is None or abs(e["value"] - val) < 1e-9)]
            if not hit:
                R.err("anchors", f"{a}: missing effect {st} {op} {val} {sc or ''}")
    if not byid.get("ground_zero"):
        R.err("anchors", "ground_zero missing")

    # 13. scene nodes per band (04 2.5)
    for s in SECTORS:
        for band in ((1, 3), (4, 6), (7, 9)):
            if not any(n.get("scene") for n in sec_nodes
                       if n["sector"] == s and band[0] <= n["ring"] <= band[1]):
                R.err("scene", f"{s}: no scene-changing node in rings {band[0]}-{band[1]}")

    # 14. ceilings (04 4.2) over all non-keystone nodes; guarded systems
    ceil_checks(sec_nodes, R)

    # 15. the 10% rule (04 9.3 check 12) for smalls from ring 3
    ten_percent(sec_nodes, R)

    # 16. budget (10-balance 6) and c
    B = budget(nodes)
    for msg in B["errors"]:
        R.err("budget", msg)
    for msg in B["warnings"]:
        R.warn("budget", msg)
    if B["c"] > 0.6 + EPS:
        R.err("tap_c", f"steady tap coefficient c = {B['c']:.3f} > 0.6")
    return R, B


# ---------------------------------------------------------------------------------------------
def nonkey(nodes):
    return [n for n in nodes if n["type"] != "keystone" and n["id"] != "ground_zero"]


def ceil_checks(sec_nodes, R):
    nk = nonkey(sec_nodes)
    effs = [(n, e) for n in nk for e in effects_of(n)]

    def total_add(stat, when=None, any_when=False):
        return sum(eff_value(e) for n, e in effs if e["stat"] == stat and e["op"] == "add"
                   and (any_when or e.get("when") == when))

    def prod_more(stat, scope=None):
        p = 1.0
        for n, e in effs:
            if e["stat"] == stat and e["op"] == "more" and (scope is None or e.get("scope") == scope):
                p *= eff_value(e)
        return p

    def best_set(stat, base):
        v = base
        for n, e in effs:
            if e["stat"] == stat and e["op"] == "set":
                v = max(v, e["value"]) if stat not in LOWER_IS_BETTER else min(v, e["value"])
        return v

    def chk(cond, msg):
        if not cond:
            R.err("ceilings", msg)

    hm = 2 + total_add("hustle_max")
    chk(hm <= 2.25 + EPS, f"hustle_max reaches x{hm} (> x2.25)")
    hh = 2 + total_add("hustle_hold")
    chk(hh <= 6 + EPS, f"hustle_hold reaches {hh} s (> 6)")
    hd = 10 * prod_more("hustle_drain")
    chk(hd >= 5 - EPS, f"hustle_drain reaches {hd:.2f}/s (< 5)")
    hg = 1 + total_add("hustle_gain")
    chk(hg <= 3 + EPS, f"hustle_gain reaches {hg} (> 3)")
    ah = 300 + total_add("afterglow_half")
    chk(ah <= 900 + EPS, f"afterglow_half reaches {ah} s (> 900)")
    ahold = best_set("afterglow_hold", 0)
    chk(ahold <= 120 + EPS, f"afterglow_hold reaches {ahold} s (> 120)")
    tap = (1 + sum(eff_value(e) for n, e in effs if e["stat"] == "tap" and e["op"] == "inc")) * prod_more("tap")
    chk(tap <= 1.5 + EPS, f"tap reaches x{tap:.3f} (> x1.5)")
    ts = total_add("tap_share")
    chk(ts <= 0.0031 + EPS, f"tap_share adds {ts} (> 0.31%)")
    crit_nodes = {n["id"] for n, e in effs if e["stat"].startswith("crit_")}
    chk(crit_nodes <= {"lucky_swing"}, f"crit stats outside Lucky Swing: {sorted(crit_nodes - {'lucky_swing'})}")
    for st in ("line_cost", "hand_cost"):
        v = prod_more(st)
        chk(v >= 0.29 - EPS, f"{st} reaches x{v:.3f} (< x0.29)")
    for kind in ("grip", "line_mk", "island"):
        v = 1.0
        for n, e in effs:
            if e["stat"] == "upgrade_cost" and (e.get("scope") == kind or UPGRADE_KIND.get(e.get("scope")) == kind):
                v *= e["value"]
        chk(v >= 0.25 - EPS, f"upgrade_cost {kind} reaches x{v:.3f} (< x0.25)")
    v = prod_more("era_cost")
    chk(v >= 0.5 - EPS, f"era_cost reaches x{v:.3f} (< x0.5)")
    for n, e in effs:
        if e["stat"] == "start_owned" and e["value"] > 25:
            chk(False, f"{n['id']}: start_owned {e['value']} (> 25)")
    fr = prod_more("flotsam_rate")
    chk(fr <= 1.05 + EPS, f"flotsam_rate reaches x{fr:.3f} (> x1.05)")
    fe = 1 + sum(e["value"] for n, e in effs if e["stat"] == "flotsam_effect")
    chk(fe <= 1.05 + EPS, f"flotsam_effect reaches x{fe:.3f} (> x1.05)")
    rm = [n["id"] for n, e in effs if e["stat"] == "rally_mult"]
    chk(not rm, f"rally_mult on {rm} (the tree's x1.05 payout is Rally Cry's)")
    ff = 13 + total_add("flotsam_float")
    chk(ff <= 25 + EPS, f"flotsam_float reaches {ff} s (> 25)")
    ffr = ff + total_add("flotsam_float", "rain")
    chk(ffr <= 40 + EPS, f"rain float reaches {ffr} s (> 40)")
    ns = total_add("night_shift")
    chk(abs(ns - 32) < EPS, f"night_shift adds {ns} h (must be exactly +32)")
    off = prod_more("offline")
    chk(off <= 1.772 + 1e-6, f"offline reaches x{off:.4f} (> x1.772)")
    gg = (1 + sum(e["value"] for n, e in effs if e["stat"] == "glass_gain" and e["op"] == "inc")) * prod_more("glass_gain")
    chk(gg <= 2.25 + 1e-6, f"glass_gain reaches x{gg:.4f} (> x2.25)")
    gk = 0.25 + total_add("glow_k")
    chk(gk <= 0.49 + EPS, f"glow_k reaches {gk:.3f} (> 0.49)")
    mp = 0.02 + total_add("morale_per")
    chk(mp <= 0.05 + EPS, f"morale_per reaches {mp:.3f} (> 0.05)")
    mo = prod_more("morale")
    chk(mo <= 1.5 + EPS, f"morale reaches x{mo:.3f} (> x1.5)")
    mh = best_set("magnet_hours", 24)
    chk(mh >= 20 - EPS, f"magnet_hours reaches {mh} (< 20)")
    for st, base, top in (("milestone_x2", 2, 2.2), ("roster_x2", 2, 3), ("mk_mult", 3, 4), ("rank_mult", 2, 2.5)):
        v = best_set(st, base)
        chk(v <= top + EPS, f"{st} reaches {v} (> {top})")
    for n, e in effs:
        if e["stat"] == "foreman_lines" and e["value"] > 10:
            chk(False, f"{n['id']}: foreman_lines {e['value']}")
        if e["stat"].startswith(("rush_", "grit_", "flare_")):
            chk(False, f"{n['id']}: a power node on the Toolbelt ({e['stat']}); nodes only automate it")


# ---------------------------------------------------------------------------------------------
def ten_percent(sec_nodes, R):
    """Each small from ring 3 raises its (stat, scope, when) by at least 10%, lower rings owned."""
    nk = nonkey(sec_nodes)
    BASE = {"hustle_hold": 2, "hustle_gain": 1, "flotsam_float": 13, "night_shift": 12,
            "afterglow_half": 300, "morale_per": 0.02, "glow_k": 0.25, "tap_share": 0.016,
            "hustle_max": 2, "fell_bonus": 10}
    SET_BASE = {"milestone_x2": 2, "roster_x2": 2, "mk_mult": 3, "rank_mult": 2,
                "afterglow_hold": 0, "foreman_lines": 6}
    for n in sec_nodes:
        if n["type"] != "small" or n["ring"] < 3:
            continue
        e = n["effects"][0]
        st, op = e["stat"], e["op"]
        lower = [m for m in nk if m["ring"] < n["ring"]]
        le = [x for m in lower for x in effects_of(m)]
        gain = None
        if st == "magnet_hours":
            R.note("ten_percent", f"{n['id']}: magnet_hours is a timer (exempt, Scrapyard OQ 1)")
            continue
        if st in ("start_owned", "start_upgrade", "keep_hand", "start_era"):
            continue
        if op == "more":
            v = eff_value(e)
            gain = (1 / v - 1) if st in LOWER_IS_BETTER else (v - 1)
        elif op == "add":
            base = BASE[st]
            if st == "night_shift" and n["ring"] >= 5:
                base += 4  # the agenda's +4 h at Wipe Day #10
            w = e.get("when")
            s0 = base + sum(eff_value(x) for x in le if x["stat"] == st and x["op"] == "add"
                            and (x.get("when") is None or x.get("when") == w))
            gain = eff_value(e) / s0
        elif op == "inc":
            sc, w = e.get("scope"), e.get("when")
            if st == "output":
                mine = set(lines_of(sc))
                s0 = 1 + sum(eff_value(x) for x in le if x["stat"] == st and x["op"] == "inc"
                             and set(lines_of(x.get("scope"))) >= mine
                             and (x.get("when") is None or x.get("when") == w))
            else:
                s0 = 1 + sum(eff_value(x) for x in le if x["stat"] == st and x["op"] == "inc")
            gain = eff_value(e) / s0
        elif op == "set":
            base = SET_BASE.get(st)
            if base is None:
                continue
            best = max([base] + [x["value"] for x in le if x["stat"] == st and x["op"] == "set"])
            gain = e["value"] / best - 1
        if gain is not None and gain < 0.10 - 1e-6:
            R.err("ten_percent", f"{n['id']} ({st} {op}): +{gain * 100:.1f}% over the lower rings (< 10%)")


# ---------------------------------------------------------------------------------------------
SET_POWER = {"milestone_x2": (2, 3), "roster_x2": (2, 2), "mk_mult": (3, 2), "rank_mult": (2, 5)}
LINE_STATS = {"output", "speed", "morale"} | set(SET_POWER)


def line_effects(nodes, ring_state):
    """Output-column effects of non-keystone nodes, with `counts_as`, as (kind, value, weight, e)."""
    out = []
    for n in nonkey(nodes):
        for e in effects_of(n, budget=True):
            st = e["stat"]
            if st not in LINE_STATS:
                continue
            if st in SET_POWER:
                out.append(("set", st, e["value"], e))
                continue
            w = cond_w(e.get("when"), ring_state)
            if w is None:
                continue
            w *= scope_w(e.get("scope"), ring_state)
            v = eff_value(e)
            if e["op"] == "more":
                out.append(("more", v, w, e))
            elif e["op"] == "inc":
                out.append(("inc", v, w, e))
            elif e["op"] == "add":
                out.append(("inc", v, w, e))
    return out


def set_factor(lower_eff, all_eff):
    f = 1.0
    for st, (base, power) in SET_POWER.items():
        b0 = max([base] + [x[2] for x in lower_eff if x[0] == "set" and x[1] == st])
        b1 = max([base] + [x[2] for x in all_eff if x[0] == "set" and x[1] == st])
        f *= (b1 / b0) ** power
    return f


def lines_factor_linear(lower_nodes, ring_nodes, ring):
    le = line_effects(lower_nodes, ring)
    re_ = line_effects(ring_nodes, ring)
    S0 = sum(v * w for k, v, w, e in le if k == "inc")
    S1 = S0 + sum(v * w for k, v, w, e in re_ if k == "inc")
    more = 1.0
    for k, v, w, e in re_:
        if k == "more":
            more *= 1 + w * (v - 1)
    return more * (1 + S1) / (1 + S0) * set_factor(le, le + re_)


def fold_compound(nodes, ring):
    """Time-weighted fold at the ring's typical state: per line, per condition state (diagnostic)."""
    effs = []
    for n in nonkey(nodes):
        for e in effects_of(n, budget=True):
            if e["stat"] in LINE_STATS and e["stat"] not in SET_POWER:
                effs.append(e)
    st = state_of(ring)
    conds = ["night", "rain", "afterglow", "online"]
    pw = {"night": night_w(ring), "rain": 0.2, "afterglow": 0.02, "online": 0.1}
    total = 0.0
    for l, s in LINE_SHARE[st].items():
        if s <= 0:
            continue
        mine = [e for e in effs if l in lines_of(e.get("scope"))]
        for combo in itertools.product([0, 1], repeat=4):
            on = dict(zip(conds, combo))
            p = 1.0
            for c in conds:
                p *= pw[c] if on[c] else 1 - pw[c]
            mult, S = 1.0, 0.0
            for e in mine:
                w = e.get("when")
                if w in conds and not on[w]:
                    continue
                if w and (w.startswith("dare:") or w == "hustle_full"):
                    continue
                v = eff_value(e)
                if e["op"] == "more":
                    mult *= v
                else:
                    S += v
            total += s * p * mult * (1 + S)
    return total


def budget(nodes):
    sec = [n for n in nodes if n["id"] != "ground_zero"]
    errors, warnings = [], []
    rings = range(1, 10)
    upto = lambda r: [n for n in sec if n["ring"] < r]
    ringn = lambda r, s=None: [n for n in sec if n["ring"] == r and (s is None or n["sector"] == s)]
    res = {"ring": {}, "sector": defaultdict(dict), "compound": {}, "compound_sector": defaultdict(dict)}

    # --- output column (lines)
    run = 1.0
    runb = 1.0
    runs = {s: 1.0 for s in SECTORS}
    runsb = {s: 1.0 for s in SECTORS}
    crun = 1.0
    for r in rings:
        f = lines_factor_linear(upto(r), ringn(r), r)
        run *= f
        runb *= BUDGET["output"][1][r - 1]
        res["ring"].setdefault(r, {})["output"] = (f, BUDGET["output"][1][r - 1], run, runb)
        if run > runb * TOL + EPS:
            errors.append(f"output: running x{run:.4g} through ring {r} > budget x{runb:.4g} +10%")
        sf = set_factor(line_effects(upto(r), r), line_effects(upto(r) + ringn(r), r))
        cf = fold_compound(upto(r) + ringn(r), r) / fold_compound(upto(r), r) * sf
        crun *= cf
        res["compound"][r] = (cf, crun)
        for s in SECTORS:
            fs = lines_factor_linear(upto(r), ringn(r, s), r)
            runs[s] *= fs
            runsb[s] *= SHARE[s][r - 1]
            sfs = set_factor(line_effects(upto(r), r), line_effects(upto(r) + ringn(r, s), r))
            cfs = fold_compound(upto(r) + ringn(r, s), r) / fold_compound(upto(r), r) * sfs
            res["sector"][s][r] = (fs, SHARE[s][r - 1], runs[s], runsb[s])
            res["compound_sector"][s][r] = cfs
            if runs[s] > runsb[s] * TOL + EPS:
                errors.append(f"output/{s}: running x{runs[s]:.4g} through ring {r} > share x{runsb[s]:.4g} +10%")
        if f > BUDGET["output"][1][r - 1] * TOL + EPS:
            warnings.append(f"output: ring {r} alone x{f:.3g} > x{BUDGET['output'][1][r - 1]} +10% "
                            f"(allowed: the running total holds, 10 6.2.1)")

    # --- other columns
    def col_eff(nodes_, pred):
        return [e for n in nonkey(nodes_) for e in effects_of(n, budget=True) if pred(e)]

    def mul_ratio(lower, ring_, stat, scope_kind=None):
        def ok(e):
            if e["stat"] != stat:
                return False
            if scope_kind:
                sc = e.get("scope")
                return sc == scope_kind or UPGRADE_KIND.get(sc) == scope_kind
            return True
        le, re_ = col_eff(lower, ok), col_eff(ring_, ok)
        S0 = sum(eff_value(e) for e in le if e["op"] == "inc")
        S1 = S0 + sum(eff_value(e) for e in re_ if e["op"] == "inc")
        m = 1.0
        for e in re_:
            if e["op"] == "more":
                w = cond_w(e.get("when"), 4) if e.get("when") else 1.0
                m *= 1 + (w or 0) * (eff_value(e) - 1)
        return m * (1 + S1) / (1 + S0)

    def add_sum(nodes_, stat):
        return sum(eff_value(e) for e in col_eff(nodes_, lambda e: e["stat"] == stat and e["op"] == "add"))

    p_base = 0.016
    for col, (kind, bud) in BUDGET.items():
        if col == "output":
            continue
        run, runb = (0.0, 0.0) if kind == "add" else (1.0, 1.0)
        for r in rings:
            lower, rn = upto(r), ringn(r)
            if kind == "add":
                stat = col
                f = add_sum(rn, stat)
                run += f
                runb += bud[r - 1]
                ok = run <= runb * TOL + EPS
            else:
                if col == "tap_share":
                    a0 = p_base + add_sum(lower, "tap_share")
                    f = (a0 + add_sum(rn, "tap_share")) / a0
                elif col == "crit":
                    def crit(ns):
                        ch = sum(eff_value(e) for e in col_eff(ns, lambda e: e["stat"] == "crit_chance"))
                        mu = max([1] + [e["value"] for e in col_eff(ns, lambda e: e["stat"] == "crit_mult")])
                        return 1 + ch * (mu - 1)
                    f = crit(lower + rn) / crit(lower)
                elif col.startswith("upgrade_cost:"):
                    f = mul_ratio(lower, rn, "upgrade_cost", col.split(":")[1])
                else:
                    f = mul_ratio(lower, rn, col)
                run *= f
                runb *= bud[r - 1]
                ok = run <= runb * TOL + EPS if kind == "mul" else run >= runb / TOL - EPS
            res["ring"].setdefault(r, {})[col] = (f, bud[r - 1], run, runb)
            if not ok:
                errors.append(f"{col}: running {run:.4g} through ring {r} vs budget {runb:.4g} (+10%)")
    # night shift against 10's table row (reported, not enforced)
    run = runb = 0
    over = []
    for r in rings:
        run += add_sum(ringn(r), "night_shift")
        runb += NIGHT_SHIFT_10_ROW[r - 1]
        if run > runb * TOL + EPS:
            over.append(f"ring {r}: {run:g} h vs {runb:g} h")
    res["night_shift_10_row"] = over

    # --- steady tap coefficient c (resolution 1.5): 6 taps/s x p x T x Hustle x crit x fell
    nk = nonkey(sec)
    p = p_base + add_sum(sec, "tap_share")
    T = (1 + sum(eff_value(e) for e in col_eff(sec, lambda e: e["stat"] == "tap" and e["op"] == "inc" and not e.get("when")))) \
        * math.prod(eff_value(e) for e in col_eff(sec, lambda e: e["stat"] == "tap" and e["op"] == "more" and not e.get("when")))
    H = 2 + add_sum(sec, "hustle_max")
    ch = sum(eff_value(e) for e in col_eff(sec, lambda e: e["stat"] == "crit_chance"))
    mu = max([1] + [e["value"] for e in col_eff(sec, lambda e: e["stat"] == "crit_mult")])
    crit = 1 + ch * (mu - 1)
    F = 120 * math.prod(eff_value(e) for e in col_eff(sec, lambda e: e["stat"] == "fell_taps" and not e.get("when")))
    b = 10 + sum(eff_value(e) for e in col_eff(sec, lambda e: e["stat"] == "fell_bonus" and not e.get("when")))
    fell = (1 + b / F) / (1 + 10 / 120)
    c = 6 * p * T * H * crit * fell
    res["c"] = c
    res["c_parts"] = dict(p=p, T=T, H=H, crit=crit, fell=fell)
    if fell > 1.07 + EPS:
        errors.append(f"fells raise c by {fell:.3f} (> x1.07)")
    res["errors"], res["warnings"] = errors, warnings
    # condition stacking at the full tree (diagnostic)
    full = [n for n in sec]
    stack = {}
    for cond in ("night", "rain"):
        m, S, S0 = 1.0, 0.0, 0.0
        for n in nonkey(full):
            for e in effects_of(n, budget=True):
                if e["stat"] not in ("output", "speed") or e.get("scope") not in (None, "all"):
                    continue
                if e.get("when") == cond:
                    if e["op"] == "more":
                        m *= eff_value(e)
                    else:
                        S += eff_value(e)
                elif e.get("when") is None and e["op"] == "inc":
                    S0 += eff_value(e)
        stack[cond] = m * (1 + S0 + S) / (1 + S0)
    res["stack"] = stack
    crun9 = res["compound"][9][1]
    lrun9 = res["ring"][9]["output"][2]
    budg9 = res["ring"][9]["output"][3]
    if crun9 > budg9 * TOL:
        warnings.append(
            f"diagnostic: the time-weighted fold (conditions folded together, not counted one by one) "
            f"reads x{crun9:.3g} through ring 9 against x{budg9:.3g} (linear count x{lrun9:.3g}); "
            f"night stacks to x{stack['night']:.1f} and rain to x{stack['rain']:.1f} at the full tree "
            f"(10 6.2's counting rule, Bunker OQ 1)")
    return res


# ---------------------------------------------------------------------------------------------
def main(argv):
    quiet = "--quiet" in argv
    nodes = load()
    R, B = run_checks(nodes)
    by = Counter(i[0] for i in R.items)
    if not quiet:
        for lvl, chk, msg in R.items:
            if lvl != "NOTE" or "--notes" in argv:
                print(f"{lvl:5} [{chk}] {msg}")
    print(f"\n{len(nodes)} nodes; {by['ERROR']} errors, {by['WARN']} warnings, {by['NOTE']} notes")
    print(f"steady tap coefficient c = {B['c']:.4f} (p {B['c_parts']['p']:.4f}, T {B['c_parts']['T']:.3f}, "
          f"Hustle {B['c_parts']['H']:.2f}, crit {B['c_parts']['crit']:.3f}, fell {B['c_parts']['fell']:.4f})")
    print("output column, linear count (ring factor / budget, running / running budget):")
    for r in range(1, 10):
        f, b, run, runb = B["ring"][r]["output"]
        cf, crun = B["compound"][r]
        print(f"  ring {r}: x{f:8.4g} / x{b:<6g} running x{run:10.4g} / x{runb:10.4g}"
              f"   compounded x{cf:8.4g} running x{crun:10.4g}")
    print(f"night stack at the full tree x{B['stack']['night']:.2f}, rain x{B['stack']['rain']:.2f}")
    if B["night_shift_10_row"]:
        print("night_shift vs 10 6.1's table row (not enforced):", "; ".join(B["night_shift_10_row"]))
    return 1 if by["ERROR"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

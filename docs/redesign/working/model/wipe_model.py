"""Wipe Day balance model (evidence for plan/10-balance.md).

A faithful-enough implementation of canon.md's run economy and meta loop:
14 lines, per-line and roster milestones, the shelf (Grip, Line Mk II/III, island upgrades),
eras, taps with Grip, Hustle, Afterglow and felling, unmanned lines credited only while tapping,
flotsam while online, the Night Shift window offline, the prestige formula (cube root of lifetime
with a delta, Glow = 1 + k * sqrt(glass ever)), and a Blast Map approximated as a per-ring,
per-category power budget delivered in proportion to the glass spent in that ring.

Time steps: one second while a session is online; closed form while offline.
Everything is seeded; the same parameters give the same numbers.

Run with:  python -I run_all.py   (this file is a library).
"""

import math
import random

DAY = 86400
HOUR = 3600
NL = 14  # lines

MULT_KEYS = ("lines", "tap", "p_mult", "cost", "flot_freq", "flot_eff", "off_mult", "glass",
             "shelf_cost", "era_cost")
ADD_KEYS = ("hustle_add", "crit", "off_h", "glow_k", "morale")
ALL_KEYS = MULT_KEYS + ADD_KEYS


def canon_budget():
    """The Blast Map power budget used by the model: what each ring adds when fully lit.

    lines: global line output multiplier; tap: whole tap value multiplier;
    p_mult: multiplier on p (share of supplies/s added per tap); hustle_add: Hustle max (x2 base);
    crit: average extra tap value from crits; cost: line and hand price multiplier (<1);
    flot_freq / flot_eff: flotsam frequency / effect; off_h: Night Shift hours; off_mult: offline
    output; glass: glass gain multiplier; glow_k: additive to k; morale: additive per Logbook entry.
    """
    rows = [
        # lines  tap   p_mult hust  crit  cost  ffreq feff  off_h offm  glass glow_k morale
        (2.0, 1.5, 1.00, 0.00, 0.00, 0.90, 1.10, 1.10, 0.0, 1.00, 1.10, 0.000, 0.000),
        (3.0, 1.0, 1.10, 0.25, 0.00, 0.85, 1.10, 1.15, 4.0, 1.00, 1.10, 0.020, 0.005),
        (4.0, 1.0, 1.00, 0.25, 0.45, 0.80, 1.10, 1.15, 4.0, 1.10, 1.15, 0.030, 0.005),
        (6.0, 1.0, 1.15, 0.25, 0.00, 0.75, 1.10, 1.20, 4.0, 1.10, 1.15, 0.030, 0.005),
        (8.0, 1.0, 1.00, 0.25, 0.00, 0.70, 1.10, 1.20, 4.0, 1.10, 1.20, 0.040, 0.005),
        (10.0, 1.0, 1.00, 0.00, 0.00, 0.70, 1.10, 1.20, 4.0, 1.10, 1.20, 0.040, 0.005),
        (12.0, 1.0, 1.00, 0.00, 0.00, 0.70, 1.10, 1.20, 4.0, 1.10, 1.20, 0.050, 0.005),
        (15.0, 1.0, 1.00, 0.00, 0.00, 0.70, 1.10, 1.20, 4.0, 1.10, 1.20, 0.050, 0.005),
        (20.0, 1.0, 1.00, 0.00, 0.00, 0.70, 1.10, 1.20, 0.0, 1.10, 1.20, 0.060, 0.005),
    ]
    out = []
    for row in rows:
        out.append(dict(zip(("lines", "tap", "p_mult", "hustle_add", "crit", "cost", "flot_freq",
                             "flot_eff", "off_h", "off_mult", "glass", "glow_k", "morale"), row)))
    return out


class Params:
    """Every constant the canon names. Defaults are canon; keyword overrides tune them."""

    def __init__(self, **over):
        # Lines (canon 4.2)
        self.cost_base = 6.0
        self.cost_ratio = 16.0
        self.out_base = 1.5
        self.out_ratio = 5.5
        self.cycle_base = 0.6
        self.cycle_ratio = 2.0
        self.g1 = 1.15
        self.g_step = 0.006
        self.hand_factor = 300.0
        # Eras (canon 4.4): Timber, Stone, Sheet Metal, Armored
        self.era_costs = [1.5e3, 3e6, 2e10, 4e14]
        self.era_mult = 2.0
        self.armored_nukes = 2
        self.era_lines = [3, 6, 9, 12, 14]
        # Shelf (canon 4.4)
        self.grip_costs = [60.0, 6e3, 6e6, 6e9]
        self.grip_p = 0.01
        self.mk_factors = [1e4, 1e8]
        self.mk_need = [25, 50]
        self.mk_mult = 3.0
        self.island_costs = [1e6, 1e10, 1e14, 1e18, 1e22, 1e26, 1e30, 1e34]
        self.island_mult = 2.0
        # Milestones (canon 4.3)
        self.ms_pay = {10: 2.0, 100: 2.0, 200: 3.0, 300: 3.0, 400: 4.0}
        self.ms_speed = {25: 2.0, 50: 2.0}
        self.ms_every100 = 2.0
        self.ms_1000 = 5.0
        self.roster = [(25, 2.0), (100, 2.0), (250, 3.0)]
        # Taps (canon 4.5)
        self.fell = [40, 60, 80, 100, 120]
        self.fell_bonus = 10.0
        self.hustle_cap = 100.0
        self.hustle_max = 2.0
        self.hustle_hold = 2
        self.hustle_drain = 10.0
        self.afterglow = 3.0
        self.afterglow_half = 300.0
        self.tap_base = 1.0
        self.foreman = True
        self.foreman_reserve = True
        self.batch_rule = "busy"  # "busy" (fixed) or "literal" (canon text, over-credits)
        # Flotsam (canon 4.6)
        self.flot_min = 240.0
        self.flot_max = 600.0
        self.flot_first = 180.0
        self.flot = [("crate", 0.45), ("fuel_drum", 0.40), ("adrenaline", 0.06),
                     ("drowned_drone", 0.07), ("sealed_locker", 0.015), ("bottle", 0.005)]
        self.rally = (6.0, 60)
        self.adren = (300.0, 12)
        self.drone = (12.0, 30)
        self.crate_held = 0.15
        self.crate_secs = 900.0
        # Night Shift (canon 4.8)
        self.night_base = 12.0
        self.night_cap = 48.0
        self.night_agenda = {10: 4.0}
        self.deep_cellars = 4.0
        # Prestige (canon 5.1)
        self.L0 = 1e8
        self.expo = 1.0 / 3.0
        self.glow_k = 0.25
        self.first_min = 10
        # Blast Map (canon 6.1, 6.4, 5.8)
        self.ring_gates = [1, 1, 3, 5, 10, 20, 30, 40, 50]
        self.ring_sizes = [2, 3, 4, 5, 5, 6, 6, 7, 7]
        self.ring_bands = [(1, 2), (4, 10), (25, 75), (200, 600), (2e3, 6e3), (2e4, 6e4),
                           (2e5, 6e5), (2e6, 6e6), (2e7, 6e7)]
        self.keystones = [0, 0, 0, 0, 4, 3, 3, 3, 3]
        self.budget = canon_budget()
        # Automation nodes: (ring index, share of the ring's nodes bought, key)
        self.auto = [(0, 3 / 16, "kit1"), (0, 3 / 16, "old_friend"), (0, 3 / 16, "deep_cellars"),
                     (2, 0.25, "old_crew_1"), (2, 0.75, "start_timber"), (3, 0.5, "kit2"),
                     (4, 0.5, "old_crew_2"), (4, 0.75, "start_stone"), (5, 0.5, "old_crew_3"),
                     (6, 0.5, "start_metal")]
        self.hands_kept_agenda = {3: 3}
        # Meta (canon 7)
        self.morale_entry = 0.02
        self.entries_cap = 250
        self.entries_scale = 1.0
        self.logbook_from_nuke = 0
        self.rank_mult = 3.0
        self.rank_costs = [1, 2, 4, 8, 16]
        self.first_nuke_scrap = 3
        self.magnet_rich = 0.10
        # Toolbelt (canon 7.6)
        self.rush = (10.0, 30, 600)
        self.grit = (1.05, 10, 8 * HOUR)
        self.flare_cd = HOUR
        self.tool_gates = {"rush": 4, "grit": 8, "flare": 15}
        # Social (canon 8.2, 8.5)
        self.blowback_per_day = 9.0
        self.blowback_max = 9
        self.late_tide = 2.0
        self.late_tide_below = 0.5
        # Crown rule (canon 5.2)
        self.crown_peak = 0.8
        self.crown_min_share = 0.10
        self.crown_mode = "marginal"  # canon text; "eager", "average", "hybrid" are tested variants
        self.crown_age = 20 * HOUR
        self.rank_rule = None  # None: the archetype's policy; "spread": ranks rise together (proposal)
        # Canon v2 (resolutions.md); the defaults reproduce the P1 report
        self.crate_floor = 0.0          # v2 60: crates pay at least 1 min of output (flotsam and Blowback)
        self.first_crate_secs = None    # v2 600: run 1's guaranteed 3:00 flotsam is a crate paying a flat 10 min
        self.afterglow_from = "rebuild"  # v2 "first_tap": Afterglow counts from the run's first tap
        self.rain_share = 0.0           # v2 0.2: rain in 20% of 30-minute blocks (island.json5)
        self.rain_flot = 1.5            # rain makes flotsam 1.5x as often
        self.weather_seed = 4242
        self.late_tide_cap = False      # v2 True: the bonus never carries a player past the median
        self.blowback_crates = 3        # per friend's Wipe Day (group mode), at most blowback_max waiting
        self.freighter_scale = 1.0      # 0 for a player alone (no Freighter tiers)
        for k, v in over.items():
            if not hasattr(self, k):
                raise KeyError("unknown parameter " + k)
            setattr(self, k, v)
        self._derive()

    def _derive(self):
        self.C = [self.cost_base * self.cost_ratio ** i for i in range(NL)]
        self.R = [self.out_base * self.out_ratio ** i for i in range(NL)]
        self.CYC = [self.cycle_base * self.cycle_ratio ** i for i in range(NL)]
        self.G = [self.g1 - self.g_step * i for i in range(NL)]
        self.LNG = [math.log(g) for g in self.G]
        # Milestone tables up to N owned.
        N = 8000
        pay = 1.0
        spd = 1.0
        M = [0.0] * (N + 1)
        SPD = [1.0] * (N + 1)
        thresholds = set(self.ms_pay) | set(self.ms_speed) | {r[0] for r in self.roster}
        for n in range(N + 1):
            if n in self.ms_pay:
                pay *= self.ms_pay[n]
            elif n in self.ms_speed:
                spd *= self.ms_speed[n]
            elif n >= 500 and n % 100 == 0:
                pay *= self.ms_1000 if n == 1000 else self.ms_every100
                thresholds.add(n)
            M[n] = n * pay * spd
            SPD[n] = spd
        self.M = M  # n * milestone multiplier (output of n units relative to one base unit)
        self.SPD = SPD
        self.TH = sorted(thresholds)
        # Blast Map node costs per ring (cheapest first).
        self.nodes = []
        for r in range(9):
            n = 8 * self.ring_sizes[r]
            lo, hi = self.ring_bands[r]
            n_not = round(0.19 * n)
            n_key = self.keystones[r]
            costs = []
            for j in range(n):
                x = j / (n - 1)
                c = lo * (hi / lo) ** x
                costs.append(c)
            # spread notables and keystones evenly through the ring
            fac = [1.0] * n
            for j in range(n_not):
                fac[int((j + 0.5) * n / n_not)] = 2.0
            for j in range(n_key):
                idx = int((j + 0.7) * n / max(1, n_key)) % n
                fac[idx] = 3.0
            costs = sorted(max(1.0, round(c * f)) for c, f in zip(costs, fac))
            cum = [0.0]
            for c in costs:
                cum.append(cum[-1] + c)
            self.nodes.append((costs, cum))
        self.tree_total = sum(c[1][-1] for c in self.nodes)
        self.tree_count = sum(len(c[0]) for c in self.nodes) + 1


# ---------------------------------------------------------------------------------------------
# Archetypes (canon 13.9)

def archetype(name, **over):
    a = dict(name=name, start_day=0, sessions=[], tps=0.0, duty=0.0, rule="crown",
             rank_policy="spread", entries_factor=1.0, magnet_period=23 * HOUR,
             freighter_per_week=2.0, blowback=True, late_tide=False)
    if name == "idler":
        a.update(sessions=[(8 * HOUR, 180), (21 * HOUR, 180)], tps=0.0, duty=0.0,
                 rule="double", entries_factor=0.75, magnet_period=24 * HOUR,
                 freighter_per_week=1.0, bootstrap=4.0)
    elif name == "casual":
        a.update(sessions=[(8 * HOUR, 300), (13 * HOUR, 300), (21 * HOUR, 300)], tps=4.0,
                 duty=15 / 1440)
    elif name == "active":
        a.update(sessions=[(h * HOUR, 600) for h in (7, 9, 12, 15, 17, 19, 21, 23)], tps=6.0,
                 duty=80 / 1440, entries_factor=1.1)
    elif name == "optimal":
        a.update(sessions=[(h * HOUR, 300) for h in range(24)], tps=6.0, duty=120 / 1440,
                 rule="optimal", rank_policy="focus", entries_factor=1.15)
    elif name == "late":
        a.update(sessions=[(8 * HOUR, 300), (13 * HOUR, 300), (21 * HOUR, 300)], tps=4.0,
                 duty=15 / 1440, start_day=29, late_tide=True)
    elif name == "first_hour":
        # canon 4.9/4.10: one continuous session at 6 taps/s (a greedy player's first hour)
        a.update(sessions=[(0, 3 * HOUR)], tps=6.0, duty=0.3, blowback=False)
    elif name == "autoclicker":
        a.update(sessions=[(0, 3 * HOUR)], tps=15.0, duty=0.3, blowback=False)
    else:
        raise KeyError(name)
    a.update(over)
    return a


# ---------------------------------------------------------------------------------------------

class Run:
    def __init__(self, t, index):
        self.index = index
        self.t0 = t
        self.owned = [0] * NL
        self.manned = [False] * NL
        self.mk = [0] * NL
        self.grip = 0
        self.island = 0
        self.era = 0
        self.roster = 0
        self.held = 0.0
        self.S = 0.0
        self.busy = [0.0] * NL
        self.hustle = 0.0
        self.idle = 0
        self.ag_start = None
        self.rally_until = -1.0
        self.adren_until = -1.0
        self.drone_until = -1.0
        self.drone_line = -1
        self.rush_until = -1.0
        self.grit = 0
        self.online = 0  # online seconds in this run
        self.flot_timer = None
        self.purchase_times = []  # online seconds of purchases in the first 600 s online
        self.idle_streak = 0
        self.max_idle_streak = 0  # longest online stretch with nothing affordable (first 10 runs)
        self.tap_inc = 0.0
        self.line_inc = 0.0
        self.flot_inc = 0.0
        self.caught = 0
        self.samples = []  # (t, raw yield) at session starts
        self.peak_rate = 0.0
        self.peak_avg = 0.0
        self.last_rate = None
        self.events = []  # (online s, wall s, text)
        self.first = {}
        self.max_era = 0
        self.trace = [(0.0, 0.0)]  # (seconds since the run started, supplies made this run)


class Player:
    def __init__(self, p, arch, seed=1, group=None, record_seconds=False):
        self.p = p
        self.a = arch
        self.rng = random.Random(seed)
        self.group = group  # median glass-ever curve for Late Tide: list of (t, E)
        # meta
        self.L = 0.0
        self.Fprev = 0
        self.E = 0
        self.H = 0
        self.nukes = 0
        self.ring_bought = [0] * 9
        self.auto = set()
        self.scrap = 0
        self.scrap_total = 0
        self.ranks = [0] * NL
        self.entries = 0
        self.t_first = None  # time of the first session (start of play)
        self.magnet_next = None
        self.flare_ready = 0.0
        self.rush_ready = 0.0
        self.grit_ready = 0.0
        self.blow_waiting = 0.0
        self.blow_last = None
        self.locker_scrap = 0
        self.freighter_acc = 0.0
        self.eff = None
        self.update_tree()
        # run
        self.run = None
        self.last_t = 0.0
        self.last_cmd = 0.0
        self.runs = []  # finished runs
        self.daily = []  # snapshots per day
        self.max_number = 0.0
        self.checkins = []  # casual N7 data: (t, purchases)
        self.record_seconds = record_seconds
        self.seconds = []  # (run index, online s, tap income, line income, burst flag)
        self.cur_purchases = 0
        self.perm_after = None
        self.no_buy = False
        self.no_flot = False
        self.cur_t = 0.0
        self.lt_median = None  # group mode: median glass ever of the OTHER active players
        self.friend_nukes = 0  # group mode: friends' counted Wipe Days since the last check-in
        self.force_rain = None  # N9 measurement: True / False forces the weather
        self._wblock = None
        self._wrain = False

    # ----- meta derived values ---------------------------------------------------------------
    def ring_frac(self, r):
        costs, cum = self.p.nodes[r]
        return cum[self.ring_bought[r]] / cum[-1]

    def update_tree(self):
        eff = {k: 1.0 for k in MULT_KEYS}
        eff.update({k: 0.0 for k in ADD_KEYS})
        p = self.p
        for r in range(9):
            if self.ring_bought[r] == 0:
                continue
            f = self.ring_frac(r)
            b = p.budget[r]
            for k in MULT_KEYS:
                eff[k] *= b.get(k, 1.0) ** f
            for k in ADD_KEYS:
                eff[k] += b.get(k, 0.0) * f
            share = self.ring_bought[r] / len(p.nodes[r][0])
            for (ring, need, key) in p.auto:
                if ring == r and share >= need - 1e-9:
                    self.auto.add(key)
        self.eff = eff

    def glow(self):
        return 1.0 + (self.p.glow_k + self.eff["glow_k"]) * math.sqrt(self.E)

    def morale(self):
        return 1.0 + (self.p.morale_entry + self.eff["morale"]) * self.entries

    def window(self):
        h = self.p.night_base + self.eff["off_h"]
        if "deep_cellars" in self.auto:
            h += self.p.deep_cellars
        for n, add in self.p.night_agenda.items():
            if self.nukes >= n:
                h += add
        return min(h, self.p.night_cap) * HOUR

    def kept_hands(self):
        k = 0
        if "old_friend" in self.auto:
            k = 1
        for n, lines in self.p.hands_kept_agenda.items():
            if self.nukes >= n:
                k = max(k, lines)
        if "old_crew_1" in self.auto:
            k = max(k, 6)
        if "old_crew_2" in self.auto:
            k = max(k, 10)
        if "old_crew_3" in self.auto:
            k = NL
        return k

    def perm_vector(self):
        base = self.glow() * self.morale() * self.eff["lines"]
        rm = self.p.rank_mult
        return [base * rm ** self.ranks[i] for i in range(NL)]

    # ----- run state -------------------------------------------------------------------------
    def new_run(self, t):
        r = Run(t, len(self.runs) + 1)
        self.run = r
        kept = self.kept_hands()
        for i in range(kept):
            r.manned[i] = True
        if "start_metal" in self.auto:
            r.era = 3
        elif "start_stone" in self.auto:
            r.era = 2
        elif "start_timber" in self.auto:
            r.era = 1
        if "kit1" in self.auto:
            r.owned[0] = max(r.owned[0], 10)
            r.owned[1] = max(r.owned[1], 5)
        if "kit2" in self.auto:
            for i in range(3):
                r.owned[i] = max(r.owned[i], 25)
        if "kit_big" in self.auto:  # 04's Bigger Kit: 25 Beachcombers, 25 Campfires, 10 Gardens
            for i, n in enumerate((25, 25, 10)):
                r.owned[i] = max(r.owned[i], n)
        if "standing_crew" in self.auto:  # lines with a kept hand start with 10 units
            for i in range(NL):
                if r.manned[i] and i < self.p.era_lines[r.era]:
                    r.owned[i] = max(r.owned[i], 10)
        for key, g in (("grip1", 1), ("grip2", 2), ("grip3", 3)):
            if key in self.auto:
                r.grip = max(r.grip, g)
        if "island1" in self.auto:
            r.island = max(r.island, 1)
        if "mk2_6" in self.auto:
            for i in range(6):
                r.mk[i] = max(r.mk[i], 1)
        r.max_era = r.era
        r.ag_pending = False
        if self.nukes >= 1:
            if self.p.afterglow_from == "first_tap":
                r.ag_pending = True
            else:
                r.ag_start = t
        r.flot_timer = self.p.flot_first if r.index == 1 else self.next_flot_gap()
        self.recalc()

    def next_flot_gap(self):
        return self.rng.uniform(self.p.flot_min, self.p.flot_max) / self.eff["flot_freq"]

    def recalc(self):
        p = self.p
        r = self.run
        grun = (p.era_mult ** r.era) * (p.island_mult ** r.island)
        for lvl in range(r.roster):
            grun *= p.roster[lvl][1]
        grun *= p.grit[0] ** r.grit
        self.grun = grun
        self.gm = self.glow() * self.morale()
        common = self.gm * self.eff["lines"] * grun
        rm = p.rank_mult
        mkm = p.mk_mult
        out = [0.0] * NL
        cyc = [0.0] * NL
        man = 0.0
        unm = 0.0
        fast = 0.0
        slow = []
        for i in range(NL):
            n = r.owned[i]
            if n == 0:
                continue
            v = p.R[i] * p.M[n] * (mkm ** r.mk[i]) * (rm ** self.ranks[i]) * common
            out[i] = v
            cyc[i] = p.CYC[i] / p.SPD[n]
            if r.manned[i]:
                man += v
            else:
                unm += v
                if cyc[i] <= 1.0 or p.batch_rule == "literal":
                    fast += v
                if cyc[i] > 1.0:
                    slow.append(i)
        self.out = out
        self.cyc = cyc
        self.man = man
        self.unm = unm
        self.unm_fast = fast
        self.slow = slow
        self.common = common
        self.base_tap = self.p.tap_base * (2.0 ** r.grip) * self.gm * grun
        self.p_eff = r.grip * p.grip_p * self.eff["p_mult"]
        self.hmax = p.hustle_max + self.eff["hustle_add"]
        self.crit = 1.0 + self.eff["crit"]
        self.fellm = 1.0 + p.fell_bonus / p.fell[r.era]
        self.next_cost = None

    def tap_steady(self, sps):
        """Tap value at full Hustle, no transient buffs (the buyer's estimate)."""
        return (self.base_tap + self.p_eff * sps) * self.eff["tap"] * self.hmax * self.crit * self.fellm

    def add(self, x, kind):
        r = self.run
        r.held += x
        r.S += x
        self.L += x
        if kind == "tap":
            r.tap_inc += x
        elif kind == "line":
            r.line_inc += x
        else:
            r.flot_inc += x

    # ----- the buyer -------------------------------------------------------------------------
    def candidates(self, d, tps):
        """Yield (score, kind, arg, cost) for every purchase; greedy best payback with waiting."""
        p = self.p
        r = self.run
        held = r.held
        sps_all = self.man + self.unm
        tap_now = tps * self.tap_steady(sps_all) if tps > 0 else 0.0
        inc_now = self.man + (self.unm + tap_now if tps > 0 else 0.0)
        if inc_now <= 0:
            inc_now = 1e-9
        tot_eff = self.man + d * (self.unm + tap_now)
        costm = self.eff["cost"]
        res = []

        def consider(kind, arg, cost, delta):
            if delta <= 0:
                return
            wait = (cost - held) / inc_now if cost > held else 0.0
            res.append((wait + cost / delta, kind, arg, cost))

        shm = self.eff["shelf_cost"]
        erm = self.eff["era_cost"]
        # era
        if r.era < 4 and (r.era < 3 or self.nukes >= p.armored_nukes):
            consider("era", r.era + 1, p.era_costs[r.era] * erm, tot_eff * (p.era_mult - 1) * 1.5 + 1e-12)
        # grip
        if r.grip < len(p.grip_costs) and tps > 0:
            dv = (self.base_tap + p.grip_p * self.eff["p_mult"] * sps_all) * self.eff["tap"] \
                * self.hmax * self.crit * self.fellm * tps * d
            consider("grip", r.grip + 1, p.grip_costs[r.grip] * shm, dv)
        # island
        if r.island < len(p.island_costs):
            consider("island", r.island + 1, p.island_costs[r.island] * shm, tot_eff * (p.island_mult - 1))
        nl = p.era_lines[r.era]
        owned = r.owned
        # roster helper
        if r.roster < len(p.roster):
            rth, rmul = p.roster[r.roster]
            others_min = sorted(owned[:nl])
        else:
            rth = None
        for i in range(nl):
            n = owned[i]
            w = 1.0 if r.manned[i] else d
            unit = p.R[i] * (p.mk_mult ** r.mk[i]) * (p.rank_mult ** self.ranks[i]) * self.common
            # Mk upgrades
            if r.mk[i] < 2 and n >= p.mk_need[r.mk[i]]:
                consider("mk", i, p.C[i] * p.mk_factors[r.mk[i]] * shm, self.out[i] * (p.mk_mult - 1) * w)
            c0 = p.C[i] * costm
            g = p.G[i]
            # hand
            if not r.manned[i]:
                hcost = p.C[i] * p.hand_factor * costm
                if n > 0:
                    consider("hand", i, hcost, self.out[i] * (1 - d))
                else:
                    consider("unit+hand", i, c0 + hcost, unit * p.M[1] * (1 - d) + unit * p.M[1] * d)
            # units: one, and up to the next threshold
            ks = [1]
            for th in p.TH:
                if th > n + 1:
                    ks.append(th - n)
                    break
            gn = g ** n
            for k in ks:
                cost = c0 * gn * (g ** k - 1) / (g - 1)
                delta = unit * (p.M[n + k] - p.M[n]) * w
                if rth is not None and n + k >= rth:
                    # does every unlocked line reach the roster threshold?
                    mn = min(owned[j] if j != i else n + k for j in range(nl))
                    if mn >= rth:
                        delta += (tot_eff + unit * (p.M[n + k] - p.M[n]) * w) * (rmul - 1)
                consider("units", (i, k), cost, delta)
        return res

    def buy(self, kind, arg, cost, t):
        p = self.p
        r = self.run
        r.held -= cost
        if kind == "era":
            r.era = arg
            r.max_era = max(r.max_era, arg)
            r.events.append((r.online, t - r.t0, "era %d" % arg))
        elif kind == "grip":
            r.grip = arg
            r.events.append((r.online, t - r.t0, "grip %d" % arg))
        elif kind == "island":
            r.island = arg
            r.events.append((r.online, t - r.t0, "island %d" % arg))
        elif kind == "mk":
            r.mk[arg] += 1
        elif kind == "hand":
            r.manned[arg] = True
            r.events.append((r.online, t - r.t0, "hand %d" % (arg + 1)))
        elif kind == "unit+hand":
            r.owned[arg] += 1
            r.manned[arg] = True
            r.events.append((r.online, t - r.t0, "hand %d" % (arg + 1)))
        elif kind == "units":
            i, k = arg
            before = r.owned[i]
            r.owned[i] += k
            if before == 0:
                r.events.append((r.online, t - r.t0, "line %d" % (i + 1)))
            for th in (10, 25):
                if before < th <= r.owned[i]:
                    r.events.append((r.online, t - r.t0, "line %d x%d" % (i + 1, th)))
        # roster (sticky once reached)
        nl = p.era_lines[r.era]
        while r.roster < len(p.roster) and min(r.owned[:nl]) >= p.roster[r.roster][0]:
            r.roster += 1
        self.cur_purchases += 1
        if r.online < 600:
            r.purchase_times.append(r.online)
        self.recalc()

    def buy_loop(self, t, tps, limit=100000):
        d = self.a["duty"]
        r = self.run
        bought = 0
        while bought < limit:
            cands = self.candidates(d, tps)
            if not cands:
                self.next_cost = float("inf")
                return bought
            best = min(cands)
            score, kind, arg, cost = best
            if cost <= r.held:
                self.buy(kind, arg, cost, t)
                bought += 1
            else:
                self.next_cost = cost
                return bought
        return bought

    def anything_affordable(self):
        p = self.p
        r = self.run
        h = r.held
        shm = self.eff["shelf_cost"]
        if r.era < 4 and (r.era < 3 or self.nukes >= p.armored_nukes) and p.era_costs[r.era] * self.eff["era_cost"] <= h:
            return True
        if r.grip < len(p.grip_costs) and p.grip_costs[r.grip] * shm <= h:
            return True
        if r.island < len(p.island_costs) and p.island_costs[r.island] * shm <= h:
            return True
        costm = self.eff["cost"]
        for i in range(p.era_lines[r.era]):
            if p.C[i] * costm * p.G[i] ** r.owned[i] <= h:
                return True
        return False

    # ----- prestige ----------------------------------------------------------------------------
    def level(self, L=None):
        L = self.L if L is None else L
        return (L / self.p.L0) ** self.p.expo

    def lt_med(self, t):
        if self.lt_median is not None:
            return self.lt_median
        if self.a.get("late_tide") and self.group is not None:
            return self.group_median(t)
        return None

    def gain_for(self, F, t):
        """The nuke's gain: the level delta x glass nodes, then Late Tide (x3 below half the median,
        capped so the bonus never carries the player past the median when late_tide_cap is on)."""
        base = (F - self.Fprev) * self.eff["glass"]
        med = self.lt_med(t)
        if med is not None and self.E < self.p.late_tide_below * med:
            boosted = base * self.p.late_tide
            if self.p.late_tide_cap:
                boosted = min(boosted, max(base, med - self.E))
            base = boosted
        return int(math.floor(base + 1e-9))

    def group_median(self, t):
        best = 0
        for (tt, e) in self.group:
            if tt <= t:
                best = e
            else:
                break
        return best

    def yield_now(self, t):
        F = math.floor(self.level() + 1e-9)
        return self.gain_for(F, t)

    def raw_yield(self):
        return self.level() - self.Fprev

    def want_nuke(self, t, at_checkin):
        y = self.yield_now(t)
        if self.E == 0:
            return y >= self.p.first_min
        if y < 1:
            return False
        rule = self.a["rule"]
        r = self.run
        if rule == "double":
            return y >= self.E
        if rule == "crown":
            if y >= self.E:
                return True
            mode = self.p.crown_mode
            if mode == "eager":
                # proposal: crown as soon as the nuke counts (>= 10% of glass ever) at a check-in
                return at_checkin and y >= self.p.crown_min_share * self.E
            if mode == "hybrid":
                # proposal: the canon rule, plus "the nuke counts and the run is a day old"
                if not at_checkin or y < self.p.crown_min_share * self.E:
                    return False
                if t - r.t0 >= self.p.crown_age:
                    return True
                return r.last_rate is not None and r.peak_rate > 0 and r.last_rate < self.p.crown_peak * r.peak_rate
            if mode == "average":
                if at_checkin and r.peak_avg > 0:
                    avg = self.raw_yield() / max(1.0, t - r.t0)
                    return avg < self.p.crown_peak * r.peak_avg and y >= self.p.crown_min_share * self.E
                return False
            if at_checkin and r.last_rate is not None and r.peak_rate > 0:
                return r.last_rate < self.p.crown_peak * r.peak_rate and y >= self.p.crown_min_share * self.E
            return False
        if rule == "optimal":
            if y < self.p.crown_min_share * self.E:
                return False
            if at_checkin and r.last_rate is not None:
                avg = self.raw_yield() / max(1.0, t - r.t0)
                return r.last_rate < avg
            return False
        return False

    def sample_rate(self, t):
        r = self.run
        y = self.raw_yield()
        if r.samples:
            t1, y1 = r.samples[-1]
            if t - t1 > 0:
                rate = (y - y1) / (t - t1)
                r.last_rate = rate
                r.peak_rate = max(r.peak_rate, rate)
        else:
            # first sample: rate since the run started
            if t - r.t0 > 60:
                rate = y / (t - r.t0)
                r.last_rate = rate
                r.peak_rate = max(r.peak_rate, rate)
        r.samples.append((t, y))
        if t - r.t0 > 60:
            r.peak_avg = max(r.peak_avg, y / (t - r.t0))

    def nuke(self, t):
        p = self.p
        r = self.run
        F = math.floor(self.level() + 1e-9)
        gain = self.gain_for(F, t)
        # combined power: income of this island's final state before vs after
        perm_before = self.perm_vector()
        base_rates = [r.owned[i] and p.R[i] * p.M[r.owned[i]] * p.mk_mult ** r.mk[i] for i in range(NL)]
        E_before = self.E
        self.Fprev = F
        self.E += gain
        self.H += gain
        self.nukes += 1
        if self.nukes == 1:
            self.scrap += p.first_nuke_scrap
            self.scrap_total += p.first_nuke_scrap
            self.magnet_next = t + self.a["magnet_period"]
        nodes = self.buy_nodes()
        self.update_tree()
        perm_after = self.perm_vector()
        num = sum(b * a for b, a in zip(base_rates, perm_after))
        den = sum(b * a for b, a in zip(base_rates, perm_before))
        power = num / den if den > 0 else 1.0
        rec = dict(index=r.index, t0=r.t0, t1=t, dur=t - r.t0, online=r.online, S=r.S, gain=gain,
                   E_before=E_before, E=self.E, L=self.L, power=power, nodes=nodes,
                   glow=self.glow(), morale=self.morale(), tree_lines=self.eff["lines"],
                   ranks=sum(self.ranks), era=r.max_era, tap_share=r.tap_inc / max(1e-300, r.S),
                   flot_share=r.flot_inc / max(1e-300, r.S), caught=r.caught,
                   purchase_times=r.purchase_times, max_idle=r.max_idle_streak, events=r.events,
                   lit=sum(self.ring_bought) + 1, window=self.window() / HOUR,
                   hands=sum(r.manned), owned=list(r.owned), first=dict(r.first),
                   trace=r.trace + [(t - r.t0, r.S)], scrap_total=self.scrap_total)
        self.runs.append(rec)
        self.new_run(t)
        return rec

    def buy_nodes(self):
        p = self.p
        bought = 0
        while True:
            best = None
            for rr in range(9):
                if self.nukes < p.ring_gates[rr]:
                    continue
                costs, cum = p.nodes[rr]
                k = self.ring_bought[rr]
                if k >= len(costs):
                    continue
                c = costs[k]
                if best is None or c < best[0]:
                    best = (c, rr)
            if best is None or best[0] > self.H:
                break
            self.H -= best[0]
            self.ring_bought[best[1]] += 1
            bought += 1
        return bought

    # ----- scrap, ranks, entries -----------------------------------------------------------------
    def meta_tick(self, t):
        a = self.a
        days = (t - self.t_first) / DAY
        # Logbook entries: about 40 on day 1, 100 by day 7, 150 by day 30, 220 by day 180
        e = min(self.p.entries_cap, a["entries_factor"] * self.p.entries_scale * 37 * math.log(1 + 2 * days))
        if self.nukes < self.p.logbook_from_nuke:
            e = 0
        self.entries = int(e)
        if self.nukes >= 1:
            while self.magnet_next is not None and t >= self.magnet_next:
                got = 1
                if self.rng.random() < self.p.magnet_rich:
                    got = self.rng.choice((2, 3))
                self.scrap += got
                self.scrap_total += got
                self.magnet_next += a["magnet_period"]
        # Logbook scrap: +1 per 25 entries
        lb = self.entries // 25
        if not hasattr(self, "lb_paid"):
            self.lb_paid = 0
        if lb > self.lb_paid:
            self.scrap += lb - self.lb_paid
            self.scrap_total += lb - self.lb_paid
            self.lb_paid = lb
        weeks = int(days // 7)
        if not hasattr(self, "fr_paid"):
            self.fr_paid = 0
        if self.nukes >= 1 and weeks > self.fr_paid:
            add = int(round((weeks - self.fr_paid) * a["freighter_per_week"] * self.p.freighter_scale))
            self.scrap += add
            self.scrap_total += add
            self.fr_paid = weeks
        self.spend_scrap()

    def spend_scrap(self):
        p = self.p
        while True:
            if self.a["rank_policy"] == "focus" and self.p.rank_rule != "spread":
                # the line earning most in the current run gets ranks first
                order = sorted(range(NL), key=lambda i: -self.out[i] if self.run else -i)
                order = [i for i in order if self.ranks[i] < 5] or []
                if self.run and max(self.out) <= 0:
                    order = [i for i in range(NL - 1, -1, -1) if self.ranks[i] < 5]
                choice = order[0] if order else None
            else:
                lvl = min(self.ranks)
                choice = None
                if lvl < 5:
                    for i in range(NL - 1, -1, -1):
                        if self.ranks[i] == lvl:
                            choice = i
                            break
            if choice is None:
                return
            cost = p.rank_costs[self.ranks[choice]]
            if self.scrap < cost:
                return
            self.scrap -= cost
            self.ranks[choice] += 1
            if self.run:
                self.recalc()

    # ----- time --------------------------------------------------------------------------------
    def settle_offline(self, t):
        if t <= self.last_t:
            return
        wend = self.last_cmd + self.window()
        end = min(t, wend)
        self.cur_t = t
        secs = end - self.last_t
        if secs > 0 and self.man > 0:
            self.add(self.man * self.eff["off_mult"] * secs, "line")
        self.last_t = t

    def begin_session(self, t, tps):
        r = self.run
        self.meta_tick(t)
        self.recalc()
        # Blowback crates (friends' nukes), claimed first while the bank is full
        if self.a["blowback"] == "friends":
            self.blow_waiting = min(self.p.blowback_max,
                                    self.blow_waiting + self.p.blowback_crates * self.friend_nukes)
            self.friend_nukes = 0
        elif self.a["blowback"]:
            if self.blow_last is None:
                self.blow_last = t
            if t - self.t_first >= DAY:
                self.blow_waiting = min(self.p.blowback_max,
                                        self.blow_waiting + (t - self.blow_last) / DAY * self.p.blowback_per_day)
            self.blow_last = t
        if self.a["blowback"]:
            while self.blow_waiting >= 1 and self.nukes >= 1:
                self.blow_waiting -= 1
                self.blowback_claimed = getattr(self, "blowback_claimed", 0) + 1
                pay = min(self.p.crate_held * r.held, self.p.crate_secs * self.man)
                self.add(max(self.p.crate_floor * self.man, pay), "flot")
        # Grit and Flare and Rush
        if self.nukes >= self.p.tool_gates["grit"] and t >= self.grit_ready and r.grit < self.p.grit[1]:
            r.grit += 1
            self.grit_ready = t + self.p.grit[2]
            self.recalc()
        self.sample_rate(t)
        if self.want_nuke(t, True):
            self.nuke(t)
        self.buy_loop(t, tps)
        if self.p.foreman and self.nukes >= 7:
            self.foreman_pass(t, tps)

    def foreman_pass(self, t, tps):
        """canon 7.5: Collect runs one greedy buy-max pass over lines (1-6 from nuke 7, all from 20)."""
        scope = 6 if self.nukes < 20 else NL
        r = self.run
        # proposal: the pass keeps the crowned (best-payback) purchase's price in reserve
        allc = self.candidates(self.a["duty"], tps)
        reserve = min(allc)[3] if (allc and self.p.foreman_reserve) else 0.0
        for _ in range(2000):
            cands = [c for c in self.candidates(self.a["duty"], tps)
                     if c[1] == "units" and c[2][0] < scope and c[3] <= r.held - reserve]
            if not cands:
                return
            best = min(cands)
            self.buy(best[1], best[2], best[3], t)

    def session(self, t, dur, tps):
        if self.a.get("bootstrap") and self.run is not None and self.man <= 0:
            tps = self.a["bootstrap"]  # the idler taps only until something runs by itself
        self.settle_offline(t)
        self.run.trace.append((t - self.run.t0, self.run.S))
        self.cur_purchases = 0
        self.begin_session(t, tps)
        p = self.p
        flare_on = self.nukes >= p.tool_gates["flare"] and tps > 0
        if flare_on and t >= self.flare_ready:
            self.run.flot_timer = 0
            self.flare_ready = t + p.flare_cd
        for s in range(int(dur)):
            self.step(t + s, tps)
            if s % 30 == 29:
                if self.want_nuke(t + s, False):
                    self.nuke(t + s + 1)
                    self.buy_loop(t + s + 1, tps)
        self.last_t = t + dur
        self.last_cmd = t + dur
        self.run.trace.append((t + dur - self.run.t0, self.run.S))
        self.checkins.append((t, self.cur_purchases, self.run.index))

    def step(self, t, tps):
        """One online second."""
        p = self.p
        r = self.run
        self.cur_t = t
        r.online += 1
        if self.no_buy:
            pass
        elif self.next_cost is None or r.held >= self.next_cost:
            self.buy_loop(t, tps)
        elif r.online % 20 == 0:
            self.buy_loop(t, tps)
        # affordability streak (N6)
        if r.index <= 10:
            if self.anything_affordable():
                r.idle_streak = 0
            else:
                r.idle_streak += 1
                r.max_idle_streak = max(r.max_idle_streak, r.idle_streak)
        # Rush from the Toolbelt
        if tps > 0 and self.nukes >= p.tool_gates["rush"] and t >= self.rush_ready:
            r.rush_until = t + p.rush[1]
            self.rush_ready = t + p.rush[2]
        rally = p.rally[0] * self.eff["flot_eff"] if t < r.rally_until else 1.0
        # lines
        line = self.man
        if tps > 0:
            if p.batch_rule == "literal":
                # canon 4.5 text: a 1-s batch credits min(count, floor((to - from) / t_i) + 1) cycles
                cnt = max(1, int(tps))
                for i in range(NL):
                    if self.out[i] > 0 and not r.manned[i]:
                        line += self.out[i] * self.cyc[i] * min(cnt, int(1.0 / self.cyc[i]) + 1)
            else:
                line += self.unm_fast
                for i in self.slow:
                    if t >= r.busy[i]:
                        line += self.out[i] * self.cyc[i]
                        r.busy[i] = t + self.cyc[i]
        line *= rally
        if t < r.drone_until and r.drone_line >= 0:
            extra = self.out[r.drone_line] * (p.drone[0] * self.eff["flot_eff"] - 1)
            if r.manned[r.drone_line] or tps > 0:
                line += extra * rally
        self.add(line, "line")
        burst = t < r.rally_until or t < r.drone_until or t < r.adren_until or t < r.rush_until
        tapv = 0.0
        if tps > 0:
            if getattr(r, "ag_pending", False):
                r.ag_start = t
                r.ag_pending = False
            r.hustle = min(p.hustle_cap, r.hustle + tps)
            r.idle = 0
            hm = 1.0 + (self.hmax - 1.0) * r.hustle / p.hustle_cap
            sps = (self.man + self.unm) * rally
            ag = 1.0
            if r.ag_start is not None:
                el = t - r.ag_start
                if el < 3600:
                    ag = 1.0 + (p.afterglow - 1.0) * 0.5 ** (el / p.afterglow_half)
                    if ag > 1.05:
                        burst = True
            buff = 1.0
            if t < r.adren_until:
                buff *= p.adren[0] * self.eff["flot_eff"]
            if t < r.rush_until:
                buff *= p.rush[0]
            tapv = (self.base_tap + self.p_eff * sps) * self.eff["tap"] * hm * self.crit * self.fellm * ag * buff
            self.add(tapv * tps, "tap")
        else:
            r.idle += 1
            if r.idle > p.hustle_hold:
                r.hustle = max(0.0, r.hustle - p.hustle_drain)
        if self.record_seconds:
            unm_part = max(0.0, line - self.man * rally) if tps > 0 else 0.0
            self.seconds.append((r.index, r.online, tapv * tps, line, burst, unm_part))
        # flotsam (online, the player catches it if tapping)
        if tps > 0 and not self.no_flot:
            r.flot_timer -= p.rain_flot if self.raining(t) else 1.0
            if r.flot_timer <= 0:
                self.flotsam(t)
                r.flot_timer = self.next_flot_gap()
        v = max(r.held, self.L)
        if v > self.max_number:
            self.max_number = v

    def flotsam(self, t):
        p = self.p
        r = self.run
        x = self.rng.random()
        acc = 0.0
        kind = p.flot[-1][0]
        for k, w in p.flot:
            acc += w
            if x < acc:
                kind = k
                break
        guaranteed = p.first_crate_secs is not None and self.nukes == 0 and r.index == 1 and r.caught == 0
        if guaranteed:
            kind = "crate"
        r.caught += 1
        fe = self.eff["flot_eff"]
        sps = self.man + self.unm
        if guaranteed:
            self.add(p.first_crate_secs * sps * fe, "flot")
        elif kind in ("crate", "bottle"):
            pay = min(p.crate_held * r.held, p.crate_secs * sps)
            self.add(max(p.crate_floor * sps, pay) * fe, "flot")
        elif kind == "fuel_drum":
            r.rally_until = t + p.rally[1]
        elif kind == "adrenaline":
            r.adren_until = t + p.adren[1]
        elif kind == "drowned_drone":
            owned = [i for i in range(NL) if r.owned[i] > 0]
            if owned:
                r.drone_line = self.rng.choice(owned)
                r.drone_until = t + p.drone[1]
        elif kind == "sealed_locker":
            self.scrap += 1
            self.scrap_total += 1
            self.locker_scrap += 1
        if "first_flotsam" not in r.first:
            r.first["first_flotsam"] = r.online

    def raining(self, t):
        if self.force_rain is not None:
            return self.force_rain
        if self.p.rain_share <= 0:
            return False
        b = int(t // 1800)
        if b != self._wblock:
            self._wblock = b
            self._wrain = random.Random(b * 1000003 + self.p.weather_seed).random() < self.p.rain_share
        return self._wrain

    # ----- the whole life ----------------------------------------------------------------------
    def play(self, days, snapshot_days=(), hooks=None):
        a = self.a
        sched = []
        for d in range(a["start_day"], days):
            for (off, dur) in a["sessions"]:
                sched.append((d * DAY + off, dur))
        if not sched:
            return self
        self.t_first = sched[0][0]
        self.last_t = sched[0][0]
        self.last_cmd = sched[0][0]
        self.new_run(sched[0][0])
        next_snap = 0
        snaps = sorted(snapshot_days)
        for (t, dur) in sched:
            while next_snap < len(snaps) and t >= snaps[next_snap] * DAY:
                self.snapshot(snaps[next_snap] * DAY)
                next_snap += 1
            if hooks and "before_session" in hooks:
                hooks["before_session"](self, t)
            self.session(t, dur, a["tps"])
        end = days * DAY
        self.settle_offline(end)
        while next_snap < len(snaps) and snaps[next_snap] <= days:
            self.snapshot(snaps[next_snap] * DAY)
            next_snap += 1
        return self

    def snapshot(self, t):
        self.daily.append(dict(t=t, day=t / DAY, E=self.E, nukes=self.nukes, L=self.L,
                               lit=sum(self.ring_bought) + 1, scrap=self.scrap_total,
                               ranks=list(self.ranks), glow=self.glow(), morale=self.morale(),
                               tree_lines=self.eff["lines"], window=self.window() / HOUR))


def fmt(x):
    if x is None:
        return "-"
    if isinstance(x, int) and abs(x) < 10000:
        return str(x)
    if x == 0:
        return "0"
    ax = abs(x)
    sfx = ["", "k", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"]
    e = int(math.floor(math.log10(ax) / 3)) if ax >= 1 else 0
    if e < len(sfx) and e >= 0:
        v = x / 10 ** (3 * e)
        s = ("%.3g" % v)
        return s + sfx[e]
    return "%.2e" % x


def hms(s):
    s = int(round(s))
    if s < 3600:
        return "%d:%02d" % (s // 60, s % 60)
    if s < 2 * DAY:
        return "%dh%02d" % (s // 3600, (s % 3600) // 60)
    return "%.1fd" % (s / DAY)

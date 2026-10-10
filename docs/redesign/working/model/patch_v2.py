"""One-off patch: adds the canon v2 switches (resolutions.md) to wipe_model.py.

The defaults keep the P1 behaviour, so the P1 report stays reproducible. Run once:
python -I patch_v2.py
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, "wipe_model.py")
src = open(PATH, encoding="utf-8").read()


def rep(old, new, count=1):
    global src
    n = src.count(old)
    assert n == count, (old[:70], n)
    src = src.replace(old, new)


rep('MULT_KEYS = ("lines", "tap", "p_mult", "cost", "flot_freq", "flot_eff", "off_mult", "glass")',
    'MULT_KEYS = ("lines", "tap", "p_mult", "cost", "flot_freq", "flot_eff", "off_mult", "glass",\n'
    '             "shelf_cost", "era_cost")')

rep('''        self.rank_rule = None  # None: the archetype's policy; "spread": ranks rise together (proposal)
''', '''        self.rank_rule = None  # None: the archetype's policy; "spread": ranks rise together (proposal)
        # Canon v2 (resolutions.md); the defaults reproduce the P1 report
        self.crate_floor = 0.0          # v2 60: crates pay at least 1 min of output (flotsam and Blowback)
        self.first_crate_secs = None    # v2 600: run 1's guaranteed 3:00 flotsam is a crate paying a flat 10 min
        self.afterglow_from = "rebuild"  # v2 "first_tap": Afterglow counts from the run's first tap
        self.rain_share = 0.0           # v2 0.2: rain in 20% of 30-minute blocks (island.json5)
        self.rain_flot = 1.5            # rain makes flotsam 1.5x as often
        self.weather_seed = 4242
        self.late_tide_cap = False      # v2 True: the bonus never carries a player past the median
        self.blowback_crates = 3        # per friend's Wipe Day (group mode), at most blowback_max waiting
''')

rep('''            for k in MULT_KEYS:
                eff[k] *= b[k] ** f
            for k in ADD_KEYS:
                eff[k] += b[k] * f''', '''            for k in MULT_KEYS:
                eff[k] *= b.get(k, 1.0) ** f
            for k in ADD_KEYS:
                eff[k] += b.get(k, 0.0) * f''')

rep('''        self.cur_t = 0.0

    # ----- meta derived values''', '''        self.cur_t = 0.0
        self.lt_median = None  # group mode: median glass ever of the OTHER active players
        self.friend_nukes = 0  # group mode: friends' counted Wipe Days since the last check-in
        self.force_rain = None  # N9 measurement: True / False forces the weather
        self._wblock = None
        self._wrain = False

    # ----- meta derived values''')

rep('''        if "kit2" in self.auto:
            for i in range(3):
                r.owned[i] = max(r.owned[i], 25)
        r.max_era = r.era
        if self.nukes >= 1:
            r.ag_start = t''', '''        if "kit2" in self.auto:
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
                r.ag_start = t''')

rep('''        # era
        if r.era < 4 and (r.era < 3 or self.nukes >= p.armored_nukes):
            consider("era", r.era + 1, p.era_costs[r.era], tot_eff * (p.era_mult - 1) * 1.5 + 1e-12)
        # grip
        if r.grip < len(p.grip_costs) and tps > 0:
            dv = (self.base_tap + p.grip_p * self.eff["p_mult"] * sps_all) * self.eff["tap"] \\
                * self.hmax * self.crit * self.fellm * tps * d
            consider("grip", r.grip + 1, p.grip_costs[r.grip], dv)
        # island
        if r.island < len(p.island_costs):
            consider("island", r.island + 1, p.island_costs[r.island], tot_eff * (p.island_mult - 1))''',
    '''        shm = self.eff["shelf_cost"]
        erm = self.eff["era_cost"]
        # era
        if r.era < 4 and (r.era < 3 or self.nukes >= p.armored_nukes):
            consider("era", r.era + 1, p.era_costs[r.era] * erm, tot_eff * (p.era_mult - 1) * 1.5 + 1e-12)
        # grip
        if r.grip < len(p.grip_costs) and tps > 0:
            dv = (self.base_tap + p.grip_p * self.eff["p_mult"] * sps_all) * self.eff["tap"] \\
                * self.hmax * self.crit * self.fellm * tps * d
            consider("grip", r.grip + 1, p.grip_costs[r.grip] * shm, dv)
        # island
        if r.island < len(p.island_costs):
            consider("island", r.island + 1, p.island_costs[r.island] * shm, tot_eff * (p.island_mult - 1))''')
rep('''                consider("mk", i, p.C[i] * p.mk_factors[r.mk[i]], self.out[i] * (p.mk_mult - 1) * w)''',
    '''                consider("mk", i, p.C[i] * p.mk_factors[r.mk[i]] * shm, self.out[i] * (p.mk_mult - 1) * w)''')
rep('''        if r.era < 4 and (r.era < 3 or self.nukes >= p.armored_nukes) and p.era_costs[r.era] <= h:
            return True
        if r.grip < len(p.grip_costs) and p.grip_costs[r.grip] <= h:
            return True
        if r.island < len(p.island_costs) and p.island_costs[r.island] <= h:
            return True''', '''        shm = self.eff["shelf_cost"]
        if r.era < 4 and (r.era < 3 or self.nukes >= p.armored_nukes) and p.era_costs[r.era] * self.eff["era_cost"] <= h:
            return True
        if r.grip < len(p.grip_costs) and p.grip_costs[r.grip] * shm <= h:
            return True
        if r.island < len(p.island_costs) and p.island_costs[r.island] * shm <= h:
            return True''')

rep('''    def glass_mult(self, t):
        m = self.eff["glass"]
        if self.a.get("late_tide") and self.group is not None:
            med = self.group_median(t)
            if self.E < self.p.late_tide_below * med:
                m *= self.p.late_tide
        return m
''', '''    def lt_med(self, t):
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
''')
rep('''        F = math.floor(self.level() + 1e-9)
        return int(math.floor((F - self.Fprev) * self.glass_mult(t)))''',
    '''        F = math.floor(self.level() + 1e-9)
        return self.gain_for(F, t)''')
rep('''        F = math.floor(self.level() + 1e-9)
        gain = int(math.floor((F - self.Fprev) * self.glass_mult(t)))''',
    '''        F = math.floor(self.level() + 1e-9)
        gain = self.gain_for(F, t)''')

rep('''        if self.a["blowback"]:
            if self.blow_last is None:
                self.blow_last = t
            if t - self.t_first >= DAY:
                self.blow_waiting = min(self.p.blowback_max,
                                        self.blow_waiting + (t - self.blow_last) / DAY * self.p.blowback_per_day)
            self.blow_last = t
            while self.blow_waiting >= 1 and self.nukes >= 1:
                self.blow_waiting -= 1
                self.add(min(self.p.crate_held * r.held, self.p.crate_secs * self.man), "flot")''',
    '''        if self.a["blowback"] == "friends":
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
                self.add(max(self.p.crate_floor * self.man, pay), "flot")''')

rep('''        if tps > 0:
            r.hustle = min(p.hustle_cap, r.hustle + tps)''', '''        if tps > 0:
            if getattr(r, "ag_pending", False):
                r.ag_start = t
                r.ag_pending = False
            r.hustle = min(p.hustle_cap, r.hustle + tps)''')
rep('''            r.flot_timer -= 1
            if r.flot_timer <= 0:''', '''            r.flot_timer -= p.rain_flot if self.raining(t) else 1.0
            if r.flot_timer <= 0:''')

rep('''        r.caught += 1
        fe = self.eff["flot_eff"]
        sps = self.man + self.unm
        if kind in ("crate", "bottle"):
            self.add(min(p.crate_held * r.held, p.crate_secs * sps) * fe, "flot")''',
    '''        guaranteed = p.first_crate_secs is not None and self.nukes == 0 and r.index == 1 and r.caught == 0
        if guaranteed:
            kind = "crate"
        r.caught += 1
        fe = self.eff["flot_eff"]
        sps = self.man + self.unm
        if guaranteed:
            self.add(p.first_crate_secs * sps * fe, "flot")
        elif kind in ("crate", "bottle"):
            pay = min(p.crate_held * r.held, p.crate_secs * sps)
            self.add(max(p.crate_floor * sps, pay) * fe, "flot")''')

rep('''    # ----- the whole life ----------------------------------------------------------------------''',
    '''    def raining(self, t):
        if self.force_rain is not None:
            return self.force_rain
        if self.p.rain_share <= 0:
            return False
        b = int(t // 1800)
        if b != self._wblock:
            self._wblock = b
            self._wrain = random.Random(b * 1000003 + self.p.weather_seed).random() < self.p.rain_share
        return self._wrain

    # ----- the whole life ----------------------------------------------------------------------''')

open(PATH, "w", encoding="utf-8", newline="").write(src)
print("patched")

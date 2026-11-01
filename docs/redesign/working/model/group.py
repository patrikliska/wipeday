"""Lockstep group simulation (plan 10-balance.md 7.1): friends play on one clock.

Before each check-in a player reads the World inputs, as the server's settle copies them into meta:
- Late Tide: the median glass ever of the OTHER players active in the last 14 days (resolution 1.8);
  x3 below half of it, capped so the bonus never carries the player past it;
- Blowback: 3 crates for every counted Wipe Day a friend pressed since the last check-in, at most 9
  waiting (canon 8.2), each paying max(1 min of output, min(15% of held, 10 min of output)).

Sessions are processed in time order; a nuke inside a session is seen by friends at their next
check-in.
"""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from wipe_model import *


def median(xs):
    xs = sorted(xs)
    n = len(xs)
    if n == 0:
        return None
    return xs[n // 2] if n % 2 else 0.5 * (xs[n // 2 - 1] + xs[n // 2])


def play_group(over, members, days, seed=11, late_tide=True, blowback=True):
    """members: list of (label, archetype name, archetype overrides). Returns {label: Player}."""
    p = Params(**over)
    pls = []
    for k, (label, name, aover) in enumerate(members):
        a = archetype(name, **aover)
        a["late_tide"] = False  # the group driver supplies the median instead
        if blowback and a["blowback"]:
            a["blowback"] = "friends"
        elif not blowback:
            a["blowback"] = False
        pl = Player(p, a, seed=seed + 101 * k)
        pl.label = label
        pls.append(pl)
    n = len(pls)
    events = []
    for k, pl in enumerate(pls):
        for d in range(pl.a["start_day"], days):
            for (off, dur) in pl.a["sessions"]:
                events.append((d * DAY + off, k, dur))
    events.sort()
    started = [False] * n
    last_seen = [None] * n
    cursor = [None] * n
    nuke_log = []  # (time, player) of counted Wipe Days
    snap_next = [1] * n
    for (t, k, dur) in events:
        for j, q in enumerate(pls):
            while snap_next[j] <= days and snap_next[j] * DAY <= t:
                if started[j]:
                    q.snapshot(snap_next[j] * DAY)
                    if snap_next[j] in (30, 180):
                        setattr(q, "bb%d" % snap_next[j], getattr(q, "blowback_claimed", 0))
                snap_next[j] += 1
        pl = pls[k]
        if not started[k]:
            pl.t_first = t
            pl.last_t = t
            pl.last_cmd = t
            pl.new_run(t)
            started[k] = True
            cursor[k] = t
        if late_tide:
            others = [pls[j].E for j in range(n)
                      if j != k and started[j] and last_seen[j] is not None and t - last_seen[j] <= 14 * DAY]
            pl.lt_median = median(others) if others else None
        else:
            pl.lt_median = None
        pl.friend_nukes = sum(1 for (tn, j) in nuke_log if j != k and cursor[k] < tn <= t)
        cursor[k] = t
        before = len(pl.runs)
        pl.session(t, dur, pl.a["tps"])
        for rec in pl.runs[before:]:
            if rec["E_before"] == 0 or rec["gain"] >= 0.1 * rec["E_before"]:
                nuke_log.append((rec["t1"], k))
        last_seen[k] = t
    end = days * DAY
    for j, q in enumerate(pls):
        if started[j]:
            q.settle_offline(end)
            while snap_next[j] <= days:
                q.snapshot(snap_next[j] * DAY)
                snap_next[j] += 1
    return {q.label: q for q in pls}


def w_group(args):
    over, members, days, seed, lt, bb = args
    return play_group(over, members, days, seed=seed, late_tide=lt, blowback=bb)


G5 = [("idler", "idler", {}), ("casual", "casual", {}), ("active", "active", {}),
      ("optimal", "optimal", {}), ("late", "late", {})]

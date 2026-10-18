"""python -I seed.py: the approved Scene Mock's sprites into the game's art folder (D190, D203).

The mock (docs/redesign/art/mock-scene/img) was approved on 2026-10-18; these of its pieces are
used as they are, cleaned onto the palette by clean.py. Re-run after the palette changes. (The
shelter and the survivor were replaced by smaller generated ones in S2: picks/s2.json; the ground
and earth tiles by the painted ground, scene/ground.ts, D208.)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from clean import ROOT, clean, load_palette  # noqa: E402

MOCK = os.path.join(ROOT, "docs", "redesign", "art", "mock-scene", "img")
ART = os.path.join(ROOT, "packages", "content", "art", "scene")

# mock file -> game key, keep the canvas (tiles and sheets)
SEED = [
    ("sea.png", "terrain/sea", True),
    ("far.png", "terrain/far", True),
    ("clouds.png", "terrain/clouds", True),
    ("rock.png", "prop/rock", False),
    ("car.png", "prop/car", False),
    ("barrel.png", "prop/barrel", False),
    ("lamp.png", "prop/lamp", False),
    ("flotsam.png", "flotsam/crate", False),
]


def main():
    palette = load_palette()
    for name, key, keep in SEED:
        out = os.path.join(ART, key + ".png")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        size, notes = clean(os.path.join(MOCK, name), out, palette, keep_size=keep)
        print(f"{key:24} {size[0]}x{size[1]}  {'; '.join(notes)}")


if __name__ == "__main__":
    main()

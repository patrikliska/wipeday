"""python -I install.py <picks.json>: the chosen takes into the game's art folder.

`picks.json` maps a game key (`line/campfire_2`) to a generated file (`preview/art/s2/campfire_2_0.png`)
or to {"from": file, "sheet": true} for sprite sheets (the canvas is kept), with "outline": true
for a 1-px dark outline (the line sprites: low-res takes have none and vanish on sand). Each is cleaned onto
the grid and the palette (clean.py) and written to packages/content/art/scene/<key>.png. The
picks file is the record of what was chosen; `preview/` is not kept, the installed art is.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from clean import ROOT, clean, load_palette  # noqa: E402

ART = os.path.join(ROOT, "packages", "content", "art", "scene")


def main():
    with open(sys.argv[1], encoding="utf-8") as f:
        picks = json.load(f)
    palette = load_palette()
    for key, pick in picks.items():
        if key.startswith("//"):
            continue
        src = pick["from"] if isinstance(pick, dict) else pick
        sheet = isinstance(pick, dict) and pick.get("sheet", False)
        edge = isinstance(pick, dict) and pick.get("outline", False)
        out = os.path.join(ART, key + ".png")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        size, notes = clean(os.path.join(ROOT, src), out, palette, keep_size=sheet, edge=edge)
        print(f"{key:24} {size[0]}x{size[1]}  {'; '.join(notes)}")


if __name__ == "__main__":
    main()

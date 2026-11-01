"""python -I chips.py: the hand-pixelled chips and the stockpile's pallet (R2 Feel S3, D217).

Every tap chips a piece off the era's target onto the stockpile (docs/redesign/12-feel.md 3.1):
a log, a stone, an ore nugget, a sulfur lump, a hull plate. They are a few pixels each, drawn
here by hand in the palette's colours (too small for a generator to help), outlined like the
line sprites, and written to packages/content/art/scene/chip/<target>.png and prop/pallet.png.
"""
import json
import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ART = os.path.join(ROOT, "packages", "content", "art", "scene")

# Each sprite: rows of characters, "." clear, every other character a palette colour.
SPRITES = {
    # A log lying sideways: brown bark, its fresh cut end bright on the right (brighter than the
    # dead tree's grey, so the pile reads against it).
    "chip/tree": (
        [
            ".KKKKK.",
            "KLLLKEK",
            "KMMMKCK",
            "KDDDKEK",
            ".KKKKK.",
        ],
        {"L": "#a35f4d", "M": "#816252", "D": "#513e2f", "E": "#e2b27c", "C": "#ab7e5a"},
    ),
    # A grey stone, lit from the top left.
    "chip/stone": (
        [
            "..KKK.",
            ".KLLMK",
            "KLLMMK",
            "KMMDDK",
            ".KKKK.",
        ],
        {"L": "#acb5b4", "M": "#9aa0a6", "D": "#4a5560"},
    ),
    # A dark nugget with a rusty vein and one bright fleck.
    "chip/ore": (
        [
            "..KKK.",
            ".KMHMK",
            "KMOODK",
            "KMMODK",
            ".KKKK.",
        ],
        {"M": "#584d44", "O": "#a35f4d", "H": "#d6a26a", "D": "#10303a"},
    ),
    # A pale yellow lump of sulfur.
    "chip/sulfur": (
        [
            "..KK..",
            ".KLMK.",
            "KLMMCK",
            "KMCCCK",
            ".KKKK.",
        ],
        {"L": "#fdf6c1", "M": "#f5cf81", "C": "#e2b27c"},
    ),
    # A torn hull plate with a rust stain.
    "chip/wreck": (
        [
            ".KKKKKK",
            "KLLLLMK",
            "KMRMMDK",
            "KKKKKK.",
        ],
        {"L": "#acb5b4", "M": "#717061", "D": "#4a5560", "R": "#76332d"},
    ),
    # The stockpile's pallet, side on: one deck board on three blocks.
    "prop/pallet": (
        [
            "KKKKKKKKKKKKKKK",
            "KPPPPPPPPPPPPPK",
            "KKKKKKKKKKKKKKK",
            "KBK...KBK...KBK",
            "KKK...KKK...KKK",
        ],
        {"P": "#ab7e5a", "B": "#6e5640"},
    ),
}

OUTLINE = "#030201"


def rgb(hex_colour):
    return tuple(int(hex_colour[i : i + 2], 16) for i in (1, 3, 5))


def main():
    with open(os.path.join(ROOT, "packages", "content", "art", "palette.json"), encoding="utf-8") as f:
        palette = {c.lower() for c in json.load(f)}
    for key, (rows, colours) in SPRITES.items():
        colours = {"K": OUTLINE, **colours}
        for c in colours.values():
            assert c.lower() in palette, f"{key}: {c} is not in the palette"
        width = len(rows[0])
        assert all(len(row) == width for row in rows), f"{key}: ragged rows"
        image = Image.new("RGBA", (width, len(rows)), (0, 0, 0, 0))
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != ".":
                    image.putpixel((x, y), (*rgb(colours[ch]), 255))
        out = os.path.join(ART, key + ".png")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        image.save(out)
        print(f"{key:14} {width}x{len(rows)}")


if __name__ == "__main__":
    main()

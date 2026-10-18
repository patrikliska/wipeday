"""python -I plain.py: the ground tile without its grass ends (terrain/ground_plain, D203).

The mock's ground tile has tall grass at both ends; on the terraced island it repeats behind
every line and clutters the rows. Its middle (columns 36-124) has none, so that middle and its
mirror image make a seamless 176-px tile of sand and dirt; below the sand band, any pixel not
in the dirt's own colours (the blades growing from it) becomes dirt.
"""
import os
from PIL import Image, ImageOps

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "packages", "content", "art", "scene", "terrain", "ground.png")
OUT = os.path.join(ROOT, "packages", "content", "art", "scene", "terrain", "ground_plain.png")
MIDDLE = (36, 124)
# The dirt's own colours (its base, specks and shadows), from row 40 down; the blades share the
# pebbles' tan, so the pebbles go too.
DIRT_FROM = 40
DIRT_BASE = (0x50, 0x2F, 0x30)
DIRT = {
    DIRT_BASE,
    (0x2F, 0x18, 0x22),
    (0x40, 0x24, 0x37),
    (0x15, 0x0C, 0x19),
    (0x08, 0x06, 0x0E),
    (0x40, 0x37, 0x2F),
    (0x38, 0x2C, 0x23),
}


def main():
    im = Image.open(SRC).convert("RGBA")
    middle = im.crop((MIDDLE[0], 0, MIDDLE[1], im.height))
    out = Image.new("RGBA", (middle.width * 2, im.height), (0, 0, 0, 0))
    out.paste(middle, (0, 0))
    out.paste(ImageOps.mirror(middle), (middle.width, 0))
    # Below the sand band only dirt: the grass blades growing from the dirt become dirt.
    px = out.load()
    for y in range(DIRT_FROM, out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a and (r, g, b) not in DIRT:
                px[x, y] = (*DIRT_BASE, 255)
    out.save(OUT)
    print(OUT, out.size)


if __name__ == "__main__":
    main()

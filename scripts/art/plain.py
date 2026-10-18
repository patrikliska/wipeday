"""python -I plain.py: the ground tile without its grass ends (terrain/ground_plain, D203).

The mock's ground tile has tall grass at both ends; on the terraced island it repeats behind
every line and clutters the rows. Its middle (columns 36-124) has none, so that middle and its
mirror image make a seamless 176-px tile of sand and dirt.
"""
import os
from PIL import Image, ImageOps

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "packages", "content", "art", "scene", "terrain", "ground.png")
OUT = os.path.join(ROOT, "packages", "content", "art", "scene", "terrain", "ground_plain.png")
MIDDLE = (36, 124)


def main():
    im = Image.open(SRC).convert("RGBA")
    middle = im.crop((MIDDLE[0], 0, MIDDLE[1], im.height))
    out = Image.new("RGBA", (middle.width * 2, im.height), (0, 0, 0, 0))
    out.paste(middle, (0, 0))
    out.paste(ImageOps.mirror(middle), (middle.width, 0))
    out.save(OUT)
    print(OUT, out.size)


if __name__ == "__main__":
    main()

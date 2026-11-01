"""python -I palette.py: the scene's palette (D188, D191), extracted from the approved Scene Mock.

Every opaque pixel of the mock's sprites (docs/redesign/art/mock-scene/img, the contact sheet
left out) is reduced by median cut to the colours left after the fixed ones (the five era
colours, fire, the warning red, the sea depths and the far ridge), which are added: at most 48
in all. Writes

  packages/content/art/palette.json   the colours, hex, darkest first (the source of truth)
  packages/content/art/palette.png    one pixel per colour in a row (Retro Diffusion's input_palette)
  preview/art/palette.png             a swatch to look at

Re-running it gives the same palette for the same mock.
"""
import json
import os
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MOCK = os.path.join(ROOT, "docs", "redesign", "art", "mock-scene", "img")
OUT = os.path.join(ROOT, "packages", "content", "art")
PREVIEW = os.path.join(ROOT, "preview", "art")
# Kept as they are: the five era colours (CLAUDE.md 6.2; tokens.css --tier-*), fire and the
# warning red (ICON_ACCENTS), and the mock's sea depths and far ridge (CSS there, not sprites).
ERAS = [
    "#c2a868", "#b07840", "#9aa0a6", "#6c97bc", "#45c2c0",
    "#ff6f3c", "#d8262b",
    "#1d565e", "#10303a", "#4a5560",
]
TOTAL = 48


def hex_of(rgb):
    return "#%02x%02x%02x" % tuple(rgb)


MERGE = 14


def dist(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def rgb_of(text):
    return tuple(int(text[i : i + 2], 16) for i in (1, 3, 5))


def main():
    pixels = []
    for name in sorted(os.listdir(MOCK)):
        if not name.endswith(".png") or name.startswith("sheet"):
            continue
        im = Image.open(os.path.join(MOCK, name)).convert("RGBA")
        pixels.extend(px[:3] for px in im.getdata() if px[3] > 200)
    strip = Image.new("RGB", (len(pixels), 1))
    strip.putdata(pixels)
    # Median cut gives several near-identical outline blacks; merge colours closer than MERGE
    # (to the eras too) and ask for more until the distinct ones fill the palette.
    want = TOTAL - len(ERAS)
    colours = []
    for n in range(want, 256):
        reduced = strip.quantize(colors=n, method=Image.Quantize.MEDIANCUT)
        flat = reduced.getpalette()[: n * 3]
        kept = [rgb_of(h) for h in ERAS]
        for i in range(0, len(flat), 3):
            c = tuple(flat[i : i + 3])
            if all(dist(c, k) >= MERGE for k in kept):
                kept.append(c)
        if len(kept) > TOTAL:
            break
        colours = [hex_of(c) for c in kept]
        if len(kept) == TOTAL:
            break
    lum = lambda h: sum(c * w for c, w in zip(rgb_of(h), (0.299, 0.587, 0.114)))
    ordered = sorted(colours, key=lum)
    assert len(ordered) <= TOTAL, len(ordered)

    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "palette.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(ordered, f, indent=2)
        f.write("\n")
    row = Image.new("RGB", (len(ordered), 1))
    row.putdata([rgb_of(h) for h in ordered])
    row.save(os.path.join(OUT, "palette.png"))

    os.makedirs(PREVIEW, exist_ok=True)
    cell, cols = 40, 8
    sheet = Image.new("RGB", (cols * cell, -(-len(ordered) // cols) * (cell + 14)), (30, 28, 24))
    draw = ImageDraw.Draw(sheet)
    for i, h in enumerate(ordered):
        x, y = (i % cols) * cell, (i // cols) * (cell + 14)
        draw.rectangle([x + 2, y + 2, x + cell - 3, y + cell - 3], fill=rgb_of(h))
        draw.text((x + 2, y + cell), h, fill=(220, 220, 220))
    sheet.save(os.path.join(PREVIEW, "palette.png"))
    print(len(ordered), "colours ->", os.path.join(OUT, "palette.json"))


if __name__ == "__main__":
    main()

"""python -I clean.py <in.png|dir> <out.png|dir> [--keep-size] [--no-trim]

Snaps generated art to the scene's grid and palette (D188, `12-feel.md` 2.2):

1. a background knock-out when the image has no alpha: a flood fill from the edges over
   near-white (or the corner's colour), so a model that ignored `remove_bg` still works;
2. pixel pitch detection: an image upscaled by k (every run of equal pixels a multiple of k) is
   downsampled to its true grid, nearest-neighbour;
3. alpha snapped to 0 or 255 (pixel art has no soft edges);
4. every colour moved to the nearest palette colour (`packages/content/art/palette.json`);
5. lone pixels (no opaque neighbour) removed;
6. the transparent border trimmed (unless --no-trim; --keep-size keeps the canvas and skips
   the knock-out, for tiles and sprite sheets).

Reports what it did per file. Pure Pillow.
"""
import json
import os
import sys
from collections import deque
from math import gcd

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PALETTE_FILE = os.path.join(ROOT, "packages", "content", "art", "palette.json")


def load_palette():
    with open(PALETTE_FILE, encoding="utf-8") as f:
        return [tuple(int(h[i : i + 2], 16) for i in (1, 3, 5)) for h in json.load(f)]


def knock_out(im):
    """Flood-fills the background from the edges when the image is fully opaque."""
    if im.getextrema()[3][0] < 255:
        return im, False
    w, h = im.size
    px = im.load()
    seed = px[0, 0][:3]
    near = lambda c: sum((a - b) ** 2 for a, b in zip(c[:3], seed)) < 40**2
    seen = bytearray(w * h)
    queue = deque()
    for x in range(w):
        queue.extend([(x, 0), (x, h - 1)])
    for y in range(h):
        queue.extend([(0, y), (w - 1, y)])
    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
            continue
        seen[y * w + x] = 1
        if not near(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return im, True


def pitch(im):
    """The upscale factor k: the gcd of every run length of equal pixels along rows and columns."""
    w, h = im.size
    px = im.load()
    g = 0
    for y in range(0, h, max(1, h // 24)):
        run = 1
        for x in range(1, w):
            if px[x, y] == px[x - 1, y]:
                run += 1
            else:
                g = gcd(g, run)
                run = 1
                if g == 1:
                    return 1
    for x in range(0, w, max(1, w // 24)):
        run = 1
        for y in range(1, h):
            if px[x, y] == px[x, y - 1]:
                run += 1
            else:
                g = gcd(g, run)
                run = 1
                if g == 1:
                    return 1
    return max(1, g)


def nearest(c, palette, memo):
    hit = memo.get(c)
    if hit is None:
        hit = min(palette, key=lambda p: (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)
        memo[c] = hit
    return hit


def despeckle(im):
    """Removes opaque pixels with no opaque neighbour (the background remover's crumbs)."""
    w, h = im.size
    px = im.load()
    alone = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0:
                continue
            if not any(
                0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] > 0
                for dx in (-1, 0, 1)
                for dy in (-1, 0, 1)
                if dx or dy
            ):
                alone.append((x, y))
    for x, y in alone:
        px[x, y] = (0, 0, 0, 0)
    return len(alone)


OUTLINE = (0x1E, 0x1D, 0x25)


def outline(im):
    """A 1-px dark outline round the sprite (on a canvas 2 px larger), so it reads on sand."""
    w, h = im.size
    out = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    out.alpha_composite(im, (1, 1))
    src = out.copy().load()
    px = out.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if src[x, y][3]:
                continue
            if any(
                0 <= x + dx < w + 2 and 0 <= y + dy < h + 2 and src[x + dx, y + dy][3]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            ):
                px[x, y] = (*OUTLINE, 255)
    return out


def clean(src, dst, palette, keep_size=False, trim=True, edge=False):
    im = Image.open(src).convert("RGBA")
    notes = []
    # Tiles and sheets (--keep-size) are opaque or already cut out: never knocked out.
    im, knocked = (im, False) if keep_size else knock_out(im)
    if knocked:
        notes.append("background knocked out")
    k = pitch(im)
    if k > 1:
        im = im.resize((im.width // k, im.height // k), Image.NEAREST)
        notes.append(f"downsampled /{k}")
    memo = {}
    out = []
    moved = 0
    for r, g, b, a in im.getdata():
        if a < 128:
            out.append((0, 0, 0, 0))
            continue
        p = nearest((r, g, b), palette, memo)
        moved += p != (r, g, b)
        out.append((*p, 255))
    im.putdata(out)
    lone = despeckle(im)
    if lone:
        notes.append(f"{lone} stray px removed")
    if trim and not keep_size:
        box = im.getbbox()
        if box:
            im = im.crop(box)
    if edge:
        im = outline(im)
        notes.append("outlined")
    im.save(dst)
    notes.append(f"{moved} px moved to the palette")
    return im.size, notes


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    keep = "--keep-size" in sys.argv
    trim = "--no-trim" not in sys.argv
    src, dst = args
    palette = load_palette()
    pairs = []
    if os.path.isdir(src):
        os.makedirs(dst, exist_ok=True)
        for name in sorted(os.listdir(src)):
            if name.endswith(".png"):
                pairs.append((os.path.join(src, name), os.path.join(dst, name)))
    else:
        os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
        pairs.append((src, dst))
    for a, b in pairs:
        size, notes = clean(a, b, palette, keep, trim)
        print(f"{os.path.basename(b):28} {size[0]}x{size[1]}  {'; '.join(notes)}")


if __name__ == "__main__":
    main()

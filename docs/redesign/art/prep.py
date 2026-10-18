"""python -I prep.py <in dir> <out dir>: cut usable layers out of the generated environment images."""
import sys, os
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
L = lambda n: Image.open(os.path.join(src, n)).convert('RGBA')

def flood_knockout(im, tol=48, seeds=None):
    """Make every pixel reachable from the top edge (within colour tolerance of its seed) transparent."""
    px = im.load(); w, h = im.size
    seen = set(); stack = []
    for x in range(w):
        stack.append((x, 0, px[x, 0]))
    while stack:
        x, y, ref = stack.pop()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h): continue
        c = px[x, y]
        if sum(abs(c[i] - ref[i]) for i in range(3)) > tol: continue
        seen.add((x, y)); px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            stack.append((x + dx, y + dy, c))
    return im

def fade(im, left=0, right=0, bottom=0, top=0):
    px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            a = px[x, y][3]
            f = 1.0
            if left and x < left: f = min(f, x / left)
            if right and x >= w - right: f = min(f, (w - 1 - x) / right)
            if bottom and y >= h - bottom: f = min(f, (h - 1 - y) / bottom)
            if top and y < top: f = min(f, y / top)
            # pixel art: hard steps, not smooth alpha
            a2 = 0 if f < 0.34 else (int(a * 0.5) if f < 0.67 else a)
            r, g, b, _ = px[x, y]; px[x, y] = (r, g, b, a2)
    return im

# ground: knock the sky out from the top edge
g = flood_knockout(L('ground_0.png'), tol=60)
g.save(os.path.join(out, 'ground.png'))
# first fully-opaque row per column tells where the sand starts
px = g.load(); tops = []
for x in range(g.width):
    for y in range(g.height):
        if px[x, y][3] > 0: tops.append(y); break
print('ground sand top rows: min', min(tops), 'max', max(tops))

# sea: pure water crop, mirrored into a seamless 128 x 32 tile
s = L('sea_0.png').crop((96, 18, 160, 44))
sea = Image.new('RGBA', (128, 26)); sea.paste(s, (0, 0)); sea.paste(s.transpose(Image.FLIP_LEFT_RIGHT), (64, 0))
sea.save(os.path.join(out, 'sea.png'))

# sky: the cloud bank from the middle of the sky render, edges stepped out
sky = fade(flood_knockout(L('sky_0.png').crop((56, 0, 264, 46)), tol=36), left=16, right=16, bottom=4)
sky.save(os.path.join(out, 'clouds.png'))

# far: the ruin silhouettes, bottom stepped out so the sea band can sit in front
far = fade(L('far_0.png').crop((0, 0, 320, 42)), bottom=6)
far.save(os.path.join(out, 'far.png'))

# props: copy the picks
for n, o in [('bench_1.png', 'bench.png'), ('bench_0.png', 'bench_b.png'), ('pine_1.png', 'pine.png'), ('pine_0.png', 'pine_b.png'), ('survivor_0.png', 'survivor.png'), ('survivor_1.png', 'survivor_b.png'),
             ('scrap_0.png', 'car.png'), ('barrel_0.png', 'barrel.png'), ('shelter_0.png', 'shelter.png'), ('lamp_0.png', 'lamp.png'), ('drop_0.png', 'drop.png'),
             ('bigred_0.png', 'bigred.png'), ('flotsam_0.png', 'flotsam.png'), ('rock_0.png', 'rock.png')]:
    im = L(n)
    # trim fully transparent borders so positions are predictable
    bb = im.getbbox(); im = im.crop(bb) if bb else im
    im.save(os.path.join(out, o)); print(o, im.size)
print('ok')

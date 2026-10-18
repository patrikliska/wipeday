"""python -I sheet.py <dir> <out.png> [scale]: every PNG in <dir> on one checkerboard contact sheet, nearest-neighbour."""
import sys, os
from PIL import Image, ImageDraw

d, out = sys.argv[1], sys.argv[2]
z = int(sys.argv[3]) if len(sys.argv) > 3 else 4
files = sorted(f for f in os.listdir(d) if f.endswith('.png'))
ims = [(f, Image.open(os.path.join(d, f)).convert('RGBA')) for f in files]
pad, label = 12, 14
# rows: big wide images alone, small ones packed
W = 1400
rows, cur, cw = [], [], 0
for f, im in ims:
    w = im.width * z + pad
    if cur and cw + w > W:
        rows.append(cur); cur, cw = [], 0
    cur.append((f, im)); cw += w
if cur: rows.append(cur)
H = sum(max(im.height for _, im in r) * z + pad + label for r in rows) + pad
sheet = Image.new('RGBA', (W, H), (40, 40, 44, 255))
dr = ImageDraw.Draw(sheet)
for y in range(0, H, 8):
    for x in range(0, W, 8):
        if (x // 8 + y // 8) % 2 == 0:
            dr.rectangle([x, y, x + 7, y + 7], fill=(52, 52, 58, 255))
y = pad
for r in rows:
    x = pad
    rh = max(im.height for _, im in r) * z
    for f, im in r:
        big = im.resize((im.width * z, im.height * z), Image.NEAREST)
        sheet.alpha_composite(big, (x, y + rh - big.height))
        dr.text((x, y + rh + 2), f"{f} {im.width}x{im.height}", fill=(220, 220, 220, 255))
        x += big.width + pad
    y += rh + pad + label
sheet.save(out)
print(out, sheet.size)

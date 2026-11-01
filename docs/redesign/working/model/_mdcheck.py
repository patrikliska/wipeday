"""Sanity check for the generated catalog: table rows keep their header's cell count; JSON is whole."""
import json
import sys

t = open(sys.argv[1], encoding="utf-8").read()
bad = 0
hdr = None
rows = 0
for line in t.splitlines():
    if line.startswith("| ---"):
        continue
    if line.startswith("|"):
        rows += 1
        n = line.replace("\\|", "").count("|")
        if hdr is None:
            hdr = n
        elif n != hdr:
            bad += 1
            print("cells", n, hdr, line[:100])
    else:
        hdr = None
print("table rows", rows, "malformed", bad)
d = json.load(open(sys.argv[2], encoding="utf-8"))
print("json nodes", len(d), "unique ids", len({n["id"] for n in d}), "first", d[0]["id"])

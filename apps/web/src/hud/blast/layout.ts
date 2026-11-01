/**
 * The Blast Map's geometry (docs/redesign/04-blast-map.md 1.2, 8.1; 09-architecture.md 10.4):
 * pure, so the disk, its tests and the shots agree. Eight sectors of 45° run clockwise from
 * 12 o'clock; shipped ring `i` of `n` sits at `R × (0.1 + 0.9 × (i − 0.5) / n)`, so the disk
 * fills its box whatever the wave; a node's angle is `(slot − 0.5) / size` of its wedge.
 * The ladder puts ring 1 at the bottom, at most four nodes a row: rings of 5-7 stagger into
 * two rows (odd slots below, even above), and a node's x keeps the wedge's order.
 */
import { shippedRings } from "@wipe-day/content/blastmap";
import type { Content, NodeDef } from "@wipe-day/content/schema";

export interface DiskNode {
  id: string;
  sector: string;
  ring: number;
  slot: number;
  x: number;
  y: number;
}

export interface DiskWedge {
  sector: string;
  /** The wedge's SVG path, over the shipped rings. */
  d: string;
  /** Where its glyph and counts sit (between the outermost shipped ring and the rim). */
  label: { x: number; y: number };
  /** The arc the fill runs along, in SVG path form, and its length in units. */
  arc: { d: string; length: number };
}

export interface DiskRing {
  ring: number;
  r: number;
}

export interface DiskLayout {
  size: number;
  cx: number;
  cy: number;
  /** The radius of the outermost shipped ring's circle plus the label band. */
  rim: number;
  rings: DiskRing[];
  wedges: DiskWedge[];
  nodes: DiskNode[];
}

const TAU = Math.PI * 2;

/** The angle (radians, clockwise from 12 o'clock) of a sector index's start. */
const sectorStart = (index: number, count: number): number => (index / count) * TAU;

/** A point at `r` from the centre at angle `a` (0 at 12 o'clock, clockwise). */
function polar(cx: number, cy: number, r: number, a: number): { x: number; y: number } {
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
}

const f = (value: number): string => (Math.round(value * 100) / 100).toString();

/** An arc of a circle from angle `a0` to `a1` (clockwise, or back), as the tail of a path. */
function arcTo(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const to = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `A ${f(r)} ${f(r)} 0 ${large} ${sweep} ${f(to.x)} ${f(to.y)}`;
}

export function blastLayout(content: Content, size = 370): DiskLayout {
  const { sectors, rings } = content.blastMap;
  const shipped = shippedRings(content);
  const n = Math.max(1, shipped.length);
  const cx = size / 2;
  const cy = size / 2;
  // The label band takes the outer 16%: rings fill the rest.
  const R = size / 2;
  const inner = R * 0.82;
  const ringR = new Map<number, number>();
  shipped.forEach((ring, index) => {
    ringR.set(ring, inner * (0.1 + (0.9 * (index + 0.5)) / n));
  });
  const outerRing = inner * (0.1 + (0.9 * (n - 0.5)) / n);
  const half = outerRing + (inner - outerRing) / 2;
  const edge = inner;
  const count = sectors.length;
  const wedges: DiskWedge[] = sectors.map((sector, index) => {
    const a0 = sectorStart(index, count);
    const a1 = sectorStart(index + 1, count);
    const hub = inner * 0.1;
    const p0 = polar(cx, cy, hub, a0);
    const p1 = polar(cx, cy, edge, a0);
    const p3 = polar(cx, cy, hub, a1);
    const d = `M ${f(p0.x)} ${f(p0.y)} L ${f(p1.x)} ${f(p1.y)} ${arcTo(cx, cy, edge, a0, a1)} L ${f(p3.x)} ${f(p3.y)} ${arcTo(cx, cy, hub, a1, a0)} Z`;
    const label = polar(cx, cy, (outerRing + inner) / 2 + 2, (a0 + a1) / 2);
    const gap = 0.035;
    const s = polar(cx, cy, half, a0 + gap);
    const arc = {
      d: `M ${f(s.x)} ${f(s.y)} ${arcTo(cx, cy, half, a0 + gap, a1 - gap)}`,
      length: half * (a1 - a0 - 2 * gap),
    };
    return { sector, d, label, arc };
  });
  const nodes: DiskNode[] = [];
  for (const node of content.blastMap.nodes) {
    if (node.sector === null) continue;
    const r = ringR.get(node.ring);
    if (r === undefined) continue;
    const index = sectors.indexOf(node.sector);
    const span = rings.find((row) => row.ring === node.ring)?.size ?? 1;
    const a = sectorStart(index, count) + ((node.slot - 0.5) / span) * (sectorStart(1, count) - 0);
    const p = polar(cx, cy, r, a);
    nodes.push({
      id: node.id,
      sector: node.sector,
      ring: node.ring,
      slot: node.slot,
      x: p.x,
      y: p.y,
    });
  }
  return {
    size,
    cx,
    cy,
    rim: inner,
    rings: shipped.map((ring) => ({ ring, r: ringR.get(ring) ?? 0 })),
    wedges,
    nodes,
  };
}

export interface LadderNode {
  node: NodeDef;
  /** The node's centre, as a fraction of the ladder's width. */
  x: number;
  /** Rows from the top of its ring's band: 0 (the lower row) or 1 (the upper, staggered). */
  row: number;
}

export interface LadderRing {
  ring: number;
  /** Two rows for rings of five or more (04 8.1). */
  rows: number;
  nodes: LadderNode[];
  band: [number, number];
}

/** A sector's ladder, outermost ring first (ring 1 at the bottom of the scroll). */
export function ladderLayout(content: Content, sector: string): LadderRing[] {
  const shipped = shippedRings(content);
  const out: LadderRing[] = [];
  for (const ring of [...shipped].reverse()) {
    const row = content.blastMap.rings.find((r) => r.ring === ring);
    if (!row) continue;
    const size = row.size;
    const stagger = size >= 5;
    const nodes = content.blastMap.nodes
      .filter((node) => node.sector === sector && node.ring === ring)
      .sort((a, b) => a.slot - b.slot)
      .map((node) => ({
        node,
        x: (node.slot - 0.5) / size,
        row: stagger && node.slot % 2 === 0 ? 1 : 0,
      }));
    out.push({ ring, rows: stagger ? 2 : 1, nodes, band: row.band });
  }
  return out;
}

/** The sector clockwise after (or before) `sector`. */
export function nextSector(content: Content, sector: string, step: 1 | -1): string {
  const { sectors } = content.blastMap;
  const index = sectors.indexOf(sector);
  return sectors[(index + step + sectors.length) % sectors.length] ?? sector;
}

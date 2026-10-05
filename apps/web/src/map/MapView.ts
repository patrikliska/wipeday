/**
 * The island map: a full-screen chart of the season's island, drawn in the same
 * flat style as the base. Known regions show their terrain and sites; the rest
 * sits under drifting cloud that parts when a scout comes back. Parties and
 * scouts away draw as dashed routes with a moving dot. Labels live in screen
 * space (D46) and every tap target has a fixed size on screen (D48).
 *
 * Map units: the 1000 x 1000 canvas of `regions.json5`, north up.
 */
import type { Region } from "@wipe-day/content/schema";
import type { BaseState } from "@wipe-day/domain/base";
import { bordersKnown, scoutRange } from "@wipe-day/domain/missions";
import { Container, Graphics, Text, type TextStyleOptions } from "pixi.js";
import { hash, shade } from "../scene/util";
import { content, duration, regionName, siteName, t } from "../state/world";

export interface MapCallbacks {
  onRegion: (id: string) => void;
  onSite: (id: string) => void;
}

/** The island's outline on the map canvas, clockwise from the west coast. */
const COAST: readonly [number, number][] = [
  [70, 600],
  [95, 450],
  [150, 300],
  [250, 190],
  [390, 140],
  [560, 130],
  [720, 175],
  [850, 280],
  [925, 430],
  [930, 590],
  [885, 740],
  [790, 870],
  [620, 925],
  [460, 925],
  [300, 900],
  [170, 850],
  [95, 740],
];

const SEA = 0x2c6a92;
const SEA_LIGHT = 0x4f8fb5;
const LAND = 0x7fa55a;
const TERRAIN: Record<Region["terrain"], number> = {
  shore: 0xd9c893,
  marsh: 0x8a9a5a,
  forest: 0x3f7a3c,
  hills: 0xb09a6a,
  ruins: 0x9a958c,
  cliffs: 0x7b8088,
  tundra: 0xc9d2d4,
  sea: 0x3d7ea6,
};
/** Site markers by tier: the base-tier colours, one step up per tier. */
const SITE_COLOR = [0xc2a868, 0x9aa0a6, 0x6c97bc, 0x45c2c0, 0xcd412b];
const FOG = 0xe9edf1;
/** Region blob radius and the fog over it, in map units. */
const REGION_R = 118;
/** Tap targets in CSS pixels, whatever the zoom (D48); the marker itself is drawn smaller. */
const SITE_TAP_PX = 24;
/** Drawn marker radius in CSS pixels. */
const SITE_PX = 11;
/** The holdfast sits this far north of its region's centre, clear of the region's ruin. */
const HOME_LIFT = 44;

const LABEL: TextStyleOptions = {
  fontFamily: "Roboto Condensed",
  fontWeight: "700",
  fill: 0xffffff,
  stroke: { color: 0x1b1a18, width: 4, join: "round" },
};

interface RegionView {
  region: Region;
  fog: Container;
  /** 1 = fully fogged, 0 = clear; eases toward the target. */
  fogAmount: number;
  label: Text;
  badge: Text;
}

interface SiteView {
  id: string;
  x: number;
  y: number;
  marker: Container;
  label: Text;
}

/** A smooth closed curve through `points` (midpoint quadratics). */
function smoothShape(g: Graphics, points: readonly [number, number][]): Graphics {
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return g;
  const start = mid(last, first);
  g.moveTo(start[0], start[1]);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const next = points[(i + 1) % points.length];
    if (!p || !next) continue;
    const m = mid(p, next);
    g.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  return g.closePath();
}

/** A wobbly blob round (x, y), the same every time for the same seed. */
function blob(x: number, y: number, r: number, seed: number): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const wobble = 0.78 + hash(seed + i * 1.7) * 0.35;
    points.push([x + Math.cos(angle) * r * wobble, y + Math.sin(angle) * r * wobble * 0.82]);
  }
  return points;
}

/** Little pictures that say what a region is: pines, reeds, rocks, ruins. */
function doodles(g: Graphics, region: Region, seed: number): void {
  const { x, y } = region;
  for (let i = 0; i < 9; i++) {
    const px = x + (hash(seed + i * 3.1) - 0.5) * REGION_R * 1.2;
    const py = y + (hash(seed + i * 5.3) - 0.5) * REGION_R * 0.9;
    switch (region.terrain) {
      case "forest":
        g.poly([px, py - 22, px - 10, py + 4, px + 10, py + 4]).fill(0x2f6a34);
        g.rect(px - 1.5, py + 4, 3, 5).fill(0x5a3d26);
        break;
      case "marsh":
        for (let k = -1; k <= 1; k++)
          g.moveTo(px + k * 4, py + 6)
            .lineTo(px + k * 6, py - 10)
            .stroke({ width: 2, color: 0x5f7a3e });
        break;
      case "hills":
        g.moveTo(px - 18, py + 6)
          .quadraticCurveTo(px, py - 16, px + 18, py + 6)
          .fill(shade(TERRAIN.hills, -0.18));
        break;
      case "ruins":
        g.rect(px - 8, py - 12, 16, 16)
          .fill(0x6e6a64)
          .rect(px - 4, py - 8, 4, 5)
          .fill(0x3a3835);
        break;
      case "cliffs":
        g.poly([px - 14, py + 6, px - 4, py - 16, px + 14, py + 6]).fill(
          shade(TERRAIN.cliffs, -0.2),
        );
        break;
      case "shore":
        g.circle(px, py, 3).fill(0xb9a97a);
        break;
      case "tundra":
        // Snowy mounds, and rails on the first two.
        g.moveTo(px - 14, py + 5)
          .quadraticCurveTo(px, py - 9, px + 14, py + 5)
          .fill(0xf1f4f5);
        if (i < 2)
          g.moveTo(px - 20, py + 10)
            .lineTo(px + 20, py + 10)
            .moveTo(px - 20, py + 14)
            .lineTo(px + 20, py + 14)
            .stroke({ width: 1.5, color: 0x6e6a64 });
        break;
      case "sea":
        g.moveTo(px - 10, py)
          .quadraticCurveTo(px - 5, py - 5, px, py)
          .quadraticCurveTo(px + 5, py + 5, px + 10, py)
          .stroke({ width: 2, color: 0xffffff, alpha: 0.55 });
        break;
    }
  }
  if (region.terrain === "sea") {
    // A buoy: someone marked the way out here once.
    g.rect(x + 30, y - 30, 8, 14).fill(0xcd412b);
    g.rect(x + 30, y - 24, 8, 3).fill(0xffffff);
    g.circle(x + 34, y - 32, 3).fill(0xffd25a);
  }
}

export class MapView {
  readonly container = new Container();
  /** The chart in map units; the camera moves and scales it. */
  private readonly chart = new Container();
  private readonly routes = new Graphics();
  private readonly fogLayer = new Container();
  private readonly siteLayer = new Container();
  /** Screen-space text over everything. */
  private readonly labels = new Container();
  private readonly regions: RegionView[] = [];
  private readonly sites: SiteView[] = [];
  private readonly home: Text;
  private time = 0;
  private scale = 1;
  private fitScale = 1;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private viewW = 0;
  private viewH = 0;
  private insets = { top: 0, bottom: 0 };
  private pointers = new Map<number, { x: number; y: number }>();
  private dragStart: { x: number; y: number; moved: boolean } | null = null;
  private pinch: number | null = null;
  private focus: string | null = null;
  /** Until the first update, fog snaps to its state; afterwards it parts slowly. */
  private settled = false;

  constructor(private readonly callbacks: MapCallbacks) {
    const sea = new Graphics();
    sea.rect(-2000, -2000, 5000, 5000).fill(SEA);
    for (let i = 0; i < 40; i++) {
      const x = hash(i * 9.1) * 1400 - 200;
      const y = hash(i * 4.7) * 1400 - 200;
      sea
        .moveTo(x, y)
        .quadraticCurveTo(x + 14, y - 6, x + 28, y)
        .stroke({ width: 2, color: SEA_LIGHT, alpha: 0.5 });
    }
    const island = new Graphics();
    smoothShape(
      island,
      COAST.map(([x, y]) => [x + 10, y + 14]),
    ).fill({ color: 0x000000, alpha: 0.18 });
    smoothShape(island, COAST).fill(0xd9c893);
    smoothShape(
      island,
      COAST.map(([x, y]) => [500 + (x - 500) * 0.95, 520 + (y - 520) * 0.95]),
    ).fill(LAND);

    const terrain = new Graphics();
    for (const [index, region] of content.regions.entries()) {
      // The sea regions are open water: a lighter patch, not land.
      const sea = region.access === "sea";
      smoothShape(terrain, blob(region.x, region.y, REGION_R * 0.85, index * 13.7)).fill({
        color: sea ? SEA_LIGHT : TERRAIN[region.terrain],
        alpha: sea ? 0.45 : 0.85,
      });
      doodles(terrain, region, index * 21.3);
    }
    // Roads between neighbours: dashed tracks on land, pale sea lanes to the sea regions.
    const roads = new Graphics();
    const lanes = new Graphics();
    for (const region of content.regions) {
      for (const other of region.neighbours) {
        const target = content.regions.find((candidate) => candidate.id === other);
        if (!target || target.id < region.id) continue;
        const layer = region.access === "sea" || target.access === "sea" ? lanes : roads;
        const steps = 14;
        for (let i = 0; i < steps; i += 2) {
          const a = i / steps;
          const b = (i + 1) / steps;
          layer
            .moveTo(region.x + (target.x - region.x) * a, region.y + (target.y - region.y) * a)
            .lineTo(region.x + (target.x - region.x) * b, region.y + (target.y - region.y) * b);
        }
      }
    }
    roads.stroke({ width: 3, color: 0x6f5638, alpha: 0.55 });
    lanes.stroke({ width: 3, color: 0xffffff, alpha: 0.5 });

    // The holdfast.
    const holdfast = new Graphics();
    const homeRegion = content.regions.find((region) => region.ring === 0);
    const hx = homeRegion?.x ?? 500;
    const hy = (homeRegion?.y ?? 800) - HOME_LIFT;
    holdfast.poly([hx - 16, hy, hx, hy - 16, hx + 16, hy]).fill(0x7a4a2a);
    holdfast
      .rect(hx - 12, hy, 24, 16)
      .fill(0xb07840)
      .rect(hx - 4, hy + 6, 8, 10)
      .fill(0x3a2615);
    this.home = this.text(t("map.home"), 12, 0xffd25a);

    for (const [index, region] of content.regions.entries()) {
      const fog = new Container();
      for (let i = 0; i < 7; i++) {
        const puff = new Graphics();
        const r = 46 + hash(index * 5 + i) * 30;
        puff.circle(0, 0, r).fill({ color: FOG, alpha: 0.95 });
        puff.circle(-r * 0.3, -r * 0.3, r * 0.5).fill({ color: 0xffffff, alpha: 0.5 });
        const angle = (i / 7) * Math.PI * 2;
        puff.position.set(Math.cos(angle) * 58, Math.sin(angle) * 44);
        fog.addChild(puff);
      }
      fog.position.set(region.x, region.y);
      this.fogLayer.addChild(fog);
      const label = this.text(regionName(region.id), 14, 0xffffff);
      const badge = this.text("", 12, 0x1b1a18, 0xffd25a);
      this.regions.push({ region, fog, fogAmount: 1, label, badge });
    }

    for (const site of content.sites) {
      const region = content.regions.find((candidate) => candidate.id === site.region);
      if (!region) continue;
      const offset = content.sites.filter((s) => s.region === site.region).indexOf(site);
      const x = region.x + (offset === 0 ? 0 : (offset % 2 === 0 ? -1 : 1) * 46);
      const y = region.y + 18 + offset * 12;
      const marker = new Container();
      const pin = new Graphics();
      const color = SITE_COLOR[site.tier - 1] ?? 0xffffff;
      pin.circle(0, 0, 13).fill({ color: 0x000000, alpha: 0.35 });
      pin.circle(0, -2, 12).fill(0x1b1a18).stroke({ width: 3, color });
      pin.rect(-5, -8, 10, 9).fill(color).rect(-2, -5, 4, 6).fill(0x1b1a18);
      marker.addChild(pin);
      marker.position.set(x, y);
      marker.eventMode = "static";
      marker.cursor = "pointer";
      marker.on("pointertap", () => {
        if (!this.dragStart?.moved) this.callbacks.onSite(site.id);
      });
      this.siteLayer.addChild(marker);
      const label = this.text(siteName(site.id), 12, 0xffffff);
      this.sites.push({ id: site.id, x, y, marker, label });
    }

    this.chart.addChild(
      sea,
      island,
      terrain,
      roads,
      lanes,
      holdfast,
      this.siteLayer,
      this.routes,
      this.fogLayer,
    );
    this.container.addChild(this.chart, this.labels);
    this.container.visible = false;
    this.container.eventMode = "static";
    this.container.on("pointerdown", this.onDown);
    this.container.on("globalpointermove", this.onMove);
    this.container.on("pointerup", this.onUp);
    this.container.on("pointerupoutside", this.onUp);
    this.container.on("wheel", (event) =>
      this.zoomAt(event.global.x, event.global.y, event.deltaY < 0 ? 1.15 : 1 / 1.15),
    );
  }

  private text(label: string, size: number, fill: number, background?: number): Text {
    const text = new Text({
      text: label,
      style: background
        ? { ...LABEL, fontSize: size, fill, stroke: { color: background, width: 6, join: "round" } }
        : { ...LABEL, fontSize: size, fill },
    });
    text.anchor.set(0.5, 0);
    text.roundPixels = true;
    this.labels.addChild(text);
    return text;
  }

  /** The screen size and the HUD's reserved bands (top bar, dock), in CSS pixels. */
  layout(width: number, height: number, insets: { top: number; bottom: number }): void {
    if (width === this.viewW && height === this.viewH && insets.top === this.insets.top) return;
    this.viewW = width;
    this.viewH = height;
    this.insets = insets;
    const room = Math.max(200, height - insets.top - insets.bottom);
    // The island (x 70-930, y 130-925) fills the room between the HUD bands.
    this.fitScale = Math.min((width - 8) / 870, room / 820);
    this.container.hitArea = { contains: () => true };
  }

  show(visible: boolean): void {
    this.container.visible = visible;
  }

  /** Highlights a region or site (the one whose panel is open). */
  setFocus(id: string | null): void {
    this.focus = id;
  }

  private camera(): { x: number; y: number } {
    this.scale = this.fitScale * this.zoom;
    const room = this.viewH - this.insets.top - this.insets.bottom;
    return {
      x: this.viewW / 2 - 500 * this.scale + this.panX,
      y: this.insets.top + room / 2 - 527 * this.scale + this.panY,
    };
  }

  private toScreen(x: number, y: number): { x: number; y: number } {
    const cam = this.camera();
    return { x: cam.x + x * this.scale, y: cam.y + y * this.scale };
  }

  update(dt: number, state: BaseState, now: number): void {
    if (!this.container.visible) return;
    this.time += dt;
    const cam = this.camera();
    this.chart.position.set(cam.x, cam.y);
    this.chart.scale.set(this.scale);
    const range = scoutRange(content, state);

    for (const view of this.regions) {
      const known = state.known.includes(view.region.id);
      const scouting = state.missions.find(
        (m) => m.kind === "scout" && m.target === view.region.id,
      );
      const open = !known && bordersKnown(content, state, view.region.id);
      const target = known ? 0 : 1;
      view.fogAmount = this.settled
        ? view.fogAmount + (target - view.fogAmount) * Math.min(1, dt * 1.5)
        : target;
      view.fog.alpha = view.fogAmount;
      view.fog.visible = view.fogAmount > 0.02;
      // Clouds drift; parting clouds spread out as they fade.
      view.fog.children.forEach((puff, index) => {
        puff.x += Math.sin(this.time * 0.3 + index) * dt * 3;
        puff.scale.set(1 + (1 - view.fogAmount) * 0.6);
      });
      // Regions with ruins keep their name above them; the rest centre it.
      const hasSites = content.sites.some((site) => site.region === view.region.id);
      const at = this.toScreen(view.region.x, view.region.y - (hasSites ? 62 : 12));
      view.label.position.set(at.x, at.y);
      view.label.visible = known || open;
      view.label.alpha = known ? 1 : 0.85;
      view.label.style.fill = this.focus === view.region.id ? 0xffd25a : 0xffffff;
      let badge = "";
      if (scouting) {
        badge = t("map.scouting", { time: duration(Math.max(0, scouting.endsAt - now)) });
      } else if (open) {
        badge = view.region.ring > range ? t("map.too_far") : t("map.scout");
      }
      view.badge.text = badge;
      view.badge.visible = badge !== "";
      view.badge.position.set(at.x, at.y + 20);
    }

    for (const site of this.sites) {
      const data = content.sites.find((candidate) => candidate.id === site.id);
      const visible = data ? state.known.includes(data.region) : false;
      site.marker.visible = visible;
      site.label.visible = visible;
      const focused = this.focus === site.id;
      const markerScale = ((focused ? 1.3 : 1) * SITE_PX) / 12 / this.scale;
      site.marker.scale.set(markerScale);
      // The tap area stays SITE_TAP_PX on screen, bigger than the drawing.
      site.marker.hitArea = {
        contains: (x: number, y: number) =>
          Math.hypot(x, y) * markerScale * this.scale <= SITE_TAP_PX,
      };
      const away = state.missions.find((m) => m.kind === "trip" && m.target === site.id);
      site.label.text = away
        ? `${siteName(site.id)} · ${duration(Math.max(0, away.endsAt - now))}`
        : siteName(site.id);
      site.label.style.fill = focused ? 0xffd25a : 0xffffff;
      const at = this.toScreen(site.x, site.y);
      site.label.position.set(at.x, at.y + SITE_PX + 3);
    }

    this.settled = true;
    const homeRegion = content.regions.find((region) => region.ring === 0);
    // The holdfast's name sits above its roof, clear of the ruin below it.
    const homeAt = this.toScreen(homeRegion?.x ?? 500, (homeRegion?.y ?? 800) - HOME_LIFT - 20);
    this.home.position.set(homeAt.x, homeAt.y - 16);

    // Routes: home to the target, a dot walking out and back as the mission runs.
    this.routes.clear();
    for (const mission of state.missions) {
      const region =
        mission.kind === "scout"
          ? content.regions.find((candidate) => candidate.id === mission.target)
          : content.regions.find(
              (candidate) =>
                candidate.id === content.sites.find((s) => s.id === mission.target)?.region,
            );
      if (!region || !homeRegion) continue;
      const sx = homeRegion.x;
      const sy = homeRegion.y - HOME_LIFT;
      const steps = 16;
      for (let i = 0; i < steps; i += 2) {
        const a = i / steps;
        const b = (i + 1) / steps;
        this.routes
          .moveTo(sx + (region.x - sx) * a, sy + (region.y - sy) * a)
          .lineTo(sx + (region.x - sx) * b, sy + (region.y - sy) * b);
      }
      this.routes.stroke({ width: 4 / this.scale, color: 0xffd25a, alpha: 0.9 });
      const progress = Math.min(
        1,
        Math.max(0, (now - mission.startedAt) / (mission.endsAt - mission.startedAt)),
      );
      // Out for the first half, back for the second.
      const leg = progress < 0.5 ? progress * 2 : 2 - progress * 2;
      this.routes
        .circle(sx + (region.x - sx) * leg, sy + (region.y - sy) * leg, 8 / this.scale)
        .fill(0xffd25a)
        .stroke({ width: 2 / this.scale, color: 0x1b1a18 });
    }
  }

  // --- input: tap regions, drag to pan, pinch or wheel to zoom --------------------------

  private readonly onDown = (event: {
    pointerId: number;
    global: { x: number; y: number };
  }): void => {
    this.pointers.set(event.pointerId, { x: event.global.x, y: event.global.y });
    if (this.pointers.size === 1)
      this.dragStart = { x: event.global.x, y: event.global.y, moved: false };
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      if (a && b) this.pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  private readonly onMove = (event: {
    pointerId: number;
    global: { x: number; y: number };
  }): void => {
    const last = this.pointers.get(event.pointerId);
    if (!last) return;
    const now = { x: event.global.x, y: event.global.y };
    this.pointers.set(event.pointerId, now);
    if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, distance / this.pinch);
      this.pinch = distance;
      if (this.dragStart) this.dragStart.moved = true;
      return;
    }
    if (!this.dragStart) return;
    if (Math.hypot(now.x - this.dragStart.x, now.y - this.dragStart.y) > 8)
      this.dragStart.moved = true;
    if (this.dragStart.moved) {
      this.panX += now.x - last.x;
      this.panY += now.y - last.y;
      this.clampPan();
    }
  };

  private readonly onUp = (event: {
    pointerId: number;
    global: { x: number; y: number };
  }): void => {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    const drag = this.dragStart;
    if (this.pointers.size === 0) this.dragStart = null;
    if (!drag || drag.moved) return;
    // A tap: the region under it (sites handle their own taps).
    const cam = this.camera();
    const mx = (event.global.x - cam.x) / this.scale;
    const my = (event.global.y - cam.y) / this.scale;
    let best: { id: string; d: number } | null = null;
    for (const view of this.regions) {
      const d = Math.hypot(mx - view.region.x, (my - view.region.y) * 1.2);
      if (d < REGION_R && (!best || d < best.d)) best = { id: view.region.id, d };
    }
    if (
      best &&
      !this.sites.some(
        (site) =>
          site.marker.visible && Math.hypot(mx - site.x, my - site.y) * this.scale < SITE_TAP_PX,
      )
    ) {
      this.callbacks.onRegion(best.id);
    }
  };

  private zoomAt(x: number, y: number, factor: number): void {
    // Keep the map point under the fingers where it is.
    const before = this.camera();
    const mx = (x - before.x) / this.scale;
    const my = (y - before.y) / this.scale;
    this.zoom = Math.min(3, Math.max(1, this.zoom * factor));
    const after = this.camera();
    this.panX += x - (after.x + mx * this.scale);
    this.panY += y - (after.y + my * this.scale);
    this.clampPan();
  }

  private clampPan(): void {
    const slack = (this.zoom - 1) * 500 * this.fitScale + 60;
    this.panX = Math.max(-slack, Math.min(slack, this.panX));
    this.panY = Math.max(-slack, Math.min(slack, this.panY));
  }
}

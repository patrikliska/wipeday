/**
 * Owns the Pixi application and the camera, stacks the layers, and turns
 * store state and events into motion. Game state only ever changes through
 * store actions; the scene reads it once per frame.
 */

import type { Amounts } from "@wipe-day/content/schema";
import { denWorthIt } from "@wipe-day/domain/advisor";
import { type BaseState, furnaceOf, furnaceSlots, jobProgress } from "@wipe-day/domain/base";
import { isAsleep } from "@wipe-day/domain/crew";
import { denOpen } from "@wipe-day/domain/den";
import { nodeKindOf } from "@wipe-day/domain/nodes";
import { Application, Container, Graphics, type Ticker } from "pixi.js";
import { countFrame, isFrozen } from "../debug";
import { MapView } from "../map/MapView";
import { type GameEvent, on } from "../state/events";
import { seasonTime, useWorld } from "../state/store";
import {
  abbrev,
  content,
  dayFraction,
  duration,
  gainLines,
  nodeName,
  outputName,
  survivorLook,
  t,
  tierName,
  toolName,
} from "../state/world";
import { Actors, type Post } from "./actors";
import { Base } from "./base";
import { Skiff } from "./den";
import { type Float, Floaters, Particles, Weather } from "./effects";
import { Barrel, type Depleted, MAX_HITS, type NodeCallbacks, type NodeDef, Nodes } from "./nodes";
import { gloom, paletteAt } from "./palette";
import { Sky } from "./sky";
import { Terrain } from "./terrain";
import { clamp, lerp } from "./util";

/** Design space: a 16:9 stage, the ground line a little below centre. */
const W = 1600;
const H = 900;
const HORIZON = 520;
const GROUND = 560;
/** Radius of the progress ring over a working station, in CSS pixels. */
const WORK_RING_PX = 9;
const SHORE_X = 540;
const BASE_X = 1000;
/** Sky and ground continue this far past the stage so no screen shape shows an edge. */
const EXTEND = 800;
/** Narrow screens always see at least this many world units across... */
const MIN_VISIBLE_W = 880;
/** ...centred here, so the base and the shore both fit on a phone. */
const FOCUS_X = 915;

const BACK_NODES: NodeDef[] = [
  { id: "tree_1", kind: "tree", x: 834, y: GROUND + 2, scale: 1, fall: -1 },
  { id: "tree_2", kind: "tree", x: 1240, y: GROUND + 2, scale: 1.15 },
  { id: "tree_3", kind: "tree", x: 1470, y: GROUND + 6, scale: 0.95 },
  { id: "tree_4", kind: "tree", x: 1560, y: GROUND + 2, scale: 1.05 },
];
const FRONT_NODES: NodeDef[] = [
  { id: "ore_1", kind: "ore", x: 660, y: GROUND + 70, scale: 1 },
  { id: "stone_1", kind: "stone", x: 1150, y: GROUND + 52, scale: 0.8 },
  { id: "sulfur_1", kind: "sulfur", x: 1296, y: GROUND + 100, scale: 0.85 },
];
const BARREL_SPOT = { x: 540, y: GROUND + 62 };
/** The Den's skiff, pulled up on the beach below the barrel (W5): inside the phone view. */
const SKIFF_SPOT = { x: 548, y: GROUND + 114 };

const ALL_NODES = [...BACK_NODES, ...FRONT_NODES];
const nodeKind = new Map(ALL_NODES.map((node) => [node.id, node.kind]));

function debrisFor(kind: string): { kind: "leaves" | "stone"; color: number } {
  if (kind === "tree") return { kind: "leaves", color: 0x5c9b4a };
  if (kind === "fibre") return { kind: "leaves", color: 0xa8c060 };
  if (kind === "sulfur") return { kind: "stone", color: 0xe3c04f };
  if (kind === "ore") return { kind: "stone", color: 0xa8603a };
  return { kind: "stone", color: 0x9aa0a6 };
}

/** The HUD's bands the map must stay clear of: under the top bar, above the dock (CSS px). */
function hudInsets(viewH: number): { top: number; bottom: number } {
  const top = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 80;
  const dock = document.querySelector(".dock")?.getBoundingClientRect().top ?? viewH - 100;
  return { top: top + 8, bottom: Math.max(0, viewH - dock) + 8 };
}

export class Scene {
  private readonly app = new Application();
  private readonly world = new Container();
  /** Multiplied over the world: white by day, blue at night. Screen space. */
  private readonly ambient = new Graphics();
  /** World-aligned top layer: the node markers, above every effect and the weather. */
  private readonly markers = new Container();
  /** The crew the actors last showed, so they are only re-cast when it changes. */
  private crewKey = "";
  /** A progress ring over each station at work (fixed size on screen, D48). */
  private readonly workRings = new Map<string, Graphics>();
  /** Where the last node hit landed, so its gain rises from the cursor. */
  private lastHit: { x: number; y: number } | null = null;
  /** The previous hit's text, faded out when the next hit lands so quick hits never pile up. */
  private hitText: readonly Float[] = [];
  /** World-aligned layer above the ambient tint, for things that emit light. */
  private readonly lights = new Container();
  private readonly particles = new Particles();
  private readonly floaters = new Floaters();
  private readonly weather = new Weather(1200, 800);
  private readonly sky = new Sky(W, HORIZON, EXTEND);
  private readonly terrain = new Terrain({
    width: W,
    height: H,
    horizon: HORIZON,
    ground: GROUND,
    shoreX: SHORE_X,
    baseX: BASE_X,
    extend: EXTEND,
  });
  private readonly base = new Base(this.particles);
  private readonly backNodes: Nodes;
  private readonly frontNodes: Nodes;
  private readonly barrel: Barrel;
  private readonly skiff: Skiff;
  /** The base the skiff's glow was worked out for (the check is not free every frame). */
  private skiffFor: unknown = null;
  private readonly actors: Actors;
  /** The island chart, drawn instead of the base while the map is open. */
  private readonly map = new MapView({
    onRegion: (id) => useWorld.getState().focusMap({ kind: "region", id }),
    onSite: (id) => useWorld.getState().focusMap({ kind: "site", id }),
    onDen: () => useWorld.getState().openDen(),
  });
  private unsubscribe: (() => void) | null = null;
  private destroyed = false;
  private ready = false;
  private viewW = 0;
  private viewH = 0;
  private scale = 1;
  private centerX = W / 2;
  private top = 0;
  private time = 0;
  private wind = 1;
  private parallax = 0;
  private parallaxTarget = 0;
  private scaffoldTier: string | null = null;

  constructor(private readonly host: HTMLElement) {
    const callbacks: NodeCallbacks = {
      onStart: (node) => {
        const refusal = useWorld.getState().startRun(node.id);
        if (refusal) {
          this.floaters.add(
            node.x,
            node.y - 70 * node.scale,
            refusal,
            0xece8df,
            this.floatSize(0.85),
          );
          return null;
        }
        return useWorld.getState().base.wear[node.id] ?? 0;
      },
      onHit: (node, hits, x, y) => {
        const debris = debrisFor(node.kind);
        this.particles.spawn(debris.kind, x, y, 10, debris.color);
        this.lastHit = { x, y };
        // The domain banks the hit (and the perfect bonus on the last one); effects follow its events.
        useWorld.getState().hitNode(hits);
      },
      onRunOver: (_node, { hits, from, done }, x, y) => {
        // At the marker, where the eye already is; "Perfect!" sits above the bonus gain.
        this.floaters.retire(this.hitText);
        if (done && from === 0) {
          this.floaters.add(
            x,
            y - 62 / this.scale,
            t("hud.perfect"),
            0xffd25a,
            this.floatSize(1.2),
          );
          this.particles.spawn("coins", x, y, 12);
        } else if (!done && hits > from) {
          // The node stays up with its wear: say how far along it is.
          const text = t("hud.missed_wear", { hits, max: MAX_HITS });
          this.floaters.add(x, y - 22 / this.scale, text, 0xa49e93, this.floatSize());
        }
        useWorld.getState().endRun(done);
      },
      onDepletedTap: (node) => {
        const state = useWorld.getState();
        const until = state.base.depleted[node.id];
        if (until === undefined) return;
        const text = t("hud.node_back_in", {
          node: nodeName(node.kind),
          time: duration(Math.ceil(until - state.now)),
        });
        this.floaters.add(node.x, node.y - 70 * node.scale, text, 0xece8df, this.floatSize(0.85));
      },
      onFelled: (node, x, y) => {
        if (node.kind !== "tree") return;
        this.particles.spawn("dust", x, y, 10, 0xc9b78a);
        this.particles.spawn("leaves", x, y - 20, 16, 0x5c9b4a);
      },
    };
    this.backNodes = new Nodes(BACK_NODES, callbacks);
    this.frontNodes = new Nodes(FRONT_NODES, callbacks);
    this.barrel = new Barrel(BARREL_SPOT.x, BARREL_SPOT.y, () => {
      useWorld.getState().breakBarrel();
    });
    this.skiff = new Skiff(SKIFF_SPOT.x, SKIFF_SPOT.y, () => {
      const state = useWorld.getState();
      state.openDen(denWorthIt(content, state.base) ? "contracts" : undefined);
    });
    this.actors = new Actors(GROUND, BASE_X, BASE_X + 340, SHORE_X + 20, {
      canWork: (node) => this.backNodes.isUp(node) || this.frontNodes.isUp(node),
      onWork: (node, x, y) => {
        this.shakeNode(node);
        const debris = debrisFor(nodeKind.get(node) ?? "stone");
        this.particles.spawn(debris.kind, x + 12, y, 3, debris.color);
      },
      onDeliver: (x, y) => this.particles.spawn("dust", x, y + 50, 4),
    });
    this.base.container.position.set(BASE_X, GROUND);
    this.base.lights.position.set(BASE_X, GROUND);
    this.lights.addChild(this.base.lights, this.skiff.light);
    this.markers.addChild(this.backNodes.overlay, this.frontNodes.overlay);
    this.ambient.blendMode = "multiply";
    this.world.addChild(
      this.sky.container,
      this.terrain.back,
      this.terrain.ground,
      this.backNodes.container,
      this.base.container,
      this.frontNodes.container,
      this.actors.container,
      this.barrel.container,
      this.skiff.container,
      this.particles.container,
      this.terrain.front,
    );
  }

  async init(): Promise<void> {
    await this.app.init({
      resizeTo: this.host,
      autoDensity: true,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      backgroundAlpha: 0,
    });
    if (this.destroyed) {
      this.app.destroy(true, { children: true });
      return;
    }
    this.ready = true;
    this.host.appendChild(this.app.canvas);
    this.app.stage.addChild(
      this.world,
      this.ambient,
      this.lights,
      this.floaters.container,
      this.weather.container,
      this.markers,
      this.map.container,
    );
    this.unsubscribe = on((event) => this.handle(event));
    if (window.__wipeDay) {
      window.__wipeDay.nodeMarker = () => {
        const point = this.backNodes.markerPoint ?? this.frontNodes.markerPoint;
        return point ? this.markers.toGlobal(point) : null;
      };
    }
    this.app.canvas.addEventListener("pointermove", this.onPointer);
    this.sync();
    this.app.ticker.add(this.frame);
  }

  destroy(): void {
    this.destroyed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (!this.ready) return;
    this.ready = false;
    this.app.canvas.removeEventListener("pointermove", this.onPointer);
    this.app.ticker.remove(this.frame);
    this.app.destroy(true, { children: true });
  }

  private readonly onPointer = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse") return;
    this.parallaxTarget = (event.clientX / Math.max(1, this.viewW) - 0.5) * 2;
  };

  /** Camera: cover the viewport, keep at least MIN_VISIBLE_W across, horizon in the upper half on tall screens. */
  private layout(): void {
    const vw = this.app.screen.width;
    const vh = this.app.screen.height;
    if (vw === this.viewW && vh === this.viewH) return;
    this.viewW = vw;
    this.viewH = vh;
    // Desktop: fill the height with a little zoom; phones: never narrower than MIN_VISIBLE_W.
    this.scale = Math.min(vh / (H - 100), vw / MIN_VISIBLE_W);
    const visibleW = vw / this.scale;
    const visibleH = vh / this.scale;
    this.centerX = visibleW >= W ? W / 2 : clamp(FOCUS_X, visibleW / 2, W - visibleW / 2);
    // The ground line sits lower on wide screens (more sky) and near the middle on tall ones.
    const wideness = clamp(vw / vh - 0.6, 0, 1);
    const groundFraction = lerp(0.66, 0.72, wideness);
    this.top = clamp(GROUND - groundFraction * visibleH, -EXTEND + 40, H + EXTEND - visibleH - 40);
    this.world.scale.set(this.scale);
    this.ambient.clear().rect(0, 0, vw, vh).fill(0xffffff);
    this.weather.resize(vw, vh);
  }

  /**
   * Who walks about the base: the crew at home; the hurt rest by the fire, and each
   * worker keeps to their post (their node, their station, the gate, or their bed).
   */
  private syncCrew(base: BaseState, now: number): void {
    const key = base.crew
      .map(
        (member) =>
          `${member.id}:${member.away ?? ""}:${(member.injuredUntil ?? 0) > now ? 1 : 0}:${JSON.stringify(member.job)}:${isAsleep(member, now) ? 1 : 0}`,
      )
      .join(",");
    if (key === this.crewKey) return;
    this.crewKey = key;
    const home = base.crew.filter((member) => member.away === null);
    const hurt = new Set(
      home.filter((member) => (member.injuredUntil ?? 0) > now).map((member) => member.id),
    );
    const posts = new Map<string, Post>();
    const perKind = new Map<string, number>();
    for (const member of home) {
      const job = member.job;
      if (isAsleep(member, now)) {
        posts.set(member.id, { kind: "sleep", x: BASE_X + 340 });
      } else if (job?.kind === "node") {
        // Workers of one kind spread over its nodes.
        const nodes = ALL_NODES.filter((node) => node.kind === job.node);
        const index = perKind.get(job.node) ?? 0;
        perKind.set(job.node, index + 1);
        const node = nodes[index % Math.max(1, nodes.length)];
        if (node) posts.set(member.id, { kind: "node", x: node.x, node: node.id });
        else {
          // A kind with no node drawn (fibre): they work the fields by the loom.
          const field = this.base.stationPosition("loom") ?? this.base.stationPosition("garden");
          posts.set(member.id, { kind: "station", x: (field?.x ?? BASE_X + 200) + 30 });
        }
      } else if (job?.kind === "station") {
        const spot = this.base.stationPosition(job.station);
        if (spot) posts.set(member.id, { kind: "station", x: spot.x + 26 });
      } else if (job?.kind === "guard") {
        // By the walls when they stand, else on the path down to the shore.
        const walls = this.base.buildingPosition("walls");
        const guards = [...posts.values()].filter((post) => post.kind === "guard").length;
        posts.set(member.id, { kind: "guard", x: (walls?.x ?? BASE_X - 230) - guards * 34 });
      }
    }
    this.actors.sync(
      home.map((member) => survivorLook(member.id)),
      hurt,
      posts,
    );
  }

  /** Rings over the stations at work: how far the current unit is, like the regrow clocks. */
  private syncWork(base: BaseState, now: number): void {
    const busy = new Set<string>();
    for (const [station, jobs] of Object.entries(base.production)) {
      const job = jobs[0];
      if (!job || now < job.startedAt) continue;
      const spot = this.base.stationTop(station);
      if (!spot) continue;
      busy.add(station);
      let ring = this.workRings.get(station);
      if (!ring) {
        ring = new Graphics();
        ring.eventMode = "none";
        this.markers.addChild(ring);
        this.workRings.set(station, ring);
      }
      const unit = ((now - job.startedAt) % job.unitSeconds) / job.unitSeconds;
      const r = WORK_RING_PX;
      const end = -Math.PI / 2 + unit * Math.PI * 2;
      ring.clear();
      // A pale rim so the ring holds its shape against the night sky too.
      ring
        .circle(0, 0, r * 1.25)
        .fill({ color: 0x1b1a18, alpha: 0.72 })
        .stroke({ width: 1.5, color: 0xece8df, alpha: 0.55 });
      ring
        .moveTo(0, 0)
        .lineTo(0, -r)
        .arc(0, 0, r, -Math.PI / 2, end)
        .closePath()
        .fill(0xe3a32f);
      ring.position.set(spot.x, spot.y - 18 / this.scale);
      ring.scale.set(1 / this.scale);
    }
    for (const [station, ring] of this.workRings) {
      if (busy.has(station)) continue;
      ring.destroy();
      this.workRings.delete(station);
    }
    this.base.setBusy(busy);
  }

  /** State-driven visuals, cheap enough to run every frame. */
  private sync(): void {
    const state = useWorld.getState();
    const { base, now } = state;
    this.syncCrew(base, now);
    this.base.setTier(base.tier, false);
    const tierJob = base.construction.find((job) => job.target.kind === "tier");
    const scaffold = tierJob?.target.kind === "tier" ? tierJob.target.tier : null;
    if (scaffold !== this.scaffoldTier) {
      this.scaffoldTier = scaffold;
      this.base.showScaffold(scaffold);
    }
    const furnace = furnaceOf(content, base);
    this.base.setStations({
      buildings: base.buildings,
      furnaceSlots: Math.max(1, furnaceSlots(content, base)),
      crates: (base.items.crate ?? 0) + (base.items.large_crate ?? 0),
      constructing: base.construction.flatMap((job) =>
        job.target.kind === "building" ? [job.target.building] : [],
      ),
    });
    this.base.setFurnaceActive(
      furnace !== null && base.furnaceJobs.some((job) => jobProgress(job, now) < job.amount),
    );
    this.barrel.set(base.barrel !== null && now <= base.barrel.expiresAt);
    if (this.skiffFor !== base) {
      this.skiffFor = base;
      this.skiff.set(denOpen(content, base), denWorthIt(content, base));
    }
    this.syncWork(base, state.now);
    const depleted: Record<string, Depleted> = {};
    for (const [id, until] of Object.entries(base.depleted)) {
      const kind = nodeKindOf(content, id);
      if (kind) depleted[id] = { kind: kind.id, at: until - kind.respawnSeconds, until };
    }
    // Cracks follow the hits live: the run in progress, else what earlier runs left.
    const run = base.nodeRun;
    const wear = run ? { ...base.wear, [run.node]: run.hits } : base.wear;
    this.backNodes.sync(depleted, now, wear);
    this.frontNodes.sync(depleted, now, wear);
    this.weather.set(state.weather);
  }

  private readonly frame = (ticker: Ticker): void => {
    countFrame();
    if (isFrozen()) return;
    const dt = Math.min(0.05, ticker.deltaMS / 1000);
    this.time += dt;
    this.step(dt);
  };

  private step(dt: number): void {
    this.layout();
    useWorld.getState().tick();
    const state = useWorld.getState();
    // The map replaces the base on screen; the base rests (nothing there needs the frames).
    const onMap = state.view === "map";
    this.map.show(onMap);
    for (const layer of [
      this.world,
      this.ambient,
      this.lights,
      this.floaters.container,
      this.weather.container,
      this.markers,
    ]) {
      layer.visible = !onMap;
    }
    if (onMap) {
      this.map.layout(this.viewW, this.viewH, hudInsets(this.viewH));
      this.map.setFocus(state.mapFocus?.id ?? null);
      this.map.update(dt, state.base, state.now);
      return;
    }
    this.sync();
    const fraction = dayFraction(seasonTime(state));
    const rain = this.weather.rainAmount;
    const gloomAmount = clamp(rain + (state.weather === "fog" ? 0.5 : 0), 0, 1);
    const palette = gloom(paletteAt(fraction), gloomAmount);
    const darkness = clamp(
      1 - palette.light + rain * 0.3 + (state.weather === "fog" ? 0.1 : 0),
      0,
      1,
    );
    this.wind = 1 + Math.sin(this.time * 0.23) * 0.8 + rain * 2;
    this.parallax += (this.parallaxTarget - this.parallax) * Math.min(1, dt * 3);

    const visibleW = this.viewW / this.scale;
    const left = this.centerX - visibleW / 2;
    this.world.position.set(-left * this.scale - this.parallax * 6, -this.top * this.scale);
    this.floaters.setCamera(this.world.position.x, this.world.position.y, this.scale);
    this.lights.position.copyFrom(this.world.position);
    this.lights.scale.copyFrom(this.world.scale);
    this.markers.position.copyFrom(this.world.position);
    this.markers.scale.copyFrom(this.world.scale);

    this.sky.update(dt, fraction, palette, this.wind, gloomAmount);
    this.terrain.update(dt, palette, this.wind, this.parallax);
    this.base.update(dt, darkness, this.wind);
    this.backNodes.update(dt, this.wind);
    this.frontNodes.update(dt, this.wind);
    this.barrel.update(dt, darkness);
    this.skiff.update(dt, darkness, this.scale);
    this.actors.setNight(fraction < 0.23 || fraction > 0.8);
    this.actors.update(dt, this.wind);
    this.particles.update(dt, this.wind);
    this.floaters.update(dt);
    this.weather.update(dt, this.wind, darkness);
    this.ambient.tint = palette.ambient;
  }

  /** Floating text size in CSS pixels: 22 on phones and laptops, up to 28 on big screens. */
  private floatSize(multiplier = 1): number {
    return Math.round(clamp(22 * this.scale, 22, 28) * multiplier);
  }

  private nodePosition(node: string): { x: number; y: number } {
    return (
      this.backNodes.position(node) ?? this.frontNodes.position(node) ?? { x: BASE_X, y: GROUND }
    );
  }

  private shakeNode(node: string): void {
    this.backNodes.shake(node);
    this.frontNodes.shake(node);
  }

  /** The biggest few gains, stacked with the biggest on top. */
  private gains(x: number, y: number, gained: Amounts, limit = 3): void {
    this.floaters.addStack(x, y, gainLines(gained, limit), 0xffffff, this.floatSize());
  }

  private handle(event: GameEvent): void {
    switch (event.type) {
      case "gathered": {
        // The nearest tree still standing takes the swing; with all of them down, only the gain shows.
        const standing = this.backNodes.standing("tree")[0];
        if (standing) {
          const tree = this.nodePosition(standing);
          this.particles.spawn("leaves", tree.x, tree.y - 120, 14, 0x5c9b4a);
          this.shakeNode(standing);
        }
        const total: Amounts = { ...event.gained };
        for (const [id, amount] of Object.entries(event.bonus))
          total[id] = (total[id] ?? 0) + amount;
        this.gains(BASE_X, GROUND - 210, total);
        break;
      }
      case "tool_upgraded":
        this.particles.spawn("sparks", BASE_X, GROUND - 120, 16, 0xffd25a);
        this.floaters.add(
          BASE_X,
          GROUND - 270,
          toolName(event.tool),
          0xffd25a,
          this.floatSize(1.2),
        );
        break;
      case "building_started": {
        const spot = this.base.buildingPosition(event.building) ?? { x: BASE_X, y: GROUND };
        this.particles.spawn("dust", spot.x, spot.y, 12, 0xc9b78a);
        break;
      }
      case "building_done": {
        // What's new: dust, sparks and the name rising where it now stands.
        const spot = this.base.buildingPosition(event.building) ?? { x: BASE_X, y: GROUND };
        this.particles.spawn("dust", spot.x, spot.y, 18, 0xc9b78a);
        this.particles.spawn("sparks", spot.x, spot.y - 50, 18, 0xffd25a);
        const name = t(`building.${event.building}.name`);
        const label =
          event.level > 1 ? t("hud.building_level", { building: name, level: event.level }) : name;
        this.floaters.add(spot.x, spot.y - 110, label, 0xffd25a, this.floatSize(1.1));
        break;
      }
      case "building_decayed":
        this.particles.spawn("dust", BASE_X, GROUND, 16, 0x8a7a5a);
        break;
      case "craft_queued": {
        const spot = this.base.stationPosition(event.station) ?? { x: BASE_X, y: GROUND };
        this.particles.spawn("dust", spot.x, spot.y, 6, 0xc9b78a);
        break;
      }
      case "collected":
        this.gains(BASE_X, GROUND - 210, event.gained);
        break;
      case "build_started":
        this.particles.spawn("dust", BASE_X, GROUND, 20, 0xc9b78a);
        break;
      case "build_done": {
        this.scaffoldTier = null;
        this.base.setTier(event.tier, true);
        this.particles.spawn("dust", BASE_X, GROUND, 30, 0xc9b78a);
        this.particles.spawn("sparks", BASE_X, GROUND - 120, 24, 0xffd25a);
        this.floaters.add(
          BASE_X,
          GROUND - 270,
          t("hud.tier_base", { tier: tierName(event.tier) }),
          0xffd25a,
          this.floatSize(1.3),
        );
        break;
      }
      case "crafted": {
        // From the station that made it: "+10 Planks" as each unit lands.
        const spot = this.base.stationPosition(event.station) ?? { x: BASE_X, y: GROUND };
        this.particles.spawn("sparks", spot.x, spot.y - 44, event.done ? 16 : 6);
        const text = `+${abbrev(event.amount)} ${outputName(event.recipe)}`;
        this.floaters.add(spot.x, spot.y - 80, text, 0xffffff, this.floatSize());
        break;
      }
      case "smelt_started": {
        const spot = this.base.stationPosition("furnace");
        if (spot) this.particles.spawn("sparks", spot.x, spot.y - 30, 20);
        break;
      }
      case "furnace_out": {
        const spot = this.base.stationPosition("furnace") ?? { x: BASE_X, y: GROUND };
        this.gains(spot.x, spot.y - 100, event.gained);
        break;
      }
      case "barrel_spawned":
        this.particles.spawn("splash", BARREL_SPOT.x, BARREL_SPOT.y, 24);
        break;
      case "barrel_broken":
        this.particles.spawn("stone", BARREL_SPOT.x, BARREL_SPOT.y - 30, 14, 0x4a6b8a);
        this.particles.spawn("coins", BARREL_SPOT.x, BARREL_SPOT.y - 40, 10);
        this.gains(BARREL_SPOT.x, BARREL_SPOT.y - 100, event.gained);
        break;
      case "node_hit": {
        // Rises from where the player hit, just clear of the cursor: the gain, then the count.
        const spot = this.nodePosition(event.node);
        const at = this.lastHit ?? { x: spot.x, y: spot.y - 60 };
        const lines = gainLines(event.gained, 1);
        if (event.hits <= MAX_HITS) lines.push(`${event.hits}/${MAX_HITS}`);
        this.floaters.retire(this.hitText);
        this.hitText = this.floaters.addStack(
          at.x,
          at.y - 22 / this.scale,
          lines,
          0xffffff,
          this.floatSize(0.85),
        );
        break;
      }
      case "task_done":
        this.gains(BASE_X, GROUND - 300, event.reward);
        break;
      case "node_depleted": {
        const spot = this.nodePosition(event.node);
        const debris = debrisFor(event.kind);
        if (event.kind === "tree") {
          this.particles.spawn("leaves", spot.x, spot.y - 110, 10, debris.color);
        } else {
          // The rock breaks apart: chunks of it, the mineral, and a puff of dust.
          this.particles.spawn("stone", spot.x, spot.y - 30, 22, 0x9aa0a6);
          this.particles.spawn(debris.kind, spot.x, spot.y - 30, 12, debris.color);
          this.particles.spawn("dust", spot.x, spot.y, 10, 0xc9b78a);
        }
        break;
      }
      case "node_respawned": {
        const spot = this.nodePosition(event.node);
        const debris = debrisFor(event.kind);
        this.particles.spawn("dust", spot.x, spot.y, 6, 0xc9b78a);
        this.particles.spawn(debris.kind, spot.x, spot.y - 20, 6, debris.color);
        break;
      }
      case "weather":
      case "auto_collect":
      case "upkeep_paid":
      case "decayed":
        break;
    }
  }
}

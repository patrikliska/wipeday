/**
 * Owns the Pixi application and the camera, stacks the layers, and turns
 * store state and events into motion. Game state only ever changes through
 * store actions; the scene reads it once per frame.
 */

import type { Amounts } from "@wipe-day/content/schema";
import { furnaceOf, furnaceSlots, jobProgress } from "@wipe-day/domain/base";
import { nodeKindOf } from "@wipe-day/domain/nodes";
import { Application, Container, Graphics, type Ticker } from "pixi.js";
import { countFrame, isFrozen } from "../debug";
import { type GameEvent, on } from "../state/events";
import { seasonTime, useWorld } from "../state/store";
import {
  content,
  dayFraction,
  duration,
  gainLines,
  itemName,
  nodeName,
  SURVIVORS,
  t,
  tierName,
  toolName,
} from "../state/world";
import { Actors } from "./actors";
import { Base } from "./base";
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
const SHORE_X = 540;
const BASE_X = 1000;
/** Sky and ground continue this far past the stage so no screen shape shows an edge. */
const EXTEND = 800;
/** Narrow screens always see at least this many world units across... */
const MIN_VISIBLE_W = 760;
/** ...centred here, so the base and the shore both fit on a phone. */
const FOCUS_X = 845;

const BACK_NODES: NodeDef[] = [
  { id: "tree_1", kind: "tree", x: 834, y: GROUND + 2, scale: 1, fall: -1 },
  { id: "tree_2", kind: "tree", x: 1240, y: GROUND + 2, scale: 1.15 },
  { id: "tree_3", kind: "tree", x: 1470, y: GROUND + 6, scale: 0.95 },
  { id: "tree_4", kind: "tree", x: 1560, y: GROUND + 2, scale: 1.05 },
];
const FRONT_NODES: NodeDef[] = [
  { id: "ore_1", kind: "ore", x: 705, y: GROUND + 30, scale: 1 },
  { id: "stone_1", kind: "stone", x: 1150, y: GROUND + 52, scale: 0.8 },
  { id: "sulfur_1", kind: "sulfur", x: 1350, y: GROUND + 84, scale: 0.85 },
];
const BARREL_SPOT = { x: 540, y: GROUND + 62 };

const ALL_NODES = [...BACK_NODES, ...FRONT_NODES];
const nodeKind = new Map(ALL_NODES.map((node) => [node.id, node.kind]));

function debrisFor(kind: string): { kind: "leaves" | "stone"; color: number } {
  if (kind === "tree") return { kind: "leaves", color: 0x5c9b4a };
  if (kind === "fibre") return { kind: "leaves", color: 0xa8c060 };
  if (kind === "sulfur") return { kind: "stone", color: 0xe3c04f };
  if (kind === "ore") return { kind: "stone", color: 0xa8603a };
  return { kind: "stone", color: 0x9aa0a6 };
}

export class Scene {
  private readonly app = new Application();
  private readonly world = new Container();
  /** Multiplied over the world: white by day, blue at night. Screen space. */
  private readonly ambient = new Graphics();
  /** World-aligned top layer: the node markers, above every effect and the weather. */
  private readonly markers = new Container();
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
  private readonly actors: Actors;
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
          return false;
        }
        return true;
      },
      onHit: (node, hits, x, y) => {
        const debris = debrisFor(node.kind);
        this.particles.spawn(debris.kind, x, y, 10, debris.color);
        this.lastHit = { x, y };
        // The domain banks the hit (and the perfect bonus on the last one); effects follow its events.
        useWorld.getState().hitNode(hits);
      },
      onRunOver: (_node, hits, perfect, x, y) => {
        // At the marker, where the eye already is; "Perfect!" sits above the bonus gain.
        this.floaters.retire(this.hitText);
        if (perfect) {
          this.floaters.add(
            x,
            y - 62 / this.scale,
            t("hud.perfect"),
            0xffd25a,
            this.floatSize(1.2),
          );
          this.particles.spawn("coins", x, y, 12);
        } else if (hits > 0) {
          this.floaters.add(x, y - 22 / this.scale, t("hud.missed"), 0xa49e93, this.floatSize());
        }
        useWorld.getState().endRun(perfect);
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
    const spots = ALL_NODES.map((node) => ({ id: node.id, x: node.x }));
    this.actors = new Actors(SURVIVORS, GROUND, BASE_X, spots, BASE_X + 340, {
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
    this.lights.addChild(this.base.lights);
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

  /** State-driven visuals, cheap enough to run every frame. */
  private sync(): void {
    const state = useWorld.getState();
    const { base, now } = state;
    this.base.setTier(base.tier, false);
    const tierJob = base.construction.find((job) => job.target.kind === "tier");
    const scaffold = tierJob?.target.kind === "tier" ? tierJob.target.tier : null;
    if (scaffold !== this.scaffoldTier) {
      this.scaffoldTier = scaffold;
      this.base.showScaffold(scaffold);
    }
    const count = (ids: string[]) => ids.reduce((sum, id) => sum + (base.items[id] ?? 0), 0);
    const built = (id: string) => base.buildings[id] ?? 0;
    const furnace = furnaceOf(content, base);
    this.base.setStations({
      furnace: furnace !== null,
      furnaceSlots: Math.max(1, furnaceSlots(content, base)),
      // The scene draws one workbench and one pile of crates, whatever their level or size.
      items: {
        workbench: built("workbench"),
        crate: count(["crate", "large_crate"]),
        campfire: built("campfire"),
        kiln: built("kiln"),
        press: built("press"),
        lantern: built("lights"),
      },
    });
    this.base.setFurnaceActive(
      furnace !== null && base.furnaceJobs.some((job) => jobProgress(job, now) < job.amount),
    );
    this.barrel.set(base.barrel !== null && now <= base.barrel.expiresAt);
    const depleted: Record<string, Depleted> = {};
    for (const [id, until] of Object.entries(base.depleted)) {
      const kind = nodeKindOf(content, id);
      if (kind) depleted[id] = { kind: kind.id, at: until - kind.respawnSeconds, until };
    }
    this.backNodes.sync(depleted, now);
    this.frontNodes.sync(depleted, now);
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
    this.sync();
    const state = useWorld.getState();
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
      case "building_started":
        this.particles.spawn("dust", BASE_X, GROUND, 12, 0xc9b78a);
        break;
      case "building_done":
        this.particles.spawn("sparks", BASE_X, GROUND - 60, 18, 0xffd25a);
        break;
      case "building_decayed":
        this.particles.spawn("dust", BASE_X, GROUND, 16, 0x8a7a5a);
        break;
      case "craft_queued": {
        const spot = this.base.stationPosition("workbench") ?? { x: BASE_X, y: GROUND };
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
        const spot = this.base.stationPosition("workbench") ?? { x: BASE_X, y: GROUND };
        this.particles.spawn("sparks", spot.x, spot.y - 44, 16);
        this.floaters.add(spot.x, spot.y - 80, itemName(event.item), 0xffffff, this.floatSize());
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

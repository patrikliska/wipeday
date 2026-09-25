/**
 * Owns the Pixi application and the camera, stacks the layers, and turns
 * store state and events into motion. Game state only ever changes through
 * store actions; the scene reads it once per frame.
 */
import { Application, Container, Graphics, type Ticker } from "pixi.js";
import { countFrame } from "../debug";
import { type GameEvent, on } from "../state/events";
import { useWorld } from "../state/store";
import {
  abbrev,
  dayFraction,
  FURNACE_RATE,
  itemById,
  type ResourceId,
  resourceById,
  tierById,
} from "../state/world";
import { Actors } from "./actors";
import { Base } from "./base";
import { Floaters, Particles, Weather } from "./effects";
import { Barrel, MAX_HITS, type NodeCallbacks, type NodeDef, Nodes } from "./nodes";
import { gloom, paletteAt } from "./palette";
import { Sky } from "./sky";
import { Terrain } from "./terrain";
import { clamp, lerp } from "./util";

/** Design space: a 16:9 stage, the ground line a little below centre. */
const W = 1600;
const H = 900;
const HORIZON = 520;
const GROUND = 560;
const SHORE_X = 480;
const BASE_X = 1000;
/** Sky and ground continue this far past the stage so no screen shape shows an edge. */
const EXTEND = 800;
/** Narrow screens always see at least this many world units across... */
const MIN_VISIBLE_W = 760;
/** ...centred here, so the base and the shore both fit on a phone. */
const FOCUS_X = 930;

const BACK_NODES: NodeDef[] = [
  { id: "tree_1", kind: "tree", x: 820, y: GROUND + 2, scale: 1 },
  { id: "tree_2", kind: "tree", x: 1240, y: GROUND + 2, scale: 1.15 },
  { id: "tree_3", kind: "tree", x: 1470, y: GROUND + 6, scale: 0.95 },
  { id: "tree_4", kind: "tree", x: 1560, y: GROUND + 2, scale: 1.05 },
];
const FRONT_NODES: NodeDef[] = [
  { id: "ore_1", kind: "ore", x: 600, y: GROUND + 30, scale: 1 },
  { id: "fibre_1", kind: "fibre", x: 720, y: GROUND + 96, scale: 1 },
  { id: "sulfur_1", kind: "sulfur", x: 1350, y: GROUND + 84, scale: 0.85 },
];
const BARREL_SPOT = { x: 540, y: GROUND + 62 };

type Amounts = Partial<Record<ResourceId, number>>;

function debrisFor(node: string): { kind: "leaves" | "stone"; color: number } {
  if (node.startsWith("tree")) return { kind: "leaves", color: 0x5c9b4a };
  if (node.startsWith("fibre")) return { kind: "leaves", color: 0xa8c060 };
  if (node.startsWith("sulfur")) return { kind: "stone", color: 0xe3c04f };
  return { kind: "stone", color: 0x9aa0a6 };
}

export class Scene {
  private readonly app = new Application();
  private readonly world = new Container();
  /** Multiplied over the world: white by day, blue at night. Screen space. */
  private readonly ambient = new Graphics();
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
      onStart: () => undefined,
      onHit: (node, hits, x, y) => {
        const debris = debrisFor(node);
        this.particles.spawn(debris.kind, x, y, 10, debris.color);
        this.floaters.add(x, y - 20, `${hits}/${MAX_HITS}`, 0xffffff, this.floatSize(0.9));
        useWorld.getState().bankNodeHit(node, hits);
      },
      onRunOver: (node, perfect) => {
        const spot = this.nodePosition(node);
        if (perfect) {
          this.floaters.add(spot.x, spot.y - 150, "Perfect!", 0xffd25a, this.floatSize(1.3));
          this.particles.spawn("coins", spot.x, spot.y - 80, 12);
          useWorld.getState().bankNodeHit(node, MAX_HITS + 1);
        } else {
          this.floaters.add(spot.x, spot.y - 150, "Missed", 0xa49e93, this.floatSize());
        }
      },
    };
    this.backNodes = new Nodes(BACK_NODES, callbacks);
    this.frontNodes = new Nodes(FRONT_NODES, callbacks);
    this.barrel = new Barrel(BARREL_SPOT.x, BARREL_SPOT.y, () => useWorld.getState().breakBarrel());
    const spots = [...BACK_NODES, ...FRONT_NODES].map((node) => ({ id: node.id, x: node.x }));
    this.actors = new Actors(useWorld.getState().survivors, GROUND, BASE_X, spots, BASE_X + 340, {
      onWork: (node, x, y) => {
        this.shakeNode(node);
        const debris = debrisFor(node);
        this.particles.spawn(debris.kind, x + 12, y, 3, debris.color);
      },
      onDeliver: (x, y) => this.particles.spawn("dust", x, y + 50, 4),
    });
    this.base.container.position.set(BASE_X, GROUND);
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
      this.floaters.container,
      this.weather.container,
    );
    this.unsubscribe = on((event) => this.handle(event));
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
    this.base.setTier(state.tier, false);
    const scaffold = state.build?.tier ?? null;
    if (scaffold !== this.scaffoldTier) {
      this.scaffoldTier = scaffold;
      this.base.showScaffold(scaffold);
    }
    this.base.setStations({
      furnace: state.furnace.owned,
      furnaceSlots: tierById.get(state.tier)?.furnaceSlots ?? 1,
      items: state.items,
    });
    this.base.setFurnaceActive(
      state.furnace.jobs.some(
        (job) => (FURNACE_RATE * (state.clock - job.startedAt)) / 3600 < job.amount,
      ),
    );
    this.barrel.set(state.barrel !== null);
    this.weather.set(state.weather);
  }

  private readonly frame = (ticker: Ticker): void => {
    const dt = Math.min(0.05, ticker.deltaMS / 1000);
    this.time += dt;
    this.step(dt);
    countFrame();
  };

  private step(dt: number): void {
    this.layout();
    useWorld.getState().tick(dt);
    this.sync();
    const state = useWorld.getState();
    const fraction = dayFraction(state.clock);
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
    this.floaters.container.position.copyFrom(this.world.position);
    this.floaters.container.scale.copyFrom(this.world.scale);

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

  private floatSize(multiplier = 1): number {
    return clamp(22 / this.scale, 22, 46) * multiplier;
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

  /** "+214 Timber" for the biggest few gains, stacked. */
  private gains(x: number, y: number, gained: Amounts, limit = 3): void {
    const entries = Object.entries(gained)
      .map(([id, amount]) => [id as ResourceId, amount ?? 0] as const)
      .filter(([, amount]) => amount >= 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
    entries.forEach(([id, amount], index) => {
      const name = resourceById.get(id)?.name ?? id;
      this.floaters.add(
        x,
        y - index * (30 / this.scale),
        `+${abbrev(amount)} ${name}`,
        0xffffff,
        this.floatSize(),
      );
    });
  }

  private handle(event: GameEvent): void {
    switch (event.type) {
      case "gathered": {
        const tree = this.nodePosition("tree_1");
        this.particles.spawn("leaves", tree.x, tree.y - 120, 14, 0x5c9b4a);
        this.shakeNode("tree_1");
        this.gains(BASE_X, GROUND - 210, event.gained);
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
        const name = tierById.get(event.tier)?.name ?? event.tier;
        this.floaters.add(BASE_X, GROUND - 270, `${name} base`, 0xffd25a, this.floatSize(1.3));
        break;
      }
      case "crafted": {
        const spot = this.base.stationPosition("workbench") ?? { x: BASE_X, y: GROUND };
        this.particles.spawn("sparks", spot.x, spot.y - 44, 16);
        this.floaters.add(
          spot.x,
          spot.y - 80,
          itemById.get(event.item)?.name ?? event.item,
          0xffffff,
          this.floatSize(),
        );
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
        const spot = this.nodePosition(event.node);
        this.gains(spot.x + 40, spot.y - 150, event.gained, 1);
        break;
      }
      case "task_done":
        this.floaters.add(BASE_X, GROUND - 300, event.name, 0x7fa043, this.floatSize(1.1));
        break;
      case "node_run_over":
      case "weather":
        break;
    }
  }
}

/**
 * Survivors walking about, and a couple of gulls. Simple figures with a hat
 * colour each; a portrait pipeline can replace them without touching the
 * behaviour.
 */
import { Container, Graphics } from "pixi.js";
import type { Survivor } from "../state/world";
import { CLOTHES, SKIN } from "./palette";
import { hash, pick, rand } from "./util";

type Activity = "idle" | "walk" | "work" | "rest";

interface Actor {
  survivor: Survivor;
  container: Container;
  legs: [Graphics, Graphics];
  body: Container;
  carry: Graphics;
  x: number;
  targetX: number;
  activity: Activity;
  timer: number;
  facing: 1 | -1;
  phase: number;
  workNode: string | null;
}

export interface Spot {
  id: string;
  x: number;
}

export interface ActorCallbacks {
  onWork: (node: string, x: number, y: number) => void;
  onDeliver: (x: number, y: number) => void;
}

function drawFigure(
  survivor: Survivor,
  index: number,
): Pick<Actor, "container" | "legs" | "body" | "carry"> {
  const container = new Container();
  const shadow = new Graphics().ellipse(0, 0, 14, 4).fill({ color: 0x000000, alpha: 0.28 });
  const legA = new Graphics().roundRect(-7, -22, 6, 22, 3).fill(0x2f2a26);
  const legB = new Graphics().roundRect(1, -22, 6, 22, 3).fill(0x2f2a26);
  const body = new Container();
  const torso = new Graphics();
  const clothes = CLOTHES[index % CLOTHES.length] ?? 0x4a5d6e;
  torso.roundRect(-11, -52, 22, 32, 7).fill(clothes);
  torso.rect(-11, -34, 22, 4).fill({ color: 0x000000, alpha: 0.15 });
  torso.roundRect(-16, -50, 6, 22, 3).fill(clothes);
  torso.roundRect(10, -50, 6, 22, 3).fill(clothes);
  const head = new Graphics();
  head.circle(0, -62, 10).fill(SKIN);
  head.circle(-3, -63, 1.4).fill(0x2a1e14).circle(3, -63, 1.4).fill(0x2a1e14);
  const hatColor = Number.parseInt(survivor.hat.slice(1), 16);
  head.roundRect(-12, -76, 24, 9, 3).fill(hatColor).rect(-14, -68, 28, 3).fill(hatColor);
  const carry = new Graphics();
  carry.visible = false;
  carry.rect(-9, -84, 18, 12).fill(0x9a6a3a).rect(-9, -84, 18, 3).fill(0xb07840);
  body.addChild(torso, head, carry);
  container.addChild(shadow, legA, legB, body);
  return { container, legs: [legA, legB], body, carry };
}

export class Actors {
  readonly container = new Container();
  private readonly actors: Actor[] = [];
  private readonly gulls: Array<{
    g: Graphics;
    x: number;
    y: number;
    speed: number;
    phase: number;
  }> = [];
  private time = 0;
  private night = false;

  constructor(
    survivors: Survivor[],
    private readonly ground: number,
    private readonly homeX: number,
    private readonly spots: Spot[],
    private readonly restX: number,
    private readonly callbacks: ActorCallbacks,
  ) {
    for (const [index, survivor] of survivors.entries()) {
      const figure = drawFigure(survivor, index);
      const x = homeX + (index - 1) * 60;
      figure.container.position.set(x, ground + 6);
      this.container.addChild(figure.container);
      this.actors.push({
        survivor,
        ...figure,
        x,
        targetX: x,
        activity: "idle",
        timer: rand(1, 4),
        facing: 1,
        phase: hash(index * 4.2) * 6,
        workNode: null,
      });
    }
    for (let i = 0; i < 3; i++) {
      const g = new Graphics();
      this.gulls.push({
        g,
        x: rand(-100, 500),
        y: rand(120, 300),
        speed: rand(18, 34),
        phase: rand(0, 6),
      });
      this.container.addChild(g);
    }
  }

  setNight(night: boolean): void {
    this.night = night;
  }

  update(dt: number, wind: number): void {
    this.time += dt;
    for (const actor of this.actors) {
      actor.timer -= dt;
      switch (actor.activity) {
        case "idle": {
          actor.legs[0].rotation = 0;
          actor.legs[1].rotation = 0;
          actor.body.rotation = 0;
          actor.body.y = Math.sin(this.time * 2 + actor.phase) * 1.2;
          if (actor.timer <= 0) {
            actor.activity = "walk";
            if (this.night) {
              actor.targetX = this.restX + rand(-40, 40);
              actor.workNode = null;
            } else if (Math.random() < 0.7 && this.spots.length > 0) {
              const spot = pick(this.spots);
              actor.workNode = spot.id;
              actor.targetX = spot.x + rand(-30, 30);
            } else {
              actor.targetX = this.homeX + rand(-160, 160);
              actor.workNode = null;
            }
          }
          break;
        }
        case "walk": {
          const dx = actor.targetX - actor.x;
          if (dx > 0) actor.facing = 1;
          else if (dx < 0) actor.facing = -1;
          if (Math.abs(dx) < 3) {
            actor.x = actor.targetX;
            if (actor.workNode) {
              actor.activity = "work";
              actor.timer = rand(2.5, 4.5);
            } else if (this.night) {
              actor.activity = "rest";
              actor.timer = rand(6, 12);
            } else {
              actor.activity = "idle";
              actor.timer = rand(1.5, 4);
              if (actor.carry.visible) {
                actor.carry.visible = false;
                this.callbacks.onDeliver(actor.x, this.ground - 60);
              }
            }
          } else {
            actor.x += actor.facing * 46 * dt;
            const step = Math.sin(this.time * 11 + actor.phase);
            actor.legs[0].rotation = step * 0.5;
            actor.legs[1].rotation = -step * 0.5;
            actor.body.y = Math.abs(Math.cos(this.time * 11 + actor.phase)) * -2;
          }
          break;
        }
        case "work": {
          actor.body.rotation = Math.sin(this.time * 9) * 0.12;
          actor.body.y = 0;
          if (actor.workNode && Math.random() < dt * 2.2)
            this.callbacks.onWork(actor.workNode, actor.x, this.ground - 50);
          if (actor.timer <= 0) {
            actor.body.rotation = 0;
            actor.carry.visible = true;
            actor.workNode = null;
            actor.targetX = this.homeX + rand(-120, 120);
            actor.activity = "walk";
          }
          break;
        }
        case "rest": {
          actor.legs[0].rotation = 0;
          actor.legs[1].rotation = 0;
          actor.body.rotation = 0;
          actor.body.y = 6 + Math.sin(this.time * 1.2 + actor.phase) * 1.5;
          if (actor.timer <= 0 || !this.night) {
            actor.activity = "idle";
            actor.timer = rand(1, 3);
          }
          break;
        }
      }
      actor.container.x = actor.x;
      actor.container.scale.x = actor.facing;
    }

    for (const gull of this.gulls) {
      gull.x += (gull.speed + wind * 2) * dt;
      if (gull.x > 1900) gull.x = -200;
      const y = gull.y + Math.sin(this.time * 0.8 + gull.phase) * 14;
      const flap = Math.sin(this.time * 7 + gull.phase) * 5;
      gull.g.clear();
      gull.g
        .moveTo(gull.x - 12, y + flap)
        .quadraticCurveTo(gull.x - 6, y - 3, gull.x, y)
        .quadraticCurveTo(gull.x + 6, y - 3, gull.x + 12, y + flap)
        .stroke({ width: 2, color: 0xe8ecf0, alpha: this.night ? 0.25 : 0.85 });
    }
  }
}

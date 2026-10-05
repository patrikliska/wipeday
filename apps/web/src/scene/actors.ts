/**
 * Survivors walking about, and a couple of gulls. Simple figures with a hat
 * colour each; a portrait pipeline can replace them without touching the
 * behaviour. The cast follows the crew: newcomers and returning parties walk
 * up from the shore, those leaving on a mission walk down to it, and the
 * injured rest by the fire. With a job (W4b) they keep to their post: a node
 * worker works that node and carries the haul home, a station worker works at
 * the station, a guard stands watch by the gate, and a sleeper lies by the fire
 * with a "z" over them, day or night. The free wander.
 */
import { Container, Graphics } from "pixi.js";
import type { SurvivorLook } from "../state/world";
import { CLOTHES, SKIN } from "./palette";
import { hash, rand, shade } from "./util";

type Activity = "idle" | "walk" | "work" | "rest" | "leave";

interface Actor {
  survivor: SurvivorLook;
  container: Container;
  legs: [Graphics, Graphics];
  /** Back arm, front arm; they hang from the shoulder. */
  arms: [Graphics, Graphics];
  body: Container;
  carry: Graphics;
  x: number;
  targetX: number;
  activity: Activity;
  timer: number;
  facing: 1 | -1;
  phase: number;
  workNode: string | null;
  post: Post | null;
  /** The "z" over a sleeper. */
  zz: Graphics;
}

/** Where a survivor's job keeps them. `node`: work that node; otherwise stand at `x`. */
export interface Post {
  kind: "node" | "station" | "guard" | "sleep";
  x: number;
  node?: string;
}

export interface ActorCallbacks {
  /** False for worked-out nodes: survivors do not chop at stumps. */
  canWork: (node: string) => boolean;
  onWork: (node: string, x: number, y: number) => void;
  onDeliver: (x: number, y: number) => void;
}

const TROUSERS = [0x3b3f45, 0x4a4035, 0x36403a, 0x44394a];
const HAIR = [0x2a1e14, 0x5a3a22, 0x8a6a3a, 0x1b1a18, 0x6e2e1e];
const BOOT = 0x2a211a;
const LEATHER = 0x6b4423;

/** A leg hanging from the hip (its origin): trouser, then a boot with the toe forward. */
function drawLeg(trousers: number, back: boolean): Graphics {
  const leg = new Graphics();
  const tone = back ? shade(trousers, -0.25) : trousers;
  leg.roundRect(-3.5, -1, 7, 17, 3).fill(tone);
  leg.roundRect(-3.5, 14, 11, 8, 3).fill(back ? shade(BOOT, -0.2) : BOOT);
  leg.rect(-3.5, 14, 7, 2).fill({ color: 0x000000, alpha: 0.25 });
  return leg;
}

/** An arm hanging from the shoulder (its origin): sleeve, cuff, hand. */
function drawArm(clothes: number, back: boolean, armband: boolean): Graphics {
  const arm = new Graphics();
  const tone = back ? shade(clothes, -0.28) : clothes;
  arm.roundRect(-3, -2, 6.5, 19, 3).fill(tone);
  arm.rect(-3, 13, 6.5, 3).fill(shade(tone, -0.2));
  arm.circle(0.3, 19, 3.2).fill(back ? shade(SKIN, -0.2) : SKIN);
  if (armband) {
    arm.rect(-3, 3, 6.5, 5).fill(0xf2efe8);
    arm.rect(-0.5, 3.6, 1.6, 3.8).fill(0xd23a2a).rect(-1.6, 4.7, 3.8, 1.6).fill(0xd23a2a);
  }
  return arm;
}

function drawHat(g: Graphics, style: number, color: number): void {
  const band = shade(color, -0.3);
  if (style === 0) {
    // Cap with the peak forward.
    g.moveTo(-9, -66)
      .quadraticCurveTo(-8, -77, 1, -77)
      .quadraticCurveTo(10, -76, 10, -66)
      .fill(color);
    g.roundRect(6, -68, 10, 3, 1.5).fill(band);
  } else if (style === 1) {
    // Beanie with a folded rim and a bobble.
    g.moveTo(-9, -65)
      .quadraticCurveTo(-8, -79, 1, -79)
      .quadraticCurveTo(10, -78, 10, -65)
      .fill(color);
    g.roundRect(-10, -68, 21, 5, 2).fill(band);
    g.circle(1, -80, 2.6).fill(shade(color, 0.25));
  } else {
    // Wide brim bush hat.
    g.moveTo(-7, -67)
      .quadraticCurveTo(-6, -78, 1, -78)
      .quadraticCurveTo(8, -78, 9, -67)
      .fill(color);
    g.rect(-7, -70, 16, 3).fill(band);
    g.roundRect(-14, -68, 30, 3.5, 1.75).fill(shade(color, -0.12));
  }
}

function drawFigure(
  survivor: SurvivorLook,
): Pick<Actor, "container" | "legs" | "arms" | "body" | "carry"> {
  const container = new Container();
  const index = survivor.style;
  const clothes = CLOTHES[index % CLOTHES.length] ?? 0x4a5d6e;
  const trousers = TROUSERS[index % TROUSERS.length] ?? 0x3b3f45;
  const hair = HAIR[Math.floor(hash(index * 7.3) * HAIR.length)] ?? 0x2a1e14;
  const hatColor = Number.parseInt(survivor.hat.slice(1), 16);
  const has = (trait: string) => survivor.traits.includes(trait);

  const shadow = new Graphics().ellipse(1, 0, 15, 4).fill({ color: 0x000000, alpha: 0.28 });
  // Legs hang from the hip (their origin), so walking swings the feet, not the hips.
  const legBack = drawLeg(trousers, true);
  legBack.position.set(-2, -22);
  const legFront = drawLeg(trousers, false);
  legFront.position.set(3, -22);

  const body = new Container();
  const armBack = drawArm(clothes, true, false);
  armBack.position.set(-6, -47);
  const armFront = drawArm(clothes, false, has("medic"));
  armFront.position.set(6, -47);

  const pack = new Graphics();
  if (has("scavenger") || has("mule")) {
    const big = has("mule");
    pack.roundRect(big ? -21 : -18, big ? -54 : -49, big ? 13 : 10, big ? 30 : 22, 3).fill(LEATHER);
    pack.rect(big ? -21 : -18, big ? -46 : -42, big ? 13 : 10, 2.5).fill(shade(LEATHER, -0.3));
    if (big) pack.roundRect(-20, -60, 11, 7, 2).fill(0x8a7a5a);
  } else if (has("marksman")) {
    pack.moveTo(-15, -26).lineTo(-3, -62).stroke({ width: 3, color: 0x3a3530 });
    pack.moveTo(-14, -28).lineTo(-10, -40).stroke({ width: 4, color: LEATHER });
  }

  const torso = new Graphics();
  // Hips and jacket, lit from the left like the rest of the scene.
  torso.roundRect(-9, -26, 18, 7, 3).fill(trousers);
  torso
    .moveTo(-10, -46)
    .quadraticCurveTo(-10, -52, -4, -52)
    .lineTo(5, -52)
    .quadraticCurveTo(11, -52, 11, -46)
    .lineTo(10, -22)
    .lineTo(-10, -22)
    .closePath()
    .fill(clothes);
  torso
    .moveTo(5, -52)
    .quadraticCurveTo(11, -52, 11, -46)
    .lineTo(10, -22)
    .lineTo(5, -22)
    .closePath();
  torso.fill({ color: 0x000000, alpha: 0.16 });
  torso.moveTo(-3, -52).lineTo(1, -45).lineTo(5, -52).closePath().fill(shade(clothes, 0.18));
  torso.rect(1, -44, 1.2, 18).fill({ color: 0x000000, alpha: 0.2 });
  torso.roundRect(3, -38, 5, 5, 1).fill({ color: 0x000000, alpha: 0.12 });
  if (has("demolition")) {
    torso.rect(-10, -40, 20.5, 3).fill(0xe8a23a).rect(-10, -33, 20.2, 3).fill(0xe8a23a);
  }
  if (has("scavenger") || has("mule") || has("marksman")) {
    torso
      .moveTo(-8, -51)
      .lineTo(8, -25)
      .stroke({ width: 2.5, color: shade(LEATHER, -0.15) });
  }
  torso.rect(-10, -26, 20, 3.5).fill(0x2e2419);
  torso.rect(2, -26.5, 4, 4.5).fill(0xb8a15a);

  const head = new Graphics();
  head.rect(-2.5, -55, 6, 5).fill(shade(SKIN, -0.15));
  head.circle(1, -62, 9).fill(SKIN);
  // Hair stays inside the head's outline: the back of the head and a sideburn, under the hat.
  head
    .moveTo(-6.5, -56)
    .quadraticCurveTo(-8.6, -60, -7.6, -66)
    .quadraticCurveTo(-4, -71, 4, -70)
    .quadraticCurveTo(-1, -67, -2, -63)
    .quadraticCurveTo(-2.5, -58, -6.5, -56)
    .closePath()
    .fill(hair);
  head.circle(-3, -62, 2.2).fill(shade(SKIN, -0.12));
  head.circle(9.6, -60.5, 1.8).fill(shade(SKIN, -0.08));
  head.circle(5.2, -63, 1.3).fill(0x2a1e14);
  head.rect(3.6, -66.2, 3.5, 1.1).fill(shade(hair, -0.1));
  head.circle(6.5, -58.5, 1.7).fill({ color: 0xd8826a, alpha: 0.35 });
  drawHat(head, index % 3, hatColor);

  const carry = new Graphics();
  carry.visible = false;
  // A crate hugged at chest height; the arms reach round it while carrying.
  carry.roundRect(4, -47, 15, 13, 2).fill(0x9a6a3a);
  carry.rect(4, -47, 15, 2.5).fill(0xb07840).rect(4, -41, 15, 1.5).fill(shade(0x9a6a3a, -0.25));
  body.addChild(armBack, pack, torso, head, armFront, carry);
  container.addChild(shadow, legBack, legFront, body);
  return { container, legs: [legBack, legFront], arms: [armBack, armFront], body, carry };
}

export class Actors {
  readonly container = new Container();
  private actors: Actor[] = [];
  /** Whether the cast has been set once: after that, newcomers walk up from the shore. */
  private cast = false;
  /** Survivors hurt: they stay by the fire. */
  private hurt = new Set<string>();
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
    private readonly ground: number,
    private readonly homeX: number,
    private readonly restX: number,
    private readonly shoreX: number,
    private readonly callbacks: ActorCallbacks,
  ) {
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

  /**
   * The survivors at home now, and who of them is hurt. The first call places them
   * round the door; later, newcomers (arrivals, parties back) walk up from the shore
   * and those gone (on a mission) walk down to it and out of sight.
   */
  sync(
    home: SurvivorLook[],
    hurt: ReadonlySet<string>,
    posts: ReadonlyMap<string, Post> = new Map(),
  ): void {
    this.hurt = new Set(hurt);
    const ids = new Set(home.map((look) => look.id));
    for (const actor of this.actors) {
      if (!ids.has(actor.survivor.id) && actor.activity !== "leave") {
        actor.activity = "leave";
        actor.workNode = null;
        actor.carry.visible = false;
        actor.targetX = this.shoreX;
      }
    }
    for (const [index, look] of home.entries()) {
      const existing = this.actors.find((actor) => actor.survivor.id === look.id);
      if (existing) {
        // Back before they reached the shore: turn round.
        if (existing.activity === "leave") {
          existing.activity = "walk";
          existing.targetX = this.homeX + rand(-120, 120);
        }
        continue;
      }
      const figure = drawFigure(look);
      const zz = new Graphics();
      for (const [dx, dy, size] of [
        [10, -78, 7],
        [18, -90, 5],
      ] as const) {
        zz.moveTo(dx, dy)
          .lineTo(dx + size, dy)
          .lineTo(dx, dy + size)
          .lineTo(dx + size, dy + size)
          .stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
      }
      zz.visible = false;
      figure.container.addChild(zz);
      // Where they are headed: their post (or bed), else round the door.
      const post = posts.get(look.id) ?? null;
      const dest =
        post?.kind === "sleep"
          ? this.restX + rand(-40, 40)
          : post
            ? post.x + rand(-20, 20)
            : this.homeX + (this.cast ? rand(-100, 100) : (index - 1) * 60);
      // The first cast stands where they belong; later arrivals walk up from the shore.
      const x = this.cast ? this.shoreX : dest;
      figure.container.position.set(x, this.ground + 6);
      this.container.addChildAt(figure.container, 0);
      this.actors.push({
        survivor: look,
        ...figure,
        x,
        targetX: dest,
        activity: this.cast ? "walk" : "idle",
        timer: rand(1, 4),
        facing: 1,
        phase: hash(look.style * 4.2) * 6,
        workNode: post?.kind === "node" ? (post.node ?? null) : null,
        post,
        zz,
      });
    }
    for (const actor of this.actors) {
      const post = posts.get(actor.survivor.id) ?? null;
      const changed = JSON.stringify(post) !== JSON.stringify(actor.post);
      actor.post = post;
      // A new post: head there now rather than finishing the old errand.
      if (changed && actor.activity !== "leave" && actor.activity !== "walk") actor.timer = 0;
    }
    this.cast = true;
  }

  /** World x of a survivor in the scene (for floaters), or null when not shown. */
  positionOf(id: string): number | null {
    return this.actors.find((actor) => actor.survivor.id === id)?.x ?? null;
  }

  setNight(night: boolean): void {
    this.night = night;
  }

  update(dt: number, wind: number): void {
    this.time += dt;
    for (const actor of this.actors) {
      actor.timer -= dt;
      const post = actor.post;
      const asleep = post?.kind === "sleep";
      // Workers keep at it through the night (lanterns); the free, the hurt and sleepers rest.
      const resting = asleep || this.hurt.has(actor.survivor.id) || (this.night && post === null);
      actor.zz.visible = asleep && actor.activity === "rest";
      if (actor.zz.visible) actor.zz.y = Math.sin(this.time * 1.5 + actor.phase) * 3;
      switch (actor.activity) {
        case "leave": {
          // Down to the shore and out of sight.
          const dx = actor.targetX - actor.x;
          actor.facing = dx >= 0 ? 1 : -1;
          actor.x += actor.facing * 60 * dt;
          const step = Math.sin(this.time * 11 + actor.phase);
          actor.legs[0].rotation = step * 0.5;
          actor.legs[1].rotation = -step * 0.5;
          actor.container.alpha = Math.min(1, Math.abs(dx) / 40);
          break;
        }
        case "idle": {
          actor.legs[0].rotation = 0;
          actor.legs[1].rotation = 0;
          actor.body.rotation = 0;
          actor.body.y = Math.sin(this.time * 2 + actor.phase) * 1.2;
          if (actor.timer <= 0) {
            actor.activity = "walk";
            actor.workNode = null;
            if (resting) {
              actor.targetX = this.restX + rand(-40, 40);
            } else if (post?.kind === "node" && post.node && this.callbacks.canWork(post.node)) {
              actor.workNode = post.node;
              actor.targetX = post.x + rand(-20, 20);
            } else if (post && post.kind !== "node") {
              // A station or the gate: stand there (a little shuffle keeps them alive).
              actor.targetX = post.x + rand(-12, 12);
            } else if (post?.kind === "node") {
              // Their node is worked out: wait beside it for it to stand again.
              actor.targetX = post.x + rand(-40, 40);
            } else {
              actor.targetX = this.homeX + rand(-160, 160);
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
            } else if (post?.kind === "station" && !resting) {
              // At the station: hands busy, no haul to carry.
              actor.activity = "work";
              actor.timer = rand(5, 9);
              actor.facing = actor.x < post.x ? 1 : -1;
            } else if (resting && Math.abs(actor.x - this.restX) > 60) {
              // Arrived somewhere else (back from the shore): bed is by the fire.
              actor.targetX = this.restX + rand(-40, 40);
            } else if (resting) {
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
            // Each arm swings against the leg on its own side.
            actor.arms[0].rotation = -step * 0.45;
            actor.arms[1].rotation = step * 0.45;
            actor.body.y = Math.abs(Math.cos(this.time * 11 + actor.phase)) * -2;
          }
          break;
        }
        case "work": {
          actor.body.rotation = Math.sin(this.time * 9) * 0.12;
          actor.arms[1].rotation = -1.5 + Math.sin(this.time * 9) * 0.8;
          actor.arms[0].rotation = -0.5 + Math.sin(this.time * 9) * 0.3;
          actor.body.y = 0;
          // The node can go while they work at it: then they stop and head home.
          const gone = actor.workNode !== null && !this.callbacks.canWork(actor.workNode);
          if (actor.workNode && !gone && Math.random() < dt * 2.2)
            this.callbacks.onWork(actor.workNode, actor.x, this.ground - 50);
          // A node worker mostly keeps at it, and walks a haul home about one turn in three.
          const keepAt = actor.post?.kind === "node" && actor.post.node === actor.workNode;
          if (actor.timer <= 0 && !gone && keepAt && Math.random() < 0.65) {
            actor.timer = rand(2.5, 4.5);
            break;
          }
          if (actor.timer <= 0 || gone) {
            actor.body.rotation = 0;
            const station = actor.workNode === null;
            actor.carry.visible = !station;
            actor.workNode = null;
            if (station) {
              // Station work goes on: a short pause, then back at it.
              actor.activity = "idle";
              actor.timer = rand(0.5, 1.5);
            } else {
              actor.targetX = this.homeX + rand(-120, 120);
              actor.activity = "walk";
            }
          }
          break;
        }
        case "rest": {
          actor.legs[0].rotation = 0;
          actor.legs[1].rotation = 0;
          actor.body.rotation = 0;
          actor.body.y = 6 + Math.sin(this.time * 1.2 + actor.phase) * 1.5;
          if (actor.timer <= 0 || !resting) {
            actor.activity = "idle";
            actor.timer = rand(1, 3);
          }
          break;
        }
      }
      if (actor.activity !== "walk" && actor.activity !== "work") {
        actor.arms[0].rotation = Math.sin(this.time * 2 + actor.phase) * 0.04;
        actor.arms[1].rotation = -Math.sin(this.time * 2 + actor.phase) * 0.04;
      }
      if (actor.carry.visible) {
        actor.arms[0].rotation = -0.95;
        actor.arms[1].rotation = -1.15;
      }
      actor.container.x = actor.x;
      actor.container.scale.x = actor.facing;
      // Guards face out to sea; nobody else cares which way they stand.
      if (post?.kind === "guard" && actor.activity === "idle") actor.container.scale.x = -1;
      // The "z" reads the right way round whichever way the sleeper faces.
      actor.zz.scale.x = actor.container.scale.x;
    }
    // Those who reached the shore are gone until they come back.
    for (const actor of this.actors.filter((a) => a.activity === "leave")) {
      if (Math.abs(actor.targetX - actor.x) < 4) actor.container.destroy({ children: true });
    }
    this.actors = this.actors.filter((a) => !a.container.destroyed);

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

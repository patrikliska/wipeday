/**
 * The Blast Map's shape and its content checks (docs/redesign/04-blast-map.md 1, 9.3; D268).
 * Browser-safe: the domain's `blastmap.ts` buys and folds, the web draws, and both read the
 * structure from here. The agenda (03-the-big-red.md 12) opens rings by counted Wipe Days.
 */
import { type Effect, isFeatureStat, STATS, type StatId } from "./effects";
import type { Locale } from "./locale";
import type { Problem } from "./parse";
import {
  type AgendaKind,
  type Content,
  type NodeDef,
  SIGN_STYLES,
  type SignStyle,
  waveOf,
} from "./schema";
import { TIERS } from "./tiers";

export const GROUND_ZERO = "ground_zero";

/**
 * The features wave 1's nodes may unlock (04 1.4: a shipped node uses only shipped systems);
 * each is read by the code somewhere, so the list is the contract.
 */
export const FEATURES = [
  "glow",
  "keep_swinging",
  "bulk_buy",
  "lookout_post",
  "hot_breakfast",
  "forecast",
  "personal_best",
  "flight_school",
] as const;
export type Feature = (typeof FEATURES)[number];

/** The agenda's own feature unlocks (never a node's). */
export const AGENDA_FEATURES = ["glow", "afterglow", "crater"] as const;

/** Keystones cost exactly these (04 3.1). */
export const KEYSTONE_COSTS = [7777, 7770000] as const;

const byContent = new WeakMap<Content, Map<string, NodeDef>>();

export function nodeOf(content: Content, id: string): NodeDef | undefined {
  let map = byContent.get(content);
  if (!map) {
    map = new Map(content.blastMap.nodes.map((node) => [node.id, node]));
    byContent.set(content, map);
  }
  return map.get(id);
}

/** The rings whose wave has shipped, in order. */
export function shippedRings(content: Content): number[] {
  const { rings, shippedWave } = content.blastMap;
  return rings.filter((row) => waveOf(row.ring) <= shippedWave).map((row) => row.ring);
}

/** Whether a node is drawn, listed and buyable in this build. */
export const nodeShipped = (content: Content, node: NodeDef): boolean =>
  node.ring === 0 || waveOf(node.ring) <= content.blastMap.shippedWave;

/** The size of ring `ring` (0 for Ground Zero's). */
export function ringSize(content: Content, ring: number): number {
  return content.blastMap.rings.find((row) => row.ring === ring)?.size ?? 0;
}

/** The Wipe Day count that opens `ring` (the agenda), or null when no row names it. */
export function ringGate(content: Content, ring: number): number | null {
  for (const row of content.agenda.rows) if (row.unlocks.includes(`ring:${ring}`)) return row.at;
  return null;
}

/**
 * The agenda's unlocks at exactly Wipe Day `at`, as `[kind, id]` pairs (03 12). Empty for a
 * count that unlocks nothing.
 */
export function agendaAt(content: Content, at: number): [AgendaKind, string][] {
  const row = content.agenda.rows.find((r) => r.at === at);
  return row ? row.unlocks.map(splitUnlock) : [];
}

/** The next counted Wipe Day after `after` that unlocks something, if any. */
export function nextAgendaAt(content: Content, after: number): number | null {
  let best: number | null = null;
  for (const row of content.agenda.rows)
    if (row.at > after && (best === null || row.at < best)) best = row.at;
  return best;
}

/** The sign's style at Wipe Day count `n` (03 10.3). */
export function signStyle(content: Content, n: number): SignStyle {
  let style: SignStyle = "plank";
  for (const row of content.agenda.rows) {
    if (row.at > n) continue;
    for (const unlock of row.unlocks) {
      const [kind, id] = splitUnlock(unlock);
      if (kind === "sign" && (SIGN_STYLES as readonly string[]).includes(id))
        style = id as SignStyle;
    }
  }
  return style;
}

/** The rung up to which hands survive nukes by the agenda at Wipe Day `n` (0: none). */
export function keptRung(content: Content, n: number): number {
  let rung = 0;
  for (const row of content.agenda.rows) {
    if (row.at > n) continue;
    for (const unlock of row.unlocks) {
      const [kind, id] = splitUnlock(unlock);
      if (kind === "hands") rung = Math.max(rung, Number(id));
    }
  }
  return rung;
}

export function splitUnlock(unlock: string): [AgendaKind, string] {
  const [kind = "", id = ""] = unlock.split(":");
  return [kind as AgendaKind, id];
}

/**
 * The default wiring (04 1.3): slot `slot` of a ring with `size` slots takes the previous
 * ring's slots whose angular span overlaps its own (`prev` slots). Ring 1's parent is Ground
 * Zero.
 */
export function defaultParents(size: number, prev: number, slot: number): number[] {
  const out: number[] = [];
  const lo = (slot - 1) / size;
  const hi = slot / size;
  for (let p = 1; p <= prev; p++) {
    if ((p - 1) / prev < hi && p / prev > lo) out.push(p);
  }
  return out;
}

/**
 * The base a stat's `add` effects build on: the 10% rule (04 9.3 check 12) and the node sheet's
 * "Night Shift 2 h -> 6 h" (the web reads the same number the check does).
 */
export function statBase(content: Content, stat: StatId): number | null {
  switch (stat) {
    case "night_shift":
      return content.run.nightShift.windowHours;
    case "flotsam_float":
      return content.flotsam.schedule.floatSeconds;
    case "hustle_hold":
      return content.tap.hustle.graceSeconds;
    case "hustle_gain":
      return content.tap.hustle.perTap;
    case "hustle_max":
      return content.tap.hustle.peak;
    case "afterglow_half":
      return content.prestige.afterglow.halfSeconds;
    case "glow_k":
      return content.prestige.glowK;
    case "tap_share":
      return content.tap.share;
    default:
      return null;
  }
}

const effectKey = (effect: Effect): string =>
  `${effect.stat}|${effect.scope ?? ""}|${effect.when ?? ""}`;

/** The Blast Map's content checks at the shipped wave (04 9.3, the parts that apply). */
export function checkBlastMap(content: Content, locale: Locale): Problem[] {
  const problems: Problem[] = [];
  const add = (id: string, message: string) =>
    problems.push({ file: "blastmap.json5", id, message });
  const { sectors, rings, prices, typeFactor, ceilings, nodes, shippedWave } = content.blastMap;
  const sectorSet = new Set(sectors);
  const ring = new Map(rings.map((row) => [row.ring, row]));
  const shipped = nodes.filter((node) => nodeShipped(content, node));
  const ladder = new Set(prices);

  // 1. Structure: Ground Zero, then every slot of every shipped ring filled once.
  const zero = nodeOf(content, GROUND_ZERO);
  if (zero?.ring !== 0 || zero.sector !== null)
    add(GROUND_ZERO, "Ground Zero must be the one node of ring 0, with no sector");
  const slots = new Map<string, string>();
  for (const node of nodes) {
    if (node.id === GROUND_ZERO) continue;
    if (node.sector === null || !sectorSet.has(node.sector)) {
      add(node.id, `unknown sector \`${node.sector}\``);
      continue;
    }
    const row = ring.get(node.ring);
    if (!row) {
      add(node.id, `ring ${node.ring} is not in \`rings\``);
      continue;
    }
    if (node.slot < 1 || node.slot > row.size)
      add(node.id, `slot ${node.slot} is outside ring ${node.ring}'s ${row.size}`);
    const key = `${node.sector}/${node.ring}.${node.slot}`;
    const taken = slots.get(key);
    if (taken) add(node.id, `slot ${key} is already \`${taken}\``);
    slots.set(key, node.id);
  }
  for (const sector of sectors) {
    for (const r of shippedRings(content)) {
      const size = ring.get(r)?.size ?? 0;
      for (let s = 1; s <= size; s++)
        if (!slots.has(`${sector}/${r}.${s}`)) add("", `${sector} ${r}.${s} is empty`);
    }
  }
  for (const [index, row] of rings.entries()) {
    const before = rings[index - 1];
    if (row.ring !== index + 1) add("", `rings must run 1, 2, 3, ...: found ${row.ring}`);
    if (before && !(row.band[0] > before.band[1]))
      add("", `ring ${row.ring}'s band must start above ring ${before.ring}'s`);
    if (!(row.band[0] < row.band[1])) add("", `ring ${row.ring}'s band is [low, high]`);
  }

  // 2. Names and blurbs.
  for (const node of shipped) {
    const name = locale.has(`node.${node.id}.name`)
      ? locale.t(`node.${node.id}.name`)
      : node.series
        ? locale.t(`node.${node.series}.name`)
        : "";
    if (!name) add(node.id, `missing locale key \`node.${node.id}.name\``);
    if (name.length > 24) add(node.id, `the name is over 24 characters: "${name}"`);
    if (node.type !== "small") {
      const key = `node.${node.id}.blurb`;
      if (!locale.has(key)) add(node.id, `missing locale key \`${key}\``);
      else if (locale.t(key).length > 80) add(node.id, "the blurb is over 80 characters");
    }
  }
  for (const sector of sectors) {
    for (const key of [`sector.${sector}.name`, `sector.${sector}.tagline`])
      if (!locale.has(key)) add(sector, `missing locale key \`${key}\``);
  }

  // 3. Edges: parents in the previous ring of the same sector, 1-3 of them, the default wiring
  //    included; every shipped node reachable from Ground Zero.
  for (const node of nodes) {
    if (node.id === GROUND_ZERO) {
      if (node.requires.length > 0) add(node.id, "Ground Zero needs nothing");
      continue;
    }
    if (node.requires.length < 1 || node.requires.length > 3)
      add(node.id, `a node has 1-3 parents, not ${node.requires.length}`);
    for (const parent of node.requires) {
      const target = nodeOf(content, parent);
      if (!target) {
        add(node.id, `unknown parent \`${parent}\``);
        continue;
      }
      if (node.ring === 1 ? parent !== GROUND_ZERO : target.sector !== node.sector)
        add(node.id, `parent \`${parent}\` is not in this sector`);
      if (target.ring !== node.ring - 1) add(node.id, `parent \`${parent}\` is not one ring in`);
    }
    if (node.ring > 1 && node.type !== "completion") {
      const prev = ring.get(node.ring - 1)?.size ?? 0;
      const size = ring.get(node.ring)?.size ?? 0;
      for (const slot of defaultParents(size, prev, node.slot)) {
        const parent = slots.get(`${node.sector}/${node.ring - 1}.${slot}`);
        if (parent && !node.requires.includes(parent))
          add(node.id, `the default wiring needs \`${parent}\` among its parents`);
      }
    }
    if (node.type === "completion") {
      const prev = ring.get(node.ring - 1)?.size ?? 0;
      if (node.requires.length !== prev) add(node.id, "a completion needs its whole previous ring");
    }
  }
  const reachable = new Set<string>([GROUND_ZERO]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of shipped) {
      if (reachable.has(node.id)) continue;
      if (node.requires.some((parent) => reachable.has(parent))) {
        reachable.add(node.id);
        grew = true;
      }
    }
  }
  for (const node of shipped)
    if (!reachable.has(node.id)) add(node.id, "not reachable from Ground Zero");

  // 7. Never three small nodes in a row on any path (the longest small run ending at each node).
  const smallRun = new Map<string, number>();
  const runOf = (node: NodeDef): number => {
    const known = smallRun.get(node.id);
    if (known !== undefined) return known;
    let longest = 0;
    for (const parent of node.requires) {
      const target = nodeOf(content, parent);
      if (target) longest = Math.max(longest, runOf(target));
    }
    const value = node.type === "small" ? longest + 1 : 0;
    smallRun.set(node.id, value);
    return value;
  };
  for (const node of shipped) if (runOf(node) >= 3) add(node.id, "three small nodes in a row");

  // 8. A scene-changing node per sector per complete band.
  const lastShipped = Math.max(0, ...shippedRings(content));
  for (let band = 1; band * 3 <= lastShipped; band++) {
    for (const sector of sectors) {
      const any = shipped.some(
        (node) =>
          node.sector === sector &&
          node.scene &&
          node.ring > (band - 1) * 3 &&
          node.ring <= band * 3,
      );
      if (!any) add(sector, `no scene-changing node in rings ${(band - 1) * 3 + 1}-${band * 3}`);
    }
  }

  // 9. Prices: on the ladder, inside the ring's band × the type factor; keystones fixed.
  for (const node of nodes) {
    if (node.id === GROUND_ZERO) {
      if (node.cost !== 0) add(node.id, "Ground Zero is never bought: cost 0");
      continue;
    }
    const row = ring.get(node.ring);
    if (!row) continue;
    const factor = typeFactor[node.type] ?? 1;
    if (!ladder.has(node.cost)) add(node.id, `${node.cost} is not on the price ladder`);
    if (node.type === "keystone") {
      if (!(KEYSTONE_COSTS as readonly number[]).includes(node.cost))
        add(node.id, `a keystone costs ${KEYSTONE_COSTS.join(" or ")}`);
    } else if (node.cost < row.band[0] || node.cost > row.band[1] * factor)
      add(node.id, `${node.cost} is outside ring ${node.ring}'s band × ${factor}`);
  }

  // 10-11. Effects: features only on unlock, automation and keystone nodes, from the shipped
  //        list; scopes name real things; a small node has exactly one effect.
  const lines = new Set(content.lines.map((line) => line.id));
  const eras = new Set<string>(TIERS);
  const upgradeKinds = new Set(["grip", "island", "line_mk"]);
  const upgrades = new Set(content.upgrades.map((upgrade) => upgrade.id));
  const flotsam = new Set(content.flotsam.kinds.map((kind) => kind.id));
  for (const node of nodes) {
    if (node.type === "small" && node.effects.length !== 1)
      add(node.id, "a small node has exactly one effect");
    for (const effect of node.effects) {
      if (isFeatureStat(effect.stat)) {
        if (!["unlock", "automation", "keystone"].includes(node.type))
          add(node.id, "`feature:*` belongs to unlock, automation and keystone nodes only");
        const feature = effect.stat.slice("feature:".length);
        if (nodeShipped(content, node) && !(FEATURES as readonly string[]).includes(feature))
          add(
            node.id,
            `feature \`${feature}\` is not in this build (content/blastmap.ts FEATURES)`,
          );
        continue;
      }
      const stat = effect.stat;
      const scope = effect.scope;
      if (scope === undefined) {
        if (stat === "start_owned" || stat === "start_upgrade" || stat === "keep_hand")
          add(node.id, `\`${stat}\` needs a scope`);
        continue;
      }
      const ok =
        stat === "upgrade_cost"
          ? upgradeKinds.has(scope) || upgrades.has(scope)
          : stat === "start_upgrade"
            ? upgrades.has(scope)
            : stat === "start_owned"
              ? lines.has(scope)
              : stat === "start_era"
                ? eras.has(scope) && TIERS[effect.value] === scope
                : stat === "keep_hand"
                  ? lines.has(scope) || eras.has(scope)
                  : stat.startsWith("flotsam_")
                    ? flotsam.has(scope)
                    : scope === "all" || lines.has(scope) || eras.has(scope);
      if (!ok) add(node.id, `\`${stat}\` has an unknown scope \`${scope}\``);
      if (effect.per?.startsWith("sector:") && !sectorSet.has(effect.per.slice("sector:".length)))
        add(node.id, `unknown sector in \`${effect.per}\``);
    }
  }

  // 12. The 10% rule from ring 3 (04 9.3): a small node raises its stat, scope and condition by
  //     at least 10% over every lower-ring node, where the stat's base is known.
  for (const node of shipped) {
    if (node.type !== "small" || node.ring < 3) continue;
    const effect = node.effects[0];
    if (!effect || isFeatureStat(effect.stat)) continue;
    const stat = effect.stat;
    const lower = shipped
      .filter((other) => other.ring < node.ring && other.type !== "keystone")
      .flatMap((other) => other.effects)
      .filter((other) => effectKey(other) === effectKey(effect));
    const sum = (op: string) =>
      lower.filter((e) => e.op === op).reduce((total, e) => total + e.value, 0);
    let ratio = Number.POSITIVE_INFINITY;
    if (effect.op === "inc") ratio = (1 + sum("inc") + effect.value) / (1 + sum("inc"));
    else if (effect.op === "more")
      ratio = STATS[stat].better === "lower" ? 1 / effect.value : effect.value;
    else if (effect.op === "add") {
      const base = statBase(content, stat);
      if (base !== null) ratio = (base + sum("add") + effect.value) / (base + sum("add"));
    }
    if (ratio < 1.1 - 1e-9)
      add(
        node.id,
        `raises \`${effectKey(effect)}\` by ${((ratio - 1) * 100).toFixed(1)}%, under 10%`,
      );
  }

  // 13. Ceilings over every shipped non-keystone node: Σadd for stats the nodes add to, else
  //     (1 + Σinc) × Πmore.
  for (const [stat, ceiling] of Object.entries(ceilings)) {
    const effects = shipped
      .filter((node) => node.type !== "keystone")
      .flatMap((node) => node.effects)
      .filter((effect) => effect.stat === stat);
    if (effects.length === 0) continue;
    const additive = effects.some((effect) => effect.op === "add");
    const value = additive
      ? effects.filter((e) => e.op === "add").reduce((total, e) => total + e.value, 0)
      : effects.reduce(
          (total, e) => (e.op === "more" ? total * e.value : total),
          1 + effects.filter((e) => e.op === "inc").reduce((total, e) => total + e.value, 0),
        );
    const over = additive ? value > ceiling + 1e-9 : value > ceiling * (1 + 1e-9);
    if (over) add("", `\`${stat}\` reaches ${value.toFixed(4)} over its ceiling ${ceiling}`);
  }

  // 15. Gates: every shipped ring opens by the agenda, later rings no earlier; a node's own
  //     gate is at least its ring's.
  let last = 0;
  for (const r of shippedRings(content)) {
    const gate = ringGate(content, r);
    if (gate === null) add("", `ring ${r} has no agenda row (\`ring:${r}\`)`);
    else {
      if (gate < last) add("", `ring ${r} opens before ring ${r - 1}`);
      last = gate;
    }
  }
  for (const node of shipped) {
    const gate = ringGate(content, node.ring) ?? 0;
    if (node.gate !== undefined && node.gate < gate)
      add(node.id, `its gate ${node.gate} is below its ring's ${gate}`);
  }
  if (shippedWave > 1 && !nodes.some((node) => node.type === "keystone"))
    add("", "wave 2 ships keystones");
  return problems;
}

/** The agenda's rows name shipped content only (03 12), each kind checked against its data. */
export function checkAgenda(content: Content, locale: Locale): Problem[] {
  const problems: Problem[] = [];
  const add = (id: string, message: string) => problems.push({ file: "agenda.json5", id, message });
  const rows = content.agenda.rows;
  const shipped = new Set(shippedRings(content));
  const named = new Set<number>();
  for (const [index, row] of rows.entries()) {
    const before = rows[index - 1];
    if (before && !(row.at > before.at)) add(String(row.at), "rows must rise by `at`");
    for (const unlock of row.unlocks) {
      const [kind, id] = splitUnlock(unlock);
      const where = `#${row.at}`;
      switch (kind) {
        case "feature":
          if (!(AGENDA_FEATURES as readonly string[]).includes(id))
            add(where, `unknown feature \`${id}\``);
          break;
        case "ring": {
          const ring = Number(id);
          if (!shipped.has(ring)) add(where, `ring ${id} is not in this build`);
          if (named.has(ring)) add(where, `ring ${id} is named twice`);
          named.add(ring);
          break;
        }
        case "era": {
          const era = content.eras.find((e) => e.id === id);
          if (!era) add(where, `unknown era \`${id}\``);
          else if ((era.requires?.wipeDays ?? 0) !== row.at)
            add(where, `era \`${id}\` opens at Wipe Day #${era.requires?.wipeDays ?? 0}`);
          break;
        }
        case "flight": {
          const flight = content.prestige.flights.variants.find((f) => f.id === id);
          if (!flight) add(where, `unknown flight \`${id}\``);
          else if (flight.unlockAt !== row.at)
            add(where, `flight \`${id}\` unlocks at Wipe Day #${flight.unlockAt}`);
          break;
        }
        case "sign":
          if (!(SIGN_STYLES as readonly string[]).includes(id) || id === "plank")
            add(where, `unknown sign style \`${id}\``);
          break;
        case "hands": {
          const rung = Number(id);
          if (!Number.isInteger(rung) || rung < 1 || rung > content.lines.length)
            add(where, `\`hands:${id}\` names no rung`);
          break;
        }
        default:
          add(where, `unknown unlock kind \`${kind}\``);
      }
      const key = `agenda.${kind}.${id}`;
      if (!locale.has(key)) add(where, `missing locale key \`${key}\``);
    }
  }
  for (const ring of shipped)
    if (!named.has(ring)) add("", `ring ${ring} never opens: no row names \`ring:${ring}\``);
  // Every era with a Wipe Day gate is on the agenda.
  for (const era of content.eras) {
    const at = era.requires?.wipeDays;
    if (
      at !== undefined &&
      !rows.some((row) => row.at === at && row.unlocks.includes(`era:${era.id}`))
    )
      add("", `era \`${era.id}\` opens at Wipe Day #${at} but no row says so`);
  }
  for (const flight of content.prestige.flights.variants) {
    if (!rows.some((row) => row.unlocks.includes(`flight:${flight.id}`)))
      add("", `flight \`${flight.id}\` is on no agenda row`);
  }
  return problems;
}

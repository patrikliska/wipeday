/**
 * Every player action as data, and the one function that applies it. The API
 * runs it inside a transaction, the web client runs it to predict the result
 * before the server answers (and to play offline in demo mode), and the
 * simulator runs it for its archetypes: one rulebook, three callers.
 *
 * `applyCommand` settles first, then applies the command, then records task
 * progress and hint use. A refusal still returns the settled state (settling is
 * always safe to keep) and says why, with what is missing when that helps.
 */
import type { Amounts, Content } from "@wipe-day/content/schema";
import { breakBarrel, progressTasks } from "./active";
import type { Advice } from "./advisor";
import {
  type BaseState,
  collect,
  collectFurnaces,
  gather,
  smelt,
  total,
  upgradeTool,
} from "./base";
import { type BuildStatus, startConstruction } from "./buildings";
import { type CraftStatus, queueCraft } from "./craft";
import type { GameEvent } from "./events";
import { endNodeRun, type HitRefusal, hitNode } from "./nodes";
import { settleAll } from "./settle";

export type Command =
  | { type: "gather" }
  | { type: "collect" }
  | { type: "upgrade_tool" }
  /** `what`: "tier" for the next base tier, or a building id. */
  | { type: "build"; what: string }
  | { type: "smelt"; ore: string }
  | { type: "take_out" }
  | { type: "craft"; item: string }
  | { type: "break_barrel" }
  | { type: "hit_node"; node: string; run: string; hit: number }
  | { type: "end_node_run"; node: string; run: string };

export type CommandType = Command["type"];

/** Why a command did nothing. `missing` and friends let the UI say exactly what to do. */
export type Refusal =
  | { code: "cooldown"; readyAt: number }
  | { code: "maxed" }
  | { code: "unaffordable"; missing: Amounts }
  | Exclude<BuildStatus, { code: "ok" | "unaffordable" | "unknown" | "maxed" }>
  | { code: "no_furnace" }
  | { code: "no_slot" }
  | { code: "nothing_to_smelt" }
  | { code: "not_ore" }
  | { code: "no_barrel" }
  | Exclude<CraftStatus, { code: "ok" | "unaffordable" }>
  | HitRefusal;

export type CommandResult =
  | { ok: true; state: BaseState; events: GameEvent[] }
  | { ok: false; state: BaseState; events: GameEvent[]; refusal: Refusal };

/** Which onboarding hint a command counts as using. */
const HINT_OF: Partial<Record<CommandType, Advice>> = {
  gather: "gather",
  collect: "collect",
  upgrade_tool: "tools",
  build: "build",
  smelt: "furnace",
  take_out: "furnace",
  craft: "craft",
  break_barrel: "barrel",
};

type Step =
  | {
      ok: true;
      state: BaseState;
      events: GameEvent[];
      task?: [Parameters<typeof progressTasks>[2], number];
    }
  | { ok: false; refusal: Refusal; state?: BaseState; events?: GameEvent[] };

function step(content: Content, state: BaseState, command: Command, now: number): Step {
  switch (command.type) {
    case "gather": {
      const result = gather(content, state, now);
      if (!result.ok) return { ok: false, refusal: { code: "cooldown", readyAt: result.readyAt } };
      return {
        ok: true,
        state: result.state,
        events: [{ type: "gathered", gained: result.gained, bonus: result.bonus }],
        task: ["gather", 1],
      };
    }
    case "collect": {
      const result = collect(content, state, now);
      return {
        ok: true,
        state: result.state,
        events: [{ type: "collected", gained: result.gained }],
        task: ["collect", total(result.gained) > 0 ? 1 : 0],
      };
    }
    case "upgrade_tool": {
      const result = upgradeTool(content, state, now);
      if (!result.ok) {
        return {
          ok: false,
          refusal:
            result.reason === "maxed"
              ? { code: "maxed" }
              : { code: "unaffordable", missing: result.missing },
        };
      }
      const events: GameEvent[] = [];
      if (total(result.gained) > 0) events.push({ type: "collected", gained: result.gained });
      events.push({ type: "tool_upgraded", tool: result.tool.id, paid: result.paid });
      return { ok: true, state: result.state, events };
    }
    case "build": {
      const result = startConstruction(content, state, now, command.what);
      if (!result.ok) {
        const { status } = result;
        // An unknown building id is a malformed request, not something to explain.
        return { ok: false, refusal: status.code === "unknown" ? { code: "unknown" } : status };
      }
      return { ok: true, state: result.state, events: result.events };
    }
    case "smelt": {
      const result = smelt(content, state, now, command.ore);
      if (!result.ok) return { ok: false, refusal: { code: result.reason } };
      return {
        ok: true,
        state: result.state,
        events: [
          { type: "smelt_started", ore: command.ore, amount: result.job.amount, fuel: result.fuel },
        ],
        task: ["smelt", result.job.amount],
      };
    }
    case "take_out": {
      const result = collectFurnaces(content, state, now);
      return {
        ok: true,
        state: result.state,
        events: [{ type: "furnace_out", gained: result.gained }],
        task: ["furnace_collect", total(result.gained)],
      };
    }
    case "craft": {
      const result = queueCraft(content, state, command.item, now);
      if (!result.ok) return { ok: false, refusal: result.status };
      return { ok: true, state: result.state, events: result.events, task: ["craft", 1] };
    }
    case "break_barrel": {
      const result = breakBarrel(content, state, now);
      if (!result.ok) return { ok: false, refusal: { code: "no_barrel" } };
      return {
        ok: true,
        state: result.state,
        events: [{ type: "barrel_broken", gained: result.gained }],
        task: ["barrel", 1],
      };
    }
    case "hit_node": {
      const result = hitNode(content, state, now, command.node, command.run, command.hit);
      if (!result.ok)
        return { ok: false, refusal: result.refusal, state: result.state, events: result.events };
      const hits = result.events.filter((event) => event.type === "node_hit").length;
      return { ok: true, state: result.state, events: result.events, task: ["node_hits", hits] };
    }
    case "end_node_run": {
      const result = endNodeRun(content, state, now, command.node, command.run);
      return { ok: true, state: result.state, events: result.events };
    }
  }
}

/** Settles `state` to `now`, then applies `command`. Pure; the caller owns the clock. */
export function applyCommand(
  content: Content,
  state: BaseState,
  command: Command,
  now: number,
): CommandResult {
  const settled = settleAll(content, state, now);
  const result = step(content, settled.state, command, now);
  if (!result.ok) {
    return {
      ok: false,
      state: result.state ?? settled.state,
      events: [...settled.events, ...(result.events ?? [])],
      refusal: result.refusal,
    };
  }
  let next = result.state;
  const events = [...settled.events, ...result.events];
  if (result.task) {
    const progressed = progressTasks(content, next, result.task[0], result.task[1]);
    next = progressed.state;
    events.push(...progressed.events);
  }
  const hint =
    command.type === "build" && command.what !== "tier"
      ? command.what === "furnace"
        ? "furnace"
        : "building"
      : HINT_OF[command.type];
  if (hint) next = { ...next, hints: { ...next.hints, [hint]: (next.hints[hint] ?? 0) + 1 } };
  return { ok: true, state: next, events };
}

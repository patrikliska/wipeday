import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { describe, expect, it } from "vitest";
import { utcDay } from "./active";
import { advise, hintFor } from "./advisor";
import { type BaseState, newBase } from "./base";
import { applyCommand } from "./commands";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;

const fresh = (): BaseState => ({
  ...newBase(content, T0, 1),
  tasks: { day: utcDay(T0), ids: ["gather_4", "craft_1", "node_hits_10"], progress: {}, done: [] },
});

describe("applyCommand", () => {
  it("settles, applies, records task progress and hint use", () => {
    const result = applyCommand(content, fresh(), { type: "gather" }, T0);
    if (!result.ok) throw new Error("expected ok");
    expect(result.events.map((event) => event.type)).toEqual(["gathered"]);
    expect(result.state.tasks.progress.gather_4).toBe(1);
    expect(result.state.hints.gather).toBe(1);
  });

  it("refuses with a reason and keeps the settled state", () => {
    const first = applyCommand(content, fresh(), { type: "gather" }, T0);
    if (!first.ok) throw new Error("expected ok");
    const second = applyCommand(content, first.state, { type: "gather" }, T0 + 60);
    expect(second).toMatchObject({ ok: false, refusal: { code: "cooldown", readyAt: T0 + 600 } });
    expect(second.state.hints.gather).toBe(1);

    const build = applyCommand(content, fresh(), { type: "build" }, T0);
    expect(build).toMatchObject({ ok: false, refusal: { code: "unaffordable" } });
    const craft = applyCommand(content, fresh(), { type: "craft", item: "crate" }, T0);
    expect(craft).toMatchObject({ ok: false, refusal: { code: "workbench", needed: 1 } });
  });

  it("lands time-based changes as events on the next command", () => {
    const base: BaseState = {
      ...fresh(),
      stock: { timber: 1000, stone: 1000, fibre: 100 },
      items: { workbench_1: 1 },
    };
    const queued = applyCommand(content, base, { type: "craft", item: "bow" }, T0);
    if (!queued.ok) throw new Error("expected ok");
    expect(queued.state.tasks.progress.craft_1).toBe(1);
    const later = applyCommand(content, queued.state, { type: "collect" }, T0 + 3600);
    expect(later.events.map((event) => event.type)).toContain("crafted");
    expect(later.state.items.bow).toBe(1);
  });

  it("counts node hits toward tasks, a repeat hit not at all", () => {
    let state = fresh();
    for (const hit of [1, 2, 2, 3]) {
      const result = applyCommand(
        content,
        state,
        { type: "hit_node", node: "tree_1", run: "r1", hit },
        T0 + hit,
      );
      if (!result.ok) throw new Error("expected ok");
      state = result.state;
    }
    expect(state.tasks.progress.node_hits_10).toBe(3);
  });
});

describe("advisor", () => {
  it("points a new base at Gather, then retires the hint after two uses", () => {
    const base = fresh();
    expect(advise(content, base, T0)).toBe("gather");
    expect(hintFor(base, "gather")).toBe("gather");
    const used = { ...base, hints: { gather: 2 } };
    expect(hintFor(used, "gather")).toBeNull();
  });

  it("with nothing to do and Gather cooling down, waits for Gather unless something can be banked", () => {
    const gathered = applyCommand(content, fresh(), { type: "gather" }, T0);
    if (!gathered.ok) throw new Error("expected ok");
    expect(advise(content, gathered.state, T0 + 1)).toBe("gather");
    expect(advise(content, gathered.state, T0 + 300)).toBe("collect");
  });

  it("points at the build when the next tier is affordable, even at a full cap", () => {
    // Twig holds 1500 timber and the Timber tier costs exactly that: full, and nothing to bank.
    const base = { ...fresh(), stock: { timber: 1500, stone: 500 } };
    expect(advise(content, base, T0)).toBe("build");
    // With production waiting behind the cap, banking it comes first.
    const waiting = { ...fresh(), stock: { timber: 1500, stone: 100 } };
    expect(advise(content, waiting, T0 + 3600)).toBe("collect");
  });
});

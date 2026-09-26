import { describe, expect, it } from "vitest";
import {
  allows,
  BASE_ACTIONS,
  type CustomId,
  DEBUG_STATES,
  encodeCustomId,
  MAX_LENGTH,
  parseCustomId,
  type Route,
  TOOLS_ACTIONS,
} from "./customId";

const everyRoute: Route[] = [
  ...DEBUG_STATES.map((state): Route => ({ screen: "debug", action: "card", state })),
  ...BASE_ACTIONS.map((action): Route => ({ screen: "base", action })),
  ...TOOLS_ACTIONS.map((action): Route => ({ screen: "tools", action })),
  { screen: "node", action: "hit", position: 3 },
  { screen: "node", action: "home" },
  { screen: "tasks", action: "back" },
  { screen: "craft", action: "again", item: "wood_box" },
];

describe("customId", () => {
  it("round-trips every route, with and without an owner", () => {
    for (const owner of [null, "18446744073709551615"]) {
      for (const route of everyRoute) {
        const id: CustomId = { owner, route };
        const text = encodeCustomId(id);
        expect(text.length).toBeLessThanOrEqual(MAX_LENGTH);
        expect(parseCustomId(text)).toEqual({ kind: "ok", id });
      }
    }
  });

  it("has a stable wire format", () => {
    expect(
      encodeCustomId({ owner: "42", route: { screen: "debug", action: "card", state: "full" } }),
    ).toBe("idle:v1:debug:card:42:full");
    expect(encodeCustomId({ owner: "42", route: { screen: "base", action: "collect" } })).toBe(
      "idle:v1:base:collect:42:",
    );
  });

  it("treats other features' ids as foreign, not as errors", () => {
    expect(parseCustomId("poll:vote:1")).toEqual({ kind: "foreign" });
  });

  it("treats stale versions and garbage as unknown", () => {
    for (const raw of [
      "idle:v0:debug:card:-:full",
      "idle:v1:nope:x:-:",
      "idle:v1:debug:card:abc:full",
      "idle:v1:debug:card:-:sideways",
      "idle:v1:base:explode:-:",
      "idle:v1:debug",
    ]) {
      expect(parseCustomId(raw)).toEqual({ kind: "unknown", raw });
    }
  });

  it("lets only the owner click, and anyone on ephemeral messages", () => {
    const route: Route = { screen: "base", action: "collect" };
    expect(allows({ owner: "7", route }, "7")).toBe(true);
    expect(allows({ owner: "7", route }, "8")).toBe(false);
    expect(allows({ owner: null, route }, "8")).toBe(true);
  });
});

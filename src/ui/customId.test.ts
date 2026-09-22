import { describe, expect, it } from "vitest";
import {
  allows,
  type CustomId,
  DEBUG_STATES,
  encodeCustomId,
  MAX_LENGTH,
  parseCustomId,
} from "./customId";

describe("customId", () => {
  it("round-trips every route, with and without an owner", () => {
    for (const owner of [null, "18446744073709551615"]) {
      for (const state of DEBUG_STATES) {
        const id: CustomId = { owner, route: { screen: "debug", action: "card", state } };
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
      "idle:v1:debug",
    ]) {
      expect(parseCustomId(raw)).toEqual({ kind: "unknown", raw });
    }
  });

  it("lets only the owner click, and anyone on ephemeral messages", () => {
    const route = { screen: "debug", action: "card", state: "normal" } as const;
    expect(allows({ owner: "7", route }, "7")).toBe(true);
    expect(allows({ owner: "7", route }, "8")).toBe(false);
    expect(allows({ owner: null, route }, "8")).toBe(true);
  });
});

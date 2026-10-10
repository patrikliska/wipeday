import { describe, expect, it } from "vitest";
import { allows, encodeCustomId, idOf, parseCustomId } from "./customId";

describe("customId", () => {
  it("round-trips every route", () => {
    for (const action of ["refresh", "dm_on", "dm_off"] as const) {
      const id = idOf({ screen: "base", action });
      expect(parseCustomId(id)).toEqual({
        kind: "ok",
        id: { owner: null, route: { screen: "base", action } },
      });
    }
    const owned = encodeCustomId({
      owner: "123456789012345678",
      route: { screen: "note", action: "base" },
    });
    expect(owned).toBe("idle:v2:note:base:123456789012345678");
    expect(parseCustomId(owned)).toMatchObject({ kind: "ok", id: { owner: "123456789012345678" } });
  });

  it("tells other bots' ids from our stale ones", () => {
    expect(parseCustomId("ticket:open")).toEqual({ kind: "foreign" });
    // The old bot's buttons (v1) and anything malformed are ours but unknown.
    expect(parseCustomId("idle:v1:base:collect:-:")).toMatchObject({ kind: "unknown" });
    expect(parseCustomId("idle:v2:base:teleport:-")).toMatchObject({ kind: "unknown" });
    expect(parseCustomId("idle:v2:base:collect:nobody")).toMatchObject({ kind: "unknown" });
    expect(parseCustomId("idle:v2:base:collect:-:extra")).toMatchObject({ kind: "unknown" });
    // The W8 card's Collect and Gather: stale now, answered with a fresh /base.
    expect(parseCustomId("idle:v2:base:collect:-")).toMatchObject({ kind: "unknown" });
    expect(parseCustomId("idle:v2:base:gather:-")).toMatchObject({ kind: "unknown" });
  });

  it("lets only the owner click an owned message", () => {
    const id = {
      owner: "123456789012345678",
      route: { screen: "base", action: "refresh" },
    } as const;
    expect(allows(id, "123456789012345678")).toBe(true);
    expect(allows(id, "876543210987654321")).toBe(false);
    expect(allows({ ...id, owner: null }, "876543210987654321")).toBe(true);
  });
});

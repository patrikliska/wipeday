import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverPaths } from "../paths";
import { openDb } from "../store/db";
import { appEmojis } from "../store/schema";
import { type EmojiApi, Emojis, planEmojiSync, type RemoteEmoji, syncEmojis } from "./emojiSync";
import { AssetRegistry } from "./registry";

describe("planEmojiSync", () => {
  const stored = [
    { name: "wood", emojiId: "1", fileHash: "aaa" },
    { name: "stone", emojiId: "2", fileHash: "bbb" },
    { name: "old_icon", emojiId: "3", fileHash: "ccc" },
  ];
  const remote = [
    { id: "1", name: "wood" },
    { id: "2", name: "stone" },
    { id: "3", name: "old_icon" },
    { id: "9", name: "owner_made_this" },
  ];

  it("uploads new, replaces changed, keeps unchanged", () => {
    const plan = planEmojiSync(
      [
        { name: "wood", hash: "aaa" },
        { name: "stone", hash: "CHANGED" },
        { name: "sulfur", hash: "ddd" },
      ],
      remote,
      stored,
    );
    expect(plan.keep).toEqual([{ id: "1", name: "wood" }]);
    expect(plan.replace).toEqual([{ name: "stone", oldId: "2" }]);
    expect(plan.upload).toEqual(["sulfur"]);
  });

  it("removes only emojis it uploaded itself", () => {
    const plan = planEmojiSync([], remote, stored);
    expect(plan.remove.map((emoji) => emoji.name).sort()).toEqual(["old_icon", "stone", "wood"]);
    expect(plan.remove.some((emoji) => emoji.name === "owner_made_this")).toBe(false);
  });

  it("re-uploads when a same-named emoji on Discord is not the one on record", () => {
    const plan = planEmojiSync(
      [{ name: "wood", hash: "aaa" }],
      [{ id: "77", name: "wood" }],
      stored,
    );
    expect(plan.replace).toEqual([{ name: "wood", oldId: "77" }]);
  });
});

describe("syncEmojis", () => {
  function fakeApi(initial: RemoteEmoji[] = []) {
    const remote = [...initial];
    const calls: string[] = [];
    let nextId = 100;
    const api: EmojiApi = {
      list: async () => [...remote],
      create: async (name) => {
        calls.push(`create ${name}`);
        const emoji = { id: String(nextId++), name };
        remote.push(emoji);
        return emoji;
      },
      delete: async (id) => {
        calls.push(`delete ${id}`);
        remote.splice(
          remote.findIndex((emoji) => emoji.id === id),
          1,
        );
      },
    };
    return { api, calls };
  }

  function assetsWith(files: Record<string, string>): AssetRegistry {
    const dir = mkdtempSync(join(tmpdir(), "wipe-day-assets-"));
    mkdirSync(join(dir, "emoji_128"));
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(dir, "emoji_128", name), body);
    }
    return AssetRegistry.load(dir);
  }

  it("uploads once, then is a no-op on the next start", async () => {
    const db = openDb(":memory:", discoverPaths().migrations);
    const { api, calls } = fakeApi();
    const assets = assetsWith({ "wood.png": "png-bytes" });

    const first = await syncEmojis(api, assets, db, 1_000);
    expect(calls).toEqual(["create wood"]);
    expect(first.text("resource", { id: "wood", fallbackEmoji: "🪵" })).toBe("<:wood:100>");
    expect(db.select().from(appEmojis).all()).toHaveLength(1);

    const second = await syncEmojis(api, assets, db, 2_000);
    expect(calls).toEqual(["create wood"]);
    expect(second.size).toBe(1);
  });

  it("falls back to Unicode when Discord is unreachable", async () => {
    const db = openDb(":memory:", discoverPaths().migrations);
    const api: EmojiApi = {
      list: async () => {
        throw new Error("offline");
      },
      create: async () => ({ id: "", name: "" }),
      delete: async () => {},
    };
    const emojis = await syncEmojis(api, assetsWith({ "wood.png": "x" }), db, 0);
    expect(emojis.text("resource", { id: "wood", fallbackEmoji: "🪵" })).toBe("🪵");
  });
});

it("prefixes colliding kinds in emoji names", () => {
  const emojis = new Emojis(new Map([["tier_wood", "5"]]));
  expect(emojis.component("base_tier", { id: "wood", fallbackEmoji: "🏚️" })).toEqual({
    id: "5",
    name: "tier_wood",
  });
  expect(emojis.component("resource", { id: "wood", fallbackEmoji: "🪵" })).toEqual({ name: "🪵" });
});

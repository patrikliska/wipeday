/**
 * Application emoji sync: everything in `assets/emoji_128/` becomes a bot-owned
 * emoji, named after its file. Diffed by name + file hash so a restart uploads
 * nothing and a replaced picture is re-uploaded.
 *
 * Safety rule: the sync only ever deletes emojis it uploaded itself (recorded
 * in `app_emojis`). Emojis added by hand in the developer portal are left alone.
 */
import { readFileSync } from "node:fs";
import type { APIMessageComponentEmoji } from "discord.js";
import { eq } from "drizzle-orm";
import type { EntityKind } from "../content/schema";
import { log } from "../log";
import type { Db } from "../store/db";
import { appEmojis } from "../store/schema";
import { EMOJI_MAX_BYTES } from "./check";
import { entityAssetName } from "./manifest";
import type { AssetRegistry } from "./registry";
import { assetName } from "./spec";

export interface LocalEmoji {
  name: string;
  hash: string;
}

export interface RemoteEmoji {
  id: string;
  name: string;
}

export interface StoredEmoji {
  name: string;
  emojiId: string;
  fileHash: string;
}

export interface EmojiPlan {
  /** Not on Discord yet. */
  upload: string[];
  /** On Discord under this name, but the local picture changed (or the hash is unknown). */
  replace: Array<{ name: string; oldId: string }>;
  /** Uploaded by us earlier, no longer in the folder. */
  remove: RemoteEmoji[];
  /** Already correct. */
  keep: RemoteEmoji[];
}

/** Pure: decides what to do. `syncEmojis` carries it out. */
export function planEmojiSync(
  local: LocalEmoji[],
  remote: RemoteEmoji[],
  stored: StoredEmoji[],
): EmojiPlan {
  const plan: EmojiPlan = { upload: [], replace: [], remove: [], keep: [] };
  const remoteByName = new Map(remote.map((emoji) => [emoji.name, emoji]));
  const storedByName = new Map(stored.map((emoji) => [emoji.name, emoji]));
  const localNames = new Set(local.map((emoji) => emoji.name));

  for (const emoji of local) {
    const onDiscord = remoteByName.get(emoji.name);
    const record = storedByName.get(emoji.name);
    if (!onDiscord) {
      plan.upload.push(emoji.name);
    } else if (record?.emojiId === onDiscord.id && record.fileHash === emoji.hash) {
      plan.keep.push(onDiscord);
    } else {
      plan.replace.push({ name: emoji.name, oldId: onDiscord.id });
    }
  }
  for (const emoji of remote) {
    const ours = storedByName.get(emoji.name)?.emojiId === emoji.id;
    if (ours && !localNames.has(emoji.name)) plan.remove.push(emoji);
  }
  return plan;
}

/** The slice of discord.js this module needs; a fake implements it in tests. */
export interface EmojiApi {
  list(): Promise<RemoteEmoji[]>;
  create(name: string, png: Buffer): Promise<RemoteEmoji>;
  delete(id: string): Promise<void>;
}

/** Inline and component emoji for entities, with the Unicode fallback built in. */
export class Emojis {
  constructor(private readonly byName: ReadonlyMap<string, string> = new Map()) {}

  get size(): number {
    return this.byName.size;
  }

  /** For message text: `<:sulfur_ore:123>` or the fallback. */
  text(kind: EntityKind, entity: { id: string; fallbackEmoji: string }): string {
    const name = entityAssetName(kind, entity.id);
    const id = this.byName.get(name);
    return id ? `<:${name}:${id}>` : entity.fallbackEmoji;
  }

  /** For buttons and select options. */
  component(
    kind: EntityKind,
    entity: { id: string; fallbackEmoji: string },
  ): APIMessageComponentEmoji {
    const name = entityAssetName(kind, entity.id);
    const id = this.byName.get(name);
    return id ? { id, name } : { name: entity.fallbackEmoji };
  }
}

/**
 * Brings Discord in line with `assets/emoji_128/`. Never throws: a failed
 * upload only means that one icon falls back to Unicode until the next start.
 */
export async function syncEmojis(
  api: EmojiApi,
  assets: AssetRegistry,
  db: Db,
  now: number,
): Promise<Emojis> {
  const files = assets.in("emoji_128");
  const local: LocalEmoji[] = [];
  for (const [fileName, file] of files) {
    if (!fileName.endsWith(".png")) continue;
    if (file.bytes > EMOJI_MAX_BYTES) {
      log.warn("emoji file too big, skipped", {
        file: fileName,
        kb: Math.round(file.bytes / 1024),
      });
      continue;
    }
    local.push({ name: assetName(fileName), hash: file.hash });
  }

  let remote: RemoteEmoji[];
  try {
    remote = await api.list();
  } catch (error) {
    log.error("could not list application emojis, using Unicode fallbacks", {
      error: (error as Error).message,
    });
    return new Emojis();
  }

  const plan = planEmojiSync(local, remote, db.select().from(appEmojis).all());
  const ids = new Map(plan.keep.map((emoji) => [emoji.name, emoji.id]));
  const hashOf = new Map(local.map((emoji) => [emoji.name, emoji.hash]));

  const upload = async (name: string): Promise<void> => {
    const file = files.get(`${name}.png`);
    const hash = hashOf.get(name);
    if (!file || !hash) return;
    const created = await api.create(name, readFileSync(file.path));
    ids.set(name, created.id);
    db.insert(appEmojis)
      .values({ name, emojiId: created.id, fileHash: hash, syncedAt: now })
      .onConflictDoUpdate({
        target: appEmojis.name,
        set: { emojiId: created.id, fileHash: hash, syncedAt: now },
      })
      .run();
  };

  for (const { name, oldId } of plan.replace) {
    try {
      await api.delete(oldId);
      await upload(name);
    } catch (error) {
      log.warn("emoji replace failed", { name, error: (error as Error).message });
    }
  }
  for (const name of plan.upload) {
    try {
      await upload(name);
    } catch (error) {
      log.warn("emoji upload failed", { name, error: (error as Error).message });
    }
  }
  for (const emoji of plan.remove) {
    try {
      await api.delete(emoji.id);
      db.delete(appEmojis).where(eq(appEmojis.name, emoji.name)).run();
    } catch (error) {
      log.warn("emoji delete failed", { name: emoji.name, error: (error as Error).message });
    }
  }

  log.info(
    `emojis: ${ids.size} ready (${plan.upload.length} uploaded, ${plan.replace.length} replaced, ` +
      `${plan.remove.length} removed, ${plan.keep.length} unchanged)`,
  );
  return new Emojis(ids);
}

/**
 * The customId scheme: `idle:v2:{screen}:{action}:{owner}`.
 *
 * One parser turns the string on a clicked component into a typed `Route`; nothing else
 * ever splits a customId. `owner` is the Discord user id the message belongs to (`-` on
 * ephemeral messages and DMs, which only their owner can see), so clicks by anyone else
 * can be turned away. v1 was the old bot's (before W8): its buttons parse as `unknown`,
 * and the caller answers with a fresh base instead of an error.
 */

/** Discord's limit for a customId. */
export const MAX_LENGTH = 100;

const PREFIX = "idle:v2";

/** The `/base` card's buttons. */
export const BASE_ACTIONS = ["collect", "gather", "refresh", "dm_on", "dm_off"] as const;
/** A DM's buttons: the base card as a reply, or DMs off. */
export const NOTE_ACTIONS = ["base", "dm_off"] as const;

export type Route =
  | { screen: "base"; action: (typeof BASE_ACTIONS)[number] }
  | { screen: "note"; action: (typeof NOTE_ACTIONS)[number] };

export interface CustomId {
  /** Discord user id of the message owner; `null` on ephemeral messages and DMs. */
  owner: string | null;
  route: Route;
}

export type Parsed =
  | { kind: "ok"; id: CustomId }
  /** Not one of ours: another bot's component. Not an error to log. */
  | { kind: "foreign" }
  /** Ours, from a version or screen this build does not know: a stale message. */
  | { kind: "unknown"; raw: string };

export function encodeCustomId(id: CustomId): string {
  const text = `${PREFIX}:${id.route.screen}:${id.route.action}:${id.owner ?? "-"}`;
  if (text.length > MAX_LENGTH) throw new Error(`customId over ${MAX_LENGTH} chars: ${text}`);
  return text;
}

/** The customId of a button on an ephemeral message or a DM. */
export const idOf = (route: Route): string => encodeCustomId({ owner: null, route });

function pick<T extends string>(list: readonly T[], value: string): T | undefined {
  return list.find((candidate) => candidate === value);
}

export function parseCustomId(raw: string): Parsed {
  if (!raw.startsWith("idle:")) return { kind: "foreign" };
  const unknown: Parsed = { kind: "unknown", raw };
  if (!raw.startsWith(`${PREFIX}:`)) return unknown;

  const [screen, action, ownerText, ...rest] = raw.slice(PREFIX.length + 1).split(":");
  if (!screen || !action || !ownerText || rest.length > 0) return unknown;
  if (ownerText !== "-" && !/^\d{17,20}$/.test(ownerText)) return unknown;
  const owner = ownerText === "-" ? null : ownerText;

  let route: Route | undefined;
  if (screen === "base") {
    const known = pick(BASE_ACTIONS, action);
    if (known) route = { screen, action: known };
  } else if (screen === "note") {
    const known = pick(NOTE_ACTIONS, action);
    if (known) route = { screen, action: known };
  }
  return route ? { kind: "ok", id: { owner, route } } : unknown;
}

/** True when `userId` may act on the message this id sits on. */
export function allows(id: CustomId, userId: string): boolean {
  return id.owner === null || id.owner === userId;
}

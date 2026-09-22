/**
 * The customId scheme: `idle:v1:{screen}:{action}:{owner}:{args}`.
 *
 * One parser turns the string on a clicked component into a typed `Route`;
 * nothing else in the project ever splits a customId. `owner` is the Discord
 * user id the message belongs to (`-` on ephemeral messages, which only their
 * owner can see), so clicks by anyone else can be turned away.
 */

/** Discord's limit for a customId. */
export const MAX_LENGTH = 100;

const PREFIX = "idle:v1";

/** Which sample state `/idle-debug card` shows. */
export const DEBUG_STATES = ["empty", "normal", "full"] as const;
export type DebugState = (typeof DEBUG_STATES)[number];

/** Every action a component can trigger. Grows by one variant per feature. */
export type Route = { screen: "debug"; action: "card"; state: DebugState };

export interface CustomId {
  /** Discord user id of the message owner; `null` on ephemeral messages. */
  owner: string | null;
  route: Route;
}

export type Parsed =
  | { kind: "ok"; id: CustomId }
  /** Not one of ours: another bot feature's component. Not an error to log. */
  | { kind: "foreign" }
  /**
   * Ours, but from a version or screen this build does not know: a stale
   * message from before a deploy. The caller re-renders the home screen.
   */
  | { kind: "unknown"; raw: string };

export function encodeCustomId(id: CustomId): string {
  const { route } = id;
  const text = `${PREFIX}:${route.screen}:${route.action}:${id.owner ?? "-"}:${route.state}`;
  if (text.length > MAX_LENGTH) throw new Error(`customId over ${MAX_LENGTH} chars: ${text}`);
  return text;
}

export function parseCustomId(raw: string): Parsed {
  if (!raw.startsWith("idle:")) return { kind: "foreign" };
  const unknown: Parsed = { kind: "unknown", raw };
  if (!raw.startsWith(`${PREFIX}:`)) return unknown;

  const [screen, action, owner, ...rest] = raw.slice(PREFIX.length + 1).split(":");
  const args = rest.join(":");
  if (!screen || !action || !owner) return unknown;
  if (owner !== "-" && !/^\d{1,20}$/.test(owner)) return unknown;

  if (screen === "debug" && action === "card") {
    const state = DEBUG_STATES.find((candidate) => candidate === args);
    if (!state) return unknown;
    return {
      kind: "ok",
      id: { owner: owner === "-" ? null : owner, route: { screen, action, state } },
    };
  }
  return unknown;
}

/** True when `userId` may act on the message this id sits on. */
export function allows(id: CustomId, userId: string): boolean {
  return id.owner === null || id.owner === userId;
}

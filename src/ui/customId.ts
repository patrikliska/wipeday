/**
 * The customId scheme: `idle:v1:{screen}:{action}:{owner}:{args}`.
 *
 * One parser turns the string on a clicked component into a typed `Route`;
 * nothing else in the project ever splits a customId. `owner` is the Discord
 * user id the message belongs to (`-` on ephemeral messages, which only their
 * owner can see), so clicks by anyone else can be turned away.
 *
 * Select menus carry their choice in the interaction's `values`, not here.
 */

/** Discord's limit for a customId. */
export const MAX_LENGTH = 100;

const PREFIX = "idle:v1";

/** Which sample state `/idle-debug card` shows. */
export const DEBUG_STATES = ["empty", "normal", "full"] as const;
export type DebugState = (typeof DEBUG_STATES)[number];

export const BASE_ACTIONS = [
  "collect",
  "gather",
  "tools",
  "build",
  "furnace",
  "craft",
  "inventory",
  "refresh",
] as const;
export const TOOLS_ACTIONS = ["upgrade", "back", "home"] as const;
export const BUILD_ACTIONS = ["start", "back", "home"] as const;
export const FURNACE_ACTIONS = ["smelt", "collect", "buy", "back", "home"] as const;
export const CRAFT_ACTIONS = ["pick", "again", "inventory", "back", "home"] as const;
export const INVENTORY_ACTIONS = ["craft", "back", "home"] as const;

/** Every action a component can trigger. Grows by one variant per feature. */
export type Route =
  | { screen: "debug"; action: "card"; state: DebugState }
  | { screen: "base"; action: (typeof BASE_ACTIONS)[number] }
  | { screen: "tools"; action: (typeof TOOLS_ACTIONS)[number] }
  | { screen: "build"; action: (typeof BUILD_ACTIONS)[number] }
  | { screen: "furnace"; action: (typeof FURNACE_ACTIONS)[number] }
  | { screen: "craft"; action: (typeof CRAFT_ACTIONS)[number]; item?: string }
  | { screen: "inventory"; action: (typeof INVENTORY_ACTIONS)[number] };

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

function argsOf(route: Route): string {
  if (route.screen === "debug") return route.state;
  if (route.screen === "craft") return route.item ?? "";
  return "";
}

export function encodeCustomId(id: CustomId): string {
  const { route } = id;
  const text = `${PREFIX}:${route.screen}:${route.action}:${id.owner ?? "-"}:${argsOf(route)}`;
  if (text.length > MAX_LENGTH) throw new Error(`customId over ${MAX_LENGTH} chars: ${text}`);
  return text;
}

function pick<T extends string>(list: readonly T[], value: string): T | undefined {
  return list.find((candidate) => candidate === value);
}

export function parseCustomId(raw: string): Parsed {
  if (!raw.startsWith("idle:")) return { kind: "foreign" };
  const unknown: Parsed = { kind: "unknown", raw };
  if (!raw.startsWith(`${PREFIX}:`)) return unknown;

  const [screen, action, ownerText, ...rest] = raw.slice(PREFIX.length + 1).split(":");
  const args = rest.join(":");
  if (!screen || !action || !ownerText) return unknown;
  if (ownerText !== "-" && !/^\d{1,20}$/.test(ownerText)) return unknown;
  const owner = ownerText === "-" ? null : ownerText;

  let route: Route | undefined;
  if (screen === "debug" && action === "card") {
    const state = pick(DEBUG_STATES, args);
    if (state) route = { screen, action, state };
  } else if (screen === "base") {
    const known = pick(BASE_ACTIONS, action);
    if (known) route = { screen, action: known };
  } else if (screen === "tools") {
    const known = pick(TOOLS_ACTIONS, action);
    if (known) route = { screen, action: known };
  } else if (screen === "build") {
    const known = pick(BUILD_ACTIONS, action);
    if (known) route = { screen, action: known };
  } else if (screen === "furnace") {
    const known = pick(FURNACE_ACTIONS, action);
    if (known) route = { screen, action: known };
  } else if (screen === "craft") {
    const known = pick(CRAFT_ACTIONS, action);
    if (known) route = args ? { screen, action: known, item: args } : { screen, action: known };
  } else if (screen === "inventory") {
    const known = pick(INVENTORY_ACTIONS, action);
    if (known) route = { screen, action: known };
  }
  return route ? { kind: "ok", id: { owner, route } } : unknown;
}

/** True when `userId` may act on the message this id sits on. */
export function allows(id: CustomId, userId: string): boolean {
  return id.owner === null || id.owner === userId;
}

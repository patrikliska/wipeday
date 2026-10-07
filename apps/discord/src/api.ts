/**
 * The bot's only way into the game (W8): the API's `/api/bot/*` routes, with the service
 * token and the Discord user it acts for. Every rule runs on the server; the bot reads
 * bases and sends commands, exactly as the web client does.
 */
import type { Command } from "@wipe-day/domain/commands";
import type { BotHome, CommandResponse } from "@wipe-day/domain/wire";

/** The Discord user a call acts for: the API makes their player on first use. */
export interface DiscordUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** The API answered with an error, or could not be reached (`status` 0). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Api {
  /** The base settled to now, the DM switch and a fresh one-time login link. */
  home(user: DiscordUser): Promise<BotHome>;
  /** One idempotent command: the same `key` twice runs once. */
  command(user: DiscordUser, key: string, command: Command): Promise<CommandResponse>;
  setDm(user: DiscordUser, on: boolean): Promise<void>;
  /** The feed channel has every item up to `id`. */
  ackFeed(id: number): Promise<void>;
  /** Where the event stream is, and the headers it needs. */
  readonly stream: { url: string; headers: Record<string, string> };
}

const TIMEOUT_MS = 10_000;

export function httpApi(baseUrl: string, token: string | null, fetcher = fetch): Api {
  const auth: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
  const as = (user: DiscordUser): Record<string, string> => ({
    "x-discord-id": user.id,
    // Names may hold any character; headers may not.
    "x-discord-name": encodeURIComponent(user.name),
    ...(user.avatarUrl ? { "x-discord-avatar": user.avatarUrl } : {}),
  });

  const call = async <T>(
    path: string,
    init: { method?: string; body?: unknown; user?: DiscordUser } = {},
  ): Promise<T> => {
    let response: Response;
    try {
      response = await fetcher(`${baseUrl}/api/bot${path}`, {
        method: init.method ?? "GET",
        headers: {
          ...auth,
          ...(init.user ? as(init.user) : {}),
          ...(init.body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new ApiError(0, `the game server did not answer: ${(error as Error).message}`);
    }
    if (!response.ok) {
      throw new ApiError(response.status, `${init.method ?? "GET"} ${path}: ${response.status}`);
    }
    return (await response.json()) as T;
  };

  return {
    home: (user) => call<BotHome>("/home", { user }),
    command: (user, key, command) =>
      call<CommandResponse>("/commands", { method: "POST", user, body: { key, command } }),
    setDm: async (user, on) => {
      await call("/dm", { method: "PUT", user, body: { on } });
    },
    ackFeed: async (id) => {
      await call("/feed/ack", { method: "POST", body: { id } });
    },
    stream: { url: `${baseUrl}/api/bot/stream`, headers: auth },
  };
}

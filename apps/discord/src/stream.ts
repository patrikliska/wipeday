/**
 * Follows the API's event stream (`GET /api/bot/stream`, server-sent events) for as long
 * as the bot runs: the feed, DMs and season news. Reconnects with a growing pause when the
 * connection drops or goes quiet (the server pings every 25 s); the server catches the
 * feed up on reconnect, so nothing posted is lost while the bot was away.
 */
import { log } from "./log";

export interface SseEvent {
  event: string;
  data: string;
}

/** Splits a buffer into its complete events and the unfinished rest. */
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  const text = buffer.replace(/\r\n?/g, "\n");
  const events: SseEvent[] = [];
  let start = 0;
  let end = text.indexOf("\n\n", start);
  while (end >= 0) {
    let event = "message";
    const data: string[] = [];
    for (const line of text.slice(start, end).split("\n")) {
      if (line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon >= 0 ? line.slice(0, colon) : line;
      const value = colon >= 0 ? line.slice(colon + 1).replace(/^ /, "") : "";
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
    if (data.length > 0) events.push({ event, data: data.join("\n") });
    start = end + 2;
    end = text.indexOf("\n\n", start);
  }
  return { events, rest: text.slice(start) };
}

/** Pauses before reconnecting, growing with each failure in a row. */
export const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000];
/** Twice the server's ping interval and a bit: silence this long means a dead connection. */
const QUIET_MS = 70_000;

export interface Follow {
  /** Stops following and closes the connection. */
  stop: () => void;
}

/**
 * Calls `onEvent` for every event, one at a time and in order (a slow handler holds the
 * next one back, so feed posts never overtake each other).
 */
export function followStream(
  target: { url: string; headers: Record<string, string> },
  onEvent: (event: SseEvent) => Promise<void> | void,
  fetcher = fetch,
): Follow {
  let stopped = false;
  let current: AbortController | null = null;
  let failures = 0;

  const once = async (): Promise<void> => {
    const controller = new AbortController();
    current = controller;
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const awake = () => {
      clearTimeout(quiet);
      quiet = setTimeout(() => controller.abort(), QUIET_MS);
    };
    try {
      awake();
      const response = await fetcher(target.url, {
        headers: { ...target.headers, accept: "text/event-stream" },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`stream answered ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        awake();
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSse(buffer);
        buffer = parsed.rest;
        for (const event of parsed.events) {
          if (event.event === "ready") {
            if (failures > 0) log.info("event stream back");
            failures = 0;
          }
          try {
            await onEvent(event);
          } catch (error) {
            log.error("event handler failed", {
              event: event.event,
              error: (error as Error).message,
            });
          }
        }
      }
    } finally {
      clearTimeout(quiet);
    }
  };

  const loop = async () => {
    while (!stopped) {
      try {
        await once();
      } catch (error) {
        if (stopped) break;
        if (failures === 0)
          log.warn("event stream lost, reconnecting", { error: (error as Error).message });
      }
      if (stopped) break;
      const pause = RETRY_MS[Math.min(failures, RETRY_MS.length - 1)] ?? 30_000;
      failures += 1;
      await new Promise((resolve) => setTimeout(resolve, pause));
    }
  };
  void loop();

  return {
    stop: () => {
      stopped = true;
      current?.abort();
    },
  };
}

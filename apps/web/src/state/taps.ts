/**
 * The client's half of the taps transport (D134; docs/redesign/09-architecture.md 6.3). Pure,
 * so the rules are unit-tested.
 *
 * - A tap goes into the queue's open tail entry `{type: "taps", count, from, to}`.
 * - The tail closes when it is 1 s old, holds 30 taps, another command queues behind it, or the
 *   tab hides. Only then may it be sent.
 * - A key is assigned at the first send attempt, never earlier; a keyed entry is never merged
 *   or changed, so a retry resends the same content under the same key.
 * - Holding a press counts `holdTapsPerSecond` taps a second once it has been held
 *   `holdAfterSeconds` (N10: hold = 4 a second).
 */
import type { Command } from "@wipe-day/domain/commands";

export const TAIL_MS = 1000;
export const TAIL_TAPS = 30;

export interface Entry {
  /** Assigned at the first send attempt; null until then. */
  key: string | null;
  command: Command;
  /** The second the command applies at (the batch's `to` for taps). */
  at: number;
  /** When it was queued, on the wall clock (ms): a tail closes 1 s after. */
  openedMs: number;
  /** No more taps merge into it. Every entry but an open taps tail is closed. */
  closed: boolean;
}

export const isOpenTail = (entry: Entry | undefined): boolean =>
  entry !== undefined && !entry.closed && entry.key === null && entry.command.type === "taps";

/** Closes the open tail, if any. */
export function closeTail(queue: readonly Entry[]): Entry[] {
  const last = queue.at(-1);
  if (!last || !isOpenTail(last)) return [...queue];
  return [...queue.slice(0, -1), { ...last, closed: true }];
}

/** Closes the tail once it is a second old (or at once when the tab hides). */
export function closeDue(queue: readonly Entry[], nowMs: number, hidden = false): Entry[] {
  const last = queue.at(-1);
  if (!last || !isOpenTail(last)) return [...queue];
  return hidden || nowMs - last.openedMs >= TAIL_MS ? closeTail(queue) : [...queue];
}

/** Adds `count` taps at second `now`: into the open tail while it has room, then new tails. */
export function addTaps(
  queue: readonly Entry[],
  count: number,
  now: number,
  nowMs: number,
): Entry[] {
  let out = closeDue(queue, nowMs);
  let left = Math.max(0, Math.floor(count));
  while (left > 0) {
    const last = out.at(-1);
    if (last && isOpenTail(last) && last.command.type === "taps") {
      const room = TAIL_TAPS - last.command.count;
      const take = Math.min(room, left);
      const merged: Entry = {
        ...last,
        at: Math.max(last.at, now),
        command: {
          ...last.command,
          count: last.command.count + take,
          to: Math.max(last.command.to, now),
        },
        closed: last.command.count + take >= TAIL_TAPS,
      };
      out = [...out.slice(0, -1), merged];
      left -= take;
      continue;
    }
    const take = Math.min(TAIL_TAPS, left);
    out = [
      ...out,
      {
        key: null,
        command: { type: "taps", count: take, from: now, to: now },
        at: now,
        openedMs: nowMs,
        closed: take >= TAIL_TAPS,
      },
    ];
    left -= take;
  }
  return out;
}

/** Queues any other command: the open tail closes first, so the server sees them in order. */
export function enqueue(
  queue: readonly Entry[],
  command: Command,
  now: number,
  nowMs: number,
): Entry[] {
  return [...closeTail(queue), { key: null, command, at: now, openedMs: nowMs, closed: true }];
}

/** Whether the head may be sent now. */
export const sendable = (entry: Entry | undefined, nowMs: number): boolean =>
  entry !== undefined && (entry.closed || nowMs - entry.openedMs >= TAIL_MS);

/** Taps a press held for `heldMs` has counted beyond its first, at `perSecond` after `afterMs`. */
export function heldTaps(heldMs: number, afterMs: number, perSecond: number): number {
  if (heldMs < afterMs) return 0;
  return Math.floor(((heldMs - afterMs) * perSecond) / 1000) + 1;
}

/** Retry waits for a failed send (ms): 0.5 s, 1.5 s, 4 s, then every 10 s. */
export const RETRY_MS = [500, 1500, 4000, 10_000];
export const retryWait = (attempt: number): number =>
  RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)] ?? 10_000;

/**
 * Keys the client sent and their echoes may still arrive: kept until the answer and push are
 * in, or 10 minutes; at most `limit` of them.
 */
export function pruneKeys(
  keys: ReadonlyMap<string, number>,
  nowMs: number,
  limit = 500,
): Map<string, number> {
  const fresh = [...keys].filter(([, at]) => nowMs - at < 600_000);
  return new Map(fresh.slice(Math.max(0, fresh.length - limit)));
}

import { describe, expect, it } from "vitest";
import {
  addTaps,
  closeDue,
  type Entry,
  enqueue,
  heldTaps,
  isOpenTail,
  pruneKeys,
  RETRY_MS,
  retryWait,
  sendable,
  TAIL_TAPS,
} from "./taps";

const T = 1_700_000_000;
const MS = T * 1000;

const tapsOf = (entry: Entry | undefined) =>
  entry?.command.type === "taps" ? entry.command : null;

describe("the taps tail (D134)", () => {
  it("merges taps into one open tail, keyless, from its first second to its last", () => {
    let queue = addTaps([], 1, T, MS);
    queue = addTaps(queue, 3, T, MS + 200);
    queue = addTaps(queue, 2, T + 1, MS + 900);
    expect(queue).toHaveLength(1);
    expect(tapsOf(queue[0])).toEqual({ type: "taps", count: 6, from: T, to: T + 1 });
    expect(queue[0]?.key).toBeNull();
    expect(isOpenTail(queue[0])).toBe(true);
  });

  it("closes the tail at 1 s old: later taps open a new one", () => {
    let queue = addTaps([], 5, T, MS);
    expect(sendable(queue[0], MS + 999)).toBe(false);
    expect(sendable(queue[0], MS + 1000)).toBe(true);
    queue = addTaps(queue, 2, T + 1, MS + 1000);
    expect(queue).toHaveLength(2);
    expect(queue[0]?.closed).toBe(true);
    expect(tapsOf(queue[1])?.count).toBe(2);
  });

  it("closes the tail at 30 taps and carries the rest into the next", () => {
    const queue = addTaps(addTaps([], 28, T, MS), 5, T, MS + 100);
    expect(queue.map((entry) => tapsOf(entry)?.count)).toEqual([TAIL_TAPS, 3]);
    expect(queue[0]?.closed).toBe(true);
    expect(queue[1]?.closed).toBe(false);
    // A huge burst splits into full batches.
    const burst = addTaps([], 95, T, MS);
    expect(burst.map((entry) => tapsOf(entry)?.count)).toEqual([30, 30, 30, 5]);
  });

  it("closes the tail when another command queues behind it, so the server sees the order", () => {
    const queue = enqueue(
      addTaps([], 4, T, MS),
      { type: "buy_line", line: "beachcomber", count: 1 },
      T,
      MS + 10,
    );
    expect(queue.map((entry) => entry.command.type)).toEqual(["taps", "buy_line"]);
    expect(queue.every((entry) => entry.closed)).toBe(true);
    // Taps after it start a new tail rather than reaching back past the purchase.
    const after = addTaps(queue, 1, T, MS + 20);
    expect(after).toHaveLength(3);
  });

  it("closes the tail at once when the tab hides", () => {
    const queue = closeDue(addTaps([], 4, T, MS), MS + 10, true);
    expect(queue[0]?.closed).toBe(true);
  });

  it("never merges into a keyed entry: a retry resends the same content", () => {
    const sent = addTaps([], 4, T, MS).map((entry) => ({ ...entry, key: "k-1", closed: true }));
    const queue = addTaps(sent, 2, T, MS + 100);
    expect(queue).toHaveLength(2);
    expect(tapsOf(queue[0])?.count).toBe(4);
    expect(queue[0]?.key).toBe("k-1");
  });
});

describe("hold to work (N10: 4 a second)", () => {
  it("counts nothing more until the hold delay, then 4 a second", () => {
    expect(heldTaps(300, 350, 4)).toBe(0);
    expect(heldTaps(350, 350, 4)).toBe(1);
    // Over 10 s held, 4 a second after the delay, plus the press itself (counted by the scene).
    expect(heldTaps(10_000, 350, 4)).toBe(Math.floor((10_000 - 350) * 0.004) + 1);
    expect(heldTaps(10_350, 350, 4) - heldTaps(9_350, 350, 4)).toBe(4);
  });
});

describe("retries and pruning", () => {
  it("waits 0.5 s, 1.5 s, 4 s, then every 10 s", () => {
    expect([0, 1, 2, 3, 4, 50].map(retryWait)).toEqual([...RETRY_MS, 10_000, 10_000]);
  });

  it("forgets sent keys after 10 minutes, keeping at most 500", () => {
    const keys = new Map<string, number>();
    for (let i = 0; i < 600; i++) keys.set(`k${i}`, MS + i);
    const pruned = pruneKeys(keys, MS + 1000);
    expect(pruned.size).toBe(500);
    expect(pruned.has("k599")).toBe(true);
    expect(pruneKeys(keys, MS + 700_000).size).toBe(0);
  });
});

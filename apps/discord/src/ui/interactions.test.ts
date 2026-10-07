import { loadGame } from "@wipe-day/content/load";
import { newBase } from "@wipe-day/domain/base";
import type { CommandResponse } from "@wipe-day/domain/wire";
import { describe, expect, it } from "vitest";
import { lastOf } from "./interactions";

const { content } = loadGame();
const state = newBase(content, 1_700_000_000, 1);
const answer = (rest: Partial<CommandResponse>): CommandResponse =>
  ({ ok: true, serverNow: 0, version: 1, state, events: [], ...rest }) as CommandResponse;

describe("what a click did", () => {
  it("adds Gather's bonus to what it banked", () => {
    const last = lastOf(
      answer({
        events: [{ type: "gathered", gained: { timber: 10 }, bonus: { timber: 5, stone: 2 } }],
      }),
    );
    expect(last).toEqual({ kind: "gathered", gained: { timber: 15, stone: 2 } });
  });

  it("reports a collect, a cooldown and any other refusal", () => {
    expect(lastOf(answer({ events: [{ type: "collected", gained: { ore: 3 } }] }))).toEqual({
      kind: "banked",
      gained: { ore: 3 },
    });
    expect(
      lastOf(answer({ ok: false, refusal: { code: "cooldown", readyAt: 99 } } as never)),
    ).toEqual({ kind: "cooldown", readyAt: 99 });
    expect(lastOf(answer({ ok: false, refusal: { code: "maxed" } } as never))).toEqual({
      kind: "refused",
    });
  });
});

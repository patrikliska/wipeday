/**
 * Client prediction (docs/roadmap.md R1 "Done when"): the web client replays its queued commands
 * over the last state the server confirmed (`rebase` in `apps/web/src/state/store.ts`, a fold of
 * `applyCommand`), while the server applies each one to its stored base: a JSON round trip, with
 * the scheduler's settles in between. Over 1,000 seeded sequences of every R1 command the two
 * agree within 1e-9.
 */
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { TIERS } from "@wipe-day/content/tiers";
import { describe, expect, it } from "vitest";
import { applyCommand, type Command } from "./commands";
import { flotsamAt } from "./flotsam";
import { type Rng, rng } from "./rng";
import { settle } from "./settle";
import { type BaseState, newBase } from "./state";

const content = loadContent(contentPaths.data, loadLocale());
const T0 = 1_700_000_000;

const rel = (a: number, b: number): number =>
  Math.abs(a - b) / Math.max(1, Math.abs(a), Math.abs(b));

/** What the database holds: the state as JSON. */
const stored = (state: BaseState): BaseState => JSON.parse(JSON.stringify(state)) as BaseState;

function randomCommand(random: Rng, state: BaseState, t: number): Command {
  const lines = content.lines.map((line) => line.id);
  const line = lines[random.int(0, 5)] ?? "beachcomber";
  const roll = random.next();
  if (roll < 0.45) return { type: "taps", count: random.int(1, 30), from: t, to: t };
  if (roll < 0.65) return { type: "buy_line", line, count: random.next() < 0.7 ? 1 : "max" };
  if (roll < 0.72) return { type: "hire_hand", line };
  if (roll < 0.8) {
    const upgrade = content.upgrades[random.int(0, content.upgrades.length - 1)]?.id ?? "";
    return { type: "buy_upgrade", upgrade };
  }
  if (roll < 0.84) return { type: "buy_era", era: TIERS[random.int(1, 3)] ?? "wood" };
  if (roll < 0.94) {
    const cursor = flotsamAt(content, state, t);
    return { type: "claim_flotsam", run: state.run.n, k: cursor.k };
  }
  return random.next() < 0.5 ? { type: "ping" } : { type: "collect" };
}

describe("client prediction", () => {
  it("equals the server over 1,000 seeded sequences of every R1 command", () => {
    let worst = 0;
    for (let seed = 1; seed <= 1_000; seed++) {
      const random = rng(seed * 4099);
      let server = stored({
        ...newBase(content, T0, seed),
        run: { ...newBase(content, T0, seed).run, supplies: random.next() * 1e7 },
      });
      // The client's last confirmed state, and the commands it queued since.
      let confirmed = server;
      const queue: { command: Command; at: number }[] = [];
      let t = T0;
      for (let step = random.int(5, 40); step > 0; step--) {
        t += random.int(1, 90);
        const command = randomCommand(random, server, t);
        queue.push({ command, at: t });
        // The scheduler may settle the stored base before the command lands.
        if (random.next() < 0.3) server = stored(settle(content, server, t - 1).state);
        server = stored(applyCommand(content, server, command, t).state);
        // Now and then the server's answer arrives: the client adopts it and drops the queue.
        if (random.next() < 0.2) {
          confirmed = server;
          queue.length = 0;
        }
      }
      let predicted = confirmed;
      for (const entry of queue)
        predicted = applyCommand(content, predicted, entry.command, entry.at).state;
      const a = settle(content, predicted, t).state;
      const b = settle(content, server, t).state;
      const error = Math.max(rel(a.run.supplies, b.run.supplies), rel(a.run.made, b.run.made));
      worst = Math.max(worst, error);
      expect(error, `seed ${seed}`).toBeLessThanOrEqual(1e-9);
      const strip = (s: BaseState) => ({
        ...s,
        run: { ...s.run, supplies: 0, made: 0, madeAtActive: 0 },
      });
      expect(stored(strip(a)), `seed ${seed}`).toEqual(stored(strip(b)));
    }
    expect(worst).toBeLessThanOrEqual(1e-9);
  });
});

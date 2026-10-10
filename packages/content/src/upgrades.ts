/**
 * The shelf (docs/redesign/02-the-run.md 5): Grip's rungs after Rock, Line Mk II and III for
 * every line (one rule each in `upgrades.json5`, generated as `{line}_{id}`), then the island
 * upgrades. Each Grip rung and island upgrade comes after the one before it, and Mk III after
 * Mk II (D152), so the shelf shows one next step per ladder.
 */
import type { z } from "zod";
import type { LineDef, Tool, UpgradeDef, upgradesFileSchema } from "./schema";

type UpgradesFile = z.infer<typeof upgradesFileSchema>;

export function deriveUpgrades(
  tools: readonly Tool[],
  lines: readonly LineDef[],
  file: UpgradesFile,
): UpgradeDef[] {
  const out: UpgradeDef[] = [];
  // Rock is owned from the start; every later rung needs the one before.
  for (const [index, tool] of tools.entries()) {
    if (index === 0) continue;
    const previous = tools[index - 1];
    out.push({
      id: tool.id,
      kind: "grip",
      cost: tool.cost,
      effects: tool.effects,
      pocket: tool.pocket,
      ...(previous && index > 1 ? { after: previous.id } : {}),
    });
  }
  for (const line of lines) {
    for (const [index, rule] of file.lineMk.entries()) {
      const before = file.lineMk[index - 1];
      out.push({
        id: `${line.id}_${rule.id}`,
        kind: "mk",
        cost: line.cost * rule.costFactor,
        effects: rule.effects.map((effect) => ({ ...effect, scope: line.id })),
        pocket: rule.pocket,
        line: line.id,
        needOwned: rule.needOwned,
        ...(before ? { after: `${line.id}_${before.id}` } : {}),
      });
    }
  }
  for (const [index, upgrade] of file.island.entries()) {
    const before = file.island[index - 1];
    out.push({
      id: upgrade.id,
      kind: "island",
      cost: upgrade.cost,
      effects: upgrade.effects,
      pocket: upgrade.pocket,
      ...(before ? { after: before.id } : {}),
    });
  }
  return out;
}

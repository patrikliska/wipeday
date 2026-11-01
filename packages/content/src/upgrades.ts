/**
 * The shelf (docs/redesign/02-the-run.md 5): Grip's rungs after Rock, then the island upgrades.
 * Each comes after the one before it, so the shelf shows one next step per ladder. The Line Mks
 * are Workshop items now (`research.ts`, D194).
 */
import type { z } from "zod";
import type { Tool, UpgradeDef, upgradesFileSchema } from "./schema";

type UpgradesFile = z.infer<typeof upgradesFileSchema>;

export function deriveUpgrades(tools: readonly Tool[], file: UpgradesFile): UpgradeDef[] {
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

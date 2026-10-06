/**
 * `pnpm sim [days]`         per-day table for every archetype, plus CSV in var/sim/
 * `pnpm sim check [days]`   assert the pacing targets; exit 1 on failure
 * `pnpm sim rtp [spins]`    the casino's measured return per bet option against its exact odds
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { measureAll } from "./rtp";
import { ARCHETYPES, checkPacing, type Run, simulate, simulatePair } from "./sim";

/** CSV output goes to `var/sim/` at the repo root, next to the other local runtime state. */
const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const content = loadContent(contentPaths.data, loadLocale());

const args = process.argv.slice(2);
const check = args[0] === "check";
const rtp = args[0] === "rtp";
const days = Number(args[check || rtp ? 1 : 0] ?? 35);

function table(run: Run): string {
  const lines = [
    `${run.archetype}  (reached: ${Object.entries(run.reached)
      .map(([tier, day]) => `${tier} d${day}`)
      .join(", ")}; first trips: ${Object.entries(run.firstTrip)
      .map(([tier, day]) => `t${tier} d${day}`)
      .join(", ")}; first job d${run.firstJob ?? "-"}; first raid d${run.firstRaid ?? "-"})`,
    "day  tier   tool             fill                cap   ingots    fuel   scrap  items  parts  bldgs  crew  known  build  den-  den+  bet   won   def  chg  raid    loss camp  pvp+  pvp-",
  ];
  for (const row of run.rows) {
    lines.push(
      `${String(row.day).padStart(3)}  ${row.tier.padEnd(6)} ${row.tool.padEnd(16)} ` +
        `${row.fill.padEnd(18)} ${String(row.cap).padStart(6)} ${String(row.ingots).padStart(8)} ` +
        `${String(row.fuel).padStart(7)} ${String(row.scrap).padStart(7)}  ${String(row.items).padStart(5)}  ${String(row.parts).padStart(5)}  ${String(row.buildings).padStart(5)}  ${String(row.crew).padStart(4)}  ${String(row.known).padStart(5)}  ${(row.building ? "yes" : "").padEnd(5)} ${String(row.denSpent).padStart(4)}  ${String(row.denEarned).padStart(4)}  ${String(row.wagered).padStart(4)}  ${String(row.won).padStart(4)}` +
        `  ${String(row.defence).padStart(4)} ${String(row.charges).padStart(4)}  ${(row.raids ? `${row.raidsHeld}/${row.raids}` : "").padEnd(4)}` +
        `  ${String(row.raidLoss || "").padStart(5)} ${String(row.camps || "").padStart(4)}  ${String(row.pvpTake || "").padStart(4)}  ${String(row.pvpLoss || "").padStart(4)}`,
    );
  }
  return lines.join("\n");
}

if (rtp) {
  const spins = Number(args[1] ?? 1_000_000);
  console.log(`game   option      exact   measured   diff  (${spins} rounds each)`);
  for (const row of measureAll(content, spins)) {
    const pct = (value: number) => `${(value * 100).toFixed(2)}%`.padStart(8);
    console.log(
      `${row.game.padEnd(6)} ${(row.option ?? "-").padEnd(10)} ${pct(row.exact)} ${pct(row.measured)} ${((row.measured - row.exact) * 100).toFixed(2).padStart(6)}` +
        (row.jackpots !== undefined ? `  jackpots ${row.jackpots}` : ""),
    );
  }
} else if (check) {
  const results = checkPacing(content, days);
  for (const result of results)
    console.log(`${result.warning ? "WARN" : "FAIL"}  ${result.message}`);
  const failures = results.filter((result) => !result.warning);
  console.log(
    failures.length === 0 ? "OK: pacing targets met" : `${failures.length} pacing check(s) failed`,
  );
  process.exitCode = failures.length === 0 ? 0 : 1;
} else {
  const outDir = join(repoRoot, "var", "sim");
  mkdirSync(outDir, { recursive: true });
  const pair = simulatePair(content, days);
  const runs: [string, Run][] = [
    ...ARCHETYPES.map((archetype): [string, Run] => [
      archetype,
      simulate(content, archetype, days),
    ]),
    ["raider_pvp", pair.raider],
    ["casual_raided", pair.target],
  ];
  for (const [name, run] of runs) {
    if (name.includes("_")) console.log(`PvP pair: ${name}`);
    console.log(`${table(run)}\n`);
    const csv = [
      "day,tier,tool,fill,cap,ingots,fuel,scrap,items,buildings,building,defence,charges,raids,raidsHeld,raidLoss,camps,pvpTake,pvpLoss",
      ...run.rows.map((row) =>
        [
          row.day,
          row.tier,
          row.tool,
          row.fill,
          row.cap,
          row.ingots,
          row.fuel,
          row.scrap,
          row.items,
          row.buildings,
          row.building,
          row.defence,
          row.charges,
          row.raids,
          row.raidsHeld,
          row.raidLoss,
          row.camps,
          row.pvpTake,
          row.pvpLoss,
        ].join(","),
      ),
    ].join("\n");
    writeFileSync(join(outDir, `${name}.csv`), `${csv}\n`);
  }
  console.log(`csv: ${outDir}`);
}

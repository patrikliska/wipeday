/**
 * `pnpm sim [days]`         per-day table for every archetype, plus CSV in var/sim/
 * `pnpm sim check [days]`   assert the pacing targets; exit 1 on failure
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadContent } from "../content/load";
import { discoverPaths } from "../paths";
import { ARCHETYPES, checkPacing, type Run, simulate } from "../sim/sim";
import { Locale } from "../ui/locale";

const paths = discoverPaths();
const locale = Locale.load(join(paths.locale, "en.json"));
const content = loadContent(paths.data, locale);

const args = process.argv.slice(2);
const check = args[0] === "check";
const days = Number(args[check ? 1 : 0] ?? 35);

function table(run: Run): string {
  const lines = [
    `${run.archetype}  (reached: ${Object.entries(run.reached)
      .map(([tier, day]) => `${tier} d${day}`)
      .join(", ")})`,
    "day  tier   tool             fill                cap    frags     hqm   scrap  items  build",
  ];
  for (const row of run.rows) {
    lines.push(
      `${String(row.day).padStart(3)}  ${row.tier.padEnd(6)} ${row.tool.padEnd(16)} ` +
        `${row.fill.padEnd(18)} ${String(row.cap).padStart(6)} ${String(row.metalFragments).padStart(8)} ` +
        `${String(row.hqm).padStart(7)} ${String(row.scrap).padStart(7)}  ${String(row.items).padStart(5)}  ${row.building ? "yes" : ""}`,
    );
  }
  return lines.join("\n");
}

if (check) {
  const results = checkPacing(content, days);
  for (const result of results)
    console.log(`${result.warning ? "WARN" : "FAIL"}  ${result.message}`);
  const failures = results.filter((result) => !result.warning);
  console.log(
    failures.length === 0 ? "OK: pacing targets met" : `${failures.length} pacing check(s) failed`,
  );
  process.exitCode = failures.length === 0 ? 0 : 1;
} else {
  const outDir = join(paths.root, "var", "sim");
  mkdirSync(outDir, { recursive: true });
  for (const archetype of ARCHETYPES) {
    const run = simulate(content, archetype, days);
    console.log(`${table(run)}\n`);
    const csv = [
      "day,tier,tool,fill,cap,metal_fragments,hqm,scrap,items,building",
      ...run.rows.map((row) =>
        [
          row.day,
          row.tier,
          row.tool,
          row.fill,
          row.cap,
          row.metalFragments,
          row.hqm,
          row.scrap,
          row.items,
          row.building,
        ].join(","),
      ),
    ].join("\n");
    writeFileSync(join(outDir, `${archetype}.csv`), `${csv}\n`);
  }
  console.log(`csv: ${outDir}`);
}

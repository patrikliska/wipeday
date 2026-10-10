/**
 * `pnpm sim [days]`            every archetype and scenario: per-day tables, CSV in var/sim/
 * `pnpm sim check [--full] [--phase R1]`
 *                              judge `pacing.json5` (the test profile, or 365 days × 3 seeds);
 *                              exit 1 when a switched-on assertion fails or has no check.
 *                              `--phase` also judges a later phase's assertions, to see them
 *                              before it ships (only the shipped ones set the exit code)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { PHASES, type Phase } from "@wipe-day/content/schema";
import { checkPacing, type Life, phaseIndex, simulateAll } from "./sim";

/** CSV output goes to `var/sim/` at the repo root, next to the other local runtime state. */
const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const content = loadContent(contentPaths.data, loadLocale());

const args = process.argv.slice(2);
const sci = (value: number): string =>
  value === 0 ? "0" : value < 1e4 ? value.toFixed(0) : value.toExponential(2);

/** The days worth a row: the first week, then the checkpoints the targets read. */
const SHOWN = new Set([1, 2, 3, 4, 5, 6, 7, 14, 21, 30, 45, 60, 90, 120, 180, 270, 365]);

function table(life: Life): string {
  const lines = [
    `${life.name}: first hand ${life.firstHandSeconds === null ? "-" : `${life.firstHandSeconds}s`}, ` +
      `largest ${sci(life.largest)}, ${life.runs.length} run(s), ${life.steps} commands`,
    "  day  run   supplies       made   lifetime  owned hands  glass nukes      taps",
  ];
  for (const row of life.days.filter((row) => SHOWN.has(row.day) || row === life.days.at(-1))) {
    lines.push(
      `  ${String(row.day).padStart(3)} ${String(row.run).padStart(4)} ${sci(row.supplies).padStart(10)} ` +
        `${sci(row.made).padStart(10)} ${sci(row.lifetime).padStart(10)} ${String(row.owned).padStart(6)} ` +
        `${String(row.hands).padStart(5)} ${String(row.glassEver).padStart(6)} ${String(row.nukes).padStart(5)} ` +
        `${String(row.taps).padStart(9)}`,
    );
  }
  return lines.join("\n");
}

if (args[0] === "check") {
  const profile = args.includes("--full") ? "full" : "test";
  const asked = args[args.indexOf("--phase") + 1];
  const upTo: Phase =
    args.includes("--phase") && PHASES.includes(asked as Phase)
      ? (asked as Phase)
      : content.pacing.shipped;
  const started = performance.now();
  const verdicts = checkPacing(content, profile, upTo);
  for (const verdict of verdicts) {
    const label = verdict.status.toUpperCase().padEnd(7);
    console.log(
      `${label} ${verdict.n.padEnd(5)} ${verdict.on}  ${verdict.check}${verdict.detail ? `: ${verdict.detail}` : ""}`,
    );
  }
  const shipped = phaseIndex(content.pacing.shipped);
  const bad = verdicts.filter(
    (verdict) =>
      (verdict.status === "fail" || verdict.status === "missing") &&
      phaseIndex(verdict.on) <= shipped,
  );
  console.log(
    `${bad.length === 0 ? "OK" : `${bad.length} failed`}: shipped ${content.pacing.shipped}, ` +
      `profile ${profile}, ${((performance.now() - started) / 1000).toFixed(1)} s`,
  );
  process.exitCode = bad.length === 0 ? 0 : 1;
} else {
  const days = Number(args[0] ?? 30);
  const outDir = join(repoRoot, "var", "sim");
  mkdirSync(outDir, { recursive: true });
  for (const life of simulateAll(content, days)) {
    console.log(`${table(life)}\n`);
    const csv = [
      "day,run,supplies,made,lifetime,owned,hands,glassEver,nukes,taps",
      ...life.days.map((row) =>
        [
          row.day,
          row.run,
          row.supplies,
          row.made,
          row.lifetime,
          row.owned,
          row.hands,
          row.glassEver,
          row.nukes,
          row.taps,
        ].join(","),
      ),
    ].join("\n");
    writeFileSync(join(outDir, `${life.name}.csv`), `${csv}\n`);
  }
  console.log(`csv: ${outDir}`);
}

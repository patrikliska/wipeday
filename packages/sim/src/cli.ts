/**
 * `pnpm sim [days]`            every archetype and scenario: per-day tables, CSV in var/sim/
 * `pnpm sim check [--full] [--phase R1]`
 *                              judge `pacing.json5` (the test profile, or 365 days × 3 seeds);
 *                              exit 1 when a switched-on assertion fails or has no check.
 *                              `--phase` also judges a later phase's assertions, to see them
 *                              before it ships (only the shipped ones set the exit code)
 * `pnpm sim window [days]`     what the Night Shift's 2 h window costs on day 1 against R1's 12 h,
 *                              with and without the Workshop (12-feel.md 15)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadContent, loadLocale } from "@wipe-day/content/load";
import { contentPaths } from "@wipe-day/content/paths";
import { PHASES, type Phase } from "@wipe-day/content/schema";
import {
  checkPacing,
  dayClock,
  type Life,
  phaseIndex,
  simulateAll,
  type WindowRow,
  windowReport,
} from "./sim";

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

/** The window report: one block per archetype, a row per variant, against the 12 h one. */
function windowTable(rows: WindowRow[]): string {
  const out: string[] = [];
  const names = [...new Set(rows.map((row) => row.archetype))];
  for (const name of names) {
    const mine = rows.filter((row) => row.archetype === name);
    const base = mine.find((row) => row.variant.startsWith("12 h")) ?? mine[0];
    if (name === "firstHour") {
      out.push("firstHour (continuous play): the first nuke");
      for (const row of mine) {
        const at = row.firstNuke === null ? "never" : clockOf(row.firstNuke);
        out.push(`  ${row.variant.padEnd(22)} ${at}`);
      }
      continue;
    }
    const times = (base?.checkIns ?? []).map((c) => dayClock(c.at).slice(6));
    out.push(`${name}: lifetime made at each day-1 check-in, at day 1's end, and the first nuke`);
    out.push(
      `  ${"".padEnd(22)} ${times.map((t) => t.padStart(9)).join(" ")}   day end   vs 12 h   first nuke`,
    );
    for (const row of mine) {
      const loss = base && base.dayEnd > 0 ? row.dayEnd / base.dayEnd - 1 : 0;
      out.push(
        `  ${row.variant.padEnd(22)} ${row.checkIns.map((c) => sci(c.made).padStart(9)).join(" ")} ` +
          `${sci(row.dayEnd).padStart(9)} ${`${(loss * 100).toFixed(0)}%`.padStart(9)}   ` +
          `${row.firstNuke === null ? "not yet" : dayClock(row.firstNuke)}`,
      );
    }
  }
  return out.join("\n");
}

const clockOf = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

if (args[0] === "window") {
  const days = Number(args[1] ?? 3);
  console.log(windowTable(windowReport(content, days)));
} else if (args[0] === "check") {
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

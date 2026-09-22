/**
 * `pnpm assets <sync|check>`
 *
 * - `sync`:  regenerate `assets/manifest.json` and `assets/ASSETS.md` from the
 *   data files, with each row's status filled in from what is on disk.
 * - `check`: `sync`, then print what is missing or unusable. Exits non-zero if
 *   a supplied file is unusable, or anything needed by the current phase is
 *   missing.
 */
import { join } from "node:path";
import { checkAssets, type Finding, type Report, reportFails } from "../assets/check";
import { CHECKLIST_FILE, MANIFEST_FILE, plannedAssets, writeManifest } from "../assets/manifest";
import { loadContent } from "../content/load";
import { discoverPaths } from "../paths";
import { CURRENT_PHASE } from "../phase";
import { Locale } from "../ui/locale";

function sync(): Report {
  const paths = discoverPaths();
  const locale = Locale.load(join(paths.locale, "en.json"));
  const content = loadContent(paths.data, locale);
  const report = checkAssets(paths.assets, plannedAssets(content, locale, paths.assets));
  writeManifest(paths.assets, report.specs, CURRENT_PHASE);
  console.log(
    `wrote ${MANIFEST_FILE} and ${CHECKLIST_FILE} (${report.specs.length} assets planned)`,
  );
  return report;
}

function table(title: string, findings: Finding[]): void {
  if (findings.length === 0) return;
  const width = Math.max(
    ...findings.map((finding) => finding.folder.length + finding.file.length + 1),
  );
  console.log(`\n${title}`);
  for (const finding of findings) {
    console.log(`  ${`${finding.folder}/${finding.file}`.padEnd(width)}  ${finding.problem}`);
  }
}

function printReport(report: Report): number {
  const due = report.missing.filter((finding) => finding.phase <= CURRENT_PHASE);
  const next = report.missing.filter((finding) => finding.phase === CURRENT_PHASE + 1);
  const later = report.missing.length - due.length - next.length;
  const supplied = report.specs.filter((spec) => spec.status === "present").length;

  table("UNUSABLE (fix these)", report.invalid);
  table("NOT IN THE MANIFEST (typo? these files are ignored)", report.unlisted);
  table(`MISSING, needed now (phase <= ${CURRENT_PHASE})`, due);
  table(`MISSING, needed next (phase ${CURRENT_PHASE + 1})`, next);

  console.log(
    `\nassets: ${supplied}/${report.specs.length} present, ${report.specs.length - supplied} placeholders` +
      ` (${later} of the missing are for later phases)`,
  );
  if (reportFails(report, CURRENT_PHASE)) {
    console.log("FAILED: see UNUSABLE / MISSING, needed now above.");
    return 1;
  }
  console.log(`OK: nothing required for phase ${CURRENT_PHASE} is missing.`);
  return 0;
}

const command = process.argv[2];
try {
  if (command === "sync") {
    sync();
  } else if (command === "check") {
    process.exitCode = printReport(sync());
  } else {
    console.error("usage: pnpm assets <sync|check>");
    process.exitCode = 2;
  }
} catch (error) {
  console.error(`error: ${(error as Error).message}`);
  process.exitCode = 1;
}

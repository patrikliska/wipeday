// pnpm art <step> [args]: the art pipeline in one place (D190, D204). Steps:
//
//   palette                     the 48 colours from the Scene Mock -> packages/content/art/palette.*
//   seed                        the mock's approved sprites into the game's art folder
//   chips                       the hand-pixelled chips and the stockpile's pallet (D217)
//   gen <jobs.json> <out> [--estimate] [--only=a,b] [--collect]   generate on Retro Diffusion
//   sheet <dir> <out.png> [zoom]                                 a contact sheet to pick from
//   clean <in> <out> [--keep-size]                               one file or folder onto the grid
//   install <picks.json>                                         the chosen takes into the game
//
// Always `gen ... --estimate` first; the README in docs/redesign/art/ is the manual.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PYTHON = { palette: "palette.py", seed: "seed.py", sheet: "sheet.py", chips: "chips.py" };
const MORE_PYTHON = { clean: "clean.py", install: "install.py" };
const [step, ...rest] = process.argv.slice(2);
const script = PYTHON[step] ?? MORE_PYTHON[step];
const run = script
  ? spawnSync("python", ["-I", path.join(here, script), ...rest], { stdio: "inherit" })
  : step === "gen"
    ? spawnSync(process.execPath, [path.join(here, "gen.mjs"), ...rest], { stdio: "inherit" })
    : null;
if (!run) {
  console.log(
    "pnpm art <palette|seed|chips|gen|sheet|clean|install> [args] (see scripts/art/art.mjs)",
  );
  process.exit(step ? 1 : 0);
}
process.exit(run.status ?? 1);

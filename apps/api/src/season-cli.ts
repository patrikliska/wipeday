/**
 * Ends or announces a season (W7) by asking the running API, so the API stays the database's
 * only writer.
 *
 *   pnpm season announce 2026-10-26 [--next storm_season]   the end shows in the game
 *   pnpm season announce none                                takes the announcement back
 *   pnpm season end                                          backup, archive, legacy, new season
 *
 * Reads API_PORT and ADMIN_TOKEN from the environment (the repo's .env in development, the
 * container's env on the server: `docker exec wipeday pnpm season end`).
 */
import { loadConfig } from "./config";

const config = loadConfig();
const [action, when] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const nextAt = process.argv.indexOf("--next");
const next = nextAt >= 0 ? (process.argv[nextAt + 1] ?? null) : null;
const say = (line: string) => process.stdout.write(`${line}\n`);
const fail = (line: string) => {
  process.stderr.write(`${line}\n`);
  process.exitCode = 1;
};

async function call(path: string, body: unknown): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${config.port}/api/admin${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.adminToken ? { authorization: `Bearer ${config.adminToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (response.ok) say(`${response.status} ${text}`);
  else fail(`${response.status} ${text}`);
}

if (action === "end") {
  await call("/season/end", {});
} else if (action === "announce" && when) {
  const endsAt = when === "none" ? null : Math.floor(Date.parse(`${when}T20:00:00Z`) / 1000);
  if (endsAt !== null && Number.isNaN(endsAt)) fail(`not a date: ${when} (use YYYY-MM-DD)`);
  else await call("/season/announce", { endsAt, next });
} else {
  fail("usage: pnpm season end | pnpm season announce <YYYY-MM-DD|none> [--next <modifier>]");
}

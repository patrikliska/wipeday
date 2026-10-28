/**
 * The admin's commands over loopback (docs/redesign/09-architecture.md 9.6; R4):
 *
 *   tsx src/admin-cli.ts grant --player 1 --glass 5 --skin founder --note founders [--key k]
 *   tsx src/admin-cli.ts respec-all --note "D2xx: ring 2 repriced"
 *   tsx src/admin-cli.ts status
 *
 * On the server: `docker exec -w /app/apps/api wipeday node_modules/.bin/tsx src/admin-cli.ts …`.
 * Each call is one idempotent command through the API (`--key` repeats one exactly); the API
 * logs `granted` / `respecced` and pushes the state to the player's open tabs.
 */
import { randomUUID } from "node:crypto";
import { loadConfig } from "./config";

const config = loadConfig();
const [verb = "", ...rest] = process.argv.slice(2);
const flags = new Map<string, string>();
for (let i = 0; i < rest.length; i += 2) {
  const name = rest[i];
  const value = rest[i + 1];
  if (name?.startsWith("--") && value !== undefined) flags.set(name.slice(2), value);
}

const base = `http://127.0.0.1:${config.port}/api/admin`;
const headers: Record<string, string> = { "content-type": "application/json" };
if (config.adminToken) headers.authorization = `Bearer ${config.adminToken}`;

async function call(path: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text}`);
  return JSON.parse(text);
}

async function main(): Promise<void> {
  const note = flags.get("note") ?? "";
  const key = flags.get("key") ?? `admin:${randomUUID()}`;
  if (verb === "grant") {
    const playerId = Number(flags.get("player"));
    if (!Number.isInteger(playerId)) throw new Error("--player <id> is required");
    const result = await call("/grant", {
      key,
      playerId,
      glass: Number(flags.get("glass") ?? 0),
      skin: flags.get("skin") ?? null,
      note: note || "grant",
    });
    console.log(JSON.stringify({ key, ...(result as object) }));
  } else if (verb === "respec-all") {
    if (!note) throw new Error("--note <decision> is required: a respec ships with a decision");
    const result = await call("/respec_all", { key, note });
    console.log(JSON.stringify({ key, ...(result as object) }));
  } else if (verb === "status") {
    const response = await fetch(`http://127.0.0.1:${config.port}/api/status`, { headers });
    console.log(await response.text());
  } else {
    console.error(
      "usage: admin-cli grant|respec-all|status [--player id] [--glass n] [--skin id] [--note text] [--key k]",
    );
    process.exit(2);
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});

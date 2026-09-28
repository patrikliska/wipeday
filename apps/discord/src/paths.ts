/**
 * Where the bot's on-disk resources live. Data and locale come from its frozen
 * copy in `legacy/content` (D57); assets, migrations and previews belong to this app.
 * `.env` and `var/` (the database) stay at the repo root, shared by every app.
 * `IDLE_ROOT` overrides the repo root in deployment.
 */
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { contentPaths } from "./legacy/content/paths";

export interface Paths {
  /** Repo root: `.env`, `var/`. */
  readonly root: string;
  /** `apps/discord`. */
  readonly app: string;
  readonly data: string;
  readonly assets: string;
  readonly preview: string;
  readonly migrations: string;
}

export function pathsAt(root: string, app: string): Paths {
  return {
    root,
    app,
    data: contentPaths.data,
    assets: join(app, "assets"),
    preview: join(root, "preview"),
    migrations: join(app, "src", "store", "migrations"),
  };
}

export function discoverPaths(): Paths {
  const app = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
  const root = process.env.IDLE_ROOT ? resolve(process.env.IDLE_ROOT) : resolve(app, "..", "..");
  return pathsAt(root, app);
}

/**
 * Where the on-disk resources live. Data, locale and assets are read from disk
 * (not bundled) so balance and art can change without touching code.
 * `IDLE_ROOT` overrides the root in deployment; by default it is the repo root.
 */
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface Paths {
  readonly root: string;
  readonly data: string;
  readonly locale: string;
  readonly assets: string;
  readonly preview: string;
  readonly migrations: string;
}

export function pathsAt(root: string): Paths {
  return {
    root,
    data: join(root, "data"),
    locale: join(root, "locale"),
    assets: join(root, "assets"),
    preview: join(root, "preview"),
    migrations: join(root, "src", "store", "migrations"),
  };
}

export function discoverPaths(): Paths {
  const here = fileURLToPath(new URL(".", import.meta.url));
  return pathsAt(process.env.IDLE_ROOT ? resolve(process.env.IDLE_ROOT) : resolve(here, ".."));
}

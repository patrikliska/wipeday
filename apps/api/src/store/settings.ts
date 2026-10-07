/** The `settings` table: small server-wide values (the casino secret, the jackpot, cursors). */
import { eq } from "drizzle-orm";
import type { Db } from "./db";
import { settings } from "./schema";

export function setting(db: Db, key: string): string | undefined {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value;
}

export function putSetting(db: Db, key: string, value: string): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

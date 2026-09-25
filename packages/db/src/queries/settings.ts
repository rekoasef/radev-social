import { eq } from "drizzle-orm";
import type { Database } from "../client";
import { settings } from "../schema";
import type { Executor } from "./brand-assets";

// Global key/value settings (e.g. the generation window). Values are JSON; whoever reads one
// parses it with its own rules (packages/core) and falls back to defaults.

export async function getSetting(db: Executor, key: string): Promise<unknown> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key));
  return row?.value;
}

export async function setSetting(db: Database, key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

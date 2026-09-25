import {
  BLUELYTICS_URLS,
  type BluelyticsSnapshot,
  type DataRefreshJob,
  type DollarKind,
  isDataSource,
  trimBluelyticsHistory,
} from "@radev/core";
import { type Database, saveDataSnapshot } from "@radev/db";
import { z } from "zod";
import type { Logger } from "../logger";

// data.refresh (docs/ARCHITECTURE.md §6, phase 3 T11): fetches a source's data of the day and
// stores it as a snapshot. Daily by cron, or by hand from the panel. A second run the same day
// replaces the snapshot (rule 8). Nothing here is secret: Bluelytics is public and needs no key.

/** Time given to each request before giving up (pg-boss retries the job). */
const FETCH_TIMEOUT_MS = 30_000;

const rateSchema = z.object({
  value_buy: z.number().positive(),
  value_sell: z.number().positive(),
});

const latestSchema = z.object({
  blue: rateSchema,
  oficial: rateSchema,
  last_update: z.string().regex(/^\d{4}-\d{2}-\d{2}T/),
});

const historySchema = z.array(
  z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    source: z.string(),
    value_buy: z.number(),
    value_sell: z.number(),
  }),
);

const HISTORY_KINDS: Record<string, DollarKind> = { Blue: "blue", Oficial: "oficial" };

/** Bluelytics' two answers as one snapshot, or an error that says what came wrong. */
export function parseBluelytics(latest: unknown, history: unknown): BluelyticsSnapshot {
  const now = latestSchema.safeParse(latest);
  if (!now.success) throw new Error(`Bluelytics /latest cambió de forma: ${now.error.message}`);
  const past = historySchema.safeParse(history);
  if (!past.success)
    throw new Error(`Bluelytics /evolution cambió de forma: ${past.error.message}`);
  const asOf = now.data.last_update.slice(0, 10);
  const entries = past.data.flatMap((entry) => {
    const kind = HISTORY_KINDS[entry.source];
    return kind && entry.value_sell > 0
      ? [{ date: entry.date, kind, buy: entry.value_buy, sell: entry.value_sell }]
      : [];
  });
  const rate = (r: z.infer<typeof rateSchema>) => ({ buy: r.value_buy, sell: r.value_sell });
  return {
    lastUpdate: now.data.last_update,
    latest: { blue: rate(now.data.blue), oficial: rate(now.data.oficial) },
    history: trimBluelyticsHistory(entries, asOf),
  };
}

async function getJson(fetcher: typeof fetch, url: string): Promise<unknown> {
  const response = await fetcher(url, {
    headers: { accept: "application/json", "user-agent": "radev-social (data.refresh)" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} respondió ${response.status}.`);
  return response.json();
}

export type RefreshDeps = { db: Database; log: Logger; fetch?: typeof fetch };

export type RefreshOutcome = { source: string; asOf: string } | "skipped";

export async function refreshData(deps: RefreshDeps, job: DataRefreshJob): Promise<RefreshOutcome> {
  const fetcher = deps.fetch ?? fetch;
  if (!isDataSource(job.source)) {
    deps.log.warn("data refresh skipped: unknown source", { source: job.source });
    return "skipped";
  }
  switch (job.source) {
    case "bluelytics": {
      const [latest, history] = await Promise.all([
        getJson(fetcher, BLUELYTICS_URLS.latest),
        getJson(fetcher, BLUELYTICS_URLS.history),
      ]);
      const snapshot = parseBluelytics(latest, history);
      const asOf = snapshot.lastUpdate.slice(0, 10);
      await saveDataSnapshot(deps.db, { source: "bluelytics", asOf, payload: snapshot });
      deps.log.info("data refreshed", {
        source: job.source,
        asOf,
        blue: snapshot.latest.blue.sell,
        oficial: snapshot.latest.oficial.sell,
        historyEntries: snapshot.history.length,
      });
      return { source: job.source, asOf };
    }
  }
}

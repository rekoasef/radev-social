// Automatic filling of slots (docs/PRD.md RF-26 and RF-31, phase 4 T4): during the generation
// window, `slots.fill` gives each free slot time of the next days a post for the AI to write,
// with the pillar the mix needs most and an idea from the bank. Pure: the worker reads the data
// and applies the plan.

import type { AiQuota } from "../ai/limits";
import { normalizeLocalTime, parseLocalTime, type SlotOccurrence } from "./slots";
import { wallClock } from "./zoned";

/** Days ahead the filling covers (docs/PROGRESS.md, phase 4: 7 days). */
export const FILL_DAYS = 7;

/** A slot closer than this is left alone: the post would not be written and reviewed in time. */
export const FILL_MIN_LEAD_MS = 2 * 60 * 60 * 1000;

/** How far back the mix looks at what the brand already has (plus everything planned ahead). */
export const MIX_LOOKBACK_DAYS = 28;

/** How often the job wakes up; it does something only inside the window. */
export const SLOTS_FILL_CRON = "*/15 * * * *";

export const GENERATION_WINDOW_KEY = "generation_window";

export type GenerationWindow = {
  /** Off by default: the operator turns it on (docs/PROGRESS.md, phase 4 T4). */
  enabled: boolean;
  /** "HH:MM" local times; the window may cross midnight (e.g. 23:00–05:00). */
  start: string;
  end: string;
  timeZone: string;
};

export const DEFAULT_GENERATION_WINDOW: GenerationWindow = {
  enabled: false,
  start: "02:00",
  end: "07:00",
  timeZone: "America/Argentina/Buenos_Aires",
};

function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The stored setting, with the defaults for whatever is missing or invalid. */
export function parseGenerationWindow(value: unknown): GenerationWindow {
  const raw = (value ?? {}) as Record<string, unknown>;
  const time = (v: unknown, fallback: string) =>
    (typeof v === "string" && normalizeLocalTime(v)) || fallback;
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_GENERATION_WINDOW.enabled,
    start: time(raw.start, DEFAULT_GENERATION_WINDOW.start),
    end: time(raw.end, DEFAULT_GENERATION_WINDOW.end),
    timeZone: isTimeZone(raw.timeZone) ? raw.timeZone : DEFAULT_GENERATION_WINDOW.timeZone,
  };
}

/** Whether `now` falls in the window (start included, end excluded), in its zone. */
export function isWithinWindow(now: Date, window: GenerationWindow): boolean {
  if (!window.enabled) return false;
  const start = parseLocalTime(window.start);
  const end = parseLocalTime(window.end);
  if (!start || !end) return false;
  const w = wallClock(now, window.timeZone);
  const minute = w.hour * 60 + w.minute;
  const from = start.hour * 60 + start.minute;
  const to = end.hour * 60 + end.minute;
  if (from === to) return false;
  return from < to ? minute >= from && minute < to : minute >= from || minute < to;
}

/**
 * How many posts the brand may still start by its own caps: the successful generations already
 * counted plus the ones in flight (`generating`). Infinity with no caps.
 */
export function fillBudget(
  quota: AiQuota,
  used: { today: number; month: number },
  inFlight: number,
): number {
  const left = (limit: number | null, done: number) =>
    limit === null ? Number.POSITIVE_INFINITY : Math.max(0, limit - done - inFlight);
  return Math.min(left(quota.daily, used.today), left(quota.monthly, used.month));
}

export type MixPillar = { key: string; share: number };

/**
 * Pillars from most to least needed: the one furthest below its share of the brand's posts
 * (counting the next one) comes first. Ties: the bigger share, then the key.
 */
export function pillarsByNeed(
  pillars: readonly MixPillar[],
  counts: Readonly<Record<string, number>>,
): string[] {
  const active = pillars.filter((pillar) => pillar.share > 0);
  const total = active.reduce((sum, pillar) => sum + (counts[pillar.key] ?? 0), 0) + 1;
  return [...active]
    .map((pillar) => ({ ...pillar, deficit: pillar.share * total - (counts[pillar.key] ?? 0) }))
    .sort((a, b) => b.deficit - a.deficit || b.share - a.share || a.key.localeCompare(b.key))
    .map((pillar) => pillar.key);
}

export type FillIdea = { id: string; pillarKey: string | null };

export type FillAssignment = { occurrence: SlotOccurrence; pillarKey: string; ideaId: string };

export type FillPlan = {
  assignments: FillAssignment[];
  /** A pillar the bank has no ideas for: ask the AI for some (the next run fills with them). */
  needIdeasFor: string | null;
  /** Free slots left without a post (no budget or no ideas). */
  unfilled: number;
};

/**
 * Which post each free slot gets. Slots in order; each one takes the most needed pillar that has
 * an idea (its own, or one without a pillar), oldest idea first, and counts it for the next.
 */
export function planFill(input: {
  free: readonly SlotOccurrence[];
  pillars: readonly MixPillar[];
  counts: Readonly<Record<string, number>>;
  /** New ideas of the bank, oldest first. */
  ideas: readonly FillIdea[];
  budget: number;
}): FillPlan {
  const counts: Record<string, number> = { ...input.counts };
  const available = [...input.ideas];
  const assignments: FillAssignment[] = [];
  let needIdeasFor: string | null = null;
  const keys = new Set(input.pillars.map((pillar) => pillar.key));

  for (const occurrence of input.free) {
    if (assignments.length >= input.budget) break;
    const order = pillarsByNeed(input.pillars, counts);
    let chosen: { pillarKey: string; index: number } | undefined;
    for (const pillarKey of order) {
      const own = available.findIndex((idea) => idea.pillarKey === pillarKey);
      const loose = available.findIndex(
        (idea) => idea.pillarKey === null || !keys.has(idea.pillarKey),
      );
      const index = own >= 0 ? own : loose;
      if (index >= 0) {
        chosen = { pillarKey, index };
        break;
      }
      needIdeasFor ??= pillarKey;
    }
    if (!chosen) break;
    const [idea] = available.splice(chosen.index, 1);
    if (!idea) break;
    assignments.push({ occurrence, pillarKey: chosen.pillarKey, ideaId: idea.id });
    counts[chosen.pillarKey] = (counts[chosen.pillarKey] ?? 0) + 1;
  }
  return {
    assignments,
    needIdeasFor,
    unfilled: input.free.length - assignments.length,
  };
}

/** The weekly research (docs/PRD.md RF-11, phase 4 T5): once a week per brand, in the window. */
export const RESEARCH_EVERY_DAYS = 7;

/** After a failed research, the next try waits this long (the window runs every 15 min). */
export const RESEARCH_RETRY_HOURS = 24;

/**
 * Whether a brand is due its weekly research: none that worked (or is still running) in the last
 * week, and no attempt at all in the last day (a failed one is not retried every 15 minutes).
 */
export function researchDue(last: { ok: Date | null; any: Date | null }, now: Date): boolean {
  const ago = (at: Date | null, ms: number) => at !== null && now.getTime() - at.getTime() < ms;
  if (ago(last.ok, RESEARCH_EVERY_DAYS * 86_400_000)) return false;
  return !ago(last.any, RESEARCH_RETRY_HOURS * 3_600_000);
}

/** What the last run did, shown in Settings (stored under `slots_fill_last`). */
export type FillReport = {
  at: string;
  brands: {
    slug: string;
    created: string[];
    requestedIdeasFor: string | null;
    /** The weekly research was asked for in this run. */
    researched: boolean;
    unfilled: number;
    /** Why a brand was skipped or left slots empty, in Spanish. */
    note: string | null;
  }[];
};

export const FILL_REPORT_KEY = "slots_fill_last";

import {
  capNotice,
  FILL_DAYS,
  FILL_MIN_LEAD_MS,
  FILL_REPORT_KEY,
  type FillReport,
  fillBudget,
  GENERATION_WINDOW_KEY,
  IDEA_COUNT_DEFAULT,
  type IdeaRequestTask,
  ideaPrompt,
  isWithinWindow,
  localDateOf,
  MIX_LOOKBACK_DAYS,
  type Notice,
  parseGenerationWindow,
  planFill,
  researchDue,
  shareToPercent,
  upcomingSlots,
} from "@radev/core";
import {
  type Brand,
  countGeneratingPosts,
  createGeneratingPost,
  createIdeaRequest,
  type Database,
  getBrandAiUsage,
  getSetting,
  lastIdeaRequestTimes,
  listBankIdeasForFill,
  listBrands,
  listPillars,
  listPlannedTimes,
  listScheduleSlots,
  pillarPostCounts,
  setSetting,
} from "@radev/db";
import type { Logger } from "../logger";

// slots.fill (docs/ARCHITECTURE.md §6, phase 4 T4): during the generation window, every free slot
// time of the next days gets a post for the AI to write, planned there (approving it schedules
// it, T2). The pillar follows the mix and the idea comes from the bank; with no ideas, it asks the
// AI for some and the next run uses them. Once a week each brand also gets its web research of
// topics (ideas.research, T5). Idempotent: a slot time holds one post (unique index)
// and a bank idea is used once (rule 8).

export type FillDeps = {
  db: Database;
  log: Logger;
  queueGenerate: (postId: string) => Promise<void>;
  queueIdeaRequest: (task: IdeaRequestTask, requestId: string) => Promise<void>;
  /** A brand reached its cap (Telegram, phase 4 T6). */
  notify?: (notice: Notice) => Promise<void>;
  now?: Date;
};

export type FillOutcome = "outside-window" | FillReport;

export async function fillSlots(deps: FillDeps): Promise<FillOutcome> {
  const now = deps.now ?? new Date();
  const window = parseGenerationWindow(await getSetting(deps.db, GENERATION_WINDOW_KEY));
  if (!isWithinWindow(now, window)) return "outside-window";

  const report: FillReport = { at: now.toISOString(), brands: [] };
  for (const brand of await listBrands(deps.db)) {
    if (brand.archivedAt !== null) continue;
    const entry = await fillBrand(deps, brand, now);
    entry.researched = await weeklyResearch(deps, brand, now);
    report.brands.push(entry);
  }
  await setSetting(deps.db, FILL_REPORT_KEY, report);
  return report;
}

async function fillBrand(
  deps: FillDeps,
  brand: Brand,
  now: Date,
): Promise<FillReport["brands"][number]> {
  const { db, log } = deps;
  const entry = {
    slug: brand.slug,
    created: [] as string[],
    requestedIdeasFor: null as string | null,
    researched: false,
    unfilled: 0,
    note: null as string | null,
  };

  const occurrences = upcomingSlots(await listScheduleSlots(db, brand.id), {
    from: new Date(now.getTime() + FILL_MIN_LEAD_MS),
    days: FILL_DAYS,
    timeZone: brand.timezone,
  });
  if (occurrences.length === 0) return { ...entry, note: "Sin horarios en los próximos días." };
  const last = occurrences.at(-1);
  const taken = await listPlannedTimes(db, {
    brandId: brand.id,
    from: now,
    to: new Date((last?.at.getTime() ?? now.getTime()) + 1),
  });
  const busy = new Set(taken.map((at) => at.getTime()));
  const free = occurrences.filter((occurrence) => !busy.has(occurrence.at.getTime()));
  if (free.length === 0) return entry;

  const pillars = await listPillars(db, brand.id);
  if (pillars.length === 0) return { ...entry, unfilled: free.length, note: "Sin pilares." };

  // One after the other: inside a transaction they share one connection.
  const usage = await getBrandAiUsage(db, brand, now);
  const inFlight = await countGeneratingPosts(db, brand.id);
  const counts = await pillarPostCounts(db, {
    brandId: brand.id,
    since: new Date(now.getTime() - MIX_LOOKBACK_DAYS * 86_400_000),
    now,
  });
  const bank = await listBankIdeasForFill(db, brand.id);
  const budget = fillBudget(
    { daily: brand.aiDailyLimit, monthly: brand.aiMonthlyLimit },
    usage,
    inFlight,
  );
  const plan = planFill({
    free,
    pillars: pillars.map((pillar) => ({ key: pillar.key, share: pillar.targetShare })),
    counts,
    ideas: bank,
    budget,
  });

  for (const assignment of plan.assignments) {
    const idea = bank.find((candidate) => candidate.id === assignment.ideaId);
    if (!idea) continue;
    try {
      const post = await createGeneratingPost(db, {
        brandId: brand.id,
        request: {
          idea: ideaPrompt(idea),
          pillarKey: assignment.pillarKey,
          hookType: idea.seriesHook,
          seriesKey: idea.seriesKey,
        },
        ideaId: idea.id,
        plan: { at: assignment.occurrence.at, slotId: assignment.occurrence.slotId },
      });
      await deps.queueGenerate(post.id);
      entry.created.push(post.publicCode);
    } catch (error) {
      // Someone planned that time (or used the idea) meanwhile: that slot is done, move on.
      log.warn("slot not filled", {
        brand: brand.slug,
        at: assignment.occurrence.at.toISOString(),
        error,
      });
    }
  }

  entry.unfilled = plan.unfilled + (plan.assignments.length - entry.created.length);
  if (plan.needIdeasFor) {
    const requested = await createIdeaRequest(db, {
      brandId: brand.id,
      task: "ideas.generate",
      params: {
        count: IDEA_COUNT_DEFAULT,
        pillarKey: plan.needIdeasFor,
        seriesKey: null,
        focus: null,
      },
    });
    if (requested.ok) {
      await deps.queueIdeaRequest("ideas.generate", requested.request.id);
      entry.requestedIdeasFor = plan.needIdeasFor;
    }
  }
  if (entry.unfilled > 0 && budget <= plan.assignments.length) {
    entry.note = "Llegó a su tope de generaciones.";
    await deps.notify?.(
      capNotice({
        brandSlug: brand.slug,
        brandName: brand.name,
        localDate: localDateOf(now, brand.timezone),
      }),
    );
  } else if (entry.unfilled > 0) {
    entry.note = "Faltan ideas: se pidieron a la IA.";
  }
  log.info("brand filled", {
    brand: brand.slug,
    created: entry.created,
    unfilled: entry.unfilled,
    requestedIdeasFor: entry.requestedIdeasFor,
    mix: Object.fromEntries(pillars.map((p) => [p.key, shareToPercent(p.targetShare)])),
  });
  return entry;
}

/** The brand's weekly research of topics, when it is due (and none is already open). */
async function weeklyResearch(deps: FillDeps, brand: Brand, now: Date): Promise<boolean> {
  const last = await lastIdeaRequestTimes(deps.db, { brandId: brand.id, task: "ideas.research" });
  if (!researchDue(last, now)) return false;
  const requested = await createIdeaRequest(deps.db, {
    brandId: brand.id,
    task: "ideas.research",
    params: { count: IDEA_COUNT_DEFAULT, pillarKey: null, seriesKey: null, focus: null },
  });
  if (!requested.ok) return false;
  await deps.queueIdeaRequest("ideas.research", requested.request.id);
  deps.log.info("weekly research asked", { brand: brand.slug });
  return true;
}

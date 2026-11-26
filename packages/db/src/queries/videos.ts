import {
  CLEAR_CONDITION,
  canAdvance,
  checkRejectionNote,
  failVideo,
  INITIAL_STAGE,
  needsNote,
  nextStage,
  type PauseReason,
  pauseVideo,
  REVIEW_STAGES,
  resumeVideo,
  retryVideo,
  type UsageKind,
  type VideoCondition,
  type VideoDocumentKind,
  type VideoEvent,
  type VideoFailure,
  type VideoProgress,
  type VideoStage,
  WORKING_STAGES,
  type WorkingStage,
} from "@radev/core";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
  type GenerationRun,
  generationRuns,
  type UsageEvent,
  usageEvents,
  type Video,
  type VideoDocument,
  type VideoFailureRecord,
  type Voice,
  videoDocuments,
  videos,
  voices,
} from "../schema";
import type { Executor } from "./brand-assets";
import { videoIdeaTokens } from "./video-ideas";

// Videos, the documents the offices leave and their usage. `transitionVideo` is the only code that
// writes `videos.stage` (CLAUDE.md, rule 2): it applies the state machine of packages/core inside a
// transaction. Documents must be validated with their Zod schema (packages/video) before they get
// here (rule 4): this package stores them as given.

/**
 * Runs `work` in a transaction. A `for update` lock lasts only as long as its transaction: called
 * with the pool (not a transaction) it would be released at once and two jobs would race. Given a
 * transaction, this is a nested one (a savepoint) and the caller's lock holds.
 */
const atomic = <T>(db: Executor, work: (tx: Executor) => Promise<T>): Promise<T> =>
  db.transaction(work);

/** The pause and failure of a row, as the `VideoCondition` of packages/core. */
export function rowCondition(
  row: Pick<Video, "pausedAt" | "pauseReason" | "resumeAt" | "failure">,
): VideoCondition {
  return {
    pausedAt: row.pausedAt,
    pauseReason: row.pauseReason,
    resumeAt: row.resumeAt,
    failure: row.failure ? { ...row.failure, at: new Date(row.failure.at) } : null,
  };
}

const failureRecord = (failure: VideoFailure): VideoFailureRecord => ({
  ...failure,
  at: failure.at.toISOString(),
});

export type CreateVideoInput = {
  topic: string;
  brandId?: string | null;
  language?: string;
  voiceId?: string | null;
};

/** A new video starts at the first office (Research). The job is queued by the caller. */
export async function createVideo(db: Executor, input: CreateVideoInput): Promise<Video> {
  const [video] = await db
    .insert(videos)
    .values({
      topic: input.topic.trim(),
      brandId: input.brandId ?? null,
      language: input.language ?? "es",
      voiceId: input.voiceId ?? null,
      stage: INITIAL_STAGE,
    })
    .returning();
  if (!video) throw new Error("No se pudo crear el video.");
  return video;
}

export async function getVideo(db: Executor, videoId: string): Promise<Video | null> {
  const [video] = await db.select().from(videos).where(eq(videos.id, videoId));
  return video ?? null;
}

export function listVideos(
  db: Executor,
  filter: { stages?: readonly VideoStage[] } = {},
): Promise<Video[]> {
  const where = filter.stages?.length ? inArray(videos.stage, [...filter.stages]) : undefined;
  return db.select().from(videos).where(where).orderBy(desc(videos.createdAt));
}

export type VideoTransitionOutcome =
  | { ok: true; from: VideoStage; to: VideoStage }
  | { ok: false; reason: string };

export type TransitionVideoOptions = {
  /** The rejection note (required by the three rejections and by `rejectScript`). */
  note?: string | null;
  now?: Date;
};

/**
 * Applies an event of the state machine to a video, locking its row. A paused video does not
 * advance (it can still be discarded); a rejection needs its note. Moving to another stage clears
 * the failure of the old one. This is the only place that writes `videos.stage`.
 */
export async function transitionVideo(
  db: Executor,
  videoId: string,
  event: VideoEvent,
  options: TransitionVideoOptions = {},
): Promise<VideoTransitionOutcome> {
  return atomic(db, (tx) => applyTransition(tx, videoId, event, options));
}

async function applyTransition(
  db: Executor,
  videoId: string,
  event: VideoEvent,
  options: TransitionVideoOptions,
): Promise<VideoTransitionOutcome> {
  const now = options.now ?? new Date();
  const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).for("update");
  if (!video) return { ok: false, reason: "Ese video no existe." };

  const result = nextStage(video.stage, event);
  if (!result.ok) return result;
  const advance = canAdvance(rowCondition(video), event, now);
  if (!advance.ok) return advance;

  let rejectionNote = video.rejectionNote;
  if (needsNote(event)) {
    const note = checkRejectionNote(options.note);
    if (!note.ok) return note;
    rejectionNote = note.note;
  } else if (event === "approveScript" || event === "approveVideo") {
    rejectionNote = null;
  }

  const changes: Partial<typeof videos.$inferInsert> = { rejectionNote };
  if (result.to !== video.stage) {
    Object.assign(changes, { stage: result.to, failure: null, progress: null });
  }
  if (event === "approveVideo") changes.approvedAt = now;
  if (event === "reopen") changes.approvedAt = null;
  // A discarded video is never worked on again: its pause is over.
  if (event === "archive")
    Object.assign(changes, { pausedAt: null, pauseReason: null, resumeAt: null });

  await db.update(videos).set(changes).where(eq(videos.id, videoId));
  // Every rejection is kept for the report of the office that has to redo the work.
  if (needsNote(event)) {
    await db.insert(usageEvents).values({
      videoId,
      kind: "return",
      office: result.to as WorkingStage,
      quantity: 1,
      unit: "returns",
      data: { event, note: rejectionNote },
    });
  }
  return { ok: true, from: video.stage, to: result.to };
}

export type OfficeDocumentOut = Omit<AddVideoDocumentInput, "videoId">;

/**
 * An office finished: its documents are saved, the title (if the script set one) too, and the video
 * moves on, all in one transaction. If anything fails nothing stays half done: no document without
 * the advance and no advance without its document.
 */
export function completeVideoOffice(
  db: Executor,
  videoId: string,
  documents: readonly OfficeDocumentOut[],
  options: { title?: string; now?: Date } = {},
): Promise<VideoTransitionOutcome> {
  return atomic(db, async (tx) => {
    for (const doc of documents) await addVideoDocument(tx, { ...doc, videoId });
    if (options.title) await setVideoTitle(tx, videoId, options.title);
    const outcome = await transitionVideo(tx, videoId, "officeDone", { now: options.now });
    // A refused advance (the video was archived or paused meanwhile) undoes the documents too.
    if (!outcome.ok) throw new OfficeNotCompleted(outcome.reason);
    return outcome;
  }).catch((error) => {
    if (error instanceof OfficeNotCompleted) return { ok: false as const, reason: error.message };
    throw error;
  });
}

class OfficeNotCompleted extends Error {}

/**
 * Videos at a working stage that nobody has touched for a while, to queue them again (the sweep).
 * A paused or failed video is not stuck: it waits for its own reason.
 */
export async function listStuckVideos(db: Executor, olderThan: Date): Promise<Video[]> {
  const rows = await db
    .select()
    .from(videos)
    .where(
      and(inArray(videos.stage, [...WORKING_STAGES]), sql`${videos.updatedAt} < ${olderThan}`),
    );
  return rows.filter((v) => v.failure === null && v.pausedAt === null);
}

// ───────────── condition: pause, failure (they never change the stage) ─────────────

async function updateCondition(
  db: Executor,
  videoId: string,
  change: (condition: VideoCondition) => VideoCondition,
): Promise<Video | null> {
  return atomic(db, async (tx) => {
    const [video] = await tx.select().from(videos).where(eq(videos.id, videoId)).for("update");
    if (!video) return null;
    const next = change(rowCondition(video));
    const [updated] = await tx
      .update(videos)
      .set({
        pausedAt: next.pausedAt,
        pauseReason: next.pauseReason,
        resumeAt: next.resumeAt,
        failure: next.failure ? failureRecord(next.failure) : null,
      })
      .where(eq(videos.id, videoId))
      .returning();
    return updated ?? null;
  });
}

export const pauseVideoById = (
  db: Executor,
  videoId: string,
  reason: PauseReason,
  resumeAt: Date | null = null,
  now = new Date(),
) => updateCondition(db, videoId, (c) => pauseVideo(c, reason, now, resumeAt));

export const resumeVideoById = (db: Executor, videoId: string) =>
  updateCondition(db, videoId, resumeVideo);

/** An office failed: recorded on the video, nothing else changes. */
export const recordVideoFailure = (db: Executor, videoId: string, failure: VideoFailure) =>
  updateCondition(db, videoId, (c) => failVideo(c, failure));

/** "Reintentar": the failure goes away so the office can run again. */
export const retryVideoById = (db: Executor, videoId: string) =>
  updateCondition(db, videoId, retryVideo);

export const clearVideoCondition = (db: Executor, videoId: string) =>
  updateCondition(db, videoId, () => CLEAR_CONDITION);

/** Sets the title once the script exists (the downloaded folder is a slug of it). */
export async function setVideoTitle(db: Executor, videoId: string, title: string): Promise<void> {
  await db.update(videos).set({ title: title.trim() }).where(eq(videos.id, videoId));
}

/**
 * What the office is doing now. Written only while the video is still at that stage, so a late
 * write never lands on the next office. It never touches the stage.
 */
export async function setVideoProgress(
  db: Executor,
  videoId: string,
  progress: VideoProgress,
): Promise<void> {
  await db
    .update(videos)
    .set({ progress })
    .where(and(eq(videos.id, videoId), eq(videos.stage, progress.stage)));
}

/** Marks an AI attempt as not passing the office's checks. */
export async function setRunCheckProblems(
  db: Executor,
  runId: string,
  problems: string[],
): Promise<void> {
  await db
    .update(generationRuns)
    .set({ checkProblems: problems.slice(0, 20).map((p) => p.slice(0, 500)) })
    .where(eq(generationRuns.id, runId));
}

// ───────────── documents ─────────────

export type AddVideoDocumentInput = {
  videoId: string;
  kind: VideoDocumentKind;
  /** Already validated with the document's Zod schema (rule 4). */
  data: Record<string, unknown>;
  origin: "office" | "operator";
  schemaVersion?: number;
  generationRunId?: string | null;
};

/**
 * Saves a new version of a document (the highest is the current one). Locks the video row so two
 * jobs never take the same number; never overwrites an older version.
 */
export function addVideoDocument(
  db: Executor,
  input: AddVideoDocumentInput,
): Promise<VideoDocument> {
  return atomic(db, async (tx) => {
    const [locked] = await tx
      .select({ id: videos.id })
      .from(videos)
      .where(eq(videos.id, input.videoId))
      .for("update");
    if (!locked) throw new Error("Ese video no existe.");
    const [last] = await tx
      .select({ version: sql<number>`max(${videoDocuments.version})` })
      .from(videoDocuments)
      .where(and(eq(videoDocuments.videoId, input.videoId), eq(videoDocuments.kind, input.kind)));
    const [doc] = await tx
      .insert(videoDocuments)
      .values({
        videoId: input.videoId,
        kind: input.kind,
        version: Number(last?.version ?? 0) + 1,
        data: input.data,
        schemaVersion: input.schemaVersion ?? 1,
        origin: input.origin,
        generationRunId: input.generationRunId ?? null,
      })
      .returning();
    if (!doc) throw new Error("No se pudo guardar el documento.");
    return doc;
  });
}

/** The current (highest) version of a document, or null if its office has not left one. */
export async function getCurrentVideoDocument(
  db: Executor,
  videoId: string,
  kind: VideoDocumentKind,
): Promise<VideoDocument | null> {
  const [doc] = await db
    .select()
    .from(videoDocuments)
    .where(and(eq(videoDocuments.videoId, videoId), eq(videoDocuments.kind, kind)))
    .orderBy(desc(videoDocuments.version))
    .limit(1);
  return doc ?? null;
}

/** Every version of a document, oldest first (to compare after a rejection). */
export function listVideoDocumentVersions(
  db: Executor,
  videoId: string,
  kind: VideoDocumentKind,
): Promise<VideoDocument[]> {
  return db
    .select()
    .from(videoDocuments)
    .where(and(eq(videoDocuments.videoId, videoId), eq(videoDocuments.kind, kind)))
    .orderBy(asc(videoDocuments.version));
}

// ───────────── the script desk ─────────────

export type DeskOutcome = { ok: true } | { ok: false; reason: string };

const STALE = "El guion cambió desde que abriste la pantalla. Recargala y mirá la versión nueva.";

const STALE_VIDEO = "El video cambió desde que abriste la pantalla. Recargala y miralo de nuevo.";

/** Locks the video and checks the operator is looking at the current version of a document. */
async function lockDocument(
  tx: Executor,
  videoId: string,
  kind: "script" | "package",
  version: number,
): Promise<DeskOutcome> {
  await tx.select({ id: videos.id }).from(videos).where(eq(videos.id, videoId)).for("update");
  const current = await getCurrentVideoDocument(tx, videoId, kind);
  if (current?.version === version) return { ok: true };
  return { ok: false, reason: kind === "script" ? STALE : STALE_VIDEO };
}

/**
 * Saves the operator's edit of the script as a new version (the older ones stay). Only at
 * `script_review` and only over the version he was looking at. `data` is already validated.
 */
export function saveOperatorScript(
  db: Executor,
  videoId: string,
  baseVersion: number,
  data: Record<string, unknown>,
  title?: string,
): Promise<DeskOutcome> {
  return atomic(db, async (tx) => {
    const seen = await lockDocument(tx, videoId, "script", baseVersion);
    if (!seen.ok) return seen;
    const allowed = await transitionVideo(tx, videoId, "editScript");
    if (!allowed.ok) return allowed;
    await addVideoDocument(tx, { videoId, kind: "script", data, origin: "operator" });
    if (title) await setVideoTitle(tx, videoId, title);
    return { ok: true };
  });
}

/** Approves or returns the script the operator saw (never another version of it). */
export function decideScript(
  db: Executor,
  videoId: string,
  version: number,
  event: "approveScript" | "rejectScript",
  note?: string,
): Promise<DeskOutcome> {
  return atomic(db, async (tx) => {
    const seen = await lockDocument(tx, videoId, "script", version);
    if (!seen.ok) return seen;
    const outcome = await transitionVideo(tx, videoId, event, { note });
    return outcome.ok ? { ok: true } : outcome;
  });
}

// ───────────── the video desk ─────────────

/** Approves or returns the video the operator watched (its package version). */
export function decideVideo(
  db: Executor,
  videoId: string,
  packageVersion: number,
  event:
    | "approveVideo"
    | "returnToScriptDesk"
    | "rejectVideoToScript"
    | "rejectVideoToVoice"
    | "rejectVideoToRender",
  note?: string,
): Promise<DeskOutcome> {
  return atomic(db, async (tx) => {
    const seen = await lockDocument(tx, videoId, "package", packageVersion);
    if (!seen.ok) return seen;
    const outcome = await transitionVideo(tx, videoId, event, { note });
    return outcome.ok ? { ok: true } : outcome;
  });
}

// ───────────── usage ─────────────

export type RecordUsageInput = {
  videoId: string;
  kind: UsageKind;
  office?: WorkingStage | null;
  quantity: number;
  unit: string;
  durationMs?: number | null;
  data?: Record<string, unknown> | null;
};

export async function recordUsageEvent(db: Executor, input: RecordUsageInput): Promise<UsageEvent> {
  const [event] = await db
    .insert(usageEvents)
    .values({
      videoId: input.videoId,
      kind: input.kind,
      office: input.office ?? null,
      quantity: input.quantity,
      unit: input.unit,
      durationMs: input.durationMs ?? null,
      data: input.data ?? null,
    })
    .returning();
  if (!event) throw new Error("No se pudo registrar el uso.");
  return event;
}

export function listUsageEvents(db: Executor, videoId: string): Promise<UsageEvent[]> {
  return db
    .select()
    .from(usageEvents)
    .where(eq(usageEvents.videoId, videoId))
    .orderBy(asc(usageEvents.createdAt));
}

// ───────────── voices ─────────────

export function listVoices(db: Executor): Promise<Voice[]> {
  return db.select().from(voices).where(eq(voices.active, true)).orderBy(asc(voices.name));
}

export async function setVoicePreview(db: Executor, voiceId: string, url: string): Promise<void> {
  await db.update(voices).set({ previewUrl: url }).where(eq(voices.id, voiceId));
}

export async function getVoiceById(db: Executor, id: string): Promise<Voice | null> {
  const [voice] = await db.select().from(voices).where(eq(voices.id, id));
  return voice ?? null;
}

/** The voice a new video gets for its use and language, if one is marked as the default. */
export async function getDefaultVoice(
  db: Executor,
  use: Voice["use"] = "narrative",
  language = "es",
): Promise<Voice | null> {
  const [voice] = await db
    .select()
    .from(voices)
    .where(
      and(
        eq(voices.use, use),
        eq(voices.language, language),
        eq(voices.isDefault, true),
        eq(voices.active, true),
      ),
    );
  return voice ?? null;
}

/** Every attempt of the AI for a video (`generation_runs`), oldest first: the report of its offices. */
export function listVideoRuns(db: Executor, videoId: string): Promise<GenerationRun[]> {
  return db
    .select()
    .from(generationRuns)
    .where(eq(generationRuns.videoId, videoId))
    .orderBy(asc(generationRuns.createdAt));
}

// ───────────── the studio ─────────────

/** Videos waiting at one of the operator's two desks (the badge of the navigation). */
export async function countVideosWaiting(db: Executor): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(videos)
    .where(
      and(
        inArray(videos.stage, [...REVIEW_STAGES]),
        isNull(videos.pausedAt),
        isNull(videos.failure),
      ),
    );
  return row?.n ?? 0;
}

export type StudioUsage = {
  /** Claude's tokens for videos since `dayStart`. */
  inputTokens: number;
  outputTokens: number;
  renderSeconds: number;
  /** Characters sent to the voice since `monthStart`. */
  voiceCharacters: number;
  /** ElevenLabs' own count, as of the last take that could read it. */
  quota: { used: number; limit: number } | null;
};

export async function studioUsage(
  db: Executor,
  dayStart: Date,
  monthStart: Date,
): Promise<StudioUsage> {
  const [tokens] = await db
    .select({
      input: sql<number>`coalesce(sum(${generationRuns.inputTokens}), 0)::int`,
      output: sql<number>`coalesce(sum(${generationRuns.outputTokens}), 0)::int`,
    })
    .from(generationRuns)
    .where(and(isNotNull(generationRuns.videoId), gte(generationRuns.createdAt, dayStart)));
  const ideas = await videoIdeaTokens(db, dayStart);
  const sumOf = async (kind: UsageKind, since: Date) => {
    const [row] = await db
      .select({ total: sql<number>`coalesce(sum(${usageEvents.quantity}), 0)::int` })
      .from(usageEvents)
      .where(and(eq(usageEvents.kind, kind), gte(usageEvents.createdAt, since)));
    return row?.total ?? 0;
  };
  const [last] = await db
    .select({ data: usageEvents.data })
    .from(usageEvents)
    .where(and(eq(usageEvents.kind, "tts"), sql`${usageEvents.data} ? 'quota'`))
    .orderBy(desc(usageEvents.createdAt))
    .limit(1);
  const quota = last?.data?.quota as { used?: unknown; limit?: unknown } | undefined;
  return {
    inputTokens: (tokens?.input ?? 0) + ideas.input,
    outputTokens: (tokens?.output ?? 0) + ideas.output,
    renderSeconds: await sumOf("render", dayStart),
    voiceCharacters: await sumOf("tts", monthStart),
    quota:
      typeof quota?.used === "number" && typeof quota.limit === "number"
        ? { used: quota.used, limit: quota.limit }
        : null,
  };
}

// ───────────── an office from inside ─────────────

export type OfficeHistory = {
  /** AI attempts of the office's task (none for the offices of code). */
  runs: (GenerationRun & { title: string | null; topic: string })[];
  /** Runs of the office and the times work was sent back to it. */
  events: (UsageEvent & { title: string | null; topic: string })[];
};

export async function officeHistory(
  db: Executor,
  office: WorkingStage,
  task: GenerationRun["task"] | null,
  since: Date,
): Promise<OfficeHistory> {
  const of = { title: videos.title, topic: videos.topic };
  const runs = task
    ? await db
        .select({ run: generationRuns, ...of })
        .from(generationRuns)
        .innerJoin(videos, eq(videos.id, generationRuns.videoId))
        .where(and(eq(generationRuns.task, task), gte(generationRuns.createdAt, since)))
        .orderBy(desc(generationRuns.createdAt))
    : [];
  const events = await db
    .select({ event: usageEvents, ...of })
    .from(usageEvents)
    .innerJoin(videos, eq(videos.id, usageEvents.videoId))
    .where(and(eq(usageEvents.office, office), gte(usageEvents.createdAt, since)))
    .orderBy(desc(usageEvents.createdAt));
  return {
    runs: runs.map(({ run, title, topic }) => ({ ...run, title, topic })),
    events: events.map(({ event, title, topic }) => ({ ...event, title, topic })),
  };
}

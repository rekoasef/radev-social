import type { VideoFailure, VideoOfficeJob, VideoProgress } from "@radev/core";
import type { Video } from "@radev/db";
import { describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger";
import { type Office, OfficeFailure, type OfficeResult } from "./office";
import { MAX_LIMIT_ATTEMPTS, type OfficeRun, type RunnerDeps, runOffice } from "./runner";

const now = new Date("2026-11-25T12:00:00Z");
const quiet = createLogger({}, "error");

const video = (over: Partial<Video> = {}): Video => ({
  id: "v1",
  brandId: null,
  topic: "t",
  title: null,
  language: "es",
  voiceId: null,
  form: null,
  stage: "researching",
  progress: null,
  pausedAt: null,
  pauseReason: null,
  resumeAt: null,
  failure: null,
  rejectionNote: null,
  approvedAt: null,
  createdAt: now,
  updatedAt: now,
  ...over,
});

const done: OfficeResult = {
  kind: "done",
  documents: [{ kind: "dossier", data: {}, origin: "office" }],
};

function setup(
  opts: { video?: Video | null; office?: Office; lastTry?: boolean; next?: string } = {},
) {
  const calls = {
    queued: [] as { job: VideoOfficeJob; delay: number }[],
    failed: [] as VideoFailure[],
    paused: [] as Date[],
    budget: 0,
    resumed: 0,
    completed: 0,
    progress: [] as VideoProgress[],
    runs: [] as OfficeRun[],
  };
  let current = opts.video === undefined ? video() : opts.video;
  const deps: RunnerDeps = {
    store: {
      getVideo: async () => current,
      resume: async () => {
        calls.resumed++;
        if (current) current = { ...current, pausedAt: null, pauseReason: null, resumeAt: null };
      },
      pauseForBudget: async () => {
        calls.budget++;
      },
      pauseForLimit: async (_id, at) => {
        calls.paused.push(at);
      },
      complete: async () => {
        calls.completed++;
        return { ok: true, from: "researching", to: (opts.next ?? "checking_sources") as never };
      },
      progress: async (_id, p) => {
        calls.progress.push(p);
      },
      officeRun: async (_id, run) => {
        calls.runs.push(run);
      },
      fail: async (_id, f) => {
        calls.failed.push(f);
      },
    },
    queue: async (job, delay) => {
      calls.queued.push({ job, delay });
    },
    offices: opts.office ? { researching: opts.office } : {},
    makeContext: (v) => ({
      voice: async () => null,
      recentForms: async () => [],
      mediaDir: "/media/videos/v1",
      video: v,
      log: quiet,
      ai: { run: vi.fn(), reject: vi.fn() },
      document: async () => null,
      files: { write: async () => {}, read: async () => undefined },
    }),
    now: () => now,
    log: quiet,
    lastTry: opts.lastTry ?? false,
  };
  return { deps, calls };
}
const job: VideoOfficeJob = { videoId: "v1", stage: "researching", limitAttempt: 0 };

describe("runOffice: rule 8, a repeated or stale job does nothing", () => {
  it("skips a video that does not exist", async () => {
    const { deps, calls } = setup({ video: null, office: async () => done });
    expect(await runOffice(deps, job)).toBe("skipped");
    expect(calls.completed).toBe(0);
  });

  it("skips a job whose stage the video already left", async () => {
    const office = vi.fn(async () => done);
    const { deps } = setup({ video: video({ stage: "scripting" }), office });
    expect(await runOffice(deps, job)).toBe("skipped");
    expect(office).not.toHaveBeenCalled();
  });

  it("skips a paused video and a failed one", async () => {
    const office = vi.fn(async () => done);
    for (const v of [
      video({ pausedAt: now, pauseReason: "operator" }),
      video({
        failure: { stage: "researching", message: "x", retryable: true, at: now.toISOString() },
      }),
    ]) {
      expect(await runOffice(setup({ video: v, office }).deps, job)).toBe("skipped");
    }
    expect(office).not.toHaveBeenCalled();
  });

  it("waits when the stage has no office yet", async () => {
    expect(await runOffice(setup().deps, job)).toBe("no-office");
  });
});

describe("runOffice: the happy path", () => {
  it("saves the documents, advances and queues the next office", async () => {
    const { deps, calls } = setup({ office: async () => done });
    expect(await runOffice(deps, job)).toBe("completed");
    expect(calls.completed).toBe(1);
    expect(calls.queued).toEqual([
      { job: { videoId: "v1", stage: "checking_sources", limitAttempt: 0 }, delay: 0 },
    ]);
  });

  it("does not queue anything after the first desk (the operator's turn)", async () => {
    const { deps, calls } = setup({ office: async () => done, next: "script_review" });
    await runOffice(deps, job);
    expect(calls.queued).toEqual([]);
  });

  it("does nothing more when the video was discarded while the office worked", async () => {
    const { deps, calls } = setup({ office: async () => done });
    deps.store.complete = async () => ({ ok: false, reason: "descartado" });
    expect(await runOffice(deps, job)).toBe("skipped");
    expect(calls.queued).toEqual([]);
  });
});

describe("runOffice: Claude's limit", () => {
  const limited: Office = async () => ({ kind: "rate_limited", retryAfterMs: null });

  it("pauses the video and queues the same job for later, without failing", async () => {
    const { deps, calls } = setup({ office: limited });
    expect(await runOffice(deps, job)).toBe("paused");
    expect(calls.paused).toEqual([new Date(now.getTime() + 15 * 60_000)]);
    expect(calls.queued).toEqual([{ job: { ...job, limitAttempt: 1 }, delay: 15 * 60 }]);
    expect(calls.failed).toEqual([]);
  });

  it("backs off longer each time and respects the time the provider gives", async () => {
    const third = setup({ office: limited });
    await runOffice(third.deps, { ...job, limitAttempt: 2 });
    expect(third.calls.queued[0]?.delay).toBe(60 * 60);
    const told = setup({
      office: async () => ({ kind: "rate_limited", retryAfterMs: 5 * 3600_000 }),
    });
    await runOffice(told.deps, job);
    expect(told.calls.queued[0]?.delay).toBe(5 * 3600);
  });

  it("gives up after the maximum number of reschedules", async () => {
    const { deps, calls } = setup({ office: limited });
    expect(await runOffice(deps, { ...job, limitAttempt: MAX_LIMIT_ATTEMPTS })).toBe("failed");
    expect(calls.failed[0]).toMatchObject({ retryable: true });
    expect(calls.queued).toEqual([]);
  });

  it("lifts a limit pause that already ended and runs the office", async () => {
    const office = vi.fn(async () => done);
    const paused = video({
      pausedAt: new Date(now.getTime() - 3600_000),
      pauseReason: "provider_limit",
      resumeAt: new Date(now.getTime() - 60_000),
    });
    const { deps, calls } = setup({ video: paused, office });
    expect(await runOffice(deps, job)).toBe("completed");
    expect(calls.resumed).toBe(1);
    expect(office).toHaveBeenCalledOnce();
  });

  it("does not run before the limit pause ends", async () => {
    const office = vi.fn(async () => done);
    const paused = video({
      pausedAt: now,
      pauseReason: "provider_limit",
      resumeAt: new Date(now.getTime() + 600_000),
    });
    expect(await runOffice(setup({ video: paused, office }).deps, job)).toBe("skipped");
    expect(office).not.toHaveBeenCalled();
  });
});

describe("runOffice: no credits left", () => {
  it("pauses the video for the operator, queues nothing and does not fail", async () => {
    const { deps, calls } = setup({
      office: async () => ({ kind: "pause", reason: "budget", message: "sin créditos" }),
    });
    expect(await runOffice(deps, job)).toBe("paused");
    expect(calls.budget).toBe(1);
    expect(calls.queued).toEqual([]);
    expect(calls.failed).toEqual([]);
  });
});

describe("runOffice: failures", () => {
  it("rethrows an error so pg-boss retries, and records nothing before the last try", async () => {
    const { deps, calls } = setup({
      office: async () => {
        throw new Error("red caída");
      },
    });
    await expect(runOffice(deps, job)).rejects.toThrow("red caída");
    expect(calls.failed).toEqual([]);
  });

  it("records the failure on the last try, still retryable by the operator", async () => {
    const { deps, calls } = setup({
      lastTry: true,
      office: async () => {
        throw new Error("red caída");
      },
    });
    await expect(runOffice(deps, job)).rejects.toThrow();
    expect(calls.failed).toEqual([
      { stage: "researching", message: "red caída", retryable: true, at: now },
    ]);
  });

  it("an office failure that retrying cannot fix is recorded at once, without retries", async () => {
    const { deps, calls } = setup({
      office: async () => {
        throw new OfficeFailure("no hay ruta de IA", false);
      },
    });
    expect(await runOffice(deps, job)).toBe("failed");
    expect(calls.failed[0]).toMatchObject({ retryable: false, message: "no hay ruta de IA" });
  });
});

describe("runOffice: what the studio sees", () => {
  it("saves when the office started, what it reports, and its run", async () => {
    const { deps, calls } = setup({
      office: async (ctx) => {
        await ctx.progress({ attempt: 2, attempts: 3 });
        return done;
      },
    });
    await runOffice(deps, job);
    expect(calls.progress).toEqual([
      { stage: "researching", startedAt: now.toISOString() },
      { stage: "researching", startedAt: now.toISOString(), attempt: 2, attempts: 3 },
    ]);
    expect(calls.runs).toEqual([{ stage: "researching", durationMs: 0, outcome: "done" }]);
  });

  it("records a failed run too", async () => {
    const { deps, calls } = setup({
      office: async () => {
        throw new Error("sin red");
      },
    });
    await expect(runOffice(deps, job)).rejects.toThrow("sin red");
    expect(calls.runs).toEqual([{ stage: "researching", durationMs: 0, outcome: "failed" }]);
  });

  it("a progress that cannot be saved does not stop the office", async () => {
    const { deps, calls } = setup({ office: async () => done });
    deps.store.progress = async () => {
      throw new Error("base caída");
    };
    expect(await runOffice(deps, job)).toBe("completed");
    expect(calls.completed).toBe(1);
  });
});

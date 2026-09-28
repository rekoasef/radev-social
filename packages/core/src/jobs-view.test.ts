import { describe, expect, it } from "vitest";
import { JOBS } from "./jobs";
import {
  canRetryJob,
  isJobName,
  isJobViewTab,
  JOB_ERROR_MAX,
  JOB_LABELS,
  JOB_NAMES,
  jobError,
  jobTarget,
} from "./jobs-view";

describe("job names", () => {
  it("labels every job", () => {
    for (const name of JOB_NAMES) expect(JOB_LABELS[name]).toBeTruthy();
    expect(isJobName("carousel.render")).toBe(true);
    expect(isJobName("__pgboss__send-it")).toBe(false);
    expect(isJobViewTab("failed")).toBe(true);
    expect(isJobViewTab("toString")).toBe(false);
  });
});

describe("jobTarget", () => {
  it("reads what each job works on from its payload", () => {
    expect(jobTarget(JOBS.carouselGenerate, { postId: "p", attempt: 0 })).toEqual({
      kind: "post",
      postId: "p",
    });
    expect(jobTarget(JOBS.postPublish, { postId: "p", scheduledAt: "x" })).toEqual({
      kind: "post",
      postId: "p",
    });
    expect(jobTarget(JOBS.carouselRender, { versionId: "v" })).toEqual({
      kind: "version",
      versionId: "v",
    });
    expect(jobTarget(JOBS.ideasResearch, { requestId: "r" })).toEqual({
      kind: "ideaRequest",
      requestId: "r",
    });
    expect(jobTarget(JOBS.notifySend, { notificationId: "n" })).toEqual({
      kind: "notification",
      notificationId: "n",
    });
    expect(jobTarget(JOBS.dataRefresh, { source: "bluelytics" })).toEqual({
      kind: "source",
      source: "bluelytics",
    });
  });

  it("gives none for cron jobs and broken payloads", () => {
    expect(jobTarget(JOBS.slotsFill, {})).toEqual({ kind: "none" });
    expect(jobTarget(JOBS.carouselRender, null)).toEqual({ kind: "none" });
    expect(jobTarget(JOBS.carouselRender, { versionId: 3 })).toEqual({ kind: "none" });
    expect(jobTarget("other", { postId: "p" })).toEqual({ kind: "none" });
  });
});

describe("jobError", () => {
  it("keeps only the message of a serialized error", () => {
    expect(
      jobError({ name: "Error", message: "Bad Gateway", stack: "Error: Bad Gateway\n    at x" }),
    ).toBe("Bad Gateway");
    expect(jobError({ value: { message: "job timed out" } })).toBe("job timed out");
    expect(jobError({ value: "expired" })).toBe("expired");
    expect(jobError("  two\n  lines ")).toBe("two lines");
  });

  it("gives null when there is no message, and cuts long ones", () => {
    expect(jobError(null)).toBeNull();
    expect(jobError({})).toBeNull();
    const long = jobError({ message: "x".repeat(1000) });
    expect(long).toHaveLength(JOB_ERROR_MAX);
    expect(long?.endsWith("…")).toBe(true);
  });
});

describe("canRetryJob", () => {
  it("only retries failed jobs", () => {
    expect(canRetryJob(JOBS.notifySend, "failed").ok).toBe(true);
    for (const state of ["created", "retry", "active", "completed", "cancelled"])
      expect(canRetryJob(JOBS.notifySend, state).ok).toBe(false);
  });

  it("retries jobs that stand on their own", () => {
    for (const name of [JOBS.notifySend, JOBS.dataRefresh, JOBS.slotsFill, JOBS.reviewNotify])
      expect(canRetryJob(name, "failed")).toEqual({ ok: true });
  });

  it("retries a post's job only while the post still waits for it", () => {
    const post = (status: "generating" | "rendering" | "failed" | "scheduled" | "approved") => ({
      post: { status, currentVersionId: "v2" },
    });
    expect(canRetryJob(JOBS.carouselGenerate, "failed", post("generating")).ok).toBe(true);
    expect(canRetryJob(JOBS.carouselGenerate, "failed", post("failed"))).toMatchObject({
      ok: false,
      open: "post",
    });
    expect(
      canRetryJob(JOBS.carouselRender, "failed", { ...post("rendering"), versionId: "v2" }).ok,
    ).toBe(true);
    // An older version's render: the post moved on.
    expect(
      canRetryJob(JOBS.carouselRender, "failed", { ...post("rendering"), versionId: "v1" }).ok,
    ).toBe(false);
    expect(canRetryJob(JOBS.postPublish, "failed", post("scheduled")).ok).toBe(true);
    expect(canRetryJob(JOBS.postPublish, "failed", post("approved")).ok).toBe(false);
    expect(canRetryJob(JOBS.postPublish, "failed", { post: null }).ok).toBe(false);
  });

  it("retries an idea request's job only while the request is open", () => {
    expect(
      canRetryJob(JOBS.ideasGenerate, "failed", { ideaRequest: { status: "running" } }).ok,
    ).toBe(true);
    expect(
      canRetryJob(JOBS.ideasResearch, "failed", { ideaRequest: { status: "failed" } }),
    ).toMatchObject({ ok: false, open: "ideas" });
  });
});

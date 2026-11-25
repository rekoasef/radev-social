import { describe, expect, it } from "vitest";
import {
  CLEAR_CONDITION,
  canAdvance,
  canRunOffice,
  checkRejectionNote,
  failVideo,
  pauseEnded,
  pauseVideo,
  resumeVideo,
  retryVideo,
  type VideoFailure,
  videoDisplayStatus,
} from "./condition";
import { VIDEO_STAGES, WORKING_STAGES } from "./constants";

const now = new Date("2026-11-25T12:00:00Z");
const later = new Date("2026-11-25T17:00:00Z");
const failure = (retryable: boolean): VideoFailure => ({
  stage: "scripting",
  message: "el guion no pasó los controles",
  retryable,
  at: now,
});

describe("pause and resume", () => {
  it("a paused video does not run its office or advance", () => {
    const paused = pauseVideo(CLEAR_CONDITION, "operator", now);
    expect(canRunOffice("scripting", paused, later)).toBe(false);
    expect(canAdvance(paused, "officeDone", later)).toEqual({
      ok: false,
      reason: "El video está pausado: reanudalo antes de seguir.",
    });
  });

  it("a paused video can still be discarded", () => {
    expect(canAdvance(pauseVideo(CLEAR_CONDITION, "operator", now), "archive", now).ok).toBe(true);
  });

  it("a limit pause ends by itself at resumeAt, an operator pause never does", () => {
    const limit = pauseVideo(CLEAR_CONDITION, "provider_limit", now, later);
    expect(pauseEnded(limit, now)).toBe(false);
    expect(pauseEnded(limit, later)).toBe(true);
    expect(canRunOffice("scripting", limit, later)).toBe(true);
    const manual = pauseVideo(CLEAR_CONDITION, "operator", now);
    expect(pauseEnded(manual, new Date("2027-01-01T00:00:00Z"))).toBe(false);
  });

  it("a budget pause needs the operator", () => {
    const budget = pauseVideo(CLEAR_CONDITION, "budget", now);
    expect(videoDisplayStatus("voicing", budget, later).kind).toBe("needs_attention");
  });

  it("resume clears the pause and keeps a failure", () => {
    const both = pauseVideo(failVideo(CLEAR_CONDITION, failure(true)), "operator", now);
    const resumed = resumeVideo(both);
    expect(resumed.pausedAt).toBeNull();
    expect(resumed.pauseReason).toBeNull();
    expect(resumed.failure).not.toBeNull();
  });
});

describe("failure", () => {
  it("a failure does not touch the stage, only blocks the office until retried", () => {
    const failed = failVideo(CLEAR_CONDITION, failure(true));
    expect(canRunOffice("scripting", failed, now)).toBe(false);
    expect(canRunOffice("scripting", retryVideo(failed), now)).toBe(true);
  });

  it("a retryable failure shows as failed; one that is not asks for the operator", () => {
    expect(
      videoDisplayStatus("scripting", failVideo(CLEAR_CONDITION, failure(true)), now).kind,
    ).toBe("failed");
    expect(
      videoDisplayStatus("scripting", failVideo(CLEAR_CONDITION, failure(false)), now).kind,
    ).toBe("needs_attention");
  });
});

describe("canRunOffice", () => {
  it("only the working stages run an office", () => {
    for (const stage of VIDEO_STAGES) {
      expect(canRunOffice(stage, CLEAR_CONDITION, now), stage).toBe(
        (WORKING_STAGES as readonly string[]).includes(stage),
      );
    }
  });
});

describe("videoDisplayStatus", () => {
  it("shows the desks as waiting for the operator", () => {
    for (const stage of ["script_review", "in_review"] as const) {
      expect(videoDisplayStatus(stage, CLEAR_CONDITION, now).kind).toBe("waiting_review");
    }
  });

  it("shows an office at work as in production", () => {
    expect(videoDisplayStatus("voicing", CLEAR_CONDITION, now)).toMatchObject({
      kind: "working",
      label: "En producción",
    });
  });

  it("shows the end stages", () => {
    expect(videoDisplayStatus("approved", CLEAR_CONDITION, now).kind).toBe("approved");
    expect(videoDisplayStatus("archived", CLEAR_CONDITION, now).kind).toBe("archived");
  });

  it("a limit pause shows as paused and says it continues by itself", () => {
    const s = videoDisplayStatus(
      "scripting",
      pauseVideo(CLEAR_CONDITION, "provider_limit", now, later),
      now,
    );
    expect(s.kind).toBe("paused");
    expect(s.detail).toContain("sigue solo");
  });

  it("a limit pause that ended shows the video as working again", () => {
    const s = videoDisplayStatus(
      "scripting",
      pauseVideo(CLEAR_CONDITION, "provider_limit", now, later),
      later,
    );
    expect(s.kind).toBe("working");
  });
});

describe("checkRejectionNote", () => {
  it("trims the note", () => {
    expect(checkRejectionNote("  la foto del baúl no es de 1911  ")).toEqual({
      ok: true,
      note: "la foto del baúl no es de 1911",
    });
  });

  it("refuses an empty or too short note", () => {
    expect(checkRejectionNote("").ok).toBe(false);
    expect(checkRejectionNote(null).ok).toBe(false);
    expect(checkRejectionNote("no").ok).toBe(false);
  });

  it("refuses a very long note", () => {
    expect(checkRejectionNote("x".repeat(501)).ok).toBe(false);
  });
});

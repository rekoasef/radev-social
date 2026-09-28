import { describe, expect, it } from "vitest";
import { POST_STATUSES, type PostStatus } from "./constants";
import {
  availableEvents,
  canDiscard,
  DISCARDABLE_STATUSES,
  INITIAL_STATUSES,
  nextStatus,
  POST_EVENTS,
  type PostEvent,
  TRANSITIONS,
} from "./state-machine";

/** Every status reachable from `start`, optionally never stepping on `avoid`. */
function reachable(start: PostStatus, avoid?: PostStatus): Set<PostStatus> {
  const seen = new Set<PostStatus>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const from = queue.shift() as PostStatus;
    for (const event of POST_EVENTS) {
      const result = nextStatus(from, event);
      if (!result.ok || result.to === avoid || seen.has(result.to)) continue;
      seen.add(result.to);
      queue.push(result.to);
    }
  }
  return seen;
}

describe("post state machine: invariants (docs/ARCHITECTURE.md §5)", () => {
  it("never reaches scheduled, publishing or published without going through approved", () => {
    for (const start of Object.values(INITIAL_STATUSES)) {
      const withoutApproval = reachable(start, "approved");
      expect(withoutApproval.has("scheduled"), start).toBe(false);
      expect(withoutApproval.has("publishing"), start).toBe(false);
      expect(withoutApproval.has("published"), start).toBe(false);
    }
  });

  it("can still reach published through approval", () => {
    expect(reachable(INITIAL_STATUSES.manual).has("published")).toBe(true);
    expect(reachable(INITIAL_STATUSES.ai).has("published")).toBe(true);
  });

  it("sends an edited approved or scheduled post back to render and review", () => {
    for (const from of ["approved", "scheduled"] as const) {
      const result = nextStatus(from, "edit");
      expect(result).toMatchObject({ ok: true, to: "rendering" });
      expect(nextStatus("rendering", "renderDone")).toMatchObject({ ok: true, to: "in_review" });
    }
  });

  it("cancels the publish job when a scheduled post is unscheduled, edited or archived", () => {
    for (const event of ["unschedule", "edit", "archive"] as const) {
      expect(nextStatus("scheduled", event)).toMatchObject({
        ok: true,
        effects: ["cancel_publish_job"],
      });
    }
    // Nothing to cancel when the post was not scheduled.
    expect(nextStatus("approved", "edit")).toMatchObject({ ok: true, effects: [] });
  });

  it("does not touch what is being published or already is", () => {
    for (const from of ["publishing", "published"] as const) {
      expect(nextStatus(from, "edit").ok).toBe(false);
      expect(nextStatus(from, "archive").ok).toBe(false);
    }
  });
});

describe("post state machine: transitions", () => {
  it("rejects events from the wrong status, with a message for the operator", () => {
    expect(nextStatus("rendering", "approve")).toEqual({
      ok: false,
      reason: "No se puede aprobar un post renderizándose.",
    });
  });

  it("publishes an approved post by hand: approved → publishing → published", () => {
    expect(nextStatus("approved", "startPublishing")).toMatchObject({ ok: true, to: "publishing" });
    expect(nextStatus("publishing", "publishDone")).toMatchObject({ ok: true, to: "published" });
  });

  it("regenerates with AI: after a rejection, or when the render QA fails", () => {
    expect(nextStatus("in_review", "reject")).toMatchObject({ ok: true, to: "rejected" });
    expect(nextStatus("rejected", "regenerate")).toMatchObject({ ok: true, to: "generating" });
    expect(nextStatus("rendering", "qaRegenerate")).toMatchObject({ ok: true, to: "generating" });
    expect(nextStatus("in_review", "qaRegenerate").ok).toBe(false);
  });

  it("only leaves archived and published through nothing (they are final)", () => {
    expect(availableEvents("archived")).toEqual([]);
    expect(availableEvents("published")).toEqual([]);
  });

  it("every status is reachable and every event leads to a known status", () => {
    const all = new Set([...reachable("rendering"), ...reachable("generating")]);
    expect([...all].sort()).toEqual([...POST_STATUSES].sort());
    for (const event of POST_EVENTS as PostEvent[]) {
      expect(POST_STATUSES).toContain(TRANSITIONS[event].to);
    }
  });
});

describe("post state machine: discarding from the panel", () => {
  it("offers it for approved and scheduled posts, and a scheduled one cancels its publish job", () => {
    expect(canDiscard("approved")).toBe(true);
    expect(canDiscard("scheduled")).toBe(true);
    expect(nextStatus("scheduled", "archive")).toEqual({
      ok: true,
      to: "archived",
      effects: ["cancel_publish_job"],
    });
    expect(nextStatus("approved", "archive")).toEqual({ ok: true, to: "archived", effects: [] });
  });

  it("waits while a job works on the post, and never touches published or publishing ones", () => {
    for (const status of [
      "generating",
      "rendering",
      "publishing",
      "published",
      "archived",
    ] as const) {
      expect(canDiscard(status)).toBe(false);
    }
  });

  it("only offers statuses the state machine accepts", () => {
    for (const status of DISCARDABLE_STATUSES) {
      expect(nextStatus(status, "archive").ok).toBe(true);
    }
  });

  it("has no way back: a discarded post stays discarded", () => {
    expect(availableEvents("archived")).toEqual([]);
  });
});

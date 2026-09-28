import { describe, expect, it } from "vitest";
import { type ApprovalInput, canApprove, sortReviewQueue } from "./review";

const ready: ApprovalInput = {
  status: "in_review",
  currentVersionId: "v2",
  reviewedVersionId: "v2",
  slideCount: 3,
  renderedSlides: [0, 1, 2],
};

describe("canApprove", () => {
  it("approves the current version when every slide has its PNG", () => {
    expect(canApprove(ready)).toEqual({ ok: true });
  });

  it("only approves posts in review", () => {
    for (const status of ["rendering", "failed", "approved", "published"] as const) {
      expect(canApprove({ ...ready, status }).ok).toBe(false);
    }
  });

  it("refuses a version that is no longer the current one", () => {
    const result = canApprove({ ...ready, reviewedVersionId: "v1" });
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining("cambió") });
  });

  it("refuses when a slide has no PNG", () => {
    const result = canApprove({ ...ready, renderedSlides: [0, 2] });
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining("slide 2") });
  });

  it("ignores extra PNGs but refuses a version without slides", () => {
    expect(canApprove({ ...ready, renderedSlides: [0, 1, 2, 3] }).ok).toBe(true);
    expect(canApprove({ ...ready, slideCount: 0, renderedSlides: [] }).ok).toBe(false);
  });
});

describe("sortReviewQueue", () => {
  const at = (iso: string) => new Date(iso);
  const item = (code: string, scheduledAt: string | null, updatedAt: string, number = 1) => ({
    code,
    scheduledAt: scheduledAt ? at(scheduledAt) : null,
    updatedAt: at(updatedAt),
    number,
  });

  it("puts the closest planned time first, then the unplanned ones oldest first", () => {
    const queue = sortReviewQueue([
      item("free-new", null, "2026-09-28T10:00:00Z"),
      item("thu", "2026-10-01T22:00:00Z", "2026-09-28T09:00:00Z"),
      item("free-old", null, "2026-09-27T10:00:00Z"),
      item("tue", "2026-09-29T22:00:00Z", "2026-09-28T11:00:00Z"),
      item("missed", "2026-09-27T22:00:00Z", "2026-09-28T12:00:00Z"),
    ]);
    expect(queue.map((i) => i.code)).toEqual(["missed", "tue", "thu", "free-old", "free-new"]);
  });

  it("breaks ties by post number and does not touch the input", () => {
    const input = [
      item("b", null, "2026-09-28T10:00:00Z", 2),
      item("a", null, "2026-09-28T10:00:00Z", 1),
    ];
    expect(sortReviewQueue(input).map((i) => i.code)).toEqual(["a", "b"]);
    expect(input.map((i) => i.code)).toEqual(["b", "a"]);
  });
});

import { describe, expect, it } from "vitest";
import { type ApprovalInput, canApprove } from "./review";

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

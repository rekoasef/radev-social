import { describe, expect, it } from "vitest";
import { MAX_QA_REGENERATIONS, renderOutcome } from "./regeneration";

describe("renderOutcome", () => {
  it("sends a clean render to review, whoever wrote it", () => {
    for (const origin of ["ai", "manual"] as const) {
      expect(renderOutcome({ origin, issueKinds: [], qaRegenerations: 0 })).toBe("done");
    }
  });

  it("regenerates an AI version with QA problems, up to the maximum", () => {
    for (let n = 0; n < MAX_QA_REGENERATIONS; n++) {
      expect(renderOutcome({ origin: "ai", issueKinds: ["overflow"], qaRegenerations: n })).toBe(
        "regenerate",
      );
    }
  });

  it("then lets it reach review with the problems marked", () => {
    expect(
      renderOutcome({
        origin: "ai",
        issueKinds: ["safe-area", "tiktok"],
        qaRegenerations: MAX_QA_REGENERATIONS,
      }),
    ).toBe("done");
  });

  it("fails a version from the editor with QA problems (the editor shows them)", () => {
    expect(renderOutcome({ origin: "manual", issueKinds: ["overflow"], qaRegenerations: 0 })).toBe(
      "failed",
    );
  });

  it("fails when the render itself broke, even for an AI version", () => {
    expect(
      renderOutcome({ origin: "ai", issueKinds: ["overflow", "error"], qaRegenerations: 0 }),
    ).toBe("failed");
  });
});

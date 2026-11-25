import { describe, expect, it } from "vitest";
import {
  INITIAL_STAGE,
  OFFICE_DOCUMENT,
  VIDEO_STAGES,
  type VideoStage,
  WORKING_STAGES,
} from "./constants";
import {
  availableVideoEvents,
  DISCARDABLE_STAGES,
  needsNote,
  nextStage,
  OFFICE_NEXT,
  stageLabel,
  VIDEO_EVENTS,
  VIDEO_TRANSITIONS,
  type VideoEvent,
} from "./state-machine";

/** Every stage reachable from `start`, never taking the events in `avoid`. */
function reachable(start: VideoStage, avoid: readonly VideoEvent[] = []): Set<VideoStage> {
  const seen = new Set<VideoStage>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const from = queue.shift() as VideoStage;
    for (const event of VIDEO_EVENTS) {
      if (avoid.includes(event)) continue;
      const result = nextStage(from, event);
      if (!result.ok || seen.has(result.to)) continue;
      seen.add(result.to);
      queue.push(result.to);
    }
  }
  return seen;
}

describe("video state machine: the assembly line", () => {
  it("runs the offices in order up to the first desk", () => {
    const path: VideoStage[] = [INITIAL_STAGE];
    let stage: VideoStage = INITIAL_STAGE;
    while (stage !== "script_review") {
      const r = nextStage(stage, "officeDone");
      if (!r.ok) throw new Error(r.reason);
      stage = r.to;
      path.push(stage);
    }
    expect(path).toEqual([
      "researching",
      "checking_sources",
      "finding_images",
      "scripting",
      "checking_facts",
      "script_review",
    ]);
  });

  it("runs voice, render and packaging after the script is approved, up to the second desk", () => {
    expect(nextStage("script_review", "approveScript")).toEqual({ ok: true, to: "voicing" });
    expect(nextStage("voicing", "officeDone")).toEqual({ ok: true, to: "rendering" });
    expect(nextStage("rendering", "officeDone")).toEqual({ ok: true, to: "packaging" });
    expect(nextStage("packaging", "officeDone")).toEqual({ ok: true, to: "in_review" });
    expect(nextStage("in_review", "approveVideo")).toEqual({ ok: true, to: "approved" });
  });

  it("every working stage has a next stage and leaves a document", () => {
    for (const stage of WORKING_STAGES) {
      expect(OFFICE_NEXT[stage], stage).toBeDefined();
      expect(OFFICE_DOCUMENT[stage], stage).toBeDefined();
    }
  });

  it("officeDone is refused at a desk, once approved and once archived", () => {
    for (const stage of ["script_review", "in_review", "approved", "archived"] as const) {
      expect(nextStage(stage, "officeDone").ok, stage).toBe(false);
    }
  });

  it("every stage has a Spanish label", () => {
    for (const stage of VIDEO_STAGES) expect(stageLabel(stage)).not.toBe("");
  });
});

describe("video state machine: invariants (REVISION §7.2)", () => {
  it("never reaches the voice, the render or the approval without approving the script", () => {
    const without = reachable(INITIAL_STAGE, ["approveScript"]);
    for (const stage of ["voicing", "rendering", "packaging", "in_review", "approved"] as const) {
      expect(without.has(stage), stage).toBe(false);
    }
  });

  it("never reaches approved without the video going through its own approval", () => {
    const without = reachable(INITIAL_STAGE, ["approveVideo"]);
    expect(without.has("approved")).toBe(false);
  });

  it("can still reach approved by approving both desks", () => {
    expect(reachable(INITIAL_STAGE).has("approved")).toBe(true);
  });

  it("rejecting the script goes back to Script, not to Research or Images", () => {
    expect(nextStage("script_review", "rejectScript")).toEqual({ ok: true, to: "scripting" });
  });

  it("rejecting the video has three targets and none repeats the research or the images", () => {
    expect(nextStage("in_review", "rejectVideoToScript")).toEqual({ ok: true, to: "scripting" });
    expect(nextStage("in_review", "rejectVideoToVoice")).toEqual({ ok: true, to: "voicing" });
    expect(nextStage("in_review", "rejectVideoToRender")).toEqual({ ok: true, to: "rendering" });
    for (const event of VIDEO_EVENTS.filter((e) => e.startsWith("reject"))) {
      const r = nextStage(event === "rejectScript" ? "script_review" : "in_review", event);
      expect(r.ok && ["researching", "checking_sources", "finding_images"].includes(r.to)).toBe(
        false,
      );
    }
  });

  it("every rejection needs a note and nothing else does", () => {
    const withNote = VIDEO_EVENTS.filter(needsNote).sort();
    expect(withNote).toEqual(
      ["rejectScript", "rejectVideoToRender", "rejectVideoToScript", "rejectVideoToVoice"].sort(),
    );
  });

  it("editing the script is only possible at the first desk and keeps the stage", () => {
    expect(nextStage("script_review", "editScript")).toEqual({ ok: true, to: "script_review" });
    for (const stage of VIDEO_STAGES.filter((s) => s !== "script_review")) {
      expect(nextStage(stage, "editScript").ok, stage).toBe(false);
    }
  });

  it("an approved video can be reopened (any edit invalidates the approval)", () => {
    expect(nextStage("approved", "reopen")).toEqual({ ok: true, to: "in_review" });
    expect(nextStage("in_review", "reopen").ok).toBe(false);
  });

  it("archived is final", () => {
    for (const event of VIDEO_EVENTS) expect(nextStage("archived", event).ok, event).toBe(false);
    expect(DISCARDABLE_STAGES).not.toContain("archived");
  });

  it("any other stage can be discarded", () => {
    for (const stage of VIDEO_STAGES.filter((s) => s !== "archived")) {
      expect(nextStage(stage, "archive"), stage).toEqual({ ok: true, to: "archived" });
    }
  });

  it("explains in Spanish why an event cannot happen", () => {
    const r = nextStage("researching", "approveVideo");
    expect(r).toEqual({
      ok: false,
      reason: "No se puede aprobar el video un video en investigación.",
    });
  });

  it("every stage is reachable from the start (no dead stage)", () => {
    expect([...reachable(INITIAL_STAGE)].sort()).toEqual([...VIDEO_STAGES].sort());
  });

  it("every transition leads to a known stage", () => {
    for (const t of Object.values(VIDEO_TRANSITIONS)) {
      if (t.to !== null) expect(VIDEO_STAGES).toContain(t.to);
    }
  });
});

describe("availableVideoEvents (the panel's buttons)", () => {
  it("offers approve, reject, edit and discard at the first desk", () => {
    expect(availableVideoEvents("script_review").sort()).toEqual(
      ["approveScript", "archive", "editScript", "rejectScript"].sort(),
    );
  });

  it("offers the three rejections, the approval and discard at the second desk", () => {
    expect(availableVideoEvents("in_review").sort()).toEqual(
      [
        "approveVideo",
        "archive",
        "rejectVideoToRender",
        "rejectVideoToScript",
        "rejectVideoToVoice",
      ].sort(),
    );
  });

  it("offers only discard while an office works (officeDone is the worker's)", () => {
    expect(availableVideoEvents("voicing")).toEqual(["archive"]);
  });

  it("offers nothing once archived", () => {
    expect(availableVideoEvents("archived")).toEqual([]);
  });
});

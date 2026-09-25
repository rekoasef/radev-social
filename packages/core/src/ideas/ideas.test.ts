import { describe, expect, it } from "vitest";
import {
  IDEA_ANGLE_MAX,
  IDEA_EVENTS,
  IDEA_STATUSES,
  IDEA_TITLE_MAX,
  ideaPrompt,
  nextIdeaStatus,
} from "./ideas";

describe("nextIdeaStatus", () => {
  it.each([
    ["new", "use", "used"],
    ["new", "discard", "discarded"],
    ["discarded", "restore", "new"],
  ] as const)("%s + %s → %s", (status, event, next) => {
    expect(nextIdeaStatus(status, event)).toBe(next);
  });

  it("rejects every other combination", () => {
    const allowed = new Set(["new:use", "new:discard", "discarded:restore"]);
    for (const status of IDEA_STATUSES) {
      for (const event of IDEA_EVENTS) {
        if (allowed.has(`${status}:${event}`)) continue;
        expect(nextIdeaStatus(status, event), `${status} + ${event}`).toBeNull();
      }
    }
  });

  it("a used idea is never used again nor discarded", () => {
    expect(nextIdeaStatus("used", "use")).toBeNull();
    expect(nextIdeaStatus("used", "discard")).toBeNull();
  });

  it("a discarded idea has to come back before it is used", () => {
    expect(nextIdeaStatus("discarded", "use")).toBeNull();
  });
});

describe("ideaPrompt", () => {
  it("is the title alone when there is no angle", () => {
    expect(ideaPrompt({ title: "  Cuánto cuesta una web  ", angle: " " })).toBe(
      "Cuánto cuesta una web",
    );
  });

  it("puts the angle below the title", () => {
    expect(ideaPrompt({ title: "Cuánto cuesta una web", angle: "Desde el dueño" })).toBe(
      "Cuánto cuesta una web\n\nDesde el dueño",
    );
  });

  it("the longest idea still fits the generation request (600 characters)", () => {
    const prompt = ideaPrompt({
      title: "t".repeat(IDEA_TITLE_MAX),
      angle: "a".repeat(IDEA_ANGLE_MAX),
    });
    expect(prompt.length).toBeLessThanOrEqual(600);
  });
});

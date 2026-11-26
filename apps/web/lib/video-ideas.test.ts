import { describe, expect, it } from "vitest";
import { ideaBoard } from "./video-ideas";

const idea = { topic: "El submarino que no disparó en 1962", hook: "Gancho.", sources: [] };
const row = (
  id: string,
  mode: "generate" | "research",
  status: "queued" | "running" | "succeeded" | "failed",
  minute: number,
) => ({
  id,
  mode,
  status,
  error: status === "failed" ? "Límite." : null,
  ideas: status === "succeeded" ? [idea] : [],
  createdAt: new Date(2026, 10, 26, 10, minute),
});

describe("ideaBoard", () => {
  it("is empty without requests", () => {
    expect(ideaBoard([])).toEqual({ waiting: [], failed: [], groups: [] });
  });

  it("keeps the last answer on screen while the next one is on its way or failed", () => {
    const board = ideaBoard([
      row("d", "research", "failed", 4),
      row("c", "generate", "running", 3),
      row("b", "research", "succeeded", 2),
      row("a", "generate", "succeeded", 1),
    ]);
    expect(board.waiting).toEqual([{ mode: "generate", started: true }]);
    expect(board.failed).toEqual([{ mode: "research", error: "Límite." }]);
    expect(board.groups.map((g) => g.id)).toEqual(["b", "a"]);
  });

  it("forgets a failure once a later request answered", () => {
    const board = ideaBoard([
      row("b", "generate", "succeeded", 2),
      row("a", "generate", "failed", 1),
    ]);
    expect(board.failed).toEqual([]);
  });
});

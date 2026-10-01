import { type AIError, providerError, rateLimited, validationError } from "@radev/ai";
import { describe, expect, it } from "vitest";
import { buildIdeaFiles, decideIdeas, ideaSource, toProposedIdeas } from "./ideas-request";

const params = { count: 5, pillarKey: null, focus: null };
const read = (files: Record<string, string>, name: string) => JSON.parse(files[name] ?? "null");

describe("buildIdeaFiles", () => {
  it("gives the brief and what the bank already has", () => {
    const files = buildIdeaFiles({
      task: "ideas.generate",
      params,
      recent: [
        {
          hook: "Tu negocio pierde clientes",
          hookType: "warning",
          pillarKey: "business-problems",
          look: "chat",
          slides: ["cover", "cta"],
        },
      ],
      existing: [{ title: "Bots de WhatsApp", status: "discarded" }],
    });
    expect(Object.keys(files).sort()).toEqual([
      "existing-ideas.json",
      "recent-posts.json",
      "task.json",
    ]);
    // Topics only: the looks and structures of the posts are for writing carousels.
    expect(read(files, "recent-posts.json")).toEqual([
      { hook: "Tu negocio pierde clientes", hookType: "warning", pillarKey: "business-problems" },
    ]);
    const task = read(files, "task.json");
    expect(task.count).toBe(5);
    expect(task.focus).toBeUndefined();
    expect(task.sourcesNote).toBeUndefined();
    expect(read(files, "existing-ideas.json")).toEqual([
      { title: "Bots de WhatsApp", status: "discarded" },
    ]);
  });

  it("a request for a pillar says so", () => {
    const task = read(
      buildIdeaFiles({
        task: "ideas.generate",
        params: { ...params, pillarKey: "business-problems" },
        recent: [],
        existing: [],
      }),
      "task.json",
    );
    expect(task.pillarNote).toContain("Todas las ideas son de este pilar");
  });

  it("research asks for sources and takes the focus", () => {
    const task = read(
      buildIdeaFiles({
        task: "ideas.research",
        params: { ...params, focus: "turnos en clínicas" },
        recent: [],
        existing: [],
      }),
      "task.json",
    );
    expect(task.focus).toBe("turnos en clínicas");
    expect(task.sourcesNote).toBeDefined();
  });

  it("passes the problems of a malformed answer", () => {
    const task = read(
      buildIdeaFiles({
        task: "ideas.generate",
        params,
        recent: [],
        existing: [],
        problems: ["ideas.0.title › Muy corto."],
      }),
      "task.json",
    );
    expect(task.previousProblems).toEqual(["ideas.0.title › Muy corto."]);
  });
});

describe("ideaSource", () => {
  it("research or plain AI", () => {
    expect(ideaSource("ideas.research")).toBe("research");
    expect(ideaSource("ideas.generate")).toBe("ai");
  });
});

describe("toProposedIdeas", () => {
  it("maps pillars to ids, keeps sources and drops repeats", () => {
    const rows = toProposedIdeas(
      "ideas.research",
      {
        ideas: [
          {
            title: "Bots de WhatsApp para turnos",
            angle: "",
            pillarKey: "business-problems",
            sources: [{ title: "Nota", url: "https://example.com" }],
          },
          {
            title: "¿Cuánto cuesta una web?",
            angle: "",
            pillarKey: "business-problems",
            sources: [{ title: "Otra", url: "https://example.org" }],
          },
        ],
      } as never,
      new Map([["business-problems", "pillar-1"]]),
      ["Cuanto cuesta una web"],
    );
    expect(rows).toEqual([
      {
        title: "Bots de WhatsApp para turnos",
        angle: "",
        pillarId: "pillar-1",
        source: "research",
        sources: [{ title: "Nota", url: "https://example.com" }],
      },
    ]);
  });
});

describe("decideIdeas", () => {
  const fresh = { feedbackUsed: false, lastTry: false };
  const failed = (error: AIError) => ({ ok: false as const, error, usage: null });

  it("retries a malformed answer once, then fails with its problems", () => {
    const result = failed(validationError(["ideas.0.pillarKey › Inválido."]));
    expect(decideIdeas(result, fresh)).toEqual({
      kind: "retryWithFeedback",
      problems: ["ideas.0.pillarKey › Inválido."],
    });
    const second = decideIdeas(result, { ...fresh, feedbackUsed: true });
    expect(second.kind).toBe("fail");
  });

  it("a provider's limit fails right away with a message (manual request)", () => {
    const decision = decideIdeas({ ok: false, error: rateLimited("límite"), usage: null }, fresh);
    expect(decision).toMatchObject({ kind: "fail" });
  });

  it("a retryable provider error retries until the last try", () => {
    const result = { ok: false as const, error: providerError("caído", true), usage: null };
    expect(decideIdeas(result, fresh)).toEqual({ kind: "retry" });
    expect(decideIdeas(result, { ...fresh, lastTry: true })).toMatchObject({ kind: "fail" });
  });
});

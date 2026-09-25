import { type AIError, providerError, rateLimited, validationError } from "@radev/ai";
import { describe, expect, it } from "vitest";
import { buildIdeaFiles, decideIdeas, ideaSource, toProposedIdeas } from "./ideas-request";

const params = { count: 5, pillarKey: null, seriesKey: null, focus: null };
const series = [
  {
    key: "real-cost",
    name: "¿Cuánto cuesta realmente…?",
    brief: "1. cover…",
    pillarKey: "business-problems",
  },
];
const read = (files: Record<string, string>, name: string) => JSON.parse(files[name] ?? "null");

describe("buildIdeaFiles", () => {
  it("gives the brief, the series and what the bank already has", () => {
    const files = buildIdeaFiles({
      task: "ideas.generate",
      params,
      series,
      recent: [
        { hook: "Tu negocio pierde clientes", hookType: "warning", pillarKey: "business-problems" },
      ],
      existing: [{ title: "Bots de WhatsApp", status: "discarded", seriesKey: null }],
    });
    expect(Object.keys(files).sort()).toEqual([
      "existing-ideas.json",
      "recent-posts.json",
      "series.md",
      "task.json",
    ]);
    const task = read(files, "task.json");
    expect(task.count).toBe(5);
    expect(task.focus).toBeUndefined();
    expect(task.sourcesNote).toBeUndefined();
    expect(files["series.md"]).toContain("`real-cost`");
    expect(files["series.md"]).toContain("Pilar: `business-problems`");
    expect(read(files, "existing-ideas.json")).toEqual([
      { title: "Bots de WhatsApp", status: "discarded", seriesKey: null },
    ]);
  });

  it("a request for a series or a pillar says so", () => {
    const task = read(
      buildIdeaFiles({
        task: "ideas.generate",
        params: { ...params, pillarKey: "business-problems", seriesKey: "real-cost" },
        series,
        recent: [],
        existing: [],
      }),
      "task.json",
    );
    expect(task.seriesNote).toContain("Todas las ideas son de esta serie");
    expect(task.pillarNote).toContain("Todas las ideas son de este pilar");
  });

  it("research asks for sources and takes the focus", () => {
    const task = read(
      buildIdeaFiles({
        task: "ideas.research",
        params: { ...params, focus: "turnos en clínicas" },
        series: [],
        recent: [],
        existing: [],
      }),
      "task.json",
    );
    expect(task.focus).toBe("turnos en clínicas");
    expect(task.sourcesNote).toBeDefined();
    expect(task.seriesNote).toContain("no tiene series");
  });

  it("passes the problems of a malformed answer", () => {
    const task = read(
      buildIdeaFiles({
        task: "ideas.generate",
        params,
        series,
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
  it("research, series or plain AI", () => {
    expect(ideaSource("ideas.research", "real-cost")).toBe("research");
    expect(ideaSource("ideas.generate", "real-cost")).toBe("series");
    expect(ideaSource("ideas.generate", null)).toBe("ai");
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
            seriesKey: null,
            sources: [{ title: "Nota", url: "https://example.com" }],
          },
          {
            title: "¿Cuánto cuesta una web?",
            angle: "",
            pillarKey: "business-problems",
            seriesKey: null,
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
        seriesKey: null,
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

import { type AIError, providerError, rateLimited, validationError } from "@radev/ai";
import type { AiCarousel } from "@radev/slides/generation";
import { describe, expect, it } from "vitest";
import {
  buildTaskFiles,
  decide,
  MAX_RATE_LIMIT_ATTEMPTS,
  runRow,
  stampDataSources,
} from "./carousel-generate";

const fresh = { feedbackUsed: false, rateLimitAttempt: 0, lastTry: false };
const failed = (error: AIError) => ({ ok: false as const, error, usage: null });

describe("decide", () => {
  it("saves a valid answer", () => {
    const usage = {
      provider: "claude-code" as const,
      model: "claude-sonnet-5",
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
      durationMs: 0,
      numTurns: 1,
      sessionId: null,
    };
    expect(decide({ ok: true, data: {}, usage }, fresh)).toEqual({ kind: "save" });
  });

  it("retries a malformed answer once, with its problems as feedback", () => {
    const result = failed(validationError(["slides.0 › La primera slide tiene que ser `cover`."]));
    expect(decide(result, fresh)).toEqual({
      kind: "retryWithFeedback",
      problems: ["slides.0 › La primera slide tiene que ser `cover`."],
    });
    expect(decide(result, { ...fresh, feedbackUsed: true })).toEqual({ kind: "fail" });
  });

  it("reschedules after a limit with the growing backoff, then gives up", () => {
    const result = failed(rateLimited("límite"));
    expect(decide(result, fresh)).toEqual({ kind: "reschedule", delayMs: 15 * 60_000 });
    expect(decide(result, { ...fresh, rateLimitAttempt: 2 })).toEqual({
      kind: "reschedule",
      delayMs: 60 * 60_000,
    });
    expect(decide(result, { ...fresh, rateLimitAttempt: MAX_RATE_LIMIT_ATTEMPTS - 1 })).toEqual({
      kind: "fail",
    });
  });

  it("waits for the provider's reset when it is later than the backoff", () => {
    const result = failed(rateLimited("límite", 3 * 3_600_000));
    expect(decide(result, fresh)).toEqual({ kind: "reschedule", delayMs: 3 * 3_600_000 });
  });

  it("retries a provider error worth retrying, unless it is the last try", () => {
    const result = failed(providerError("caído", true));
    expect(decide(result, fresh)).toEqual({ kind: "retry" });
    expect(decide(result, { ...fresh, lastTry: true })).toEqual({ kind: "fail" });
    expect(decide(failed(providerError("credencial", false)), fresh)).toEqual({ kind: "fail" });
  });
});

describe("buildTaskFiles", () => {
  const recent = [
    { hook: "¿Cuánto cuesta una app?", hookType: "cost", pillarKey: "business-problems" },
  ];

  it("writes the request, the slide guide and the recent posts", () => {
    const files = buildTaskFiles({
      request: {
        idea: "Automatizar WhatsApp",
        pillarKey: "business-problems",
        hookType: "warning",
      },
      recent,
    });
    expect(Object.keys(files).sort()).toEqual(["recent-posts.json", "slides.md", "task.json"]);
    expect(JSON.parse(files["task.json"] ?? "")).toEqual({
      idea: "Automatizar WhatsApp",
      pillarKey: "business-problems",
      hookType: "warning",
    });
    expect(JSON.parse(files["recent-posts.json"] ?? "")).toEqual(recent);
    expect(files["slides.md"]).toContain("# Guía de slides");
  });

  it("adds data.json and explains it when the brand has data", () => {
    const data = {
      asOf: "2026-09-25",
      datasets: {},
      figures: [
        {
          key: "usd-blue-venta",
          label: "Dólar blue, venta",
          value: "$ 1.560",
          source: "Bluelytics",
        },
      ],
    };
    const request = { idea: "El dólar hoy", pillarKey: null, hookType: null };
    const files = buildTaskFiles({ request, recent, data });
    expect(JSON.parse(files["data.json"] ?? "")).toEqual(data);
    expect(files["slides.md"]).toContain("## Datos (`data.json`)");
    const without = buildTaskFiles({ request, recent, data: null });
    expect(without["data.json"]).toBeUndefined();
    expect(without["slides.md"]).toContain("No uses `chart` ni `bigNumber`");
  });

  it("lets the AI choose the pillar and hook when the operator didn't", () => {
    const task = JSON.parse(
      buildTaskFiles({ request: { idea: "x", pillarKey: null, hookType: null }, recent: [] })[
        "task.json"
      ] ?? "",
    );
    expect(task.pillarNote).toMatch(/Elegí el pilar/);
    expect(task.hookNote).toMatch(/Elegí el tipo de hook/);
  });

  it("carries the problems of a malformed answer", () => {
    const task = JSON.parse(
      buildTaskFiles({
        request: { idea: "x", pillarKey: "a", hookType: null },
        recent: [],
        problems: ["hook › Máximo 100 caracteres."],
      })["task.json"] ?? "",
    );
    expect(task.previousProblems).toEqual(["hook › Máximo 100 caracteres."]);
  });

  it("adds no revision to a first generation", () => {
    const files = buildTaskFiles({
      request: { idea: "x", pillarKey: "a", hookType: null },
      recent,
    });
    expect(files["previous.json"]).toBeUndefined();
    expect(JSON.parse(files["task.json"] ?? "").revision).toBeUndefined();
  });

  it("rewrites from the previous version with the operator's feedback", () => {
    const previous = { hook: "Viejo hook", slides: [] };
    const files = buildTaskFiles({
      request: { idea: "x", pillarKey: "a", hookType: null },
      recent,
      revision: { previous, feedback: "El hook es muy genérico.", renderProblems: [] },
    });
    expect(JSON.parse(files["previous.json"] ?? "")).toEqual(previous);
    const { revision } = JSON.parse(files["task.json"] ?? "");
    expect(revision).toMatchObject({
      previousFile: "previous.json",
      operatorFeedback: "El hook es muy genérico.",
    });
    expect(revision.renderProblems).toBeUndefined();
  });

  it("carries the render problems of the previous version", () => {
    const files = buildTaskFiles({
      request: { idea: "x", pillarKey: "a", hookType: null },
      recent,
      revision: {
        previous: {},
        feedback: null,
        renderProblems: ["Slide 2: El texto no entra en su caja: “Muy largo”"],
      },
    });
    const { revision } = JSON.parse(files["task.json"] ?? "");
    expect(revision.renderProblems).toEqual(["Slide 2: El texto no entra en su caja: “Muy largo”"]);
    expect(revision.renderProblemsNote).toMatch(/acortalos/);
    expect(revision.operatorFeedback).toBeUndefined();
  });
});

describe("buildTaskFiles with a series", () => {
  const request = {
    idea: "Cuánto cuesta una web",
    pillarKey: null,
    hookType: "cost",
    seriesKey: "real-cost",
  };

  it("gives the AI the series' structure and required slides", () => {
    const files = buildTaskFiles({
      request,
      recent: [],
      series: {
        name: "¿Cuánto cuesta realmente…?",
        brief: "1. cover…",
        requiredSlides: ["costBreakdown"],
      },
    });
    const task = JSON.parse(files["task.json"] ?? "{}");
    expect(task.series).toMatchObject({
      name: "¿Cuánto cuesta realmente…?",
      structure: "1. cover…",
      requiredSlides: ["costBreakdown"],
    });
  });

  it("leaves the series out of a post without one", () => {
    const task = JSON.parse(buildTaskFiles({ request, recent: [] })["task.json"] ?? "{}");
    expect(task.series).toBeUndefined();
  });
});

describe("stampDataSources", () => {
  const carousel = {
    pillarKey: "dollar",
    hookType: "data",
    slides: [
      { type: "cover", title: "El dólar" },
      {
        type: "chart",
        title: "Cómo se movió",
        kind: "line",
        datasetRef: "usd-blue-30d",
        source: "Dólar blue. Fuente: Bluelytics",
      },
      { type: "bigNumber", value: "$1.560", label: "Dólar blue", source: "la IA" },
    ],
  } as unknown as AiCarousel;
  const series = {
    title: "Dólar blue",
    source: "Bluelytics, 20/09/2026",
    unitPosition: "before" as const,
    points: [],
  };
  const figure = {
    key: "usd-blue-venta",
    label: "Dólar blue, venta",
    value: "$ 1.560",
    source: "Bluelytics, 25/09/2026",
  };

  it("puts the source of the dataset and of the figure, not the AI's", () => {
    const stamped = stampDataSources(carousel, {
      datasets: { "usd-blue-30d": series },
      figures: [figure],
    });
    expect(stamped.slides.map((slide) => ("source" in slide ? slide.source : null))).toEqual([
      null,
      "Bluelytics, 20/09/2026",
      "Bluelytics, 25/09/2026",
    ]);
  });
});

describe("runRow", () => {
  const context = { brandId: "brand-1", postId: "post-1" };
  const target = { provider: "claude-code", model: "sonnet" } as const;

  it("records the model that answered and its usage", () => {
    const row = runRow(
      {
        role: "primary",
        target,
        result: {
          ok: true,
          data: {},
          usage: {
            provider: "claude-code",
            model: "claude-sonnet-5",
            inputTokens: 100,
            outputTokens: 20,
            costUsd: 0.1,
            durationMs: 4000,
            numTurns: 3,
            sessionId: "s-1",
          },
        },
      },
      context,
    );
    expect(row).toMatchObject({
      ...context,
      task: "carousel.generate",
      role: "primary",
      provider: "claude-code",
      model: "claude-sonnet-5",
      status: "succeeded",
      errorKind: null,
      inputTokens: 100,
      numTurns: 3,
    });
  });

  it("records a failure before any answer with the requested model and its problems", () => {
    const row = runRow(
      { role: "fallback", target, result: failed(validationError(["hook › Muy largo."])) },
      context,
    );
    expect(row).toMatchObject({
      role: "fallback",
      model: "sonnet",
      status: "failed",
      errorKind: "validation",
      inputTokens: 0,
    });
    expect(row.error).toContain("- hook › Muy largo.");
  });

  it("records an idea request's attempt without a post", () => {
    const row = runRow(
      { role: "primary", target, result: failed(rateLimited("límite")) },
      { brandId: "brand-1", postId: null, task: "ideas.research" },
    );
    expect(row).toMatchObject({ postId: null, task: "ideas.research", errorKind: "rate_limited" });
  });
});

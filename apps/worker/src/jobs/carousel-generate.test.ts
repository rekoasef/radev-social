import { type AIError, providerError, rateLimited, validationError } from "@radev/ai";
import { describe, expect, it } from "vitest";
import { buildTaskFiles, decide, MAX_RATE_LIMIT_ATTEMPTS, runRow } from "./carousel-generate";

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
});

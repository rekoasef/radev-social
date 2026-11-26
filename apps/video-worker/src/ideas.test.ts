import type { AiRoute } from "@radev/core";
import type { VideoIdeaRequest } from "@radev/db";
import { describe, expect, it, vi } from "vitest";
import { createAiLock } from "./ai-lock";
import { type IdeasDeps, proposeIdeas } from "./ideas";

const route: AiRoute = {
  task: "video.ideas",
  brandId: null,
  primary: { provider: "claude-code", model: "sonnet" },
  fallback: null,
};
const request = { id: "r1", brandId: null, mode: "generate", focus: null } as VideoIdeaRequest;
const usage = { model: "claude-sonnet", inputTokens: 100, outputTokens: 10, durationMs: 5 };

const answer = (result: object) => ({
  result,
  attempts: [{ result: { ...result, usage }, target: route.primary, role: "primary" }],
});
const good = (...topics: string[]) =>
  answer({ ok: true, data: { ideas: topics.map((topic) => ({ topic, hook: "Gancho." })) } });

function setup(overrides: Partial<IdeasDeps> = {}, ...answers: object[]) {
  const generate = vi.fn();
  for (const a of answers) generate.mockResolvedValueOnce(a);
  const deps = {
    start: vi.fn(async () => request),
    finish: vi.fn(async () => {}),
    routes: async () => [route],
    router: { generate },
    lock: createAiLock(),
    brandNotes: async () => "# Marca",
    existing: async () => ["El apagón de Nueva York de 1977"],
    log: { info: vi.fn(), warn: vi.fn() },
    ...overrides,
  } satisfies IdeasDeps;
  return { deps, generate };
}

describe("proposeIdeas", () => {
  it("does nothing on a request already closed (a repeated job)", async () => {
    const { deps, generate } = setup({ start: vi.fn(async () => undefined) });
    expect(await proposeIdeas(deps, { requestId: "r1" })).toBe("skipped");
    expect(generate).not.toHaveBeenCalled();
    expect(deps.finish).not.toHaveBeenCalled();
  });

  it("stores the new topics, without the ones already made, and what it spent", async () => {
    const { deps, generate } = setup(
      {},
      good("el apagon de nueva york de 1977", "El submarino que no disparó en 1962"),
    );
    expect(await proposeIdeas(deps, { requestId: "r1" })).toBe("succeeded");
    expect(deps.finish).toHaveBeenCalledWith("r1", {
      ...usage,
      ideas: [{ topic: "El submarino que no disparó en 1962", hook: "Gancho.", sources: [] }],
    });
    // Without a brand there is no brand file, and without web search no tools.
    const task = generate.mock.calls[0]?.[1];
    expect(task.files["marca.md"]).toBeUndefined();
    expect(task.tools).toBeUndefined();
  });

  it("searches the web and takes the brand's voice when asked", async () => {
    const { deps, generate } = setup(
      {
        start: vi.fn(async () => ({ ...request, mode: "research" as const, brandId: "b1" })),
        routes: async () => [{ ...route, task: "video.ideas.research" as const }],
      },
      good("El submarino que no disparó en 1962"),
    );
    await proposeIdeas(deps, { requestId: "r1" });
    const task = generate.mock.calls[0]?.[1];
    expect(task.tools).toEqual(["WebSearch", "WebFetch"]);
    expect(task.files["marca.md"]).toBe("# Marca");
  });

  it("asks once more for a malformed answer and adds up both tries", async () => {
    const bad = answer({ ok: false, error: { kind: "validation", message: "x", issues: ["mal"] } });
    const { deps, generate } = setup({}, bad, good("El submarino que no disparó en 1962"));
    expect(await proposeIdeas(deps, { requestId: "r1" })).toBe("succeeded");
    expect(generate.mock.calls[1]?.[1].prompt).toContain("- mal");
    expect(deps.finish).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({ inputTokens: 200, outputTokens: 20 }),
    );
  });

  it("closes the request as failed with the provider's reason", async () => {
    const limit = answer({ ok: false, error: { kind: "limit", message: "Límite de Claude." } });
    const { deps } = setup({}, limit);
    expect(await proposeIdeas(deps, { requestId: "r1" })).toBe("failed");
    expect(deps.finish).toHaveBeenCalledWith("r1", { ...usage, error: "Límite de Claude." });
  });

  it("says what to run when the task has no route yet", async () => {
    const { deps } = setup({ routes: async () => [] });
    expect(await proposeIdeas(deps, { requestId: "r1" })).toBe("failed");
    expect(deps.finish).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({ error: expect.stringContaining("db:seed") }),
    );
  });
});

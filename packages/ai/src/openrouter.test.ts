import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  buildOpenRouterBody,
  buildOpenRouterMessages,
  classifyOpenRouterError,
  createOpenRouterProvider,
  retryAfterMs,
} from "./openrouter";
import type { GenerationResult, GenerationTask } from "./types";

const schema = z.object({ hook: z.string().min(1) });
const task = (extra: Partial<GenerationTask<unknown>> = {}) =>
  ({
    task: "ideas.generate",
    brandId: "brand-1",
    prompt: "Generá un hook",
    files: { "CLAUDE.md": "# Marca\nVoseo.", "task.json": '{"idea":"x"}' },
    schema,
    model: "qwen/qwen3.8-27b:free",
    ...extra,
  }) as GenerationTask<z.infer<typeof schema>>;

type Call = { url: string; init: RequestInit; body: Record<string, unknown> };

/** A fetch that answers from a list, one response per call, and records what it got. */
function fakeFetch(...responses: (() => Response)[]) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {}, body: JSON.parse(String(init?.body)) });
    const next = responses[calls.length - 1];
    if (!next) throw new Error("fetch llamado de más");
    return next();
  }) as typeof fetch;
  return { impl, calls };
}

const json =
  (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  () =>
    new Response(JSON.stringify(body), { status, headers });

const completion = (content: string, extra: object = {}) =>
  json({
    id: "gen-1",
    model: "qwen/qwen3.8-27b:free",
    choices: [{ finish_reason: "stop", message: { content } }],
    usage: { prompt_tokens: 100, completion_tokens: 10, cost: 0 },
    ...extra,
  });

const env = { OPENROUTER_API_KEY: "sk-or-test" };
const provider = (fetchImpl: typeof fetch, overrides: NodeJS.ProcessEnv = env) =>
  createOpenRouterProvider({ env: overrides, fetch: fetchImpl });
const errorOf = (result: GenerationResult<unknown>) => (result.ok ? null : result.error);

describe("buildOpenRouterMessages", () => {
  it("sends CLAUDE.md as the system message and the other files and the schema to the user", () => {
    const [system, user] = buildOpenRouterMessages(task());
    expect(system).toEqual({ role: "system", content: "# Marca\nVoseo." });
    expect(user?.content).toContain("Generá un hook");
    expect(user?.content).toContain("`task.json`");
    expect(user?.content).toContain('{"idea":"x"}');
    expect(user?.content).toContain('"hook"');
    expect(user?.content).not.toContain("# Marca");
  });
});

describe("buildOpenRouterBody", () => {
  it("asks for structured output only from endpoints that support it", () => {
    const body = buildOpenRouterBody(task(), true);
    expect(body).toMatchObject({
      model: "qwen/qwen3.8-27b:free",
      response_format: { type: "json_schema", json_schema: { strict: false } },
      provider: { require_parameters: true },
    });
    const plain = buildOpenRouterBody(task(), false);
    expect(plain).not.toHaveProperty("response_format");
    expect(plain).not.toHaveProperty("provider");
  });
});

describe("retryAfterMs", () => {
  const now = 1_700_000_000_000;
  it("reads Retry-After in seconds or as a date, and X-RateLimit-Reset", () => {
    expect(retryAfterMs(new Headers({ "retry-after": "30" }), now)).toBe(30_000);
    const date = new Date(now + 60_000).toUTCString();
    expect(retryAfterMs(new Headers({ "retry-after": date }), now)).toBe(60_000);
    expect(retryAfterMs(new Headers({ "x-ratelimit-reset": String(now + 5_000) }), now)).toBe(
      5_000,
    );
    expect(retryAfterMs(new Headers(), now)).toBeNull();
  });
});

describe("classifyOpenRouterError", () => {
  it("says whether trying again could help", () => {
    expect(classifyOpenRouterError(429, "", 1000)).toMatchObject({
      kind: "rate_limited",
      retryAfterMs: 1000,
    });
    expect(classifyOpenRouterError(401, "")).toMatchObject({ retryable: false });
    expect(classifyOpenRouterError(402, "")).toMatchObject({ retryable: false });
    expect(classifyOpenRouterError(400, "")).toMatchObject({ retryable: false });
    expect(classifyOpenRouterError(408, "")).toMatchObject({ retryable: true });
    expect(classifyOpenRouterError(502, "")).toMatchObject({ retryable: true });
  });
});

describe("createOpenRouterProvider", () => {
  it("returns validated data with usage, sending the key only in the header", async () => {
    const { impl, calls } = fakeFetch(completion('{"hook":"Hola"}'));
    const result = await provider(impl).generate(task());
    expect(result).toMatchObject({ ok: true, data: { hook: "Hola" } });
    expect(result.usage).toMatchObject({
      provider: "openrouter",
      model: "qwen/qwen3.8-27b:free",
      inputTokens: 100,
      outputTokens: 10,
      costUsd: 0,
      sessionId: "gen-1",
    });
    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get("authorization")).toBe("Bearer sk-or-test");
    expect(JSON.stringify(calls[0]?.body)).not.toContain("sk-or-test");
  });

  it("takes the JSON out of text around it", async () => {
    const { impl } = fakeFetch(completion('Claro:\n```json\n{"hook":"Hola"}\n```'));
    expect(await provider(impl).generate(task())).toMatchObject({ ok: true });
  });

  it("validates with Zod (rule 4)", async () => {
    const { impl } = fakeFetch(completion('{"hook":""}'));
    const result = await provider(impl).generate(task());
    expect(errorOf(result)).toMatchObject({ kind: "validation" });
    expect(result.usage).not.toBeNull();
  });

  it("retries once without structured output when the model doesn't support it", async () => {
    const { impl, calls } = fakeFetch(
      json(
        { error: { code: 404, message: "No endpoints found that support response_format" } },
        404,
      ),
      completion('{"hook":"Hola"}'),
    );
    expect(await provider(impl).generate(task())).toMatchObject({ ok: true });
    expect(calls).toHaveLength(2);
    expect(calls[1]?.body).not.toHaveProperty("response_format");
  });

  it("maps the limit to rate_limited with the retry time", async () => {
    const { impl } = fakeFetch(
      json({ error: { code: 429, message: "Rate limit exceeded" } }, 429, { "retry-after": "20" }),
    );
    const error = errorOf(await provider(impl).generate(task()));
    expect(error).toMatchObject({ kind: "rate_limited", retryAfterMs: 20_000 });
  });

  it("maps errors inside a 200 answer and cut answers", async () => {
    const inline = fakeFetch(
      json({ choices: [{ finish_reason: "error", error: { code: 502, message: "down" } }] }),
    );
    expect(errorOf(await provider(inline.impl).generate(task()))).toMatchObject({
      kind: "provider_error",
      retryable: true,
    });
    const cut = fakeFetch(
      completion('{"hook":"Ho', {
        choices: [{ finish_reason: "length", message: { content: '{"hook":"Ho' } }],
      }),
    );
    expect(errorOf(await provider(cut.impl).generate(task()))?.message).toMatch(/cortó/);
  });

  it("refuses paid models, tools and a missing key without calling OpenRouter (rule 13)", async () => {
    const { impl, calls } = fakeFetch();
    const run = async (p: ReturnType<typeof provider>, t: GenerationTask<unknown>) =>
      errorOf(await p.generate(t));
    expect(await run(provider(impl), task({ model: "anthropic/claude-sonnet" }))).toMatchObject({
      retryable: false,
    });
    expect(await run(provider(impl), task({ tools: ["WebSearch"] }))).toMatchObject({
      retryable: false,
    });
    expect((await run(provider(impl, {}), task()))?.message).toMatch(/OPENROUTER_API_KEY/);
    expect(calls).toHaveLength(0);
  });

  it("allows paid models only when asked", async () => {
    const { impl, calls } = fakeFetch(completion('{"hook":"Hola"}'));
    const paid = createOpenRouterProvider({ env, fetch: impl, allowPaidModels: true });
    expect(await paid.generate(task({ model: "anthropic/claude-sonnet" }))).toMatchObject({
      ok: true,
    });
    expect(calls).toHaveLength(1);
  });

  it("stops on timeout and on cancel", async () => {
    const hang = (async (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      })) as typeof fetch;
    const timedOut = await provider(hang).generate(task({ timeoutMs: 100 }));
    expect(errorOf(timedOut)?.message).toMatch(/no respondió/);

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);
    const cancelled = await provider(hang).generate(task({ signal: controller.signal }));
    expect(errorOf(cancelled)?.message).toMatch(/canceló/);
  });

  it("reports a network failure as retryable", async () => {
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    expect(errorOf(await provider(down).generate(task()))).toMatchObject({
      kind: "provider_error",
      retryable: true,
    });
  });
});

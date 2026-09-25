import type { AiRoute } from "@radev/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { providerError, rateLimited } from "./errors";
import { createFakeProvider, type FakeAnswer } from "./fake";
import { createRouter } from "./router";
import type { GenerationTask } from "./types";

const schema = z.object({ hook: z.string().min(1) });
const task: Omit<GenerationTask<z.infer<typeof schema>>, "model"> = {
  task: "carousel.generate",
  brandId: "brand-1",
  prompt: "Generá un hook",
  files: { "CLAUDE.md": "# Marca" },
  schema,
};

const route: AiRoute = {
  task: "carousel.generate",
  brandId: null,
  primary: { provider: "claude-code", model: "sonnet" },
  fallback: { provider: "openrouter", model: "nex-agi/nex-n2.5-pro:free" },
};

/** Router with fake providers that answer the given values. */
function setup(claude: FakeAnswer, openrouter: FakeAnswer) {
  const primary = createFakeProvider(() => claude, "claude-code");
  const fallback = createFakeProvider(() => openrouter, "openrouter");
  return {
    router: createRouter({ "claude-code": primary, openrouter: fallback }),
    primary,
    fallback,
  };
}

const ok = { output: { hook: "Hola" } };

describe("createRouter", () => {
  it("uses the principal with its model and stops there when it works", async () => {
    const { router, primary, fallback } = setup(ok, ok);
    const { result, attempts } = await router.generate(route, task);
    expect(result).toMatchObject({ ok: true, data: { hook: "Hola" } });
    expect(attempts.map((a) => a.role)).toEqual(["primary"]);
    expect(primary.calls[0]?.model).toBe("sonnet");
    expect(fallback.calls).toHaveLength(0);
  });

  it("goes to the fallback when the principal hits its limit", async () => {
    const { router, fallback } = setup({ error: rateLimited("límite") }, ok);
    const { result, attempts } = await router.generate(route, task);
    expect(result).toMatchObject({ ok: true });
    expect(result.usage?.provider).toBe("openrouter");
    expect(attempts.map((a) => [a.role, a.result.ok])).toEqual([
      ["primary", false],
      ["fallback", true],
    ]);
    expect(fallback.calls[0]?.model).toBe("nex-agi/nex-n2.5-pro:free");
  });

  it("goes to the fallback on any provider error", async () => {
    const { router } = setup({ error: providerError("caído", true) }, ok);
    expect((await router.generate(route, task)).result.ok).toBe(true);
    const missing = setup({ error: providerError("sin credencial", false) }, ok);
    expect((await missing.router.generate(route, task)).result.ok).toBe(true);
  });

  it("does not hand a wrong answer to the fallback", async () => {
    const { router, fallback } = setup({ output: { hook: "" } }, ok);
    const { result, attempts } = await router.generate(route, task);
    expect(result).toMatchObject({ ok: false, error: { kind: "validation" } });
    expect(attempts).toHaveLength(1);
    expect(fallback.calls).toHaveLength(0);
  });

  it("without a fallback, returns the principal's failure", async () => {
    const { router } = setup({ error: rateLimited("límite", 1000) }, ok);
    const { result, attempts } = await router.generate({ ...route, fallback: null }, task);
    expect(result).toMatchObject({
      ok: false,
      error: { kind: "rate_limited", retryAfterMs: 1000 },
    });
    expect(attempts).toHaveLength(1);
  });

  it("when both fail, a limit decides over a missing credential (wait and retry)", async () => {
    const { router } = setup(
      { error: rateLimited("límite de Claude") },
      { error: providerError("falta la key", false) },
    );
    const { result, attempts } = await router.generate(route, task);
    expect(attempts).toHaveLength(2);
    expect(result).toMatchObject({ ok: false, error: { kind: "rate_limited" } });
  });

  it("when both fail without a limit, a retryable failure decides", async () => {
    const { router } = setup(
      { error: providerError("sin credencial", false) },
      { error: providerError("caído", true) },
    );
    const { result } = await router.generate(route, task);
    expect(result).toMatchObject({ ok: false, error: { message: "caído" } });
  });

  it("fails a provider that isn't configured and moves on", async () => {
    const fallback = createFakeProvider(() => ok, "openrouter");
    const router = createRouter({ openrouter: fallback });
    const { result, attempts } = await router.generate(route, task);
    expect(result.ok).toBe(true);
    expect(attempts[0]?.result).toMatchObject({ ok: false, error: { retryable: false } });
  });

  it("does not try the fallback of a cancelled job", async () => {
    const controller = new AbortController();
    controller.abort();
    const { router, fallback } = setup(
      { error: providerError("La generación se canceló.", true) },
      ok,
    );
    const { attempts } = await router.generate(route, { ...task, signal: controller.signal });
    expect(attempts).toHaveLength(1);
    expect(fallback.calls).toHaveLength(0);
  });
});

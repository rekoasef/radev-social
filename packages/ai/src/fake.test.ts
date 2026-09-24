import { describe, expect, it } from "vitest";
import { z } from "zod";
import { isRetryable, providerError, rateLimited } from "./errors";
import { createFakeProvider } from "./fake";
import type { GenerationTask } from "./types";

const schema = z.object({ hook: z.string().min(1) });

const task: GenerationTask<z.infer<typeof schema>> = {
  task: "carousel.generate",
  brandId: "brand-1",
  prompt: "Generá un hook",
  files: { "CLAUDE.md": "# Marca" },
  schema,
  model: "modelo-x",
};

describe("createFakeProvider", () => {
  it("returns validated data with usage", async () => {
    const provider = createFakeProvider(() => ({ output: { hook: "Hola" } }), "claude-code");
    const result = await provider.generate(task);
    expect(result).toMatchObject({ ok: true, data: { hook: "Hola" } });
    if (result.ok)
      expect(result.usage).toMatchObject({ provider: "claude-code", model: "modelo-x" });
    expect(provider.calls).toHaveLength(1);
  });

  it("fails validation like a real provider when the answer is wrong", async () => {
    const provider = createFakeProvider(() => ({ output: { hook: "" } }));
    const result = await provider.generate(task);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("validation");
  });

  it("passes provider errors through, without usage", async () => {
    const provider = createFakeProvider(() => ({ error: rateLimited("Límite de la suscripción") }));
    const result = await provider.generate(task);
    expect(result).toMatchObject({ ok: false, error: { kind: "rate_limited" }, usage: null });
  });
});

describe("isRetryable", () => {
  it("retries limits and validation, and provider errors only when they say so", () => {
    expect(isRetryable(rateLimited("x"))).toBe(true);
    expect(isRetryable(providerError("caído", true))).toBe(true);
    expect(isRetryable(providerError("modelo inválido", false))).toBe(false);
  });
});

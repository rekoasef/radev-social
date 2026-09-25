import { describe, expect, it } from "vitest";
import { type AiRoute, checkAiRoute, isFreeModel, resolveAiRoute } from "./routing";

const claude = { provider: "claude-code", model: "sonnet" } as const;
const free = { provider: "openrouter", model: "nex-agi/nex-n2.5-pro:free" } as const;

const route = (extra: Partial<AiRoute>): AiRoute => ({
  task: "carousel.generate",
  brandId: null,
  primary: claude,
  fallback: free,
  ...extra,
});

describe("resolveAiRoute", () => {
  const global = route({});
  const lumus = route({ brandId: "lumus", fallback: null });
  const ideas = route({ task: "ideas.generate", primary: free, fallback: claude });
  const routes = [global, lumus, ideas];

  it("prefers the brand's own route over the global one", () => {
    expect(resolveAiRoute(routes, "carousel.generate", "lumus")).toBe(lumus);
    expect(resolveAiRoute(routes, "carousel.generate", "radev")).toBe(global);
  });

  it("only looks at routes of the task", () => {
    expect(resolveAiRoute(routes, "ideas.generate", "lumus")).toBe(ideas);
    expect(resolveAiRoute(routes, "metrics.extract", "radev")).toBeNull();
  });
});

describe("isFreeModel", () => {
  it("accepts only :free variants", () => {
    expect(isFreeModel("qwen/qwen3.8-27b:free")).toBe(true);
    expect(isFreeModel("anthropic/claude-sonnet")).toBe(false);
    expect(isFreeModel("free")).toBe(false);
  });
});

describe("checkAiRoute", () => {
  it("accepts the default routes", () => {
    expect(checkAiRoute(route({}))).toEqual([]);
    expect(checkAiRoute(route({ task: "ideas.research", fallback: null }))).toEqual([]);
  });

  it("refuses paid OpenRouter models, as principal or fallback (rule 13)", () => {
    const paid = { provider: "openrouter", model: "openai/gpt-5" } as const;
    expect(checkAiRoute(route({ primary: paid, fallback: null }))[0]).toMatch(/gratuito/);
    expect(checkAiRoute(route({ fallback: paid }))[0]).toMatch(/respaldo.*gratuito/);
  });

  it("keeps tool tasks on claude-code", () => {
    expect(checkAiRoute(route({ task: "ideas.research", fallback: free }))[0]).toMatch(
      /herramientas/,
    );
    expect(
      checkAiRoute(route({ task: "metrics.extract", primary: free, fallback: null })),
    ).toHaveLength(1);
  });

  it("asks for a model and a fallback different from the principal", () => {
    expect(checkAiRoute(route({ primary: { provider: "claude-code", model: " " } }))[0]).toMatch(
      /Falta el modelo principal/,
    );
    expect(checkAiRoute(route({ fallback: { ...claude } }))).toContain(
      "El respaldo es igual al principal.",
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// The job's loop with the database and the AI faked: a valid answer that comes back practically
// the same as the current slide is asked again once, and kept if the second try fails.

const db = vi.hoisted(() => ({
  finishSlideRewrite: vi.fn(),
  request: {} as Record<string, unknown>,
}));

vi.mock("@radev/db", () => ({
  startSlideRewrite: vi.fn(async () => db.request),
  finishSlideRewrite: db.finishSlideRewrite,
  getBrandById: vi.fn(async () => ({
    id: "b1",
    archivedAt: null,
    stylePreset: "minimal",
    themeTokens: {},
  })),
  getBrandData: vi.fn(async () => null),
  listAiRoutes: vi.fn(async () => []),
  listPostScreenshots: vi.fn(async () => []),
  recordGenerationRun: vi.fn(),
}));
vi.mock("@radev/core", async (original) => ({
  ...(await original<typeof import("@radev/core")>()),
  resolveAiRoute: () => ({ task: "slide.rewrite" }),
}));
vi.mock("./carousel-generate", () => ({
  brandContext: vi.fn(async () => ({ claudeMd: "", pillars: [], pricing: "" })),
  loadScreenshots: vi.fn(async () => ({ images: [], screenshots: [], missing: [] })),
  runRow: vi.fn(() => ({})),
}));

const { rewriteSlide } = await import("./slide-rewrite");

const current = { type: "statement", title: "Tus números, *al instante*", text: "Sin planillas." };
const same = { ...current, text: "Sin planillas, nunca." };
const changed = {
  type: "cardGrid",
  title: "Qué te muestra un *tablero*",
  cards: [
    { icon: "wallet", label: "Ventas", text: "Lo que entró hoy." },
    { icon: "receipt", label: "Gastos", text: "Lo que salió hoy." },
    { icon: "package", label: "Stock", text: "Lo que te queda." },
  ],
};

const ok = (slide: unknown) => ({
  result: { ok: true, data: { slide }, usage: null },
  attempts: [],
});
const failed = {
  result: {
    ok: false,
    error: { kind: "provider_error", message: "caído", retryable: false },
    usage: null,
  },
  attempts: [],
};

function deps(answers: unknown[]) {
  const generate = vi.fn(async (_route: unknown, _task: unknown) => answers.shift());
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    deps: { db: {} as never, log: log as never, router: { generate } as never, lastTry: false },
    generate,
  };
}

beforeEach(() => {
  db.finishSlideRewrite.mockClear();
  db.request = {
    id: "r1",
    brandId: "b1",
    postId: null,
    slideIndex: 1,
    instruction: "más contenido",
    carousel: {
      slides: [{ type: "cover", title: "Portada" }, current, { type: "cta", title: "Cierre" }],
    },
  };
});

describe("rewriteSlide", () => {
  it("asks again when the answer is practically the same, and keeps the new one", async () => {
    const { deps: d, generate } = deps([ok(same), ok(changed)]);
    await expect(rewriteSlide(d, { requestId: "r1" })).resolves.toBe("done");
    expect(generate).toHaveBeenCalledTimes(2);
    const second = generate.mock.calls[1]?.[1] as { files: Record<string, string> };
    expect(JSON.parse(second.files["task.json"] ?? "{}").previousAnswer).toEqual(same);
    expect(db.finishSlideRewrite).toHaveBeenCalledWith(expect.anything(), "r1", {
      result: changed,
    });
  });

  it("keeps the similar answer when the second try fails", async () => {
    const { deps: d, generate } = deps([ok(same), failed]);
    await expect(rewriteSlide(d, { requestId: "r1" })).resolves.toBe("done");
    expect(generate).toHaveBeenCalledTimes(2);
    expect(db.finishSlideRewrite).toHaveBeenCalledWith(expect.anything(), "r1", { result: same });
  });

  it("asks only once more, even if it comes back the same again", async () => {
    const { deps: d, generate } = deps([ok(same), ok(same)]);
    await expect(rewriteSlide(d, { requestId: "r1" })).resolves.toBe("done");
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("a clear change is saved at the first answer", async () => {
    const { deps: d, generate } = deps([ok(changed)]);
    await expect(rewriteSlide(d, { requestId: "r1" })).resolves.toBe("done");
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

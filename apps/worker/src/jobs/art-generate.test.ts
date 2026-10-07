import type { ImageProvider, ImageResult } from "@radev/ai";
import type { ArtImage, PostArt } from "@radev/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../logger";
import { generateArt } from "./art-generate";

const db = {
  tokens: { colors: { accent: "#FF7A00" } } as Record<string, unknown>,
  version: undefined as Record<string, unknown> | undefined,
  saved: undefined as PostArt | undefined,
  files: new Map<string, Buffer>(),
  previous: [] as ArtImage[],
  today: 0,
};

vi.mock("@radev/db", () => ({
  getPostVersion: async () => db.version,
  getPostById: async () => ({ id: "post-1", brandId: "brand-1" }),
  getBrandById: async () => ({
    id: "brand-1",
    slug: "radev",
    stylePreset: "studio",
    themeTokens: db.tokens,
  }),
  listPostArtImages: async () => db.previous,
  countArtImagesSince: async () => db.today,
  readMediaFile: async (path: string) => db.files.get(path),
  writeMediaFile: async (path: string, bytes: Buffer) => {
    db.files.set(path, bytes);
  },
  setVersionArt: async (_db: unknown, _id: string, art: PostArt) => {
    db.saved = art;
  },
}));

const log = createLogger({}, "error");
const art = {
  cover: "A cracked black ceramic sphere leaking warm light",
  cta: "The same sphere mended with seams of gold",
};
const pending = (look = "atmosfera") => ({
  id: "v-1",
  postId: "post-1",
  content: { look, art },
  art: { status: "pending", images: {} },
});

/** A provider that answers from a list; records the prompts. */
function provider(answers: ImageResult[]) {
  const prompts: string[] = [];
  const images: ImageProvider = {
    id: "cloudflare",
    async generate({ prompt }) {
      prompts.push(prompt);
      const next = answers.shift();
      if (!next) throw new Error("generate llamado de más");
      return next;
    },
  };
  return { images, prompts };
}

const ok = (tag: string): ImageResult => ({
  ok: true,
  image: Buffer.from(tag),
  mime: "image/jpeg",
  model: "@cf/black-forest-labs/flux-1-schnell",
  durationMs: 3000,
});

/** Brightness by image content: "dark…" images are dark, anything else is light. */
const edgeBrightness = async (image: Buffer) => (image.toString().startsWith("dark") ? 5 : 240);
const backgroundMatches = (b: number, bg: "dark" | "light") => (bg === "dark" ? b <= 45 : b >= 210);

function deps(images: ImageProvider | null) {
  const queueRender = vi.fn(async () => {});
  return {
    queueRender,
    deps: {
      db: {} as never,
      log,
      images,
      edgeBrightness,
      backgroundMatches,
      queueRender,
      now: () => new Date("2026-09-29T12:00:00Z"),
    },
  };
}

beforeEach(() => {
  db.tokens = { colors: { accent: "#FF7A00" } };
  db.version = pending();
  db.saved = undefined;
  db.files.clear();
  db.previous = [];
  db.today = 0;
});

describe("art.generate", () => {
  it("generates both images, stores them next to the version and queues the render", async () => {
    const { images, prompts } = provider([ok("dark-cover"), ok("dark-cta")]);
    const { deps: d, queueRender } = deps(images);
    expect(await generateArt(d, { versionId: "v-1" })).toBe("done");
    expect(db.saved?.status).toBe("ready");
    expect(db.saved?.images.cover?.path).toBe("radev/post-1/v-1/art/cover.jpg");
    expect(db.files.get("radev/post-1/v-1/art/cta.jpg")?.toString()).toBe("dark-cta");
    // The subject plus the fixed rules, the look's background and the brand's accent.
    expect(prompts[0]).toMatch(/^Subject: A cracked black ceramic sphere/);
    expect(prompts[0]).toContain("pure black background");
    expect(prompts[0]).toContain("saturated orange");
    expect(queueRender).toHaveBeenCalledWith("v-1");
  });

  it("asks each slot for the background of its slide (revista: light cover, dark close)", async () => {
    db.version = pending("revista");
    const { images, prompts } = provider([ok("light-cover"), ok("dark-cta")]);
    await generateArt(deps(images).deps, { versionId: "v-1" });
    expect(prompts[0]).toContain("pure white background");
    expect(prompts[1]).toContain("pure black background");
    expect(db.saved?.status).toBe("ready");
  });

  it("does nothing for art that is not pending (a repeated job)", async () => {
    db.version = { ...pending(), art: { status: "ready", images: {} } };
    const { deps: d, queueRender } = deps(provider([]).images);
    expect(await generateArt(d, { versionId: "v-1" })).toBe("skipped");
    expect(db.saved).toBeUndefined();
    expect(queueRender).not.toHaveBeenCalled();
  });

  it("renders without images when there are no credentials", async () => {
    const { deps: d, queueRender } = deps(null);
    await generateArt(d, { versionId: "v-1" });
    expect(db.saved).toMatchObject({ status: "skipped", images: {} });
    expect(db.saved?.note).toContain("CLOUDFLARE_API_TOKEN");
    expect(queueRender).toHaveBeenCalled();
  });

  it("tries again when the background comes out wrong, and gives up on that slot after two", async () => {
    const { images } = provider([ok("light-oops"), ok("dark-cover"), ok("light-1"), ok("light-2")]);
    await generateArt(deps(images).deps, { versionId: "v-1" });
    expect(db.saved?.status).toBe("partial");
    expect(db.saved?.images.cover).toBeDefined();
    expect(db.saved?.images.cta).toBeUndefined();
    expect(db.saved?.note).toContain("fondo equivocado");
  });

  it("stops at the provider's limit and still renders", async () => {
    const limited: ImageResult = {
      ok: false,
      error: {
        kind: "rate_limited",
        message: "Cloudflare llegó al límite de uso",
        retryAfterMs: null,
      },
    };
    const { images, prompts } = provider([limited]);
    const { deps: d, queueRender } = deps(images);
    await generateArt(d, { versionId: "v-1" });
    expect(prompts).toHaveLength(1);
    expect(db.saved?.status).toBe("failed");
    expect(queueRender).toHaveBeenCalled();
  });

  it("reuses an earlier version's image when the prompt did not change", async () => {
    const first = provider([ok("dark-cover"), ok("dark-cta")]);
    await generateArt(deps(first.images).deps, { versionId: "v-1" });
    db.previous = Object.values(db.saved?.images ?? {}) as ArtImage[];
    db.version = { ...pending(), id: "v-2" };
    const second = provider([]);
    await generateArt(deps(second.images).deps, { versionId: "v-2" });
    expect(second.prompts).toHaveLength(0);
    expect(db.saved?.images.cover?.path).toBe("radev/post-1/v-1/art/cover.jpg");
  });

  it("respects the daily cap", async () => {
    db.today = 60;
    const { images, prompts } = provider([]);
    await generateArt(deps(images).deps, { versionId: "v-1" });
    expect(prompts).toHaveLength(0);
    expect(db.saved?.note).toContain("tope diario");
  });

  it("makes none for a brand that always uses its own element", async () => {
    db.tokens = {
      colors: { accent: "#6E5CE8" },
      heroAsset: "0b9f3c2e-4a1d-4c7b-9e2f-1a2b3c4d5e6f",
      heroAlways: true,
    };
    const { images, prompts } = provider([]);
    const { deps: d, queueRender } = deps(images);
    await generateArt(d, { versionId: "v-1" });
    expect(prompts).toHaveLength(0);
    expect(db.saved?.status).toBe("skipped");
    expect(queueRender).toHaveBeenCalled();
  });

  it("skips a look that takes no images", async () => {
    db.version = pending("recibo");
    await generateArt(deps(provider([]).images).deps, { versionId: "v-1" });
    expect(db.saved?.status).toBe("skipped");
  });
});

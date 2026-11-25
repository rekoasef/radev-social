import { describe, expect, it } from "vitest";
import {
  addHit,
  buildPool,
  CATEGORY_QUERIES,
  COMMONS_USER_AGENT,
  CommonsError,
  type CommonsHit,
  type CommonsPage,
  candidateFromHit,
  cleanTitle,
  createCommonsClient,
  curatedHits,
  curationView,
  imageCurationSchema,
  imageId,
  imageQueriesSchema,
  parseHit,
  rankHits,
  stripHtml,
  thumbExtension,
} from "../src";

const page = (
  over: Partial<CommonsPage> & { license?: string; width?: number; mime?: string } = {},
): CommonsPage => ({
  title: over.title ?? "File:Mona Lisa stolen-1911.jpg",
  index: over.index ?? 1,
  imageinfo: [
    {
      mime: over.mime ?? "image/jpeg",
      width: over.width ?? 1500,
      height: 2000,
      thumburl: "https://upload.wikimedia.org/thumb/1280px-Mona_Lisa_stolen-1911.jpg",
      descriptionurl: `https://commons.wikimedia.org/wiki/${over.title ?? "File:Mona_Lisa_stolen-1911.jpg"}`,
      extmetadata: {
        LicenseShortName: { value: over.license ?? "Public domain" },
        ImageDescription: { value: "La <b>Mona&nbsp;Lisa</b> &amp; el hueco &quot;vacío&quot;" },
        DateTimeOriginal: { value: "1911" },
        Artist: { value: '<a href="x">Roger-Viollet</a>' },
      },
    },
  ],
});

const hit = (page_: string, score = 10): CommonsHit => ({
  title: page_,
  description: "",
  date: "",
  author: "",
  license: "Public domain",
  page: page_,
  width: 1500,
  height: 1000,
  score,
  thumb: `https://x/${page_}.jpg`,
});

describe("parseHit", () => {
  it("accepts a public-domain JPEG and cleans the metadata", () => {
    const h = parseHit(page());
    expect(h).toMatchObject({
      title: "Mona Lisa stolen-1911",
      author: "Roger-Viollet",
      date: "1911",
      license: "Public domain",
      width: 1500,
      thumb: expect.stringContaining("1280px"),
    });
    expect(h?.description).toBe('La Mona&nbsp;Lisa & el hueco "vacío"');
  });

  it.each(["CC BY-NC 2.0", "CC BY-ND 4.0", "CC BY-NC-SA 3.0", "Fair use", ""])(
    "rejects the license «%s» (the channel will be monetized)",
    (license) => expect(parseHit(page({ license }))).toBeNull(),
  );

  it.each(["CC BY 2.0", "CC BY-SA 4.0", "CC0", "Public domain"])("accepts «%s»", (license) =>
    expect(parseHit(page({ license }))).not.toBeNull(),
  );

  it("rejects what is not a JPEG, PNG or WebP (SVG, PDF, TIFF)", () => {
    for (const mime of ["image/svg+xml", "application/pdf", "image/tiff"]) {
      expect(parseHit(page({ mime })), mime).toBeNull();
    }
  });

  it("rejects narrow images, except a pinned one down to 500 px", () => {
    expect(parseHit(page({ width: 640 }))).toBeNull();
    expect(parseHit(page({ width: 640 }), { minWidth: 500 })).not.toBeNull();
    expect(parseHit(page({ width: 400 }), { minWidth: 500 })).toBeNull();
  });

  it("rejects a page without image info or thumbnail", () => {
    expect(parseHit({ title: "File:x.jpg" })).toBeNull();
    const p = page();
    if (p.imageinfo?.[0]) p.imageinfo[0].thumburl = undefined;
    expect(parseHit(p)).toBeNull();
  });

  it("ranks the first results higher, big images and bonuses higher still", () => {
    const first = parseHit(page({ index: 1, width: 1500 }));
    const late = parseHit(page({ index: 25, width: 800 }));
    expect(first?.score).toBeGreaterThan(late?.score ?? 0);
    expect(parseHit(page({ index: 1 }), { bonus: 100 })?.score).toBe((first?.score ?? 0) + 100);
  });

  it("cleans titles and html", () => {
    expect(cleanTitle("File:Atget - Port du Louvre.jpg")).toBe("Atget - Port du Louvre");
    expect(stripHtml("<p>a  &amp; b</p>")).toBe("a & b");
    expect(stripHtml(undefined)).toBe("");
  });
});

describe("addHit and rankHits", () => {
  it("a result found again by another query goes up instead of repeating", () => {
    const hits = new Map<string, CommonsHit>();
    expect(addHit(hits, hit("a", 10))).toBe(true);
    expect(addHit(hits, hit("a", 5))).toBe(false);
    expect(hits.size).toBe(1);
    expect(hits.get("a")?.score).toBe(21);
  });

  it("keeps the best ones, from highest to lowest", () => {
    const ranked = rankHits([hit("a", 1), hit("b", 9), hit("c", 5)], 2);
    expect(ranked.map((h) => h.page)).toEqual(["b", "c"]);
  });
});

type Reply = { status?: number; body?: unknown; bytes?: string };
function fakeFetch(replies: Reply[]) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
    const r = replies[calls.length - 1] ?? replies.at(-1) ?? {};
    const status = r.status ?? 200;
    return new Response(r.bytes ?? JSON.stringify(r.body ?? {}), { status });
  }) as typeof fetch;
  return { impl, calls };
}
const pages = (...ps: CommonsPage[]) => ({
  query: { pages: Object.fromEntries(ps.map((p, i) => [String(i), p])) },
});

function client(replies: Reply[]) {
  const sleeps: number[] = [];
  const f = fakeFetch(replies);
  const c = createCommonsClient({
    fetch: f.impl,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { c, calls: f.calls, sleeps };
}

describe("createCommonsClient", () => {
  it("searches files with the standard 1280 px thumbnail and a generic user agent", async () => {
    const { c, calls } = client([{ body: pages(page()) }]);
    const hits = await c.searchFiles("Mona Lisa theft");
    expect(hits).toHaveLength(1);
    const url = new URL(calls[0]?.url ?? "");
    expect(url.searchParams.get("gsrsearch")).toBe("Mona Lisa theft");
    expect(url.searchParams.get("gsrnamespace")).toBe("6");
    expect(url.searchParams.get("iiurlwidth")).toBe("1280");
    expect(url.searchParams.get("format")).toBe("json");
    expect(calls[0]?.headers["User-Agent"]).toBe(COMMONS_USER_AGENT);
    expect(COMMONS_USER_AGENT).not.toMatch(/@|renzo|radevelopment/i);
  });

  it("filters out the results whose license or format cannot be used", async () => {
    const { c } = client([
      { body: pages(page(), page({ title: "File:nc.jpg", license: "CC BY-NC 2.0" })) },
    ]);
    expect(await c.searchFiles("x")).toHaveLength(1);
  });

  it("pauses before every call and backs off 15 s, 30 s… after a 429", async () => {
    const { c, sleeps } = client([{ status: 429 }, { status: 429 }, { body: pages(page()) }]);
    expect(await c.searchFiles("x")).toHaveLength(1);
    expect(sleeps).toEqual([1500, 15_000, 30_000]);
  });

  it("gives up after 4 tries with the last status", async () => {
    const { c, calls } = client([{ status: 429 }]);
    await expect(c.searchFiles("x")).rejects.toMatchObject({ name: "CommonsError", status: 429 });
    expect(calls).toHaveLength(4);
  });

  it("refuses a response with an unexpected shape", async () => {
    const { c } = client([{ body: { query: { pages: "nope" } } }]);
    await expect(c.searchFiles("x")).rejects.toBeInstanceOf(CommonsError);
  });

  it("an empty answer (no results) is not an error", async () => {
    const { c } = client([{ body: { batchcomplete: "" } }]);
    expect(await c.searchFiles("nada")).toEqual([]);
  });

  it("looks for the files of the two best categories", async () => {
    const cat = (t: string) => ({ title: t });
    const { c, calls } = client([
      {
        body: {
          query: {
            pages: { a: cat("Category:Theft of the Mona Lisa"), b: cat("Category:Mona Lisa") },
          },
        },
      },
      { body: pages(page({ title: "File:one.jpg" })) },
      { body: pages(page({ title: "File:two.jpg" })) },
    ]);
    const hits = await c.searchCategoryFiles("Mona Lisa theft");
    expect(hits.map((h) => h.title)).toEqual(["one", "two"]);
    expect(new URL(calls[1]?.url ?? "").searchParams.get("gcmtitle")).toBe(
      "Category:Theft of the Mona Lisa",
    );
  });

  it("finds a file by name, accepting a smaller image", async () => {
    const { c, calls } = client([{ body: pages(page({ width: 600 })) }]);
    const h = await c.fileByTitle("Pared vacía.jpg");
    expect(new URL(calls[0]?.url ?? "").searchParams.get("titles")).toBe("File:Pared vacía.jpg");
    expect(h?.width).toBe(600);
  });

  it("downloads with a pause and retries", async () => {
    const { c, sleeps } = client([{ status: 429 }, { bytes: "JPEGDATA" }]);
    const bytes = await c.download("https://x/a.jpg");
    expect(bytes.toString()).toBe("JPEGDATA");
    expect(sleeps).toEqual([3000, 20_000]);
  });
});

describe("buildPool", () => {
  const fake = () => {
    const log: string[] = [];
    return {
      log,
      client: {
        async searchFiles(q: string) {
          log.push(`files:${q}`);
          return [hit(`https://c/${q}`, 5), hit("https://c/shared", 5)];
        },
        async searchCategoryFiles(q: string) {
          log.push(`cats:${q}`);
          return [hit(`https://c/cat-${q}`, 13)];
        },
        async fileByTitle(t: string) {
          log.push(`pin:${t}`);
          return t === "missing.jpg" ? null : hit(`https://c/pin-${t}`, 100);
        },
      },
    };
  };
  const queries = Array.from({ length: 12 }, (_, i) => `q${i}`);

  it("searches categories only for the first 10 queries (the central fact)", async () => {
    const { client: c, log } = fake();
    await buildPool(c, { queries });
    expect(log.filter((l) => l.startsWith("cats:"))).toHaveLength(CATEGORY_QUERIES);
    expect(log).not.toContain("cats:q10");
  });

  it("puts what several queries found on top, and the pinned images first of all", async () => {
    const { client: c } = fake();
    const pool = await buildPool(c, {
      queries: queries.slice(0, 3),
      pins: ["boy.jpg", "missing.jpg"],
    });
    expect(pool[0]?.page).toBe("https://c/pin-boy.jpg");
    expect(pool[1]?.page).toBe("https://c/shared");
    expect(pool.some((h) => h.page.includes("missing"))).toBe(false);
  });

  it("reports its progress in Spanish", async () => {
    const { client: c } = fake();
    const messages: string[] = [];
    await buildPool(c, { queries: ["q0"], pins: ["missing.jpg"] }, (m) => messages.push(m));
    expect(messages).toEqual([
      "«q0»: 2 nuevas + 1 de categorías",
      "fijada «missing.jpg»: no existe o no sirve (licencia o tamaño)",
    ]);
  });
});

describe("curation", () => {
  const pool = [hit("a"), hit("b"), hit("c")];

  it("keeps the chosen ones without repeats or numbers that do not exist", () => {
    expect(curatedHits(pool, [2, 0, 2, 9]).map((h) => h.page)).toEqual(["c", "a"]);
  });

  it("shows the curator only short text", () => {
    const long = { ...hit("a"), description: "x".repeat(500) };
    expect(curationView([long])[0]?.description).toHaveLength(100);
    expect(Object.keys(curationView([long])[0] ?? {})).toEqual([
      "n",
      "title",
      "description",
      "date",
    ]);
  });

  it("validates what the AI returns", () => {
    expect(imageQueriesSchema.safeParse({ queries: Array(10).fill("Mona Lisa") }).success).toBe(
      true,
    );
    expect(imageQueriesSchema.safeParse({ queries: ["x"] }).success).toBe(false);
    expect(
      imageCurationSchema.safeParse({ keep: Array.from({ length: 30 }, (_, i) => i) }).success,
    ).toBe(true);
    expect(imageCurationSchema.safeParse({ keep: [1, 2] }).success).toBe(false);
  });
});

describe("candidates", () => {
  it("builds ids the script accepts and a candidate without the search internals", () => {
    expect(imageId(1)).toBe("i01");
    expect(imageId(34)).toBe("i34");
    expect(/^i\d{2,3}$/.test(imageId(120))).toBe(true);
    const c = candidateFromHit(hit("a", 50), "i01", "img/i01.jpg", { width: 1280, height: 1700 });
    expect(c).toMatchObject({ id: "i01", file: "img/i01.jpg", width: 1280, height: 1700 });
    expect(c).not.toHaveProperty("score");
    expect(c).not.toHaveProperty("thumb");
  });

  it("takes the extension of the thumbnail", () => {
    expect(thumbExtension("https://x/1280px-a.PNG")).toBe("png");
    expect(thumbExtension("https://x/a.webp?x=1")).toBe("webp");
    expect(thumbExtension("https://x/a.jpeg")).toBe("jpg");
    expect(thumbExtension("https://x/a")).toBe("jpg");
  });
});

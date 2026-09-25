import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  checkAssetFile,
  isBrandDocumentKind,
  MAX_BRAND_DOCUMENT_CHARS,
  normalizeBrandDocument,
  SERIES_BRIEF_MAX,
  SERIES_BRIEF_MIN,
  SERIES_REQUIRED_SLIDES_MAX,
} from "@radev/core";
import { HOOK_TYPES, parseTheme, SLIDE_TYPES } from "@radev/slides";
import { describe, expect, it } from "vitest";
import {
  pendingSeedAssets,
  pendingSeedDocuments,
  type SeedAsset,
  seedBrandAssets,
  seedBrands,
  seedPillars,
  seedSeries,
} from "./brands";

describe("seed brands", () => {
  it.each(seedBrands.map((brand) => [brand.slug, brand] as const))(
    "%s has tokens that match its preset exactly",
    (_, brand) => {
      const result = parseTheme(brand.stylePreset, brand.themeTokens);
      expect(result.ok ? [] : result.issues).toEqual([]);
      // No field left to defaults: the seed spells out every brand value.
      expect(result.ok && result.theme.tokens).toEqual(brand.themeTokens);
    },
  );
});

describe("seed brand assets", () => {
  const planned = Object.entries(seedBrandAssets).flatMap(([slug, assets]) =>
    assets.map((asset) => [`${slug}/${asset.file}`, slug, asset] as const),
  );

  it.each(planned)("%s is an accepted image linked to an asset token", (_, slug, asset) => {
    const file = new URL(`../../../../seeds/brands/${slug}/assets/${asset.file}`, import.meta.url);
    expect(checkAssetFile(readFileSync(fileURLToPath(file))).ok).toBe(true);
    const brand = seedBrands.find((b) => b.slug === slug);
    expect(brand?.themeTokens).toHaveProperty(asset.token, null);
  });

  const hero: SeedAsset = { file: "orb.png", role: "hero", token: "heroAsset" };
  const logo: SeedAsset = { file: "logo.png", role: "logo", token: "logoAsset" };
  const id = "0b9f3c2e-4a1d-4c7b-9e2f-1a2b3c4d5e6f";

  it("links everything on a fresh brand", () => {
    expect(pendingSeedAssets([hero, logo], { heroAsset: null, logoAsset: null }, [])).toEqual([
      hero,
      logo,
    ]);
  });

  it("adds nothing on a second run", () => {
    expect(
      pendingSeedAssets([hero, logo], { heroAsset: id, logoAsset: id }, ["hero", "logo"]),
    ).toEqual([]);
  });

  it("keeps a token the operator already set", () => {
    expect(pendingSeedAssets([hero, logo], { heroAsset: id, logoAsset: null }, [])).toEqual([logo]);
  });

  it("does not add a file for a role the brand already has", () => {
    expect(pendingSeedAssets([hero, logo], { heroAsset: null, logoAsset: null }, ["logo"])).toEqual(
      [hero],
    );
  });
});

describe("seed pillars", () => {
  it.each(Object.entries(seedPillars))(
    "%s: valid keys and a mix that adds up to 100%%",
    (slug, pillars) => {
      expect(seedBrands.some((b) => b.slug === slug)).toBe(true);
      for (const p of pillars) expect(p.key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      const total = pillars.reduce((sum, p) => sum + (p.targetShare ?? 0), 0);
      expect(total).toBeCloseTo(1, 5);
    },
  );
});

describe("seed series", () => {
  const cases = Object.entries(seedSeries).flatMap(([slug, list]) =>
    list.map((series) => [`${slug}/${series.key}`, slug, series] as const),
  );

  it.each(cases)("%s: valid key, pillar, hook, slides and brief", (_, slug, series) => {
    expect(series.key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    if (series.pillarKey) {
      expect(seedPillars[slug]?.map((p) => p.key)).toContain(series.pillarKey);
    }
    if (series.hookType) expect(HOOK_TYPES).toContain(series.hookType);
    expect(series.requiredSlides.length).toBeLessThanOrEqual(SERIES_REQUIRED_SLIDES_MAX);
    for (const type of series.requiredSlides) expect(SLIDE_TYPES).toContain(type);
    const brief = readFileSync(
      fileURLToPath(
        new URL(`../../../../seeds/brands/${slug}/series/${series.key}.md`, import.meta.url),
      ),
      "utf8",
    ).trim();
    expect(brief.length).toBeGreaterThanOrEqual(SERIES_BRIEF_MIN);
    expect(brief.length).toBeLessThanOrEqual(SERIES_BRIEF_MAX);
  });
});

describe("seed brand documents", () => {
  const files = seedBrands.flatMap(({ slug }) => {
    const dir = fileURLToPath(new URL(`../../../../seeds/brands/${slug}/`, import.meta.url));
    return readdirSync(dir)
      .filter((file) => file.endsWith(".md"))
      .map((file) => [`${slug}/${file}`, `${dir}${file}`, file.slice(0, -3)] as const);
  });

  it("finds the documents of both brands", () => {
    expect(files.map(([name]) => name)).toEqual(
      expect.arrayContaining(["radev/voice.md", "radev/pricing.md", "lumus/voice.md"]),
    );
  });

  it.each(files)("%s is a known kind, not empty and within the size limit", (_, path, kind) => {
    expect(isBrandDocumentKind(kind)).toBe(true);
    const content = normalizeBrandDocument(readFileSync(path, "utf8"));
    expect(content).not.toBe("");
    expect([...content].length).toBeLessThanOrEqual(MAX_BRAND_DOCUMENT_CHARS);
  });

  it("only loads kinds the brand doesn't have yet", () => {
    expect(pendingSeedDocuments(["voice", "rules"], [])).toEqual(["voice", "rules"]);
    expect(pendingSeedDocuments(["voice", "rules"], ["voice"])).toEqual(["rules"]);
    expect(pendingSeedDocuments(["voice"], ["voice", "pricing"])).toEqual([]);
  });
});

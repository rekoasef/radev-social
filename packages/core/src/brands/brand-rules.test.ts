import { describe, expect, it } from "vitest";
import {
  CODE_PREFIX_PATTERN,
  canChangeCodePrefix,
  canDeleteBrand,
  SLUG_MAX,
  SLUG_PATTERN,
  slugify,
} from "./brand-rules";

describe("slugify", () => {
  it.each([
    ["RAdev", "radev"],
    ["Café Ñandú 2", "cafe-nandu-2"],
    ["  Lumus — gastos  ", "lumus-gastos"],
    ["¿Qué onda?", "que-onda"],
    ["a__b..c", "a-b-c"],
    ["!!!", ""],
  ])("%j → %j", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it("always gives a valid slug (or nothing) within the length limit", () => {
    const long = slugify("una marca con un nombre larguísimo que no entra en el límite de largo");
    expect(long.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(long).toMatch(SLUG_PATTERN);
  });
});

describe("formats", () => {
  it("code prefixes are 2 to 4 capitals", () => {
    expect(CODE_PREFIX_PATTERN.test("RA")).toBe(true);
    expect(CODE_PREFIX_PATTERN.test("LUMU")).toBe(true);
    expect(CODE_PREFIX_PATTERN.test("R")).toBe(false);
    expect(CODE_PREFIX_PATTERN.test("ra")).toBe(false);
    expect(CODE_PREFIX_PATTERN.test("RAD3")).toBe(false);
  });
});

describe("brand rules", () => {
  it("deletes only brands without posts", () => {
    expect(canDeleteBrand(0).ok).toBe(true);
    expect(canDeleteBrand(1)).toMatchObject({ ok: false });
  });

  it("changes the code prefix only while there are no posts", () => {
    expect(canChangeCodePrefix(0).ok).toBe(true);
    expect(canChangeCodePrefix(3)).toMatchObject({ ok: false });
  });
});

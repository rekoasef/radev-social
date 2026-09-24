import { carouselSchema, exampleCarousel } from "@radev/slides";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formatIssues, parseJsonText, parseOutput, toJsonSchema } from "./schema";

const idea = z.object({ title: z.string().max(60), angle: z.string().optional() });

describe("toJsonSchema", () => {
  it("describes the object without the $schema header", () => {
    const json = toJsonSchema(idea);
    expect(json.$schema).toBeUndefined();
    expect(json).toMatchObject({ type: "object", required: ["title"] });
  });

  it("converts the full carousel schema (the one carousel.generate will ask for)", () => {
    const json = toJsonSchema(carouselSchema);
    expect(json.type).toBe("object");
    expect(JSON.stringify(json)).toContain('"cover"');
    expect(JSON.stringify(json)).toContain('"hubDiagram"');
  });
});

describe("parseOutput", () => {
  it("returns the data when it matches", () => {
    const result = parseOutput(carouselSchema, exampleCarousel);
    expect(result.ok).toBe(true);
  });

  it("returns a validation error with readable issues", () => {
    const result = parseOutput(idea, { title: "x".repeat(61), angle: 3 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("validation");
    if (result.error.kind !== "validation") return;
    expect(result.error.issues).toHaveLength(2);
    expect(result.error.issues.some((i) => i.startsWith("title › "))).toBe(true);
  });

  it("enforces refinements the JSON Schema can't express (cover first, cta last)", () => {
    const [cover, ...rest] = exampleCarousel.slides;
    const swapped = { ...exampleCarousel, slides: [...rest, cover] };
    expect(parseOutput(carouselSchema, swapped).ok).toBe(false);
  });
});

describe("parseJsonText", () => {
  it("finds the JSON inside prose or a code fence", () => {
    const text = 'Acá va:\n```json\n{"title":"Hola"}\n```\nListo.';
    expect(parseJsonText(idea, text)).toEqual({ ok: true, data: { title: "Hola" } });
  });

  it("reports text without JSON, or broken JSON, as a validation error", () => {
    for (const text of ["sin json", '{"title": }']) {
      const result = parseJsonText(idea, text);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe("validation");
    }
  });
});

describe("formatIssues", () => {
  it("joins nested paths", () => {
    const schema = z.object({ slides: z.array(z.object({ title: z.string() })) });
    const parsed = schema.safeParse({ slides: [{ title: 1 }] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(formatIssues(parsed.error)[0]).toMatch(/^slides\.0\.title › /);
  });
});

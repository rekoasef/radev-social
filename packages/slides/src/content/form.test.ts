import { describe, expect, it } from "vitest";
import { exampleSlides } from "./examples";
import { EDITOR_MIDDLE_TYPES, emptySlide, type FieldSpec, SLIDE_FIELDS } from "./form";
import { SLIDE_TYPES, slideSchema } from "./slides";

/** Keys of an example slide, recursively, as "a.b" paths (lists by their first item). */
function keys(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return typeof value[0] === "object" ? keys(value[0], prefix) : [prefix];
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) =>
      k === "type" ? [] : keys(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

function specKeys(fields: FieldSpec[], prefix = ""): string[] {
  return fields.flatMap((f) => {
    const path = prefix ? `${prefix}.${f.key}` : f.key;
    if (f.kind === "object") return specKeys(f.fields, path);
    if (f.kind === "list") return f.item === "rich" ? [path] : specKeys(f.item, path);
    return [path];
  });
}

describe("slide form spec", () => {
  it.each(SLIDE_TYPES)("%s covers every field of its example", (type) => {
    expect(specKeys(SLIDE_FIELDS[type]).sort()).toEqual(
      expect.arrayContaining(keys(exampleSlides[type]).sort()),
    );
    // …and nothing the schema does not know: the example with every spec field is still valid.
    expect(slideSchema.safeParse(exampleSlides[type]).success).toBe(true);
  });

  it.each(SLIDE_TYPES)(
    "%s: a new empty slide has the schema's shape (only texts missing)",
    (type) => {
      const result = slideSchema.safeParse(emptySlide(type));
      const problems = result.success ? [] : result.error.issues.map((i) => i.message);
      // Empty texts are the only thing to fill in.
      for (const message of problems)
        expect(message).toMatch(/vacío|dataset|caracteres|minúsculas/i);
    },
  );

  it("offers every type in the editor but cover and cta", () => {
    expect([...EDITOR_MIDDLE_TYPES].sort()).toEqual(
      SLIDE_TYPES.filter((t) => !["cover", "cta"].includes(t)).sort(),
    );
  });
});

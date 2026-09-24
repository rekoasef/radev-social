import { describe, expect, it } from "vitest";
import { exampleSlidesByPreset } from "./examples";
import { isMoved, layerAdjust, slideLayoutSchema, withLayer } from "./layout";
import { slideSchema } from "./slides";

describe("slide layout (ADR 0013)", () => {
  it("is optional on every slide", () => {
    for (const slide of Object.values(exampleSlidesByPreset.bold)) {
      expect(slideSchema.safeParse(slide).success, slide.type).toBe(true);
      expect(
        slideSchema.safeParse({ ...slide, layout: { title: { x: 0, y: 120, scale: 1.1 } } })
          .success,
        slide.type,
      ).toBe(true);
    }
  });

  it("keeps offsets and sizes in range", () => {
    expect(slideLayoutSchema.safeParse({ title: { x: 2000, y: 0 } }).success).toBe(false);
    expect(slideLayoutSchema.safeParse({ title: { x: 1.5, y: 0 } }).success).toBe(false);
    expect(slideLayoutSchema.safeParse({ title: { x: 0, y: 0, scale: 3 } }).success).toBe(false);
    expect(slideLayoutSchema.safeParse({ hero: { x: 0, y: 0, scale: 2 } }).success).toBe(true);
    expect(slideLayoutSchema.safeParse({ hero: { x: 0, y: 0, scale: 0.2 } }).success).toBe(false);
  });

  it("only knows the three layers", () => {
    expect(slideLayoutSchema.safeParse({ footer: { x: 0, y: 0 } }).success).toBe(false);
  });

  it("gives an untouched layer no offset", () => {
    expect(layerAdjust(undefined, "hero")).toEqual({ x: 0, y: 0 });
    expect(isMoved({ x: 0, y: 0 })).toBe(false);
    expect(isMoved({ x: 0, y: 0, scale: 1 })).toBe(false);
    expect(isMoved({ x: 0, y: 3 })).toBe(true);
  });

  it("stores only what moved, rounded", () => {
    const layout = withLayer(undefined, "title", { x: 10.4, y: -3.6, scale: 1.234 });
    expect(layout).toEqual({ title: { x: 10, y: -4, scale: 1.23 } });
    expect(withLayer(layout, "body", { x: 5, y: 0, scale: 2 })).toEqual({
      title: { x: 10, y: -4, scale: 1.23 },
      body: { x: 5, y: 0 },
    });
    // Back to the template's position: nothing left to store.
    expect(withLayer(layout, "title", { x: 0, y: 0 })).toBeUndefined();
    expect(withLayer(layout, "title", null)).toBeUndefined();
  });
});

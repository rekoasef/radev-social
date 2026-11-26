import { describe, expect, it } from "vitest";
import { PHOTO_SIZE, place, showsWhole } from "./framing";

const all = { cx: 0.5, cy: 0.5, vw: 1 };
const half = { cx: 0.5, cy: 0.5, vw: 0.5 };
// the crew photo of the first real video: 1280×850
const crew = 850 / 1280;

describe("showsWhole", () => {
  it("covers the frame by default, also with the usual zoom from the whole photo to half", () => {
    expect(showsWhole(all, half, crew, "9x16")).toBe(false);
    expect(showsWhole(all, half, 0.66, "16x9")).toBe(false);
  });

  it("shows the photo whole in the Short when the script asks", () => {
    expect(showsWhole(all, half, crew, "9x16", true)).toBe(true);
  });

  it("shows a panorama whole even unasked: covering would leave a sliver", () => {
    expect(showsWhole(all, { cx: 0.5, cy: 0.5, vw: 0.6 }, 0.19, "9x16")).toBe(true);
  });

  it("never for a photo that already fills the frame", () => {
    expect(showsWhole(all, half, 1.9, "9x16", true)).toBe(false);
    expect(showsWhole(all, half, 0.5, "16x9", true)).toBe(false);
  });

  it("asked, a portrait goes whole in the normal video", () => {
    expect(showsWhole(all, { cx: 0.5, cy: 0.4, vw: 0.8 }, 1.4, "16x9", true)).toBe(true);
  });
});

describe("place", () => {
  it("covers the frame by default", () => {
    const p = place(all, 0.66, "9x16");
    expect(p.dh).toBeGreaterThanOrEqual(PHOTO_SIZE["9x16"].height - 0.01);
    expect(p.dw).toBeGreaterThan(PHOTO_SIZE["9x16"].width);
  });

  it("whole: fits the width and centers the band in the Short", () => {
    const p = place(all, 0.66, "9x16", true);
    expect(p.dw).toBeCloseTo(1080);
    expect(p.top).toBeCloseTo((1920 - p.dh) / 2);
    expect(p.left).toBeCloseTo(0);
  });

  it("whole: fits the height and centers the column in the normal video", () => {
    const p = place(all, 1.4, "16x9", true);
    expect(p.dh).toBeCloseTo(1080);
    expect(p.left).toBeCloseTo((1920 - p.dw) / 2);
  });

  it("whole still zooms: a smaller vw shows a bigger image", () => {
    const wide = place(all, 0.66, "9x16", true);
    const close = place({ cx: 0.5, cy: 0.5, vw: 0.8 }, 0.66, "9x16", true);
    expect(close.dw).toBeGreaterThan(wide.dw);
  });
});

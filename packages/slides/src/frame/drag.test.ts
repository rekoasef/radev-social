import { describe, expect, it } from "vitest";
import { GUIDES, moveBox, resizeBox, SNAP_DISTANCE, scaleBox } from "./drag";

// A 400×200 box in the middle of the safe area.
const box = { left: 300, top: 500, right: 700, bottom: 700 };

describe("moveBox", () => {
  it("moves freely away from guides", () => {
    expect(moveBox(box, 17, -60)).toEqual({ dx: 17, dy: -60, guides: {} });
  });

  it("snaps the center to the middle of the slide", () => {
    // Box center is 500; 540 - 500 = 40, dragging 35 lands 5 short and snaps.
    const moved = moveBox(box, 35, 0);
    expect(moved.dx).toBe(40);
    expect(moved.guides.x).toBe(GUIDES.x[1]);
  });

  it("snaps an edge to the safe margin", () => {
    const moved = moveBox(box, -210, 0); // left would be 90, margin is 80
    expect(moved.dx).toBe(-220);
    expect(moved.guides.x).toBe(80);
  });

  it("does not snap beyond the snap distance or when turned off", () => {
    expect(moveBox(box, 40 - SNAP_DISTANCE - 2, 0).guides.x).toBeUndefined();
    expect(moveBox(box, 35, 0, false)).toEqual({ dx: 35, dy: 0, guides: {} });
  });

  it("never leaves the safe area", () => {
    expect(moveBox(box, -900, 0).dx).toBe(-220); // left stops at 80
    expect(moveBox(box, 900, 0).dx).toBe(300); // right stops at 1000
    expect(moveBox(box, 0, -900).dy).toBe(-420); // top stops at 80
    expect(moveBox(box, 0, 900).dy).toBe(550); // bottom stops at 1250
    expect(moveBox(box, -900, 0).guides.x).toBeUndefined();
  });

  it("pins a box wider than the safe area to its left margin", () => {
    const wide = { left: 50, top: 100, right: 1030, bottom: 200 };
    expect(moveBox(wide, 100, 0, false).dx).toBe(30);
  });
});

describe("scaleBox and resizeBox", () => {
  it("scales around the center", () => {
    expect(scaleBox(box, 2)).toEqual({ left: 100, top: 400, right: 900, bottom: 800 });
  });

  it("keeps the requested scale when it fits", () => {
    expect(resizeBox(box, 1, 1.5)).toEqual({ scale: 1.5, dx: 0, dy: 0 });
  });

  it("shifts a scaled box back inside the safe area", () => {
    const nearTop = { left: 400, top: 100, right: 600, bottom: 300 };
    // ×1.5 around its center → top at 50: pushed down 30.
    expect(resizeBox(nearTop, 1, 1.5)).toEqual({ scale: 1.5, dx: 0, dy: 30 });
  });

  it("caps the scale at what fits the safe area", () => {
    // 400 wide at scale 1; the safe area is 920 wide: at most 2.3.
    expect(resizeBox(box, 1, 3).scale).toBeCloseTo(2.3);
  });

  it("measures from the current scale", () => {
    // Drawn at 2× (800 wide): going to 1× gives back the 400 box.
    expect(resizeBox(scaleBox(box, 2), 2, 1)).toEqual({ scale: 1, dx: 0, dy: 0 });
  });
});

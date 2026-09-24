import { describe, expect, it } from "vitest";
import { isInSafeZone, type Rect } from "../../frame/geometry";
import { BOLD_CONTENT_BOX } from "../bold/frame";
import { cardGridRows, flowLayout, hubLayout } from "./layout";

const W = BOLD_CONTENT_BOX.width;

const inside = (box: Rect, width: number) => box.x >= 0 && box.y >= 0 && box.x + box.width <= width;

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("BOLD_CONTENT_BOX", () => {
  it("respects the safe zones at every height, TikTok's button column included", () => {
    expect(isInSafeZone(BOLD_CONTENT_BOX)).toBe(true);
  });
});

describe("cardGridRows", () => {
  it("splits 3–6 cards into balanced rows", () => {
    expect(cardGridRows(3)).toEqual([3]);
    expect(cardGridRows(4)).toEqual([2, 2]);
    expect(cardGridRows(5)).toEqual([3, 2]);
    expect(cardGridRows(6)).toEqual([3, 3]);
  });
});

describe("flowLayout", () => {
  it.each([3, 4, 5])("keeps %i cards inside the box, without overlaps", (count) => {
    const layout = flowLayout(count, W);
    expect(layout.cards).toHaveLength(count);
    for (const [i, card] of layout.cards.entries()) {
      expect(inside(card, W)).toBe(true);
      for (const other of layout.cards.slice(i + 1)) expect(overlap(card, other)).toBe(false);
    }
  });

  it("uses one row up to 4 nodes and two (3 + 2) with 5", () => {
    expect(new Set(flowLayout(4, W).cards.map((c) => c.y)).size).toBe(1);
    const five = flowLayout(5, W).cards.map((c) => c.y);
    expect(five.filter((y) => y === 0)).toHaveLength(3);
    expect(five.filter((y) => y > 0)).toHaveLength(2);
  });

  it("uses shorter, closer cards for a row of 4 (ref-flow-2)", () => {
    const [four] = flowLayout(4, W).cards;
    const [three] = flowLayout(3, W).cards;
    expect(four && three && four.height < three.height).toBe(true);
    expect(four && four.width > (W - 3 * 44) / 4).toBe(true);
  });

  it("joins each card with the next one", () => {
    const layout = flowLayout(5, W);
    expect(layout.connectors).toHaveLength(4);
    for (const [i, points] of layout.connectors.entries()) {
      const from = layout.cards[i] as Rect;
      const to = layout.cards[i + 1] as Rect;
      const first = points[0];
      const last = points[points.length - 1];
      // Starts on the edge of card i and ends on the edge of card i + 1.
      expect(first && (first.x === from.x + from.width || first.y === from.y + from.height)).toBe(
        true,
      );
      expect(last && (last.x === to.x || last.y === to.y)).toBe(true);
    }
  });
});

describe("hubLayout", () => {
  it.each([3, 4, 5, 6])(
    "keeps %i chips and the center inside the box, without overlaps",
    (count) => {
      const layout = hubLayout(count, W);
      expect(layout.chips).toHaveLength(count);
      const boxes = [layout.center, ...layout.chips.map((chip) => chip.box)];
      for (const [i, box] of boxes.entries()) {
        expect(inside(box, W)).toBe(true);
        expect(box.y + box.height).toBeLessThanOrEqual(layout.height);
        for (const other of boxes.slice(i + 1)) expect(overlap(box, other)).toBe(false);
      }
    },
  );

  it("points every connector at the center", () => {
    const { center, chips } = hubLayout(6, W);
    for (const { to } of chips) {
      const nearX = to.x >= center.x - 20 && to.x <= center.x + center.width + 20;
      const nearY = to.y >= center.y - 20 && to.y <= center.y + center.height + 20;
      expect(nearX && nearY).toBe(true);
    }
  });

  it("rejects counts outside 3–6", () => {
    expect(() => hubLayout(2, W)).toThrow();
    expect(() => hubLayout(7, W)).toThrow();
  });
});

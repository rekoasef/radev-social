import type { Rect } from "../../frame/geometry";

// Geometry of the `bold` diagrams, as pure functions so tests can check that nothing leaves the
// content box. Coordinates are relative to the diagram's own box, which is `width` wide.

/** Cards per row in `cardGrid`: 3 → 3 · 4 → 2+2 · 5 → 3+2 · 6 → 3+3. */
export function cardGridRows(count: number): number[] {
  if (count <= 3) return [count];
  if (count === 4) return [2, 2];
  return [3, count - 3];
}

export type Point = { x: number; y: number };

export type FlowLayout = {
  width: number;
  height: number;
  cards: Rect[];
  /** One polyline per connector, from card i to card i + 1. */
  connectors: Point[][];
};

const FLOW_CARD_HEIGHT = 200;
const FLOW_GAP = 44;
const FLOW_ROW_GAP = 64;
/** Four in a row leave narrow cards: shorter ones, closer together (like ref-flow-2). */
const FLOW_COMPACT = { height: 164, gap: 32 };

/** Whether `flow` uses its compact cards (four in one row). */
export const isCompactFlow = (count: number) => count === 4;

/**
 * `flow`: up to 4 nodes in one row. With 5, two rows (3 + 2, the second one centered) read left
 * to right; the connector leaves the third card from below, runs through the gap between rows
 * and enters the fourth card from above.
 */
export function flowLayout(count: number, width: number): FlowLayout {
  const perRow = count <= 4 ? count : 3;
  const compact = isCompactFlow(count);
  const gap = compact ? FLOW_COMPACT.gap : FLOW_GAP;
  const cardHeight = compact ? FLOW_COMPACT.height : FLOW_CARD_HEIGHT;
  const cardWidth = (width - (perRow - 1) * gap) / perRow;
  const cards: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const row = i < perRow ? 0 : 1;
    const inRow = row === 0 ? perRow : count - perRow;
    const col = row === 0 ? i : i - perRow;
    const rowWidth = inRow * cardWidth + (inRow - 1) * gap;
    const offset = (width - rowWidth) / 2;
    cards.push({
      x: offset + col * (cardWidth + gap),
      y: row * (cardHeight + FLOW_ROW_GAP),
      width: cardWidth,
      height: cardHeight,
    });
  }

  const connectors: Point[][] = [];
  for (let i = 0; i < count - 1; i++) {
    const a = cards[i] as Rect;
    const b = cards[i + 1] as Rect;
    if (a.y === b.y) {
      const y = a.y + a.height / 2;
      connectors.push([
        { x: a.x + a.width, y },
        { x: b.x, y },
      ]);
    } else {
      const fromX = a.x + a.width / 2;
      const toX = b.x + b.width / 2;
      const midY = a.y + a.height + FLOW_ROW_GAP / 2;
      connectors.push([
        { x: fromX, y: a.y + a.height },
        { x: fromX, y: midY },
        { x: toX, y: midY },
        { x: toX, y: b.y },
      ]);
    }
  }

  const last = cards[cards.length - 1] as Rect;
  return { width, height: last.y + last.height, cards, connectors };
}

export type HubSlot =
  | "top"
  | "upperLeft"
  | "upperRight"
  | "midLeft"
  | "midRight"
  | "lowerLeft"
  | "lowerRight"
  | "bottom";

export type HubLayout = {
  width: number;
  height: number;
  center: Rect;
  chips: { slot: HubSlot; box: Rect; from: Point; to: Point }[];
};

export const HUB_CHIP = { width: 290, height: 84 };
const HUB_CENTER = 120;

const HUB_SLOTS: Record<number, HubSlot[]> = {
  3: ["top", "midLeft", "midRight"],
  4: ["upperLeft", "upperRight", "lowerLeft", "lowerRight"],
  5: ["top", "upperLeft", "upperRight", "lowerLeft", "lowerRight"],
  6: ["top", "upperLeft", "upperRight", "lowerLeft", "lowerRight", "bottom"],
};

/**
 * `hubDiagram`: chips in fixed slots around the center (5 nodes match ref-hubdiagram: one on
 * top, two per side). Each connector runs from the chip's inner edge to the center's edge.
 */
export function hubLayout(count: number, width: number): HubLayout {
  const slots = HUB_SLOTS[count];
  if (!slots) throw new Error(`hubDiagram admite de 3 a 6 nodos, no ${count}.`);
  const hasTop = slots.includes("top");
  const { width: cw, height: ch } = HUB_CHIP;

  // Vertical bands: top chip, then the center with the side chips around it, then bottom chip.
  const bandTop = hasTop ? ch + 56 : 0;
  const cx = width / 2;
  const spread = 100; // vertical distance from the center to the side chips' outer edge
  const cy = bandTop + spread;
  const center: Rect = {
    x: cx - HUB_CENTER / 2,
    y: cy - HUB_CENTER / 2,
    width: HUB_CENTER,
    height: HUB_CENTER,
  };
  const sideTopY = cy - spread;
  const sideBottomY = cy + spread - ch;
  const indent = 30;

  const boxes: Record<HubSlot, Rect> = {
    top: { x: cx - cw / 2, y: 0, width: cw, height: ch },
    upperLeft: { x: 0, y: sideTopY, width: cw, height: ch },
    upperRight: { x: width - cw, y: sideTopY, width: cw, height: ch },
    midLeft: { x: 0, y: cy - ch / 2, width: cw, height: ch },
    midRight: { x: width - cw, y: cy - ch / 2, width: cw, height: ch },
    lowerLeft: { x: indent, y: sideBottomY, width: cw, height: ch },
    lowerRight: { x: width - cw - indent, y: sideBottomY, width: cw, height: ch },
    // Below the lower side chips, so it never touches them.
    bottom: { x: cx - cw / 2, y: sideBottomY + ch + 30, width: cw, height: ch },
  };

  const reach = 14; // gap between the arrow tip and the center box
  const chips = slots.map((slot) => {
    const box = boxes[slot];
    const midY = box.y + box.height / 2;
    if (slot === "top") {
      return {
        slot,
        box,
        from: { x: cx, y: box.y + box.height },
        to: { x: cx, y: center.y - reach },
      };
    }
    if (slot === "bottom") {
      return {
        slot,
        box,
        from: { x: cx, y: box.y },
        to: { x: cx, y: center.y + center.height + reach },
      };
    }
    const left = box.x < cx;
    const toY = cy + Math.sign(midY - cy) * 28;
    return {
      slot,
      box,
      from: { x: left ? box.x + box.width : box.x, y: midY },
      to: { x: left ? center.x - reach : center.x + center.width + reach, y: toY },
    };
  });

  const height = Math.max(...chips.map((c) => c.box.y + c.box.height), center.y + center.height);
  return { width, height, center, chips };
}

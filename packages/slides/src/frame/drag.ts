import { FORMAT, SAFE_AREA } from "./geometry";

// Dragging layers in the editor (ADR 0013), as pure geometry so it can be tested: where a layer
// lands when moved by the pointer, snapped to the guides like in Canva and kept inside the safe
// area. Boxes are in slide pixels (1080×1350). TikTok's button column is not a hard limit (it
// only covers the bottom right): the render QA flags a layer that ends up under it.

export type Box = { left: number; top: number; right: number; bottom: number };

const SAFE: Box = {
  left: SAFE_AREA.x,
  top: SAFE_AREA.y,
  right: SAFE_AREA.x + SAFE_AREA.width,
  bottom: SAFE_AREA.y + SAFE_AREA.height,
};

/** Guides a layer snaps to: the safe margins and the center of the slide. */
export const GUIDES = {
  x: [SAFE.left, FORMAT.width / 2, SAFE.right],
  y: [SAFE.top, FORMAT.height / 2, SAFE.bottom],
} as const;

/** How close (in slide pixels) an edge or center must get to a guide to snap to it. */
export const SNAP_DISTANCE = 14;

export type MoveResult = {
  dx: number;
  dy: number;
  /** Guides the layer is snapped to, to draw them while dragging. */
  guides: { x?: number; y?: number };
};

/** The closest guide to any of the given positions, as the shift that reaches it. */
function snapAxis(
  positions: readonly number[],
  guides: readonly number[],
): { shift: number; guide: number } | undefined {
  let best: { shift: number; guide: number } | undefined;
  for (const position of positions) {
    for (const guide of guides) {
      const shift = guide - position;
      if (Math.abs(shift) <= SNAP_DISTANCE && (!best || Math.abs(shift) < Math.abs(best.shift)))
        best = { shift, guide };
    }
  }
  return best;
}

/** Shift along one axis that keeps [start, end] inside [min, max] (from `min` if it is wider). */
function clampAxis(start: number, end: number, min: number, max: number): number {
  if (end - start >= max - min) return min - start;
  if (start < min) return min - start;
  if (end > max) return max - end;
  return 0;
}

/**
 * Where a layer drawn at `box` goes when dragged by (dx, dy): snapped to the nearest guide (its
 * edges and its center count) and never outside the safe area.
 */
export function moveBox(box: Box, dx: number, dy: number, snap = true): MoveResult {
  let x = dx;
  let y = dy;
  const guides: MoveResult["guides"] = {};
  if (snap) {
    const sx = snapAxis([box.left + x, (box.left + box.right) / 2 + x, box.right + x], GUIDES.x);
    if (sx) {
      x += sx.shift;
      guides.x = sx.guide;
    }
    const sy = snapAxis([box.top + y, (box.top + box.bottom) / 2 + y, box.bottom + y], GUIDES.y);
    if (sy) {
      y += sy.shift;
      guides.y = sy.guide;
    }
  }
  const cx = clampAxis(box.left + x, box.right + x, SAFE.left, SAFE.right);
  const cy = clampAxis(box.top + y, box.bottom + y, SAFE.top, SAFE.bottom);
  // A clamped axis sits on the safe margin, not on the guide it was snapping to.
  if (cx !== 0) delete guides.x;
  if (cy !== 0) delete guides.y;
  return { dx: Math.round(x + cx), dy: Math.round(y + cy), guides };
}

/** A box scaled around its center. */
export function scaleBox(box: Box, factor: number): Box {
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const hw = ((box.right - box.left) / 2) * factor;
  const hh = ((box.bottom - box.top) / 2) * factor;
  return { left: cx - hw, top: cy - hh, right: cx + hw, bottom: cy + hh };
}

/**
 * Resizing an image layer (the hero) drawn at `box` from `from` to `to`: the largest scale up to
 * `to` that fits the safe area, and the shift that keeps it inside once scaled.
 */
export function resizeBox(
  box: Box,
  from: number,
  to: number,
): { scale: number; dx: number; dy: number } {
  const unit = scaleBox(box, 1 / from);
  const width = unit.right - unit.left;
  const height = unit.bottom - unit.top;
  const fits = Math.min(
    (SAFE.right - SAFE.left) / width || to,
    (SAFE.bottom - SAFE.top) / height || to,
  );
  const scale = Math.min(to, fits);
  const scaled = scaleBox(unit, scale);
  return {
    scale,
    dx: Math.round(clampAxis(scaled.left, scaled.right, SAFE.left, SAFE.right)),
    dy: Math.round(clampAxis(scaled.top, scaled.bottom, SAFE.top, SAFE.bottom)),
  };
}

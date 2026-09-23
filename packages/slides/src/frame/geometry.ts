// Slide format and safe zones (docs/DESIGN-SYSTEM.md §3, ADR 0011). Measured on a real TikTok
// screenshot of a 4:5 carousel: TikTok fits it to the screen width and draws its UI on top.

export const FORMAT = { id: "4x5", width: 1080, height: 1350 } as const;

export type Rect = { x: number; y: number; width: number; height: number };

/** Content must stay inside these margins. */
export const SAFE_MARGINS = { top: 80, right: 80, bottom: 100, left: 80 } as const;

/** TikTok's button column (avatar, like, comments, save): bottom half of the right edge. */
export const EXCLUSION_ZONES: readonly Rect[] = [
  { x: 930, y: 650, width: FORMAT.width - 930, height: FORMAT.height - 650 },
];

export const SAFE_AREA: Rect = {
  x: SAFE_MARGINS.left,
  y: SAFE_MARGINS.top,
  width: FORMAT.width - SAFE_MARGINS.left - SAFE_MARGINS.right,
  height: FORMAT.height - SAFE_MARGINS.top - SAFE_MARGINS.bottom,
};

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Whether a content box respects the safe zones (render QA, phase 2). */
export function isInSafeZone(box: Rect): boolean {
  const inside =
    box.x >= SAFE_AREA.x &&
    box.y >= SAFE_AREA.y &&
    box.x + box.width <= SAFE_AREA.x + SAFE_AREA.width &&
    box.y + box.height <= SAFE_AREA.y + SAFE_AREA.height;
  return inside && !EXCLUSION_ZONES.some((zone) => overlaps(box, zone));
}

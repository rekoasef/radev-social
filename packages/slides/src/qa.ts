// Render QA (docs/DESIGN-SYSTEM.md §9, points 1 and 2), run in the browser on a rendered slide:
// text that overflows its box or leaves its container, and content outside the safe area or
// under TikTok's button column. Used by the preview (?qa=1), `pnpm capture --check`, the
// identity editor and, from phase 2, the worker's render.
//
// Browser code: exported as `@radev/slides/qa`, apart from the package index, so server-only
// packages that import @radev/slides do not need the DOM types.
//
// checkRender is self-contained on purpose (only type imports, constants inside): Playwright can send it to the page
// as is with page.evaluate(checkRender). Keep the numbers in sync with frame/geometry.ts (a test
// checks it).

import type { QaIssue } from "./qa-issues";

export { describeQaIssue, QA_KINDS, type QaIssue } from "./qa-issues";

/**
 * Checks the slide under `frame` (the element with `data-slide-frame`). Works on a scaled
 * preview too: positions are measured relative to the frame and divided by its scale. With
 * `mark`, offending elements get a red outline.
 */
export function checkRender(
  frame: Element,
  mark = false,
  options: { overlap?: boolean } = {},
): QaIssue[] {
  const WIDTH = 1080;
  const SAFE = { left: 80, top: 80, right: 1080 - 80, bottom: 1350 - 100 };
  const TIKTOK = { left: 930, top: 650 };
  const TOLERANCE = 1;

  const box = frame.getBoundingClientRect();
  const scale = box.width / WIDTH || 1;
  const local = (el: Element) => {
    const r = el.getBoundingClientRect();
    return {
      left: (r.left - box.left) / scale,
      top: (r.top - box.top) / scale,
      right: (r.right - box.left) / scale,
      bottom: (r.bottom - box.top) / scale,
    };
  };
  const snippet = (el: Element) => (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  const issues: QaIssue[] = [];
  const flag = (el: Element, kind: QaIssue["kind"], text = snippet(el)) => {
    issues.push({ kind, text });
    if (mark && el instanceof HTMLElement) {
      el.style.outline = "3px solid #ff3b30";
      el.style.outlineOffset = "2px";
    }
  };

  for (const el of frame.querySelectorAll("[data-qa=content]")) {
    const r = local(el);
    if (
      r.left < SAFE.left - TOLERANCE ||
      r.top < SAFE.top - TOLERANCE ||
      r.right > SAFE.right + TOLERANCE ||
      r.bottom > SAFE.bottom + TOLERANCE
    ) {
      flag(el, "safe-area");
    } else if (r.right > TIKTOK.left + TOLERANCE && r.bottom > TIKTOK.top + TOLERANCE) {
      flag(el, "tiktok");
    }
  }

  for (const el of frame.querySelectorAll("[data-qa=text]")) {
    // Loose text (not inside a content box) must also stay inside the safe area.
    const t = local(el);
    if (
      t.left < SAFE.left - TOLERANCE ||
      t.top < SAFE.top - TOLERANCE ||
      t.right > SAFE.right + TOLERANCE ||
      t.bottom > SAFE.bottom + TOLERANCE
    ) {
      flag(el, "safe-area");
      continue;
    }
    if (t.right > TIKTOK.left + TOLERANCE && t.bottom > TIKTOK.top + TOLERANCE) {
      flag(el, "tiktok");
      continue;
    }
    // Vertically, a font's glyph box may run a few pixels past a tight line height (Manrope,
    // DM Sans…) without anything being cut: only half a line or more is a real overflow (an
    // extra line that does not fit). Horizontally, any pixel counts.
    const fontSize = Number.parseFloat(getComputedStyle(el).fontSize) || 16;
    if (
      el.scrollWidth > el.clientWidth + TOLERANCE ||
      el.scrollHeight > el.clientHeight + fontSize * 0.5
    ) {
      flag(el, "overflow");
      continue;
    }
    const container = el.parentElement?.closest("[data-qa=content]");
    if (!container) continue;
    const r = local(el);
    const c = local(container);
    if (
      r.left < c.left - TOLERANCE ||
      r.top < c.top - TOLERANCE ||
      r.right > c.right + TOLERANCE ||
      r.bottom > c.bottom + TOLERANCE
    ) {
      flag(el, "outside-box");
    }
  }

  // Layers moved by hand (ADR 0013) landing on each other: the title over the hero, the body
  // over the title. Only with `overlap` (the editor): it is a warning for the operator, who sees
  // the result, and never fails a render. Measured on what is drawn: text line boxes, content
  // boxes with a visible surface, and images without their usual transparent margin. Untouched
  // templates are not checked: their layout already keeps layers apart.
  if (options.overlap) {
    const OVERLAP_DEPTH = 12;
    /** Transparent margin around a brand's artwork, as a share of the image. */
    const IMAGE_INSET = 0.15;
    /** A line box runs past the letters (the font's ascent and descent): trimmed top and bottom. */
    const LINE_TRIM = 0.15;
    const drawn = (layer: Element) => {
      const rects: ReturnType<typeof local>[] = [];
      for (const el of layer.querySelectorAll("[data-qa=text]")) {
        const range = document.createRange();
        range.selectNodeContents(el);
        for (const line of range.getClientRects()) {
          const trim = line.height * LINE_TRIM;
          rects.push({
            left: (line.left - box.left) / scale,
            top: (line.top + trim - box.top) / scale,
            right: (line.right - box.left) / scale,
            bottom: (line.bottom - trim - box.top) / scale,
          });
        }
      }
      for (const el of layer.querySelectorAll("[data-qa=content]")) {
        const style = getComputedStyle(el);
        const surface =
          !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(style.backgroundColor) ||
          Number.parseFloat(style.borderTopWidth) > 0;
        if (surface) rects.push(local(el));
      }
      for (const el of layer.querySelectorAll("img")) {
        // Drawn with object-fit: contain, the picture is centered in its box at its own ratio.
        const r = local(el);
        const image = el as HTMLImageElement;
        const w = r.right - r.left;
        const h = r.bottom - r.top;
        const ratio =
          image.naturalWidth && image.naturalHeight
            ? image.naturalWidth / image.naturalHeight
            : w / h;
        const drawnW = Math.min(w, h * ratio);
        const drawnH = drawnW / ratio;
        const dx = (w - drawnW) / 2 + drawnW * IMAGE_INSET;
        const dy = (h - drawnH) / 2 + drawnH * IMAGE_INSET;
        rects.push({
          left: r.left + dx,
          top: r.top + dy,
          right: r.right - dx,
          bottom: r.bottom - dy,
        });
      }
      return rects;
    };
    const layers = [...frame.querySelectorAll("[data-layer]")].map((layer) => ({
      layer,
      moved: layer.hasAttribute("data-moved"),
      rects: drawn(layer),
    }));
    const hit = (a: ReturnType<typeof local>, b: ReturnType<typeof local>) =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > OVERLAP_DEPTH &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > OVERLAP_DEPTH;
    for (const [i, a] of layers.entries()) {
      for (const b of layers.slice(i + 1)) {
        if (!a.moved && !b.moved) continue;
        if (a.rects.some((ra) => b.rects.some((rb) => hit(ra, rb)))) {
          const layer = a.moved ? a.layer : b.layer;
          // Same names as LAYER_LABELS (content/layout.ts); this file imports nothing.
          const names: Record<string, string> = {
            title: "Título",
            body: "Contenido",
            hero: "Elemento gráfico",
          };
          const name = (el: Element) => names[el.getAttribute("data-layer") ?? ""] ?? snippet(el);
          flag(layer, "overlap", `${name(a.layer)} y ${name(b.layer)}`);
        }
      }
    }
  }
  return issues;
}

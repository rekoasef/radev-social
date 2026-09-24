// Render QA (docs/DESIGN-SYSTEM.md §9, points 1 and 2), run in the browser on a rendered slide:
// text that overflows its box or leaves its container, and content outside the safe area or
// under TikTok's button column. Used by the preview (?qa=1), `pnpm capture --check`, the
// identity editor and, from phase 2, the worker's render.
//
// Browser code: exported as `@radev/slides/qa`, apart from the package index, so server-only
// packages that import @radev/slides do not need the DOM types.
//
// Self-contained on purpose (no imports, constants inside): Playwright can send it to the page
// as is with page.evaluate(checkRender). Keep the numbers in sync with frame/geometry.ts (a test
// checks it).

export type QaIssue = {
  kind: "overflow" | "outside-box" | "safe-area" | "tiktok";
  /** Start of the offending text, to find it. */
  text: string;
};

/**
 * Checks the slide under `frame` (the element with `data-slide-frame`). Works on a scaled
 * preview too: positions are measured relative to the frame and divided by its scale. With
 * `mark`, offending elements get a red outline.
 */
export function checkRender(frame: Element, mark = false): QaIssue[] {
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
  const flag = (el: Element, kind: QaIssue["kind"]) => {
    issues.push({ kind, text: snippet(el) });
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
    if (
      el.scrollWidth > el.clientWidth + TOLERANCE ||
      el.scrollHeight > el.clientHeight + TOLERANCE
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
  return issues;
}

/** Spanish description of an issue, for the panel and the capture script. */
export function describeQaIssue(issue: QaIssue): string {
  const what = {
    overflow: "El texto no entra en su caja",
    "outside-box": "El texto se sale de su tarjeta",
    "safe-area": "Queda fuera del área segura",
    tiktok: "Queda debajo de los botones de TikTok",
  }[issue.kind];
  return `${what}: “${issue.text}”`;
}

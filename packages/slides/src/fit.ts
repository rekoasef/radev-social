// Density fit (docs/DESIGN-SYSTEM.md §10), run in the browser before the render QA: a `studio`
// content box whose slide does not fit (long texts, many items) is zoomed out step by step, while
// its box grows by the same factor, so it keeps its place and size on the slide and the text
// reflows in the extra room. Title sizes are estimated in code; this catches the rest.
//
// Self-contained like checkRender (qa.ts): Playwright can send it to the page as is.

/** Fits every `[data-fit]` box under `frame`. Returns the zoom each one ended with. */
export function fitSlide(frame: Element): number[] {
  const MIN_ZOOM = 0.6;
  const STEP = 0.04;
  const SLACK = 28;
  const zooms: number[] = [];
  for (const box of frame.querySelectorAll<HTMLElement>("[data-fit]")) {
    const width = Number(box.dataset.fitWidth);
    const height = Number(box.dataset.fitHeight);
    const inner = box.firstElementChild as HTMLElement | null;
    if (!inner || !width || !height) continue;
    const apply = (zoom: number) => {
      box.style.zoom = String(zoom);
      box.style.width = `${width / zoom}px`;
      box.style.height = `${height / zoom}px`;
    };
    // Some slack: rotated pieces (recorte) and hard shadows (brutalista) stick out a few pixels
    // without anything being cut; text that does not fit overflows by far more.
    const overflows = () =>
      inner.scrollHeight > inner.clientHeight + SLACK ||
      inner.scrollWidth > inner.clientWidth + SLACK;
    let zoom = 1;
    apply(zoom);
    while (overflows() && zoom - STEP >= MIN_ZOOM) {
      zoom = Math.round((zoom - STEP) * 100) / 100;
      apply(zoom);
    }
    zooms.push(zoom);
  }
  return zooms;
}

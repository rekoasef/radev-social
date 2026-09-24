"use client";

import {
  type Box,
  FORMAT,
  LAYER_LABELS,
  LAYER_LIMITS,
  type LayerAdjust,
  type LayerName,
  layerAdjust,
  moveBox,
  resizeBox,
  type SlideLayout,
  withLayer,
} from "@radev/slides";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Drag handles on top of the editor's preview (ADR 0013), like in Canva: each layer of the slide
// (title, body, hero) gets a box that moves it, snapped to the guides and kept inside the safe
// area (packages/slides, frame/drag.ts). The hero also resizes from its corners. What changes is
// the slide's `layout`; the preview redraws it with the same templates the render uses.

type Boxes = Partial<Record<LayerName, Box>>;
type Corner = { x: -1 | 1; y: -1 | 1 };
type Drag = {
  layer: LayerName;
  pointerX: number;
  pointerY: number;
  box: Box;
  adjust: LayerAdjust;
  corner?: Corner;
};

const CORNERS: Corner[] = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: 1 },
];

/** What a layer draws, in slide pixels: its boxes, texts and images (not its wrapper). */
function measure(frame: HTMLElement): Boxes {
  const f = frame.getBoundingClientRect();
  const s = f.width / FORMAT.width || 1;
  const boxes: Boxes = {};
  for (const layer of frame.querySelectorAll<HTMLElement>("[data-layer]")) {
    const name = layer.dataset.layer as LayerName;
    const parts = layer.querySelectorAll("[data-qa=content], [data-qa=text], img");
    if (parts.length === 0) continue;
    let box: Box | undefined;
    for (const part of parts) {
      let r = part.getBoundingClientRect();
      if (part instanceof HTMLImageElement && part.naturalWidth && part.naturalHeight) {
        // object-fit: contain: only the picture, not the empty bands around it.
        const ratio = part.naturalWidth / part.naturalHeight;
        const w = Math.min(r.width, r.height * ratio);
        const h = w / ratio;
        r = new DOMRect(r.left + (r.width - w) / 2, r.top + (r.height - h) / 2, w, h);
      }
      const b = {
        left: (r.left - f.left) / s,
        top: (r.top - f.top) / s,
        right: (r.right - f.left) / s,
        bottom: (r.bottom - f.top) / s,
      };
      box = box
        ? {
            left: Math.min(box.left, b.left),
            top: Math.min(box.top, b.top),
            right: Math.max(box.right, b.right),
            bottom: Math.max(box.bottom, b.bottom),
          }
        : b;
    }
    if (box) boxes[name] = box;
  }
  return boxes;
}

const area = (box: Box) => (box.right - box.left) * (box.bottom - box.top);

const clampScale = (layer: LayerName, value: number) => {
  const limits = layer === "hero" ? LAYER_LIMITS.scale.hero : LAYER_LIMITS.scale.title;
  return Math.min(limits.max, Math.max(limits.min, value));
};

export function LayerEditor({
  scale,
  frame,
  layout,
  redrawKey,
  selected,
  onSelect,
  onChange,
}: {
  scale: number;
  frame: () => HTMLElement | null;
  layout: SlideLayout | undefined;
  /** Changes whenever the slide is drawn differently (its content, the preview width…). */
  redrawKey: string;
  selected: LayerName | null;
  onSelect: (layer: LayerName | null) => void;
  onChange: (layout: SlideLayout | undefined) => void;
}) {
  const [boxes, setBoxes] = useState<Boxes>({});
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const drag = useRef<Drag | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const remeasure = useCallback(() => {
    const el = frame();
    if (el) setBoxes(measure(el));
  }, [frame]);

  // After every redraw, and again once fonts and images are in (they change the sizes).
  // biome-ignore lint/correctness/useExhaustiveDependencies: redrawKey and scale are the triggers
  useLayoutEffect(() => {
    remeasure();
    let active = true;
    document.fonts.ready.then(() => active && remeasure());
    const images = frame()?.querySelectorAll("img") ?? [];
    for (const img of images) if (!img.complete) img.addEventListener("load", remeasure);
    return () => {
      active = false;
      for (const img of images) img.removeEventListener("load", remeasure);
    };
  }, [redrawKey, scale, remeasure]);

  const apply = (layer: LayerName, adjust: LayerAdjust) =>
    onChange(withLayer(layoutRef.current, layer, adjust));

  const startDrag = (event: React.PointerEvent, layer: LayerName, corner?: Corner) => {
    const box = boxes[layer];
    if (!box || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    // Focused, so the arrow keys move it next (a corner hands focus to its layer).
    (target.closest<HTMLElement>(".layer-box") ?? target).focus({ preventScroll: true });
    onSelect(layer);
    drag.current = {
      layer,
      pointerX: event.clientX,
      pointerY: event.clientY,
      box,
      adjust: layerAdjust(layoutRef.current, layer),
      corner,
    };
  };

  const onMove = (event: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (event.clientX - d.pointerX) / scale;
    const dy = (event.clientY - d.pointerY) / scale;
    const from = d.adjust.scale ?? 1;
    if (d.corner) {
      // Resizing from a corner: the pointer's travel along the diagonal, both sides.
      const grow = (dx * d.corner.x + dy * d.corner.y) / 2;
      const width = d.box.right - d.box.left;
      const to = clampScale(d.layer, (from * (width + 2 * grow)) / width);
      const resized = resizeBox(d.box, from, to);
      apply(d.layer, {
        x: d.adjust.x + resized.dx,
        y: d.adjust.y + resized.dy,
        scale: resized.scale,
      });
      return;
    }
    // Alt drags without snapping, like in most design tools.
    const moved = moveBox(d.box, dx, dy, !event.altKey);
    setGuides(moved.guides);
    apply(d.layer, { ...d.adjust, x: d.adjust.x + moved.dx, y: d.adjust.y + moved.dy });
  };

  const endDrag = () => {
    drag.current = null;
    setGuides({});
  };

  const onKey = (event: React.KeyboardEvent, layer: LayerName) => {
    const step = event.shiftKey ? 10 : 1;
    const delta = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[event.key];
    const box = boxes[layer];
    if (!delta || !box) return;
    event.preventDefault();
    const adjust = layerAdjust(layoutRef.current, layer);
    const moved = moveBox(box, delta[0] ?? 0, delta[1] ?? 0, false);
    apply(layer, { ...adjust, x: adjust.x + moved.dx, y: adjust.y + moved.dy });
  };

  const px = (v: number) => v * scale;

  return (
    // Clicking empty space deselects; the layers themselves are focusable.
    <div
      className="absolute inset-0"
      onPointerDown={() => onSelect(null)}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {guides.x !== undefined && (
        <span className="layer-guide-v" style={{ left: px(guides.x) }} aria-hidden="true" />
      )}
      {guides.y !== undefined && (
        <span className="layer-guide-h" style={{ top: px(guides.y) }} aria-hidden="true" />
      )}
      {(Object.entries(boxes) as [LayerName, Box][])
        // Smaller boxes on top of bigger ones, so every layer can be grabbed (the hero sits
        // inside the body's area on some templates); the selected one above all.
        .sort(([, a], [, b]) => area(b) - area(a))
        .map(([layer, box]) => {
          const isSelected = selected === layer;
          return (
            // biome-ignore lint/a11y/useSemanticElements: a draggable box; a <button> cannot hold the corner handles
            <div
              key={layer}
              role="button"
              tabIndex={0}
              aria-label={`${LAYER_LABELS[layer]}: arrastrá para moverlo; flechas para ajustar`}
              aria-pressed={isSelected}
              className={`layer-box ${isSelected ? "layer-box-selected" : ""}`}
              style={{
                left: px(box.left),
                top: px(box.top),
                width: px(box.right - box.left),
                height: px(box.bottom - box.top),
                zIndex: isSelected ? 2 : 1,
              }}
              onPointerDown={(e) => startDrag(e, layer)}
              onKeyDown={(e) => onKey(e, layer)}
              onFocus={() => onSelect(layer)}
            >
              <span className="layer-label">{LAYER_LABELS[layer]}</span>
              {isSelected &&
                layer === "hero" &&
                CORNERS.map((corner) => (
                  <span
                    key={`${corner.x}${corner.y}`}
                    className="layer-corner"
                    style={{
                      left: corner.x < 0 ? -5 : undefined,
                      right: corner.x > 0 ? -5 : undefined,
                      top: corner.y < 0 ? -5 : undefined,
                      bottom: corner.y > 0 ? -5 : undefined,
                      cursor: corner.x === corner.y ? "nwse-resize" : "nesw-resize",
                    }}
                    onPointerDown={(e) => startDrag(e, layer, corner)}
                    aria-hidden="true"
                  />
                ))}
            </div>
          );
        })}
    </div>
  );
}

/** Below the preview: size and reset for the selected layer, and a reset for the slide. */
export function LayerToolbar({
  layout,
  selected,
  hasHero,
  onChange,
}: {
  layout: SlideLayout | undefined;
  selected: LayerName | null;
  hasHero: boolean;
  onChange: (layout: SlideLayout | undefined) => void;
}) {
  const adjust = selected ? layerAdjust(layout, selected) : undefined;
  const size = adjust?.scale ?? 1;
  const resizable = selected === "title" || selected === "hero";
  const setSize = (to: number) => {
    if (!selected || !adjust) return;
    onChange(withLayer(layout, selected, { ...adjust, scale: clampScale(selected, to) }));
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      {selected && adjust ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">{LAYER_LABELS[selected]}</span>
          {resizable && (
            <span className="flex items-center gap-1">
              <button
                type="button"
                className="icon-key"
                onClick={() => setSize(size - 0.05)}
                aria-label="Achicar"
              >
                −
              </button>
              <span className="timecode w-12 text-center text-ink-dim">
                {Math.round(size * 100)}%
              </span>
              <button
                type="button"
                className="icon-key"
                onClick={() => setSize(size + 0.05)}
                aria-label="Agrandar"
              >
                +
              </button>
            </span>
          )}
          <button
            type="button"
            className="console-button"
            disabled={!layout?.[selected]}
            onClick={() => onChange(withLayer(layout, selected, null))}
          >
            Restablecer
          </button>
        </div>
      ) : (
        <p className="text-ink-faint">
          Arrastrá el título, el contenido{hasHero ? " o el elemento gráfico" : ""} sobre la vista
          previa. Se imanta al centro y a los márgenes (Alt para soltarlo libre); flechas: de a 1
          px, con Shift de a 10.
        </p>
      )}
      {layout && (
        <button
          type="button"
          className="w-fit text-ink-dim underline underline-offset-2"
          onClick={() => onChange(undefined)}
        >
          Volver toda la slide a su posición original
        </button>
      )}
    </div>
  );
}

/** Keeps the selection valid when the slide changes (another slide has other layers). */
export function useLayerSelection(slideKey: string) {
  const [selected, setSelected] = useState<LayerName | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new slide starts with nothing selected
  useEffect(() => setSelected(null), [slideKey]);
  return [selected, setSelected] as const;
}

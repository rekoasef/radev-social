import type { CSSProperties, ReactNode } from "react";
import { isMoved, type LayerName, layerAdjust, type SlideLayout } from "../content/layout";

// A movable layer of a slide (ADR 0013). Draws its children where the template puts them,
// shifted by the slide's hand adjustment. A transform does not touch the layout, so the other
// layers stay put, like in Canva, and the render QA still sees the real position (it measures
// bounding boxes). The editor finds layers by `data-layer` to put its handles on them.
//
// The title's size is a font multiplier (--title-adjust, read by Title in each preset), so its
// lines re-wrap instead of stretching; the hero scales as an image around its center.

export function Layer({
  name,
  layout,
  style,
  baseTransform,
  children,
}: {
  name: LayerName;
  layout: SlideLayout | undefined;
  /** Styles of the element the layer replaces (a flex item keeps its sizing). */
  style?: CSSProperties;
  /** A transform the template already applies to this element. */
  baseTransform?: string;
  children: ReactNode;
}) {
  const adjust = layerAdjust(layout, name);
  const moved = isMoved(adjust);
  const transforms = [
    moved && (adjust.x !== 0 || adjust.y !== 0) ? `translate(${adjust.x}px, ${adjust.y}px)` : "",
    baseTransform ?? "",
    name === "hero" && adjust.scale !== undefined ? `scale(${adjust.scale})` : "",
  ].filter(Boolean);
  return (
    <div
      data-layer={name}
      data-moved={moved ? "" : undefined}
      style={{
        ...style,
        transform: transforms.length > 0 ? transforms.join(" ") : undefined,
        ...(name === "title" && adjust.scale !== undefined
          ? ({ "--title-adjust": adjust.scale } as CSSProperties)
          : {}),
      }}
    >
      {children}
    </div>
  );
}

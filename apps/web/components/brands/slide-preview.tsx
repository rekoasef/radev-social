"use client";

import {
  type BrandTheme,
  exampleDatasets,
  exampleSlidesByPreset,
  FORMAT,
  type SlideAssets,
  SlideContent,
  SlideFrame,
  type SlideType,
} from "@radev/slides";
import { useEffect, useRef, useState } from "react";

// Live preview of the identity editor: the same frame and templates the render uses, with the
// preset's example content, scaled down to the column width.

export const PREVIEW_SLIDES: { type: SlideType; label: string }[] = [
  { type: "cover", label: "Portada" },
  { type: "statement", label: "Afirmación" },
  { type: "question", label: "Pregunta" },
  { type: "cardGrid", label: "Tarjetas" },
  { type: "flow", label: "Recorrido" },
  { type: "hubDiagram", label: "Diagrama" },
  { type: "comparison", label: "Comparación" },
  { type: "costBreakdown", label: "Costos" },
  { type: "steps", label: "Pasos" },
  { type: "bigNumber", label: "Número" },
  { type: "chart", label: "Gráfico" },
  { type: "cta", label: "Cierre" },
];

export function SlidePreview({
  theme,
  brandName,
  assets,
  type,
}: {
  theme: BrandTheme;
  brandName: string;
  assets: SlideAssets;
  type: SlideType;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(420);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = width / FORMAT.width;
  const slide = exampleSlidesByPreset[theme.preset][type];
  return (
    <div ref={box} className="w-full">
      <div
        className="overflow-hidden rounded-md border border-bezel"
        style={{ height: FORMAT.height * scale }}
      >
        <div
          style={{
            width: FORMAT.width,
            height: FORMAT.height,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          <SlideFrame
            theme={theme}
            brandName={brandName}
            page={{ index: type === "cover" ? 0 : 2, total: 7 }}
            seed="preview"
            glow={type === "cover" || type === "cta"}
            assets={assets}
          >
            <SlideContent theme={theme} slide={slide} datasets={exampleDatasets} assets={assets} />
          </SlideFrame>
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  type BrandTheme,
  exampleDatasets,
  exampleSlidesByPreset,
  extremeSlides,
  FORMAT,
  type SlideAssets,
  SlideContent,
  SlideFrame,
  type SlideType,
} from "@radev/slides";
import { checkRender, describeQaIssue, type QaIssue } from "@radev/slides/qa";
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
  extreme = false,
}: {
  theme: BrandTheme;
  brandName: string;
  assets: SlideAssets;
  type: SlideType;
  /** Worst-case content (every text at its limit) instead of the preset's examples. */
  extreme?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(420);
  const [issues, setIssues] = useState<QaIssue[]>([]);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Render QA after every change, once the fonts are in (a new font changes every size).
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-check whenever what is drawn changes
  useEffect(() => {
    let active = true;
    const frame = box.current?.querySelector("[data-slide-frame]");
    document.fonts.ready.then(() => {
      if (active && frame) setIssues(checkRender(frame));
    });
    return () => {
      active = false;
    };
  }, [theme, type, extreme, width]);

  const scale = width / FORMAT.width;
  const slide = (extreme ? extremeSlides : exampleSlidesByPreset[theme.preset])[type];
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
      {issues.length > 0 && (
        <ul
          role="status"
          className="mt-3 flex flex-col gap-1 border-l border-tally-amber pl-3 text-sm text-ink"
        >
          {issues.map((issue) => (
            <li key={`${issue.kind}-${issue.text}`}>{describeQaIssue(issue)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

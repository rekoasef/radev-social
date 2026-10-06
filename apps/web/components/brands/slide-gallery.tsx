"use client";

import {
  type BrandTheme,
  enabledLooks,
  exampleCarouselByPreset,
  LOOK_GUIDE,
  LOOK_NAMES,
  type LookId,
  type SlideAssets,
  type SlideType,
} from "@radev/slides";
import type { QaIssue } from "@radev/slides/qa";
import { useCallback, useState } from "react";
import { Tally } from "@/components/console/tally";
import { previewSlides, SlidePreview } from "./slide-preview";

// Every slide type of a brand at once, with its saved identity, and the preset's example
// carousel. Each preview runs the render QA; the header sums up the problems. A `studio` brand
// picks which of its looks to see.

export function SlideGallery({
  theme,
  brandName,
  assets,
}: {
  theme: BrandTheme;
  brandName: string;
  assets: SlideAssets;
}) {
  const [extreme, setExtreme] = useState(false);
  const [qa, setQa] = useState<Partial<Record<SlideType, number>>>({});
  const report = useCallback(
    (type: SlideType) => (issues: QaIssue[]) =>
      setQa((current) =>
        current[type] === issues.length ? current : { ...current, [type]: issues.length },
      ),
    [],
  );
  const slides = previewSlides(theme.preset);
  const checked = Object.keys(qa).length;
  const failing = slides.filter((s) => (qa[s.type] ?? 0) > 0);
  const carousel = exampleCarouselByPreset[theme.preset];
  const looks = theme.preset === "studio" ? enabledLooks(theme.tokens) : [];
  const [look, setLook] = useState<LookId | undefined>(looks[0]);

  return (
    <div className="flex flex-col gap-14">
      {looks.length > 0 && look && (
        <section aria-labelledby="looks-heading" className="flex flex-col gap-3">
          <h2 id="looks-heading" className="plate w-fit">
            Look
          </h2>
          <div className="flex flex-wrap gap-2">
            {looks.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={id === look}
                onClick={() => {
                  setQa({});
                  setLook(id);
                }}
                className={`console-button ${id === look ? "console-button-primary" : ""}`}
              >
                {LOOK_NAMES[id]}
              </button>
            ))}
          </div>
          <p className="max-w-[70ch] text-sm text-ink-dim">{LOOK_GUIDE[look]}</p>
        </section>
      )}
      <section aria-labelledby="types-heading" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="types-heading" className="plate">
            Tipos de slide
          </h2>
          <div className="flex flex-wrap items-center gap-5">
            {checked === slides.length &&
              (failing.length === 0 ? (
                <Tally state="ready">Todo entra</Tally>
              ) : (
                <Tally state="live">
                  {failing.length} con problemas: {failing.map((s) => s.label).join(", ")}
                </Tally>
              ))}
            <label className="flex items-center gap-2 text-sm text-ink-dim">
              <input
                type="checkbox"
                checked={extreme}
                onChange={(event) => {
                  setQa({});
                  setExtreme(event.target.checked);
                }}
                className="size-4 accent-[var(--color-ink)]"
              />
              Textos al límite
            </label>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
          {slides.map((s) => (
            <li key={s.type} className="flex min-w-0 flex-col gap-2">
              <span className="plate-text text-ink-faint">{s.label}</span>
              <SlidePreview
                theme={theme}
                brandName={brandName}
                assets={assets}
                type={s.type}
                extreme={extreme}
                onQa={report(s.type)}
                look={look}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="carousel-heading" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 id="carousel-heading" className="plate w-fit">
            Carrusel de ejemplo
          </h2>
          <p className="max-w-[70ch] text-sm text-ink-dim">
            “{carousel.hook}”. Textos de ejemplo del estilo; las cifras son de relleno.
          </p>
        </div>
        <ol className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-6">
          {carousel.slides.map((slide, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the carousel's order is its identity
            <li key={index} className="min-w-0">
              <SlidePreview
                theme={theme}
                brandName={brandName}
                assets={assets}
                type={slide.type}
                content={slide}
                page={{ index, total: carousel.slides.length }}
                look={look}
              />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

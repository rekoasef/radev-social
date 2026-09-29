"use client";

import {
  type BrandTheme,
  type Datasets,
  type LookId,
  limits,
  SLIDE_LABELS,
  type Slide,
  type SlideAssets,
} from "@radev/slides";
import { useEffect, useState } from "react";
import {
  getSlideRewriteAction,
  requestSlideRewriteAction,
} from "@/app/(panel)/posts/rewrite-actions";
import { SlidePreview } from "@/components/brands/slide-preview";

// "Rehacer con IA": asks the worker to rewrite the selected slide with an instruction and shows
// the answer next to the current one. Nothing changes until the operator takes it ("Usar"); then
// it is an edit like any other, saved with the carousel.

const POLL_MS = 2500;

type Phase =
  | { kind: "idle" }
  | { kind: "waiting"; id: string; index: number }
  | { kind: "done"; slide: Slide; index: number }
  | { kind: "failed"; message: string };

export function SlideRewrite({
  brandId,
  postCode,
  content,
  canAsk,
  slideIndex,
  total,
  theme,
  brandName,
  assets,
  datasets,
  look,
  seed,
  onUse,
}: {
  brandId: string;
  postCode?: string;
  /** The carousel as the editor has it (with its look), sent as the context of the rewrite. */
  content: unknown;
  /** The carousel is valid (the new slide is checked inside it). */
  canAsk: boolean;
  slideIndex: number;
  total: number;
  theme: BrandTheme;
  brandName: string;
  assets: SlideAssets;
  datasets: Datasets;
  look?: LookId;
  seed: string;
  onUse: (index: number, slide: Slide) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  // Polls the request while the worker writes (usually 20–40 s).
  useEffect(() => {
    // Without an id the request is still being filed.
    if (phase.kind !== "waiting" || !phase.id) return;
    let active = true;
    const timer = setInterval(async () => {
      const state = await getSlideRewriteAction(phase.id);
      if (!active) return;
      if (state.status === "done")
        setPhase({ kind: "done", slide: state.slide, index: phase.index });
      else if (state.status === "failed") setPhase({ kind: "failed", message: state.message });
    }, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [phase]);

  const ask = async (index: number) => {
    setPhase({ kind: "waiting", id: "", index });
    const result = await requestSlideRewriteAction({
      brandId,
      code: postCode,
      content: JSON.stringify(content),
      slideIndex: index,
      instruction,
    });
    setPhase(
      result.ok
        ? { kind: "waiting", id: result.id, index }
        : { kind: "failed", message: result.message },
    );
  };

  const waiting = phase.kind === "waiting";
  return (
    <section
      aria-label="Rehacer con IA"
      className="flex flex-col gap-3 rounded-md border border-bezel p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-ink">Rehacer con IA</h3>
        <span className="text-xs text-ink-faint">Slide {slideIndex + 1}</span>
      </div>
      <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
        <span className="flex justify-between">
          Instrucción (opcional)
          <span className="timecode text-xs text-ink-faint">
            {[...instruction].length}/{limits.rewrite.instruction}
          </span>
        </span>
        <input
          value={instruction}
          maxLength={limits.rewrite.instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Más directa · sin tecnicismos · que sea una pregunta…"
          className="console-field"
          disabled={waiting}
        />
      </label>
      <button
        type="button"
        className="console-button w-fit"
        disabled={waiting || !canAsk}
        onClick={() => ask(slideIndex)}
      >
        {waiting ? "Reescribiendo… (unos 30 s)" : "Rehacer esta slide"}
      </button>
      {!canAsk && (
        <p className="text-xs text-ink-faint">
          Corregí los errores del carrusel para poder pedirlo.
        </p>
      )}
      {phase.kind === "failed" && (
        <p role="alert" className="text-sm text-tally-red">
          {phase.message}
        </p>
      )}
      {phase.kind === "done" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-dim">
            Propuesta para la slide {phase.index + 1} ({SLIDE_LABELS[phase.slide.type]}):
          </p>
          <SlidePreview
            theme={theme}
            brandName={brandName}
            assets={assets}
            datasets={datasets}
            type={phase.slide.type}
            content={phase.slide}
            page={{ index: phase.index, total }}
            look={look}
            seed={seed}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="console-button console-button-primary"
              onClick={() => {
                onUse(phase.index, phase.slide);
                setPhase({ kind: "idle" });
              }}
            >
              Usar
            </button>
            <button type="button" className="console-button" onClick={() => ask(phase.index)}>
              Otra vez
            </button>
            <button
              type="button"
              className="text-sm text-ink-dim underline underline-offset-2"
              onClick={() => setPhase({ kind: "idle" })}
            >
              Descartar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

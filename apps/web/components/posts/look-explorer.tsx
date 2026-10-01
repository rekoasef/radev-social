"use client";

import {
  type BrandTheme,
  type Carousel,
  type Datasets,
  LOOK_NAMES,
  type LookId,
  lookTakesArt,
  type SlideAssets,
} from "@radev/slides";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { applyLookAction } from "@/app/(panel)/posts/actions";
import { SlidePreview } from "@/components/brands/slide-preview";
import { PostStrip } from "./post-strip";

/**
 * "Probar otros looks": the same carousel drawn with each of the brand's looks, in the browser
 * (the AI wrote the texts; the look is code, so trying one costs nothing). The covers side by
 * side, the whole carousel of the one picked, and "Usar este look" makes it the post's look.
 */
export function LookExplorer({
  code,
  carousel,
  current,
  looks,
  theme,
  assets,
  brandName,
  seed,
  datasets,
  art,
  canApply,
}: {
  code: string;
  carousel: Carousel;
  /** The look the post is drawn with now. */
  current: LookId;
  /** The brand's active looks. */
  looks: LookId[];
  theme: BrandTheme;
  assets: SlideAssets;
  brandName: string;
  seed: string;
  datasets?: Datasets;
  /** The version's generated images: shown in the looks that take them. */
  art?: { cover?: string; cta?: string };
  /** False while the post can't be edited (rendering, published…): only to compare. */
  canApply: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<LookId | null>(null);
  const cover = carousel.slides[0];
  const total = carousel.slides.length;
  const artFor = (look: LookId) => (lookTakesArt(look) ? art : undefined);

  return (
    <details
      className="group rounded-md border border-bezel"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer select-none px-4 py-3 text-sm text-ink hover:text-ink-dim">
        Probar otros looks <span className="text-ink-faint">({looks.length})</span>
      </summary>
      {/* Mounted only when open: a dozen slides drawn and checked in the browser. */}
      {open && cover && (
        <div className="flex flex-col gap-6 border-t border-bezel p-4">
          <p className="max-w-[70ch] text-sm text-ink-dim">
            El mismo texto con cada look de la marca. No usa la IA: elegí uno para verlo completo y,
            si te gusta, usalo.
            {art?.cover || art?.cta
              ? " La imagen de portada y cierre aparece solo en los looks que la usan."
              : ""}
          </p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8">
            {looks.map((look) => (
              <li key={look} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setPicked(look === picked ? null : look)}
                  aria-pressed={look === picked}
                  className={`flex w-full flex-col gap-1.5 rounded-md p-1 text-left outline-offset-2 transition-colors ${look === picked ? "bg-bezel" : "hover:bg-bezel/50"}`}
                >
                  <SlidePreview
                    theme={theme}
                    brandName={brandName}
                    assets={assets}
                    type={cover.type}
                    content={cover}
                    page={{ index: 0, total }}
                    look={look}
                    seed={seed}
                    datasets={datasets}
                    art={artFor(look)}
                    quiet
                  />
                  <span className="truncate text-xs text-ink">
                    {LOOK_NAMES[look]}
                    {look === current && <span className="text-ink-faint"> · actual</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {picked && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm text-ink">
                  {LOOK_NAMES[picked]}
                  {picked === current && <span className="text-ink-faint"> (el actual)</span>}
                </h3>
                {canApply && picked !== current && (
                  <form action={applyLookAction}>
                    <input type="hidden" name="code" value={code} />
                    <input type="hidden" name="look" value={picked} />
                    <ApplyButton name={LOOK_NAMES[picked]} />
                  </form>
                )}
              </div>
              <PostStrip
                carousel={{ ...carousel, look: picked }}
                theme={theme}
                assets={assets}
                brandName={brandName}
                seed={seed}
                datasets={datasets}
                art={artFor(picked)}
              />
              {canApply && picked !== current && (
                <p className="max-w-[70ch] text-xs text-ink-faint">
                  Usarlo crea una versión nueva con este look: el post vuelve a render y a revisión.
                  La versión actual queda en el historial.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </details>
  );
}

function ApplyButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="console-button console-button-primary" disabled={pending}>
      {pending ? "Aplicando…" : `Usar ${name}`}
    </button>
  );
}

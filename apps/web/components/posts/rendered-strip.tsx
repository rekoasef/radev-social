"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { type MockupPost, type MockupSlide, TikTokMockup } from "./tiktok-mockup";

export type StripSlide = MockupSlide & { width: number; height: number };

/**
 * The rendered PNGs of a version, what gets published. Clicking one opens it inside a TikTok
 * phone, to see it as it will be seen before approving. `swipe` (the review queue) shows them in
 * a row that scrolls sideways, big enough to read on a phone, with the next one peeking in.
 */
export function RenderedStrip({
  slides,
  post,
  layout = "grid",
}: {
  slides: StripSlide[];
  post: MockupPost;
  layout?: "grid" | "swipe";
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [seen, setSeen] = useState(0);
  const index = open ?? 0;
  const go = (to: number) => setOpen(Math.min(slides.length - 1, Math.max(0, to)));
  const swipe = layout === "swipe";

  return (
    <>
      <ol
        className={
          swipe
            ? "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 sm:mx-0 sm:scroll-px-0 sm:px-0"
            : "grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8"
        }
        onScroll={
          swipe
            ? (e) => {
                const first = e.currentTarget.firstElementChild as HTMLElement | null;
                if (!first) return;
                const step = first.offsetWidth + 12;
                setSeen(Math.round(e.currentTarget.scrollLeft / step));
              }
            : undefined
        }
      >
        {slides.map((slide, i) => (
          <li
            key={slide.url}
            className={swipe ? "w-[84%] max-w-[380px] shrink-0 snap-start" : "min-w-0"}
          >
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="block w-full cursor-zoom-in overflow-hidden rounded-md border border-bezel hover:border-ink-faint"
              title={`${slide.label}: ver como en TikTok`}
            >
              {/* biome-ignore lint/performance/noImgElement: the PNG as rendered; next/image would re-encode it. */}
              <img
                src={slide.url}
                alt={slide.label}
                width={slide.width}
                height={slide.height}
                loading="lazy"
                className="block h-auto w-full"
              />
            </button>
          </li>
        ))}
      </ol>
      {swipe && (
        <p className="plate-text text-ink-faint" aria-live="polite">
          Slide {Math.min(seen + 1, slides.length)} de {slides.length} · deslizá · tocá una para
          verla en TikTok
        </p>
      )}

      <Dialog.Root open={open !== null} onOpenChange={(isOpen) => !isOpen && setOpen(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="mockup-backdrop" />
          <Dialog.Viewport className="mockup-viewport">
            <Dialog.Popup
              className="mockup-popup"
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") go(index + 1);
                if (e.key === "ArrowLeft") go(index - 1);
              }}
            >
              <Dialog.Title className="sr-only">Vista en TikTok</Dialog.Title>
              <Dialog.Close className="console-button fixed top-4 right-4" aria-label="Cerrar">
                <X className="size-4" />
              </Dialog.Close>
              <div className="flex items-center gap-4 sm:gap-8">
                <button
                  type="button"
                  className="console-button hidden sm:block"
                  onClick={() => go(index - 1)}
                  disabled={index === 0}
                  aria-label="Slide anterior"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <div style={{ width: "min(88vw, calc(80dvh * 738 / 1600))" }}>
                  <TikTokMockup slides={slides} index={index} onIndexChange={go} post={post} />
                </div>
                <button
                  type="button"
                  className="console-button hidden sm:block"
                  onClick={() => go(index + 1)}
                  disabled={index === slides.length - 1}
                  aria-label="Slide siguiente"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>
              <p className="plate-text mt-5 text-center text-ink-faint">
                Slide {index + 1} de {slides.length} · ← → o deslizá para moverte · Esc cierra
              </p>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

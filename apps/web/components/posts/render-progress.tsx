"use client";

import type { PostStatus } from "@radev/core";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const POLL_MS = 1000;

/**
 * While the worker renders: a 0–100 bar that follows it slide by slide. When the render ends,
 * the page reloads its data by itself (PNGs, problems, buttons).
 */
export function RenderProgress({
  code,
  slides,
  initial,
}: {
  code: string;
  slides: number;
  initial: number | null;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState(initial);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(`/posts/${code}/status`, { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as { status: PostStatus; progress: number | null };
          if (!active) return;
          if (data.status !== "rendering") {
            router.refresh();
            return;
          }
          setProgress(data.progress);
        }
      } catch {
        // A missed poll is fine: the next one catches up.
      }
      if (active) timer = setTimeout(poll, POLL_MS);
    }
    timer = setTimeout(poll, POLL_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [code, router]);

  const done = progress === null ? 0 : Math.round((progress / 100) * slides);
  return (
    <div role="status" className="flex max-w-xl flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-ink">
          {progress === null ? "En cola: el worker lo toma en un momento…" : "Renderizando…"}
        </span>
        <span className="timecode text-ink-dim">
          {progress === null
            ? "—"
            : `slide ${Math.min(done + 1, slides)} de ${slides} · ${progress}%`}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-bezel"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress ?? 0}
        aria-label="Avance del render"
      >
        <div
          className={`h-full rounded-full bg-tally-green transition-[width] duration-500 ease-out ${progress === null ? "w-1/4 animate-pulse" : ""}`}
          style={progress === null ? undefined : { width: `${Math.max(progress, 3)}%` }}
        />
      </div>
    </div>
  );
}

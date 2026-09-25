"use client";

import type { PostStatus } from "@radev/core";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const POLL_MS = 3000;

function timeIn(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/**
 * While the worker writes the carousel: how long it has been at it, or when it tries again if
 * every provider hit its limit. When the post moves on, the page reloads its data by itself.
 */
export function GenerationStatus({
  code,
  timeZone,
  initialRetryAt,
}: {
  code: string;
  /** The brand's, to show the retry time (CLAUDE.md, rule 11). */
  timeZone: string;
  initialRetryAt: string | null;
}) {
  const router = useRouter();
  const [retryAt, setRetryAt] = useState(initialRetryAt);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(`/posts/${code}/status`, { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as { status: PostStatus; retryAt: string | null };
          if (!active) return;
          if (data.status !== "generating") {
            router.refresh();
            return;
          }
          setRetryAt(data.retryAt);
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
      clearInterval(tick);
    };
  }, [code, router]);

  if (retryAt) {
    return (
      <div role="status" className="flex max-w-xl flex-col gap-1 border-l border-tally-amber pl-3">
        <span className="text-sm text-ink">Los proveedores de IA llegaron a su límite de uso.</span>
        <span className="text-sm text-ink-dim">
          Reintenta solo a las <span className="timecode">{timeIn(retryAt, timeZone)}</span>. Podés
          cerrar esta página.
        </span>
      </div>
    );
  }
  const minutes = Math.floor(seconds / 60);
  return (
    <div role="status" className="flex max-w-xl flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-ink">Escribiendo el carrusel con IA…</span>
        <span className="timecode text-ink-dim">
          {minutes}:{String(seconds % 60).padStart(2, "0")}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bezel" aria-hidden="true">
        <div className="h-full w-1/4 animate-pulse rounded-full bg-tally-amber" />
      </div>
      <p className="text-xs text-ink-faint">
        Puede tardar unos minutos; si el principal falla, prueba el respaldo. Después se renderiza
        solo.
      </p>
    </div>
  );
}

"use client";

import { Tally } from "@/components/console/tally";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col items-start gap-4 px-4 py-16 sm:px-8">
      <Tally state="live">Sin señal</Tally>
      <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">
        No se pudo leer la base de datos.
      </h1>
      <p className="max-w-[60ch] text-sm text-ink-dim">
        Revisá que Postgres esté corriendo (
        <code className="timecode text-ink">docker compose ps</code>) y que{" "}
        <code className="timecode text-ink">DATABASE_URL</code> esté bien en tu{" "}
        <code className="timecode text-ink">.env</code>.
      </p>
      <button type="button" onClick={reset} className="console-button mt-2">
        Reintentar
      </button>
    </main>
  );
}

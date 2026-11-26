"use client";

import { useActionState, useState } from "react";
import {
  discardVideoAction,
  retryVideoAction,
  type VideoActionState,
} from "@/app/(panel)/videos/actions";

const idle: VideoActionState = { status: "idle" };

/** "Reintentar" / "Retomar" for a video that stopped. */
export function RetryVideoForm({ videoId, label }: { videoId: string; label: string }) {
  const [state, action, pending] = useActionState(retryVideoAction, idle);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="videoId" value={videoId} />
      <button type="submit" className="console-button" disabled={pending}>
        {pending ? "Encolando…" : label}
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-tally-red">
          {state.message}
        </p>
      )}
    </form>
  );
}

/** "Descartar": asks first, right there. */
export function DiscardVideoButton({ videoId }: { videoId: string }) {
  const [asking, setAsking] = useState(false);
  const [state, action, pending] = useActionState(discardVideoAction, idle);
  if (!asking) {
    return (
      <button type="button" className="console-button w-fit" onClick={() => setAsking(true)}>
        Descartar
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3 border-l border-tally-red/60 pl-4">
      <input type="hidden" name="videoId" value={videoId} />
      <p className="text-sm text-ink-dim">
        El video sale del estudio y ninguna oficina vuelve a trabajarlo. No se puede deshacer.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="console-button console-button-danger" disabled={pending}>
          {pending ? "Descartando…" : "Descartar el video"}
        </button>
        <button type="button" className="console-button" onClick={() => setAsking(false)}>
          Cancelar
        </button>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-tally-red">
          {state.message}
        </p>
      )}
    </form>
  );
}

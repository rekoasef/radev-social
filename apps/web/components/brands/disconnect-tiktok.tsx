"use client";

import { useActionState, useState } from "react";
import {
  type DisconnectState,
  disconnectTiktokAction,
} from "@/app/(panel)/brands/[slug]/channels/actions";

const idle: DisconnectState = { status: "idle" };

/** "Desconectar": asks first, right there (like Descartar). */
export function DisconnectTiktok({
  brandSlug,
  brandName,
}: {
  brandSlug: string;
  brandName: string;
}) {
  const [asking, setAsking] = useState(false);
  const [state, action, pending] = useActionState(disconnectTiktokAction, idle);

  if (state.status === "ok") {
    return (
      <p role="status" className="text-sm text-ink-dim">
        {state.message}
      </p>
    );
  }
  if (!asking) {
    return (
      <button type="button" className="console-button" onClick={() => setAsking(true)}>
        Desconectar
      </button>
    );
  }
  return (
    <form
      action={action}
      className="flex basis-full flex-col gap-3 border-l border-tally-red/60 pl-4"
    >
      <input type="hidden" name="slug" value={brandSlug} />
      <p className="max-w-xl text-sm text-ink-dim">
        Se revoca el acceso en TikTok y se borran los tokens. {brandName} deja de publicar en TikTok
        hasta que la conectes de nuevo.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="console-button console-button-danger" disabled={pending}>
          {pending ? "Desconectando…" : "Desconectar TikTok"}
        </button>
        <button
          type="button"
          className="console-button"
          onClick={() => setAsking(false)}
          disabled={pending}
        >
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

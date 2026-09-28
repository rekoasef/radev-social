"use client";

import { useActionState, useState } from "react";
import { type DiscardState, discardPostAction } from "@/app/(panel)/posts/actions";

const idle: DiscardState = { status: "idle" };

/** What discarding does, and the button that does it. Used inline and in the review sheet. */
export function DiscardForm({
  code,
  scheduled,
  from,
  onCancel,
}: {
  code: string;
  /** It has a publish time: say it gets freed. */
  scheduled: boolean;
  /** "review": back to the queue afterwards. */
  from?: "review";
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(discardPostAction, idle);
  return (
    <form action={action} className="flex max-w-xl flex-col gap-3">
      <input type="hidden" name="code" value={code} />
      {from && <input type="hidden" name="from" value={from} />}
      <p className="text-sm text-ink-dim">
        {code} sale de las listas, del calendario y de la cola, y no se publica.
        {scheduled ? " Su horario queda libre para otro post." : ""} No se puede deshacer.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="console-button console-button-danger" disabled={pending}>
          {pending ? "Descartando…" : `Descartar ${code}`}
        </button>
        <button type="button" className="console-button" onClick={onCancel} disabled={pending}>
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

/** "Descartar" on the post's page: asks first, right there. */
export function DiscardButton({ code, scheduled }: { code: string; scheduled: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className="console-button" onClick={() => setAsking(true)}>
        Descartar
      </button>
    );
  }
  return (
    <div className="basis-full border-l border-tally-red/60 pl-4">
      <DiscardForm code={code} scheduled={scheduled} onCancel={() => setAsking(false)} />
    </div>
  );
}

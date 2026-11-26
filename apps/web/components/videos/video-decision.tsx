"use client";

import { useActionState, useId, useState } from "react";
import {
  approveVideoAction,
  type DeskState,
  rejectVideoAction,
  reopenVideoAction,
} from "@/app/(panel)/videos/desk-actions";
import { DeskErrors } from "./desk-errors";

const idle: DeskState = { status: "idle" };
const number = new Intl.NumberFormat("es-AR");

/** The second desk's answer: approve, or send it back to the office that can fix it. */
export function VideoDecision({
  videoId,
  version,
  characters,
  paused,
}: {
  videoId: string;
  version: number;
  characters: number;
  paused: boolean;
}) {
  const [approval, approve, approving] = useActionState(approveVideoAction, idle);
  const [rejection, reject, rejecting] = useActionState(rejectVideoAction, idle);
  const [note, setNote] = useState("");
  const noteId = useId();
  const approveForm = useId();
  const busy = approving || rejecting || paused;

  const destinations = [
    {
      value: "render",
      name: "Render",
      cost: "Arma de nuevo con el mismo guion y la misma voz: sirve si el video salió mal. No gasta voz.",
    },
    {
      value: "voice",
      name: "Locución",
      cost: `Otra toma de voz: unos ${number.format(characters)} créditos.`,
    },
    {
      value: "script",
      name: "Guion",
      cost: "La IA lo reescribe con tu nota (texto o imágenes). Después lo aprobás de nuevo.",
    },
  ];
  const target = (
    <>
      <input type="hidden" name="videoId" value={videoId} />
      <input type="hidden" name="version" value={version} />
    </>
  );

  return (
    <>
      <section aria-label="Decisión" className="desk-panel flex flex-col gap-3">
        <form action={approve} id={approveForm} className="flex flex-col">
          {target}
          <button type="submit" className="console-button console-button-primary" disabled={busy}>
            {approving ? "Aprobando…" : "Aprobar video"}
          </button>
        </form>
        <p className="text-sm text-ink-faint">
          Habilita la descarga del paquete.
          {paused && " Está pausado: retomalo antes de aprobar."}
        </p>
        {approval.status === "error" && <DeskErrors messages={approval.messages} />}

        <form action={reject} className="flex flex-col gap-3 border-t border-bezel pt-3">
          {target}
          <fieldset className="flex flex-col gap-1.5">
            <legend className="plate-text mb-1.5 text-ink-dim">Devolver a</legend>
            {destinations.map((d, i) => (
              <label key={d.value} className="voice-option items-start py-2.5 text-[13px]">
                <input
                  type="radio"
                  name="to"
                  value={d.value}
                  defaultChecked={i === 0}
                  className="mt-0.5 size-4 shrink-0 accent-ink"
                />
                <span>
                  <span className="block text-ink">{d.name}</span>
                  <span className="block text-xs text-ink-faint">{d.cost}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <label htmlFor={noteId} className="sr-only">
            Qué hay que cambiar
          </label>
          <textarea
            id={noteId}
            name="note"
            rows={3}
            lang="es"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Qué hay que cambiar."
            className="console-field w-full scroll-mt-32 text-sm"
          />
          {rejection.status === "error" && <DeskErrors messages={rejection.messages} />}
          <button type="submit" className="console-button" disabled={busy || !note.trim()}>
            {rejecting ? "Devolviendo…" : "Devolver con la nota"}
          </button>
        </form>
      </section>

      <div className="review-bar md:hidden">
        <div className="flex gap-2">
          <button
            type="button"
            className="console-button"
            onClick={() => document.getElementById(noteId)?.focus()}
          >
            Devolver
          </button>
          <button
            type="submit"
            form={approveForm}
            className="console-button console-button-primary flex-1"
            disabled={busy}
          >
            {approving ? "Aprobando…" : "Aprobar video"}
          </button>
        </div>
      </div>
    </>
  );
}

/** An approved video that needs another look: back to the desk. */
export function ReopenVideo({ videoId }: { videoId: string }) {
  const [state, action, pending] = useActionState(reopenVideoAction, idle);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="videoId" value={videoId} />
      <button type="submit" className="console-button" disabled={pending}>
        {pending ? "Reabriendo…" : "Volver a revisar"}
      </button>
      {state.status === "error" && <DeskErrors messages={state.messages} />}
    </form>
  );
}

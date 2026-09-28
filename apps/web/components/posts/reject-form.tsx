"use client";

import { REJECTION_FEEDBACK_MAX, REJECTION_FEEDBACK_MIN } from "@radev/core";
import { useActionState, useId, useState } from "react";
import { type RejectState, rejectPostAction } from "@/app/(panel)/posts/actions";

const idle: RejectState = { status: "idle" };

/**
 * "Rechazar": the operator says what to change and the AI writes a new version from this one.
 * Folded behind a button so the review screen stays about the images. From the review queue it
 * comes already open inside a sheet, with quick phrases to start from (phase 4, T7).
 */
export function RejectForm({
  code,
  versionId,
  from,
  onCancel,
  suggestions = [],
}: {
  code: string;
  versionId: string;
  /** "review": back to the queue after rejecting. */
  from?: "review";
  /** Given: the form starts open and "Cancelar" calls it (the sheet closes). */
  onCancel?: () => void;
  suggestions?: readonly string[];
}) {
  const [state, action, pending] = useActionState(rejectPostAction, idle);
  const [open, setOpen] = useState(onCancel !== undefined);
  const [feedback, setFeedback] = useState("");
  const id = useId();
  const length = feedback.trim().length;

  if (!open) {
    return (
      <button type="button" className="console-button" onClick={() => setOpen(true)}>
        Rechazar
      </button>
    );
  }

  return (
    <form action={action} className="flex w-full max-w-3xl flex-col gap-3">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="versionId" value={versionId} />
      {from && <input type="hidden" name="from" value={from} />}
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 text-sm">
        <span className="plate-text text-ink-faint">¿Qué cambiarías?</span>
        <span
          className={`timecode text-xs ${length > REJECTION_FEEDBACK_MAX ? "text-tally-red" : "text-ink-faint"}`}
        >
          {length}/{REJECTION_FEEDBACK_MAX}
        </span>
      </label>
      <textarea
        id={id}
        name="feedback"
        rows={3}
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        required
        lang="es"
        // biome-ignore lint/a11y/noAutofocus: opened on purpose by the operator's click
        autoFocus
        placeholder="Ej.: el hook es muy genérico; mencioná el costo de perder clientes y sacá la slide de pasos."
        className="console-field w-full text-sm leading-relaxed"
      />
      {suggestions.length > 0 && (
        <ul
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
          aria-label="Frases rápidas"
        >
          {suggestions.map((phrase) => (
            <li key={phrase}>
              <button
                type="button"
                className="console-chip whitespace-nowrap"
                onClick={() =>
                  setFeedback((text) => (text.trim() ? `${text.trim()} ${phrase}` : phrase))
                }
              >
                {phrase}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-ink-faint">
        La IA reescribe el carrusel desde esta versión con lo que le pidas. Esta versión queda en el
        historial.
      </p>
      {state.status === "limit" && (
        <div role="alert" className="flex flex-col gap-2 border-l border-tally-amber pl-3 text-sm">
          <p className="text-ink">{state.message}</p>
          <label className="flex items-center gap-2 text-ink-dim">
            <input type="checkbox" name="confirmOverLimit" />
            Generar igual
          </label>
        </div>
      )}
      {state.status === "error" && (
        <p role="alert" className="border-l border-tally-red pl-3 text-sm text-ink">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="console-button console-button-primary"
          disabled={pending || length < REJECTION_FEEDBACK_MIN || length > REJECTION_FEEDBACK_MAX}
        >
          {pending ? "Encolando…" : "Rechazar y regenerar"}
        </button>
        <button
          type="button"
          className="console-button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setFeedback("");
            onCancel?.();
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

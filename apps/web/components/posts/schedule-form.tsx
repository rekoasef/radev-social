"use client";

import { useActionState, useId, useState } from "react";
import { type ScheduleState, schedulePostAction } from "@/app/(panel)/posts/schedule-actions";

const idle: ScheduleState = { status: "idle" };

export type SlotChoice = {
  /** "<slot id>|<ISO instant>", as the action expects it. */
  value: string;
  /** "Lunes 28/09 · 19:00", in the brand's zone. */
  label: string;
};

/**
 * Schedule (or reschedule) a post: one of the brand's free slot times, or a date and time picked
 * by hand in the brand's zone.
 */
export function ScheduleForm({
  code,
  choices,
  zoneLabel,
  rescheduling,
}: {
  code: string;
  choices: SlotChoice[];
  /** "Buenos Aires, GMT-3": the zone times are in. */
  zoneLabel: string;
  rescheduling: boolean;
}) {
  const [state, action, pending] = useActionState(schedulePostAction, idle);
  const [mode, setMode] = useState<"slot" | "custom">(choices.length > 0 ? "slot" : "custom");
  const ids = { slot: useId(), custom: useId() };

  return (
    <form action={action} className="flex max-w-xl flex-col gap-3">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="mode" value={mode} />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm text-ink">
          {rescheduling ? "Reprogramar" : "Programar"}{" "}
          <span className="text-ink-faint">(hora de la marca: {zoneLabel})</span>
        </legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {choices.length > 0 && (
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-bezel px-3 text-sm text-ink has-[:checked]:border-ink-dim">
              <input
                type="radio"
                name="modeChoice"
                checked={mode === "slot"}
                onChange={() => setMode("slot")}
                className="accent-[var(--color-ink)]"
              />
              En un horario de la marca
            </label>
          )}
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-bezel px-3 text-sm text-ink has-[:checked]:border-ink-dim">
            <input
              type="radio"
              name="modeChoice"
              checked={mode === "custom"}
              onChange={() => setMode("custom")}
              className="accent-[var(--color-ink)]"
            />
            Otra fecha y hora
          </label>
        </div>
        {mode === "slot" ? (
          <select
            id={ids.slot}
            name="slot"
            aria-label="Horario"
            required
            className="console-field w-full sm:w-auto"
          >
            {choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={ids.custom}
            type="datetime-local"
            name="localDateTime"
            aria-label="Fecha y hora"
            required
            step={300}
            className="console-field w-full sm:w-auto"
          />
        )}
      </fieldset>
      {choices.length === 0 && (
        <p className="text-sm text-ink-faint">
          La marca no tiene horarios libres en los próximos días (Marcas → Horarios).
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="console-button console-button-primary" disabled={pending}>
          {pending ? "Guardando…" : rescheduling ? "Reprogramar" : "Programar"}
        </button>
        {state.status === "ok" && (
          <p role="status" className="text-sm text-ink-dim">
            {state.message}
          </p>
        )}
        {state.status === "error" && (
          <p role="alert" className="text-sm text-tally-red">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

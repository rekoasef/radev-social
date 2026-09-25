"use client";

import type { GenerationWindow } from "@radev/core";
import { useActionState, useId } from "react";
import { saveGenerationWindowAction, type WindowFormState } from "@/app/(panel)/settings/actions";

const idle: WindowFormState = { status: "idle" };

/** When the automatic filling may start posts for the AI (phase 4, T4). */
export function GenerationWindowForm({
  window,
  timeZones,
}: {
  window: GenerationWindow;
  timeZones: string[];
}) {
  const [state, action, pending] = useActionState(saveGenerationWindowAction, idle);
  const ids = { enabled: useId(), start: useId(), end: useId(), zone: useId() };
  return (
    <form action={action} className="flex max-w-3xl flex-col gap-4">
      <label htmlFor={ids.enabled} className="flex min-h-11 items-center gap-3 text-sm text-ink">
        <input
          id={ids.enabled}
          type="checkbox"
          name="enabled"
          defaultChecked={window.enabled}
          className="size-4 accent-[var(--color-ink)]"
        />
        Llenar los horarios solo, dentro de esta ventana
      </label>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.start} className="plate-text text-ink-faint">
            Desde
          </label>
          <input
            id={ids.start}
            type="time"
            name="start"
            required
            defaultValue={window.start}
            step={900}
            className="console-field w-32"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.end} className="plate-text text-ink-faint">
            Hasta
          </label>
          <input
            id={ids.end}
            type="time"
            name="end"
            required
            defaultValue={window.end}
            step={900}
            className="console-field w-32"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={ids.zone} className="plate-text text-ink-faint">
            Zona horaria
          </label>
          <select
            id={ids.zone}
            name="timeZone"
            defaultValue={window.timeZone}
            className="console-field w-full sm:w-72"
          >
            {timeZones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="console-button console-button-primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
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

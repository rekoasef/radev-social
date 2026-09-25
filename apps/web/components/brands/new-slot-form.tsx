"use client";

import { WEEK_ORDER, WEEKDAY_SHORT } from "@radev/core";
import { useActionState, useId } from "react";
import { addSlotsAction, type SlotFormState } from "@/app/(panel)/brands/[slug]/schedule/actions";

const idle: SlotFormState = { status: "idle" };

/** A publishing time on the chosen weekdays (every day by default). */
export function NewSlotForm({ brandSlug }: { brandSlug: string }) {
  const [state, action, pending] = useActionState(addSlotsAction, idle);
  const timeId = useId();

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-4">
      <input type="hidden" name="slug" value={brandSlug} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={timeId} className="plate-text text-ink-faint">
          Hora (de la marca)
        </label>
        <input
          id={timeId}
          type="time"
          name="localTime"
          required
          defaultValue="19:00"
          step={300}
          className="console-field w-36"
        />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="plate-text mb-1.5 text-ink-faint">Días</legend>
        <div className="flex flex-wrap gap-2">
          {WEEK_ORDER.map((day) => (
            <label
              key={day}
              className="flex min-h-11 items-center gap-2 rounded-md border border-bezel px-3 text-sm text-ink has-[:checked]:border-ink-dim"
            >
              <input
                type="checkbox"
                name="weekdays"
                value={day}
                defaultChecked
                className="size-4 accent-[var(--color-ink)]"
              />
              {WEEKDAY_SHORT[day]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="console-button" disabled={pending}>
          {pending ? "Agregando…" : "Agregar horario"}
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

"use client";

import { useActionState, useId } from "react";
import { type AiLimitsFormState, saveAiLimitsAction } from "@/app/(panel)/brands/actions";

const idle: AiLimitsFormState = { status: "idle" };

/** A brand's caps of successful AI generations per day and per month. Empty: no cap. */
export function AiLimitsForm({
  id,
  daily,
  monthly,
  usage,
  readOnly,
}: {
  id: string;
  daily: number | null;
  monthly: number | null;
  usage: { today: number; month: number };
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(saveAiLimitsAction, idle);
  const ids = { daily: useId(), monthly: useId() };
  const fields = [
    { id: ids.daily, name: "daily", label: "Por día", value: daily, used: usage.today },
    { id: ids.monthly, name: "monthly", label: "Por mes", value: monthly, used: usage.month },
  ];

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-6">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-6 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.name} className="flex flex-col gap-2">
            <label htmlFor={field.id} className="plate-text text-ink-faint">
              {field.label}
            </label>
            <input
              id={field.id}
              name={field.name}
              type="number"
              inputMode="numeric"
              min={0}
              max={1000}
              step={1}
              defaultValue={field.value ?? ""}
              placeholder="Sin tope"
              readOnly={readOnly}
              className="console-field timecode"
            />
            <p className="text-sm text-ink-faint">
              Usadas: {field.used}
              {field.value !== null && ` de ${field.value}`}
            </p>
          </div>
        ))}
      </div>
      <p className="text-sm text-ink-faint">
        Cuentan las generaciones exitosas, en la zona horaria de la marca. Vacío es sin tope; 0
        pausa la generación.
      </p>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className="console-button console-button-primary"
            disabled={pending}
          >
            {pending ? "Guardando…" : "Guardar topes"}
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
      )}
    </form>
  );
}

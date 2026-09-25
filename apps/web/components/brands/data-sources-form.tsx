"use client";

import { DATA_SOURCE_LABELS, DATA_SOURCES } from "@radev/core";
import { useActionState } from "react";
import { type DataSourcesFormState, saveDataSourcesAction } from "@/app/(panel)/brands/actions";

const idle: DataSourcesFormState = { status: "idle" };

/**
 * Which real data a brand's content may show (phase 3, T11). With a source on, the AI gets its
 * numbers (`data.json`) and may use charts and big numbers; the editor offers its charts.
 */
export function DataSourcesForm({
  id,
  sources,
  readOnly,
}: {
  id: string;
  sources: readonly string[];
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(saveDataSourcesAction, idle);
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Fuentes de datos</legend>
        {DATA_SOURCES.map((source) => (
          <label key={source} className="flex items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              name="sources"
              value={source}
              defaultChecked={sources.includes(source)}
              disabled={readOnly}
              className="size-4 accent-[var(--color-ink)]"
            />
            {DATA_SOURCE_LABELS[source]}
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-ink-faint">
        Con una fuente activa, la IA recibe sus números del día y puede usar gráficos y cifras
        grandes, y el editor ofrece sus gráficos. Sin fuentes, la IA no muestra cifras.
      </p>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className="console-button console-button-primary"
            disabled={pending}
          >
            {pending ? "Guardando…" : "Guardar fuentes"}
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

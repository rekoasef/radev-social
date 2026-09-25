"use client";

import {
  IDEA_COUNT_DEFAULT,
  IDEA_COUNT_MAX,
  IDEA_COUNT_MIN,
  type IdeaRequestTask,
  RESEARCH_FOCUS_MAX,
} from "@radev/core";
import { useActionState, useId } from "react";
import { type IdeaFormState, requestIdeasAction } from "@/app/(panel)/ideas/actions";

const idle: IdeaFormState = { status: "idle" };
const COUNTS = Array.from(
  { length: IDEA_COUNT_MAX - IDEA_COUNT_MIN + 1 },
  (_, i) => IDEA_COUNT_MIN + i,
);

type Option = { key: string; name: string };

/**
 * "Proponer ideas" (free model, from pillars, series and history) and "Investigar temas" (Claude
 * with web search). Each one queues a request; the list below shows how it goes.
 */
export function AskAiForms({
  brand,
  pillars,
  series,
  open,
}: {
  brand: { id: string; name: string };
  pillars: Option[];
  series: Option[];
  /** Tasks with a request waiting or running: their button waits. */
  open: readonly IdeaRequestTask[];
}) {
  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      <RequestForm
        brand={brand}
        task="ideas.generate"
        title="Proponer ideas"
        lead="Con los pilares, las series y lo que ya publicaste. Usa el modelo gratuito."
        button="Proponer"
        pillars={pillars}
        series={series}
        busy={open.includes("ideas.generate")}
      />
      <RequestForm
        brand={brand}
        task="ideas.research"
        title="Investigar temas"
        lead="Claude busca en la web qué se está hablando en el nicho y trae ideas con sus fuentes. Tarda unos minutos y usa la suscripción."
        button="Investigar"
        pillars={pillars}
        series={[]}
        busy={open.includes("ideas.research")}
      />
    </div>
  );
}

function RequestForm({
  brand,
  task,
  title,
  lead,
  button,
  pillars,
  series,
  busy,
}: {
  brand: { id: string; name: string };
  task: IdeaRequestTask;
  title: string;
  lead: string;
  button: string;
  pillars: Option[];
  series: Option[];
  busy: boolean;
}) {
  const [state, action, pending] = useActionState(requestIdeasAction, idle);
  const ids = { count: useId(), pillar: useId(), series: useId(), focus: useId() };

  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-md border border-bezel px-4 py-4"
      aria-label={title}
    >
      <input type="hidden" name="brandId" value={brand.id} />
      <input type="hidden" name="task" value={task} />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-sm text-ink-faint">{lead}</p>
      </div>
      {task === "ideas.research" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.focus} className="plate-text text-ink-faint">
            Foco (opcional)
          </label>
          <input
            id={ids.focus}
            name="focus"
            maxLength={RESEARCH_FOCUS_MAX}
            lang="es"
            autoComplete="off"
            placeholder="Ej.: turnos y recordatorios en consultorios"
            className="console-field w-full"
          />
        </div>
      )}
      <div className="grid grid-cols-[5rem_1fr] gap-3 sm:grid-cols-[5rem_1fr_1fr]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.count} className="plate-text text-ink-faint">
            Cantidad
          </label>
          <select
            id={ids.count}
            name="count"
            defaultValue={IDEA_COUNT_DEFAULT}
            className="console-field timecode"
          >
            {COUNTS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={ids.pillar} className="plate-text text-ink-faint">
            Pilar
          </label>
          <select id={ids.pillar} name="pillarKey" defaultValue="" className="console-field">
            <option value="">Todos</option>
            {pillars.map((pillar) => (
              <option key={pillar.key} value={pillar.key}>
                {pillar.name}
              </option>
            ))}
          </select>
        </div>
        {series.length > 0 && (
          <div className="col-span-2 flex min-w-0 flex-col gap-1.5 sm:col-span-1">
            <label htmlFor={ids.series} className="plate-text text-ink-faint">
              Serie
            </label>
            <select id={ids.series} name="seriesKey" defaultValue="" className="console-field">
              <option value="">Cualquiera o ninguna</option>
              {series.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="console-button" disabled={pending || busy}>
          {pending ? "Encolando…" : busy ? "En curso…" : button}
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

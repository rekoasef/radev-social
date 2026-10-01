"use client";

import {
  PILLAR_AVOID_MAX,
  PILLAR_CLOSING_MAX,
  PILLAR_GOAL_LABELS,
  PILLAR_GOALS,
  PILLAR_GUIDE_MAX,
  PILLAR_HOOKS_MAX,
  type PillarGoal,
} from "@radev/core";
import { HOOK_TYPES } from "@radev/slides";
import { useActionState, useId, useState } from "react";
import {
  type PillarFormState,
  savePillarGuideAction,
} from "@/app/(panel)/brands/[slug]/pillars/actions";
import { HOOK_LABELS } from "@/lib/hooks";

const idle: PillarFormState = { status: "idle" };

export type GuidePillar = {
  id: string;
  name: string;
  goal: PillarGoal | null;
  hookTypes: string[];
  guide: string;
  closing: string;
  avoid: string;
};

/**
 * How the AI writes one pillar's posts (ADR 0021): goal, preferred hooks, how they're told, how
 * they close and what they avoid. Folded, with a summary of what's set, so the list stays short.
 */
export function PillarGuideForm({
  brandSlug,
  pillar,
  readOnly,
}: {
  brandSlug: string;
  pillar: GuidePillar;
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(savePillarGuideAction, idle);
  const [hooks, setHooks] = useState(() => new Set(pillar.hookTypes));
  const ids = { goal: useId(), guide: useId(), closing: useId(), avoid: useId() };
  const empty =
    !pillar.goal &&
    pillar.hookTypes.length === 0 &&
    !pillar.guide &&
    !pillar.closing &&
    !pillar.avoid;
  const summary = empty
    ? "Sin instrucciones: la IA solo tiene la descripción"
    : [
        pillar.goal && PILLAR_GOAL_LABELS[pillar.goal],
        pillar.hookTypes.length > 0 &&
          pillar.hookTypes.map((h) => HOOK_LABELS[h as keyof typeof HOOK_LABELS] ?? h).join(", "),
      ]
        .filter(Boolean)
        .join(" · ") || "Con instrucciones";

  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
        <span className="text-sm text-ink">{pillar.name}</span>
        <span className={`text-xs ${empty ? "text-tally-amber" : "text-ink-faint"}`}>
          {summary}
        </span>
      </summary>
      <form action={action} className="flex flex-col gap-4 px-4 pt-1 pb-5">
        <input type="hidden" name="slug" value={brandSlug} />
        <input type="hidden" name="pillar" value={pillar.id} />
        <div className="flex flex-col gap-1.5 sm:w-56">
          <label htmlFor={ids.goal} className="plate-text text-ink-faint">
            Objetivo
          </label>
          <select
            id={ids.goal}
            name="goal"
            defaultValue={pillar.goal ?? ""}
            disabled={readOnly}
            className="console-field"
          >
            <option value="">Sin definir</option>
            {PILLAR_GOALS.map((goal) => (
              <option key={goal} value={goal}>
                {PILLAR_GOAL_LABELS[goal]}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="plate-text mb-1.5 text-ink-faint">
            Ganchos preferidos (hasta {PILLAR_HOOKS_MAX})
          </legend>
          <div className="flex flex-wrap gap-2">
            {HOOK_TYPES.map((hook) => (
              <label
                key={hook}
                className="flex min-h-11 items-center gap-2 rounded-md border border-bezel px-3 text-sm text-ink has-[:checked]:border-ink-dim has-[:disabled]:opacity-50"
              >
                <input
                  type="checkbox"
                  name="hookTypes"
                  value={hook}
                  checked={hooks.has(hook)}
                  onChange={(event) => {
                    const next = new Set(hooks);
                    if (event.target.checked) next.add(hook);
                    else next.delete(hook);
                    setHooks(next);
                  }}
                  disabled={readOnly || (!hooks.has(hook) && hooks.size >= PILLAR_HOOKS_MAX)}
                  className="size-4 accent-[var(--color-ink)]"
                />
                {HOOK_LABELS[hook]}
              </label>
            ))}
          </div>
          <p className="text-sm text-ink-faint">
            Una preferencia: si elegís otro gancho al generar, gana el tuyo.
          </p>
        </fieldset>
        <GuideField
          id={ids.guide}
          name="guide"
          label="Cómo se cuenta"
          hint="Ángulo, formatos que le sirven y ejemplos de temas."
          defaultValue={pillar.guide}
          max={PILLAR_GUIDE_MAX}
          rows={4}
          readOnly={readOnly}
        />
        <GuideField
          id={ids.closing}
          name="closing"
          label="Cómo cierra"
          hint="Qué le pide el post a quien lo ve."
          defaultValue={pillar.closing}
          max={PILLAR_CLOSING_MAX}
          rows={2}
          readOnly={readOnly}
        />
        <GuideField
          id={ids.avoid}
          name="avoid"
          label="Evitar"
          hint="Lo que no va en este pilar."
          defaultValue={pillar.avoid}
          max={PILLAR_AVOID_MAX}
          rows={2}
          readOnly={readOnly}
        />
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" className="console-button" disabled={pending}>
              {pending ? "Guardando…" : "Guardar instrucciones"}
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
    </details>
  );
}

function GuideField({
  id,
  name,
  label,
  hint,
  defaultValue,
  max,
  rows,
  readOnly,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  defaultValue: string;
  max: number;
  rows: number;
  readOnly: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="plate-text text-ink-faint">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        maxLength={max}
        lang="es"
        readOnly={readOnly}
        aria-describedby={`${id}-hint`}
        className="console-field w-full text-sm leading-relaxed"
      />
      <p id={`${id}-hint`} className="text-sm text-ink-faint">
        {hint}
      </p>
    </div>
  );
}

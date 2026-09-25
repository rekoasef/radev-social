"use client";

import { SERIES_BRIEF_MAX, SERIES_NAME_MAX, SERIES_REQUIRED_SLIDES_MAX } from "@radev/core";
import { HOOK_TYPES, SLIDE_LABELS, type SlideType } from "@radev/slides";
import { useActionState, useId } from "react";
import {
  createSeriesAction,
  type SeriesFormState,
  updateSeriesAction,
} from "@/app/(panel)/brands/[slug]/series/actions";
import { HOOK_LABELS } from "@/lib/hooks";

const idle: SeriesFormState = { status: "idle" };

export type SeriesValues = {
  id: string;
  key: string;
  name: string;
  pillarKey: string | null;
  hookType: string | null;
  brief: string;
  requiredSlides: string[];
};

/**
 * A series of the brand: name, pillar and hook of its posts, the structure the AI follows and
 * the slide types every post of it has. Without `values`, it creates one.
 */
export function SeriesForm({
  brandSlug,
  values,
  pillars,
  slideChoices,
  readOnly = false,
}: {
  brandSlug: string;
  values?: SeriesValues;
  pillars: { key: string; name: string }[];
  slideChoices: readonly SlideType[];
  readOnly?: boolean;
}) {
  const [state, action, pending] = useActionState(
    values ? updateSeriesAction : createSeriesAction,
    idle,
  );
  const ids = { name: useId(), pillar: useId(), hook: useId(), brief: useId() };

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-4">
      <input type="hidden" name="slug" value={brandSlug} />
      {values && <input type="hidden" name="id" value={values.id} />}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.name} className="plate-text text-ink-faint">
          Nombre
        </label>
        <input
          id={ids.name}
          name="name"
          defaultValue={values?.name}
          required
          minLength={3}
          maxLength={SERIES_NAME_MAX}
          readOnly={readOnly}
          placeholder="Ej.: ¿Cuánto cuesta realmente…?"
          className="console-field w-full"
        />
        {values && (
          <p className="text-sm text-ink-faint">
            Clave: <span className="timecode">{values.key}</span> (no cambia).
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.pillar} className="plate-text text-ink-faint">
            Pilar de sus posts
          </label>
          <select
            id={ids.pillar}
            name="pillarKey"
            defaultValue={values?.pillarKey ?? ""}
            disabled={readOnly}
            className="console-field"
          >
            <option value="">Que elija la IA</option>
            {pillars.map((pillar) => (
              <option key={pillar.key} value={pillar.key}>
                {pillar.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.hook} className="plate-text text-ink-faint">
            Tipo de hook
          </label>
          <select
            id={ids.hook}
            name="hookType"
            defaultValue={values?.hookType ?? ""}
            disabled={readOnly}
            className="console-field"
          >
            <option value="">Que elija la IA</option>
            {HOOK_TYPES.map((hook) => (
              <option key={hook} value={hook}>
                {HOOK_LABELS[hook]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.brief} className="plate-text text-ink-faint">
          Estructura (la lee la IA)
        </label>
        <textarea
          id={ids.brief}
          name="brief"
          defaultValue={values?.brief}
          rows={8}
          required
          maxLength={SERIES_BRIEF_MAX}
          lang="es"
          readOnly={readOnly}
          placeholder={"De qué trata cada post y qué va en cada slide, en orden.\n1. `cover`: …"}
          className="console-field w-full font-mono text-sm leading-relaxed"
        />
      </div>
      <fieldset className="flex flex-col gap-2" disabled={readOnly}>
        <legend className="plate-text mb-2 text-ink-faint">
          Slides obligatorias (hasta {SERIES_REQUIRED_SLIDES_MAX})
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {slideChoices.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm text-ink-dim">
              <input
                type="checkbox"
                name="requiredSlides"
                value={type}
                defaultChecked={values?.requiredSlides.includes(type)}
              />
              {SLIDE_LABELS[type]}
            </label>
          ))}
        </div>
        <p className="text-sm text-ink-faint">
          Un post de la serie sin estas slides no se acepta. Portada y cierre van siempre.
        </p>
      </fieldset>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className={values ? "console-button console-button-primary" : "console-button"}
            disabled={pending}
          >
            {pending ? "Guardando…" : values ? "Guardar serie" : "Crear serie"}
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

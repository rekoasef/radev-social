"use client";

import { IDEA_ANGLE_MAX, IDEA_TITLE_MAX, IDEA_TITLE_MIN } from "@radev/core";
import { useActionState, useId } from "react";
import { createIdeaAction, type IdeaFormState } from "@/app/(panel)/ideas/actions";

const idle: IdeaFormState = { status: "idle" };

/**
 * Quick load: one line and Enter, from the phone too. The angle and the pillar are optional and
 * stay folded. The fields clear after saving, ready for the next idea.
 */
export function QuickIdeaForm({
  brand,
  pillars,
}: {
  brand: { id: string; name: string };
  pillars: { key: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createIdeaAction, idle);
  const ids = { title: useId(), angle: useId(), pillar: useId() };

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-3">
      <input type="hidden" name="brandId" value={brand.id} />
      <label htmlFor={ids.title} className="sr-only">
        Idea para {brand.name}
      </label>
      <div className="flex gap-2">
        <input
          id={ids.title}
          name="title"
          required
          minLength={IDEA_TITLE_MIN}
          maxLength={IDEA_TITLE_MAX}
          autoComplete="off"
          enterKeyHint="send"
          lang="es"
          placeholder={`Una idea para ${brand.name}…`}
          className="console-field min-w-0 flex-1"
        />
        <button
          type="submit"
          className="console-button console-button-primary shrink-0"
          disabled={pending}
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
      <details className="group">
        <summary className="plate-text w-fit cursor-pointer text-ink-faint hover:text-ink">
          Ángulo y pilar (opcional)
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_14rem]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.angle} className="plate-text text-ink-faint">
              Ángulo
            </label>
            <textarea
              id={ids.angle}
              name="angle"
              rows={2}
              maxLength={IDEA_ANGLE_MAX}
              lang="es"
              placeholder="Desde dónde contarla, para quién, qué dato usar…"
              className="console-field w-full text-sm leading-relaxed"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.pillar} className="plate-text text-ink-faint">
              Pilar
            </label>
            <select id={ids.pillar} name="pillarKey" defaultValue="" className="console-field">
              <option value="">Que elija la IA</option>
              {pillars.map((pillar) => (
                <option key={pillar.key} value={pillar.key}>
                  {pillar.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>
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
    </form>
  );
}

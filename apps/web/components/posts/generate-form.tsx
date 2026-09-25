"use client";

import { HOOK_TYPES } from "@radev/slides";
import { useActionState, useId, useState } from "react";
import { type GenerateState, generateCarouselAction } from "@/app/(panel)/posts/actions";
import { HOOK_LABELS } from "@/lib/hooks";

const idle: GenerateState = { status: "idle" };

/**
 * "Generar con IA": an idea, and optionally the pillar and hook. The worker writes the rest.
 * From the idea bank it comes filled in, and the bank idea turns used when the post is created.
 */
export function GenerateForm({
  brand,
  pillars,
  fromIdea,
}: {
  brand: { id: string; name: string };
  pillars: { key: string; name: string }[];
  fromIdea?: { id: string; text: string; pillarKey: string | null };
}) {
  const [state, action, pending] = useActionState(generateCarouselAction, idle);
  const [idea, setIdea] = useState(fromIdea?.text ?? "");
  const ids = { idea: useId(), pillar: useId(), hook: useId() };
  const length = idea.trim().length;

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-5">
      <input type="hidden" name="brandId" value={brand.id} />
      {fromIdea && <input type="hidden" name="ideaId" value={fromIdea.id} />}
      <div className="flex flex-col gap-2">
        <label
          htmlFor={ids.idea}
          className="flex items-baseline justify-between gap-3 text-sm text-ink-dim"
        >
          <span className="plate-text text-ink-faint">Idea</span>
          <span
            className={`timecode text-xs ${length > 600 ? "text-tally-red" : "text-ink-faint"}`}
          >
            {length}/600
          </span>
        </label>
        <textarea
          id={ids.idea}
          name="idea"
          rows={4}
          value={idea}
          onChange={(event) => setIdea(event.target.value)}
          required
          lang="es"
          placeholder="Ej.: por qué un negocio pierde clientes por tardar en responder WhatsApp, y cómo automatizar las respuestas frecuentes."
          className="console-field w-full text-sm leading-relaxed"
        />
        <p className="text-sm text-ink-faint">
          Contá el tema y el ángulo. La IA escribe con la voz, las reglas, los precios y los casos
          de {brand.name}.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.pillar} className="plate-text text-ink-faint">
            Pilar
          </label>
          <select
            id={ids.pillar}
            name="pillarKey"
            defaultValue={fromIdea?.pillarKey ?? ""}
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
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.hook} className="plate-text text-ink-faint">
            Tipo de hook
          </label>
          <select id={ids.hook} name="hookType" defaultValue="" className="console-field">
            <option value="">Que elija la IA</option>
            {HOOK_TYPES.map((hook) => (
              <option key={hook} value={hook}>
                {HOOK_LABELS[hook]}
              </option>
            ))}
          </select>
        </div>
      </div>

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

      <div>
        <button
          type="submit"
          className="console-button console-button-primary"
          disabled={pending || length < 10 || length > 600}
        >
          {pending ? "Encolando…" : "Generar con IA"}
        </button>
      </div>
    </form>
  );
}

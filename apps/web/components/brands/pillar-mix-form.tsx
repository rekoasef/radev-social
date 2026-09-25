"use client";

import { PILLAR_DESCRIPTION_MAX, PILLAR_NAME_MAX } from "@radev/core";
import { useActionState, useState } from "react";
import {
  archivePillarAction,
  deletePillarAction,
  type PillarFormState,
  savePillarMixAction,
} from "@/app/(panel)/brands/[slug]/pillars/actions";

const idle: PillarFormState = { status: "idle" };

export type MixPillar = {
  id: string;
  key: string;
  name: string;
  description: string;
  percent: number;
  postCount: number;
};

/**
 * The active pillars of a brand, edited together so the total can be checked as you type. A
 * pillar at 0 % (saved) can leave the mix: archived if it has posts, deleted if it has none.
 */
export function PillarMixForm({
  brandSlug,
  pillars,
  readOnly,
}: {
  brandSlug: string;
  pillars: MixPillar[];
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(savePillarMixAction, idle);
  const [percents, setPercents] = useState(() => pillars.map((p) => String(p.percent)));
  const total = percents.reduce((sum, value) => sum + (Number(value) || 0), 0);
  const balanced = total === 100;

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-4">
      <input type="hidden" name="slug" value={brandSlug} />
      <ul className="flex flex-col divide-y divide-bezel rounded-md border border-bezel">
        {pillars.map((pillar, i) => (
          <li key={pillar.id} className="flex flex-col gap-3 px-4 py-4">
            <input type="hidden" name="id" value={pillar.id} />
            <div className="flex items-end gap-3">
              <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="plate-text text-ink-faint">Nombre</span>
                <input
                  name="name"
                  defaultValue={pillar.name}
                  required
                  maxLength={PILLAR_NAME_MAX}
                  readOnly={readOnly}
                  className="console-field w-full"
                />
              </label>
              <label className="flex w-24 shrink-0 flex-col gap-1.5">
                <span className="plate-text text-ink-faint">Mezcla</span>
                <span className="relative">
                  <input
                    name="percent"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    step={1}
                    required
                    value={percents[i]}
                    onChange={(event) => {
                      const next = [...percents];
                      next[i] = event.target.value;
                      setPercents(next);
                    }}
                    readOnly={readOnly}
                    className="console-field timecode w-full pr-7 text-right"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-ink-faint">
                    %
                  </span>
                </span>
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="plate-text text-ink-faint">Descripción (la lee la IA)</span>
              <textarea
                name="description"
                defaultValue={pillar.description}
                rows={2}
                maxLength={PILLAR_DESCRIPTION_MAX}
                lang="es"
                readOnly={readOnly}
                className="console-field w-full text-sm leading-relaxed"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="timecode text-xs text-ink-faint">
                {pillar.key} · {pillar.postCount} {pillar.postCount === 1 ? "post" : "posts"}
              </span>
              {!readOnly &&
                (pillar.percent === 0 ? (
                  <span className="flex gap-2">
                    {pillar.postCount > 0 ? (
                      <button
                        type="submit"
                        name="pillar"
                        value={pillar.id}
                        formAction={archivePillarAction}
                        formNoValidate
                        className="console-button"
                      >
                        Archivar
                      </button>
                    ) : (
                      <button
                        type="submit"
                        name="pillar"
                        value={pillar.id}
                        formAction={deletePillarAction}
                        formNoValidate
                        className="console-button"
                      >
                        Borrar
                      </button>
                    )}
                  </span>
                ) : (
                  <span className="text-xs text-ink-faint">
                    Para sacarlo, bajalo a 0 % y guardá.
                  </span>
                ))}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-4">
        <p
          role="status"
          aria-live="polite"
          className={`timecode text-sm ${balanced ? "text-ink-dim" : "text-tally-red"}`}
        >
          Total {total} %
          {!balanced && ` · ${total < 100 ? "faltan" : "sobran"} ${Math.abs(100 - total)}`}
        </p>
        {!readOnly && (
          <button
            type="submit"
            className="console-button console-button-primary"
            disabled={pending || !balanced}
          >
            {pending ? "Guardando…" : "Guardar pilares"}
          </button>
        )}
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

"use client";

import { PILLAR_DESCRIPTION_MAX, PILLAR_NAME_MAX, slugify } from "@radev/core";
import { useActionState, useEffect, useId, useState } from "react";
import {
  createPillarAction,
  type PillarFormState,
} from "@/app/(panel)/brands/[slug]/pillars/actions";

const idle: PillarFormState = { status: "idle" };

/** A new pillar: it enters the mix at 0 %. Its key comes from the name and stays fixed. */
export function NewPillarForm({ brandSlug }: { brandSlug: string }) {
  const [state, action, pending] = useActionState(createPillarAction, idle);
  const [name, setName] = useState("");
  const ids = { name: useId(), description: useId() };
  const key = slugify(name);

  // After creating, the form is ready for the next one (React already cleared the description).
  useEffect(() => {
    if (state.status === "ok") setName("");
  }, [state]);

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-4">
      <input type="hidden" name="slug" value={brandSlug} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.name} className="plate-text text-ink-faint">
          Nombre
        </label>
        <input
          id={ids.name}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          maxLength={PILLAR_NAME_MAX}
          placeholder="Ej.: Casos de clientes"
          className="console-field w-full"
        />
        <p className="text-sm text-ink-faint">
          Clave: <span className="timecode">{key || "—"}</span>. No cambia después: la usan los
          posts y la IA.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.description} className="plate-text text-ink-faint">
          Descripción (la lee la IA)
        </label>
        <textarea
          id={ids.description}
          name="description"
          rows={2}
          maxLength={PILLAR_DESCRIPTION_MAX}
          lang="es"
          className="console-field w-full text-sm leading-relaxed"
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="console-button" disabled={pending || !key}>
          {pending ? "Creando…" : "Crear pilar"}
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

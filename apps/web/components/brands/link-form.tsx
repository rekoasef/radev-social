"use client";

import { LINK_TITLE_MAX } from "@radev/core";
import { useActionState, useId } from "react";
import { type LinkFormState, saveLinkAction } from "@/app/(panel)/brands/[slug]/links/actions";

const idle: LinkFormState = { status: "idle" };

/** Adds a link to the brand's page, or edits one (`link` given). */
export function LinkForm({
  slug,
  link,
}: {
  slug: string;
  link?: { id: string; title: string; url: string; primary: boolean; active: boolean };
}) {
  const [state, action, pending] = useActionState(saveLinkAction, idle);
  const ids = { title: useId(), url: useId(), primary: useId(), active: useId() };
  const error = (field: "title" | "url" | "form") =>
    state.status === "error" && state.field === field ? state.message : undefined;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      {link && <input type="hidden" name="id" value={link.id} />}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.title} className="plate-text text-ink-faint">
            Título
          </label>
          <input
            id={ids.title}
            name="title"
            defaultValue={link?.title}
            maxLength={LINK_TITLE_MAX}
            placeholder="Mi web"
            aria-invalid={error("title") ? true : undefined}
            className="console-field"
          />
          {error("title") && <p className="text-sm text-tally-red">{error("title")}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={ids.url} className="plate-text text-ink-faint">
            Link
          </label>
          <input
            id={ids.url}
            name="url"
            type="url"
            inputMode="url"
            defaultValue={link?.url}
            placeholder="https://…"
            aria-invalid={error("url") ? true : undefined}
            className="console-field timecode"
          />
          {error("url") && <p className="text-sm text-tally-red">{error("url")}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-dim">
        <label htmlFor={ids.primary} className="flex items-center gap-2">
          <input id={ids.primary} name="primary" type="checkbox" defaultChecked={link?.primary} />
          Principal: sin WhatsApp, elegir un post lleva acá con{" "}
          <code className="timecode">?ref=</code>
        </label>
        {link && (
          <label htmlFor={ids.active} className="flex items-center gap-2">
            <input id={ids.active} name="active" type="checkbox" defaultChecked={link.active} />
            Visible en la página
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="console-button" disabled={pending}>
          {pending ? "Guardando…" : link ? "Guardar" : "Agregar link"}
        </button>
        {error("form") && <p className="text-sm text-tally-red">{error("form")}</p>}
        {state.status === "ok" && (
          <p role="status" className="text-sm text-ink-dim">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

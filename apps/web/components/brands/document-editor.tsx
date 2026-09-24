"use client";

import {
  type BrandDocumentKind,
  MAX_BRAND_DOCUMENT_CHARS,
  normalizeBrandDocument,
} from "@radev/core";
import { useActionState, useId, useState } from "react";
import {
  type DocumentFormState,
  saveDocumentAction,
} from "@/app/(panel)/brands/[slug]/documents/actions";

const idle: DocumentFormState = { status: "idle" };

/** Markdown editor of one brand document. Saving adds a version; the server skips no-ops. */
export function DocumentEditor({
  slug,
  kind,
  label,
  initial,
  readOnly,
}: {
  slug: string;
  kind: BrandDocumentKind;
  label: string;
  initial: string;
  /** Archived brands keep their documents but can't change them. */
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(saveDocumentAction, idle);
  const [content, setContent] = useState(initial);
  const id = useId();
  const length = [...content].length;
  const over = length > MAX_BRAND_DOCUMENT_CHARS;
  // Compared as the server stores them: trailing spaces or line endings aren't a change.
  const dirty = normalizeBrandDocument(content) !== normalizeBrandDocument(initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="kind" value={kind} />
      <label
        htmlFor={id}
        className="flex items-baseline justify-between gap-3 text-sm text-ink-dim"
      >
        <span>{label} · Markdown</span>
        <span className={`timecode text-xs ${over ? "text-tally-red" : "text-ink-faint"}`}>
          {length.toLocaleString("es-AR")}/{MAX_BRAND_DOCUMENT_CHARS.toLocaleString("es-AR")}
        </span>
      </label>
      <textarea
        id={id}
        name="content"
        rows={24}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        readOnly={readOnly}
        spellCheck
        lang="es"
        className="console-field w-full font-mono text-sm leading-relaxed"
        aria-invalid={over ? true : undefined}
      />
      <div className="flex flex-wrap items-center gap-4">
        {!readOnly && (
          <button
            type="submit"
            className="console-button console-button-primary"
            disabled={pending || !dirty || over || content.trim() === ""}
          >
            {pending ? "Guardando…" : "Guardar versión nueva"}
          </button>
        )}
        {dirty && !pending && <span className="text-sm text-ink-faint">Cambios sin guardar.</span>}
        {state.status !== "idle" && !dirty && (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={
              state.status === "error"
                ? "border-l border-tally-red pl-3 text-sm text-ink"
                : "border-l border-tally-green pl-3 text-sm text-ink-dim"
            }
          >
            {state.message}
          </p>
        )}
      </div>
      {state.status === "error" && dirty && (
        <p role="alert" className="border-l border-tally-red pl-3 text-sm text-ink">
          {state.message}
        </p>
      )}
    </form>
  );
}

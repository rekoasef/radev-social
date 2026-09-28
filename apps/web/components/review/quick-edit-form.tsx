"use client";

import type { SlideTexts, TextField } from "@radev/slides";
import Link from "next/link";
import { useActionState, useState } from "react";
import { type QuickEditState, quickEditAction } from "@/app/(panel)/review/actions";

const idle: QuickEditState = { status: "idle" };

/** Characters that count against the limit (asterisks of *emphasis* excluded). */
const visible = (text: string, emphasis: boolean) =>
  [...(emphasis ? text.replaceAll("*", "") : text)].length;

function TextInput({ field, error }: { field: TextField; error?: string }) {
  const [value, setValue] = useState(field.value);
  const length = visible(value, field.emphasis);
  const id = `quick-${field.path}`;
  const props = {
    id,
    name: `t:${field.path}`,
    value,
    lang: "es",
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
    className: "console-field w-full text-[15px] leading-relaxed",
  } as const;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-ink-dim">{field.label}</span>
        <span
          className={`timecode text-xs ${length > field.max ? "text-tally-red" : "text-ink-faint"}`}
        >
          {length}/{field.max}
        </span>
      </label>
      {field.multiline || field.max > 90 ? (
        <textarea
          {...props}
          rows={Math.min(6, Math.max(2, Math.ceil(field.max / 90)))}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : (
        <input type="text" {...props} onChange={(e) => setValue(e.target.value)} />
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-tally-red">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * "Editar" from the review queue: the texts the carousel already has, nothing else. Saving makes
 * a manual version that renders again and comes back to the queue. Layout, icons and slide types
 * stay in the full editor.
 */
export function QuickEditForm({
  code,
  versionId,
  post,
  slides,
  hashtags,
  onCancel,
}: {
  code: string;
  versionId: string;
  post: TextField[];
  slides: SlideTexts[];
  hashtags: string;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(quickEditAction, idle);
  // Controlled, like every text here: React resets a form after its action, and an error must
  // not wipe what was typed.
  const [tags, setTags] = useState(hashtags);
  const errors = state.status === "error" ? (state.fields ?? {}) : {};
  const hashtagError = Object.entries(errors).find(([path]) => path.startsWith("hashtags"))?.[1];

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="versionId" value={versionId} />
      <p className="text-sm text-ink-faint">
        Solo textos: el diseño, los íconos y los tipos de slide se cambian en el{" "}
        <Link href={`/posts/${code}/edit`} className="underline underline-offset-2">
          editor completo
        </Link>
        . Admite *énfasis* donde el contador lo dice. Al guardar se renderiza de nuevo y vuelve a la
        cola.
      </p>

      <fieldset className="flex flex-col gap-4">
        <legend className="plate-text mb-3 text-ink-faint">Post</legend>
        {post.map((field) => (
          <TextInput key={field.path} field={field} error={errors[field.path]} />
        ))}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quick-hashtags" className="text-sm text-ink-dim">
            Hashtags
          </label>
          <input
            id="quick-hashtags"
            name="hashtags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            aria-invalid={hashtagError ? true : undefined}
            className="console-field w-full text-[15px]"
          />
          {hashtagError && <p className="text-sm text-tally-red">{hashtagError}</p>}
        </div>
      </fieldset>

      <div className="flex flex-col divide-y divide-bezel rounded-md border border-bezel">
        {slides.map((slide) => {
          const prefix = `slides.${slide.index}`;
          const slideError = errors[prefix];
          const hasError = Object.keys(errors).some(
            (path) => path === prefix || path.startsWith(`${prefix}.`),
          );
          return (
            <details key={slide.index} open={hasError || undefined} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="plate-text text-ink-faint">{slide.label}</span>
                  <span className="truncate text-ink">{slide.fields[0]?.value}</span>
                </span>
                <span className="text-ink-faint group-open:rotate-90" aria-hidden="true">
                  ›
                </span>
              </summary>
              <div className="flex flex-col gap-4 px-4 pt-1 pb-5">
                {slideError && <p className="text-sm text-tally-red">{slideError}</p>}
                {slide.fields.map((field) => (
                  <TextInput key={field.path} field={field} error={errors[field.path]} />
                ))}
              </div>
            </details>
          );
        })}
      </div>

      {state.status === "error" && (
        <p role="alert" className="border-l border-tally-red pl-3 text-sm text-ink">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="console-button console-button-primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar y renderizar"}
        </button>
        <button type="button" className="console-button" disabled={pending} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

"use client";

import { slugify } from "@radev/core";
import { useActionState, useId, useState } from "react";
import {
  type BrandFormState,
  createBrandAction,
  updateBrandAction,
} from "@/app/(panel)/brands/actions";

const idle: BrandFormState = { status: "idle" };

export type PresetOption = { id: string; name: string; description: string };

export type BrandFormValues = {
  id?: string;
  name: string;
  slug: string;
  codePrefix: string;
  timezone: string;
};

/** Initials for a new brand's code prefix: "Mi Marca" → "MM", "Lumus" → "LU". */
function suggestPrefix(name: string): string {
  const words = slugify(name)
    .split("-")
    .filter((w) => /^[a-z]/.test(w));
  const letters =
    words.length >= 2 ? words.map((w) => w[0]).join("") : (words[0] ?? "").replace(/[^a-z]/g, "");
  return letters.slice(0, words.length >= 2 ? 4 : 2).toUpperCase();
}

function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="plate-text text-ink-faint">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-tally-red">
          {error}
        </p>
      ) : (
        hint && <p className="text-sm text-ink-faint">{hint}</p>
      )}
    </div>
  );
}

/** Create (with presets) or edit (with `values.id`) a brand's general data. */
export function BrandForm({
  values,
  presets,
  timezones,
  prefixLocked,
}: {
  values: BrandFormValues;
  /** Only when creating: the preset is picked once; the identity editor (T10) changes it. */
  presets?: PresetOption[];
  timezones: string[];
  /** Why the code prefix cannot change (the brand has posts), if so. */
  prefixLocked?: string;
}) {
  const editing = values.id !== undefined;
  const [state, action, pending] = useActionState(
    editing ? updateBrandAction : createBrandAction,
    idle,
  );
  const [name, setName] = useState(values.name);
  const [slug, setSlug] = useState(values.slug);
  const [prefix, setPrefix] = useState(values.codePrefix);
  // While creating, slug and prefix follow the name until the operator edits them.
  const [slugTouched, setSlugTouched] = useState(editing);
  const [prefixTouched, setPrefixTouched] = useState(editing);
  const ids = { name: useId(), slug: useId(), prefix: useId(), timezone: useId() };
  const fields = state.status === "error" ? (state.fields ?? {}) : {};
  const described = (id: string, error?: string) =>
    error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-6">
      {editing && <input type="hidden" name="id" value={values.id} />}

      <Field label="Nombre" id={ids.name} error={fields.name}>
        <input
          id={ids.name}
          name="name"
          value={name}
          required
          maxLength={60}
          autoComplete="off"
          className="console-field"
          {...described(ids.name, fields.name)}
          onChange={(event) => {
            const next = event.target.value;
            setName(next);
            if (!slugTouched) setSlug(slugify(next));
            if (!prefixTouched) setPrefix(suggestPrefix(next));
          }}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-[1fr_12rem]">
        <Field
          label="Slug"
          id={ids.slug}
          error={fields.slug}
          hint="Va en las direcciones del panel. Minúsculas, números y guiones."
        >
          <input
            id={ids.slug}
            name="slug"
            value={slug}
            required
            autoComplete="off"
            spellCheck={false}
            className="console-field timecode"
            {...described(ids.slug, fields.slug)}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
          />
        </Field>
        <Field
          label="Prefijo de código"
          id={ids.prefix}
          error={fields.codePrefix ?? prefixLocked}
          hint="2 a 4 letras. Los posts se numeran así: RA-0142."
        >
          <input
            id={ids.prefix}
            name="codePrefix"
            value={prefix}
            required
            maxLength={4}
            autoComplete="off"
            spellCheck={false}
            readOnly={Boolean(prefixLocked)}
            className="console-field timecode uppercase"
            {...described(ids.prefix, fields.codePrefix)}
            onChange={(event) => {
              setPrefixTouched(true);
              setPrefix(event.target.value.toUpperCase());
            }}
          />
        </Field>
      </div>

      {presets && (
        <fieldset className="flex flex-col gap-3">
          <legend className="plate-text mb-2 text-ink-faint">Estilo</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {presets.map((preset, i) => (
              <label key={preset.id} className="preset-option">
                <input
                  type="radio"
                  name="stylePreset"
                  value={preset.id}
                  defaultChecked={i === 0}
                  className="sr-only"
                />
                <span className="text-sm font-semibold text-ink">{preset.name}</span>
                <span className="text-sm text-ink-dim">{preset.description}</span>
              </label>
            ))}
          </div>
          <p className="text-sm text-ink-faint">
            La marca arranca con los colores y tipografías por defecto del estilo. Se personalizan
            en la identidad visual.
          </p>
        </fieldset>
      )}

      <Field
        label="Zona horaria"
        id={ids.timezone}
        error={fields.timezone}
        hint="Para mostrar y programar los posts."
      >
        <select
          id={ids.timezone}
          name="timezone"
          defaultValue={values.timezone}
          className="console-field"
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="console-button console-button-primary" disabled={pending}>
          {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear marca"}
        </button>
        {state.status === "ok" && (
          <p role="status" className="text-sm text-ink-dim">
            {state.message}
          </p>
        )}
        {state.status === "error" && state.message && (
          <p role="alert" className="text-sm text-tally-red">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

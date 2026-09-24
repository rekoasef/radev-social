"use client";

import { emptyField, type FieldSpec, parseEmphasis, SlideIcon } from "@radev/slides";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useId } from "react";

// Form controls for one slide, built from its field spec (packages/slides, SLIDE_FIELDS). Values
// go in and out as plain JSON; errors come keyed by path ("cards.1.label").

export const ICON_LIST_ID = "slide-icon-names";

type Value = unknown;
type Errors = Record<string, string>;

function visibleLength(text: string, emphasis: boolean): number {
  if (!emphasis) return [...text].length;
  const parsed = parseEmphasis(text);
  return [...(parsed.ok ? parsed.plain : text.replaceAll("*", ""))].length;
}

function TextField({
  field,
  value,
  onChange,
  error,
}: {
  field: Extract<FieldSpec, { kind: "text" }>;
  value: Value;
  onChange: (v: Value) => void;
  error?: string;
}) {
  const id = useId();
  const text = typeof value === "string" ? value : "";
  const length = visibleLength(text, field.emphasis);
  const over = length > field.max;
  const common = {
    id,
    value: text,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    className: "console-field w-full",
    "aria-invalid": error ? true : undefined,
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="flex items-baseline justify-between gap-3 text-sm text-ink-dim"
      >
        <span>
          {field.label}
          {field.optional && <span className="text-ink-faint"> · opcional</span>}
        </span>
        <span className={`timecode text-xs ${over ? "text-tally-red" : "text-ink-faint"}`}>
          {length}/{field.max}
        </span>
      </label>
      {field.multiline ? <textarea rows={3} {...common} /> : <input {...common} />}
      {error ? (
        <p className="text-sm text-tally-red">{error}</p>
      ) : (
        field.hint && <p className="text-xs text-ink-faint">{field.hint}</p>
      )}
    </div>
  );
}

function IconField({
  field,
  value,
  onChange,
  error,
  icons,
}: {
  field: Extract<FieldSpec, { kind: "icon" }>;
  value: Value;
  onChange: (v: Value) => void;
  error?: string;
  icons: ReadonlySet<string>;
}) {
  const id = useId();
  const name = typeof value === "string" ? value : "";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-ink-dim">
        {field.label}
        {field.optional && <span className="text-ink-faint"> · opcional</span>}
      </label>
      <div className="flex items-center gap-2">
        <span className="grid size-[42px] shrink-0 place-items-center rounded border border-bezel-strong bg-panel-raised text-ink">
          {icons.has(name) ? (
            <SlideIcon name={name} size={22} />
          ) : (
            <span className="text-ink-faint">?</span>
          )}
        </span>
        <input
          id={id}
          list={ICON_LIST_ID}
          value={name}
          spellCheck={false}
          placeholder="Buscá en inglés: wallet, clock…"
          onChange={(e) =>
            onChange(
              e.target.value.trim() === "" && field.optional ? undefined : e.target.value.trim(),
            )
          }
          className="console-field timecode min-w-0 flex-1"
          aria-invalid={error ? true : undefined}
        />
      </div>
      {error && <p className="text-sm text-tally-red">{error}</p>}
    </div>
  );
}

function ItemControls({
  index,
  count,
  min,
  onMove,
  onRemove,
  label,
}: {
  index: number;
  count: number;
  min: number;
  onMove: (to: number) => void;
  onRemove: () => void;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        className="icon-key"
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
        aria-label={`Subir ${label}`}
      >
        <ArrowUp className="size-3.5" />
      </button>
      <button
        type="button"
        className="icon-key"
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
        aria-label={`Bajar ${label}`}
      >
        <ArrowDown className="size-3.5" />
      </button>
      <button
        type="button"
        className="icon-key"
        disabled={count <= min}
        onClick={onRemove}
        aria-label={`Quitar ${label}`}
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/** Controls for a list of fields (an object) at `path`, recursively. */
export function Fields({
  fields,
  value,
  onChange,
  errors,
  path,
  icons,
}: {
  fields: FieldSpec[];
  value: Record<string, Value>;
  onChange: (v: Record<string, Value>) => void;
  errors: Errors;
  path: string[];
  icons: ReadonlySet<string>;
}) {
  const set = (key: string, v: Value) => {
    const next = { ...value };
    if (v === undefined) delete next[key];
    else next[key] = v;
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => {
        const here = [...path, field.key];
        const key = here.join(".");
        const current = value[field.key];
        switch (field.kind) {
          case "text":
            return (
              <TextField
                key={key}
                field={field}
                value={current}
                onChange={(v) => set(field.key, v)}
                error={errors[key]}
              />
            );
          case "icon":
            return (
              <IconField
                key={key}
                field={field}
                value={current}
                onChange={(v) => set(field.key, v)}
                error={errors[key]}
                icons={icons}
              />
            );
          case "object": {
            const on = current !== undefined;
            return (
              <fieldset
                key={key}
                className="flex flex-col gap-3 rounded-md border border-bezel p-3"
              >
                <legend className="px-1 text-sm text-ink">
                  {field.optional ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          set(field.key, e.target.checked ? emptyField(field) : undefined)
                        }
                        className="size-4 accent-[var(--color-ink)]"
                      />
                      {field.label}
                    </label>
                  ) : (
                    field.label
                  )}
                </legend>
                {on && (
                  <Fields
                    fields={field.fields}
                    value={(current ?? {}) as Record<string, Value>}
                    onChange={(v) => set(field.key, v)}
                    errors={errors}
                    path={here}
                    icons={icons}
                  />
                )}
                {errors[key] && <p className="text-sm text-tally-red">{errors[key]}</p>}
              </fieldset>
            );
          }
          case "list": {
            const items = Array.isArray(current) ? (current as Value[]) : [];
            const setItems = (next: Value[]) => set(field.key, next);
            return (
              <fieldset key={key} className="flex flex-col gap-3">
                <legend className="mb-2 flex w-full items-baseline justify-between text-sm text-ink">
                  <span>{field.label}</span>
                  <span className="timecode text-xs text-ink-faint">
                    {items.length} · de {field.min} a {field.max}
                  </span>
                </legend>
                {items.map((item, i) => {
                  const label = `${field.itemLabel.toLowerCase()} ${i + 1}`;
                  const controls = (
                    <ItemControls
                      index={i}
                      count={items.length}
                      min={field.min}
                      label={label}
                      onMove={(to) => setItems(move(items, i, to))}
                      onRemove={() => setItems(items.filter((_, j) => j !== i))}
                    />
                  );
                  if (field.item === "rich") {
                    return (
                      // biome-ignore lint/suspicious/noArrayIndexKey: list items have no identity besides their order
                      <div key={i} className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <TextField
                            field={{
                              key: String(i),
                              label: `${field.itemLabel} ${i + 1}`,
                              kind: "text",
                              max: field.itemMax ?? 80,
                              emphasis: true,
                            }}
                            value={item}
                            onChange={(v) => setItems(items.map((x, j) => (j === i ? v : x)))}
                            error={errors[`${key}.${i}`]}
                          />
                        </div>
                        <div className="pt-7">{controls}</div>
                      </div>
                    );
                  }
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: list items have no identity besides their order
                    <div key={i} className="flex flex-col gap-3 rounded-md border border-bezel p-3">
                      <div className="flex items-center justify-between">
                        <span className="plate-text text-ink-faint">
                          {field.itemLabel} {i + 1}
                        </span>
                        {controls}
                      </div>
                      <Fields
                        fields={field.item}
                        value={(item ?? {}) as Record<string, Value>}
                        onChange={(v) => setItems(items.map((x, j) => (j === i ? v : x)))}
                        errors={errors}
                        path={[...here, String(i)]}
                        icons={icons}
                      />
                    </div>
                  );
                })}
                {items.length < field.max && (
                  <div>
                    <button
                      type="button"
                      className="console-button"
                      onClick={() =>
                        setItems([
                          ...items,
                          field.item === "rich"
                            ? ""
                            : emptyField({
                                key: "x",
                                label: "",
                                kind: "object",
                                fields: field.item,
                              }),
                        ])
                      }
                    >
                      Agregar {field.itemLabel.toLowerCase()}
                    </button>
                  </div>
                )}
                {errors[key] && <p className="text-sm text-tally-red">{errors[key]}</p>}
              </fieldset>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}

"use client";

import type { TokenField } from "@radev/slides";
import { useId } from "react";

// One control per token widget (packages/slides, tokenFormSpec). Values come in and go out as
// plain JSON; validation happens in checkTheme (live) and again on save.

export type AssetOption = { id: string; role: string; label: string; url: string };

type Props<F extends TokenField["widget"]> = {
  field: Extract<TokenField, { widget: F }>;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  inputId: string;
};

const HEX6 = /^#[0-9a-f]{6}$/i;

function ColorInput({ field, value, onChange, error, inputId }: Props<"color">) {
  const text = typeof value === "string" ? value : "";
  return (
    <div className="flex items-center gap-2">
      {HEX6.test(text) ? (
        <input
          type="color"
          aria-label={`${field.title}: elegir color`}
          value={text}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="color-swatch"
        />
      ) : (
        // The native picker only handles #rrggbb: rgba values are edited as text, and this chip
        // shows them over a checkerboard so the transparency is visible.
        <span className="color-swatch color-chip" aria-hidden="true">
          <span style={{ background: text }} />
        </span>
      )}
      <input
        id={inputId}
        value={text}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        className="console-field timecode min-w-0 flex-1"
        aria-invalid={error ? true : undefined}
      />
    </div>
  );
}

function FontInput({ field, value, onChange, inputId }: Props<"font">) {
  const current = (value ?? {}) as { family?: string; weight?: number };
  const family = field.families.find((f) => f.family === current.family) ?? field.families[0];
  const weights = family?.weights ?? [];
  return (
    <div className="grid grid-cols-[1fr_6.5rem] gap-2">
      <select
        id={inputId}
        value={family?.family}
        onChange={(event) => {
          const next = field.families.find((f) => f.family === event.target.value);
          if (!next) return;
          // Keep the weight if the new family has it, else the closest one.
          const weight = next.weights.reduce((best, w) =>
            Math.abs(w - (current.weight ?? 400)) < Math.abs(best - (current.weight ?? 400))
              ? w
              : best,
          );
          onChange({ family: next.family, weight });
        }}
        className="console-field"
      >
        {field.families.map((f) => (
          <option key={f.family} value={f.family}>
            {f.family}
          </option>
        ))}
      </select>
      <select
        aria-label={`${field.title}: peso`}
        value={current.weight}
        onChange={(event) =>
          onChange({ family: family?.family, weight: Number(event.target.value) })
        }
        className="console-field"
      >
        {weights.map((w) => (
          <option key={w} value={w}>
            {w}
          </option>
        ))}
      </select>
    </div>
  );
}

function RangeInput({ field, value, onChange, inputId }: Props<"range">) {
  const number = typeof value === "number" ? value : field.min;
  const decimals = String(field.step).split(".")[1]?.length ?? 0;
  return (
    <div className="flex items-center gap-3">
      <input
        id={inputId}
        type="range"
        min={field.min}
        max={field.max}
        step={field.step}
        value={number}
        onChange={(event) => onChange(Number(event.target.value))}
        className="flex-1 accent-[var(--color-ink)]"
      />
      <output htmlFor={inputId} className="timecode w-12 text-right text-sm text-ink">
        {number.toFixed(decimals)}
      </output>
    </div>
  );
}

function TextInput({ field, value, onChange, error, inputId }: Props<"text">) {
  const text = typeof value === "string" ? value : "";
  return (
    <div className="flex flex-col gap-1">
      <input
        id={inputId}
        value={text}
        maxLength={field.max}
        onChange={(event) => onChange(event.target.value)}
        className="console-field"
        aria-invalid={error ? true : undefined}
      />
      <span className="timecode self-end text-xs text-ink-faint">
        {[...text].length}/{field.max}
      </span>
    </div>
  );
}

function LinesInput({ field, value, onChange, inputId }: Props<"lines">) {
  const lines = Array.isArray(value) ? (value as string[]) : [];
  const slots = Array.from({ length: field.count }, (_, i) => lines[i] ?? "");
  const update = (index: number, text: string) => {
    const next = slots.map((line, i) => (i === index ? text : line));
    // Empty lines are not stored: the schema wants 1+ characters per line.
    onChange(next.filter((line) => line.trim() !== ""));
  };
  return (
    <div className="flex flex-col gap-2">
      {slots.map((line, i) => (
        <input
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed number of line slots
          key={i}
          id={i === 0 ? inputId : undefined}
          aria-label={i === 0 ? undefined : `${field.title}: línea ${i + 1}`}
          value={line}
          maxLength={field.max}
          placeholder={`Línea ${i + 1}`}
          onChange={(event) => update(i, event.target.value)}
          className="console-field"
        />
      ))}
    </div>
  );
}

function ToggleInput({ value, onChange, inputId }: Props<"toggle">) {
  return (
    <input
      id={inputId}
      type="checkbox"
      checked={value === true}
      onChange={(event) => onChange(event.target.checked)}
      className="size-5 accent-[var(--color-ink)]"
    />
  );
}

function AssetInput({
  field,
  value,
  onChange,
  error,
  inputId,
  assets,
  assetsHref,
}: Props<"asset"> & { assets: AssetOption[]; assetsHref: string }) {
  const options = assets.filter((a) => a.role === field.role || a.id === value);
  const selected = assets.find((a) => a.id === value);
  return (
    <div className="flex items-center gap-3">
      <span className="asset-thumb" aria-hidden="true">
        {selected && (
          // biome-ignore lint/performance/noImgElement: files come from /media as is.
          <img
            src={selected.url}
            alt=""
            width={40}
            height={40}
            style={{ width: 40, height: 40, objectFit: "contain" }}
          />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <select
          id={inputId}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value || null)}
          className="console-field"
          aria-invalid={error ? true : undefined}
        >
          <option value="">Ninguno</option>
          {options.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        {options.length === 0 && (
          <a href={assetsHref} className="text-sm text-ink-dim underline underline-offset-2">
            Subí un archivo con uso “{field.role === "hero" ? "Protagonista" : "Logo"}” en Assets
          </a>
        )}
      </div>
    </div>
  );
}

const POSITION_LABELS: Record<string, string> = {
  "top-left": "Arriba a la izquierda",
  "top-right": "Arriba a la derecha",
  "bottom-left": "Abajo a la izquierda",
  "bottom-right": "Abajo a la derecha",
  center: "Centro",
};

type Glow = { position: string; color: string };

function GlowsInput({ field, value, onChange, inputId }: Props<"glows">) {
  const glows = Array.isArray(value) ? (value as Glow[]) : [];
  const update = (index: number, patch: Partial<Glow>) =>
    onChange(glows.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  return (
    <div id={inputId} className="flex flex-col gap-2">
      {glows.map((glow, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: glows have no identity besides their order
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <select
            aria-label={`Glow ${i + 1}: posición`}
            value={glow.position}
            onChange={(event) => update(i, { position: event.target.value })}
            className="console-field"
          >
            {field.positions.map((p) => (
              <option key={p} value={p}>
                {POSITION_LABELS[p] ?? p}
              </option>
            ))}
          </select>
          <input
            aria-label={`Glow ${i + 1}: color`}
            value={glow.color}
            spellCheck={false}
            onChange={(event) => update(i, { color: event.target.value })}
            className="console-field timecode min-w-0"
          />
          <button
            type="button"
            className="console-button"
            onClick={() => onChange(glows.filter((_, j) => j !== i))}
          >
            Quitar
          </button>
        </div>
      ))}
      {glows.length < field.max && (
        <div>
          <button
            type="button"
            className="console-button"
            onClick={() =>
              onChange([
                ...glows,
                { position: field.positions[0] ?? "center", color: "rgba(255,255,255,0.06)" },
              ])
            }
          >
            Agregar glow
          </button>
        </div>
      )}
    </div>
  );
}

/** Label, control and error for one token. */
export function TokenInput({
  field,
  value,
  onChange,
  error,
  assets,
  assetsHref,
}: {
  field: TokenField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  assets: AssetOption[];
  assetsHref: string;
}) {
  const inputId = useId();
  const common = { value, onChange, error, inputId };
  let control: React.ReactNode;
  switch (field.widget) {
    case "color":
      control = <ColorInput field={field} {...common} />;
      break;
    case "font":
      control = <FontInput field={field} {...common} />;
      break;
    case "range":
      control = <RangeInput field={field} {...common} />;
      break;
    case "text":
      control = <TextInput field={field} {...common} />;
      break;
    case "lines":
      control = <LinesInput field={field} {...common} />;
      break;
    case "toggle":
      control = <ToggleInput field={field} {...common} />;
      break;
    case "asset":
      control = <AssetInput field={field} {...common} assets={assets} assetsHref={assetsHref} />;
      break;
    case "glows":
      control = <GlowsInput field={field} {...common} />;
      break;
  }
  return (
    <div
      className={
        field.widget === "toggle"
          ? "flex items-center justify-between gap-3"
          : "flex flex-col gap-2"
      }
    >
      <label htmlFor={inputId} className="text-sm text-ink-dim">
        {field.title}
      </label>
      {control}
      {error && <p className="text-sm text-tally-red">{error}</p>}
    </div>
  );
}

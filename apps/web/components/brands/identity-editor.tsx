"use client";

import { contrastRatio, MIN_TEXT_CONTRAST } from "@radev/core";
import {
  type BrandTheme,
  checkTheme,
  getTokenValue,
  type SlideAssets,
  type SlideType,
  type StylePreset,
  setTokenValue,
  switchPresetTokens,
  type TokenGroup,
  themeColors,
} from "@radev/slides";
import { useActionState, useMemo, useRef, useState } from "react";
import {
  type IdentityState,
  saveIdentityAction,
} from "@/app/(panel)/brands/[slug]/identity/actions";
import { PREVIEW_SLIDES, SlidePreview } from "./slide-preview";
import { type AssetOption, TokenInput } from "./token-inputs";

const idle: IdentityState = { status: "idle" };

export type PresetInfo = { id: StylePreset; name: string; description: string };

export function IdentityEditor({
  brand,
  initial,
  presets,
  specs,
  assets,
}: {
  brand: { id: string; name: string; slug: string };
  initial: { preset: StylePreset; tokens: BrandTheme["tokens"] };
  presets: PresetInfo[];
  specs: Record<StylePreset, TokenGroup[]>;
  assets: AssetOption[];
}) {
  const [saved, setSaved] = useState(initial);
  const [preset, setPreset] = useState(initial.preset);
  const [tokens, setTokens] = useState<unknown>(initial.tokens);
  const [slide, setSlide] = useState<SlideType>("cover");
  const [extreme, setExtreme] = useState(false);
  const [state, action, pending] = useActionState(saveIdentityAction, idle);

  const check = useMemo(() => checkTheme(preset, tokens), [preset, tokens]);
  // While a field is invalid (e.g. a half-typed color) the preview keeps the last valid theme.
  const lastValid = useRef<BrandTheme>({
    preset: initial.preset,
    tokens: initial.tokens,
  } as BrandTheme);
  if (check.ok) lastValid.current = check.theme;
  const theme = lastValid.current;

  // When a save lands, the stored version becomes the new baseline (adjusting state during
  // render, once per save).
  const [handledSave, setHandledSave] = useState(0);
  if (state.status === "ok" && state.savedAt !== handledSave) {
    setHandledSave(state.savedAt);
    setSaved(state.saved);
  }

  const dirty = preset !== saved.preset || JSON.stringify(tokens) !== JSON.stringify(saved.tokens);
  const errors: Record<string, string> = {
    ...(state.status === "error" && !dirty ? (state.fields ?? {}) : {}),
    ...(check.ok ? {} : check.fields),
  };
  // Main text over main background, whatever the preset calls them (studio: paper over ink).
  const colors = themeColors(theme);
  const contrast = contrastRatio(colors.text, colors.bg);

  const previewAssets: SlideAssets = Object.fromEntries(
    assets.map((a) => [a.id, { url: a.url, width: null, height: null }]),
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
      <form action={action} className="flex min-w-0 flex-col gap-10">
        <input type="hidden" name="id" value={brand.id} />
        <input type="hidden" name="preset" value={preset} />
        <input type="hidden" name="tokens" value={JSON.stringify(tokens)} />

        <fieldset className="flex flex-col gap-3">
          <legend className="plate-text mb-3 text-ink-faint">Estilo</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {presets.map((p) => (
              <label key={p.id} className="preset-option">
                <input
                  type="radio"
                  name="presetChoice"
                  value={p.id}
                  checked={preset === p.id}
                  className="sr-only"
                  onChange={() => {
                    const ok = window.confirm(
                      `Cambiar a ${p.name} vuelve colores, tipografías y textos a los valores por defecto de ese estilo (los archivos se mantienen). Se aplica recién al guardar.`,
                    );
                    if (!ok) return;
                    setPreset(p.id);
                    setTokens(switchPresetTokens(p.id, tokens));
                  }}
                />
                <span className="text-sm font-semibold text-ink">{p.name}</span>
                <span className="text-sm text-ink-dim">{p.description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {contrast !== undefined && contrast < MIN_TEXT_CONTRAST && (
          <p role="status" className="border-l border-tally-amber pl-3 text-sm text-ink">
            Poco contraste entre el texto y el fondo ({contrast.toFixed(1).replace(".", ",")}:1; lo
            recomendado es {MIN_TEXT_CONTRAST.toString().replace(".", ",")}:1 o más). Puede costar
            leer las slides en el celular.
          </p>
        )}

        {specs[preset].map((group) => (
          <fieldset key={group.title} className="flex flex-col gap-5">
            <legend className="plate mb-4">{group.title}</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              {group.fields.map((field) => {
                const key = field.path.join(".");
                return (
                  <div
                    key={key}
                    className={
                      field.widget === "glows" || field.widget === "lines"
                        ? "sm:col-span-2"
                        : undefined
                    }
                  >
                    <TokenInput
                      field={field}
                      value={getTokenValue(tokens, field.path)}
                      onChange={(value) =>
                        setTokens((t: unknown) => setTokenValue(t, field.path, value))
                      }
                      error={errors[key]}
                      assets={assets}
                      assetsHref={`/brands/${brand.slug}/assets`}
                    />
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="identity-actions">
          <button
            type="submit"
            className="console-button console-button-primary"
            disabled={pending || !dirty || !check.ok}
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            className="console-button"
            disabled={!dirty || pending}
            onClick={() => {
              setPreset(saved.preset);
              setTokens(saved.tokens);
            }}
          >
            Descartar cambios
          </button>
          <p role="status" className="text-sm text-ink-dim">
            {!check.ok
              ? "Hay campos para corregir."
              : dirty
                ? "Cambios sin guardar."
                : state.status === "ok"
                  ? state.message
                  : ""}
          </p>
          {state.status === "error" && !dirty && (
            <p role="alert" className="text-sm text-tally-red">
              {state.message}
            </p>
          )}
        </div>
      </form>

      <aside aria-label="Vista previa" className="lg:sticky lg:top-24 lg:self-start">
        {/* Capped width: when the columns stack, the slide stays a preview, not a poster. */}
        <div className="mx-auto flex w-full max-w-[400px] flex-col gap-3">
          <label className="flex items-center justify-between gap-3">
            <span className="plate-text text-ink-faint">Vista previa</span>
            <select
              value={slide}
              onChange={(event) => setSlide(event.target.value as SlideType)}
              className="console-field"
            >
              {PREVIEW_SLIDES.map((s) => (
                <option key={s.type} value={s.type}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <SlidePreview
            theme={theme}
            brandName={brand.name}
            assets={previewAssets}
            type={slide}
            extreme={extreme}
          />
          <label className="flex items-center gap-2 text-sm text-ink-dim">
            <input
              type="checkbox"
              checked={extreme}
              onChange={(event) => setExtreme(event.target.checked)}
              className="size-4 accent-[var(--color-ink)]"
            />
            Probar con textos al límite
          </label>
          <p className="text-xs text-ink-faint">
            {extreme
              ? "Cada texto con la cantidad máxima de caracteres: si algo no entra, aparece arriba."
              : "Textos de ejemplo. Los cambios se ven al instante."}
          </p>
        </div>
      </aside>
    </div>
  );
}

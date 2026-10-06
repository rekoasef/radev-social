"use client";

import {
  type BrandTheme,
  type Carousel,
  carouselSchema,
  type Datasets,
  EDITOR_MIDDLE_TYPES,
  emptySlide,
  enabledLooks,
  exampleCarouselByPreset,
  HOOK_TYPES,
  ICON_NAMES,
  LOOK_NAMES,
  type LookId,
  limits,
  lookTakesArt,
  resolveLook,
  SLIDE_FIELDS,
  SLIDE_LABELS,
  type Slide,
  type SlideAssets,
  type SlideLayout,
  type SlideType,
} from "@radev/slides";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { type SaveCarouselState, saveCarouselAction } from "@/app/(panel)/posts/actions";
import { SlidePreview } from "@/components/brands/slide-preview";
import { HOOK_LABELS } from "@/lib/hooks";
import { LayerEditor, LayerToolbar, useLayerSelection } from "./layer-editor";
import { type DatasetOption, DatasetOptions, Fields, ICON_LIST_ID } from "./slide-fields";
import { SlideRewrite } from "./slide-rewrite";

const idle: SaveCarouselState = { status: "idle" };
const ICONS: ReadonlySet<string> = new Set(ICON_NAMES);

export type EditorPillar = { key: string; name: string };

/** The current version's generated images (ADR 0016) and the state of their generation. */
export type EditorArt = {
  status: string;
  note?: string;
  urls: { cover?: string; cta?: string };
};

const ART_STATUS_LABELS: Record<string, string> = {
  pending: "Generándose…",
  ready: "Lista",
  partial: "Solo una de las dos",
  skipped: "Sin imagen",
  failed: "No se pudo generar",
};

/**
 * The brand's real data for the editor (phase 3, T11): the datasets a chart can use (today's, plus
 * the ones frozen with the version being edited) and the day's figures for a bigNumber.
 */
export type EditorData = {
  datasets: Datasets;
  options: DatasetOption[];
  figures: { key: string; label: string; value: string; source: string }[];
};

/** Unknown icon names (half typed) would break the preview: draw a circle instead. */
function previewable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(previewable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        k === "icon" && typeof v === "string" && !ICONS.has(v) ? "circle" : previewable(v),
      ]),
    );
  }
  return value;
}

function readDraft(key: string): { carousel: Carousel; savedAt: number } | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

export function CarouselEditor({
  brand,
  theme,
  assets,
  pillars,
  initial,
  post,
  data,
  seed = "preview",
  art,
}: {
  brand: { id: string; slug: string; name: string };
  theme: BrandTheme;
  assets: SlideAssets;
  pillars: EditorPillar[];
  initial: Carousel;
  /** The post being edited; absent for a new one. */
  post?: { code: string; version: number };
  /** Null when the brand uses no data source (no charts then). */
  data: EditorData | null;
  /** Seed of the deterministic variation: the post id (the render uses it too). */
  seed?: string;
  /** The images of the version being edited, when it has them. */
  art?: EditorArt;
}) {
  const draftKey = `radev-social:draft:${brand.slug}:${post?.code ?? "new"}`;
  const [carousel, setCarousel] = useState<Carousel>(initial);
  const [selected, setSelected] = useState(0);
  const [recovered, setRecovered] = useState<number | null>(null);
  const [state, action, pending] = useActionState(saveCarouselAction, idle);

  // Unsaved work lives in this browser (no draft status: phase 2 decision). Offer it back once.
  useEffect(() => {
    const draft = readDraft(draftKey);
    if (draft && JSON.stringify(draft.carousel) !== JSON.stringify(initial)) {
      setCarousel(draft.carousel);
      setRecovered(draft.savedAt);
    }
  }, [draftKey, initial]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (JSON.stringify(carousel) === JSON.stringify(initial)) localStorage.removeItem(draftKey);
        else localStorage.setItem(draftKey, JSON.stringify({ carousel, savedAt: Date.now() }));
      } catch {
        // Private mode or storage full: the editor still works, only without a local draft.
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [carousel, draftKey, initial]);

  // Studio brands: the post's look, or the one the render would pick. Saved explicitly, so the
  // render draws what the preview shows.
  const looks = theme.preset === "studio" ? enabledLooks(theme.tokens) : [];
  const look: LookId | undefined =
    looks.length > 0 ? resolveLook(carousel.look, looks, seed) : undefined;
  const content = look ? { ...carousel, look } : carousel;
  // Images (ADR 0016): the current ones are shown while their description and the look stay
  // the same; otherwise (or with "new images") they are made again when saving.
  const [freshArt, setFreshArt] = useState(false);
  // A brand that always uses its own element (Lumus' orb) gets no generated images.
  const brandElementAlways =
    theme.preset === "studio" && theme.tokens.heroAlways && Boolean(theme.tokens.heroAsset);
  const takesArt = lookTakesArt(look) && !brandElementAlways;
  const artUnchanged =
    look === (initial.look ?? look) && JSON.stringify(carousel.art) === JSON.stringify(initial.art);
  const previewArt = takesArt && artUnchanged && !freshArt ? art?.urls : undefined;
  const setArt = (next: Carousel["art"]) => setCarousel((c) => ({ ...c, art: next }));
  const check = useMemo(() => carouselSchema.safeParse(carousel), [carousel]);
  const errors: Record<string, string> = {};
  if (!check.success) {
    for (const issue of check.error.issues)
      errors[issue.path.map(String).join(".")] ??= issue.message;
  }
  if (state.status === "error") Object.assign(errors, state.fields ?? {});
  const slideErrors = (i: number) =>
    Object.keys(errors).filter((k) => k === `slides.${i}` || k.startsWith(`slides.${i}.`)).length;

  const slides = carousel.slides;
  const index = Math.min(selected, slides.length - 1);
  const slide = slides[index] as Slide;
  const setSlides = (next: Slide[]) => setCarousel((c) => ({ ...c, slides: next }));
  const updateSlide = (value: Record<string, unknown>) => {
    const next = { ...value, type: slide.type } as Slide;
    // A chart takes its source from the chosen dataset while the field is empty.
    if (next.type === "chart" && !next.source) {
      const chosen = data?.datasets[next.datasetRef] as { source?: string } | undefined;
      if (chosen?.source) next.source = chosen.source;
    }
    setSlides(slides.map((s, i) => (i === index ? next : s)));
  };
  const datasets = data?.datasets ?? {};
  // `screen` needs the post's screenshots: the editor offers it from T6 of ADR 0024 on.
  const middleTypes = EDITOR_MIDDLE_TYPES.filter(
    (t) => t !== "screen" && (t !== "chart" || (data?.options.length ?? 0) > 0),
  );
  // A chart with no data yet can't be drawn: the preview says so instead.
  const drawable = slide.type !== "chart" || Boolean(datasets[slide.datasetRef]);
  const moveSlide = (from: number, to: number) => {
    const next = [...slides];
    const [item] = next.splice(from, 1);
    if (item) next.splice(to, 0, item);
    setSlides(next);
    setSelected(to);
  };
  const lastMiddle = slides.length - 2;
  const [layer, setLayer] = useLayerSelection(`${index}:${slide.type}`);
  const setLayout = (layout: SlideLayout | undefined) =>
    setSlides(
      slides.map((s, i) => {
        if (i !== index) return s;
        const { layout: _, ...rest } = s;
        return (layout ? { ...rest, layout } : rest) as Slide;
      }),
    );
  const previewSlide = previewable(slide) as Slide;
  const [newType, setNewType] = useState<SlideType>("statement");

  return (
    <form
      action={action}
      onSubmit={() => {
        try {
          localStorage.removeItem(draftKey);
        } catch {}
      }}
      className="grid gap-8 xl:grid-cols-[300px_minmax(0,1fr)_minmax(300px,400px)]"
    >
      <input type="hidden" name="brandId" value={brand.id} />
      {post && <input type="hidden" name="code" value={post.code} />}
      <input type="hidden" name="content" value={JSON.stringify(content)} />
      {freshArt && takesArt && carousel.art && <input type="hidden" name="freshArt" value="1" />}
      <datalist id={ICON_LIST_ID}>
        {ICON_NAMES.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {/* Left: the carousel's data and its slides. */}
      <div className="flex flex-col gap-6">
        {recovered && (
          <div
            role="status"
            className="flex flex-col gap-2 border-l border-tally-amber pl-3 text-sm text-ink"
          >
            Recuperamos tus cambios sin guardar.
            <button
              type="button"
              className="w-fit text-ink-dim underline underline-offset-2"
              onClick={() => {
                setCarousel(initial);
                setRecovered(null);
              }}
            >
              Descartarlos
            </button>
          </div>
        )}
        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          <span className="flex justify-between">
            Hook (idea en una frase)
            <span className="timecode text-xs text-ink-faint">
              {[...carousel.hook].length}/{limits.carousel.hook}
            </span>
          </span>
          <input
            value={carousel.hook}
            onChange={(e) => setCarousel((c) => ({ ...c, hook: e.target.value }))}
            className="console-field"
            aria-invalid={errors.hook ? true : undefined}
          />
          {errors.hook && <span className="text-tally-red">{errors.hook}</span>}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
            Pilar
            <select
              value={carousel.pillarKey}
              onChange={(e) => setCarousel((c) => ({ ...c, pillarKey: e.target.value }))}
              className="console-field"
            >
              {pillars.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
            Tipo de hook
            <select
              value={carousel.hookType}
              onChange={(e) =>
                setCarousel((c) => ({ ...c, hookType: e.target.value as Carousel["hookType"] }))
              }
              className="console-field"
            >
              {HOOK_TYPES.map((h) => (
                <option key={h} value={h}>
                  {HOOK_LABELS[h]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {look && (
          <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
            Look
            <select
              value={look}
              onChange={(e) => setCarousel((c) => ({ ...c, look: e.target.value as LookId }))}
              className="console-field"
            >
              {looks.map((id) => (
                <option key={id} value={id}>
                  {LOOK_NAMES[id]}
                </option>
              ))}
            </select>
          </label>
        )}
        {takesArt && (
          <fieldset className="flex flex-col gap-3 rounded-md border border-bezel p-4">
            <legend className="px-1 text-sm text-ink-dim">
              Imagen de portada y cierre (generada con IA)
            </legend>
            {art && artUnchanged && (
              <p className="text-sm text-ink-dim">
                Estado: {ART_STATUS_LABELS[art.status] ?? art.status}
                {art.note ? ` · ${art.note}` : ""}
              </p>
            )}
            {carousel.art ? (
              <>
                {(["cover", "cta"] as const).map((slot) => (
                  <label key={slot} className="flex flex-col gap-1.5 text-sm text-ink-dim">
                    <span className="flex justify-between">
                      {slot === "cover" ? "Objeto de la portada" : "Objeto del cierre"} (en inglés)
                      <span className="timecode text-xs text-ink-faint">
                        {[...(carousel.art?.[slot] ?? "")].length}/{limits.carousel.artSubject.max}
                      </span>
                    </span>
                    <textarea
                      rows={2}
                      value={carousel.art?.[slot] ?? ""}
                      onChange={(e) =>
                        setArt({
                          cover: carousel.art?.cover ?? "",
                          cta: carousel.art?.cta ?? "",
                          [slot]: e.target.value,
                        })
                      }
                      className="console-field"
                      aria-invalid={errors[`art.${slot}`] ? true : undefined}
                    />
                    {errors[`art.${slot}`] && (
                      <span className="text-tally-red">{errors[`art.${slot}`]}</span>
                    )}
                  </label>
                ))}
                <p className="text-xs text-ink-faint">
                  Un objeto, sin personas ni cosas con texto. El estilo, la luz y el fondo los pone
                  el sistema. Si cambiás la descripción, la imagen se genera de nuevo al guardar.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-ink-dim">
                    <input
                      type="checkbox"
                      checked={freshArt}
                      onChange={(e) => setFreshArt(e.target.checked)}
                      className="size-4 accent-[var(--color-ink)]"
                    />
                    Generar imágenes nuevas al guardar
                  </label>
                  <button
                    type="button"
                    className="text-sm text-ink-dim underline underline-offset-2"
                    onClick={() => setArt(undefined)}
                  >
                    Quitar imagen
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-4 text-sm text-ink-dim">
                <span>Sin imagen: la portada y el cierre usan el diseño del look.</span>
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => setArt({ cover: "", cta: "" })}
                >
                  Agregar imagen
                </button>
              </div>
            )}
          </fieldset>
        )}

        <div className="flex flex-col gap-2">
          <span className="flex justify-between text-sm text-ink-dim">
            Slides
            <span className="timecode text-xs text-ink-faint">
              {slides.length} · de {limits.carousel.slides.min} a {limits.carousel.slides.max}
            </span>
          </span>
          <ol className="flex flex-col gap-1">
            {slides.map((s, i) => {
              const middle = i > 0 && i < slides.length - 1;
              const problems = slideErrors(i);
              // A short line to recognize the slide: its title, or the figure of a bigNumber.
              const line = "title" in s ? s.title : "value" in s ? s.value : "";
              const title = typeof line === "string" ? line.replaceAll("*", "") : "";
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: slides have no identity besides their order
                <li key={i} className={`slide-row ${i === index ? "slide-row-current" : ""}`}>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-col items-start text-left"
                    onClick={() => setSelected(i)}
                  >
                    <span className="flex items-center gap-2 text-sm text-ink">
                      <span className="timecode text-ink-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {SLIDE_LABELS[s.type]}
                      {problems > 0 && <span className="text-xs text-tally-red">· {problems}</span>}
                    </span>
                    <span className="w-full truncate text-xs text-ink-faint">
                      {title || "Sin título"}
                    </span>
                  </button>
                  {middle && (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        className="icon-key"
                        disabled={i <= 1}
                        onClick={() => moveSlide(i, i - 1)}
                        aria-label={`Subir slide ${i + 1}`}
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="icon-key"
                        disabled={i >= lastMiddle}
                        onClick={() => moveSlide(i, i + 1)}
                        aria-label={`Bajar slide ${i + 1}`}
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="icon-key"
                        disabled={slides.length <= 3}
                        onClick={() => {
                          setSlides(slides.filter((_, j) => j !== i));
                          setSelected(Math.max(0, i - 1));
                        }}
                        aria-label={`Quitar slide ${i + 1}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          {slides.length < limits.carousel.slides.max && (
            <div className="flex gap-2">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as SlideType)}
                className="console-field min-w-0 flex-1"
              >
                {middleTypes.map((t) => (
                  <option key={t} value={t}>
                    {SLIDE_LABELS[t]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="console-button"
                onClick={() => {
                  const at = slides.length - 1;
                  setSlides([...slides.slice(0, at), emptySlide(newType), ...slides.slice(at)]);
                  setSelected(at);
                }}
              >
                Agregar
              </button>
            </div>
          )}
          {errors.slides && <p className="text-sm text-tally-red">{errors.slides}</p>}
        </div>

        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          <span className="flex justify-between">
            Texto del post
            <span className="timecode text-xs text-ink-faint">
              {[...carousel.caption].length}/{limits.carousel.caption}
            </span>
          </span>
          <textarea
            rows={5}
            value={carousel.caption}
            onChange={(e) => setCarousel((c) => ({ ...c, caption: e.target.value }))}
            className="console-field"
            aria-invalid={errors.caption ? true : undefined}
          />
          {errors.caption && <span className="text-tally-red">{errors.caption}</span>}
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          Hashtags (sin #, separados por espacios; hasta {limits.carousel.hashtags})
          <input
            value={carousel.hashtags.join(" ")}
            onChange={(e) =>
              setCarousel((c) => ({
                ...c,
                hashtags: e.target.value
                  .replaceAll("#", "")
                  .split(/[\s,]+/)
                  .filter(Boolean),
              }))
            }
            className="console-field"
            aria-invalid={
              Object.keys(errors).some((k) => k.startsWith("hashtags")) ? true : undefined
            }
          />
          {Object.entries(errors)
            .filter(([k]) => k.startsWith("hashtags"))
            .slice(0, 1)
            .map(([k, m]) => (
              <span key={k} className="text-tally-red">
                {m}
              </span>
            ))}
        </label>
      </div>

      {/* Middle: the selected slide. */}
      <section aria-label={`Slide ${index + 1}`} className="flex min-w-0 flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="plate">
            {String(index + 1).padStart(2, "0")} · {SLIDE_LABELS[slide.type]}
          </h2>
          <span className="text-xs text-ink-faint">
            Usá *asteriscos* para destacar (hasta 2 por slide)
          </span>
        </div>
        {errors[`slides.${index}`] && (
          <p className="text-sm text-tally-red">{errors[`slides.${index}`]}</p>
        )}
        <DatasetOptions value={data?.options ?? []}>
          <Fields
            fields={SLIDE_FIELDS[slide.type]}
            value={slide as unknown as Record<string, unknown>}
            onChange={updateSlide}
            errors={errors}
            path={["slides", String(index)]}
            icons={ICONS}
          />
        </DatasetOptions>
        {slide.type === "bigNumber" && data && data.figures.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md border border-bezel p-3">
            <p className="text-sm text-ink">Cifras del día</p>
            <ul className="flex flex-col gap-1.5">
              {data.figures.map((figure) => (
                <li key={figure.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 text-ink-dim">
                    {figure.label}: <span className="timecode text-ink">{figure.value}</span>
                  </span>
                  <button
                    type="button"
                    className="console-button shrink-0"
                    onClick={() =>
                      updateSlide({
                        ...slide,
                        value: figure.value,
                        source: figure.source,
                        label: slide.label || figure.label,
                      })
                    }
                  >
                    Usar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Right: preview and save. */}
      <aside
        aria-label="Vista previa"
        className="flex flex-col gap-4 xl:sticky xl:top-24 xl:self-start"
      >
        <div className="mx-auto w-full max-w-[400px]">
          {!drawable ? (
            <div className="grid aspect-[4/5] place-items-center rounded-md border border-bezel p-6 text-center text-sm text-ink-dim">
              Elegí qué datos muestra el gráfico para verlo.
            </div>
          ) : (
            <SlidePreview
              datasets={datasets}
              theme={theme}
              brandName={brand.name}
              assets={assets}
              type={slide.type}
              content={previewSlide}
              page={{ index, total: slides.length }}
              look={look}
              seed={seed}
              art={previewArt}
              qaOverlap
              overlay={(scale, frame) => (
                <LayerEditor
                  scale={scale}
                  frame={frame}
                  layout={slide.layout}
                  redrawKey={JSON.stringify(previewSlide)}
                  selected={layer}
                  onSelect={setLayer}
                  onChange={setLayout}
                />
              )}
            />
          )}
        </div>
        <LayerToolbar
          layout={slide.layout}
          selected={layer}
          hasHero={
            (slide.type === "cover" || slide.type === "cta") &&
            (theme.preset === "soft" || Boolean(previewArt?.[slide.type]))
          }
          onChange={setLayout}
        />
        <SlideRewrite
          brandId={brand.id}
          postCode={post?.code}
          content={content}
          canAsk={check.success}
          slideIndex={index}
          total={slides.length}
          theme={theme}
          brandName={brand.name}
          assets={assets}
          datasets={datasets}
          look={look}
          seed={seed}
          onUse={(at, next) =>
            // The hand adjustments were for the old content: the new slide starts clean.
            setSlides(slides.map((current, i) => (i === at ? next : current)))
          }
        />
        <div className="flex flex-col gap-2">
          <button
            type="submit"
            className="console-button console-button-primary"
            disabled={pending || !check.success}
          >
            {pending
              ? "Guardando…"
              : post
                ? `Guardar versión ${post.version + 1}`
                : "Guardar y renderizar"}
          </button>
          {!check.success && (
            <p className="text-sm text-ink-dim">
              Faltan {Object.keys(errors).length}{" "}
              {Object.keys(errors).length === 1 ? "cosa" : "cosas"} para poder guardar.
            </p>
          )}
          {state.status === "error" && (
            <p role="alert" className="text-sm text-tally-red">
              {state.message}
            </p>
          )}
          {!post && (
            <button
              type="button"
              className="w-fit text-sm text-ink-dim underline underline-offset-2"
              onClick={() => {
                const example = exampleCarouselByPreset[theme.preset];
                setCarousel({ ...example, pillarKey: carousel.pillarKey });
                setSelected(0);
              }}
            >
              Cargar el carrusel de ejemplo del estilo
            </button>
          )}
        </div>
      </aside>
    </form>
  );
}

import { z } from "zod";

// Hand adjustments of a slide (ADR 0013): the operator drags whole layers in the editor, like in
// Canva, and the template draws them moved. Three layers: the title block, the body (everything
// else, as one block so connectors and order stay intact) and the brand's hero element. Moving a
// layer leaves the others where they were. Empty means the template's own layout; the AI leaves
// it empty.
//
// Offsets are in slide pixels (1080×1350) from where the template puts the layer. The ranges
// only keep the numbers sane: the editor stops a layer at the safe area and the render QA flags
// anything that still ends up outside it or on top of another layer.

export const LAYERS = ["title", "body", "hero"] as const;
export type LayerName = (typeof LAYERS)[number];

export const LAYER_LABELS: Record<LayerName, string> = {
  title: "Título",
  body: "Contenido",
  hero: "Elemento gráfico",
};

export const LAYER_LIMITS = {
  offsetX: 1080,
  offsetY: 1350,
  /** The title grows or shrinks its font (lines re-wrap); the hero scales as an image. */
  scale: { title: { min: 0.6, max: 1.5 }, hero: { min: 0.4, max: 2 } },
} as const;

const offset = (max: number) =>
  z.number().int({ error: "La posición tiene que ser un número entero." }).min(-max).max(max);

const scale = ({ min, max }: { min: number; max: number }) =>
  z
    .number()
    .min(min, { error: `El tamaño va de ${min} a ${max}.` })
    .max(max, { error: `El tamaño va de ${min} a ${max}.` });

const moved = {
  x: offset(LAYER_LIMITS.offsetX),
  y: offset(LAYER_LIMITS.offsetY),
};

export const slideLayoutSchema = z
  .object({
    title: z.object({ ...moved, scale: scale(LAYER_LIMITS.scale.title).optional() }).optional(),
    body: z.object(moved).optional(),
    hero: z.object({ ...moved, scale: scale(LAYER_LIMITS.scale.hero).optional() }).optional(),
  })
  .strict();

export type SlideLayout = z.infer<typeof slideLayoutSchema>;
export type LayerAdjust = { x: number; y: number; scale?: number };

/** A layer's adjustment, or none when it sits where the template puts it. */
export function layerAdjust(layout: SlideLayout | undefined, layer: LayerName): LayerAdjust {
  return layout?.[layer] ?? { x: 0, y: 0 };
}

export function isMoved(adjust: LayerAdjust): boolean {
  return adjust.x !== 0 || adjust.y !== 0 || (adjust.scale ?? 1) !== 1;
}

/**
 * Sets one layer's adjustment and drops what is back to the template's layout, so an untouched
 * slide stores no `layout` at all.
 */
export function withLayer(
  layout: SlideLayout | undefined,
  layer: LayerName,
  adjust: LayerAdjust | null,
): SlideLayout | undefined {
  const next: Record<string, LayerAdjust> = { ...layout };
  if (adjust && isMoved(adjust)) {
    const clean: LayerAdjust = { x: Math.round(adjust.x), y: Math.round(adjust.y) };
    if (layer !== "body" && adjust.scale !== undefined && adjust.scale !== 1)
      clean.scale = Math.round(adjust.scale * 100) / 100;
    next[layer] = clean;
  } else {
    delete next[layer];
  }
  return Object.keys(next).length > 0 ? (next as SlideLayout) : undefined;
}

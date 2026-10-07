import { z } from "zod";
import type { Slide } from "./slides";

// Compositions (ADR 0026): the structure of a slide, independent of the look that paints it. Each
// slide type offers a few; the AI picks one per slide so two posts in the same look do not share
// a skeleton. The first of each list is the template's original structure, and what a slide
// without `composition` gets.

export const COMPOSITIONS = {
  cover: ["hero", "bleed", "split", "giant"],
  statement: ["center", "quote", "drawing", "photo"],
  steps: ["list", "grid", "path"],
  cardGrid: ["list", "tiles", "bento"],
  cta: ["center", "bleed"],
} as const;

export type CompositionType = keyof typeof COMPOSITIONS;
export type Composition<T extends CompositionType> = (typeof COMPOSITIONS)[T][number];

export const compositionSchema = <T extends CompositionType>(type: T) =>
  z.enum(COMPOSITIONS[type] as unknown as [Composition<T>, ...Composition<T>[]]);

/** Names in the editor. */
export const COMPOSITION_LABELS: Record<string, string> = {
  hero: "Objeto arriba",
  bleed: "Imagen a sangre",
  split: "Dividida",
  giant: "Título arriba",
  center: "Centrada",
  quote: "Cita",
  drawing: "Dibujo",
  photo: "Foto",
  list: "Lista",
  grid: "Grilla",
  path: "Camino",
  tiles: "Mosaico",
  bento: "Bento",
};

export const hasCompositions = (type: string): type is CompositionType => type in COMPOSITIONS;

/** The composition the slide asked for; undefined is the template's original. */
export const compositionOf = (slide: Slide): string | undefined =>
  "composition" in slide ? slide.composition : undefined;

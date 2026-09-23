import { z } from "zod";
import { FONT_FAMILIES, type FontFamily, supportsWeight } from "../fonts/registry";

// Building blocks for preset token schemas. Every field has a default (a new brand only picks a
// preset) and metadata for the form the panel generates: `title` is the Spanish label and
// `widget` the control to use.

export type TokenWidget = "color" | "font" | "range" | "text" | "lines" | "toggle" | "asset";

const COLOR =
  /^(#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/i;

export function color(title: string, value: string) {
  return z
    .string()
    .trim()
    .regex(COLOR, { error: "Usá un color hex (#FF7A00) o rgba(...)." })
    .default(value)
    .meta({ title, widget: "color" satisfies TokenWidget });
}

export function font(title: string, value: { family: FontFamily; weight: number }) {
  return z
    .object({ family: z.enum(FONT_FAMILIES), weight: z.number().int().min(100).max(1000) })
    .refine((f) => supportsWeight(f.family, f.weight), {
      error: "Esa tipografía no tiene ese peso.",
      path: ["weight"],
    })
    .prefault(value)
    .meta({ title, widget: "font" satisfies TokenWidget });
}

export function range(
  title: string,
  bounds: { min: number; max: number; step: number },
  value: number,
) {
  return z
    .number()
    .min(bounds.min)
    .max(bounds.max)
    .default(value)
    .meta({ title, widget: "range" satisfies TokenWidget, ...bounds });
}

/** Short text; empty means "not shown". */
export function text(title: string, max: number, value = "") {
  return z
    .string()
    .trim()
    .max(max, { error: `Máximo ${max} caracteres.` })
    .default(value)
    .meta({ title, widget: "text" satisfies TokenWidget, max });
}

/** Up to `count` short lines (e.g. a two-line tagline). */
export function lines(title: string, count: number, max: number) {
  return z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(max, { error: `Máximo ${max} caracteres por línea.` }),
    )
    .max(count, { error: `Máximo ${count} líneas.` })
    .default([])
    .meta({ title, widget: "lines" satisfies TokenWidget, count, max });
}

export function toggle(title: string, value: boolean) {
  return z
    .boolean()
    .default(value)
    .meta({ title, widget: "toggle" satisfies TokenWidget });
}

/** Id of a row in `brand_assets` with the given role; null when not set. */
export function asset(title: string, role: "logo" | "hero") {
  return z
    .uuid()
    .nullable()
    .default(null)
    .meta({ title, widget: "asset" satisfies TokenWidget, role });
}

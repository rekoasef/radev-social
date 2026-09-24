import "server-only";
import { CODE_PREFIX_PATTERN, RESERVED_SLUGS, SLUG_MAX, SLUG_PATTERN } from "@radev/core";
import { STYLE_PRESETS } from "@radev/slides";
import { z } from "zod";

// Validation of the brand forms (Server Actions). Formats come from packages/core, the same
// rules the database checks.

const TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

const details = {
  name: z
    .string()
    .trim()
    .min(1, { error: "Poné un nombre." })
    .max(60, { error: "Máximo 60 caracteres." }),
  slug: z
    .string()
    .trim()
    .max(SLUG_MAX, { error: `Máximo ${SLUG_MAX} caracteres.` })
    .regex(SLUG_PATTERN, { error: "Solo minúsculas, números y guiones (ej. mi-marca)." })
    .refine((slug) => !RESERVED_SLUGS.includes(slug), { error: "Ese slug está reservado." }),
  codePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CODE_PREFIX_PATTERN, { error: "De 2 a 4 letras, sin números (ej. RA)." }),
  timezone: z.string().refine((tz) => TIMEZONES.has(tz), { error: "Elegí una zona horaria." }),
};

export const createBrandInput = z.object({ ...details, stylePreset: z.enum(STYLE_PRESETS) });
export const updateBrandInput = z.object({ id: z.uuid(), ...details });

export type BrandField = keyof typeof details | "stylePreset";

/** First message per field, for the form. */
export function fieldErrors(error: z.ZodError): Partial<Record<BrandField, string>> {
  const out: Partial<Record<BrandField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as BrandField | undefined;
    if (field && !out[field]) out[field] = issue.message;
  }
  return out;
}

/** Time zones for the select: Argentina first, then the rest alphabetically. */
export function timezoneOptions(): string[] {
  const all = [...TIMEZONES].sort();
  return [
    ...all.filter((tz) => tz.startsWith("America/Argentina/")),
    ...all.filter((tz) => !tz.startsWith("America/Argentina/")),
  ];
}

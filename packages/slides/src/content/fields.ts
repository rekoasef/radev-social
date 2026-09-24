import { z } from "zod";
import { parseEmphasis } from "./emphasis";
// Lucide icon names, synced from lucide-react by scripts/sync-icon-names.mjs.
import iconNames from "./icon-names.json" with { type: "json" };

// Messages are in Spanish: they reach the operator (editor) and the AI (regeneration feedback).

const visibleLength = (text: string) => [...text].length;
const icons = new Set<string>(iconNames);

/** Text that admits `*emphasis*`. `max` counts visible characters (asterisks excluded). */
export function richText(max: number) {
  return z
    .string()
    .superRefine((value, ctx) => {
      if (value.trim() === "") {
        ctx.addIssue({ code: "custom", message: "No puede estar vacío." });
        return;
      }
      const parsed = parseEmphasis(value);
      if (!parsed.ok) {
        ctx.addIssue({ code: "custom", message: parsed.error });
        return;
      }
      const length = visibleLength(parsed.plain);
      if (length > max) {
        ctx.addIssue({
          code: "custom",
          message: `Tiene ${length} caracteres; el máximo es ${max}.`,
        });
      }
    })
    .describe(`Hasta ${max} caracteres visibles. Admite *énfasis*.`);
}

/**
 * Text without emphasis: asterisks are rejected. `maxWord` caps the length of each word, for
 * labels in narrow boxes where a long word cannot wrap (flow cards).
 */
export function plainText(max: number, { maxWord }: { maxWord?: number } = {}) {
  return z
    .string()
    .superRefine((value, ctx) => {
      if (value.trim() === "") {
        ctx.addIssue({ code: "custom", message: "No puede estar vacío." });
        return;
      }
      if (value.includes("*")) {
        ctx.addIssue({ code: "custom", message: "Este campo no admite énfasis (*)." });
      }
      const length = visibleLength(value);
      if (length > max) {
        ctx.addIssue({
          code: "custom",
          message: `Tiene ${length} caracteres; el máximo es ${max}.`,
        });
      }
      const long = maxWord
        ? value.split(/\s+/).find((word) => visibleLength(word) > maxWord)
        : undefined;
      if (long) {
        ctx.addIssue({
          code: "custom",
          message: `"${long}" es muy larga para la tarjeta: cada palabra puede tener hasta ${maxWord} letras.`,
        });
      }
    })
    .describe(
      maxWord
        ? `Hasta ${max} caracteres, palabras de hasta ${maxWord} letras. Sin énfasis.`
        : `Hasta ${max} caracteres. Sin énfasis.`,
    );
}

/** Name of a Lucide icon in kebab-case. */
export const iconName = z
  .string()
  .refine((value) => icons.has(value), { error: "No existe ese ícono en Lucide." })
  .describe(
    'Nombre de un ícono de Lucide en kebab-case, por ejemplo "database" o "message-circle".',
  );

/** Lowercase kebab-case key (pillars, datasets). */
export const key = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "Usá minúsculas, números y guiones." });

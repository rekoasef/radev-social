// Oficina de Investigación: el dossier (hechos con fuente) y sus controles.
import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const factId = z.string().regex(/^F\d{1,2}$/);
const quoteId = z.string().regex(/^C\d{1,2}$/);

export const dossierSchema = z
  .object({
    topic: text(200),
    summary: text(800).describe("La historia en 4–6 frases, solo con lo que está en `facts`."),
    facts: z
      .array(
        z
          .object({
            id: factId.describe("F1, F2…"),
            claim: text(300).describe("El hecho, en español, en una frase."),
            excerpt: text(400).describe(
              "Fragmento COPIADO TEXTUAL de la página (en su idioma), que prueba el hecho. Sin resumir ni traducir.",
            ),
            url: z.url(),
            sourceTitle: text(160),
          })
          .strict(),
      )
      .min(8)
      .max(30),
    quotes: z
      .array(
        z
          .object({
            id: quoteId.describe("C1, C2…"),
            text: text(300).describe("La cita exacta, como la reproduce la fuente."),
            who: text(120),
            url: z.url(),
          })
          .strict(),
      )
      .max(10),
    disputed: z
      .array(z.object({ point: text(200), versions: text(500) }).strict())
      .max(10)
      .describe("Datos en los que las fuentes no coinciden (cifras, fechas, detalles)."),
    unconfirmed: z
      .array(text(200))
      .max(15)
      .describe("Cosas que se dicen del tema pero no pudiste confirmar en una fuente confiable."),
  })
  .strict();
export type Dossier = z.infer<typeof dossierSchema>;

/** Errores de sentido del dossier (vacío = bien): ids únicos, varios sitios, sin datos de prueba. */
export function checkDossier(d: Dossier): string[] {
  const errors: string[] = [];
  const ids = [...d.facts.map((f) => f.id), ...d.quotes.map((q) => q.id)];
  for (const id of new Set(ids)) {
    if (ids.filter((x) => x === id).length > 1) errors.push(`id repetido: ${id}`);
  }
  const domains = new Set(d.facts.map((f) => new URL(f.url).hostname.replace(/^www\./, "")));
  if (domains.size < 3) errors.push(`solo ${domains.size} sitios distintos (mínimo 3)`);
  // V0-13: un intento devolvió un objeto de prueba ("test", example.com) como respuesta final.
  const fake = d.facts.filter(
    (f) =>
      /(^|\.)example\.(com|org|net)$/.test(new URL(f.url).hostname) ||
      /^(test|prueba|lorem)\d*$/i.test(f.claim.trim()) ||
      f.claim.trim() === f.excerpt.trim(),
  );
  if (fake.length > 0) {
    errors.push(`datos de prueba o de relleno en ${fake.map((f) => f.id).join(", ")}`);
  }
  return errors;
}

/**
 * El dossier para la IA que escribe (sin urls; sin extractos salvo `excerpts`: Guion y Verificación
 * reciben la frase real de cada página, ver `usableDossier`) y el texto completo contra el que se
 * controlan los números (regla 9).
 */
export function compactDossier(
  d: Dossier,
  options: { excerpts?: boolean } = {},
): { text: string; json: string } {
  return {
    text: JSON.stringify(d),
    json: JSON.stringify(d, (k, v) =>
      (k === "excerpt" && !options.excerpts) || k === "url" ? undefined : v,
    ),
  };
}

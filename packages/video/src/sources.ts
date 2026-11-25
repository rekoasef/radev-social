import { z } from "zod";
import type { Dossier } from "./dossier";
import { numbersIn } from "./text";

// Oficina de Fuentes (solo código): baja cada página del dossier y mide cuánto del fragmento
// «textual» está de verdad en ella. En V1 es informativo (el operador lo ve en su escritorio); desde
// V0-11 se sabe que WebFetch le pasa al modelo un resumen y no la página, así que los fragmentos
// pueden no ser textuales.

export const SOURCE_RESULTS = ["textual", "casi", "no-esta", "sin-pagina"] as const;
export type SourceResult = (typeof SOURCE_RESULTS)[number];

export const sourcesSchema = z.object({
  facts: z.array(
    z.object({
      id: z.string(),
      url: z.string(),
      result: z.enum(SOURCE_RESULTS),
      /** Proporción de grupos de 5 palabras del fragmento que están en la página (0 a 1). */
      overlap: z.number().min(0).max(1),
      /** Los números del hecho que NO están en la página. */
      missingNumbers: z.array(z.string()),
      error: z.string().optional(),
    }),
  ),
  summary: z.object({
    textual: z.number().int(),
    casi: z.number().int(),
    noEsta: z.number().int(),
    sinPagina: z.number().int(),
  }),
});
export type SourcesDoc = z.infer<typeof sourcesSchema>;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  nbsp: " ",
  lt: "<",
  gt: ">",
};

/** El texto visible de una página HTML (sin scripts, estilos ni etiquetas; con entidades). */
export function pageText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[String(n).toLowerCase()] ?? m);
}

/** Proporción de grupos de 5 palabras del fragmento que aparecen en la página (ya normalizada). */
export function overlap(excerpt: string, normalizedPage: string): number {
  const words = norm(excerpt).split(" ").filter(Boolean);
  if (words.length === 0) return 0;
  if (words.length < 5) return normalizedPage.includes(words.join(" ")) ? 1 : 0;
  const total = words.length - 4;
  let hits = 0;
  for (let i = 0; i < total; i++)
    if (normalizedPage.includes(words.slice(i, i + 5).join(" "))) hits++;
  return hits / total;
}

export const resultOf = (score: number): SourceResult =>
  score === 1 ? "textual" : score >= 0.6 ? "casi" : "no-esta";

/** `pages`: el HTML de cada URL, o el error de la descarga. */
export function checkSources(
  dossier: Dossier,
  pages: ReadonlyMap<string, string | Error>,
): SourcesDoc {
  const normalized = new Map<string, { text: string; numbers: Set<string> } | Error>();
  for (const [url, html] of pages) {
    if (html instanceof Error) {
      normalized.set(url, html);
      continue;
    }
    const text = pageText(html);
    normalized.set(url, { text: norm(text), numbers: new Set(numbersIn(text)) });
  }
  const facts = dossier.facts.map((f) => {
    const page = normalized.get(f.url);
    if (!page || page instanceof Error) {
      return {
        id: f.id,
        url: f.url,
        result: "sin-pagina" as const,
        overlap: 0,
        missingNumbers: [],
        error: page instanceof Error ? page.message : "no se descargó",
      };
    }
    const score = overlap(f.excerpt, page.text);
    return {
      id: f.id,
      url: f.url,
      result: resultOf(score),
      overlap: Math.round(score * 100) / 100,
      missingNumbers: numbersIn(f.claim).filter((n) => !page.numbers.has(n)),
    };
  });
  const count = (r: SourceResult) => facts.filter((f) => f.result === r).length;
  return {
    facts,
    summary: {
      textual: count("textual"),
      casi: count("casi"),
      noEsta: count("no-esta"),
      sinPagina: count("sin-pagina"),
    },
  };
}

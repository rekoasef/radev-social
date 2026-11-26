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
      /** The sentence of the page that backs it, copied by the AI and found by the code. */
      quote: z.string().optional(),
      /** What the claim says and the sentence does not (another number, another model…). */
      differs: z.string().optional(),
      /**
       * An AI read the whole page looking for it: a `no-esta` here means the page does not say it,
       * and Script and Verification do not get it (`usableDossier`).
       */
      checked: z.boolean().optional(),
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

/**
 * Lo que una IA encontró al leer la página: la frase textual de cada hecho (o null si no está) y lo
 * que el hecho dice de más.
 */
export type FoundQuote = { quotes: string[]; differs: string | null };

/** Las frases de la IA que de verdad están en la página, juntas, o null si ninguna. */
export function verifiedQuote(quotes: readonly string[], normalizedPage: string): string | null {
  const real = quotes.filter((q) => quoteOnPage(q, normalizedPage));
  return real.length > 0 && real.length === quotes.length ? real.join(" … ") : null;
}

/** Cuál de dos hallazgos de partes distintas de la página vale más: entero > a medias > nada. */
export function betterFind(
  a: (FoundQuote & { verified: boolean }) | undefined,
  b: FoundQuote & { verified: boolean },
): boolean {
  const rank = (f: (FoundQuote & { verified: boolean }) | undefined) =>
    !f ? -1 : f.verified ? (f.differs ? 2 : 3) : f.quotes.length > 0 ? 1 : 0;
  return rank(b) > rank(a);
}
export type FoundQuotes = ReadonlyMap<string, FoundQuote>;

/** Cuánto de la frase de la IA tiene que estar en la página para contar como textual. */
const QUOTE_MATCH = 0.9;

/** Lo que se controla: los hechos y también las citas (el fragmento de una cita es su texto). */
export function sourceItems(dossier: Dossier) {
  return [
    ...dossier.facts.map((f) => ({ id: f.id, url: f.url, excerpt: f.excerpt, claim: f.claim })),
    ...dossier.quotes.map((q) => ({
      id: q.id,
      url: q.url,
      excerpt: q.text,
      claim: `${q.who} dijo: «${q.text}»`,
    })),
  ];
}

/**
 * `pages`: el HTML de cada URL, o el error de la descarga. `found`: lo que encontró la IA al leer
 * cada página (`readablePage`), por id; un id que no está ahí no se buscó. `cut`: las URL cuyo
 * texto se recortó para la IA (lo que no encontró puede estar más abajo: no se da por ausente).
 */
export function checkSources(
  dossier: Dossier,
  pages: ReadonlyMap<string, string | Error>,
  found: FoundQuotes = new Map(),
  cut: ReadonlySet<string> = new Set(),
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
  const facts = sourceItems(dossier).map((f) => {
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
    const base = {
      id: f.id,
      url: f.url,
      missingNumbers: numbersIn(f.claim).filter((n) => !page.numbers.has(n)),
    };
    const score = overlap(f.excerpt, page.text);
    if (score === 1 || !found.has(f.id)) {
      return { ...base, result: resultOf(score), overlap: Math.round(score * 100) / 100 };
    }
    const { quotes, differs } = found.get(f.id) ?? { quotes: [], differs: null };
    const quote = verifiedQuote(quotes, page.text);
    if (quote) {
      // Backed only in part: kept, with what the page does not say (`usableDossier` passes it on).
      return differs
        ? { ...base, result: "casi" as const, overlap: 1, quote, differs, checked: true }
        : { ...base, result: "textual" as const, overlap: 1, quote, checked: true };
    }
    // The AI said it is not there, or "copied" something the page does not have.
    return {
      ...base,
      result: "no-esta" as const,
      overlap: Math.round(score * 100) / 100,
      checked: !cut.has(f.url),
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

/** Si una frase está en la página (normalizada con `pageForQuotes`): casi entera, tal cual. */
export function quoteOnPage(quote: string, normalizedPage: string): boolean {
  return overlap(quote, normalizedPage) >= QUOTE_MATCH;
}

/** El texto de una página como lo compara `quoteOnPage`. */
export const pageForQuotes = (html: string) => norm(pageText(html));

/** Lo más largo que se lee de una página (más allá suelen ser referencias). */
export const SOURCE_PAGE_MAX = 400_000;
/** De a cuánto texto lee la IA: en una página larga, de a pedazos se le escapan menos cosas. */
export const SOURCE_CHUNK = 30_000;

/** Los pedazos de una página para la IA, cortados entre líneas. */
export function pageChunks(text: string, size = SOURCE_CHUNK): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    if (current && current.length + line.length + 1 > size) {
      chunks.push(current);
      current = "";
    }
    current = current ? `${current}\n${line}` : line.slice(0, size);
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Lo que la IA lee de una página: el texto visible, en una línea por bloque, hasta `max`. */
export function readablePage(html: string, max = SOURCE_PAGE_MAX): { text: string; cut: boolean } {
  const text = pageText(html.replace(/<\/(p|div|li|h\d|tr|br)\s*>/gi, "\n"))
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 1)
    .join("\n");
  return text.length <= max ? { text, cut: false } : { text: text.slice(0, max), cut: true };
}

/** La respuesta de la IA que busca los hechos en una página. */
export const foundQuotesSchema = z.object({
  items: z.array(
    z
      .object({
        id: z.string().regex(/^[FC]\d{1,2}$/),
        quotes: z
          .array(z.string().min(5).max(500))
          .max(3)
          .describe(
            "Las frases de la página que lo respaldan, COPIADAS tal cual (1 a 3); vacío si la página no lo dice.",
          ),
        differs: z
          .string()
          .min(3)
          .max(300)
          .nullable()
          .describe(
            "Lo que la afirmación dice y la frase no (otro número, otro modelo, un detalle de más), o null si dice lo mismo.",
          ),
      })
      .strict(),
  ),
});

/** Cuántos hechos tienen que quedar para dejar afuera los que la página no respalda. */
const KEEP_AT_LEAST = 0.6;

/**
 * El dossier que reciben Guion y Verificación: sin los hechos ni las citas que una IA buscó en su
 * página y no estaban. Si eso dejara menos del 60 % de los hechos (o menos de 8), van todos: con
 * tan poco no se puede escribir, y el escritorio lo avisa.
 */
export function usableDossier(
  dossier: Dossier,
  sources: SourcesDoc | null,
): { dossier: Dossier; dropped: string[] } {
  const absent = new Set(
    (sources?.facts ?? []).filter((f) => f.checked && f.result === "no-esta").map((f) => f.id),
  );
  // Each fact carries the real sentence of its page; a partial one says what the page leaves out.
  const backed = new Map((sources?.facts ?? []).filter((f) => f.quote).map((f) => [f.id, f]));
  const withBacking = (f: Dossier["facts"][number]) => {
    const source = backed.get(f.id);
    if (!source?.quote) return f;
    return {
      ...f,
      excerpt: source.quote,
      claim: source.differs ? `${f.claim} (la página NO dice: ${source.differs})` : f.claim,
    };
  };
  let facts = dossier.facts.filter((f) => !absent.has(f.id));
  let dropped = [...absent];
  if (facts.length < Math.max(8, dossier.facts.length * KEEP_AT_LEAST)) {
    facts = dossier.facts;
    dropped = [];
  }
  const kept = new Set(dropped);
  return {
    dossier: {
      ...dossier,
      facts: facts.map(withBacking),
      quotes: dossier.quotes.filter((q) => !kept.has(q.id)),
    },
    dropped,
  };
}

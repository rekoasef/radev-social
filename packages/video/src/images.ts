// Imágenes de archivo (Wikimedia Commons): el tipo de una candidata, el filtro de licencias y los
// créditos. La búsqueda y la descarga viven en la oficina de Imágenes (el cliente de Commons).
import { cut } from "./text";

/** Una imagen candidata. La elige el código en Commons; la IA solo elige entre ellas. */
export type ImageCandidate = {
  id: string;
  title: string;
  description: string;
  date: string;
  author: string;
  license: string;
  page: string;
  file: string;
  width: number;
  height: number;
};

// Licencias que se pueden usar: dominio público, CC0, CC BY y CC BY-SA (con crédito).
// Nunca NC (no comercial) ni ND (sin derivadas): el canal se va a monetizar.
const LICENSE_OK = /public domain|^pd\b|cc0|no restrictions|^cc[ -]by(-sa)?[ -]\d/i;
const LICENSE_BAD = /\b(nc|nd)\b|-nc|-nd|fair use|non-?free/i;

export const licenseAllowed = (license: string) =>
  LICENSE_OK.test(license) && !LICENSE_BAD.test(license);

/** Autor legible: sin paréntesis, sin «Unknown author» y sin repeticiones («X X»). */
export const cleanAuthor = (a: string) => {
  const t = a
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const half = t.slice(0, Math.floor(t.length / 2)).trim();
  const one = t.length > 6 && t === `${half} ${half}` ? half : t;
  return /unknown|anonym|desconocid|^\W*$/i.test(one) ? "" : one;
};

/** El crédito corto que va abajo en el video: qué es · autor · licencia. */
export const shortCredit = (c: ImageCandidate, caption?: string) => {
  const author = cleanAuthor(c.author).split(/[,;]/)[0]?.trim() ?? "";
  const who =
    author &&
    !c.title.toLowerCase().includes(author.toLowerCase()) &&
    !/unknown|desconocid|anonym|direc|^\W*$/i.test(author)
      ? ` · ${cut(author, 28)}`
      : "";
  const lic = /public domain|pd/i.test(c.license) ? "dominio público" : c.license;
  return `${caption ?? cut(c.title, 46)}${who} · ${lic}`;
};

/** La línea de crédito completa de la descripción y de `creditos.txt`. */
export const creditLine = (c: ImageCandidate) =>
  `- ${c.title} — ${cleanAuthor(c.author) || "autor desconocido"} — ${c.license} — ${c.page}`;

// ───────────── oficina de Imágenes: lo que pide y devuelve la IA ─────────────
import { z } from "zod";
import type { CommonsHit } from "./commons";

/** Las consultas de búsqueda (de 1 a 3 palabras; ver IMAGE_QUERY_RULES). */
export const imageQueriesSchema = z.object({
  queries: z.array(z.string().min(3).max(60)).min(10).max(34),
});

/** Los números (`n`) de los resultados que elige la curaduría. */
export const imageCurationSchema = z.object({
  keep: z.array(z.number().int().min(0)).min(24).max(46),
});

/** Lo que la IA curadora ve de cada resultado: barato, solo texto. */
export const curationView = (pool: readonly CommonsHit[]) =>
  pool.map((h, n) => ({
    n,
    title: h.title,
    description: h.description.slice(0, 100),
    date: h.date,
  }));

/** Los resultados elegidos, sin repetir y sin números que no existen, en el orden de la IA. */
export function curatedHits(pool: readonly CommonsHit[], keep: readonly number[]): CommonsHit[] {
  return [...new Set(keep)].flatMap((n) => {
    const hit = pool[n];
    return hit ? [hit] : [];
  });
}

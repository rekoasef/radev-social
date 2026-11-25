// Oficina de Publicación: título, gancho, capítulos y miniatura (la IA lo propone, el código lo
// controla) y las dos descripciones listas para pegar en YouTube.
import { z } from "zod";
import { creditLine, type ImageCandidate } from "./images";
import type { Script } from "./script";
import { clock } from "./text";

export const publicationSchema = z
  .object({
    title: z.string().min(10).max(70),
    hook: z.string().min(80).max(420),
    hashtags: z
      .array(z.string().regex(/^#[\p{L}\p{N}]{3,24}$/u))
      .min(3)
      .max(5),
    chapters: z
      .array(
        z.object({ scene: z.number().int().min(1), title: z.string().min(3).max(40) }).strict(),
      )
      .min(4)
      .max(8),
    thumbnail: z
      .object({
        image: z.string().regex(/^i\d{2,3}$/),
        cx: z.number().min(0).max(1),
        cy: z.number().min(0).max(1),
        vw: z.number().min(0.25).max(1),
        kicker: z.string().min(2).max(18),
        lines: z.array(z.string().min(2).max(14)).min(2).max(3),
        accent: z.string().min(2).max(14),
      })
      .strict(),
  })
  .strict();
export type Publication = z.infer<typeof publicationSchema>;

export const FPS = 30;

/** Segundo en que empieza cada escena: voz (cuadros) más la cola de cada una. */
export function sceneStarts(frames: number[], tails: (number | undefined)[], fps = FPS): number[] {
  const starts: number[] = [];
  let acc = 0;
  frames.forEach((f, i) => {
    starts.push(acc);
    acc += (f + Math.round((tails[i] ?? 0) * fps)) / fps;
  });
  return starts;
}

/** Errores de sentido de la publicación (vacío = bien). `starts`: ver `sceneStarts`. */
export function checkPublication(m: Publication, script: Script, starts: number[]): string[] {
  const errs: string[] = [];
  const usedIds = new Set(script.scenes.map((s) => s.image));
  if (!usedIds.has(m.thumbnail.image))
    errs.push(`thumbnail.image › ${m.thumbnail.image} no se usa en el video`);
  const words = m.thumbnail.lines.join(" ").split(/\s+/).filter(Boolean);
  if (words.length > 6) errs.push(`thumbnail.lines › ${words.length} palabras; máximo 6`);
  const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const lineWords = new Set(words.map(norm));
  if (!m.thumbnail.accent.split(/\s+/).every((w) => lineWords.has(norm(w)))) {
    errs.push(
      `thumbnail.accent › "${m.thumbnail.accent}" tiene que estar escrito igual en las líneas`,
    );
  }
  const sc = m.chapters.map((c) => c.scene);
  if (sc[0] !== 1) errs.push("chapters › el primero tiene que ser la escena 1 (0:00)");
  for (const [i, c] of sc.entries()) {
    if (c > script.scenes.length) errs.push(`chapters.${i} › escena ${c} inexistente`);
    const prev = sc[i - 1];
    if (prev !== undefined && (starts[c - 1] ?? 0) - (starts[prev - 1] ?? 0) < 10) {
      errs.push(`chapters.${i} › a menos de 10 s del anterior (YouTube lo exige)`);
    }
  }
  return errs;
}

export type DossierSource = { id: string; sourceTitle?: string; url?: string };

export type DescriptionInput = {
  publication: Publication;
  script: Script;
  candidates: ImageCandidate[];
  /** Los hechos del dossier (para las fuentes). */
  facts: DossierSource[];
  starts: number[];
};

const AI_NOTICE = "Narración con voz generada por IA. Relato basado en las fuentes citadas.";

function sourceLines({ script, facts }: DescriptionInput) {
  const ids = new Set(script.facts.flatMap((f) => f.source.match(/F\d+/g) ?? []));
  const seen = new Set<string>();
  return facts
    .filter((f) => ids.has(f.id) && f.url && !seen.has(f.url) && seen.add(f.url))
    .map((f) => `- ${f.sourceTitle ?? f.url} — ${f.url}`);
}

/** Las imágenes distintas que usa el guion, en orden de aparición. */
export function usedImages(script: Script, candidates: ImageCandidate[]): ImageCandidate[] {
  return [...new Set(script.scenes.map((s) => s.image))].flatMap((id) => {
    const c = candidates.find((x) => x.id === id);
    return c ? [c] : [];
  });
}

/** Descripción del video normal (16:9): con capítulos y todos los créditos. */
export function buildDescription(input: DescriptionInput): string {
  const { publication: p } = input;
  return [
    p.title,
    "",
    p.hook,
    "",
    "Capítulos",
    ...p.chapters.map((c) => `${clock(input.starts[c.scene - 1] ?? 0)} ${c.title}`),
    "",
    "Fuentes",
    ...sourceLines(input),
    "",
    "Imágenes de archivo (Wikimedia Commons)",
    ...usedImages(input.script, input.candidates).map(creditLine),
    "",
    AI_NOTICE,
    "",
    p.hashtags.join(" "),
    "",
  ].join("\n");
}

/** Descripción del Short (9:16): sin capítulos (YouTube no los muestra), más corta, con #Shorts. */
export function buildShortDescription(input: DescriptionInput): string {
  const { publication: p } = input;
  return [
    p.title,
    "",
    p.hook,
    "",
    "Fuentes",
    ...sourceLines(input),
    "",
    "Imágenes de archivo: Wikimedia Commons (detalle de cada una en el video completo).",
    AI_NOTICE,
    "",
    [...p.hashtags, "#Shorts"].join(" "),
    "",
  ].join("\n");
}

/** `creditos.txt`: las imágenes usadas con autor, licencia y página. */
export function buildCredits(script: Script, candidates: ImageCandidate[]): string {
  return `Imágenes (Wikimedia Commons):\n${usedImages(script, candidates).map(creditLine).join("\n")}\n`;
}

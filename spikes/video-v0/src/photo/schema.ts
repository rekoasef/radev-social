// Formato documental: imágenes reales (Wikimedia Commons) + motion graphics + voz. La IA escribe
// este guion (Zod lo valida, `checkDocu` controla el sentido); el código dibuja y acredita.
import { z } from "zod";
import { narrationWords, normWord } from "../anim/schema";

const short = (n: number) => z.string().min(1).max(n);

export const cueSchema = z.union([
  z.number().min(0).max(30).describe("Segundos desde el inicio de la escena."),
  z
    .object({
      word: z.string().min(1).describe("UNA palabra de la narración de ESTA escena, como está escrita."),
      nth: z.number().int().min(1).optional(),
      edge: z.enum(["start", "end"]).optional(),
      offset: z.number().min(-2).max(3).optional(),
    })
    .strict(),
]);
export type DocuCue = z.infer<typeof cueSchema>;

const when = { at: cueSchema, until: cueSchema.optional() };
const pos = z
  .enum(["arriba", "centro", "abajo"])
  .describe("arriba: bajo los subtítulos · centro · abajo: tercio inferior (lo habitual para nombres).");

export const graphicSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("fecha"), text: short(26), sub: short(34).optional(), pos, ...when })
    .strict(),
  z
    .object({
      kind: z.literal("cifra"),
      value: z.number().int().min(0).max(100_000_000),
      unit: short(14).optional(),
      label: short(34),
      pos,
      ...when,
    })
    .strict(),
  z
    .object({ kind: z.literal("nombre"), name: short(30), role: short(44), pos, ...when })
    .strict(),
  z
    .object({
      kind: z.literal("cronologia"),
      pos,
      items: z
        .array(z.object({ date: short(14), text: short(30), at: cueSchema }).strict())
        .min(2)
        .max(4),
      until: cueSchema.optional(),
    })
    .strict(),
  z
    .object({ kind: z.literal("cita"), text: short(110), by: short(36), pos, ...when })
    .strict(),
]);
export type DocuGraphic = z.infer<typeof graphicSchema>;

export const viewSchema = z
  .object({
    cx: z.number().min(0).max(1).describe("Centro horizontal del encuadre (0 = borde izquierdo de la imagen, 1 = derecho)."),
    cy: z.number().min(0).max(1).describe("Centro vertical (0 = arriba, 1 = abajo)."),
    vw: z.number().min(0.2).max(1).describe("Ancho de imagen que se ve: 1 = todo el ancho, 0,3 = un detalle chico."),
  })
  .strict();
export type DocuView = z.infer<typeof viewSchema>;

export const docuSceneSchema = z
  .object({
    narration: z.string().min(10).max(260),
    image: z.string().regex(/^i\d{2,3}$/).describe("El id de una imagen candidata (i01, i02…)."),
    from: viewSchema.describe("Encuadre al empezar la escena."),
    to: viewSchema.describe("Encuadre al terminar: el zoom o paneo lento."),
    caption: short(70).optional().describe("Qué es la imagen, si no es obvio (p. ej. «Reconstrucción publicada en 1913»)."),
    highlight: z.array(z.string().min(1)).max(4).optional().describe("Palabras de la narración que se resaltan en los subtítulos."),
    graphics: z.array(graphicSchema).max(2),
    tail: z.number().min(0).max(3).optional(),
  })
  .strict();
export type DocuScene = z.infer<typeof docuSceneSchema>;

export const docuSchema = z
  .object({
    title: short(80),
    scenes: z.array(docuSceneSchema).min(10).max(26),
    facts: z
      .array(z.object({ claim: short(200), source: short(200) }).strict())
      .max(40)
      .describe("Cada dato o cifra de la narración y el `id` del dossier de donde sale (F1, F2…)."),
  })
  .strict();
export type DocuGuion = z.infer<typeof docuSchema>;

/** Una imagen candidata (la elige el código en Wikimedia Commons; la IA solo elige entre ellas). */
export type Candidate = {
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

const numbersIn = (text: string) =>
  [...text.matchAll(/\d[\d.,]*/g)].map((m) => m[0].replace(/[.,]+$/g, "").replace(/[.,](?=\d{3}\b)/g, ""));

/** Errores de sentido del guion (vacío = bien). */
export function checkDocu(g: DocuGuion, candidates: Candidate[], dossierText: string): string[] {
  const errors: string[] = [];
  const ids = new Set(candidates.map((c) => c.id));
  const used = new Map<string, number>();
  const dossierNums = new Set(numbersIn(dossierText));
  const total = g.scenes.reduce((n, s) => n + s.narration.length, 0);
  if (total < 1300 || total > 1950) {
    errors.push(`scenes › la narración suma ${total} caracteres; tienen que ser 1.300 a 1.950 (~100 a 140 s)`);
  }
  g.scenes.forEach((s, i) => {
    const at = `scenes.${i}`;
    if (!ids.has(s.image)) errors.push(`${at}.image › "${s.image}" no es una imagen candidata`);
    used.set(s.image, (used.get(s.image) ?? 0) + 1);
    const prev = g.scenes[i - 1];
    if (prev && prev.image === s.image) {
      const far =
        Math.abs(prev.to.cx - s.from.cx) + Math.abs(prev.to.cy - s.from.cy) > 0.3 ||
        Math.abs(prev.to.vw - s.from.vw) > 0.3;
      if (!far) errors.push(`${at}.from › misma imagen que la escena anterior con el mismo encuadre: cambiá de imagen o de zona`);
    }
    if (Math.abs(s.from.cx - s.to.cx) + Math.abs(s.from.cy - s.to.cy) + Math.abs(s.from.vw - s.to.vw) < 0.08) {
      errors.push(`${at} › from y to casi iguales: tiene que haber un zoom o paneo`);
    }
    const words = narrationWords(s.narration);
    const cue = (c: DocuCue | undefined, path: string) => {
      if (c === undefined || typeof c === "number") return;
      const target = normWord(c.word);
      const count = words.filter((w) => w === target).length;
      if (!target || c.word.includes(" ")) errors.push(`${at}.${path} › "${c.word}" tiene que ser UNA palabra`);
      else if (count < (c.nth ?? 1)) errors.push(`${at}.${path} › la palabra "${c.word}" no está en la narración de la escena`);
    };
    s.graphics.forEach((gr, j) => {
      // una fecha en pantalla tiene que ser la que dice la voz (si no, es un dato sin respaldo)
      if (gr.kind === "fecha") {
        const said = new Set(numbersIn(`${s.narration} ${s.caption ?? ""}`));
        for (const n of numbersIn(`${gr.text} ${gr.sub ?? ""}`)) {
          if (!said.has(n)) errors.push(`${at}.graphics.${j} › la fecha en pantalla incluye ${n}, que la narración de la escena no dice`);
        }
      }
      if (gr.kind === "cronologia") {
        gr.items.forEach((it, k) => cue(it.at, `graphics.${j}.items.${k}.at`));
      } else cue(gr.at, `graphics.${j}.at`);
      cue("until" in gr ? gr.until : undefined, `graphics.${j}.until`);
      if (gr.kind === "cifra" && gr.unit && normWord(gr.label).includes(normWord(gr.unit))) {
        errors.push(`${at}.graphics.${j}.label › repite la unidad "${gr.unit}": la etiqueta tiene que completar la frase, no repetirla`);
      }
      if (gr.kind === "cifra" && !dossierNums.has(String(gr.value))) {
        errors.push(`${at}.graphics.${j}.value › ${gr.value} no está en el dossier (regla 9: no inventar números)`);
      }
    });
    for (const h of s.highlight ?? []) {
      if (!words.includes(normWord(h))) errors.push(`${at}.highlight › "${h}" no está en la narración`);
    }
    for (const n of numbersIn(s.narration)) {
      if (!dossierNums.has(n)) errors.push(`${at}.narration › el número ${n} no está en el dossier (regla 9)`);
    }
  });
  for (const [id, n] of used) if (n > 3) errors.push(`scenes › la imagen ${id} se usa ${n} veces (máximo 3)`);
  if (used.size < 6) errors.push(`scenes › solo ${used.size} imágenes distintas; usá al menos 6 para que no se haga monótono`);
  const last = g.scenes.at(-1);
  if (last && !last.narration.trim().endsWith("?")) errors.push("scenes.last › la última escena tiene que terminar con una pregunta al espectador");
  const gcount = g.scenes.reduce((n, s) => n + s.graphics.length, 0);
  if (gcount < 5) errors.push(`graphics › hay ${gcount}; poné al menos 5 gráficos en el video (fechas, cifras, nombres, cronología)`);
  return errors;
}

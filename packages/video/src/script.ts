// Oficina de Guion: el documento `script` (escenas con imagen, encuadre y gráficos) y sus
// controles. La IA lo escribe (Zod lo valida, `checkScript` controla el sentido); el código dibuja
// y acredita. Las vistas se piensan en vertical: el render adapta el encuadre al formato 16:9.
import { z } from "zod";
import type { ImageCandidate } from "./images";
import { narrationWords, normWord, numbersIn } from "./text";

const short = (n: number) => z.string().min(1).max(n);

export const cueSchema = z.union([
  z.number().min(0).max(30).describe("Segundos desde el inicio de la escena."),
  z
    .object({
      word: z
        .string()
        .min(1)
        .describe("UNA palabra de la narración de ESTA escena, como está escrita."),
      nth: z.number().int().min(1).optional(),
      edge: z.enum(["start", "end"]).optional(),
      offset: z.number().min(-2).max(3).optional(),
    })
    .strict(),
]);
export type Cue = z.infer<typeof cueSchema>;

const when = { at: cueSchema, until: cueSchema.optional() };
const pos = z
  .enum(["arriba", "centro", "abajo"])
  .describe(
    "arriba: bajo los subtítulos · centro · abajo: tercio inferior (lo habitual para nombres).",
  );

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
  z.object({ kind: z.literal("nombre"), name: short(30), role: short(44), pos, ...when }).strict(),
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
  z.object({ kind: z.literal("cita"), text: short(110), by: short(36), pos, ...when }).strict(),
]);
export type Graphic = z.infer<typeof graphicSchema>;

export const viewSchema = z
  .object({
    cx: z
      .number()
      .min(0)
      .max(1)
      .describe("Centro horizontal del encuadre (0 = borde izquierdo de la imagen, 1 = derecho)."),
    cy: z.number().min(0).max(1).describe("Centro vertical (0 = arriba, 1 = abajo)."),
    vw: z
      .number()
      .min(0.2)
      .max(1)
      .describe("Ancho de imagen que se ve: 1 = todo el ancho, 0,3 = un detalle chico."),
  })
  .strict();
export type View = z.infer<typeof viewSchema>;

export const scriptSceneSchema = z
  .object({
    narration: z.string().min(10).max(260),
    image: z
      .string()
      .regex(/^i\d{2,3}$/)
      .describe("El id de una imagen candidata (i01, i02…)."),
    from: viewSchema.describe("Encuadre al empezar la escena."),
    to: viewSchema.describe("Encuadre al terminar: el zoom o paneo lento."),
    caption: short(70)
      .optional()
      .describe("Qué es la imagen, si no es obvio (p. ej. «Reconstrucción publicada en 1913»)."),
    // Optional so that scripts written before it still parse; the AI must fill it (`aiScriptSchema`).
    exact: z
      .boolean()
      .optional()
      .describe(
        "true SOLO si la imagen es la persona, el objeto, el documento o el lugar de esa época que se nombra. Si es otro avión, otro objeto, una foto actual, un dibujo o algo parecido: false, y `caption` dice qué es.",
      ),
    whole: z
      .boolean()
      .optional()
      .describe(
        "true: en el Short la foto va entera, sobre un fondo desenfocado, en vez de llenar la pantalla. Para una foto apaisada donde el recorte vertical dejaría afuera lo importante (un grupo de personas, un documento, un objeto ancho).",
      ),
    highlight: z
      .array(z.string().min(1))
      .max(4)
      .optional()
      .describe("Palabras de la narración que se resaltan en los subtítulos."),
    graphics: z.array(graphicSchema).max(2),
    tail: z.number().min(0).max(3).optional(),
  })
  .strict();
export type ScriptScene = z.infer<typeof scriptSceneSchema>;

export const scriptSchema = z
  .object({
    title: short(80),
    scenes: z.array(scriptSceneSchema).min(10).max(26),
    facts: z
      .array(z.object({ claim: short(200), source: short(200) }).strict())
      .max(40)
      .describe("Cada dato o cifra de la narración y el `id` del dossier de donde sale (F1, F2…)."),
  })
  .strict();
export type Script = z.infer<typeof scriptSchema>;

/** What the Script office asks the AI for: the same script, declaring `exact` in every scene. */
export const aiScriptSchema = scriptSchema.extend({
  scenes: z
    .array(scriptSceneSchema.extend({ exact: z.boolean().describe("Ver la regla de imágenes.") }))
    .min(10)
    .max(26),
});

/** Errores de sentido del guion (vacío = bien). */
export function checkScript(
  g: Script,
  candidates: ImageCandidate[],
  dossierText: string,
): string[] {
  const errors: string[] = [];
  const ids = new Set(candidates.map((c) => c.id));
  const used = new Map<string, number>();
  const dossierNums = new Set(numbersIn(dossierText));
  const total = g.scenes.reduce((n, s) => n + s.narration.length, 0);
  if (total < 1300 || total > 1950) {
    // Say exactly what to do: a vague "too long" took the first real video three tries.
    const longest = g.scenes
      .map((s, i) => ({ n: i + 1, length: s.narration.length }))
      .sort((a, b) => b.length - a.length)
      .slice(0, 4)
      .map((s) => `${s.n} (${s.length})`);
    const fix =
      total > 1950
        ? `sobran ${total - 1800} para llegar a 1.800: acortá las más largas (escenas ${longest.join(", ")}) a menos de 100 cada una, o sacá una escena`
        : `faltan ${1400 - total} para llegar a 1.400: sumá una o dos escenas con hechos del dossier`;
    errors.push(
      `scenes › la narración suma ${total} caracteres; tienen que ser 1.300 a 1.950 (~100 a 140 s): ${fix}`,
    );
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
      if (!far)
        errors.push(
          `${at}.from › misma imagen que la escena anterior con el mismo encuadre: cambiá de imagen o de zona`,
        );
    }
    if (
      Math.abs(s.from.cx - s.to.cx) +
        Math.abs(s.from.cy - s.to.cy) +
        Math.abs(s.from.vw - s.to.vw) <
      0.08
    ) {
      errors.push(`${at} › from y to casi iguales: tiene que haber un zoom o paneo`);
    }
    if (s.exact === false && !s.caption) {
      errors.push(
        `${at}.caption › la imagen no es exactamente lo que se nombra: el pie tiene que decir qué es`,
      );
    }
    const words = narrationWords(s.narration);
    const cue = (c: Cue | undefined, path: string) => {
      if (c === undefined || typeof c === "number") return;
      const target = normWord(c.word);
      const count = words.filter((w) => w === target).length;
      if (!target || c.word.includes(" "))
        errors.push(`${at}.${path} › "${c.word}" tiene que ser UNA palabra`);
      else if (count < (c.nth ?? 1))
        errors.push(`${at}.${path} › la palabra "${c.word}" no está en la narración de la escena`);
    };
    s.graphics.forEach((gr, j) => {
      // una fecha en pantalla tiene que ser la que dice la voz (si no, es un dato sin respaldo)
      if (gr.kind === "fecha") {
        const said = new Set(numbersIn(`${s.narration} ${s.caption ?? ""}`));
        for (const n of numbersIn(`${gr.text} ${gr.sub ?? ""}`)) {
          if (!said.has(n))
            errors.push(
              `${at}.graphics.${j} › la fecha en pantalla incluye ${n}, que la narración de la escena no dice: sacá ese número del cartel o decilo en la narración`,
            );
        }
      }
      if (gr.kind === "cronologia") {
        gr.items.forEach((it, k) => {
          cue(it.at, `graphics.${j}.items.${k}.at`);
        });
      } else cue(gr.at, `graphics.${j}.at`);
      cue("until" in gr ? gr.until : undefined, `graphics.${j}.until`);
      if (gr.kind === "cifra" && gr.unit && normWord(gr.label).includes(normWord(gr.unit))) {
        errors.push(
          `${at}.graphics.${j}.label › repite la unidad "${gr.unit}": la etiqueta tiene que completar la frase, no repetirla`,
        );
      }
      if (gr.kind === "cifra" && !dossierNums.has(String(gr.value))) {
        errors.push(
          `${at}.graphics.${j}.value › ${gr.value} no está en el dossier (regla 9: no inventar números)`,
        );
      }
    });
    for (const h of s.highlight ?? []) {
      if (!words.includes(normWord(h)))
        errors.push(`${at}.highlight › "${h}" no está en la narración`);
    }
    for (const n of numbersIn(s.narration)) {
      if (!dossierNums.has(n))
        errors.push(`${at}.narration › el número ${n} no está en el dossier (regla 9)`);
    }
  });
  for (const [id, n] of used)
    if (n > 3) errors.push(`scenes › la imagen ${id} se usa ${n} veces (máximo 3)`);
  if (used.size < 6)
    errors.push(
      `scenes › solo ${used.size} imágenes distintas; usá al menos 6 para que no se haga monótono`,
    );
  const last = g.scenes.at(-1);
  if (last && !last.narration.trim().endsWith("?"))
    errors.push("scenes.last › la última escena tiene que terminar con una pregunta al espectador");
  const gcount = g.scenes.reduce((n, s) => n + s.graphics.length, 0);
  if (gcount < 5)
    errors.push(
      `graphics › hay ${gcount}; poné al menos 5 gráficos en el video (fechas, cifras, nombres, cronología)`,
    );
  return errors;
}

/**
 * `highlight` son palabras sueltas: la IA a veces manda frases. Se parten en palabras (de más de 2
 * letras, sin repetir, máximo 4). No modifica el guion que recibe.
 */
export function normalizeHighlights(script: Script): Script {
  return {
    ...script,
    scenes: script.scenes.map((s) =>
      s.highlight
        ? {
            ...s,
            highlight: [
              ...new Set(s.highlight.flatMap((h) => h.split(/\s+/)).filter((w) => w.length > 2)),
            ].slice(0, 4),
          }
        : s,
    ),
  };
}

/**
 * Arreglos que hace el código antes de controlar, para no gastar un intento de la IA en ellos: la
 * etiqueta de una cifra que repite la unidad («200.000 dólares · dólares exigidos») pierde la palabra
 * repetida. No modifica el guion que recibe.
 */
export function tidyScript(script: Script): Script {
  return {
    ...normalizeHighlights(script),
    scenes: normalizeHighlights(script).scenes.map((s) => ({
      ...s,
      graphics: s.graphics.map((g) => {
        if (g.kind !== "cifra" || !g.unit) return g;
        const unit = normWord(g.unit);
        const words = g.label.split(/\s+/);
        const kept = words.filter((w) => normWord(w) !== unit);
        return kept.length === words.length || kept.length === 0
          ? g
          : { ...g, label: kept.join(" ") };
      }),
    })),
  };
}

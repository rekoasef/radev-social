// V0-8: el guion como schema de Zod, para que lo escriba `claude -p` y validarlo antes de gastar
// voz y render. Dos capas:
//   1. `guionSchema` (Zod): la forma. Tipos, campos y valores permitidos (solo los dibujos que
//      existen). Viaja como JSON Schema en `--json-schema`.
//   2. `checkGuion`: el sentido, lo que un JSON Schema no puede decir. Cada palabra de un `Cue` tiene
//      que estar en la narración de su escena (los tiempos se enganchan a la voz, que todavía no
//      existe), las posiciones dentro del cuadro, ids sin repetir, etc.
// Los tipos de `guion.ts` siguen siendo la fuente para el render; un test de tipos al final
// comprueba que lo que valida el schema se puede renderizar.
import { z } from "zod";
import type { GuionScene } from "./guion";

const W = 1080;
const H = 1920;

const cueSchema = z.union([
  z.number().min(0).max(30).describe("Segundos desde el inicio de la escena."),
  z
    .object({
      word: z
        .string()
        .min(1)
        .describe("Una sola palabra de la narración de ESTA escena, tal como está escrita."),
      nth: z.number().int().min(1).optional().describe("Si se repite: cuál (1 = la primera)."),
      edge: z
        .enum(["start", "end"])
        .optional()
        .describe("Inicio (por defecto) o fin de la palabra."),
      offset: z.number().min(-2).max(3).optional().describe("Segundos a sumar (negativo: antes)."),
    })
    .strict(),
]);

// Fuera del cuadro vale: los personajes entran caminando desde afuera.
const x = z
  .number()
  .min(-800)
  .max(W + 800);
const y = z.number().min(0).max(H);
const scale = z.number().min(0.3).max(2.5).optional();

const until = { at: cueSchema, until: cueSchema.optional() };
const actionSchema = z.discriminatedUnion("do", [
  z
    .object({
      do: z.literal("walk"),
      at: cueSchema,
      toX: x,
      speed: z.number().min(60).max(900).optional(),
    })
    .strict(),
  z.object({ do: z.literal("lookWatch"), ...until }).strict(),
  z.object({ do: z.literal("scratchHead"), ...until }).strict(),
  z.object({ do: z.literal("panic"), ...until }).strict(),
  z.object({ do: z.literal("point"), ...until }).strict(),
  z.object({ do: z.literal("carry"), at: cueSchema }).strict(),
  z.object({ do: z.literal("pop"), at: cueSchema }).strict(),
]);

const actorSchema = z
  .object({
    id: z.string().min(1).max(40),
    outfit: z.enum(["ladron", "guardia", "civil", "dueno"]),
    x,
    y,
    scale,
    facing: z.enum(["left", "right"]).optional(),
    enter: cueSchema.optional(),
    actions: z.array(actionSchema).max(12).optional(),
  })
  .strict();

const short = (max: number) => z.string().min(1).max(max);

const propSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("calendar"), month: short(12), year: short(6), x, y, ...until })
    .strict(),
  z.object({ kind: z.literal("moneyBag"), x, y, at: cueSchema, scale }).strict(),
  z.object({ kind: z.literal("stopwatch"), x, y, at: cueSchema, spinUntil: cueSchema }).strict(),
  z.object({ kind: z.literal("question"), x, y, at: cueSchema, scale }).strict(),
  z.object({ kind: z.literal("route"), at: cueSchema, until: cueSchema }).strict(),
  z
    .object({
      kind: z.literal("marker"),
      label: short(12),
      x,
      y,
      at: cueSchema,
      moveTo: z.object({ x, y, at: cueSchema }).strict().optional(),
    })
    .strict(),
  z.object({ kind: z.literal("securityCam"), x, y, at: cueSchema, off: cueSchema, scale }).strict(),
  z
    .object({
      kind: z.literal("phone"),
      x,
      y,
      at: cueSchema,
      loadingAt: cueSchema.optional(),
      scale,
    })
    .strict(),
]);

const overlaySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("checklist"),
      x,
      y,
      items: z
        .array(z.object({ text: short(24), mark: z.enum(["ok", "no"]), at: cueSchema }).strict())
        .min(1)
        .max(4),
    })
    .strict(),
  z
    .object({
      kind: z.literal("tag"),
      text: short(28),
      x,
      y,
      ...until,
      color: z.enum(["rojo", "azul"]).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("dataBox"),
      text: short(16),
      sub: short(20).optional(),
      x,
      y,
      ...until,
      count: z
        .object({ to: z.number().int().min(1).max(100_000), until: cueSchema })
        .strict()
        .optional(),
    })
    .strict(),
]);

export const SETTINGS = ["aeropuerto-noche", "reloj-alarma", "plano", "tienda"] as const;

export const sceneSchema = z
  .object({
    narration: z.string().min(10).max(220),
    setting: z.enum(SETTINGS),
    camera: z
      .array(z.object({ at: cueSchema, zoom: z.number().min(0.8).max(2), x, y }).strict())
      .min(1)
      .max(6),
    actors: z.array(actorSchema).max(8),
    props: z.array(propSchema).max(8),
    overlays: z.array(overlaySchema).max(4),
    highlight: z.array(z.string().min(1)).min(1).max(5),
    headline: z
      .object({ text: short(32), at: cueSchema })
      .strict()
      .optional(),
    tail: z.number().min(0).max(3).optional(),
  })
  .strict();

/** Lo que devuelve Claude: título, escenas y los datos que el operador tiene que verificar. */
export const guionSchema = z
  .object({
    title: short(80),
    scenes: z.array(sceneSchema).min(4).max(9),
    /**
     * Regla 9: los números no los inventa la IA. En un video de historia los datos salen de hechos
     * conocidos, así que Claude los lista para que el operador los verifique antes de grabar.
     */
    facts: z
      .array(z.object({ claim: short(200), source: short(200) }).strict())
      .max(12)
      .describe("Cada dato o cifra de la narración y dónde se puede verificar."),
  })
  .strict();

export type GuionDraft = z.infer<typeof guionSchema>;
export type SceneDraft = z.infer<typeof sceneSchema>;

/** Igual que `timing.ts` y `overlays.tsx`: así compara las palabras el render. */
export const normWord = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%]/g, "");

/** Las palabras de la narración como las va a separar la voz (por espacios). */
export const narrationWords = (narration: string) =>
  narration.split(/\s+/).map(normWord).filter(Boolean);

type Cue = z.infer<typeof cueSchema>;

/**
 * Errores de sentido de una escena (vacío = bien). `where` antepone la ruta para leerlos como los
 * de Zod: `scenes.2.props.1.at › …`.
 */
export function checkScene(scene: SceneDraft, where = ""): string[] {
  const errors: string[] = [];
  const words = narrationWords(scene.narration);
  const cue = (c: Cue | undefined, path: string) => {
    if (c === undefined || typeof c === "number") return;
    const target = normWord(c.word);
    if (!target) {
      errors.push(`${where}${path} › "${c.word}" no es una palabra`);
      return;
    }
    if (c.word.trim().includes(" ")) {
      errors.push(`${where}${path} › "${c.word}" tiene que ser UNA palabra`);
      return;
    }
    const count = words.filter((w) => w === target).length;
    const nth = c.nth ?? 1;
    if (count < nth) {
      errors.push(
        count === 0
          ? `${where}${path} › la palabra "${c.word}" no está en la narración de la escena`
          : `${where}${path} › "${c.word}" aparece ${count} vez/veces, no ${nth}`,
      );
    }
  };
  for (const [i, k] of scene.camera.entries()) cue(k.at, `camera.${i}.at`);
  const ids = new Set<string>();
  scene.actors.forEach((a, i) => {
    if (ids.has(a.id)) errors.push(`${where}actors.${i}.id › "${a.id}" repetido`);
    ids.add(a.id);
    cue(a.enter, `actors.${i}.enter`);
    a.actions?.forEach((action, j) => {
      cue(action.at, `actors.${i}.actions.${j}.at`);
      if ("until" in action) cue(action.until, `actors.${i}.actions.${j}.until`);
    });
  });
  scene.props.forEach((p, i) => {
    cue(p.at, `props.${i}.at`);
    if ("until" in p) cue(p.until, `props.${i}.until`);
    if (p.kind === "stopwatch") cue(p.spinUntil, `props.${i}.spinUntil`);
    if (p.kind === "securityCam") cue(p.off, `props.${i}.off`);
    if (p.kind === "phone") cue(p.loadingAt, `props.${i}.loadingAt`);
    if (p.kind === "marker") cue(p.moveTo?.at, `props.${i}.moveTo.at`);
    if (
      (p.kind === "route" || p.kind === "marker" || p.kind === "securityCam") &&
      scene.setting !== "plano"
    ) {
      errors.push(`${where}props.${i} › "${p.kind}" solo existe en el escenario "plano"`);
    }
  });
  const boxes = new Set<string>();
  scene.overlays.forEach((o, i) => {
    // El render identifica cada caja por tipo y posición.
    const key = `${o.kind}-${o.x}-${o.y}`;
    if (boxes.has(key)) errors.push(`${where}overlays.${i} › otra caja igual en la misma posición`);
    boxes.add(key);
    if (o.kind === "checklist") {
      for (const [j, it] of o.items.entries()) cue(it.at, `overlays.${i}.items.${j}.at`);
    } else {
      cue(o.at, `overlays.${i}.at`);
      cue(o.until, `overlays.${i}.until`);
      if (o.kind === "dataBox") cue(o.count?.until, `overlays.${i}.count.until`);
    }
    // Zonas fijas: subtítulos arriba (y < 520) y titular abajo (1380–1540).
    if (o.y < 520) errors.push(`${where}overlays.${i}.y › ${o.y} tapa los subtítulos (mínimo 520)`);
    if (o.y > 1380 && o.y < 1560) errors.push(`${where}overlays.${i}.y › ${o.y} tapa el titular`);
    if (o.y > 1700)
      errors.push(`${where}overlays.${i}.y › ${o.y} queda bajo la interfaz de la app`);
  });
  if (scene.headline) {
    cue(scene.headline.at, "headline.at");
    const stars = scene.headline.text.split("*").length - 1;
    if (stars !== 2)
      errors.push(`${where}headline.text › tiene que marcar UNA parte en rojo con *así*`);
    if (scene.headline.text !== scene.headline.text.toUpperCase()) {
      errors.push(`${where}headline.text › va en mayúsculas`);
    }
  }
  for (const h of scene.highlight) {
    if (!words.includes(normWord(h))) {
      errors.push(`${where}highlight › "${h}" no está en la narración`);
    }
  }
  return errors;
}

export function checkGuion(guion: GuionDraft): string[] {
  const errors = guion.scenes.flatMap((s, i) => checkScene(s, `scenes.${i}.`));
  const last = guion.scenes.at(-1);
  if (last && !last.narration.includes("?")) {
    errors.push("scenes.última › tiene que cerrar con una pregunta (pedido de comentarios)");
  }
  return errors;
}

/** El guion validado, en el formato del render (`voice` = índice de la escena). */
export function toRenderGuion(guion: GuionDraft): GuionScene[] {
  return guion.scenes.map((scene, voice) => ({ voice, ...scene }));
}

// Si el schema acepta algo que el render no sabe dibujar, esto deja de compilar.
type _Assignable = SceneDraft extends Omit<GuionScene, "voice"> ? true : never;
const _check: _Assignable = true;
void _check;

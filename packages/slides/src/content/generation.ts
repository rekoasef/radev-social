import { z } from "zod";
import { parseTheme } from "../presets/registry";
import {
  isLookId as isLookIdLocal,
  LOOK_ART,
  LOOK_GUIDE,
  type LookId,
  lookTakesArt,
} from "../presets/studio/look-ids";
import { ART_LOOK_SURFACES, type SurfaceOf, surfaceBackground } from "../presets/studio/surfaces";
import { enabledLooks } from "../presets/studio/tokens";
import { describeQaIssue, QA_KINDS, type QaIssue } from "../qa-issues";
import { carouselSchema } from "./carousel";
import type { ScreenDevice } from "./screens";

export { type ScreenDevice, screenDevice } from "./screens";

import { limits as L } from "./limits";
import { slideSchema } from "./slides";

// What the AI gets besides the JSON Schema when it writes a carousel (phase 3, T7): when to use
// each slide type, and the schema it must meet for a given brand. The schema says which fields
// exist; this says what each template is for (docs/DESIGN-SYSTEM.md §5).

/**
 * Slide types whose figures come from real data (`data.json`, phase 3 T11), never from the model
 * (CLAUDE.md, rule 9). The AI only uses them for a brand with data sources.
 */
export const DATA_SLIDES = ["chart", "bigNumber"] as const;

const DATA_GUIDE = `## Datos (\`data.json\`)

\`data.json\` trae datos reales del día (\`asOf\`): \`figures\` (cifras sueltas) y \`datasets\`
(series para gráficos). Son los **únicos** números que podés mostrar: no calcules otros ni los
redondees, y no escribas cifras que no estén ahí.

- \`bigNumber\`: \`value\` es el \`value\` de una cifra de \`figures\`, copiado tal cual (se controla:
  una cifra que no esté ahí rechaza el carrusel). \`label\` dice qué es; \`source\` es el \`source\` de la cifra.
- \`chart\`: \`datasetRef\` es la clave de uno de \`datasets\`; los puntos los pone el código, vos no.
  \`kind\`: \`line\` para ver cómo se movió algo, \`bar\` para comparar meses. \`source\` es el del dataset.
  El \`title\` y el \`caption\` describen lo que muestra el dataset, sin inventar tendencias que sus \`title\` y cifras no digan.
- Usalos cuando el tema lo pida (ej. el dólar); no hace falta meterlos en todos los carruseles.`;

const AI_SLIDE_GUIDE_BASE = `# Guía de slides

Cada slide es una plantilla con un diseño fijo: vos elegís el tipo y escribís los textos. Los
límites de caracteres están en el JSON Schema; respetalos, porque un texto más largo no entra.

## Estructura del carrusel

- Entre ${L.carousel.slides.min} y ${L.carousel.slides.max} slides. La primera siempre \`cover\`, la última siempre \`cta\`.
- \`hook\` es el título del post en TikTok: el mismo gancho de la portada, dicho para quien scrollea.
- \`caption\`: el texto del post. \`hashtags\`: hasta ${L.carousel.hashtags}, sin "#".
- Variá los tipos: no repitas el mismo tipo de slide dos veces seguidas salvo que haga falta.
- Variá la estructura entre posts: \`recent-posts.json\` trae la secuencia de tipos (\`slides\`) de
  los últimos. No copies la de ninguno; si el tema lo permite, usá tipos que vienen usándose poco.

## Tipos

- \`cover\`: portada con el hook. \`kicker\` es una etiqueta corta arriba (ej. "Serie costos").
- \`statement\`: una afirmación fuerte con un texto de apoyo. \`visual\` opcional: de un ícono a otro (antes → después).
- \`question\`: una pregunta que el lector se hace, con un recuadro que la responde o la matiza.
- \`cardGrid\`: 3 a 6 tarjetas **sin orden** entre ellas (opciones, ejemplos, síntomas).
- \`flow\`: 3 a 5 pasos **en orden** unidos por flechas, sin texto propio (un proceso de un vistazo). Palabras de hasta 16 letras.
- \`hubDiagram\`: 3 a 6 cosas que confluyen en un centro (ej. herramientas que se conectan a un sistema).
- \`comparison\`: X contra Y con 2 a 4 puntos cada uno y un veredicto. A la derecha va la opción que recomendás.
- \`costBreakdown\`: desglose de costos con rangos. **Solo** con rangos que estén en la sección Precios, copiados tal cual (se controla: un rango que no esté ahí rechaza el carrusel). Si no hay, no uses esta slide.
- \`steps\`: 3 a 5 pasos numerados, cada uno con título y explicación.
{{screen}}
- \`cta\`: cierre con llamado a la acción. \`button\` dice la acción concreta, hacia el canal de la sección Contacto de CLAUDE.md (ej. "Escribime por WhatsApp", "Entrá a la web").
{{data}}

## Énfasis

\`*texto*\` resalta con el color de la marca. Máximo 2 por slide, sin espacios pegados a los
asteriscos. No va en etiquetas de tarjetas, chips ni nodos (\`label\`, \`lead\`), en el \`kicker\`
de la portada, en \`name\` de \`comparison\`, en rangos ni en \`button\`.

## Íconos

Nombres de Lucide en kebab-case (ej. \`message-circle\`, \`calendar-clock\`, \`file-spreadsheet\`).
Si no estás seguro de que un ícono existe, usá uno común.
`;

/** A screenshot of the post as the AI gets it (ADR 0024): the image goes in the message. */
export type AiScreenshot = { id: string; note: string; device: ScreenDevice };

const NO_SCREEN =
  "- `screen`: muestra capturas de pantalla del post. Este post no tiene: no la uses.";

const SCREEN_GUIDE = `- \`screen\`: una o dos capturas de pantalla del post dentro de un celular o una notebook, con un título y un texto corto (ver Capturas).`;

/** The screenshots section of the guide, for a post that has them. */
function screenshotsGuide(): string {
  return `
## Capturas (\`screenshots.json\`)

El operador adjuntó capturas de pantalla para este post. Las ves en el mensaje, cada una después
de la línea que dice su \`id\`; \`screenshots.json\` trae, de cada una, el \`id\`, qué muestra en
palabras del operador (\`note\`) y dónde se dibuja (\`device\`: \`phone\` en un celular, \`laptop\` en
una notebook).

- Usá **al menos una** en una slide \`screen\` (se controla). \`screens\` lleva su \`id\`, o dos ids
  para mostrar las dos versiones juntas: entonces una \`phone\` y una \`laptop\`, nunca dos del mismo tipo.
- Cada captura, una sola vez en el carrusel. Si hay varias, ordenalas para que cuenten algo (ej.
  cargar un gasto → ver el resumen del mes).
- El texto cuenta lo que se ve: el gesto, el paso o el resultado. No describas la pantalla entera
  ni nombres cosas que no aparecen. Las cifras que se ven en una captura son reales y podés
  nombrarlas tal cual; no inventes otras.
`;
}

export { parseTheme } from "../presets/registry";
export {
  isLookId,
  LOOK_ART,
  LOOK_COOLDOWN,
  type LookId,
  lookChoices,
  lookTakesArt,
} from "../presets/studio/look-ids";

/**
 * Whether a studio brand gets generated images: not when it always uses its own element
 * (`heroAlways` with an element set, ADR 0016).
 */
export function brandMakesArt(stylePreset: string, themeTokens: unknown): boolean {
  const parsed = parseTheme(stylePreset, themeTokens);
  if (!parsed.ok || parsed.theme.preset !== "studio") return false;
  const { heroAlways, heroAsset } = parsed.theme.tokens;
  return !(heroAlways && heroAsset);
}

/** The looks a brand has on (`studio` preset); empty for the other presets or broken tokens. */
export function brandLooks(stylePreset: string, themeTokens: unknown): LookId[] {
  const parsed = parseTheme(stylePreset, themeTokens);
  return parsed.ok && parsed.theme.preset === "studio" ? enabledLooks(parsed.theme.tokens) : [];
}

/** How to describe the images, for the looks that take them. */
function artGuide(looks: readonly LookId[]): string {
  const withArt = looks.filter((id) => LOOK_ART[id]);
  if (withArt.length === 0) return "";
  return `
## Imagen (solo ${withArt.map((id) => `\`${id}\``).join(", ")})

Si elegís uno de estos looks, el post lleva dos imágenes generadas: una en la portada y otra en el
cierre. Salen como **fotos de producto**: un objeto real, grande, con su material bien visible. En
\`art\` describí **un objeto** para cada una, **en inglés**, en una o dos frases: qué es, de qué
material, en qué estado está o qué le pasa. Que la del cierre se sienta como el desenlace de la
de la portada. El estilo, la luz, el color y el fondo los agrega el código: no los describas.

- Si la portada o el cierre son \`bleed\`, esa imagen es una **escena**: describí un lugar, sin personas, con el objeto del tema en él (ej. "An empty small shop counter at night, a dusty brass service bell on it").
- Con una afirmación \`photo\`, describí en \`art.middle\` un objeto más, que acompañe a esa afirmación.

**Que se entienda en un segundo al lado del título.** Alguien que ve la portada tiene que
conectar el objeto con el tema sin pensarlo: si hay que explicar la relación, no sirve. Empezá
por el objeto más directo del tema (para plata: una billetera, una alcancía; para
tiempo: un reloj, un reloj de arena; para orden: cajas, cajones, cables) y contá la historia con
su estado. Evitá metáforas rebuscadas.

- "¿Cuánto cuesta realmente tener una app?" → "A worn leather wallet stretched to bursting, its seams splitting open" / "The same wallet, mended and neatly closed, comfortably full".
- "Tu pyme pierde clientes por no contestar WhatsApp" → "A brass shop service bell covered in thick dust" / "The same bell, polished and gleaming, ready to ring".

- **Objetos concretos y cotidianos**, de los que se pueden tocar: herramientas, cerraduras, llaves, relojes, engranajes, cables, enchufes, lámparas, tazas, sillas, plantas, frutas, piedras, cuerdas, nudos, sobres cerrados, piezas de máquinas, juguetes.
- **Variá el material**: madera, cerámica, metal oxidado o pulido, papel plegado, tela, cuero, hormigón, goma, cera, hielo. No todo es vidrio.
- **Evitá lo gastado**: esferas, orbes, burbujas, cristales, fragmentos flotando, cubos que brillan, objetos "de tecnología" genéricos y monedas para hablar de plata. Si se te ocurre uno de esos, buscá otro.
- El estado cuenta la historia: roto, gastado, a medio armar, atado, desbordado, en equilibrio, recién reparado.
- **Solo el objeto** (salvo en una escena), entero, sobre un fondo liso: sin mesa, estante, piso ni escenario debajo, y nada que cuelgue o entre desde fuera del cuadro (cuerdas, cables o cadenas que se cortan en el borde). La imagen se funde con la slide por los bordes.
- "Tu equipo hace todo a mano" → "A tall stack of mismatched ceramic cups leaning dangerously to one side" / "The same cups, sorted into three neat, steady stacks".
- Nunca personas, caras ni manos, ni cosas con texto (carteles, pantallas, libros, cuadernos, gráficos, etiquetas): el modelo inventa letras.
- Con los demás looks no escribas \`art\`.
`;
}

export type ArtSlotSpec = {
  slot: "cover" | "cta" | "middle";
  background: "dark" | "light";
  /** A place across the whole slide (`bleed`, 1024×1280) instead of an object (ADR 0026). */
  scene: boolean;
  monochrome: boolean;
};

/**
 * The images a carousel in a look asks for (ADR 0016, 0026): the cover and the close always, the
 * middle one when a statement has the `photo` composition; each with the background of its slide
 * and as a scene when that slide is `bleed`. Empty for a look without images.
 */
export function artSlotsOf(
  look: string,
  slides: readonly { type: string; composition?: string }[],
): ArtSlotSpec[] {
  if (!isLookIdLocal(look)) return [];
  const spec = LOOK_ART[look];
  const surfaceOf = (ART_LOOK_SURFACES as Partial<Record<LookId, SurfaceOf>>)[look];
  if (!spec || !surfaceOf) return [];
  const monochrome = spec.monochrome === true;
  const bleed = (slide: { composition?: string } | undefined) => slide?.composition === "bleed";
  const slots: ArtSlotSpec[] = [
    { slot: "cover", background: spec.cover, scene: bleed(slides[0]), monochrome },
    { slot: "cta", background: spec.cta, scene: bleed(slides.at(-1)), monochrome },
  ];
  const index = slides.findIndex((s) => s.type === "statement" && s.composition === "photo");
  if (index > 0) {
    const surface = surfaceOf({ index, total: slides.length, type: "statement" });
    slots.push({
      slot: "middle",
      background: surfaceBackground(surface),
      scene: false,
      monochrome,
    });
  }
  return slots;
}

/**
 * Whether a version gets generated images (ADR 0016): a `studio` brand, a look that takes them
 * and the subjects written. The web and the worker queue art.generate for it before the render.
 */
export function versionTakesArt(
  stylePreset: string,
  content: { look?: string; art?: unknown },
  themeTokens?: unknown,
): boolean {
  return (
    stylePreset === "studio" &&
    (themeTokens === undefined || brandMakesArt(stylePreset, themeTokens)) &&
    Boolean(content.art) &&
    typeof content.look === "string" &&
    isLookIdLocal(content.look) &&
    lookTakesArt(content.look)
  );
}

/** The look section of the guide: the looks the post may take, with what each one is for. */
function lookGuide(looks: readonly LookId[], art: boolean): string {
  return `
## Look

El diseño del carrusel lo da su \`look\`: elegí **uno** de estos, el que mejor le quede al tema y
al tono del post. Cambia todo (colores, tipografía, composición), así que pensalo como la
dirección de arte. Los looks de los últimos posts no están en la lista a propósito.

${looks.map((id) => `- \`${id}\`: ${LOOK_GUIDE[id]}`).join("\n")}
${compositionGuide(looks, art)}${art ? artGuide(looks) : ""}`;
}

/**
 * The composition section (ADR 0026): the structure of each slide, apart from its look. The ones
 * that need generated images only where the post gets them.
 */
function compositionGuide(
  looks: readonly LookId[],
  art: boolean,
  /** Replaces the note on the compositions that need a generated image. */
  imageNoteOverride?: string,
): string {
  const withArt = art && looks.some((id) => LOOK_ART[id]);
  const imageNote =
    imageNoteOverride ??
    (withArt
      ? "solo con los looks que llevan imagen"
      : "no los uses: este post no lleva imágenes generadas");
  return `
## Composición

Además del look, \`cover\`, \`statement\`, \`steps\`, \`cardGrid\` y \`cta\` llevan
\`composition\`: su estructura. Elegila según el contenido de cada slide y **variá**: que dos
slides del mismo tipo no compartan composición y que el carrusel no se vea siempre igual. Sin
\`composition\` sale la primera de cada lista.

- \`cover\`: \`hero\` (objeto arriba, título abajo) · \`split\` (título grande a la izquierda, el objeto cortado por el borde derecho; mejor con títulos cortos) · \`giant\` (título arriba, el objeto abajo) · \`bleed\` (una escena de fondo a sangre y el título abajo; ${imageNote}).
- \`statement\`: \`center\` (la afirmación sola, grande) · \`quote\` (comillas gigantes: para una frase que alguien diría o una verdad incómoda; no escribas comillas en el título, las pone la composición) · \`drawing\` (un ícono grande en órbitas: poné \`icon\`) · \`photo\` (una imagen generada arriba, descripta en \`art.middle\`; una sola por carrusel; ${imageNote}).
- \`steps\`: \`list\` (pasos en lista) · \`grid\` (dos columnas con números grandes; mejor con textos cortos) · \`path\` (zigzag por una línea central).
- \`cardGrid\`: \`list\` (tarjetas en lista) · \`tiles\` (mosaico de paneles) · \`bento\` (la primera tarjeta grande arriba: poné primero la más importante).
- \`cta\`: \`center\` · \`bleed\` (escena a sangre detrás; ${imageNote}).
`;
}

/**
 * What the AI reads about the templates (`slides.md`). With `data`, the brand has real data
 * (`data.json`) and may use the data slides. With `looks` (a `studio` brand), it also picks the
 * post's look among them.
 */
export function aiSlideGuide(options: {
  data: boolean;
  looks?: readonly LookId[];
  /** Whether the post gets generated images (brandMakesArt); true by default. */
  art?: boolean;
  /** The post's screenshots (ADR 0024): only a `studio` brand draws them. */
  screenshots?: readonly AiScreenshot[];
  /**
   * Rewriting one slide: the look the post already has. Adds the compositions (not the choice of
   * look), so the AI can change the structure of the slide and not only its texts.
   */
  rewriteLook?: LookId;
}): string {
  const dataSlides = DATA_SLIDES.map((type) => `\`${type}\``).join(" ni ");
  const dataPart = options.data
    ? `- \`bigNumber\`: una cifra enorme de \`data.json\` con su contexto.
- \`chart\`: un gráfico de líneas o barras con un dataset de \`data.json\`.

${DATA_GUIDE}`
    : `
No uses ${dataSlides}: sus cifras tienen que venir de datos reales que esta marca no tiene.`;
  const looks =
    options.looks && options.looks.length > 0 ? lookGuide(options.looks, options.art ?? true) : "";
  const screens = (options.screenshots?.length ?? 0) > 0;
  return (
    AI_SLIDE_GUIDE_BASE.replace("{{screen}}", screens ? SCREEN_GUIDE : NO_SCREEN).replace(
      "{{data}}",
      dataPart,
    ) +
    (screens ? screenshotsGuide() : "") +
    looks +
    (options.rewriteLook ? compositionGuide([options.rewriteLook], false, REWRITE_IMAGE_NOTE) : "")
  );
}

/** Rewriting a slide can't ask for a new image: only keep one the slide already has. */
const REWRITE_IMAGE_NOTE =
  "no la elijas al rehacer una slide, porque necesita una imagen nueva; si la slide ya la tiene, podés dejarla";

/** Words of a slide's texts (and icons), without emphasis marks or punctuation. */
function slideWords(slide: unknown, into = new Set<string>()): Set<string> {
  if (typeof slide === "string") {
    for (const word of slide.toLowerCase().split(/[^\p{L}\p{N}-]+/u)) if (word) into.add(word);
  } else if (Array.isArray(slide)) {
    for (const item of slide) slideWords(item, into);
  } else if (slide && typeof slide === "object") {
    for (const [key, value] of Object.entries(slide)) {
      if (!REWRITE_IGNORED_KEYS.has(key)) slideWords(value, into);
    }
  }
  return into;
}
const REWRITE_IGNORED_KEYS = new Set(["type", "composition", "layout"]);

/** Share of words two versions of a slide have in common for it to count as the same one. */
export const REWRITE_SAME_WORDS = 0.75;

/**
 * Whether a rewritten slide is practically the one it replaces: same type, same composition and
 * most of the words in common (a word or two touched up). The hand layout doesn't count.
 */
export function rewriteTooSimilar(before: unknown, after: unknown): boolean {
  const field = (slide: unknown, key: string) =>
    slide && typeof slide === "object" ? (slide as Record<string, unknown>)[key] : undefined;
  if (field(before, "type") !== field(after, "type")) return false;
  if (field(before, "composition") !== field(after, "composition")) return false;
  const a = slideWords(before);
  const b = slideWords(after);
  const union = new Set([...a, ...b]).size;
  if (union === 0) return true;
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / union >= REWRITE_SAME_WORDS;
}

/** A range as written, for comparing: no case, no spaces, one kind of dash. */
function normalizeRange(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, "");
}

/**
 * The carousel schema for a brand's generation: the brand's pillars only, and no blocked slides.
 * With `pricing` (the brand's pricing document, empty when there is none), every range of a
 * `costBreakdown` has to be written in it as is: the AI never makes up a price (CLAUDE.md, rule 9).
 * Refinements don't reach the JSON Schema, so the brand's CLAUDE.md lists the pillar keys.
 * Without `data` the data slides are rejected; with it, a chart must point to one of its datasets
 * and a bigNumber must show one of its figures (`isFigure`).
 */
export function aiCarouselSchema(
  pillarKeys: readonly string[],
  options: {
    pricing?: string;
    data?: { datasets: readonly string[]; isFigure: (value: string) => boolean };
    /** A `studio` brand: the post must take one of these looks (lookChoices). */
    looks?: readonly LookId[];
    /** Whether the images are asked for (brandMakesArt); true by default. */
    art?: boolean;
    /** The post's screenshots: `screen` slides show only these, and at least one of them. */
    screenshots?: readonly AiScreenshot[];
  } = {},
) {
  const looks = options.looks && options.looks.length > 0 ? options.looks : undefined;
  const data = options.data;
  const pricing = options.pricing === undefined ? undefined : normalizeRange(options.pricing);
  const shots = new Map((options.screenshots ?? []).map((shot) => [shot.id, shot]));
  return carouselSchema.superRefine((carousel, ctx) => {
    if (pricing !== undefined) {
      carousel.slides.forEach((slide, index) => {
        if (slide.type !== "costBreakdown") return;
        const ranges = [
          ...slide.items.map((item, i) => ({ range: item.range, path: ["items", i, "range"] })),
          { range: slide.total.range, path: ["total", "range"] },
        ];
        for (const { range, path } of ranges) {
          if (!pricing.includes(normalizeRange(range))) {
            ctx.addIssue({
              code: "custom",
              path: ["slides", index, ...path],
              message: `"${range}" no está en Precios: los rangos se copian tal cual de ahí. Si Precios no tiene lo que necesitás, no uses \`costBreakdown\`.`,
            });
          }
        }
      });
    }
    if (looks && (!carousel.look || !looks.includes(carousel.look))) {
      ctx.addIssue({
        code: "custom",
        path: ["look"],
        message: `Elegí el \`look\` entre estos (ver slides.md): ${looks.join(", ")}.`,
      });
    }
    if (
      looks &&
      options.art !== false &&
      carousel.look &&
      lookTakesArt(carousel.look) &&
      !carousel.art
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["art"],
        message: `El look \`${carousel.look}\` lleva imagen: describí en \`art\` el objeto de la portada y el del cierre (ver slides.md).`,
      });
    }
    if (!pillarKeys.includes(carousel.pillarKey)) {
      ctx.addIssue({
        code: "custom",
        path: ["pillarKey"],
        message: `El pilar tiene que ser uno de la marca: ${pillarKeys.join(", ")}.`,
      });
    }
    if (shots.size > 0 && !carousel.slides.some((slide) => slide.type === "screen")) {
      ctx.addIssue({
        code: "custom",
        path: ["slides"],
        message:
          "El operador adjuntó capturas: mostrá al menos una en una slide `screen` (ver Capturas en slides.md).",
      });
    }
    carousel.slides.forEach((slide, index) => {
      if (slide.type === "screen") {
        if (shots.size === 0) {
          ctx.addIssue({
            code: "custom",
            path: ["slides", index, "type"],
            message: "No se puede usar `screen`: este post no tiene capturas.",
          });
        }
        const devices = slide.screens.map((id) => shots.get(id)?.device);
        slide.screens.forEach((id, i) => {
          if (shots.size > 0 && !shots.has(id)) {
            ctx.addIssue({
              code: "custom",
              path: ["slides", index, "screens", i],
              message: `"${id}" no es una captura de este post. Usá un \`id\` de screenshots.json.`,
            });
          }
        });
        if (devices.length === 2 && devices[0] && devices[0] === devices[1]) {
          ctx.addIssue({
            code: "custom",
            path: ["slides", index, "screens"],
            message:
              "Dos capturas juntas tienen que ser una `phone` y una `laptop`: dejá una sola.",
          });
        }
      }
      if (!data) {
        if ((DATA_SLIDES as readonly string[]).includes(slide.type)) {
          ctx.addIssue({
            code: "custom",
            path: ["slides", index, "type"],
            message: `No se puede usar \`${slide.type}\`: necesita datos reales y esta marca no tiene.`,
          });
        }
        return;
      }
      if (slide.type === "chart" && !data.datasets.includes(slide.datasetRef)) {
        ctx.addIssue({
          code: "custom",
          path: ["slides", index, "datasetRef"],
          message: `"${slide.datasetRef}" no es un dataset de data.json. Usá uno de: ${data.datasets.join(", ")}.`,
        });
      }
      if (slide.type === "bigNumber" && !data.isFigure(slide.value)) {
        ctx.addIssue({
          code: "custom",
          path: ["slides", index, "value"],
          message: `"${slide.value}" no es una cifra de data.json: copiá el \`value\` de una de \`figures\` tal cual.`,
        });
      }
    });
  });
}

export type AiCarouselSchema = ReturnType<typeof aiCarouselSchema>;

/**
 * The answer of a slide rewrite (editor, "Rehacer con IA"): one slide, checked inside the whole
 * carousel with the same rules as a generated one (limits, emphasis, prices, real figures, cover
 * first and cta last), so it can go in as is. The carousel's issues come back as the slide's.
 */
export function aiSlideRewriteSchema(
  carousel: { slides: readonly unknown[] } & Record<string, unknown>,
  slideIndex: number,
  rules: Parameters<typeof aiCarouselSchema>,
) {
  const whole = aiCarouselSchema(...rules);
  return z.object({ slide: slideSchema }).superRefine(({ slide }, ctx) => {
    const slides = carousel.slides.map((current, i) => (i === slideIndex ? slide : current));
    const result = whole.safeParse({ ...carousel, slides });
    if (result.success) return;
    for (const issue of result.error.issues) {
      const [first, index, ...rest] = issue.path;
      // Only what the new slide causes: the rest of the carousel was already fine.
      if (first !== "slides" || index !== slideIndex) continue;
      ctx.addIssue({ code: "custom", path: ["slide", ...rest], message: issue.message });
    }
  });
}
export type AiCarousel = z.infer<AiCarouselSchema>;

/** A render issue as the worker stores it on a version (`post_versions.render_issues`). */
export type StoredRenderIssue = { slide: number; kind: string; text: string };

/**
 * The render QA problems of a version, for the AI to fix them (phase 3, T8): one line per problem,
 * with its slide. Render errors (the page failed) are left out: they are not the content's fault.
 */
export function describeRenderProblems(issues: readonly StoredRenderIssue[]): string[] {
  const lines = issues.flatMap((issue) =>
    (QA_KINDS as readonly string[]).includes(issue.kind)
      ? [`Slide ${issue.slide + 1}: ${describeQaIssue(issue as QaIssue)}`]
      : [],
  );
  // A text and its box can report the same problem.
  return [...new Set(lines)];
}

import type { z } from "zod";
import { describeQaIssue, QA_KINDS, type QaIssue } from "../qa-issues";
import { carouselSchema } from "./carousel";
import { limits as L } from "./limits";

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
- \`cta\`: cierre con llamado a la acción. \`button\` dice la acción concreta (ej. "Escribime por WhatsApp").
{{data}}

## Énfasis

\`*texto*\` resalta con el color de la marca. Máximo 2 por slide, sin espacios pegados a los
asteriscos. No va en etiquetas de tarjetas, chips ni nodos (\`label\`, \`lead\`), en el \`kicker\`
de la portada, en \`name\` de \`comparison\`, en rangos ni en \`button\`.

## Íconos

Nombres de Lucide en kebab-case (ej. \`message-circle\`, \`calendar-clock\`, \`file-spreadsheet\`).
Si no estás seguro de que un ícono existe, usá uno común.
`;

/**
 * What the AI reads about the templates (`slides.md`). With `data`, the brand has real data
 * (`data.json`) and may use the data slides.
 */
export function aiSlideGuide(options: { data: boolean }): string {
  const dataSlides = DATA_SLIDES.map((type) => `\`${type}\``).join(" ni ");
  const dataPart = options.data
    ? `- \`bigNumber\`: una cifra enorme de \`data.json\` con su contexto.
- \`chart\`: un gráfico de líneas o barras con un dataset de \`data.json\`.

${DATA_GUIDE}`
    : `
No uses ${dataSlides}: sus cifras tienen que venir de datos reales que esta marca no tiene.`;
  return AI_SLIDE_GUIDE_BASE.replace("{{data}}", dataPart);
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
 * A post of a series also has the slide types the series requires (phase 3, T10). With `pricing`
 * (the brand's pricing document, empty when there is none), every range of a `costBreakdown` has
 * to be written in it as is: the AI never makes up a price (CLAUDE.md, rule 9). Refinements
 * don't reach the JSON Schema, so the brand's CLAUDE.md lists the pillar keys and `task.json`
 * the series' slides. Without `data` the data slides are rejected; with it, a chart must point
 * to one of its datasets and a bigNumber must show one of its figures (`isFigure`).
 */
export function aiCarouselSchema(
  pillarKeys: readonly string[],
  options: {
    requiredSlides?: readonly string[];
    pricing?: string;
    data?: { datasets: readonly string[]; isFigure: (value: string) => boolean };
  } = {},
) {
  const data = options.data;
  const required = options.requiredSlides ?? [];
  const pricing = options.pricing === undefined ? undefined : normalizeRange(options.pricing);
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
    const present = new Set<string>(carousel.slides.map((slide) => slide.type));
    const missing = required.filter((type) => !present.has(type));
    if (missing.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["slides"],
        message: `La serie exige estas slides y faltan: ${missing.map((t) => `\`${t}\``).join(", ")}.`,
      });
    }
    if (!pillarKeys.includes(carousel.pillarKey)) {
      ctx.addIssue({
        code: "custom",
        path: ["pillarKey"],
        message: `El pilar tiene que ser uno de la marca: ${pillarKeys.join(", ")}.`,
      });
    }
    carousel.slides.forEach((slide, index) => {
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

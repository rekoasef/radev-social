import type { z } from "zod";
import { describeQaIssue, QA_KINDS, type QaIssue } from "../qa-issues";
import { carouselSchema } from "./carousel";
import { limits as L } from "./limits";

// What the AI gets besides the JSON Schema when it writes a carousel (phase 3, T7): when to use
// each slide type, and the schema it must meet for a given brand. The schema says which fields
// exist; this says what each template is for (docs/DESIGN-SYSTEM.md §5).

/**
 * Slide types the AI may not use yet: their figures must come from real data (data.json, phase 3
 * T11), never from the model (CLAUDE.md, rule 9).
 */
export const AI_BLOCKED_SLIDES = ["chart", "bigNumber"] as const;

export const AI_SLIDE_GUIDE = `# Guía de slides

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
- \`costBreakdown\`: desglose de costos con rangos. **Solo** con rangos que estén en la sección Precios; si no hay, no uses esta slide.
- \`steps\`: 3 a 5 pasos numerados, cada uno con título y explicación.
- \`cta\`: cierre con llamado a la acción. \`button\` dice la acción concreta (ej. "Escribime por WhatsApp").

No uses ${AI_BLOCKED_SLIDES.map((type) => `\`${type}\``).join(" ni ")}: sus cifras tienen que venir de datos reales que todavía no tenés.

## Énfasis

\`*texto*\` resalta con el color de la marca. Máximo 2 por slide, sin espacios pegados a los
asteriscos. No va en etiquetas de tarjetas, chips ni nodos (\`label\`, \`lead\`), en el \`kicker\`
de la portada, en \`name\` de \`comparison\`, en rangos ni en \`button\`.

## Íconos

Nombres de Lucide en kebab-case (ej. \`message-circle\`, \`calendar-clock\`, \`file-spreadsheet\`).
Si no estás seguro de que un ícono existe, usá uno común.
`;

/**
 * The carousel schema for a brand's generation: the brand's pillars only, and no blocked slides.
 * Refinements don't reach the JSON Schema, so the brand's CLAUDE.md lists the pillar keys.
 */
export function aiCarouselSchema(pillarKeys: readonly string[]) {
  return carouselSchema.superRefine((carousel, ctx) => {
    if (!pillarKeys.includes(carousel.pillarKey)) {
      ctx.addIssue({
        code: "custom",
        path: ["pillarKey"],
        message: `El pilar tiene que ser uno de la marca: ${pillarKeys.join(", ")}.`,
      });
    }
    carousel.slides.forEach((slide, index) => {
      if ((AI_BLOCKED_SLIDES as readonly string[]).includes(slide.type)) {
        ctx.addIssue({
          code: "custom",
          path: ["slides", index, "type"],
          message: `No se puede usar \`${slide.type}\` todavía: necesita datos reales.`,
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

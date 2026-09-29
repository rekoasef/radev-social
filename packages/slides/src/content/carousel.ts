import { z } from "zod";
import { LOOK_IDS } from "../presets/studio/look-ids";
import { key, plainText } from "./fields";
import { limits as L } from "./limits";
import { slideSchema } from "./slides";

export const HOOK_TYPES = [
  "cost",
  "warning",
  "myth",
  "comparison",
  "question",
  "data",
  "story",
  "howto",
] as const;

export type HookType = (typeof HOOK_TYPES)[number];

/**
 * Things an image subject may not have: people (DESIGN-SYSTEM §1) and anything the model would
 * fill with made-up writing. In English, like the subject.
 */
const ART_FORBIDDEN =
  /\b(person|people|man|men|woman|women|child|children|kid|kids|girl|boy|human|face|faces|hand|hands|text|letters?|words?|writing|handwritten|sign|signs|logo|logos|label|newspaper|document|book|notebook|page|pages|screen|screens|monitor|display|poster|chart|graph)\b/i;

const artSubject = z
  .string()
  .trim()
  .min(L.carousel.artSubject.min, { error: "Describí el objeto de la imagen con más detalle." })
  .max(L.carousel.artSubject.max, { error: `Máximo ${L.carousel.artSubject.max} caracteres.` })
  .refine((text) => !ART_FORBIDDEN.test(text), {
    error:
      "La imagen es un objeto, sin personas ni nada con texto (carteles, pantallas, libros, gráficos): describí otro objeto.",
  });

export const carouselSchema = z
  .object({
    hook: plainText(L.carousel.hook),
    pillarKey: key,
    hookType: z.enum(HOOK_TYPES),
    slides: z
      .array(slideSchema)
      .min(L.carousel.slides.min, {
        error: `El carrusel necesita al menos ${L.carousel.slides.min} slides.`,
      })
      .max(L.carousel.slides.max, { error: `Hasta ${L.carousel.slides.max} slides.` }),
    caption: z
      .string()
      .trim()
      .min(1, { error: "Escribí el texto del post." })
      .max(L.carousel.caption, { error: `Máximo ${L.carousel.caption} caracteres.` }),
    hashtags: z
      .array(z.string().regex(/^[\p{L}\p{N}_]+$/u, { error: "Sin #, espacios ni signos." }))
      .max(L.carousel.hashtags, { error: `Hasta ${L.carousel.hashtags} hashtags.` }),
    /**
     * Look of the post, for brands on the `studio` preset (docs/DESIGN-SYSTEM.md §10). Without
     * it, one of the brand's looks is picked by the post id.
     */
    look: z.enum(LOOK_IDS).optional(),
    /**
     * Subjects of the generated images (ADR 0016), in English: one object for the cover and one
     * for the close. Only for looks that take images (LOOK_ART); the code adds the style rules.
     */
    art: z.object({ cover: artSubject, cta: artSubject }).optional(),
    /** One per slide. */
    altTexts: z.array(z.string().trim().min(1, { error: "No puede estar vacío." })).optional(),
  })
  .superRefine((carousel, ctx) => {
    const last = carousel.slides.length - 1;
    carousel.slides.forEach((slide, index) => {
      if (index === 0 && slide.type !== "cover") {
        ctx.addIssue({
          code: "custom",
          path: ["slides", 0],
          message: "La primera slide tiene que ser `cover`.",
        });
      }
      if (index === last && slide.type !== "cta") {
        ctx.addIssue({
          code: "custom",
          path: ["slides", index],
          message: "La última slide tiene que ser `cta`.",
        });
      }
      if (index !== 0 && slide.type === "cover") {
        ctx.addIssue({
          code: "custom",
          path: ["slides", index],
          message: "`cover` solo puede ir primera.",
        });
      }
      if (index !== last && slide.type === "cta") {
        ctx.addIssue({
          code: "custom",
          path: ["slides", index],
          message: "`cta` solo puede ir última.",
        });
      }
    });
    if (carousel.altTexts && carousel.altTexts.length !== carousel.slides.length) {
      ctx.addIssue({
        code: "custom",
        path: ["altTexts"],
        message: `Tiene que haber un texto alternativo por slide (${carousel.slides.length}).`,
      });
    }
  });

export type Carousel = z.infer<typeof carouselSchema>;

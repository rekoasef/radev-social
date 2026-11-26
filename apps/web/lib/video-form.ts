import { z } from "zod";

// What "Nuevo video" accepts.

export const TOPIC_MIN = 10;
export const TOPIC_MAX = 400;

export const newVideoSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(TOPIC_MIN, `Contá el tema en al menos ${TOPIC_MIN} caracteres.`)
    .max(TOPIC_MAX, `El tema puede tener hasta ${TOPIC_MAX} caracteres.`),
  /** Empty: no brand (the stories channel). */
  brandId: z.union([z.literal(""), z.uuid("Esa marca no existe.")]),
  voiceId: z.uuid("Elegí una voz."),
});

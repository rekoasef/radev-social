// Correcciones por parches: en vez de devolver el guion entero (~19k tokens de salida) para
// cambiar 2 o 3 escenas, la IA devuelve solo las escenas que cambian y el código las pega en su
// lugar. La salida baja a ~2–4k tokens. Cada parche pasa por los mismos controles que un guion.
import { z } from "zod";
import { type GuionDraft, guionLargoSchema, sceneSchema } from "./schema";

export const patchSchema = z
  .object({
    scenes: z
      .array(
        z
          .object({
            n: z
              .number()
              .int()
              .min(1)
              .describe(
                "Posición de la escena en `scenes` de anterior.json, desde 1. Para sumar una escena al final, usá la cantidad actual + 1.",
              ),
            scene: sceneSchema.describe(
              "La escena COMPLETA, ya corregida (reemplaza a la anterior).",
            ),
          })
          .strict(),
      )
      .min(1)
      .max(25)
      .describe("SOLO las escenas que cambian. Las que no nombrás quedan como estaban."),
    title: z.string().optional().describe("Solo si cambia el título."),
    sets: guionLargoSchema.shape.sets.describe(
      "Solo si cambia algún escenario: la lista completa.",
    ),
    cast: guionLargoSchema.shape.cast.describe("Solo si cambia el elenco: la lista completa."),
    missingPlaces: guionLargoSchema.shape.missingPlaces.describe(
      "Solo si cambia: la lista completa.",
    ),
    facts: guionLargoSchema.shape.facts
      .optional()
      .describe("Solo si cambia algún dato: la lista COMPLETA de datos del guion corregido."),
  })
  .strict();

export type GuionPatch = z.infer<typeof patchSchema>;

export type PatchResult =
  | { ok: true; guion: GuionDraft; changed: number[] }
  | { ok: false; errors: string[] };

/** Pega el parche sobre el guion anterior. No toca el original. */
export function applyPatch(base: GuionDraft, patch: GuionPatch): PatchResult {
  const scenes = [...base.scenes];
  const errors: string[] = [];
  const seen = new Set<number>();
  for (const { n } of patch.scenes) {
    if (seen.has(n)) errors.push(`parche › la escena ${n} viene dos veces`);
    seen.add(n);
    if (n > scenes.length + 1) {
      errors.push(
        `parche › escena ${n}: el guion tiene ${scenes.length}; solo se puede sumar la ${scenes.length + 1}`,
      );
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  // Los reemplazos primero y las escenas nuevas al final, en orden.
  const sorted = [...patch.scenes].sort((a, b) => a.n - b.n);
  for (const { n, scene } of sorted) {
    if (n <= scenes.length) scenes[n - 1] = scene;
    else scenes.push(scene);
  }
  const guion: GuionDraft = {
    ...base,
    title: patch.title ?? base.title,
    sets: patch.sets ?? base.sets,
    cast: patch.cast ?? base.cast,
    missingPlaces: patch.missingPlaces ?? base.missingPlaces,
    facts: patch.facts ?? base.facts,
    scenes,
  };
  return { ok: true, guion, changed: sorted.map((s) => s.n) };
}

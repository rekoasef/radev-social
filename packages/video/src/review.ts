// Oficina de Verificación de hechos: una segunda IA revisa el guion contra el dossier y devuelve
// correcciones mínimas. El código solo aplica las que no rompen ninguna regla.
import { z } from "zod";
import type { ImageCandidate } from "./images";
import { checkScript, graphicSchema, type Script, viewSchema } from "./script";

export const reviewSchema = z.object({
  fixes: z
    .array(
      z
        .object({
          scene: z.number().int().min(1).describe("Número de escena (1 = la primera)."),
          kind: z.enum([
            "no-respaldado",
            "disputa",
            "no-confirmado",
            "cita",
            "numero",
            "imagen",
            "estilo",
          ]),
          problem: z.string().min(5).max(300),
          narration: z
            .string()
            .min(10)
            .max(260)
            .optional()
            .describe("La narración corregida COMPLETA, si había que cambiarla."),
          cita: z
            .object({ text: z.string().min(1).max(110), by: z.string().min(1).max(36) })
            .strict()
            .optional(),
          caption: z
            .string()
            .min(1)
            .max(70)
            .optional()
            .describe("Aclaración de la imagen, si insinúa lo que no es."),
          image: z
            .string()
            .regex(/^i\d{2,3}$/)
            .optional()
            .describe("Id de una candidata mejor, si la imagen no muestra lo que se dice."),
          from: viewSchema.optional(),
          to: viewSchema.optional(),
          graphics: z
            .array(graphicSchema)
            .max(2)
            .optional()
            .describe(
              "Los gráficos de la escena corregidos COMPLETOS, si al cambiar la narración alguno quedó con un dato que ya no se dice.",
            ),
        })
        .strict(),
    )
    .max(16),
});
export type Review = z.infer<typeof reviewSchema>;
export type Fix = Review["fixes"][number];
export type RejectedFix = { fix: Fix; why: string };

/** Lo que la IA verificadora necesita ver del guion (sin encuadres, con el título de cada imagen). */
export function reviewView(g: Script, candidates: ImageCandidate[]) {
  return {
    title: g.title,
    scenes: g.scenes.map((s, i) => ({
      scene: i + 1,
      narration: s.narration,
      image: candidates.find((c) => c.id === s.image)?.title,
      caption: s.caption,
      graphics: s.graphics,
    })),
    facts: g.facts,
  };
}

/**
 * Aplica las correcciones una por una y se queda solo con las que no suman errores nuevos
 * (palabras de enganche, números fuera del dossier, largo…). No modifica el guion que recibe.
 */
export function applyFixes(
  script: Script,
  fixes: Fix[],
  candidates: ImageCandidate[],
  dossierText: string,
): { script: Script; applied: Fix[]; rejected: RejectedFix[] } {
  let cur = structuredClone(script);
  const base = new Set(checkScript(cur, candidates, dossierText));
  const applied: Fix[] = [];
  const rejected: RejectedFix[] = [];
  for (const fix of fixes) {
    const next = structuredClone(cur);
    const sc = next.scenes[fix.scene - 1];
    if (!sc) {
      rejected.push({ fix, why: "escena inexistente" });
      continue;
    }
    if (fix.narration) sc.narration = fix.narration;
    if (fix.caption) sc.caption = fix.caption;
    if (fix.graphics) sc.graphics = fix.graphics;
    if (fix.image) {
      // sin encuadres propios: un acercamiento suave al centro
      sc.image = fix.image;
      sc.from = fix.from ?? { cx: 0.5, cy: 0.5, vw: 1 };
      sc.to = fix.to ?? { cx: 0.5, cy: 0.45, vw: 0.6 };
    }
    if (fix.cita) {
      const cita = sc.graphics.find((x) => x.kind === "cita");
      if (cita && cita.kind === "cita") {
        cita.text = fix.cita.text;
        cita.by = fix.cita.by;
      } else {
        rejected.push({ fix, why: "la escena no tiene cita" });
        continue;
      }
    }
    const fresh = checkScript(next, candidates, dossierText).filter((e) => !base.has(e));
    if (fresh.length > 0) rejected.push({ fix, why: fresh.join(" | ") });
    else {
      cur = next;
      applied.push(fix);
    }
  }
  return { script: cur, applied, rejected };
}

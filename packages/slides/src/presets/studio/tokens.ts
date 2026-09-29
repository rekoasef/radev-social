import { z } from "zod";
import { asset, color, font, text, toggle } from "../fields";
import { LOOK_IDS, LOOK_NAMES, type LookId } from "./look-ids";

// Tokens of the `studio` preset (docs/DESIGN-SYSTEM.md §10): a small palette the looks combine.
// Every look paints its slides on one of three surfaces (ink, paper, accent) and derives the
// rest (muted text, lines, panels) from them. Defaults are neutral on purpose: brand values
// live in the database (CLAUDE.md, rule 6).

const lookToggles = Object.fromEntries(
  LOOK_IDS.map((id) => [id, toggle(LOOK_NAMES[id], true)]),
) as Record<LookId, ReturnType<typeof toggle>>;

export const studioTokensSchema = z.object({
  colors: z
    .object({
      ink: color("Oscuro (fondo y texto)", "#0B0B0B"),
      paper: color("Claro (fondo y texto)", "#F2F0EC"),
      accent: color("Acento", "#3B82F6"),
      /** Second light for the glows of some looks (atmósfera, neón). */
      glow: color("Segundo acento (luces)", "#7C3AED"),
    })
    .prefault({})
    .meta({ title: "Colores" }),
  fonts: z
    .object({
      display: font("Títulos", { family: "Inter Tight", weight: 700 }),
      body: font("Texto", { family: "Inter", weight: 400 }),
      mono: font("Datos y etiquetas", { family: "Geist Mono", weight: 500 }),
      /** Titles of the editorial looks that call for a serif (revista). */
      serif: font("Títulos serif", { family: "Fraunces", weight: 500 }),
    })
    .prefault({})
    .meta({ title: "Tipografías" }),
  /** Built in code; empty means the brand name. */
  wordmark: z
    .object({
      text: text("Nombre", 24),
      dot: toggle("Punto de acento", true),
    })
    .prefault({})
    .meta({ title: "Wordmark" }),
  /** Where the CTA sends people, shown by some looks (e.g. the title block of `plano`). */
  handle: z
    .object({ site: text("Sitio o usuario", 40) })
    .prefault({})
    .meta({ title: "Firma" }),
  /** Looks the brand uses; the AI picks one per post among these (at least one stays on). */
  looks: z
    .object(lookToggles)
    .prefault({})
    .refine((looks) => Object.values(looks).some(Boolean), {
      error: "Dejá al menos un look activo.",
    })
    .meta({ title: "Looks" }),
  /** Replaces the wordmark when set. */
  logoAsset: asset("Logo", "logo"),
});

export type StudioTokens = z.infer<typeof studioTokensSchema>;

/** The looks a brand has turned on, in catalog order. */
export function enabledLooks(tokens: StudioTokens): LookId[] {
  return LOOK_IDS.filter((id) => tokens.looks[id]);
}

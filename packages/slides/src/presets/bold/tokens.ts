import { z } from "zod";
import { asset, color, font, lines, range, text, toggle } from "../fields";

// Tokens of the `bold` preset (docs/DESIGN-SYSTEM.md §7). Defaults are neutral on purpose:
// brand values live in the database (CLAUDE.md, rule 6).

export const boldTokensSchema = z.object({
  colors: z
    .object({
      bg: color("Fondo", "#0B0B0B"),
      surface: color("Tarjetas y cajas", "#121212"),
      accent: color("Acento", "#3B82F6"),
      text: color("Texto", "#FFFFFF"),
      muted: color("Texto de apoyo", "#A1A1AA"),
      line: color("Líneas y divisores", "#27272A"),
    })
    .prefault({})
    .meta({ title: "Colores" }),
  glow: z
    .object({ intensity: range("Intensidad del brillo", { min: 0, max: 0.5, step: 0.05 }, 0.35) })
    .prefault({})
    .meta({ title: "Brillo" }),
  fonts: z
    .object({
      display: font("Títulos", { family: "Inter Tight", weight: 900 }),
      body: font("Texto", { family: "Inter", weight: 300 }),
      label: font("Etiquetas", { family: "Inter", weight: 500 }),
    })
    .prefault({})
    .meta({ title: "Tipografías" }),
  radius: z
    .object({
      card: range("Radio de tarjetas", { min: 0, max: 40, step: 1 }, 16),
      callout: range("Radio de cajas destacadas", { min: 0, max: 40, step: 1 }, 20),
    })
    .prefault({})
    .meta({ title: "Esquinas" }),
  header: z
    .object({
      left: text("Etiqueta izquierda", 40),
      right: text("Etiqueta derecha", 40),
    })
    .prefault({})
    .meta({ title: "Encabezado" }),
  footer: z
    .object({ tagline: lines("Tagline", 2, 32) })
    .prefault({})
    .meta({ title: "Pie" }),
  /** Built in code; when both parts are empty, the brand name is used. */
  wordmark: z
    .object({
      strong: text("Parte fuerte", 16),
      light: text("Parte liviana", 16),
      dot: toggle("Punto de acento", true),
    })
    .prefault({})
    .meta({ title: "Wordmark" }),
  /** Replaces the wordmark when set. */
  logoAsset: asset("Logo", "logo"),
});

export type BoldTokens = z.infer<typeof boldTokensSchema>;

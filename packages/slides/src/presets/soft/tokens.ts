import { z } from "zod";
import { asset, color, font, range, text } from "../fields";

// Tokens of the `soft` preset (docs/DESIGN-SYSTEM.md §8). Defaults are neutral on purpose:
// brand values live in the database (CLAUDE.md, rule 6).

export const GLOW_POSITIONS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "center",
] as const;

export const softTokensSchema = z.object({
  colors: z
    .object({
      bg: color("Fondo", "#0B0B10"),
      surface: color("Tarjetas", "#16161D"),
      elevated: color("Cajas destacadas", "#1C1C25"),
      line: color("Bordes y divisores", "#2C2C38"),
      text: color("Títulos", "#EDEDF2"),
      secondary: color("Texto de apoyo", "#C4C4CF"),
      muted: color("Etiquetas y fuentes", "#8B8B99"),
      accent: color("Acento", "#7DD3FC"),
      wordmark: color("Wordmark", "#E5E7EB"),
      accent2: color("Segundo acento", "#FCD34D"),
      positive: color("Dato positivo", "#22C55E"),
      negative: color("Dato negativo", "#EF4444"),
    })
    .prefault({})
    .meta({ title: "Colores" }),
  glass: z
    .object({
      background: color("Fondo del vidrio", "rgba(22,22,29,0.68)"),
      border: color("Borde", "rgba(255,255,255,0.08)"),
      borderTop: color("Borde superior", "rgba(255,255,255,0.14)"),
    })
    .prefault({})
    .meta({ title: "Paneles de vidrio" }),
  glows: z
    .array(
      z.object({
        position: z.enum(GLOW_POSITIONS),
        color: color("Color", "rgba(125,211,252,0.08)"),
      }),
    )
    .max(3, { error: "Máximo 3 glows." })
    .default([{ position: "top-left", color: "rgba(125,211,252,0.08)" }])
    .meta({ title: "Glows del fondo" }),
  fonts: z
    .object({
      display: font("Títulos", { family: "Hanken Grotesk", weight: 600 }),
      body: font("Texto", { family: "Geist Sans", weight: 400 }),
      numeric: font("Cifras", { family: "Geist Mono", weight: 500 }),
    })
    .prefault({})
    .meta({ title: "Tipografías" }),
  radius: z
    .object({
      card: range("Radio de tarjetas", { min: 0, max: 40, step: 1 }, 12),
      panel: range("Radio de paneles", { min: 0, max: 40, step: 1 }, 16),
    })
    .prefault({})
    .meta({ title: "Esquinas" }),
  /** When the text is empty, the brand name is used. */
  wordmark: z
    .object({
      text: text("Texto", 24),
      tracking: range("Espaciado entre letras (em)", { min: 0, max: 0.4, step: 0.01 }, 0.18),
    })
    .prefault({})
    .meta({ title: "Wordmark" }),
  footer: z
    .object({ url: text("Dirección web", 40) })
    .prefault({})
    .meta({ title: "Pie" }),
  /** Main visual on `cover` and `cta`. */
  heroAsset: asset("Elemento protagonista", "hero"),
  logoAsset: asset("Logo", "logo"),
});

export type SoftTokens = z.infer<typeof softTokensSchema>;

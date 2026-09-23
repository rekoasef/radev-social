import type { NewBrand } from "../schema";

/**
 * Initial brands. Values come from docs/DESIGN-SYSTEM.md §7 (RAdev, preset "bold") and
 * §8 (Lumus, preset "soft"). After seeding, the database is the source of truth.
 */
export const seedBrands: NewBrand[] = [
  {
    slug: "radev",
    name: "RAdev",
    codePrefix: "RA",
    stylePreset: "bold",
    timezone: "America/Argentina/Buenos_Aires",
    postsPerDayTarget: 1,
    themeTokens: {
      colors: {
        bg: "#0B0B0B",
        surface: "#121212",
        accent: "#FF7A00",
        text: "#FFFFFF",
        muted: "#A1A1AA",
        line: "#27272A",
      },
      glow: { intensity: 0.35 },
      fonts: {
        display: { family: "Inter Tight", weight: 900 },
        body: { family: "Inter", weight: 300 },
        label: { family: "Inter", weight: 500 },
      },
      radius: { card: 16, callout: 20 },
      header: { left: "PROCESOS DE HOY", right: "RESULTADOS DE MAÑANA" },
      footer: { tagline: ["AUTOMATIZACIÓN", "IDEAS EN RESULTADOS"] },
      wordmark: { strong: "RA", light: "dev", dot: true },
      logoAsset: null,
    },
  },
  {
    slug: "lumus",
    name: "Lumus",
    codePrefix: "LU",
    stylePreset: "soft",
    timezone: "America/Argentina/Buenos_Aires",
    postsPerDayTarget: 1,
    themeTokens: {
      colors: {
        bg: "#0B0B12",
        surface: "#171620",
        elevated: "#1D1B28",
        line: "#2E2B3D",
        text: "#F0EDF7",
        secondary: "#C8C4D7",
        muted: "#8F8B9E",
        accent: "#BDB4FF",
        wordmark: "#E4DFFF",
        accent2: "#FFB86E",
        positive: "#22C55E",
        negative: "#EF4444",
      },
      glass: {
        background: "rgba(24,23,34,0.68)",
        border: "rgba(255,255,255,0.08)",
        borderTop: "rgba(255,255,255,0.14)",
      },
      glows: [
        { position: "top-left", color: "rgba(189,180,255,0.08)" },
        { position: "top-right", color: "rgba(255,184,110,0.045)" },
      ],
      fonts: {
        display: { family: "Hanken Grotesk", weight: 600 },
        body: { family: "Geist Sans", weight: 400 },
        numeric: { family: "Geist Mono", weight: 500 },
      },
      radius: { card: 12, panel: 16 },
      wordmark: { text: "LUMUS", tracking: 0.18 },
      footer: { url: "gestorlumus.site" },
      // Ids in brand_assets. The seed links lumus-orb.png and logoLumus.png once that table
      // exists (phase 1, T7).
      heroAsset: null,
      logoAsset: null,
    },
  },
];

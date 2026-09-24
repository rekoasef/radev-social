import type { AssetRole } from "@radev/core";
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
      // Ids in brand_assets: the seed links them (seedBrandAssets).
      heroAsset: null,
      logoAsset: null,
    },
  },
];

export type SeedAsset = {
  /** File in seeds/brands/<slug>/assets/. */
  file: string;
  role: AssetRole;
  /** Top-level theme token that points to it. */
  token: string;
};

/** Files the seed uploads for each brand and links in its tokens. */
export const seedBrandAssets: Record<string, SeedAsset[]> = {
  lumus: [
    { file: "lumus-orb.png", role: "hero", token: "heroAsset" },
    { file: "logoLumus.png", role: "logo", token: "logoAsset" },
  ],
};

/**
 * Seed assets still to link. Never touches what the operator set up: a token that already
 * points somewhere, or a role the brand already has a file for, is left alone. Running the
 * seed again adds nothing.
 */
export function pendingSeedAssets(
  planned: readonly SeedAsset[],
  tokens: Record<string, unknown>,
  existingRoles: readonly AssetRole[],
): SeedAsset[] {
  return planned.filter(
    (asset) => tokens[asset.token] == null && !existingRoles.includes(asset.role),
  );
}

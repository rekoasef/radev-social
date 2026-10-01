import "server-only";
import { getBrandAsset, getBrandBySlug, listBrandAssets } from "@radev/db";
import { parseTheme, themeColors } from "@radev/slides";
import { mediaUrl } from "./brand-assets";
import { db } from "./db";

// What a brand's public links page needs from the database (phase 6 T5): the brand (active only),
// its colors from its theme and its logo. Nothing of the brand is in code (rule 6).

export type LinksPageBrand = {
  id: string;
  slug: string;
  name: string;
  whatsappNumber: string | null;
  whatsappMessageTemplate: string | null;
  colors: { bg: string; text: string; accent: string; muted: string };
  logoUrl: string | null;
};

const FALLBACK_COLORS = { bg: "#0c0e12", text: "#e8eaed", accent: "#e8eaed", muted: "#a3a9b4" };

export async function getLinksPageBrand(slug: string): Promise<LinksPageBrand | null> {
  const brand = await getBrandBySlug(db, slug);
  if (!brand || brand.archivedAt) return null;
  const theme = parseTheme(brand.stylePreset, brand.themeTokens);
  const tokens = brand.themeTokens as { logoAsset?: unknown };
  const logo =
    (typeof tokens.logoAsset === "string"
      ? await getBrandAsset(db, brand.id, tokens.logoAsset)
      : undefined) ?? (await listBrandAssets(db, brand.id)).find((asset) => asset.role === "logo");
  return {
    id: brand.id,
    slug: brand.slug,
    name: brand.name,
    whatsappNumber: brand.whatsappNumber,
    whatsappMessageTemplate: brand.whatsappMessageTemplate,
    colors: theme.ok ? themeColors(theme.theme) : FALLBACK_COLORS,
    logoUrl: logo ? mediaUrl(logo.path) : null,
  };
}

/** The message a post's WhatsApp opens with: the brand's template, or a plain one with the code. */
export const DEFAULT_WHATSAPP_MESSAGE = "¡Hola! Vengo por el post {code} de TikTok.";

/** Only the host of the site that sent the visitor ("www.tiktok.com"), never the full address. */
export function referrerHost(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).host.slice(0, 100) || null;
  } catch {
    return null;
  }
}

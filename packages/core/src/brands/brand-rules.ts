// Rules for creating, editing and deleting brands (docs/PRD.md RF-01, docs/ARCHITECTURE.md §4).
// Formats match the database checks in packages/db (brands_slug_format, brands_code_prefix_format).

/** Lowercase words joined by single hyphens: it goes in URLs and media folders. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MAX = 40;

/** 2 to 4 capitals: the prefix of public post codes (RA-0142). */
export const CODE_PREFIX_PATTERN = /^[A-Z]{2,4}$/;

/** Slugs taken by panel routes (/brands/new). */
export const RESERVED_SLUGS: readonly string[] = ["new"];

/** A slug from a brand name: "Café Ñandú 2" → "cafe-nandu-2". Empty when nothing is left. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export type RuleCheck = { ok: true } | { ok: false; reason: string };

/**
 * Deleting is only for brands without posts: a brand with history is archived instead, so its
 * posts and metrics survive.
 */
export function canDeleteBrand(postCount: number): RuleCheck {
  return postCount === 0
    ? { ok: true }
    : { ok: false, reason: "La marca tiene posts: archivala en lugar de borrarla." };
}

/** The code prefix is fixed once there are posts, so their public codes never change. */
export function canChangeCodePrefix(postCount: number): RuleCheck {
  return postCount === 0
    ? { ok: true }
    : { ok: false, reason: "El prefijo no se puede cambiar: ya hay posts con códigos públicos." };
}

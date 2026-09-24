// Values stored in the post tables (docs/ARCHITECTURE.md §5 and §10). The database checks them;
// the state machine (./state-machine.ts) decides which status can follow which.

export const POST_STATUSES = [
  "generating",
  "rendering",
  "in_review",
  "rejected",
  "approved",
  "scheduled",
  "publishing",
  "published",
  "publish_failed",
  "failed",
  "archived",
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/** Who wrote a version: the AI (phase 3) or the operator in the editor. */
export const VERSION_ORIGINS = ["ai", "manual"] as const;
export type VersionOrigin = (typeof VERSION_ORIGINS)[number];

/** Rendered formats (ADR 0011: only 4:5 in v1; the column allows more). */
export const RENDER_FORMATS = ["4x5"] as const;
export type RenderFormat = (typeof RENDER_FORMATS)[number];

export const NETWORKS = ["manual", "tiktok"] as const;
export type Network = (typeof NETWORKS)[number];

export const PUBLICATION_STATUSES = ["pending", "published", "failed"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

/** Public code of a post: brand prefix and a 4-digit number, e.g. RA-0142. */
export function publicCode(codePrefix: string, number: number): string {
  return `${codePrefix}-${String(number).padStart(4, "0")}`;
}

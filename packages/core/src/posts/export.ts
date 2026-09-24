import type { RuleCheck } from "../brands/brand-rules";
import type { PostStatus } from "./constants";
import { checkRenderedSlides } from "./review";

// Downloading a carousel to publish it by hand (docs/PRD.md RF-29). Only approved posts, or
// later: nothing gets published without going through `approved` (CLAUDE.md, rule 3).

export const EXPORTABLE_STATUSES = [
  "approved",
  "scheduled",
  "publishing",
  "published",
  "publish_failed",
] as const satisfies readonly PostStatus[];

export function canExport(input: {
  status: PostStatus;
  slideCount: number;
  renderedSlides: readonly number[];
}): RuleCheck {
  if (!(EXPORTABLE_STATUSES as readonly PostStatus[]).includes(input.status))
    return { ok: false, reason: "Solo se descargan posts aprobados." };
  return checkRenderedSlides(input.slideCount, input.renderedSlides);
}

/** Name of each PNG in the ZIP, in slide order: `LU-0001-1.png`. */
export function exportImageName(publicCode: string, slideIndex: number): string {
  return `${publicCode}-${slideIndex + 1}.png`;
}

export type PostCopy = { hook: string; caption: string; hashtags: readonly string[] };

/** TikTok's description field: the caption, then the hashtags on their own line. */
export function postDescription({ caption, hashtags }: PostCopy): string {
  const tags = hashtags.map((tag) => `#${tag}`).join(" ");
  return tags ? `${caption}\n\n${tags}` : caption;
}

/** The text file in the ZIP: title and description, each under its label. */
export function exportText(copy: PostCopy): string {
  return `Título\n${copy.hook}\n\nDescripción\n${postDescription(copy)}\n`;
}

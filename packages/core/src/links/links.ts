// A brand's links page and its leads (phase 6 T5, RF-40 to RF-42). TikTok allows one link, in the
// profile: the page it points to asks the visitor which post brought them, so every click and
// every WhatsApp message carries that post's reference. Pure: the web records, this decides.

/** What a visit to the links page did: saw it, opened WhatsApp or followed a link. */
export const LINK_EVENT_KINDS = ["view", "whatsapp", "link"] as const;
export type LinkEventKind = (typeof LINK_EVENT_KINDS)[number];

export const LEAD_STATUSES = ["new", "talking", "client", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nuevo",
  talking: "En charla",
  client: "Cliente",
  lost: "Perdido",
};

export function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === "string" && (LEAD_STATUSES as readonly string[]).includes(value);
}

export const LEAD_CHANNELS = ["whatsapp", "tiktok", "instagram", "other"] as const;
export type LeadChannel = (typeof LEAD_CHANNELS)[number];

export const LEAD_CHANNEL_LABELS: Record<LeadChannel, string> = {
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  instagram: "Instagram",
  other: "Otro",
};

/** Posts the links page offers to pick from, newest first. */
export const LINKS_PAGE_POSTS = 12;

export const LINK_TITLE_MAX = 60;
export const LINKS_PER_BRAND = 8;

/**
 * How a post is named in messages and leads: its public code (RA-0142) when it came out of the
 * system, or TK- and the end of TikTok's id for the rest of the account (still traceable).
 */
export function postRef(post: { code: string | null; externalId: string }): string {
  return post.code ?? `TK-${post.externalId.slice(-6)}`;
}

/** "ra-0142 " → "RA-0142"; the operator types what the message said. Null when empty. */
export function normalizePostRef(input: string): string | null {
  const ref = input.trim().toUpperCase().replace(/\s+/g, "");
  return ref === "" ? null : ref;
}

/** Clicks per view, 0–1; null without views. */
export function clickRate(views: number, clicks: number): number | null {
  return views > 0 ? clicks / views : null;
}

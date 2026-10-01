// A brand's leads (phase 6 T5, RF-42): the people who wrote, typed by the operator with the post
// that brought them, so the metrics can say which content brings clients. The links page that
// counted clicks was dropped (ADR 0022): the profile links straight to the brand's site.

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

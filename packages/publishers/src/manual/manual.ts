import type { PublisherAdapter, PublishResult } from "../types";

// `manual`: the operator downloads the carousel, posts it by hand and then says so in the panel.
// Publishing only leaves it waiting; confirming is what makes it published. (The Telegram
// reminder at the scheduled time is phase 4.)

export const manualPublisher: PublisherAdapter = {
  network: "manual",
  async publish({ publicCode }) {
    return {
      status: "pending",
      note: `Descargá ${publicCode}, publicalo a mano y marcalo como publicado.`,
    };
  },
};

const MAX_URL_LENGTH = 500;

/**
 * The operator's confirmation. The link to the published post is optional; if given it must be
 * an http(s) address.
 */
export function confirmManualPublication(input: { url?: string | null; now: Date }): PublishResult {
  const text = input.url?.trim() ?? "";
  if (!text) return { status: "published", url: null, publishedAt: input.now };
  if (text.length > MAX_URL_LENGTH)
    return { status: "failed", error: "El link es demasiado largo." };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { status: "failed", error: "Ese link no es válido." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    return { status: "failed", error: "El link tiene que empezar con https://." };
  return { status: "published", url: url.toString(), publishedAt: input.now };
}

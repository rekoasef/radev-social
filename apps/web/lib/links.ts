import "server-only";

// Links of a brand's links page (phase 6 T5). Apart from packages/core, which has no URL: it
// runs without any environment's types.

export type UrlCheck = { ok: true; url: string } | { ok: false; reason: string };

/** A link of the page: https only (it opens from TikTok's browser), up to 500 characters. */
export function normalizeLinkUrl(input: string): UrlCheck {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, reason: "No es un link válido." };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "Tiene que empezar con https://." };
  if (!url.hostname.includes("."))
    return { ok: false, reason: "Falta el dominio (ej. radev.com.ar)." };
  const text = url.toString();
  if (text.length > 500) return { ok: false, reason: "El link es demasiado largo." };
  return { ok: true, url: text };
}

/** The main link with the post's reference, for sites that read it (e.g. `?ref=LU-0004`). */
export function withRef(url: string, ref: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("ref", ref);
  return parsed.toString();
}

import "server-only";
import type { TikTokClient } from "@radev/publishers";
import { requireEnv } from "./env";

// Connecting a brand's TikTok account (phase 5 T4). The app's keys (sandbox first, production after
// the review) live in the .env; without them the panel says so instead of failing.

export function tiktokClient(): TikTokClient | undefined {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  return clientKey && clientSecret ? { clientKey, clientSecret } : undefined;
}

/** Must match the Redirect URI registered in the TikTok app exactly. */
export function tiktokRedirectUri(): string {
  return new URL("/api/tiktok/callback", requireEnv("BETTER_AUTH_URL")).toString();
}

/** Short-lived cookie that ties TikTok's callback to the click that started it (CSRF). */
export const TIKTOK_OAUTH_COOKIE = "tiktok_oauth";
export const TIKTOK_OAUTH_MAX_AGE = 10 * 60;

/** Outcome shown on Marcas → Canales after coming back from TikTok (`?tiktok=`). */
export const TIKTOK_OUTCOMES = {
  connected: "Cuenta de TikTok conectada.",
  denied: "Cancelaste la conexión en TikTok: no se guardó nada.",
  expired: "El pedido venció o no corresponde a este navegador. Probá conectar de nuevo.",
  failed: "TikTok no confirmó la conexión. Probá de nuevo en un rato.",
  other_brand: "Esa cuenta de TikTok ya está conectada a otra marca.",
  not_configured: "Faltan TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET en el .env.",
} as const;

export type TiktokOutcome = keyof typeof TIKTOK_OUTCOMES;

export const isTiktokOutcome = (value: unknown): value is TiktokOutcome =>
  typeof value === "string" && Object.hasOwn(TIKTOK_OUTCOMES, value);

export const channelsPath = (brandSlug: string) => `/brands/${brandSlug}/channels`;

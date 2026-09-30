import type { SocialTokens } from "@radev/db";
import { type refreshTiktokToken, type TikTokClient, TikTokError } from "@radev/publishers";

// Renewing a TikTok account's tokens (phase 5 T6 and T8). Used inside renewSocialAccountTokens,
// which holds the account's row meanwhile.

/** Access tokens this close to expiring are renewed before use. */
export const REFRESH_MARGIN_MS = 10 * 60_000;

export const expiresSoon = (tokens: SocialTokens, now: Date, marginMs = REFRESH_MARGIN_MS) =>
  tokens.accessExpiresAt.getTime() - now.getTime() < marginMs;

/** New tokens from the refresh token. TikTok may hand a new refresh token too: that one is kept. */
export function tiktokRenewer(
  client: TikTokClient,
  refresh: typeof refreshTiktokToken,
  now: () => Date,
): (refreshToken: string | null) => Promise<SocialTokens> {
  return async (refreshToken) => {
    if (!refreshToken)
      throw new TikTokError("La cuenta no tiene refresh token.", "invalid_grant", null);
    const fresh = await refresh(client, refreshToken, { now: now() });
    return {
      accessToken: fresh.accessToken,
      accessExpiresAt: fresh.accessExpiresAt,
      refreshToken: fresh.refreshToken,
      refreshExpiresAt: fresh.refreshExpiresAt,
    };
  };
}

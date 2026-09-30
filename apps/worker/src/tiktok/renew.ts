import { type Database, renewSocialAccountTokens, type SocialTokens } from "@radev/db";
import { type refreshTiktokToken, type TikTokClient, TikTokError } from "@radev/publishers";

// Renewing a TikTok account's tokens (phase 5 T6 and T8, phase 6 metrics). Used inside
// renewSocialAccountTokens, which holds the account's row meanwhile.

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

/** The access token, renewed when close to expiring, or once when TikTok rejects it. */
export class TokenSource {
  private current: SocialTokens | undefined;
  private readonly renew: (refreshToken: string | null) => Promise<SocialTokens>;

  constructor(
    private readonly db: Database,
    client: TikTokClient,
    private readonly accountId: string,
    refresh: typeof refreshTiktokToken,
    private readonly now: () => Date,
  ) {
    this.renew = tiktokRenewer(client, refresh, now);
  }

  async use<T>(call: (accessToken: string) => Promise<T>): Promise<T> {
    const tokens = await this.get();
    try {
      return await call(tokens.accessToken);
    } catch (error) {
      if (!(error instanceof TikTokError) || error.code !== "access_token_invalid") throw error;
      // Renewed unless someone else already did (then the stored token is a different one).
      return call((await this.get(tokens.accessToken)).accessToken);
    }
  }

  private async get(rejected?: string): Promise<SocialTokens> {
    if (this.current && rejected === undefined && !expiresSoon(this.current, this.now())) {
      return this.current;
    }
    const { tokens } = await renewSocialAccountTokens(
      this.db,
      this.accountId,
      (stored) => stored.accessToken === rejected || expiresSoon(stored, this.now()),
      this.renew,
    );
    this.current = tokens;
    return tokens;
  }
}

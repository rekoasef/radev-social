import { type Notice, tiktokExpiringNotice, tiktokReauthNotice } from "@radev/core";
import {
  type Database,
  getBrandById,
  listActiveSocialAccounts,
  markSocialAccountReauth,
  renewSocialAccountTokens,
} from "@radev/db";
import {
  isTiktokAuthError,
  refreshTiktokToken,
  type TikTokClient,
  TikTokError,
} from "@radev/publishers";
import type { Logger } from "../logger";
import { tiktokRenewer } from "../tiktok/renew";

// tokens.refresh (phase 5 T8, docs/ARCHITECTURE.md §6): once a day, renews the tokens of every
// connected account. An account that goes weeks without posting keeps working, and one whose
// access was revoked is found (and the operator told) before its next post, not at it.
// Idempotent: renewing twice only gives newer tokens.

/** TikTok's permission (the refresh token) lasts a year: warn this long before it ends. */
const EXPIRY_WARNING_MS = 14 * 24 * 3_600_000;

export type TokensRefreshDeps = {
  db: Database;
  log: Logger;
  /** Null without TIKTOK_CLIENT_KEY/SECRET: nothing to renew with. */
  client: TikTokClient | null;
  notify?: (notice: Notice, options: { urgent: boolean }) => Promise<void>;
  appUrl?: string;
  refresh?: typeof refreshTiktokToken;
  now?: () => Date;
};

export type TokensRefreshOutcome = { renewed: number; reauth: number; failed: number };

export async function refreshTokens(deps: TokensRefreshDeps): Promise<TokensRefreshOutcome> {
  const { db, log } = deps;
  const now = deps.now ?? (() => new Date());
  const outcome: TokensRefreshOutcome = { renewed: 0, reauth: 0, failed: 0 };
  if (!deps.client) {
    log.warn("tokens refresh skipped: tiktok not configured");
    return outcome;
  }
  const renew = tiktokRenewer(deps.client, deps.refresh ?? refreshTiktokToken, now);

  for (const account of await listActiveSocialAccounts(db)) {
    const brand = await getBrandById(db, account.brandId);
    if (!brand) continue;
    try {
      const { tokens } = await renewSocialAccountTokens(db, account.id, () => true, renew);
      outcome.renewed++;
      if (
        tokens.refreshExpiresAt &&
        tokens.refreshExpiresAt.getTime() - now().getTime() < EXPIRY_WARNING_MS
      ) {
        await deps.notify?.(
          tiktokExpiringNotice(
            {
              id: account.id,
              brandName: brand.name,
              brandSlug: brand.slug,
              expiresAt: tokens.refreshExpiresAt,
              timeZone: brand.timezone,
            },
            deps.appUrl ?? "",
          ),
          { urgent: false },
        );
      }
    } catch (error) {
      if (isTiktokAuthError(error)) {
        const reason = (error as TikTokError).code ?? "auth";
        await markSocialAccountReauth(db, account.id, reason);
        outcome.reauth++;
        log.warn("tiktok account needs reconnecting", { brand: brand.slug, reason });
        await deps.notify?.(
          tiktokReauthNotice(
            {
              id: account.id,
              brandName: brand.name,
              brandSlug: brand.slug,
              reason,
              day: now().toISOString().slice(0, 10),
            },
            deps.appUrl ?? "",
          ),
          { urgent: false },
        );
      } else {
        // TikTok down or its rate limit: the other accounts go on; the job retries at the end.
        outcome.failed++;
        log.error("tiktok tokens not renewed", {
          brand: brand.slug,
          code: error instanceof TikTokError ? error.code : null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  log.info("tokens refresh finished", outcome);
  if (outcome.failed > 0) {
    throw new Error(`No se renovaron los permisos de ${outcome.failed} cuenta(s); se reintenta.`);
  }
  return outcome;
}

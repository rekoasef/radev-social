import type { SocialNetwork } from "@radev/core";
import { and, asc, eq } from "drizzle-orm";
import { type SocialAccountRow, socialAccounts } from "../schema";
import { decryptToken, encryptToken } from "../token-crypto";
import type { Executor } from "./brand-assets";

// Connected network accounts (docs/ARCHITECTURE.md §10). The only place that touches their tokens:
// they are encrypted here before saving and decrypted here when the worker needs them. Everything
// else gets a SocialAccount, which has no tokens.

/** An account without its tokens: safe to show in the panel or log. */
export type SocialAccount = Omit<SocialAccountRow, "accessTokenEnc" | "refreshTokenEnc">;

export type SocialTokens = {
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string | null;
  refreshExpiresAt: Date | null;
};

const publicColumns = {
  id: socialAccounts.id,
  brandId: socialAccounts.brandId,
  network: socialAccounts.network,
  externalId: socialAccounts.externalId,
  handle: socialAccounts.handle,
  displayName: socialAccounts.displayName,
  scopes: socialAccounts.scopes,
  accessExpiresAt: socialAccounts.accessExpiresAt,
  refreshExpiresAt: socialAccounts.refreshExpiresAt,
  status: socialAccounts.status,
  lastError: socialAccounts.lastError,
  createdAt: socialAccounts.createdAt,
  updatedAt: socialAccounts.updatedAt,
};

/** Tokens are bound to their network, account and kind: one can't be swapped for another. */
const tokenContext = (network: string, externalId: string, kind: "access" | "refresh") =>
  `social_accounts:${network}:${externalId}:${kind}`;

function encryptTokens(network: string, externalId: string, tokens: SocialTokens) {
  return {
    accessTokenEnc: encryptToken(tokens.accessToken, tokenContext(network, externalId, "access")),
    accessExpiresAt: tokens.accessExpiresAt,
    refreshTokenEnc:
      tokens.refreshToken === null
        ? null
        : encryptToken(tokens.refreshToken, tokenContext(network, externalId, "refresh")),
    refreshExpiresAt: tokens.refreshExpiresAt,
  };
}

export function listSocialAccounts(db: Executor, brandId: string): Promise<SocialAccount[]> {
  return db
    .select(publicColumns)
    .from(socialAccounts)
    .where(eq(socialAccounts.brandId, brandId))
    .orderBy(asc(socialAccounts.network));
}

export async function getSocialAccount(
  db: Executor,
  brandId: string,
  network: SocialNetwork,
): Promise<SocialAccount | undefined> {
  const [row] = await db
    .select(publicColumns)
    .from(socialAccounts)
    .where(and(eq(socialAccounts.brandId, brandId), eq(socialAccounts.network, network)));
  return row;
}

export type SaveSocialAccountResult =
  | { ok: true; account: SocialAccount }
  /** That network account is already connected to another brand. */
  | { ok: false; reason: "other_brand"; brandId: string };

/**
 * Connects (or reconnects) the brand's account on a network, after OAuth. Replaces the one it had
 * on that network; reconnecting the same account leaves it `active` with the new tokens.
 */
export async function saveSocialAccount(
  db: Executor,
  input: {
    brandId: string;
    network: SocialNetwork;
    externalId: string;
    handle: string | null;
    displayName: string | null;
    scopes: readonly string[];
    tokens: SocialTokens;
  },
): Promise<SaveSocialAccountResult> {
  const [taken] = await db
    .select({ brandId: socialAccounts.brandId })
    .from(socialAccounts)
    .where(
      and(
        eq(socialAccounts.network, input.network),
        eq(socialAccounts.externalId, input.externalId),
      ),
    );
  if (taken && taken.brandId !== input.brandId) {
    return { ok: false, reason: "other_brand", brandId: taken.brandId };
  }
  const values = {
    externalId: input.externalId,
    handle: input.handle,
    displayName: input.displayName,
    scopes: [...input.scopes],
    ...encryptTokens(input.network, input.externalId, input.tokens),
    status: "active" as const,
    lastError: null,
  };
  const [account] = await db
    .insert(socialAccounts)
    .values({ brandId: input.brandId, network: input.network, ...values })
    .onConflictDoUpdate({ target: [socialAccounts.brandId, socialAccounts.network], set: values })
    .returning(publicColumns);
  if (!account) throw new Error("No se pudo guardar la cuenta.");
  return { ok: true, account };
}

/** The account's tokens in clear, for the worker to call the network. Never log them. */
export async function getSocialAccountTokens(
  db: Executor,
  accountId: string,
): Promise<{ account: SocialAccount; tokens: SocialTokens } | undefined> {
  const [row] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, accountId));
  if (!row) return undefined;
  const { accessTokenEnc, refreshTokenEnc, ...account } = row;
  return {
    account,
    tokens: {
      accessToken: decryptToken(
        accessTokenEnc,
        tokenContext(row.network, row.externalId, "access"),
      ),
      accessExpiresAt: row.accessExpiresAt,
      refreshToken:
        refreshTokenEnc === null
          ? null
          : decryptToken(refreshTokenEnc, tokenContext(row.network, row.externalId, "refresh")),
      refreshExpiresAt: row.refreshExpiresAt,
    },
  };
}

/** New tokens after a refresh: the account is `active` again. */
export async function updateSocialAccountTokens(
  db: Executor,
  accountId: string,
  tokens: SocialTokens,
): Promise<void> {
  const [row] = await db
    .select({ network: socialAccounts.network, externalId: socialAccounts.externalId })
    .from(socialAccounts)
    .where(eq(socialAccounts.id, accountId));
  if (!row) throw new Error("La cuenta ya no existe.");
  await db
    .update(socialAccounts)
    .set({
      ...encryptTokens(row.network, row.externalId, tokens),
      status: "active",
      lastError: null,
    })
    .where(eq(socialAccounts.id, accountId));
}

/** The network rejected its tokens: the operator has to connect it again. */
export async function markSocialAccountReauth(
  db: Executor,
  accountId: string,
  error: string,
): Promise<void> {
  await db
    .update(socialAccounts)
    .set({ status: "reauth_required", lastError: error })
    .where(eq(socialAccounts.id, accountId));
}

/** Disconnects: the row and its tokens are deleted (docs: Privacidad). Returns whether it existed. */
export async function deleteSocialAccount(
  db: Executor,
  input: { brandId: string; accountId: string },
): Promise<boolean> {
  const deleted = await db
    .delete(socialAccounts)
    .where(and(eq(socialAccounts.id, input.accountId), eq(socialAccounts.brandId, input.brandId)))
    .returning({ id: socialAccounts.id });
  return deleted.length > 0;
}

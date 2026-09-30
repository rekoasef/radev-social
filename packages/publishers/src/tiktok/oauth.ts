import { z } from "zod";

// TikTok Login Kit for web (developers.tiktok.com/doc/login-kit-web) and user access tokens
// (/doc/oauth-user-access-token-management). Checked against the docs on 2026-09-30.
// Nothing here logs or returns a token inside an error message.

const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const REVOKE_URL = "https://open.tiktokapis.com/v2/oauth/revoke/";
const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";

/**
 * What the app asks for (the ones registered in the TikTok app, phase 5 T2). The operator can
 * untick some on TikTok's screen: the granted ones come back in the token response.
 */
export const TIKTOK_SCOPES = [
  "user.info.basic",
  "video.upload",
  "video.publish",
  "video.list",
  "user.info.stats",
] as const;

/** Without these the account can't publish (draft needs upload; direct post needs publish). */
export const TIKTOK_PUBLISH_SCOPES = ["video.upload", "video.publish"] as const;

export type TikTokClient = { clientKey: string; clientSecret: string };

type Fetch = typeof fetch;

export class TikTokError extends Error {
  constructor(
    message: string,
    /** TikTok's error code (e.g. "invalid_grant"), when it sent one. */
    readonly code: string | null,
    readonly logId: string | null,
  ) {
    super(message);
    this.name = "TikTokError";
  }
}

export function tiktokAuthorizeUrl(input: {
  clientKey: string;
  redirectUri: string;
  state: string;
  scopes?: readonly string[];
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_key", input.clientKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", (input.scopes ?? TIKTOK_SCOPES).join(","));
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  return url.toString();
}

const tokenResponse = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  open_id: z.string().min(1),
  refresh_token: z.string().min(1),
  refresh_expires_in: z.number().int().positive(),
  scope: z.string(),
});

const oauthError = z.object({
  error: z.string(),
  error_description: z.string().optional(),
  log_id: z.string().optional(),
});

export type TikTokTokens = {
  openId: string;
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  refreshExpiresAt: Date;
  scopes: string[];
};

/** "a,b, c" → ["a", "b", "c"] */
export function parseScopes(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((scope) => scope.trim())
        .filter(Boolean),
    ),
  ];
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new TikTokError(
      `TikTok respondió algo que no es JSON (HTTP ${response.status}).`,
      null,
      null,
    );
  }
}

async function tokenRequest(
  params: Record<string, string>,
  now: Date,
  fetchImpl: Fetch,
): Promise<TikTokTokens> {
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams(params),
  });
  const body = await readJson(response);
  const failed = oauthError.safeParse(body);
  if (failed.success && failed.data.error) {
    throw new TikTokError(
      `TikTok rechazó el pedido de tokens: ${failed.data.error_description || failed.data.error}`,
      failed.data.error,
      failed.data.log_id ?? null,
    );
  }
  const parsed = tokenResponse.safeParse(body);
  if (!response.ok || !parsed.success) {
    throw new TikTokError(
      `TikTok respondió tokens con un formato inesperado (HTTP ${response.status}).`,
      null,
      null,
    );
  }
  const data = parsed.data;
  return {
    openId: data.open_id,
    accessToken: data.access_token,
    accessExpiresAt: new Date(now.getTime() + data.expires_in * 1000),
    refreshToken: data.refresh_token,
    refreshExpiresAt: new Date(now.getTime() + data.refresh_expires_in * 1000),
    scopes: parseScopes(data.scope),
  };
}

/** Trades the `code` of the callback for the account's tokens. */
export function exchangeTiktokCode(
  client: TikTokClient,
  input: { code: string; redirectUri: string },
  { now = new Date(), fetchImpl = fetch }: { now?: Date; fetchImpl?: Fetch } = {},
): Promise<TikTokTokens> {
  return tokenRequest(
    {
      client_key: client.clientKey,
      client_secret: client.clientSecret,
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
    },
    now,
    fetchImpl,
  );
}

/** New tokens from the refresh token. TikTok may return a new refresh token: keep that one. */
export function refreshTiktokToken(
  client: TikTokClient,
  refreshToken: string,
  { now = new Date(), fetchImpl = fetch }: { now?: Date; fetchImpl?: Fetch } = {},
): Promise<TikTokTokens> {
  return tokenRequest(
    {
      client_key: client.clientKey,
      client_secret: client.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
    now,
    fetchImpl,
  );
}

/** Revokes the app's access to the account (disconnecting). */
export async function revokeTiktokToken(
  client: TikTokClient,
  accessToken: string,
  { fetchImpl = fetch }: { fetchImpl?: Fetch } = {},
): Promise<void> {
  const response = await fetchImpl(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: client.clientKey,
      client_secret: client.clientSecret,
      token: accessToken,
    }),
  });
  const body = await readJson(response);
  const failed = oauthError.safeParse(body);
  if (failed.success && failed.data.error) {
    throw new TikTokError(
      `TikTok no revocó el acceso: ${failed.data.error_description || failed.data.error}`,
      failed.data.error,
      failed.data.log_id ?? null,
    );
  }
  if (!response.ok)
    throw new TikTokError(`TikTok no revocó el acceso (HTTP ${response.status}).`, null, null);
}

const userInfoResponse = z.object({
  data: z
    .object({
      user: z
        .object({ open_id: z.string().optional(), display_name: z.string().optional() })
        .optional(),
    })
    .optional(),
  error: z
    .object({ code: z.string(), message: z.string().optional(), log_id: z.string().optional() })
    .optional(),
});

export type TikTokUser = { openId: string | null; displayName: string | null };

/**
 * Name of the connected account, to show which one it is. `username` needs `user.info.profile`,
 * which the app doesn't ask for: the display name is enough.
 */
export async function fetchTiktokUser(
  accessToken: string,
  { fetchImpl = fetch }: { fetchImpl?: Fetch } = {},
): Promise<TikTokUser> {
  const url = new URL(USER_INFO_URL);
  url.searchParams.set("fields", "open_id,display_name");
  const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const parsed = userInfoResponse.safeParse(await readJson(response));
  if (!parsed.success) {
    throw new TikTokError(
      `TikTok respondió el perfil con un formato inesperado (HTTP ${response.status}).`,
      null,
      null,
    );
  }
  const { data, error } = parsed.data;
  if (error && error.code !== "ok") {
    throw new TikTokError(
      `TikTok no dio el perfil: ${error.message || error.code}`,
      error.code,
      error.log_id ?? null,
    );
  }
  return { openId: data?.user?.open_id ?? null, displayName: data?.user?.display_name || null };
}

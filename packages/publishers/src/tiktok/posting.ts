import { z } from "zod";
import { TikTokError } from "./oauth";

// Content Posting API, photo mode (developers.tiktok.com/doc/content-posting-api-reference-photo-post
// and /doc/content-posting-api-reference-get-video-status). Checked against the docs on 2026-09-30:
// JPEG or WebP pulled from a verified domain (PULL_FROM_URL, no redirects), up to 35 photos, title
// ≤ 90 and description ≤ 4000 UTF-16 units, 6 inits per minute per token, 30 status fetches.

const INIT_URL = "https://open.tiktokapis.com/v2/post/publish/content/init/";
const STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

export const TIKTOK_TITLE_MAX = 90;
export const TIKTOK_DESCRIPTION_MAX = 4000;
export const TIKTOK_MAX_PHOTOS = 35;

type Fetch = typeof fetch;

/** Cuts to `max` UTF-16 units without splitting a surrogate pair (an emoji). */
export function fitUtf16(text: string, max: number): string {
  if (text.length <= max) return text;
  let cut = max;
  const last = text.charCodeAt(cut - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut -= 1;
  return text.slice(0, cut).trimEnd();
}

/**
 * `MEDIA_UPLOAD`: a draft in the account's inbox, finished in the app (needs `video.upload`; the
 * only mode before TikTok's audit). `DIRECT_POST` arrives after the audit (phase 5 T10).
 */
export type TikTokPostMode = "MEDIA_UPLOAD";

const apiError = z.object({
  code: z.string(),
  message: z.string().optional(),
  log_id: z.string().optional(),
});

async function call(
  url: string,
  accessToken: string,
  body: unknown,
  fetchImpl: Fetch,
): Promise<{ status: number; data: unknown }> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new TikTokError(
      `TikTok respondió algo que no es JSON (HTTP ${response.status}).`,
      null,
      null,
    );
  }
  const error = z.object({ error: apiError }).safeParse(json);
  if (error.success && error.data.error.code !== "ok") {
    const { code, message, log_id } = error.data.error;
    throw new TikTokError(
      `TikTok: ${message || code} (HTTP ${response.status})`,
      code,
      log_id ?? null,
    );
  }
  if (!response.ok) {
    throw new TikTokError(`TikTok respondió HTTP ${response.status}.`, null, null);
  }
  return { status: response.status, data: json };
}

const initResponse = z.object({ data: z.object({ publish_id: z.string().min(1) }) });

/** Sends the photos (public URLs, in order). Returns TikTok's publish id to follow it. */
export async function initPhotoPost(
  accessToken: string,
  input: {
    photoUrls: readonly string[];
    title: string;
    description: string;
    mode: TikTokPostMode;
  },
  { fetchImpl = fetch }: { fetchImpl?: Fetch } = {},
): Promise<string> {
  if (input.photoUrls.length === 0) throw new Error("No hay fotos para mandar a TikTok.");
  if (input.photoUrls.length > TIKTOK_MAX_PHOTOS) {
    throw new Error(`TikTok acepta hasta ${TIKTOK_MAX_PHOTOS} fotos por post.`);
  }
  const { data } = await call(
    INIT_URL,
    accessToken,
    {
      media_type: "PHOTO",
      post_mode: input.mode,
      post_info: {
        title: fitUtf16(input.title, TIKTOK_TITLE_MAX),
        description: fitUtf16(input.description, TIKTOK_DESCRIPTION_MAX),
      },
      source_info: {
        source: "PULL_FROM_URL",
        photo_images: input.photoUrls,
        photo_cover_index: 0,
      },
    },
    fetchImpl,
  );
  const parsed = initResponse.safeParse(data);
  if (!parsed.success) {
    throw new TikTokError("TikTok no devolvió el id de la publicación.", null, null);
  }
  return parsed.data.data.publish_id;
}

const statusResponse = z.object({
  data: z.object({
    status: z.string(),
    fail_reason: z.string().optional(),
    publicaly_available_post_id: z.array(z.union([z.string(), z.number()])).optional(),
  }),
});

export type TikTokPostState =
  /** TikTok is still pulling or processing the photos: ask again later. */
  | { kind: "processing"; status: string }
  /** A draft in the account's inbox: the operator finishes it in the app. */
  | { kind: "inbox" }
  | { kind: "published"; postId: string | null }
  /** `retryable`: TikTok's own hiccup (`internal`); sending it again may work. */
  | { kind: "failed"; reason: string; retryable: boolean };

/** Where a post sent to TikTok is. */
export async function fetchPostState(
  accessToken: string,
  publishId: string,
  { fetchImpl = fetch }: { fetchImpl?: Fetch } = {},
): Promise<TikTokPostState> {
  const { data } = await call(STATUS_URL, accessToken, { publish_id: publishId }, fetchImpl);
  const parsed = statusResponse.safeParse(data);
  if (!parsed.success) {
    throw new TikTokError("TikTok respondió el estado con un formato inesperado.", null, null);
  }
  const { status, fail_reason, publicaly_available_post_id } = parsed.data.data;
  switch (status) {
    case "SEND_TO_USER_INBOX":
      return { kind: "inbox" };
    case "PUBLISH_COMPLETE": {
      const id = publicaly_available_post_id?.[0];
      return { kind: "published", postId: id === undefined ? null : String(id) };
    }
    case "FAILED": {
      const reason = fail_reason || "sin motivo";
      return { kind: "failed", reason, retryable: reason === "internal" };
    }
    default:
      return { kind: "processing", status };
  }
}

/**
 * TikTok no longer accepts the account's tokens: the operator has to connect it again. (Includes
 * a refresh token that expired or was revoked.) `access_token_invalid` right after a refresh
 * counts too: the worker refreshes once before giving up.
 */
export function isTiktokAuthError(error: unknown): boolean {
  return (
    error instanceof TikTokError &&
    error.code !== null &&
    [
      "access_token_invalid",
      "scope_not_authorized",
      "scope_permission_missed",
      "invalid_grant",
      "auth_removed",
    ].includes(error.code)
  );
}

/**
 * Failures that sending again won't fix (the operator has to look), as opposed to TikTok being
 * down (`internal_error`) or its rate limit (`rate_limit_exceeded`), which the job retries.
 */
export function isTiktokPermanentError(error: unknown): boolean {
  if (isTiktokAuthError(error)) return true;
  return (
    error instanceof TikTokError &&
    error.code !== null &&
    [
      "invalid_param",
      "invalid_params",
      "invalid_file_upload",
      "app_version_check_failed",
      "url_ownership_unverified",
      "spam_risk_too_many_posts",
      "spam_risk_too_many_pending_share",
      "spam_risk_user_banned_from_posting",
      "reached_active_user_cap",
      "unaudited_client_can_only_post_to_private_accounts",
      "privacy_level_option_mismatch",
    ].includes(error.code)
  );
}

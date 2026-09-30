import { z } from "zod";
import { TikTokError } from "./oauth";

// One call to TikTok's v2 API (posting and display): its `{ data, error }` envelope, with errors as
// TikTokError (TikTok's code and log id, never the token).

export type Fetch = typeof fetch;

const apiError = z.object({
  code: z.string(),
  message: z.string().optional(),
  log_id: z.string().optional(),
});

/**
 * POST with a JSON body, or GET without one. `text` is the raw answer: TikTok sends some ids as
 * JSON numbers too long for JavaScript (see postIdsFrom).
 */
export async function tiktokCall(
  url: string,
  accessToken: string,
  body: unknown,
  fetchImpl: Fetch,
): Promise<{ status: number; data: unknown; text: string }> {
  const response = await fetchImpl(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json; charset=UTF-8" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
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
  return { status: response.status, data: json, text };
}

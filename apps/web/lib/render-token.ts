import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Whether a request may see the internal /render pages. They skip the login (the worker and
 * the capture script have no session), so they require RENDER_TOKEN instead. Without the
 * variable they are closed.
 */
export function isValidRenderToken(token: string | string[] | null | undefined): boolean {
  const expected = process.env.RENDER_TOKEN;
  if (!expected || typeof token !== "string") return false;
  // Same-length digests: the comparison takes the same time whatever the input.
  return timingSafeEqual(digest(token), digest(expected));
}

/**
 * The token of a /render request: the `X-Render-Token` header (worker, capture script; keeps the
 * token out of URLs and server logs) or, for opening a page by hand, `?token=`.
 */
export async function renderTokenFrom(query: Record<string, string | string[] | undefined>) {
  return (await headers()).get("x-render-token") ?? query.token;
}

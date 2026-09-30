import { getBrandBySlug, saveSocialAccount } from "@radev/db";
import { exchangeTiktokCode, fetchTiktokUser, TikTokError } from "@radev/publishers";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";
import {
  channelsPath,
  TIKTOK_OAUTH_COOKIE,
  type TiktokOutcome,
  tiktokClient,
  tiktokRedirectUri,
} from "@/lib/tiktok";

// Where TikTok sends the operator back after authorizing (Login Kit, phase 5 T4). Registered in the
// TikTok app as https://app.gestorlumus.site/api/tiktok/callback. Never logs the code or tokens.

const pending = z.object({ state: z.string().min(16), slug: z.string().min(1).max(64) });

function back(request: NextRequest, path: string, outcome: TiktokOutcome) {
  const url = new URL(path, request.nextUrl.origin);
  url.searchParams.set("tiktok", outcome);
  const response = NextResponse.redirect(url);
  response.cookies.delete({ name: TIKTOK_OAUTH_COOKIE, path: "/api/tiktok" });
  return response;
}

export async function GET(request: NextRequest) {
  await requireOperator();
  const params = request.nextUrl.searchParams;

  const store = await cookies();
  let started: z.infer<typeof pending> | undefined;
  try {
    const parsed = pending.safeParse(JSON.parse(store.get(TIKTOK_OAUTH_COOKIE)?.value ?? "null"));
    if (parsed.success) started = parsed.data;
  } catch {
    // A tampered or broken cookie is the same as none.
  }
  if (!started || params.get("state") !== started.state) {
    return back(request, started ? channelsPath(started.slug) : "/brands", "expired");
  }
  const path = channelsPath(started.slug);

  if (params.get("error")) return back(request, path, "denied");
  const code = params.get("code");
  if (!code) return back(request, path, "failed");

  const client = tiktokClient();
  if (!client) return back(request, path, "not_configured");
  const brand = await getBrandBySlug(db, started.slug);
  if (!brand || brand.archivedAt !== null) return back(request, "/brands", "failed");

  try {
    const tokens = await exchangeTiktokCode(client, { code, redirectUri: tiktokRedirectUri() });
    // The name is only for showing: without it the account still connects.
    const user = await fetchTiktokUser(tokens.accessToken).catch(() => undefined);
    const saved = await saveSocialAccount(db, {
      brandId: brand.id,
      network: "tiktok",
      externalId: tokens.openId,
      handle: null,
      displayName: user?.displayName ?? null,
      scopes: tokens.scopes,
      tokens,
    });
    return back(request, path, saved.ok ? "connected" : "other_brand");
  } catch (error) {
    // Only TikTok's code and log id: enough to look it up, nothing secret.
    console.error(
      JSON.stringify({
        msg: "tiktok.connect.failed",
        brand: brand.slug,
        code: error instanceof TikTokError ? error.code : null,
        logId: error instanceof TikTokError ? error.logId : null,
        // A database error's message carries the query values (encrypted tokens): name only.
        error:
          error instanceof TikTokError
            ? error.message
            : error instanceof Error
              ? error.name
              : "unknown",
      }),
    );
    return back(request, path, "failed");
  }
}

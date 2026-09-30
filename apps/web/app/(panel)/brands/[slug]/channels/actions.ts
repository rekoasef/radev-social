"use server";

import { randomBytes } from "node:crypto";
import {
  deleteSocialAccount,
  getBrandBySlug,
  getSocialAccount,
  getSocialAccountTokens,
} from "@radev/db";
import { revokeTiktokToken, tiktokAuthorizeUrl } from "@radev/publishers";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";
import {
  channelsPath,
  TIKTOK_OAUTH_COOKIE,
  TIKTOK_OAUTH_MAX_AGE,
  tiktokClient,
  tiktokRedirectUri,
} from "@/lib/tiktok";

// Marcas → Canales: connect and disconnect the brand's TikTok account (phase 5 T4). The callback
// that finishes connecting is app/api/tiktok/callback/route.ts.

const slug = z.string().trim().min(1).max(64);

async function activeBrand(value: FormDataEntryValue | null) {
  const parsed = slug.safeParse(value);
  if (!parsed.success) return undefined;
  const brand = await getBrandBySlug(db, parsed.data);
  return brand && brand.archivedAt === null ? brand : undefined;
}

/** Sends the operator to TikTok to authorize; TikTok comes back to the callback. */
export async function connectTiktokAction(form: FormData): Promise<void> {
  await requireOperator();
  const brand = await activeBrand(form.get("slug"));
  if (!brand) redirect("/brands");
  const client = tiktokClient();
  if (!client) redirect(`${channelsPath(brand.slug)}?tiktok=not_configured`);

  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(TIKTOK_OAUTH_COOKIE, JSON.stringify({ state, slug: brand.slug }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // TikTok comes back with a top-level GET: Lax is sent then, Strict would not be.
    sameSite: "lax",
    path: "/api/tiktok",
    maxAge: TIKTOK_OAUTH_MAX_AGE,
  });
  redirect(
    tiktokAuthorizeUrl({ clientKey: client.clientKey, redirectUri: tiktokRedirectUri(), state }),
  );
}

export type DisconnectState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/**
 * Revokes the app's access on TikTok and deletes the account with its tokens. If TikTok can't be
 * reached it's deleted anyway (the operator asked to disconnect); the message says to revoke it
 * from TikTok's settings too.
 */
export async function disconnectTiktokAction(
  _: DisconnectState,
  form: FormData,
): Promise<DisconnectState> {
  await requireOperator();
  const brand = await activeBrand(form.get("slug"));
  if (!brand) return { status: "error", message: "Esa marca no existe o está archivada." };
  const account = await getSocialAccount(db, brand.id, "tiktok");
  if (!account) return { status: "error", message: "La marca no tiene TikTok conectado." };

  let revoked = false;
  const client = tiktokClient();
  if (client) {
    try {
      const stored = await getSocialAccountTokens(db, account.id);
      if (stored) {
        await revokeTiktokToken(client, stored.tokens.accessToken);
        revoked = true;
      }
    } catch {
      // Expired or already revoked tokens, TikTok down, or a changed TOKEN_ENCRYPTION_KEY:
      // disconnecting still goes ahead.
    }
  }
  await deleteSocialAccount(db, { brandId: brand.id, accountId: account.id });
  revalidatePath(channelsPath(brand.slug));
  return {
    status: "ok",
    message: revoked
      ? "TikTok desconectado: se revocó el acceso y se borraron los tokens."
      : "TikTok desconectado y tokens borrados. TikTok no confirmó la revocación: sacá el acceso de la app desde TikTok (Ajustes → Seguridad → Apps) si querés asegurarte.",
  };
}

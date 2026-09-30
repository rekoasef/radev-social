import { createHash } from "node:crypto";
import {
  type Notice,
  postDescription,
  type TiktokPublishJob,
  tiktokInboxNotice,
} from "@radev/core";
import {
  type Database,
  getSocialAccount,
  getSocialAccountTokens,
  getTiktokPublishContext,
  markSocialAccountReauth,
  readMediaFile,
  type SocialTokens,
  setAssetJpeg,
  setTiktokPublishId,
  settleTiktokPublication,
  type TiktokPublishContext,
  updateSocialAccountTokens,
  writeMediaFile,
} from "@radev/db";
import {
  fetchPostState,
  initPhotoPost,
  isTiktokAuthError,
  isTiktokPermanentError,
  refreshTiktokToken,
  type TikTokClient,
  TikTokError,
  type TikTokPostState,
} from "@radev/publishers";
import { z } from "zod";
import type { Logger } from "../logger";

// tiktok.publish (phase 5 T6, docs/ARCHITECTURE.md §9): a post of a brand with TikTok connected,
// already `publishing`. Sends the slides' JPEGs as a photo post (MEDIA_UPLOAD: a draft in the
// account's inbox until TikTok's audit), saves TikTok's publish id at once and asks for its status
// until TikTok takes it or fails.
//
// Idempotent (rule 8): it only acts on a `pending` tiktok publication, and with a publish id saved
// it follows that post instead of sending another one. The only way to send twice is dying in the
// instant between TikTok's answer and saving the id.

const REFRESH_MARGIN_MS = 10 * 60_000;
/** TikTok allows 30 status fetches per minute per token: one every 5 s stays well below. */
const POLL_INTERVAL_MS = 5_000;
/** About 2 min per run; the job's retries keep following it for a few more. */
const POLLS_PER_RUN = 24;
const SLIDE_SIZE = { width: 1080, height: 1350 };

export type TiktokApi = {
  initPhotoPost: typeof initPhotoPost;
  fetchPostState: typeof fetchPostState;
  refreshTiktokToken: typeof refreshTiktokToken;
};

export type TiktokPublishDeps = {
  db: Database;
  log: Logger;
  /** Null without TIKTOK_CLIENT_KEY/SECRET: the post fails with that reason. */
  client: TikTokClient | null;
  /** Public base of MEDIA_DIR that TikTok pulls from (https://<MEDIA_DOMAIN>, verified domain). */
  mediaBaseUrl: string | null;
  jpegFromPng: (png: Buffer, size: { width: number; height: number }) => Promise<Buffer>;
  notify?: (notice: Notice, options: { urgent: boolean }) => Promise<void>;
  /** The post failed for good: tell the operator (Telegram). */
  onFailed?: (input: { postId: string; error: string }) => Promise<void>;
  appUrl?: string;
  api?: TiktokApi;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
};

export type TiktokPublishOutcome = "inbox" | "published" | "failed" | "stale" | "missing";

const copySchema = z.object({
  hook: z.string().default(""),
  caption: z.string().default(""),
  hashtags: z.array(z.string()).default([]),
});

/** Not worth retrying: the post is marked failed with this message. */
class PermanentFailure extends Error {}

export async function publishToTiktok(
  deps: TiktokPublishDeps,
  job: TiktokPublishJob,
): Promise<TiktokPublishOutcome> {
  const { db, log } = deps;
  const api = deps.api ?? { initPhotoPost, fetchPostState, refreshTiktokToken };
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = deps.now ?? (() => new Date());

  const context = await getTiktokPublishContext(db, job.postId);
  if (!context) return "missing";
  if (context.status !== "publishing" || context.publication?.status !== "pending") {
    log.info("tiktok publish skipped", {
      post: context.publicCode,
      status: context.status,
      publication: context.publication?.status ?? null,
    });
    return "stale";
  }

  try {
    const { client, mediaBaseUrl } = deps;
    if (!client) throw new PermanentFailure("Faltan TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET.");
    if (!mediaBaseUrl)
      throw new PermanentFailure("Falta MEDIA_DOMAIN: TikTok no tiene de dónde bajar las fotos.");
    const account = await getSocialAccount(db, context.brand.id, "tiktok");
    if (!account) throw new PermanentFailure(`${context.brand.name} ya no tiene TikTok conectado.`);
    if (account.status !== "active") {
      throw new PermanentFailure(
        `Hay que reconectar el TikTok de ${context.brand.name} (Marcas → Canales).`,
      );
    }

    const tokens = new TokenSource(db, client, account.id, api, now);
    let publishId = context.publication.externalId;
    if (!publishId) {
      const photoUrls = await jpegUrls(deps, context, mediaBaseUrl);
      const copy = copySchema.parse(context.content ?? {});
      publishId = await tokens.use((token) =>
        api.initPhotoPost(token, {
          photoUrls,
          title: copy.hook,
          description: postDescription(copy),
          mode: "MEDIA_UPLOAD",
        }),
      );
      await setTiktokPublishId(db, { postId: context.postId, publishId });
      log.info("tiktok post sent", { post: context.publicCode, photos: photoUrls.length });
    }

    for (let poll = 0; poll < POLLS_PER_RUN; poll++) {
      const id = publishId;
      const state: TikTokPostState = await tokens.use((token) => api.fetchPostState(token, id));
      switch (state.kind) {
        case "processing":
          await sleep(POLL_INTERVAL_MS);
          continue;
        case "inbox":
          await settleTiktokPublication(db, { postId: context.postId, outcome: { kind: "inbox" } });
          log.info("tiktok draft in the inbox", { post: context.publicCode });
          await deps.notify?.(
            tiktokInboxNotice(
              {
                id: context.postId,
                code: context.publicCode,
                brandName: context.brand.name,
                hook: copySchema.parse(context.content ?? {}).hook,
              },
              deps.appUrl ?? "",
            ),
            { urgent: true },
          );
          return "inbox";
        case "published":
          await settleTiktokPublication(db, {
            postId: context.postId,
            outcome: { kind: "published", url: null, at: now() },
          });
          log.info("tiktok post published", { post: context.publicCode, tiktokId: state.postId });
          return "published";
        case "failed":
          if (state.retryable) {
            // TikTok's own hiccup: forget this attempt so the retry sends it again.
            await setTiktokPublishId(db, { postId: context.postId, publishId: null });
            throw new Error(`TikTok falló de su lado (${state.reason}); se vuelve a intentar.`);
          }
          if (state.reason === "auth_removed") {
            throw new TikTokError("Se quitó el permiso de la app en TikTok.", "auth_removed", null);
          }
          throw new PermanentFailure(`TikTok rechazó el post: ${failReasonText(state.reason)}`);
      }
    }
    throw new Error("TikTok sigue procesando las fotos; se vuelve a consultar.");
  } catch (error) {
    if (!(error instanceof PermanentFailure) && !isTiktokPermanentError(error)) throw error;
    if (isTiktokAuthError(error)) {
      const account = await getSocialAccount(db, context.brand.id, "tiktok");
      if (account) {
        await markSocialAccountReauth(db, account.id, (error as TikTokError).code ?? "auth");
      }
    }
    const message = isTiktokAuthError(error)
      ? `TikTok no aceptó el acceso de ${context.brand.name}: reconectala en Marcas → Canales.`
      : (error as Error).message;
    await failTiktokPublish(deps, job.postId, message);
    return "failed";
  }
}

/** Gives up on a post: marks it failed (retries used up, or not worth retrying) and says so. */
export async function failTiktokPublish(
  deps: Pick<TiktokPublishDeps, "db" | "log" | "onFailed">,
  postId: string,
  error: string,
): Promise<void> {
  const settled = await settleTiktokPublication(deps.db, {
    postId,
    outcome: { kind: "failed", error },
  });
  deps.log.warn("tiktok publish failed", { postId, error, settled });
  if (settled) await deps.onFailed?.({ postId, error });
}

/** The access token, refreshed when close to expiring, or once when TikTok rejects it. */
class TokenSource {
  private current: SocialTokens | undefined;

  constructor(
    private readonly db: Database,
    private readonly client: TikTokClient,
    private readonly accountId: string,
    private readonly api: TiktokApi,
    private readonly now: () => Date,
  ) {}

  async use<T>(call: (accessToken: string) => Promise<T>): Promise<T> {
    const tokens = await this.get(false);
    try {
      return await call(tokens.accessToken);
    } catch (error) {
      if (!(error instanceof TikTokError) || error.code !== "access_token_invalid") throw error;
      return call((await this.get(true)).accessToken);
    }
  }

  private async get(force: boolean): Promise<SocialTokens> {
    if (!this.current) {
      const stored = await getSocialAccountTokens(this.db, this.accountId);
      if (!stored) throw new PermanentFailure("La cuenta de TikTok ya no existe.");
      this.current = stored.tokens;
    }
    const expiresSoon =
      this.current.accessExpiresAt.getTime() - this.now().getTime() < REFRESH_MARGIN_MS;
    if (!force && !expiresSoon) return this.current;
    const { refreshToken, refreshExpiresAt } = this.current;
    if (!refreshToken || (refreshExpiresAt && refreshExpiresAt <= this.now())) {
      throw new TikTokError("El permiso de TikTok venció.", "invalid_grant", null);
    }
    const fresh = await this.api.refreshTiktokToken(this.client, refreshToken, { now: this.now() });
    this.current = {
      accessToken: fresh.accessToken,
      accessExpiresAt: fresh.accessExpiresAt,
      refreshToken: fresh.refreshToken,
      refreshExpiresAt: fresh.refreshExpiresAt,
    };
    await updateSocialAccountTokens(this.db, this.accountId, this.current);
    return this.current;
  }
}

/** Public URLs of the slides' JPEGs, making the ones missing from older renders. */
async function jpegUrls(
  deps: TiktokPublishDeps,
  context: TiktokPublishContext,
  mediaBaseUrl: string,
): Promise<string[]> {
  if (context.slides.length === 0)
    throw new PermanentFailure("El post no tiene slides renderizadas.");
  const urls: string[] = [];
  for (const slide of context.slides) {
    let jpegPath = slide.jpegPath;
    if (!jpegPath) {
      const png = await readMediaFile(slide.pngPath);
      if (!png) throw new PermanentFailure(`Falta la imagen de la slide ${slide.index + 1}.`);
      const jpeg = await deps.jpegFromPng(png, SLIDE_SIZE);
      jpegPath = slide.pngPath.replace(/\.png$/, ".jpg");
      await writeMediaFile(jpegPath, jpeg);
      await setAssetJpeg(deps.db, {
        assetId: slide.assetId,
        jpegPath,
        jpegChecksum: createHash("sha256").update(jpeg).digest("hex"),
      });
    }
    urls.push(`${mediaBaseUrl.replace(/\/+$/, "")}/${jpegPath}`);
  }
  return urls;
}

/** TikTok's fail reasons that the operator can act on, in their words. */
function failReasonText(reason: string): string {
  switch (reason) {
    case "photo_pull_failed":
      return "no pudo bajar las fotos de media.gestorlumus.site.";
    case "picture_size_check_failed":
      return "el tamaño de las fotos no le sirve (probar 864×1080).";
    case "file_format_check_failed":
      return "el formato de las fotos no le sirve.";
    case "spam_risk_too_many_posts":
      return "la cuenta llegó al límite de posts del día.";
    default:
      return reason;
  }
}

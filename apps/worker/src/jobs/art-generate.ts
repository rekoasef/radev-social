import { artPrompt, type ImageProvider } from "@radev/ai";
import {
  ART_DAILY_CAP,
  ART_SLOTS,
  type ArtGenerateJob,
  type ArtImage,
  type ArtSlot,
  type PostArt,
} from "@radev/core";
import {
  countArtImagesSince,
  type Database,
  getBrandById,
  getPostById,
  getPostVersion,
  listPostArtImages,
  readMediaFile,
  setVersionArt,
  writeMediaFile,
} from "@radev/db";
import { isLookId, LOOK_ART, parseTheme } from "@radev/slides/generation";
import type { Logger } from "../logger";

// art.generate (ADR 0016): the images of a version's cover and close, between the writing and
// the render. It never blocks a post: whatever happens (no credentials, the daily cap, the
// provider down, a wrong background twice), the version ends with a final art state and its
// render is queued; the slides without an image use the look's own art. Only acts on art that
// is still `pending`, so a repeated job does nothing (rule 8).

/** Tries per image: a second one when the background came out wrong or the call failed. */
const TRIES = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ArtDeps = {
  db: Database;
  log: Logger;
  /** Null without Cloudflare credentials. */
  images: ImageProvider | null;
  /** Brightness of the image's border, 0–255 (render/image-check.ts). */
  edgeBrightness: (image: Buffer) => Promise<number>;
  backgroundMatches: (brightness: number, background: "dark" | "light") => boolean;
  queueRender: (versionId: string) => Promise<void>;
  now?: () => Date;
};

export type ArtOutcome = "done" | "skipped";

export async function generateArt(
  deps: ArtDeps,
  { versionId, fresh = false }: ArtGenerateJob,
): Promise<ArtOutcome> {
  const { db, log } = deps;
  const now = deps.now ?? (() => new Date());
  const version = await getPostVersion(db, versionId);
  const post = version ? await getPostById(db, version.postId) : undefined;
  if (!version || !post || version.art?.status !== "pending") {
    log.info("art skipped: nothing pending", { versionId, status: version?.art?.status });
    return "skipped";
  }
  const finish = async (art: PostArt) => {
    await setVersionArt(db, version.id, art);
    await deps.queueRender(version.id);
    log.info("art finished", { versionId, status: art.status, note: art.note });
    return "done" as const;
  };

  try {
    const brand = await getBrandById(db, post.brandId);
    const content = version.content as { look?: unknown; art?: Partial<Record<ArtSlot, string>> };
    const look =
      typeof content.look === "string" && isLookId(content.look) ? content.look : undefined;
    const spec = look ? LOOK_ART[look] : undefined;
    const theme = brand ? parseTheme(brand.stylePreset, brand.themeTokens) : undefined;
    if (!brand || !spec || !content.art || !theme?.ok || theme.theme.preset !== "studio") {
      return finish({ status: "skipped", images: {}, note: "Este post no lleva imagen." });
    }
    if (!deps.images) {
      return finish({
        status: "skipped",
        images: {},
        note: "Faltan las credenciales de Cloudflare (CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN).",
      });
    }

    const accent = theme.theme.tokens.colors.accent;
    const previous = await listPostArtImages(db, post.id);
    const images: Partial<Record<ArtSlot, ArtImage>> = {};
    const notes: string[] = [];
    let generatedToday = await countArtImagesSince(db, new Date(now().getTime() - DAY_MS));
    /** The provider's limit: no more calls in this run. */
    let limited = false;

    for (const slot of ART_SLOTS) {
      const subject = content.art[slot];
      if (!subject || limited) continue;
      const background = spec[slot];
      const prompt = artPrompt(subject, { background, accent, monochrome: spec.monochrome });

      // The same prompt as an earlier version of the post (a text fix): the same image.
      const reuse = fresh ? undefined : previous.find((image) => image.prompt === prompt);
      if (reuse && (await readMediaFile(reuse.path))) {
        images[slot] = reuse;
        continue;
      }
      if (generatedToday >= ART_DAILY_CAP) {
        notes.push(`Se llegó al tope diario de ${ART_DAILY_CAP} imágenes.`);
        break;
      }

      let saved: ArtImage | undefined;
      for (let attempt = 1; attempt <= TRIES && !saved; attempt++) {
        const result = await deps.images.generate({ prompt });
        generatedToday++;
        if (!result.ok) {
          log.warn("art image failed", {
            slot,
            attempt,
            kind: result.error.kind,
            error: result.error.message,
          });
          if (result.error.kind === "rate_limited" || attempt === TRIES) {
            notes.push(`${slot === "cover" ? "Portada" : "Cierre"}: ${result.error.message}`);
          }
          if (result.error.kind === "rate_limited") {
            limited = true;
            break;
          }
          continue;
        }
        const brightness = await deps.edgeBrightness(result.image);
        if (!deps.backgroundMatches(brightness, background)) {
          log.warn("art image with the wrong background", {
            slot,
            attempt,
            brightness,
            background,
          });
          if (attempt === TRIES) {
            notes.push(
              `${slot === "cover" ? "Portada" : "Cierre"}: la imagen salió con el fondo equivocado dos veces.`,
            );
          }
          continue;
        }
        const path = `${brand.slug}/${post.id}/${version.id}/art/${slot}.jpg`;
        await writeMediaFile(path, result.image);
        saved = { path, prompt, model: result.model, createdAt: now().toISOString() };
      }
      if (saved) images[slot] = saved;
    }

    const wanted = ART_SLOTS.filter((slot) => content.art?.[slot]).length;
    const got = Object.keys(images).length;
    return finish({
      status: got === 0 ? "failed" : got < wanted ? "partial" : "ready",
      images,
      ...(notes.length > 0 && { note: notes.join(" ") }),
    });
  } catch (error) {
    log.error("art failed", { versionId, error });
    return finish({
      status: "failed",
      images: {},
      note: `No se pudieron generar las imágenes: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

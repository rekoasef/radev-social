import { createHash } from "node:crypto";
import { type CarouselRenderJob, RENDER_FORMATS } from "@radev/core";
import {
  type Database,
  getBrandById,
  getPostById,
  getPostVersion,
  saveRenderedAsset,
  setVersionRenderIssues,
  setVersionRenderProgress,
  transitionPost,
  writeMediaFile,
} from "@radev/db";
import type { Logger } from "../logger";
import { getBrowser } from "../render/browser";

// carousel.render (docs/ARCHITECTURE.md §8): opens each slide of a version in the web's internal
// render page, waits until fonts and images are in, reads the render QA the page ran, takes the
// PNG and registers it. All slides fine → in_review; any problem → failed, with the problems on
// the version so the panel can show them. Runs only for the current version of a post that is
// `rendering`, so a repeated or outdated job does nothing (rule 8).

const [FORMAT] = RENDER_FORMATS;
const SIZE = { width: 1080, height: 1350 };
const READY_TIMEOUT_MS = 30_000;

export type RenderIssue = { slide: number; kind: string; text: string };

/** What the web's render page exposes (apps/web/components/render/render-ready.tsx). */
type RenderWindow = { __renderReady?: boolean; __renderQa?: { kind: string; text: string }[] };

export type RenderEnv = { webUrl: string; renderToken: string };

export async function renderCarousel(
  db: Database,
  log: Logger,
  env: RenderEnv,
  { versionId }: CarouselRenderJob,
): Promise<void> {
  const version = await getPostVersion(db, versionId);
  const post = version ? await getPostById(db, version.postId) : undefined;
  if (!version || !post) {
    log.warn("render skipped: version not found", { versionId });
    return;
  }
  if (post.currentVersionId !== version.id || post.status !== "rendering") {
    log.info("render skipped: not the current version or not rendering", {
      versionId,
      post: post.publicCode,
      status: post.status,
    });
    return;
  }
  const brand = await getBrandById(db, post.brandId);
  const slides = (version.content as { slides?: unknown[] }).slides;
  if (!brand || !Array.isArray(slides))
    throw new Error("La versión no tiene slides o la marca no existe.");

  const started = Date.now();
  const issues: RenderIssue[] = [];
  // The panel shows how far it got (0–100), slide by slide.
  await setVersionRenderProgress(db, version.id, 0);
  const browser = await getBrowser();
  // The token goes in a header: in the URL it would end up in the web server's log.
  const context = await browser.newContext({
    viewport: SIZE,
    extraHTTPHeaders: { "X-Render-Token": env.renderToken },
  });
  try {
    const page = await context.newPage();
    for (let index = 0; index < slides.length; index++) {
      const response = await page.goto(
        `${env.webUrl}/render/${version.id}/${index}?format=${FORMAT}`,
      );
      if (!response?.ok()) {
        issues.push({
          slide: index,
          kind: "error",
          text: `La página de render respondió ${response?.status()}`,
        });
        continue;
      }
      await page.waitForFunction(() => (globalThis as RenderWindow).__renderReady === true, null, {
        timeout: READY_TIMEOUT_MS,
      });
      const qa = await page.evaluate(() => (globalThis as RenderWindow).__renderQa ?? []);
      for (const issue of qa) issues.push({ slide: index, kind: issue.kind, text: issue.text });

      const png = await page.locator("[data-render-root]").screenshot({ type: "png" });
      const path = `${brand.slug}/${post.id}/${version.id}/${FORMAT}/${index}.png`;
      await writeMediaFile(path, png);
      await saveRenderedAsset(db, {
        postVersionId: version.id,
        format: FORMAT,
        slideIndex: index,
        path,
        ...SIZE,
        checksum: createHash("sha256").update(png).digest("hex"),
      });
      await setVersionRenderProgress(
        db,
        version.id,
        Math.round(((index + 1) / slides.length) * 100),
      );
    }
  } finally {
    await context.close();
  }

  await setVersionRenderIssues(db, version.id, issues.length > 0 ? issues : null);
  await setVersionRenderProgress(db, version.id, null);
  const moved = await transitionPost(
    db,
    post.id,
    issues.length > 0 ? "renderFailed" : "renderDone",
  );
  log.info("render finished", {
    post: post.publicCode,
    version: version.number,
    slides: slides.length,
    issues: issues.length,
    status: moved.ok ? moved.to : post.status,
    ms: Date.now() - started,
  });
}

/** After the last retry: the post leaves `rendering`, with the error on its version. */
export async function failRender(db: Database, versionId: string, error: unknown): Promise<void> {
  const version = await getPostVersion(db, versionId);
  const post = version ? await getPostById(db, version.postId) : undefined;
  if (!version || !post || post.currentVersionId !== version.id || post.status !== "rendering")
    return;
  const text = error instanceof Error ? error.message : String(error);
  await setVersionRenderIssues(db, version.id, [{ slide: -1, kind: "error", text }]);
  await setVersionRenderProgress(db, version.id, null);
  await transitionPost(db, post.id, "renderFailed");
}

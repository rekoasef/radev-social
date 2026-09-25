import { AI_PROVIDER_LABELS, availableEvents, canExport, postDescription } from "@radev/core";
import {
  getBrandById,
  getPostByCode,
  listGenerationRuns,
  listPostVersions,
  listPublications,
  listVersionAssets,
} from "@radev/db";
import { carouselSchema } from "@radev/slides";
import { describeQaIssue, QA_KINDS, type QaIssue } from "@radev/slides/qa";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plate } from "@/components/console/plate";
import { Tally } from "@/components/console/tally";
import { ApproveButton } from "@/components/posts/approve-button";
import { CopyButton } from "@/components/posts/copy-button";
import { GenerationStatus } from "@/components/posts/generation-status";
import { MarkPublishedForm } from "@/components/posts/mark-published-form";
import { PostStrip } from "@/components/posts/post-strip";
import { RenderProgress } from "@/components/posts/render-progress";
import { RenderedStrip } from "@/components/posts/rendered-strip";
import { mediaUrl } from "@/lib/brand-assets";
import { brandRenderContext } from "@/lib/carousel";
import { db } from "@/lib/db";
import { STATUS_DISPLAY } from "@/lib/post-status";
import { formatDateTime } from "@/lib/time";
import { restoreVersionAction, retryGenerationAction, retryRenderAction } from "../actions";

export async function generateMetadata({ params }: PageProps<"/posts/[code]">): Promise<Metadata> {
  return { title: `${(await params).code} · RAdev Social` };
}

// One post: its status, its current version and what can be done with it.
export default async function PostPage({ params, searchParams }: PageProps<"/posts/[code]">) {
  const post = await getPostByCode(db, (await params).code);
  if (!post) notFound();
  const [brand, versions, publications, runs, query] = await Promise.all([
    getBrandById(db, post.brandId),
    listPostVersions(db, post.id),
    listPublications(db, post.id),
    listGenerationRuns(db, post.id),
    searchParams,
  ]);
  if (!brand) notFound();
  const current = versions.find((v) => v.id === post.currentVersionId);
  // ?v=<number> shows an older version; by default, the current one.
  const version = versions.find((v) => String(v.number) === query.v) ?? current;
  const viewingOld = version !== undefined && version.id !== current?.id;
  const [render, rendered] = await Promise.all([
    brandRenderContext(brand),
    version ? listVersionAssets(db, version.id) : [],
  ]);
  const content = version ? carouselSchema.safeParse(version.content) : undefined;
  // The real PNGs once every slide has one; while the current version renders (or if it failed
  // halfway), the browser drawing.
  const renderingNow = !viewingOld && post.status === "rendering";
  const showRendered =
    !renderingNow && content?.success === true && rendered.length === content.data.slides.length;
  const display = STATUS_DISPLAY[post.status];
  const canEdit = availableEvents(post.status).includes("edit");
  // A failed post whose last event was a generation (no version yet, or a newer failed run).
  const lastRun = runs[0];
  const generationFailed =
    post.status === "failed" &&
    post.generationRequest !== null &&
    (!current || (lastRun !== undefined && lastRun.createdAt > current.createdAt));
  const canRetry = !generationFailed && availableEvents(post.status).includes("retryRender");
  const canRetryGeneration =
    generationFailed && availableEvents(post.status).includes("retryGeneration");
  // The attempts of the last generation (principal and fallback) that failed, newest first.
  const failedRuns = generationFailed
    ? runs.filter((run) => run.status === "failed").slice(0, 2)
    : [];
  const runsById = new Map(runs.map((run) => [run.id, run]));
  const canApprove = !viewingOld && availableEvents(post.status).includes("approve");
  const canMarkPublished = !viewingOld && availableEvents(post.status).includes("startPublishing");
  const published = publications.find((p) => p.status === "published");
  // Export is about the current version: hidden while looking at an older one.
  const exportable =
    !viewingOld &&
    content?.success === true &&
    canExport({
      status: post.status,
      slideCount: content.data.slides.length,
      renderedSlides: rendered.map((asset) => asset.slideIndex),
    }).ok;
  // The same problem can be reported by a text and by its box: shown once, described.
  const renderIssues = [
    ...new Map(
      (Array.isArray(current?.renderIssues)
        ? (current.renderIssues as { slide: number; kind: string; text: string }[])
        : []
      ).map((issue) => {
        const text = (QA_KINDS as readonly string[]).includes(issue.kind)
          ? describeQaIssue(issue as QaIssue)
          : issue.text || "Error al renderizar.";
        return [`${issue.slide}|${text}`, { slide: issue.slide, text }];
      }),
    ).values(),
  ];
  const currentSlides = (current?.content as { slides?: unknown[] } | undefined)?.slides;

  return (
    <>
      <section aria-labelledby="post-heading" className="flex flex-col gap-6">
        <Link href="/posts" className="plate-text w-fit text-ink-faint hover:text-ink">
          ← Posts
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <span className="callsign">{post.publicCode}</span>
          <h1 id="post-heading" className="text-2xl font-semibold tracking-[-0.02em] text-ink">
            {content?.success ? content.data.hook : (post.generationRequest?.idea ?? "Post")}
          </h1>
          <Tally state={display.tally}>{display.label}</Tally>
        </div>
        <p className="timecode text-xs text-ink-faint">
          {brand.name} · versión {version?.number ?? "—"} ·{" "}
          {formatDateTime(post.updatedAt, brand.timezone)}
        </p>
        {post.generationRequest && (
          <p className="max-w-[70ch] text-sm text-ink-dim">
            <span className="text-ink-faint">Pedido a la IA:</span> {post.generationRequest.idea}
          </p>
        )}
        {post.status === "generating" && (
          <GenerationStatus
            code={post.publicCode}
            timeZone={brand.timezone}
            initialRetryAt={post.generationRetryAt?.toISOString() ?? null}
          />
        )}
        {failedRuns.length > 0 && (
          <div
            role="alert"
            className="flex flex-col gap-2 border-l border-tally-red pl-3 text-sm text-ink"
          >
            <span>La generación falló:</span>
            <ul className="flex flex-col gap-2 text-ink-dim">
              {failedRuns.map((run) => (
                <li key={run.id} className="whitespace-pre-line">
                  <span className="timecode text-xs text-ink-faint">
                    {AI_PROVIDER_LABELS[run.provider]} · {run.model}
                  </span>
                  {"\n"}
                  {run.error}
                </li>
              ))}
            </ul>
          </div>
        )}
        {post.status === "rendering" && (
          <RenderProgress
            code={post.publicCode}
            slides={Array.isArray(currentSlides) ? currentSlides.length : 0}
            initial={current?.renderProgress ?? null}
          />
        )}
        {renderIssues.length > 0 && (
          <div
            role="alert"
            className="flex flex-col gap-1 border-l border-tally-red pl-3 text-sm text-ink"
          >
            <span>El render encontró problemas:</span>
            <ul className="list-disc pl-5 text-ink-dim">
              {renderIssues.map((issue) => (
                <li key={`${issue.slide}-${issue.text}`}>
                  {issue.slide >= 0 ? `Slide ${issue.slide + 1}: ` : ""}
                  {issue.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        {post.status === "in_review" && !viewingOld && (
          <p className="max-w-[60ch] text-sm text-ink-dim">
            Revisá las imágenes: son las que se publican. Si algo no va, editalo y se renderiza de
            nuevo.
          </p>
        )}
        {post.status === "approved" && (
          <p className="max-w-[60ch] text-sm text-ink-dim">
            Aprobado: descargalo, publicalo a mano y después marcalo como publicado. Si lo editás,
            vuelve a render y a revisión.
          </p>
        )}
        {post.status === "published" && published?.publishedAt && (
          <p className="text-sm text-ink-dim">
            Publicado el {formatDateTime(published.publishedAt, brand.timezone)}
            {published.url && (
              <>
                {" · "}
                <a
                  href={published.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink underline underline-offset-4 hover:text-ink-dim"
                >
                  ver el post
                </a>
              </>
            )}
          </p>
        )}
        <div className="flex flex-wrap items-start gap-2">
          {canApprove && current && <ApproveButton code={post.publicCode} versionId={current.id} />}
          {exportable && content?.success && (
            <>
              <a
                href={`/posts/${post.publicCode}/download`}
                download
                className="console-button console-button-primary"
              >
                Descargar ZIP
              </a>
              <CopyButton label="Copiar título" text={content.data.hook} />
              <CopyButton label="Copiar descripción" text={postDescription(content.data)} />
            </>
          )}
          {canEdit && (
            <Link href={`/posts/${post.publicCode}/edit`} className="console-button">
              Editar
            </Link>
          )}
          {canRetryGeneration && (
            <form action={retryGenerationAction}>
              <input type="hidden" name="code" value={post.publicCode} />
              <button type="submit" className="console-button console-button-primary">
                Reintentar generación
              </button>
            </form>
          )}
          {canRetry && (
            <form action={retryRenderAction}>
              <input type="hidden" name="code" value={post.publicCode} />
              <button type="submit" className="console-button">
                Reintentar render
              </button>
            </form>
          )}
        </div>
        {canMarkPublished && exportable && <MarkPublishedForm code={post.publicCode} />}
      </section>

      {version && (
        <section aria-labelledby="slides-heading" className="flex flex-col gap-6">
          <Plate
            id="slides-heading"
            aside={[
              viewingOld ? `Versión ${version?.number} (no es la actual)` : undefined,
              showRendered ? "PNG renderizados" : "Vista previa",
            ]
              .filter(Boolean)
              .join(" · ")}
          >
            Slides
          </Plate>
          {showRendered && content?.success ? (
            <RenderedStrip
              slides={rendered.map((asset) => ({
                // Re-rendering a version rewrites the same path, which /media caches forever: the
                // checksum gives each render its own URL.
                url: `${mediaUrl(asset.path)}?v=${asset.checksum.slice(0, 12)}`,
                label: `Slide ${asset.slideIndex + 1}`,
                width: asset.width,
                height: asset.height,
              }))}
              post={{
                brandName: brand.name,
                hook: content.data.hook,
                caption: content.data.caption,
                hashtags: content.data.hashtags,
              }}
            />
          ) : render.ok && content?.success ? (
            <PostStrip
              carousel={content.data}
              theme={render.theme}
              assets={render.assets}
              brandName={brand.name}
            />
          ) : (
            <p className="text-sm text-ink-dim">No se pudo dibujar esta versión.</p>
          )}
        </section>
      )}

      {versions.length > 0 && (
        <section aria-labelledby="versions-heading" className="flex flex-col gap-6">
          <Plate id="versions-heading" aside={`${versions.length}`}>
            Versiones
          </Plate>
          <ul className="flex flex-col divide-y divide-bezel rounded-md border border-bezel">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="flex items-center gap-3 text-sm text-ink">
                  <span className="timecode">v{v.number}</span>
                  <span className="text-ink-dim">
                    {versionAuthor(
                      v.origin,
                      v.generationRunId ? runsById.get(v.generationRunId) : undefined,
                    )}{" "}
                    · {formatDateTime(v.createdAt, brand.timezone)}
                  </span>
                  {v.id === current?.id && <Tally state="ready">Actual</Tally>}
                </span>
                <span className="flex items-center gap-2">
                  {v.id !== version?.id && (
                    <Link
                      href={`/posts/${post.publicCode}?v=${v.number}`}
                      className="console-button"
                    >
                      Ver
                    </Link>
                  )}
                  {v.id !== current?.id && canEdit && (
                    <form action={restoreVersionAction}>
                      <input type="hidden" name="code" value={post.publicCode} />
                      <input type="hidden" name="versionId" value={v.id} />
                      <button type="submit" className="console-button">
                        Restaurar
                      </button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-faint">
            Restaurar crea una versión nueva con ese contenido: no se pierde ninguna, y el post
            vuelve a render y revisión.
          </p>
        </section>
      )}
    </>
  );
}

/** Who wrote a version: the editor, or the AI with the provider and model that answered. */
function versionAuthor(
  origin: "ai" | "manual",
  run: { provider: keyof typeof AI_PROVIDER_LABELS; model: string } | undefined,
): string {
  if (origin === "manual") return "Editor";
  return run ? `IA · ${AI_PROVIDER_LABELS[run.provider]} · ${run.model}` : "IA";
}

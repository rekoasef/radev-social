import {
  AI_PROVIDER_LABELS,
  availableEvents,
  canDiscard,
  canExport,
  freeOccurrences,
  MAX_QA_REGENERATIONS,
  postDescription,
  SCHEDULE_PICK_DAYS,
  upcomingSlots,
  WEEKDAY_LABELS,
} from "@radev/core";
import {
  getBrandById,
  getPostByCode,
  getPostNetworkMetrics,
  getSocialAccount,
  listGenerationRuns,
  listPlannedTimes,
  listPostScreenshots,
  listPostVersions,
  listPublications,
  listScheduleSlots,
  listVersionAssets,
} from "@radev/db";
import { carouselSchema, enabledLooks, resolveLook } from "@radev/slides";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plate } from "@/components/console/plate";
import { Tally } from "@/components/console/tally";
import { PostMetrics } from "@/components/metrics/post-metrics";
import { ApproveButton } from "@/components/posts/approve-button";
import { CopyButton } from "@/components/posts/copy-button";
import { DiscardButton } from "@/components/posts/discard-form";
import { GenerationStatus } from "@/components/posts/generation-status";
import { LookExplorer } from "@/components/posts/look-explorer";
import { MarkPublishedForm } from "@/components/posts/mark-published-form";
import { PostStrip } from "@/components/posts/post-strip";
import { RejectForm } from "@/components/posts/reject-form";
import { RenderProgress } from "@/components/posts/render-progress";
import { RenderedStrip } from "@/components/posts/rendered-strip";
import { ScheduleForm, type SlotChoice } from "@/components/posts/schedule-form";
import { mediaUrl } from "@/lib/brand-assets";
import { brandRenderContext } from "@/lib/carousel";
import { db } from "@/lib/db";
import { STATUS_DISPLAY } from "@/lib/post-status";
import { describeRenderIssues } from "@/lib/render-issues";
import { cityOf, formatDateTime, offsetOf } from "@/lib/time";
import {
  restoreVersionAction,
  retryGenerationAction,
  retryRenderAction,
  retryTiktokAction,
} from "../actions";
import { unschedulePostAction } from "../schedule-actions";

export async function generateMetadata({ params }: PageProps<"/posts/[code]">): Promise<Metadata> {
  return { title: `${(await params).code} · RAdev Social` };
}

// One post: its status, its current version and what can be done with it.
export default async function PostPage({ params, searchParams }: PageProps<"/posts/[code]">) {
  const post = await getPostByCode(db, (await params).code);
  if (!post) notFound();
  const [brand, versions, publications, runs, query, tiktokAccount, metrics] = await Promise.all([
    getBrandById(db, post.brandId),
    listPostVersions(db, post.id),
    listPublications(db, post.id),
    listGenerationRuns(db, post.id),
    searchParams,
    getSocialAccount(db, post.brandId, "tiktok"),
    getPostNetworkMetrics(db, post.id),
  ]);
  if (!brand) notFound();
  const current = versions.find((v) => v.id === post.currentVersionId);
  // ?v=<number> shows an older version; by default, the current one.
  const version = versions.find((v) => String(v.number) === query.v) ?? current;
  const viewingOld = version !== undefined && version.id !== current?.id;
  const [render, rendered, screenshots] = await Promise.all([
    brandRenderContext(brand, post.id),
    version ? listVersionAssets(db, version.id) : [],
    listPostScreenshots(db, post.id),
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
  // Rejecting sends it back to the AI: only for posts it wrote (manual ones are edited).
  const canReject =
    !viewingOld &&
    post.generationRequest !== null &&
    availableEvents(post.status).includes("reject");
  // Approved or scheduled (published by hand before its time), waiting since its time came, or
  // published by hand after TikTok couldn't take it.
  const canMarkPublished =
    !viewingOld &&
    (post.status === "publishing" ||
      post.status === "publish_failed" ||
      availableEvents(post.status).includes("startPublishing"));
  const canSchedule =
    !viewingOld &&
    (post.status === "approved" || post.status === "scheduled") &&
    content?.success === true;
  const slotChoices = canSchedule ? await scheduleChoices(brand, post.id) : [];
  const published = publications.find((p) => p.status === "published");
  // Phase 5 T6: at its time, a brand with TikTok connected sends the post to the TikTok inbox.
  const viaTiktok =
    tiktokAccount?.status === "active" && tiktokAccount.scopes.includes("video.upload");
  const tiktokPublication = publications.find((p) => p.network === "tiktok");
  // Export is about the current version: hidden while looking at an older one.
  const exportable =
    !viewingOld &&
    content?.success === true &&
    canExport({
      status: post.status,
      slideCount: content.data.slides.length,
      renderedSlides: rendered.map((asset) => asset.slideIndex),
    }).ok;
  const renderIssues = describeRenderIssues(current?.renderIssues);
  const currentSlides = (current?.content as { slides?: unknown[] } | undefined)?.slides;
  // Studio brands: the same carousel in the brand's other looks (drawn in the browser, no AI).
  const looks =
    !viewingOld && render.ok && render.theme.preset === "studio"
      ? enabledLooks(render.theme.tokens)
      : [];

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
        {screenshots.length > 0 && (
          <ul aria-label="Capturas para la IA" className="flex flex-wrap gap-3">
            {screenshots.map((shot) => (
              <li key={shot.id} className="flex w-28 flex-col gap-1">
                <a href={mediaUrl(shot.path)} target="_blank" rel="noreferrer">
                  {/* biome-ignore lint/performance/noImgElement: the operator's file, as uploaded */}
                  <img
                    src={mediaUrl(shot.path)}
                    alt={shot.note}
                    className="h-28 w-28 border border-bezel object-cover object-top"
                  />
                </a>
                <span className="text-xs text-ink-faint">{shot.note}</span>
              </li>
            ))}
          </ul>
        )}
        {post.rejectionFeedback && (
          <p className="max-w-[70ch] text-sm text-ink-dim">
            <span className="text-ink-faint">Último rechazo:</span> {post.rejectionFeedback}
          </p>
        )}
        {post.status === "generating" && current && post.qaRegenerations > 0 && (
          <p className="max-w-[70ch] text-sm text-ink-dim">
            La versión {current.number} no pasó el control del render: la IA la está corrigiendo
            (intento {post.qaRegenerations} de {MAX_QA_REGENERATIONS}).
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
            <span>
              El render encontró problemas
              {post.status === "in_review" && current?.origin === "ai"
                ? ` y la IA no los pudo corregir en ${MAX_QA_REGENERATIONS} intentos: editalo o rechazalo.`
                : ":"}
            </span>
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
            Aprobado: programalo, o descargalo, publicalo a mano y marcalo como publicado. Si lo
            editás, vuelve a render y a revisión.
          </p>
        )}
        {post.status === "scheduled" && post.scheduledAt && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="max-w-[60ch] text-sm text-ink">
              Programado para el{" "}
              <span className="timecode">{formatDateTime(post.scheduledAt, brand.timezone)}</span>.
              {viaTiktok
                ? "A esa hora se manda como borrador a tu bandeja de TikTok."
                : "A esa hora queda listo para que lo publiques a mano."}
            </p>
            <form action={unschedulePostAction}>
              <input type="hidden" name="code" value={post.publicCode} />
              <button type="submit" className="console-button">
                Desprogramar
              </button>
            </form>
          </div>
        )}
        {post.status === "publishing" && (
          <p role="status" className="max-w-[60ch] text-sm text-ink">
            {tiktokPublication?.status === "inbox"
              ? "Está en tu bandeja de TikTok: abrí la app y publicalo desde la notificación. Unos minutos después se marca como publicado solo (o marcalo vos abajo)."
              : tiktokPublication?.status === "pending"
                ? "Mandándolo a TikTok… En un par de minutos queda en tu bandeja."
                : "Llegó su hora: descargalo, publicalo a mano y marcalo como publicado."}
          </p>
        )}
        {post.status === "publish_failed" && tiktokPublication?.status === "failed" && (
          <div className="flex flex-col gap-3">
            <p role="alert" className="max-w-[60ch] text-sm text-tally-red">
              No se pudo mandar a TikTok: {tiktokPublication.error ?? "sin detalle"}.
            </p>
            <p className="max-w-[60ch] text-sm text-ink-dim">
              {viaTiktok ? (
                "Reintentalo cuando esté resuelto, o descargalo y publicalo a mano."
              ) : (
                <>
                  Para reintentar, reconectá TikTok en{" "}
                  <Link
                    href={`/brands/${brand.slug}/channels`}
                    className="text-ink underline underline-offset-4 hover:text-ink-dim"
                  >
                    Marcas → Canales
                  </Link>
                  . También podés descargarlo y publicarlo a mano.
                </>
              )}
            </p>
            {viaTiktok && !viewingOld && (
              <form action={retryTiktokAction}>
                <input type="hidden" name="code" value={post.publicCode} />
                <button type="submit" className="console-button console-button-primary">
                  Reintentar en TikTok
                </button>
              </form>
            )}
          </div>
        )}
        {post.scheduledAt && ["generating", "rendering", "in_review"].includes(post.status) && (
          <p className="max-w-[60ch] text-sm text-ink-dim">
            Planeado para el{" "}
            <span className="timecode">{formatDateTime(post.scheduledAt, brand.timezone)}</span>: al
            aprobarlo se programa solo.
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
          {canReject && current && <RejectForm code={post.publicCode} versionId={current.id} />}
          {exportable && content?.success && (
            <>
              <a
                href={`/posts/${post.publicCode}/download`}
                download
                // Scheduling is the main step of an approved post; downloading, of a due one.
                className={canSchedule ? "console-button" : "console-button console-button-primary"}
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
          {canDiscard(post.status) && (
            <DiscardButton code={post.publicCode} scheduled={post.status === "scheduled"} />
          )}
        </div>
        {canSchedule && (
          <ScheduleForm
            code={post.publicCode}
            choices={slotChoices}
            zoneLabel={`${cityOf(brand.timezone)}, ${offsetOf(brand.timezone)}`}
            rescheduling={post.status === "scheduled"}
          />
        )}
        {canMarkPublished && exportable && <MarkPublishedForm code={post.publicCode} />}
      </section>

      {metrics && (
        <PostMetrics metrics={metrics} timeZone={brand.timezone} code={post.publicCode} />
      )}

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
              seed={post.id}
              datasets={version.datasets ?? {}}
              art={versionArt(version.art)}
            />
          ) : (
            <p className="text-sm text-ink-dim">No se pudo dibujar esta versión.</p>
          )}
          {looks.length > 1 && render.ok && content?.success && version && (
            <LookExplorer
              code={post.publicCode}
              carousel={content.data}
              current={resolveLook(content.data.look, looks, post.id)}
              looks={looks}
              theme={render.theme}
              assets={render.assets}
              brandName={brand.name}
              seed={post.id}
              datasets={version.datasets ?? {}}
              art={versionArt(version.art)}
              canApply={canEdit}
            />
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

/** The brand's free slot times in the next days, for scheduling this post (its own time counts as free). */
async function scheduleChoices(
  brand: { id: string; timezone: string },
  postId: string,
): Promise<SlotChoice[]> {
  const now = new Date();
  const occurrences = upcomingSlots(await listScheduleSlots(db, brand.id), {
    from: now,
    days: SCHEDULE_PICK_DAYS,
    timeZone: brand.timezone,
  });
  const last = occurrences.at(-1);
  const taken = last
    ? await listPlannedTimes(db, {
        brandId: brand.id,
        from: now,
        to: new Date(last.at.getTime() + 1),
        exceptPostId: postId,
      })
    : [];
  return freeOccurrences(occurrences, taken).map((occurrence) => ({
    value: `${occurrence.slotId}|${occurrence.at.toISOString()}`,
    label: `${WEEKDAY_LABELS[occurrence.weekday]} ${occurrence.localDate.slice(8, 10)}/${occurrence.localDate.slice(5, 7)} · ${occurrence.localTime}`,
  }));
}

/** URLs of a version's generated images, as the render page passes them (ADR 0016). */
function versionArt(
  art: { images?: { cover?: { path: string }; cta?: { path: string } } } | null,
): { cover?: string; cta?: string } {
  const images = art?.images ?? {};
  return {
    ...(images.cover && { cover: mediaUrl(images.cover.path) }),
    ...(images.cta && { cta: mediaUrl(images.cta.path) }),
  };
}

/** Who wrote a version: the editor, or the AI with the provider and model that answered. */
function versionAuthor(
  origin: "ai" | "manual",
  run: { provider: keyof typeof AI_PROVIDER_LABELS; model: string } | undefined,
): string {
  if (origin === "manual") return "Editor";
  return run ? `IA · ${AI_PROVIDER_LABELS[run.provider]} · ${run.model}` : "IA";
}

import { availableEvents, plannedTimeOnApprove, shortDateTime, sortReviewQueue } from "@radev/core";
import { getBrandById, getPostByCode, listPostsInReview, listVersionAssets } from "@radev/db";
import { carouselSchema, postTexts, slideTexts } from "@radev/slides";
import type { Metadata } from "next";
import Link from "next/link";
import { Plate } from "@/components/console/plate";
import { Tally } from "@/components/console/tally";
import { RenderedStrip } from "@/components/posts/rendered-strip";
import { ReviewBar } from "@/components/review/review-bar";
import { mediaUrl } from "@/lib/brand-assets";
import { db } from "@/lib/db";
import { STATUS_DISPLAY } from "@/lib/post-status";
import { describeRenderIssues } from "@/lib/render-issues";

export const metadata: Metadata = { title: "Revisar · RAdev Social" };

// The review queue (phase 4, T7): one post at a time, of every brand, for approving from the
// phone in under a minute (docs/PRD.md). The closest planned time first (packages/core).
export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const query = await searchParams;
  const wanted = typeof query.post === "string" ? query.post : undefined;
  const done = typeof query.listo === "string" ? query.listo : undefined;
  const now = new Date();

  const queue = sortReviewQueue(
    (await listPostsInReview(db)).map((entry) => ({
      ...entry,
      scheduledAt: entry.post.scheduledAt,
      updatedAt: entry.post.updatedAt,
      number: entry.post.number,
    })),
  );
  const position = Math.max(
    0,
    queue.findIndex((entry) => entry.post.publicCode === wanted),
  );
  const entry = queue[position];
  // A link from Telegram to a post that is no longer waiting (approved from the computer…).
  const gone = wanted && entry?.post.publicCode !== wanted ? await leftQueue(wanted) : null;
  const outcome = done ? await doneNotice(done) : null;

  return (
    <section aria-labelledby="review-heading" className="flex flex-col gap-5">
      <Plate
        as="h1"
        id="review-heading"
        aside={queue.length > 0 ? `${position + 1} de ${queue.length}` : undefined}
      >
        Revisar
      </Plate>

      {outcome && (
        <p role="status" className="border-l border-tally-green pl-3 text-sm text-ink">
          {outcome}
        </p>
      )}
      {gone && (
        <p className="border-l border-bezel-strong pl-3 text-sm text-ink-dim">
          {gone.code} ya no está en revisión ({gone.status}).{" "}
          <Link href={`/posts/${gone.code}`} className="text-ink underline underline-offset-2">
            Abrirlo
          </Link>
        </p>
      )}

      {!entry ? (
        <div className="rounded-md border border-dashed border-bezel px-5 py-10">
          <p className="text-base text-ink">Nada para revisar.</p>
          <p className="mt-1 text-sm text-ink-dim">
            Cuando la IA termine un post te avisa por Telegram. Mientras, mirá el{" "}
            <Link href="/calendar" className="underline underline-offset-2">
              calendario
            </Link>
            .
          </p>
        </div>
      ) : (
        <ReviewItem
          entry={entry}
          now={now}
          previous={queue[position - 1]?.post.publicCode}
          next={queue[position + 1]?.post.publicCode}
        />
      )}
    </section>
  );
}

type Entry = Awaited<ReturnType<typeof listPostsInReview>>[number];

async function ReviewItem({
  entry,
  now,
  previous,
  next,
}: {
  entry: Entry;
  now: Date;
  previous?: string;
  next?: string;
}) {
  const { post, brand, version } = entry;
  const rendered = version ? await listVersionAssets(db, version.id) : [];
  const content = carouselSchema.safeParse(version?.content);
  const complete = content.success && rendered.length === content.data.slides.length;
  const issues = describeRenderIssues(version?.renderIssues);
  const planned = plannedTimeOnApprove(post.scheduledAt, now);
  const approveHint = planned.schedule
    ? `Al aprobarlo se programa para el ${shortDateTime(planned.at, brand.timezone)}.`
    : planned.clear
      ? "Su hora planeada ya pasó: queda aprobado sin programar."
      : "Queda aprobado sin programar.";

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="callsign">{post.publicCode}</span>
          <span className="plate-text text-ink-dim">{brand.name}</span>
          {post.scheduledAt && (
            <Tally state={planned.schedule ? "cued" : "live"}>
              {planned.schedule ? "Para el " : "Era para el "}
              {shortDateTime(post.scheduledAt, brand.timezone)}
            </Tally>
          )}
        </div>
        <h2 className="text-xl leading-snug font-semibold tracking-[-0.015em] text-ink sm:text-2xl">
          {content.success ? content.data.hook : "Contenido inválido"}
        </h2>
        {post.rejectionFeedback && (
          <p className="text-sm text-ink-dim">
            <span className="text-ink-faint">Pediste:</span> {post.rejectionFeedback}
          </p>
        )}
      </div>

      {issues.length > 0 && (
        <div role="alert" className="flex flex-col gap-1 border-l border-tally-red pl-3 text-sm">
          <span className="text-ink">El render encontró problemas:</span>
          <ul className="list-disc pl-5 text-ink-dim">
            {issues.map((issue) => (
              <li key={`${issue.slide}-${issue.text}`}>
                {issue.slide >= 0 ? `Slide ${issue.slide + 1}: ` : ""}
                {issue.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {complete && content.success ? (
        <RenderedStrip
          layout="swipe"
          slides={rendered.map((asset) => ({
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
      ) : (
        <p role="alert" className="text-sm text-ink">
          Faltan imágenes de este post:{" "}
          <Link href={`/posts/${post.publicCode}`} className="underline underline-offset-2">
            abrilo
          </Link>{" "}
          y reintentá el render.
        </p>
      )}

      {content.success && (
        <details className="group rounded-md border border-bezel">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="plate-text text-ink-faint">Descripción y hashtags</span>
            <span className="text-ink-faint group-open:rotate-90" aria-hidden="true">
              ›
            </span>
          </summary>
          <div className="flex flex-col gap-3 px-4 pb-4 text-sm leading-relaxed">
            <p className="whitespace-pre-line text-ink">{content.data.caption}</p>
            <p className="text-ink-dim">{content.data.hashtags.map((t) => `#${t}`).join(" ")}</p>
          </div>
        </details>
      )}

      <nav aria-label="Otros posts de la cola" className="flex items-center justify-between gap-3">
        {previous ? (
          <Link href={`/review?post=${previous}`} className="console-button">
            ← Anterior
          </Link>
        ) : (
          <span />
        )}
        <Link
          href={`/posts/${post.publicCode}`}
          className="plate-text text-ink-faint hover:text-ink"
        >
          Ver todo el post
        </Link>
        {next ? (
          <Link href={`/review?post=${next}`} className="console-button">
            Siguiente →
          </Link>
        ) : (
          <span />
        )}
      </nav>

      {/* Room for the fixed action bar over the dock (phone). */}
      <div className="h-20 md:hidden" aria-hidden="true" />

      {version && (
        <ReviewBar
          key={version.id}
          code={post.publicCode}
          versionId={version.id}
          approveHint={approveHint}
          canApprove={complete}
          canReject={
            post.generationRequest !== null && availableEvents(post.status).includes("reject")
          }
          edit={
            content.success && availableEvents(post.status).includes("edit")
              ? {
                  post: postTexts(content.data),
                  slides: slideTexts(content.data),
                  hashtags: content.data.hashtags.map((t) => `#${t}`).join(" "),
                }
              : null
          }
        />
      )}
    </>
  );
}

/** A post asked for by code that is not in the queue anymore. */
async function leftQueue(code: string): Promise<{ code: string; status: string } | null> {
  const post = await getPostByCode(db, code);
  return post ? { code: post.publicCode, status: STATUS_DISPLAY[post.status].label } : null;
}

/** What became of the post just approved, rejected or edited from the queue. */
async function doneNotice(code: string): Promise<string | null> {
  const post = await getPostByCode(db, code);
  if (!post) return null;
  const brand = await getBrandById(db, post.brandId);
  const zone = brand?.timezone ?? "UTC";
  switch (post.status) {
    case "scheduled":
      return post.scheduledAt
        ? `${code} aprobado y programado para el ${shortDateTime(post.scheduledAt, zone)}.`
        : `${code} aprobado y programado.`;
    case "approved":
      return `${code} aprobado. No tiene hora: programalo desde el calendario.`;
    case "generating":
      return `${code} rechazado: la IA escribe otra versión y vuelve a la cola.`;
    case "rendering":
      return `${code} guardado: se renderiza de nuevo y vuelve a la cola.`;
    case "archived":
      return `${code} descartado.`;
    default:
      return null;
  }
}

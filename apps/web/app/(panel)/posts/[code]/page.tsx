import { availableEvents } from "@radev/core";
import { getBrandById, getPostByCode, getPostVersion } from "@radev/db";
import { carouselSchema } from "@radev/slides";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plate } from "@/components/console/plate";
import { Tally } from "@/components/console/tally";
import { PostStrip } from "@/components/posts/post-strip";
import { brandRenderContext } from "@/lib/carousel";
import { db } from "@/lib/db";
import { STATUS_DISPLAY } from "@/lib/post-status";
import { formatDateTime } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/posts/[code]">): Promise<Metadata> {
  return { title: `${(await params).code} · RAdev Social` };
}

// One post: its status, its current version and what can be done with it.
export default async function PostPage({ params }: PageProps<"/posts/[code]">) {
  const post = await getPostByCode(db, (await params).code);
  if (!post) notFound();
  const [brand, version] = await Promise.all([
    getBrandById(db, post.brandId),
    post.currentVersionId ? getPostVersion(db, post.currentVersionId) : undefined,
  ]);
  if (!brand) notFound();
  const render = await brandRenderContext(brand);
  const content = version ? carouselSchema.safeParse(version.content) : undefined;
  const display = STATUS_DISPLAY[post.status];
  const canEdit = availableEvents(post.status).includes("edit");

  return (
    <>
      <section aria-labelledby="post-heading" className="flex flex-col gap-6">
        <Link href="/posts" className="plate-text w-fit text-ink-faint hover:text-ink">
          ← Posts
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <span className="callsign">{post.publicCode}</span>
          <h1 id="post-heading" className="text-2xl font-semibold tracking-[-0.02em] text-ink">
            {content?.success ? content.data.hook : "Post"}
          </h1>
          <Tally state={display.tally}>{display.label}</Tally>
        </div>
        <p className="timecode text-xs text-ink-faint">
          {brand.name} · versión {version?.number ?? "—"} ·{" "}
          {formatDateTime(post.updatedAt, brand.timezone)}
        </p>
        {canEdit && (
          <div>
            <Link href={`/posts/${post.publicCode}/edit`} className="console-button">
              Editar
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="slides-heading" className="flex flex-col gap-6">
        <Plate id="slides-heading">Slides</Plate>
        {render.ok && content?.success ? (
          <PostStrip
            carousel={content.data}
            theme={render.theme}
            assets={render.assets}
            brandName={brand.name}
          />
        ) : (
          <p className="text-sm text-ink-dim">No se pudo dibujar la versión actual.</p>
        )}
      </section>
    </>
  );
}

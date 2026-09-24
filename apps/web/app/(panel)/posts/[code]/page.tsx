import { availableEvents } from "@radev/core";
import { getBrandById, getPostByCode, listPostVersions } from "@radev/db";
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
import { restoreVersionAction } from "../actions";

export async function generateMetadata({ params }: PageProps<"/posts/[code]">): Promise<Metadata> {
  return { title: `${(await params).code} · RAdev Social` };
}

// One post: its status, its current version and what can be done with it.
export default async function PostPage({ params, searchParams }: PageProps<"/posts/[code]">) {
  const post = await getPostByCode(db, (await params).code);
  if (!post) notFound();
  const [brand, versions, query] = await Promise.all([
    getBrandById(db, post.brandId),
    listPostVersions(db, post.id),
    searchParams,
  ]);
  if (!brand) notFound();
  const current = versions.find((v) => v.id === post.currentVersionId);
  // ?v=<number> shows an older version; by default, the current one.
  const version = versions.find((v) => String(v.number) === query.v) ?? current;
  const viewingOld = version !== undefined && version.id !== current?.id;
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
        <Plate
          id="slides-heading"
          aside={viewingOld ? `Versión ${version?.number} (no es la actual)` : undefined}
        >
          Slides
        </Plate>
        {render.ok && content?.success ? (
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

      <section aria-labelledby="versions-heading" className="flex flex-col gap-6">
        <Plate id="versions-heading" aside={`${versions.length}`}>
          Versiones
        </Plate>
        <ul className="flex flex-col divide-y divide-bezel rounded-md border border-bezel">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-3 text-sm text-ink">
                <span className="timecode">v{v.number}</span>
                <span className="text-ink-dim">
                  {v.origin === "ai" ? "IA" : "Editor"} ·{" "}
                  {formatDateTime(v.createdAt, brand.timezone)}
                </span>
                {v.id === current?.id && <Tally state="ready">Actual</Tally>}
              </span>
              <span className="flex items-center gap-2">
                {v.id !== version?.id && (
                  <Link href={`/posts/${post.publicCode}?v=${v.number}`} className="console-button">
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
          Restaurar crea una versión nueva con ese contenido: no se pierde ninguna, y el post vuelve
          a render y revisión.
        </p>
      </section>
    </>
  );
}

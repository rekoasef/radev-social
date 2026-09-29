import type { PostArt } from "@radev/core";
import { availableEvents } from "@radev/core";
import { getBrandById, getPostByCode, getPostVersion, listPillars } from "@radev/db";
import { carouselSchema } from "@radev/slides";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plate } from "@/components/console/plate";
import { CarouselEditor, type EditorArt } from "@/components/posts/carousel-editor";
import { mediaUrl } from "@/lib/brand-assets";
import { brandRenderContext, editorData } from "@/lib/carousel";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Editar post · RAdev Social" };

export default async function EditPostPage({ params }: PageProps<"/posts/[code]/edit">) {
  const { code } = await params;
  const post = await getPostByCode(db, code);
  if (!post?.currentVersionId) notFound();
  const [brand, version] = await Promise.all([
    getBrandById(db, post.brandId),
    getPostVersion(db, post.currentVersionId),
  ]);
  if (!brand || !version) notFound();
  const [render, pillars, data] = await Promise.all([
    brandRenderContext(brand),
    listPillars(db, brand.id),
    editorData(brand.id, version.datasets),
  ]);
  const content = carouselSchema.safeParse(version.content);
  const editable = availableEvents(post.status).includes("edit");

  return (
    <section aria-labelledby="edit-post-heading" className="flex flex-col gap-6">
      <Link
        href={`/posts/${post.publicCode}`}
        className="plate-text w-fit text-ink-faint hover:text-ink"
      >
        ← {post.publicCode}
      </Link>
      <Plate as="h1" id="edit-post-heading" aside={`${brand.name} · versión ${version.number}`}>
        Editar {post.publicCode}
      </Plate>
      {!editable ? (
        <p role="alert" className="text-sm text-ink">
          Este post no se puede editar en su estado actual.
        </p>
      ) : !render.ok || !content.success ? (
        <p role="alert" className="text-sm text-ink">
          No se puede abrir en el editor:{" "}
          {render.ok ? "el contenido guardado no es válido." : "la identidad visual tiene errores."}
        </p>
      ) : (
        <CarouselEditor
          brand={{ id: brand.id, slug: brand.slug, name: brand.name }}
          theme={render.theme}
          assets={render.assets}
          pillars={pillars.map((p) => ({ key: p.key, name: p.name }))}
          initial={content.data}
          post={{ code: post.publicCode, version: version.number }}
          seed={post.id}
          data={data}
          art={editorArt(version.art)}
        />
      )}
    </section>
  );
}

/** The version's images for the editor's preview, with the state of their generation. */
function editorArt(art: PostArt | null): EditorArt | undefined {
  if (!art) return undefined;
  return {
    status: art.status,
    note: art.note,
    urls: {
      ...(art.images.cover && { cover: mediaUrl(art.images.cover.path) }),
      ...(art.images.cta && { cta: mediaUrl(art.images.cta.path) }),
    },
  };
}

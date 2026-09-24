import { canExport, exportImageName, exportText } from "@radev/core";
import { getPostByCode, getPostVersion, listVersionAssets, readMediaFile } from "@radev/db";
import { carouselSchema } from "@radev/slides";
import { type Zippable, zipSync } from "fflate";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";

// The carousel to publish by hand (docs/PRD.md RF-29): the PNGs of the current version in slide
// order plus a text file with title and description. Only for approved posts (rule 3).

const refuse = (message: string, status = 409) =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(_request: Request, { params }: RouteContext<"/posts/[code]/download">) {
  await requireOperator();
  const post = await getPostByCode(db, (await params).code);
  if (!post?.currentVersionId) return refuse("Ese post no existe.", 404);
  const [version, rendered] = await Promise.all([
    getPostVersion(db, post.currentVersionId),
    listVersionAssets(db, post.currentVersionId),
  ]);
  const content = carouselSchema.safeParse(version?.content);
  if (!content.success) return refuse("La versión actual no cumple el formato.");
  const check = canExport({
    status: post.status,
    slideCount: content.data.slides.length,
    renderedSlides: rendered.map((asset) => asset.slideIndex),
  });
  if (!check.ok) return refuse(check.reason);

  const files: Zippable = {};
  for (const asset of rendered) {
    if (asset.slideIndex >= content.data.slides.length) continue;
    const file = await readMediaFile(asset.path);
    if (!file) return refuse(`Falta el archivo de la slide ${asset.slideIndex + 1}.`);
    // PNGs are already compressed: stored as they are.
    files[exportImageName(post.publicCode, asset.slideIndex)] = [
      new Uint8Array(file),
      { level: 0 },
    ];
  }
  files["texto.txt"] = new TextEncoder().encode(exportText(content.data));

  return new Response(zipSync(files), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${post.publicCode}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { readMediaFile } from "@radev/db";
import { videoMediaResponse } from "@/lib/video-media";

// Files in MEDIA_DIR (brand assets; rendered slides from phase 2). Public and read-only, like
// the media subdomain in production: paths are unguessable ids, and /render pages load them
// without a session. readMediaFile rejects anything outside MEDIA_DIR. The files under videos/ go
// another way (lib/video-media).

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

const notFound = () => new Response("No encontrado", { status: 404 });

export async function GET(request: Request, { params }: RouteContext<"/media/[...path]">) {
  const relativePath = (await params).path.join("/");
  if (relativePath.startsWith("videos/")) {
    return (await videoMediaResponse(request, relativePath)) ?? notFound();
  }
  const contentType = CONTENT_TYPES[relativePath.slice(relativePath.lastIndexOf(".") + 1)];
  if (!contentType) return notFound();

  const file = await readMediaFile(relativePath);
  if (!file) return notFound();

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": contentType,
      // A replaced file gets a new path, so a path's content never changes.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // An SVG opened directly is a document: no scripts, no requests, no forms.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

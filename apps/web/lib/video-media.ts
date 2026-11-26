import { readMediaChunks, statMediaFile } from "@radev/db";
import { byteStream } from "./byte-stream";
import { parseRange } from "./http-range";

// The files of a video (`media/videos/<id>/…`). Unlike the rest of MEDIA_DIR they can be big (the
// MP4s) and a redone office writes over the same path: they are sent in chunks, with `Range` so the
// player can seek, and the browser checks them again instead of keeping them forever.

const CONTENT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  jpg: "image/jpeg",
  png: "image/png",
};

export async function videoMediaResponse(
  request: Request,
  relativePath: string,
): Promise<Response | undefined> {
  const contentType = CONTENT_TYPES[relativePath.slice(relativePath.lastIndexOf(".") + 1)];
  if (!contentType) return undefined;
  const info = await statMediaFile(relativePath);
  if (!info) return undefined;

  const etag = `"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
  const headers = new Headers({
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  });
  if (request.headers.get("If-None-Match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  // `If-Range` with an old tag: the file changed, so a piece of it would not fit what the browser
  // already has. It gets the whole new file.
  const ifRange = request.headers.get("If-Range");
  const range =
    ifRange && ifRange !== etag ? "full" : parseRange(request.headers.get("Range"), info.size);

  if (range === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${info.size}`);
    return new Response(null, { status: 416, headers });
  }
  const { start, end } = range === "full" ? { start: 0, end: info.size - 1 } : range;
  headers.set("Content-Length", String(end - start + 1));
  if (range !== "full") headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);

  return new Response(
    request.method === "HEAD" ? null : byteStream(readMediaChunks(relativePath, { start, end })),
    { status: range === "full" ? 200 : 206, headers },
  );
}

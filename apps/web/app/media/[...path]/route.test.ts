import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeMediaFile } from "@radev/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET } from "./route";

const VIDEO = "videos/abc/render/video-9x16.mp4";
let dir: string;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "media-route-"));
  process.env.MEDIA_DIR = dir;
  await writeMediaFile("lumus/brand/logo.png", new Uint8Array([1, 2, 3, 4]));
  await writeMediaFile("lumus/brand/logo.svg", new TextEncoder().encode("<svg/>"));
  await writeMediaFile("lumus/brand/notes.txt", new Uint8Array([1]));
  await writeMediaFile(VIDEO, new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const get = (path: string, headers?: Record<string, string>) =>
  GET(new Request(`http://localhost/media/${path}`, { headers }), {
    params: Promise.resolve({ path: path.split("/") }),
  });

const bytes = async (response: Response) => [...new Uint8Array(await response.arrayBuffer())];

describe("GET /media: images", () => {
  it("serves the whole file, cached forever", async () => {
    const response = await get("lumus/brand/logo.png");
    expect(response.status).toBe(200);
    expect(await bytes(response)).toEqual([1, 2, 3, 4]);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
  });

  it("serves an SVG with its type", async () => {
    const response = await get("lumus/brand/logo.svg");
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
  });

  it.each(["lumus/brand/missing.png", "lumus/brand/notes.txt", "lumus/../secret.png"])(
    "answers 404 for %s",
    async (path) => {
      expect((await get(path)).status).toBe(404);
    },
  );
});

describe("GET /media: video files", () => {
  it("serves the whole file, saying it accepts ranges", async () => {
    const response = await get(VIDEO);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("video/mp4");
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("Content-Length")).toBe("10");
    // A redone render writes over the same path: never "immutable".
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(await bytes(response)).toHaveLength(10);
  });

  it("serves a piece with 206", async () => {
    const response = await get(VIDEO, { Range: "bytes=2-4" });
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 2-4/10");
    expect(response.headers.get("Content-Length")).toBe("3");
    expect(await bytes(response)).toEqual([2, 3, 4]);
  });

  it("answers 416 past the end", async () => {
    const response = await get(VIDEO, { Range: "bytes=50-" });
    expect(response.status).toBe(416);
    expect(response.headers.get("Content-Range")).toBe("bytes */10");
  });

  it("answers 304 when the browser already has this version", async () => {
    const etag = (await get(VIDEO)).headers.get("ETag") ?? "";
    expect((await get(VIDEO, { "If-None-Match": etag })).status).toBe(304);
    expect((await get(VIDEO, { Range: "bytes=2-", "If-Range": etag })).status).toBe(206);
  });

  it("sends the whole file when the piece asked for belongs to an older version", async () => {
    const response = await get(VIDEO, { Range: "bytes=2-", "If-Range": '"old"' });
    expect(response.status).toBe(200);
    expect(await bytes(response)).toHaveLength(10);
  });

  it("answers 404 for a missing video or a file type that is not served", async () => {
    expect((await get("videos/abc/render/none.mp4")).status).toBe(404);
    expect((await get("videos/abc/package/creditos.txt")).status).toBe(404);
  });
});

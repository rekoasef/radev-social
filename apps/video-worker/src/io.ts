import { spawn } from "node:child_process";
import { imageSize } from "image-size";

// The real I/O of the offices, apart so the offices stay testable: downloading a page, shrinking an
// image with ffmpeg and measuring one.

const PAGE_TIMEOUT_MS = 20_000;

/** The HTML of a page, as a browser-like client (some sites refuse unknown agents). */
export async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; source-check)" },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

/** A 640 px wide JPEG copy (the AI looks at these without spending tokens on the big ones). */
export function shrinkImage(bytes: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      "ffmpeg",
      [
        "-v",
        "error",
        "-i",
        "pipe:0",
        "-vf",
        "scale='min(640,iw)':-2",
        "-q:v",
        "4",
        "-f",
        "mjpeg",
        "pipe:1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    ffmpeg.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    ffmpeg.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    ffmpeg.on("error", (error) => reject(new Error(`No se pudo correr ffmpeg: ${error.message}`)));
    ffmpeg.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(out))
        : reject(
            new Error(`ffmpeg terminó con ${code}: ${Buffer.concat(err).toString().slice(0, 300)}`),
          ),
    );
    ffmpeg.stdin.on("error", () => {}); // ffmpeg may close the pipe early; the exit code tells
    ffmpeg.stdin.end(bytes);
  });
}

export function sizeOf(bytes: Uint8Array): { width: number; height: number } | undefined {
  try {
    const { width, height } = imageSize(bytes);
    return width && height ? { width, height } : undefined;
  } catch {
    return undefined;
  }
}

/** The take (MP3) as mono 16-bit PCM at 48 kHz, to cut it by scene. */
export function decodeToPcm(audio: Uint8Array): Promise<Int16Array> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(
      "ffmpeg",
      ["-v", "error", "-i", "pipe:0", "-ar", "48000", "-ac", "1", "-f", "s16le", "pipe:1"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    ffmpeg.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    ffmpeg.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    ffmpeg.on("error", (error) => reject(new Error(`No se pudo correr ffmpeg: ${error.message}`)));
    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(`ffmpeg terminó con ${code}: ${Buffer.concat(err).toString().slice(0, 300)}`),
        );
        return;
      }
      const bytes = Buffer.concat(out);
      // copy to an aligned buffer: a Buffer slice can start at an odd offset
      const pcm = new Int16Array(bytes.length >> 1);
      for (let i = 0; i < pcm.length; i++) pcm[i] = bytes.readInt16LE(i * 2);
      resolve(pcm);
    });
    ffmpeg.stdin.on("error", () => {});
    ffmpeg.stdin.end(audio);
  });
}

// V0-2: renderiza la voz elegida con subtítulos palabra por palabra.
// Uso: pnpm --filter @radev/spike-video-v0 captions [--voice kokoro-em_alex-419]
// Lee out/tts/samples/<voz>.wav y <voz>.words.json (de tts/align.py); deja out/captions-<voz>.mp4.
import { readFileSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const root = path.resolve(import.meta.dirname, "..");
const samples = path.join(root, "out", "tts", "samples");
const i = process.argv.indexOf("--voice");
const voice = i > 0 ? (process.argv[i + 1] ?? "") : "kokoro-em_alex-419";

const words = JSON.parse(readFileSync(path.join(samples, `${voice}.words.json`), "utf8")) as {
  word: string;
  start: number;
  end: number;
}[];
// Duración real del WAV (cabecera RIFF: bytes por segundo en el offset 28, datos al final).
const wav = readFileSync(path.join(samples, `${voice}.wav`));
const seconds = (wav.length - 44) / wav.readUInt32LE(28) + 0.5;

const serveUrl = await bundle({
  entryPoint: path.join(root, "src", "index.ts"),
  publicDir: samples,
});
const inputProps = { audio: `${voice}.wav`, words, seconds };
const composition = await selectComposition({ serveUrl, id: "captions", inputProps });
const output = path.join(root, "out", `captions-${voice}.mp4`);
const t0 = performance.now();
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  outputLocation: output,
  inputProps,
  concurrency: 4,
});
console.log(
  `${output} (${seconds.toFixed(1)} s de video, render ${((performance.now() - t0) / 1000).toFixed(1)} s)`,
);

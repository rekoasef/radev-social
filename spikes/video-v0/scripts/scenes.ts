// V0-3: render por escena + armado con FFmpeg.
// Uso: python3 tts/scenes.py [texts/...json] && pnpm --filter @radev/spike-video-v0 scenes [--tag full]
// Lee out/v0-3/manifest.json. Por escena renderiza dos clips, con caché por hash de sus props:
//   A: mudo (la voz se arma aparte en PCM)   B: con su voz adentro (AAC de Remotion)
// Arma A = concat -c copy del video + voces en PCM + música de prueba con ducking + loudnorm + mux
//      B = concat -c copy de los clips con audio
// Mide tiempos, continuidad de cuadros, desfase audio/video al final y en cada unión.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, selectComposition } from "@remotion/renderer";

type Word = { word: string; start: number; end: number };
type Scene = { index: number; key: string; frames: number; text: string };
type Manifest = { source: string; voice: string; fps: number; rate: number; scenes: Scene[] };

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "out", "v0-3");
const audioDir = path.join(out, "audio");
const clipsDir = path.join(out, "clips");
const t = process.argv.indexOf("--tag");
const tag = t > 0 ? (process.argv[t + 1] ?? "full") : "full";
const dir = path.join(out, tag);
mkdirSync(clipsDir, { recursive: true });
mkdirSync(dir, { recursive: true });

const manifest = JSON.parse(readFileSync(path.join(out, "manifest.json"), "utf8")) as Manifest;
const { fps, rate, scenes } = manifest;
const BG = ["#16181F", "#1F1420", "#13201C", "#221A12", "#141B26", "#201616"];
// Cambiarlo si cambia el componente o los parámetros de render: invalida la caché de clips.
const RENDER_VERSION = "scene-v1";

const since = (t0: number) => Number(((performance.now() - t0) / 1000).toFixed(2));
const ff = (args: string[]) =>
  execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { maxBuffer: 1 << 30 });
const concatList = (files: string[], name: string) => {
  const p = path.join(dir, name);
  writeFileSync(p, `${files.map((f) => `file '${f}'`).join("\n")}\n`);
  return p;
};
const words = (s: Scene) =>
  JSON.parse(readFileSync(path.join(audioDir, `${s.key}.words.json`), "utf8")) as Word[];

// ---------- 1. Clips por escena ----------
let t0 = performance.now();
const serveUrl = await bundle({
  entryPoint: path.join(root, "src", "index.ts"),
  publicDir: audioDir,
});
const bundleSeconds = since(t0);
const browser = await openBrowser("chrome");
const renders: { scene: number; variant: string; cached: boolean; seconds: number }[] = [];
const clips: Record<"a" | "b", string[]> = { a: [], b: [] };
for (const s of scenes) {
  for (const variant of ["a", "b"] as const) {
    const inputProps = {
      audio: variant === "b" ? `${s.key}.wav` : "",
      words: words(s),
      frames: s.frames,
      bg: BG[s.index % BG.length] ?? "#000",
      label: `escena ${s.index + 1}`,
    };
    const key = createHash("sha256")
      .update(JSON.stringify({ RENDER_VERSION, variant, inputProps }))
      .digest("hex")
      .slice(0, 16);
    const file = path.join(clipsDir, `${variant}-${key}.mp4`);
    clips[variant].push(file);
    if (existsSync(file)) {
      renders.push({ scene: s.index + 1, variant, cached: true, seconds: 0 });
      continue;
    }
    const t1 = performance.now();
    const composition = await selectComposition({
      serveUrl,
      id: "scene",
      inputProps,
      puppeteerInstance: browser,
    });
    // Se escribe con otro nombre y se renombra al final: un render cortado no queda en la caché.
    const part = `${file}.part.mp4`;
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: part,
      inputProps,
      concurrency: 4,
      muted: variant === "a",
      puppeteerInstance: browser,
    });
    renameSync(part, file);
    renders.push({ scene: s.index + 1, variant, cached: false, seconds: since(t1) });
    console.log(`escena ${s.index + 1} ${variant}: ${s.frames} cuadros en ${since(t1)} s`);
  }
}
await browser.close({ silent: true });

// ---------- 2. Armado ----------
const totalFrames = scenes.reduce((n, s) => n + s.frames, 0);
const duration = totalFrames / fps;
const finalA = path.join(dir, "final-a.mp4");
const finalB = path.join(dir, "final-b.mp4");
const voice = path.join(dir, "voice.wav");

t0 = performance.now();
const videoA = path.join(dir, "a-video.mp4");
ff(["-f", "concat", "-safe", "0", "-i", concatList(clips.a, "a.txt"), "-c", "copy", videoA]);
const wavs = scenes.map((s) => path.join(audioDir, `${s.key}.wav`));
ff(["-f", "concat", "-safe", "0", "-i", concatList(wavs, "voice.txt"), "-c", "copy", voice]);
// Música de prueba: acorde con trémolo + un golpe grave cada medio segundo (para oír el ducking).
const music = path.join(dir, "music.wav");
const expr =
  "0.12*sin(2*PI*220*t)*(0.6+0.4*sin(2*PI*0.25*t))+0.09*sin(2*PI*277.18*t)" +
  "+0.09*sin(2*PI*329.63*t)+0.35*sin(2*PI*55*t)*exp(-12*mod(t,0.5))";
ff(["-f", "lavfi", "-i", `aevalsrc='${expr}':s=${rate}:d=${duration}`, music]);
// La voz entra dos veces: como señal y como "llave" del compresor que baja la música (ducking).
const graph = [
  "[1:a]asplit=2[key][vo]",
  "[2:a][key]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=350[duck]",
  "[duck][vo]amix=inputs=2:duration=first:normalize=0," +
    `loudnorm=I=-14:TP=-1.5:LRA=11,aresample=${rate},aformat=channel_layouts=stereo[mix]`,
].join(";");
ff([
  ...["-i", videoA, "-i", voice, "-i", music, "-filter_complex", graph],
  ...["-map", "0:v", "-map", "[mix]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k"],
  // AAC va en paquetes de 1024 muestras: sin -t, el último paquete alarga el audio hasta ~2 cuadros.
  ...["-t", String(duration), finalA],
]);
const assembleA = since(t0);

t0 = performance.now();
ff(["-f", "concat", "-safe", "0", "-i", concatList(clips.b, "b.txt"), "-c", "copy", finalB]);
const assembleB = since(t0);

// ---------- 3. Mediciones ----------
const probeJson = (file: string) =>
  JSON.parse(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "stream=codec_type,duration", "-of", "json", file],
      { encoding: "utf8" },
    ),
  ) as { streams: { codec_type: string; duration: string }[] };

// Cuadros: cuántos hay y si el paso entre uno y otro es siempre 1/fps (sin saltos ni repetidos).
const frameCheck = (file: string) => {
  const pts = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v",
      "-show_entries",
      "packet=pts_time",
      "-of",
      "csv=p=0",
      file,
    ],
    { encoding: "utf8", maxBuffer: 1 << 26 },
  )
    .trim()
    .split("\n")
    .map(Number)
    .sort((x, y) => x - y);
  const bad = pts.slice(1).filter((p, i) => Math.abs(p - (pts[i] ?? 0) - 1 / fps) > 1e-3).length;
  return { frames: pts.length, expected: totalFrames, irregularSteps: bad };
};

const decode = (file: string) => {
  const raw = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-map", "a:0", "-ac", "1", "-ar", String(rate), "-f", "f32le", "-"],
    { maxBuffer: 1 << 30 },
  );
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
};

// Desfase de la voz en cada escena: correlación de 0,25 s de voz de referencia contra el audio
// final, buscando en ±40 ms. 0 ms = la voz está exactamente donde debe.
const ref = decode(voice);
const sceneOffsets = (file: string) => {
  const got = decode(file);
  const win = Math.round(0.25 * rate);
  const maxLag = Math.round(0.04 * rate);
  let start = 0;
  return scenes.map((s) => {
    const at = start + Math.round(((words(s)[0]?.start ?? 0) + 0.05) * rate);
    start += s.frames * (rate / fps);
    let best = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let lag = -maxLag; lag <= maxLag; lag++) {
      let dot = 0;
      let energy = 0;
      for (let i = 0; i < win; i++) {
        const g = got[at + lag + i] ?? 0;
        dot += (ref[at + i] ?? 0) * g;
        energy += g * g;
      }
      const score = dot / Math.sqrt(energy || 1);
      if (score > bestScore) {
        bestScore = score;
        best = lag;
      }
    }
    return Number(((best / rate) * 1000).toFixed(2));
  });
};

const loudness = (file: string) => {
  const r = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", file, "-af", "loudnorm=print_format=json", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const m = /\{[\s\S]*\}/.exec(r.stderr)?.[0];
  const j = m ? (JSON.parse(m) as { input_i: string; input_tp: string }) : null;
  return j ? { lufs: Number(j.input_i), truePeak: Number(j.input_tp) } : null;
};

const measure = (file: string) => {
  const streams = probeJson(file).streams;
  const v = Number(streams.find((s) => s.codec_type === "video")?.duration);
  const a = Number(streams.find((s) => s.codec_type === "audio")?.duration);
  return {
    videoSeconds: v,
    audioSeconds: a,
    endDriftMs: Number(((a - v) * 1000).toFixed(1)),
    endDriftFrames: Number(((a - v) * fps).toFixed(2)),
    ...frameCheck(file),
    sceneOffsetsMs: sceneOffsets(file),
    loudness: loudness(file),
  };
};

const fresh = renders.filter((r) => !r.cached);
const results = {
  tag,
  source: manifest.source,
  voice: manifest.voice,
  scenes: scenes.length,
  totalFrames,
  seconds: Number(duration.toFixed(2)),
  bundleSeconds,
  renderedClips: fresh.length,
  cachedClips: renders.length - fresh.length,
  renderSecondsA: Number(
    fresh
      .filter((r) => r.variant === "a")
      .reduce((n, r) => n + r.seconds, 0)
      .toFixed(2),
  ),
  renderSecondsB: Number(
    fresh
      .filter((r) => r.variant === "b")
      .reduce((n, r) => n + r.seconds, 0)
      .toFixed(2),
  ),
  renders,
  assembleSecondsA: assembleA,
  assembleSecondsB: assembleB,
  a: measure(finalA),
  b: measure(finalB),
};
writeFileSync(path.join(dir, "results.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify({ ...results, renders: undefined }, null, 1));

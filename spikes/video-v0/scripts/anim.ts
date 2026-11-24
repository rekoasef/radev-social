// Video animado guionado (V0-6 redefinida): renderiza el guion de src/anim/guion.ts con la voz
// de V0-3 (Fran a 1,1; out/v0-3/audio). Uso:
//   pnpm --filter @radev/spike-video-v0 anim [--stills 0:1.5,0:6,1:1] [--only 0] [--concurrency 2]
//     [--guion out/v0-11/<archivo>.json --voices <carpeta> --name <nombre>]   (un guion generado)
// Deja out/anim/anim.mp4 (o anim-<escena>.mp4) y, con --stills, cuadros sueltos escena:segundo.
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { guion as handWritten, sceneFrames } from "../src/anim/guion";
import { normalizeGuion } from "../src/anim/quality";
import { guionLargoSchema, toRenderGuion } from "../src/anim/schema";

const root = path.resolve(import.meta.dirname, "..");
// --voices: otra carpeta con manifest.json y audio/ (por ejemplo out/v0-3/x1.3, de tts/tempo.py).
const voicesArg = process.argv.indexOf("--voices");
// Por defecto, la voz elegida por el operador: speed 1,3 (toma a 1,2 + atempo, tts/tempo.py).
const v03 =
  voicesArg > 0
    ? path.resolve(process.argv[voicesArg + 1] ?? "")
    : path.join(root, "out", "v0-3", "x1.3");
const out = path.join(root, "out", "anim");
mkdirSync(out, { recursive: true });
const option = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
type Manifest = { fps: number; scenes: { key: string; frames: number }[] };
const manifest = JSON.parse(readFileSync(path.join(v03, "manifest.json"), "utf8")) as Manifest;
const voices = manifest.scenes.map((s) => ({
  audio: `${s.key}.wav`,
  words: JSON.parse(readFileSync(path.join(v03, "audio", `${s.key}.words.json`), "utf8")),
  frames: s.frames,
}));
const guionFile = option("guion");
// V0-10: el guion pasa por los mismos arreglos que al escribirlo, y no se anima si le faltan
// lugares (`missingPlaces`): primero se dibujan o se cambia el guion. `--allow-missing` lo fuerza.
const draft = guionFile
  ? guionLargoSchema.parse(
      (JSON.parse(readFileSync(path.resolve(guionFile), "utf8")) as { guion: unknown }).guion,
    )
  : undefined;
if (draft?.missingPlaces?.length && !process.argv.includes("--allow-missing")) {
  throw new Error(
    `Faltan lugares por dibujar: ${draft.missingPlaces.map((m) => `${m.place} (escenas ${m.scenes.map((n) => n + 1).join(", ")})`).join("; ")}. Dibujalos o usá --allow-missing.`,
  );
}
const guion = draft ? toRenderGuion(normalizeGuion(draft).guion) : handWritten;
if (guion.length !== voices.length) {
  throw new Error(`El guion tiene ${guion.length} escenas y la voz ${voices.length}`);
}
const only = option("only") === undefined ? undefined : Number(option("only"));
const since = (t0: number) => Number(((performance.now() - t0) / 1000).toFixed(1));

let t0 = performance.now();
const serveUrl = await bundle({
  entryPoint: path.join(root, "src", "index.ts"),
  publicDir: path.join(v03, "audio"),
});
console.log(`bundle: ${since(t0)} s`);
const browser = await openBrowser("chrome", {
  chromiumOptions: { flags: { "font-render-hinting": false } },
});
const inputProps = { voices, only, ...(guionFile && { script: guion }) };
const composition = await selectComposition({
  serveUrl,
  id: "anim",
  inputProps,
  puppeteerInstance: browser,
});

const stills = option("stills");
if (stills) {
  // escena:segundo → el cuadro de ese momento dentro del video completo.
  const starts = guion.map((_, i) =>
    guion
      .slice(0, i)
      .reduce(
        (sum, s) =>
          sum + (voices[s.voice] ? sceneFrames(s, voices[s.voice] as (typeof voices)[number]) : 0),
        0,
      ),
  );
  for (const spec of stills.split(",")) {
    const [scene, second] = spec.split(":").map(Number);
    const frame = (starts[scene ?? 0] ?? 0) + Math.round((second ?? 0) * manifest.fps);
    const file = path.join(out, `still-${scene}-${second}.png`);
    await renderStill({
      composition,
      serveUrl,
      inputProps,
      frame,
      output: file,
      puppeteerInstance: browser,
    });
    console.log(`cuadro ${spec} → ${file}`);
  }
} else {
  const name = option("name") ?? (only === undefined ? "anim" : `anim-${only}`);
  const file = path.join(out, `${name}.mp4`);
  t0 = performance.now();
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: file,
    inputProps,
    concurrency: Number(option("concurrency") ?? 2),
    puppeteerInstance: browser,
  });
  const seconds = composition.durationInFrames / composition.fps;
  console.log(`video: ${seconds.toFixed(1)} s en ${since(t0)} s → ${file}`);
}
await browser.close({ silent: true });

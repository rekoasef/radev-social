// V0-5: los looks de @radev/slides dentro de Remotion.
// Uso: pnpm --filter @radev/spike-video-v0 looks <paso> [opciones]
//   compare  [--looks a,b]          cada tipo de slide en cada look, al tamaño del carrusel, contra
//                                    `preview` (lo que usa Social): SSIM con ffmpeg y diferencias.
//   scenes   [--looks a,b]          las slides del clip en 9:16, variantes A y B: una hoja por look.
//   clip     --looks a,b [--variants a,b] [--motion stagger] [--concurrency 2]
//                                    las escenas de V0-3 (voz y subtítulos) con un look, en MP4.
// --hinting-none: Chrome con la opción que Remotion trae por defecto (ver openBrowser abajo).
// Todo queda en out/v0-5/. Usa la paleta de RAdev del seed (looks/radev-tokens.json).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { exampleSlides, LOOK_IDS, type LookId, SLIDE_TYPES, slideSchema } from "@radev/slides";
import { bundle } from "@remotion/bundler";
import {
  openBrowser,
  renderFrames,
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import { clipSlides } from "../src/looks/clip-slides";

const root = path.resolve(import.meta.dirname, "..");
const repo = path.resolve(root, "..", "..");
const out = path.join(root, "out", "v0-5");
const step = process.argv[2] ?? "compare";
const option = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const looks = (option("looks")?.split(",") ?? [...LOOK_IDS]) as LookId[];
const tokensFile = path.join(root, "looks", "radev-tokens.json");
const tokens = JSON.parse(readFileSync(tokensFile, "utf8")) as unknown;
const since = (t0: number) => Number(((performance.now() - t0) / 1000).toFixed(1));
const ff = (args: string[]) =>
  execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { maxBuffer: 1 << 30 });

// Los textos del clip tienen que pasar los mismos límites que un carrusel.
for (const slide of clipSlides) slideSchema.parse(slide);

let t0 = performance.now();
const v03 = path.join(root, "out", "v0-3");
const serveUrl = await bundle({
  entryPoint: path.join(root, "src", "index.ts"),
  publicDir: path.join(v03, "audio"),
});
console.log(`bundle: ${since(t0)} s`);
// Remotion abre Chrome con --font-render-hinting=none; el render de Social (Playwright), no. Con
// esa opción el mismo texto mide distinto y corta en otro lugar: se saca para dibujar igual que
// Social. `--hinting-none` deja la opción de Remotion (para comparar).
const hintingNone = process.argv.includes("--hinting-none");
const browser = await openBrowser("chrome", {
  chromiumOptions: hintingNone ? {} : { flags: { "font-render-hinting": false } },
});
console.log(`font-render-hinting: ${hintingNone ? "none (Remotion)" : "por defecto (Social)"}`);

async function composition(id: string, inputProps: Record<string, unknown>) {
  return selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser });
}

if (step === "compare") {
  // 1. Remotion: un cuadro por tipo de slide, como `preview --set examples`.
  const slides = SLIDE_TYPES.map((type) => exampleSlides[type]);
  const times: number[] = [];
  for (const look of looks) {
    const dir = path.join(out, "remotion", look);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const inputProps = { look, tokens, seed: "preview", brandName: "Marca", slides };
    t0 = performance.now();
    await renderFrames({
      composition: await composition("look-still", inputProps),
      serveUrl,
      inputProps,
      outputDir: dir,
      imageFormat: "png",
      concurrency: 2,
      puppeteerInstance: browser,
      onStart: () => {},
      onFrameUpdate: () => {},
    });
    times.push(since(t0));
    console.log(`remotion ${look}: ${slides.length} slides en ${since(t0)} s`);
  }
  await browser.close({ silent: true });

  // 2. preview (Playwright, el mismo camino que usa el diseño de looks de Social).
  const previewDir = path.join(out, "preview");
  t0 = performance.now();
  const preview = spawnSync(
    "pnpm",
    [
      ...["--filter", "@radev/slides", "preview", previewDir],
      ...["--tokens", tokensFile, "--set", "examples", "--looks", looks.join(",")],
    ],
    { cwd: repo, encoding: "utf8" },
  );
  console.log(`preview: ${since(t0)} s · ${preview.stdout.trim().split("\n").at(-1)}`);

  // 3. SSIM de cada par (1 = idénticas). Las peores, con su imagen de diferencias.
  const rows: { look: string; type: string; ssim: number; quarter: number }[] = [];
  for (const look of looks) {
    const dir = path.join(out, "remotion", look);
    const frames = readdirSync(dir)
      .filter((f) => f.endsWith(".png"))
      .sort();
    frames.forEach((file, i) => {
      const a = path.join(dir, file);
      const b = path.join(previewDir, `${look}-${i + 1}.png`);
      const ssimOf = (filter: string) => {
        const log = spawnSync("ffmpeg", ["-i", a, "-i", b, "-lavfi", filter, "-f", "null", "-"], {
          encoding: "utf8",
        }).stderr;
        return Number(/All:([\d.]+)/.exec(log)?.[1] ?? 0);
      };
      // A tamaño real (cuenta el suavizado de cada letra) y a 1/4 (cuenta dónde está cada cosa).
      const ssim = ssimOf("ssim");
      const quarter = ssimOf(
        "[0]scale=iw/4:-1:flags=area[a];[1]scale=iw/4:-1:flags=area[b];[a][b]ssim",
      );
      rows.push({ look, type: SLIDE_TYPES[i] ?? "?", ssim, quarter });
    });
  }
  rows.sort((x, y) => x.ssim - y.ssim);
  const diffDir = path.join(out, "diff");
  rmSync(diffDir, { recursive: true, force: true });
  mkdirSync(diffDir, { recursive: true });
  for (const r of rows.slice(0, 6)) {
    const i = SLIDE_TYPES.indexOf(r.type as (typeof SLIDE_TYPES)[number]);
    const a = readdirSync(path.join(out, "remotion", r.look))
      .filter((f) => f.endsWith(".png"))
      .sort()[i] as string;
    const pa = path.join(out, "remotion", r.look, a);
    const pb = path.join(previewDir, `${r.look}-${i + 1}.png`);
    // Remotion | preview | diferencia (aumentada) lado a lado, a la mitad.
    ff([
      ...["-i", pa, "-i", pb, "-filter_complex"],
      "[0]format=rgb24[x];[1]format=rgb24[y];[x][y]blend=all_mode=difference,format=gray,eq=contrast=4[d];" +
        "[0]format=rgb24[p];[1]format=rgb24[q];[d]format=rgb24[r];[p][q][r]hstack=3,scale=iw/2:-1",
      path.join(diffDir, `${r.look}-${r.type}.png`),
    ]);
  }
  const n = rows.length;
  const min = rows[0]?.ssim ?? 0;
  const mean = rows.reduce((s, r) => s + r.ssim, 0) / Math.max(n, 1);
  const under = (x: number) => rows.filter((r) => r.ssim < x).length;
  const quarters = rows.map((r) => r.quarter).sort((x, y) => x - y);
  const report = {
    pairs: n,
    ssim: { min, mean: Number(mean.toFixed(5)), under099: under(0.99), under0995: under(0.995) },
    quarter: {
      min: quarters[0],
      mean: Number((quarters.reduce((s, q) => s + q, 0) / Math.max(n, 1)).toFixed(5)),
      under099: quarters.filter((q) => q < 0.99).length,
    },
    worst: rows.slice(0, 10),
    remotionSecondsPerLook: times,
  };
  writeFileSync(path.join(out, "compare.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

if (step === "scenes") {
  // Las 6 slides del clip, cuadro final de la entrada, en A y en B; una hoja por look.
  const dir = path.join(out, "scenes");
  mkdirSync(dir, { recursive: true });
  for (const look of looks) {
    const files: Record<string, string[]> = { a: [], b: [] };
    t0 = performance.now();
    for (const variant of ["a", "b"] as const) {
      for (const [index, slide] of clipSlides.entries()) {
        const inputProps = {
          look,
          tokens,
          seed: "v0-5",
          brandName: "RAdev",
          slide,
          page: { index, total: clipSlides.length },
          variant,
          motion: "none",
        };
        const file = path.join(dir, `${look}-${variant}-${index + 1}.png`);
        await renderStill({
          composition: await composition("look-scene", inputProps),
          serveUrl,
          inputProps,
          output: file,
          frame: 0,
          imageFormat: "png",
          puppeteerInstance: browser,
        });
        files[variant]?.push(file);
      }
    }
    // Hoja: fila A arriba, fila B abajo, a un cuarto del tamaño.
    const all = [...(files.a ?? []), ...(files.b ?? [])];
    const k = clipSlides.length;
    const scaled = all.map((_, i) => `[${i}]scale=360:-1[s${i}]`).join(";");
    const row = (from: number, name: string) =>
      `${Array.from({ length: k }, (_, i) => `[s${from + i}]`).join("")}hstack=${k}[${name}]`;
    ff([
      ...all.flatMap((f) => ["-i", f]),
      "-filter_complex",
      `${scaled};${row(0, "ra")};${row(k, "rb")};[ra][rb]vstack=2`,
      path.join(out, `sheet-${look}.png`),
    ]);
    console.log(`escenas ${look}: ${all.length} cuadros en ${since(t0)} s`);
  }
  await browser.close({ silent: true });
}

if (step === "clip") {
  // Las escenas de V0-3 (voz de Fran a 1,1 y sus tiempos por palabra), una slide por escena.
  type Manifest = { fps: number; scenes: { index: number; key: string; frames: number }[] };
  const manifest = JSON.parse(readFileSync(path.join(v03, "manifest.json"), "utf8")) as Manifest;
  const scenes = manifest.scenes.map((s, i) => {
    const words = path.join(v03, "audio", `${s.key}.words.json`);
    if (!existsSync(words)) throw new Error(`Falta ${words}: correr tts/scenes.py de V0-3.`);
    return {
      slide: clipSlides[i % clipSlides.length],
      frames: s.frames,
      audio: `${s.key}.wav`,
      words: JSON.parse(readFileSync(words, "utf8")),
    };
  });
  const variants = option("variants")?.split(",") ?? ["a", "b"];
  const motion = option("motion") ?? "stagger";
  const concurrency = Number(option("concurrency") ?? 2);
  const results: Record<string, unknown>[] = [];
  for (const look of looks) {
    for (const variant of variants) {
      const inputProps = {
        look,
        tokens,
        seed: "v0-5",
        brandName: "RAdev",
        variant,
        motion,
        scenes,
      };
      const comp = await composition("looks-clip", inputProps);
      const file = path.join(out, `clip-${look}-${variant}-${motion}.mp4`);
      mkdirSync(out, { recursive: true });
      t0 = performance.now();
      await renderMedia({
        composition: comp,
        serveUrl,
        codec: "h264",
        outputLocation: file,
        inputProps,
        concurrency,
        puppeteerInstance: browser,
      });
      const seconds = since(t0);
      const video = comp.durationInFrames / comp.fps;
      results.push({ look, variant, motion, video, seconds, perVideoSecond: seconds / video });
      console.log(`clip ${look} ${variant}: ${video.toFixed(1)} s de video en ${seconds} s`);
    }
  }
  await browser.close({ silent: true });
  writeFileSync(path.join(out, `clip-${Date.now()}.json`), `${JSON.stringify(results, null, 2)}\n`);
}

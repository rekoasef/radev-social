// V0-5: ¿las diferencias entre Remotion y `preview` son del código o del navegador?
// Abre el HTML que escribió `preview` (out/v0-5/preview/<look>.html) con Playwright en 4 navegadores:
// el Chrome de Playwright (el de Social) y el de Remotion, cada uno con y sin
// --font-render-hinting=none (Remotion lo pasa siempre). Hace lo mismo que `preview`: espera las
// fuentes, corre fitSlide y saca cada slide. Compara cada combinación contra las dos referencias.
// Uso: pnpm --filter @radev/spike-video-v0 exec tsx scripts/hinting.ts [--looks a,b]
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { LOOK_IDS } from "@radev/slides";
import { fitSlide } from "@radev/slides/qa";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "out", "v0-5");
const i = process.argv.indexOf("--looks");
const looks = i > 0 ? (process.argv[i + 1]?.split(",") ?? []) : [...LOOK_IDS];
const remotionChrome = path.join(
  root,
  "node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell",
);
const configs = [
  { id: "pw153", executablePath: undefined, args: [] },
  { id: "pw153-nohint", executablePath: undefined, args: ["--font-render-hinting=none"] },
  { id: "rm158", executablePath: remotionChrome, args: [] },
  { id: "rm158-nohint", executablePath: remotionChrome, args: ["--font-render-hinting=none"] },
];

for (const config of configs) {
  const dir = path.join(out, "hinting", config.id);
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: config.executablePath,
    args: config.args,
  });
  const tab = await browser.newPage({ viewport: { width: 1120, height: 1400 } });
  await tab.addInitScript("window.__name = (fn) => fn");
  for (const look of looks) {
    await tab.goto(`file://${path.join(out, "preview", `${look}.html`)}`);
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(200);
    const frames = await tab.$$("[data-slide-frame]");
    for (const [n, frame] of frames.entries()) {
      await frame.evaluate(fitSlide as (frame: Element) => number[]);
      await frame.screenshot({ path: path.join(dir, `${look}-${n + 1}.png`) });
    }
  }
  await browser.close();
  console.log(`${config.id}: listo`);
}

// SSIM a 1/4 (dónde está cada cosa) de cada combinación contra `preview` y contra Remotion.
const ssim = (a: string, b: string) => {
  const filter = "[0]scale=iw/4:-1:flags=area[a];[1]scale=iw/4:-1:flags=area[b];[a][b]ssim";
  const log = spawnSync("ffmpeg", ["-i", a, "-i", b, "-lavfi", filter, "-f", "null", "-"], {
    encoding: "utf8",
  }).stderr;
  return Number(/All:([\d.]+)/.exec(log)?.[1] ?? 0);
};
const report: Record<string, unknown> = {};
for (const config of configs) {
  const stats = { preview: [] as number[], remotion: [] as number[] };
  for (const look of looks) {
    const remotion = readdirSync(path.join(out, "remotion", look))
      .filter((f) => f.endsWith(".png"))
      .sort();
    remotion.forEach((file, n) => {
      const mine = path.join(out, "hinting", config.id, `${look}-${n + 1}.png`);
      stats.preview.push(ssim(mine, path.join(out, "preview", `${look}-${n + 1}.png`)));
      stats.remotion.push(ssim(mine, path.join(out, "remotion", look, file)));
    });
  }
  const summary = (xs: number[]) => ({
    min: Math.min(...xs),
    mean: Number((xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(5)),
    under099: xs.filter((x) => x < 0.99).length,
    identical: xs.filter((x) => x >= 0.99999).length,
  });
  report[config.id] = { vsPreview: summary(stats.preview), vsRemotion: summary(stats.remotion) };
}
writeFileSync(path.join(out, "hinting.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

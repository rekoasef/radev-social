// Writes src/fonts/metrics.json: the average letter width (em) of every curated typeface at each
// weight, lowercase and uppercase, measured in Chromium on long Spanish words. Title sizing uses
// it so a wider font does not take more lines than planned. Run after adding a font:
//   pnpm --filter @radev/slides fonts:measure
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const registry = readFileSync(new URL("../src/fonts/registry.ts", import.meta.url), "utf8");
// `"Inter Tight": { package: "@fontsource-variable/inter-tight", ... weights: { min: 100, max: 900 }`
const entries = [
  ...registry.matchAll(
    /(?:"([^"]+)"|(\w+)):\s*\{\s*package:\s*"([^"]+)",\s*cssFamily:\s*"[^"]+",\s*weights:\s*\{\s*min:\s*(\d+),\s*max:\s*(\d+)/g,
  ),
].map((m) => ({ family: m[1] ?? m[2], pkg: m[3], min: Number(m[4]), max: Number(m[5]) }));
if (entries.length === 0) throw new Error("No se encontraron tipografías en registry.ts");

const faces = entries.map(({ family, pkg }) => {
  const name = pkg.split("/")[1];
  const file = new URL(
    `../node_modules/${pkg}/files/${name}-latin-wght-normal.woff2`,
    import.meta.url,
  );
  const data = readFileSync(file).toString("base64");
  return `@font-face{font-family:"m-${family}";src:url(data:font/woff2;base64,${data}) format("woff2");font-weight:100 1000;}`;
});

const WORDS =
  "información organización presupuesto mantenimiento comunicación herramientas administración automatización seguimiento planificación facturación rendimiento cuánto cuesta realmente tener una app tu plata por fin clara sueldo rinde menos";

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(`<style>${faces.join("")}</style>`);
  const metrics = await page.evaluate(
    async ({ entries, text }) => {
      const canvas = document.createElement("canvas").getContext("2d");
      const out = {};
      for (const { family, min, max } of entries) {
        out[family] = {};
        for (let w = Math.ceil(min / 100) * 100; w <= Math.min(max, 900); w += 100) {
          await document.fonts.load(`${w} 100px "m-${family}"`);
          canvas.font = `${w} 100px "m-${family}"`;
          // Letters only: spaces are narrow and would pull the average down.
          const per = (s) => {
            const words = s.split(" ");
            const width = words.reduce((sum, word) => sum + canvas.measureText(word).width, 0);
            const letters = words.reduce((sum, word) => sum + [...word].length, 0);
            return Math.round((width / 100 / letters) * 1000) / 1000;
          };
          out[family][w] = [per(text), per(text.toUpperCase())];
        }
      }
      return out;
    },
    { entries, text: WORDS },
  );
  const file = new URL("../src/fonts/metrics.json", import.meta.url);
  writeFileSync(file, `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(`metrics.json: ${Object.keys(metrics).length} tipografías`);
} finally {
  await browser.close();
}

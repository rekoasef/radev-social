// Renders a carousel in every look of the `studio` preset (or the ones given), without the web
// app or the database: React to static HTML, Playwright for the screenshot and the render QA.
// For designing looks. The real render is still the worker's (apps/web /render).
//
//   pnpm --filter @radev/slides preview <out-dir> [--carousel c.json] [--tokens t.json]
//     [--looks editorial,bloques] [--seed any]
//
// --carousel: a Carousel (the `content` of a post version); by default the example carousel.
// --set examples|extremes: every slide type instead of a carousel (extremes: every text at its
//   limit, the worst case the render QA has to pass).
// --tokens: studio tokens (a brand's palette); by default the neutral defaults.
// --hero: an image (the brand's element, e.g. Lumus' orb) for the looks that take one.
// --art-dir: a folder with cover-dark.jpg, cover-light.jpg, cta-dark.jpg and cta-light.jpg: the
//   generated images, for the looks that take them (each gets the one of its background).
// Prints the QA problems of each slide and exits with 1 when there are any.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { type Carousel, carouselSchema } from "../src/content/carousel";
import { exampleCarousel, exampleDatasets, exampleSlides } from "../src/content/examples";
import { extremeSlides } from "../src/content/extremes";
import { SLIDE_TYPES, type Slide } from "../src/content/slides";
import { FONT_FAMILIES, fonts } from "../src/fonts/registry";
import type { SlideAssets } from "../src/frame/types";
import { parseTheme } from "../src/presets/registry";
import { isLookId, LOOK_ART, LOOK_IDS, type LookId } from "../src/presets/studio/look-ids";
import { checkRender, fitSlide } from "../src/qa";
import { RenderSlide } from "../src/render-slide";

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const out = resolve(
  args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--")) ?? "preview",
);

const carousel: Carousel = option("carousel")
  ? carouselSchema.parse(JSON.parse(readFileSync(option("carousel") as string, "utf8")))
  : exampleCarousel;
const set = option("set");
const slides: Slide[] =
  set === "extremes"
    ? SLIDE_TYPES.map((type) => extremeSlides[type])
    : set === "examples"
      ? SLIDE_TYPES.map((type) => exampleSlides[type])
      : carousel.slides;
const heroFile = option("hero");
const HERO_ID = "00000000-0000-4000-8000-000000000001";
const assets: SlideAssets = heroFile
  ? { [HERO_ID]: { url: `file://${resolve(heroFile)}`, width: null, height: null } }
  : {};
const baseTokens = option("tokens")
  ? JSON.parse(readFileSync(option("tokens") as string, "utf8"))
  : {};
const tokens = heroFile ? { ...baseTokens, heroAsset: HERO_ID } : baseTokens;
const parsed = parseTheme("studio", tokens);
if (!parsed.ok) throw new Error(parsed.issues.join("\n"));
const looks: LookId[] = (option("looks")?.split(",") ?? [...LOOK_IDS]).filter(isLookId);
const seed = option("seed") ?? "preview";
const artDir = option("art-dir");

/** The images of a look from --art-dir, by the background of each slot. */
function artOf(look: LookId): { cover?: string; cta?: string } | undefined {
  const spec = LOOK_ART[look];
  if (!artDir || !spec) return undefined;
  const url = (slot: "cover" | "cta") => `file://${resolve(artDir)}/${slot}-${spec[slot]}.jpg`;
  return { cover: url("cover"), cta: url("cta") };
}

/** @font-face rules of the curated fonts, pointing at the package files on disk. */
function fontFaces(): string {
  const require = createRequire(import.meta.url);
  return FONT_FAMILIES.map((family) => {
    const dir = dirname(require.resolve(`${fonts[family].package}/package.json`));
    const italic = join(dir, "wght-italic.css");
    const css =
      readFileSync(join(dir, "index.css"), "utf8") +
      (family === "Fraunces" ? readFileSync(italic, "utf8") : "");
    return css.replaceAll("url(./files/", `url(file://${dir}/files/`);
  }).join("\n");
}

function page(look: LookId): string {
  const html = slides
    .map((slide, index) =>
      renderToStaticMarkup(
        <div className="slot">
          <RenderSlide
            theme={parsed.ok ? parsed.theme : (undefined as never)}
            slide={slide}
            page={{ index, total: slides.length }}
            seed={seed}
            brandName="Marca"
            datasets={exampleDatasets}
            look={look}
            art={artOf(look)}
            assets={assets}
          />
        </div>,
      ),
    )
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces()}
*{box-sizing:border-box}body{margin:0;background:#222;display:flex;flex-direction:column;gap:20px;padding:20px;width:max-content}
.slot{position:relative;width:1080px;height:1350px;overflow:hidden}</style></head><body>${html}</body></html>`;
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1120, height: 1400 } });
// tsx (esbuild) wraps functions in __name(); checkRender runs in the page, which lacks it.
await tab.addInitScript("window.__name = (fn) => fn");
let problems = 0;
for (const look of looks) {
  const file = join(out, `${look}.html`);
  writeFileSync(file, page(look));
  await tab.goto(`file://${file}`);
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(200);
  const frames = await tab.$$("[data-slide-frame]");
  for (const [i, frame] of frames.entries()) {
    await frame.evaluate(fitSlide as (frame: Element) => number[]);
    await frame.screenshot({ path: join(out, `${look}-${i + 1}.png`) });
    // Sent to the page as is (self-contained); only its first parameter is used here.
    const issues = await frame.evaluate(
      checkRender as (frame: Element) => ReturnType<typeof checkRender>,
    );
    for (const issue of issues) {
      problems++;
      console.log(`${look} ${i + 1}: ${JSON.stringify(issue)}`);
    }
  }
}
await browser.close();
console.log(`${looks.length} looks × ${slides.length} slides en ${out} · ${problems} problemas`);
process.exit(problems > 0 ? 1 : 0);

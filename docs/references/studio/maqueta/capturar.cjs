// Captura las maquetas en compu (1440 px) y celular (390 px):
//   node docs/references/studio/maqueta/capturar.cjs estudio oficina nuevo guion video
// Usa el Playwright del repo. Las imágenes de Commons se bajan antes con bajar-imagenes.sh.
const path = require("node:path");
const { chromium } = require(path.resolve(__dirname, "../../../../node_modules/playwright"));

const PAGES = { estudio: "a-plano", oficina: "oficina", nuevo: "nuevo", guion: "guion", video: "video", linea: "b-linea", camaras: "c-monitores" };

(async () => {
  const names = process.argv.slice(2);
  const browser = await chromium.launch();
  for (const name of names.length ? names : Object.keys(PAGES)) {
    const file = PAGES[name] ?? name;
    for (const [tag, viewport] of [["compu", { width: 1440, height: 900 }], ["celular", { width: 390, height: 844 }]]) {
      const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
      page.on("pageerror", (e) => console.error(file, tag, "ERROR", e.message));
      await page.goto(`file://${path.join(__dirname, `${file}.html`)}`);
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
      // Captura de página entera: la barra fija del celular va al final, no en el medio.
      await page.addStyleTag({ content: "body{position:relative}.dock,.actionbar{position:absolute!important}" });
      await page.waitForTimeout(300);
      const out = path.join(__dirname, "out", `${file}-${tag}.png`);
      await page.screenshot({ path: out, fullPage: true });
      console.log(out);
      await page.close();
    }
  }
  await browser.close();
})();

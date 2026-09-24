// Screenshots of internal /render pages, for design review (dev only; the worker renders in
// phase 2). Needs the web running (pnpm dev) and RENDER_TOKEN in the root .env.
// Usage: pnpm capture [--check] <path> <out.png> [<path> <out.png> ...]
//   pnpm capture "/render/preview/radev/frame?overlay=safe" /tmp/frame.png
//   pnpm capture --check "/render/preview/lumus/flow?variant=extreme" /tmp/flow.png
// --check prints the render QA of each page (overflows, safe zones) and fails if there is any
// issue. With --check, an output of "-" skips the screenshot.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const token = process.env.RENDER_TOKEN;
const base = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const argv = process.argv.slice(2);
const check = argv.includes("--check");
const args = argv.filter((arg) => arg !== "--check");
if (!token) {
  console.error("Falta RENDER_TOKEN en el .env (ver .env.example).");
  process.exit(1);
}
if (args.length === 0 || args.length % 2 !== 0) {
  console.error("Uso: pnpm capture [--check] <ruta> <salida.png> [<ruta> <salida.png> ...]");
  process.exit(1);
}

const KIND = {
  overflow: "no entra en su caja",
  "outside-box": "se sale de su tarjeta",
  "safe-area": "fuera del área segura",
  tiktok: "debajo de los botones de TikTok",
  overlap: "quedan uno encima del otro",
};

let failed = 0;
const browser = await chromium.launch();
try {
  // The token goes in a header: in the URL it would end up in the web server's log.
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1350 },
    extraHTTPHeaders: { "X-Render-Token": token },
  });
  for (let i = 0; i < args.length; i += 2) {
    const [path, out] = [args[i], args[i + 1]];
    const url = new URL(path, base);
    const response = await page.goto(url.href);
    if (!response?.ok()) throw new Error(`${path} respondió ${response?.status()}`);
    await page.waitForFunction(() => window.__renderReady === true, null, { timeout: 15_000 });
    if (out !== "-") await page.locator("[data-render-root]").screenshot({ path: out });
    if (!check) {
      console.log(`${path} → ${out}`);
      continue;
    }
    const issues = await page.evaluate(() => window.__renderQa ?? []);
    if (issues.length === 0) console.log(`OK    ${path}`);
    else {
      failed++;
      console.log(`FALLA ${path}`);
      for (const issue of issues)
        console.log(`        ${KIND[issue.kind] ?? issue.kind}: “${issue.text}”`);
    }
  }
} catch (error) {
  // Playwright errors include the full URL: never print the token.
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replaceAll(token, "***"));
  process.exitCode = 1;
} finally {
  await browser.close();
}
if (failed > 0) {
  console.log(`\n${failed} página(s) con problemas.`);
  process.exitCode = 1;
}

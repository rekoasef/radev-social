// Screenshots of internal /render pages, for design review (dev only; the worker renders in
// phase 2). Needs the web running (pnpm dev) and RENDER_TOKEN in the root .env.
// Usage: pnpm capture <path> <out.png> [<path> <out.png> ...]
//   pnpm capture "/render/preview/radev/frame?overlay=safe" /tmp/frame.png
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const token = process.env.RENDER_TOKEN;
const base = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const args = process.argv.slice(2);
if (!token) {
  console.error("Falta RENDER_TOKEN en el .env (ver .env.example).");
  process.exit(1);
}
if (args.length === 0 || args.length % 2 !== 0) {
  console.error("Uso: pnpm capture <ruta> <salida.png> [<ruta> <salida.png> ...]");
  process.exit(1);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  for (let i = 0; i < args.length; i += 2) {
    const url = new URL(args[i], base);
    url.searchParams.set("token", token);
    const response = await page.goto(url.href);
    if (!response?.ok()) throw new Error(`${args[i]} respondió ${response?.status()}`);
    await page.waitForFunction(() => window.__renderReady === true, null, { timeout: 15_000 });
    await page.locator("[data-render-root]").screenshot({ path: args[i + 1] });
    console.log(`${args[i]} → ${args[i + 1]}`);
  }
} catch (error) {
  // Playwright errors include the full URL: never print the token.
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replaceAll(token, "***"));
  process.exitCode = 1;
} finally {
  await browser.close();
}

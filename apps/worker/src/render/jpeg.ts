import { getBrowser } from "./browser";

// A JPEG from a slide's PNG, for posts rendered before the render made both (phase 5 T5). Same
// Chromium and quality as the render: no new dependency.

export const JPEG_QUALITY = 90;

export async function jpegFromPng(
  png: Buffer,
  size: { width: number; height: number },
): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: size });
  try {
    const page = await context.newPage();
    // Waits for the load event, which includes the image.
    await page.setContent(
      `<!doctype html><html><body style="margin:0"><img alt="" style="display:block;width:${size.width}px;height:${size.height}px" src="data:image/png;base64,${png.toString("base64")}"></body></html>`,
    );
    return await page.screenshot({ type: "jpeg", quality: JPEG_QUALITY });
  } finally {
    await context.close();
  }
}

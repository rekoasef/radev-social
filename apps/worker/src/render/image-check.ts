import { getBrowser } from "./browser";

// Background check of a generated image (ADR 0016): the image is blended into the slide, so its
// background has to be the one asked for (the model sometimes ignores it: a white shield on a
// dark look). Measured in the worker's Chromium, with no image library of our own.

/** Average brightness (0–255) of the image's border: the outer 8% on each side. */
export async function edgeBrightness(image: Buffer, mime = "image/jpeg"): Promise<number> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Runs in the page (the worker has no DOM types): a string, with the image as a data URL.
    const src = `data:${mime};base64,${image.toString("base64")}`;
    return await page.evaluate(`(async () => {
      const img = new Image();
      img.src = ${JSON.stringify(src)};
      await img.decode();
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      context.drawImage(img, 0, 0, size, size);
      const data = context.getImageData(0, 0, size, size).data;
      const band = Math.round(size * 0.08);
      let sum = 0;
      let count = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (x >= band && x < size - band && y >= band && y < size - band) continue;
          const i = (y * size + x) * 4;
          sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          count++;
        }
      }
      return sum / count;
    })()`);
  } finally {
    await page.close();
  }
}

/** Whether the border is dark or light enough to blend into that background. */
export function backgroundMatches(brightness: number, background: "dark" | "light"): boolean {
  return background === "dark" ? brightness <= 45 : brightness >= 210;
}

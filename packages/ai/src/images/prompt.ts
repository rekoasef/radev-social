// The prompt of a post's image (ADR 0016). The AI only describes the subject; the rules that make
// it usable are always added here, whatever it wrote: one object, the background the look needs
// (it is blended into the slide), the brand's accent as the light, and nothing that could be
// read as text or a person (docs/DESIGN-SYSTEM.md §1: no people, no photos of people).

export type ArtBackground = "dark" | "light";

/** A rough English name of a color, which the image model follows better than a hex code. */
export function colorName(hex: string): string {
  const match = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match?.[1]) return "warm";
  const n = Number.parseInt(match[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
  if (saturation < 0.15) return light > 0.6 ? "white" : light < 0.25 ? "black" : "silver";
  let hue = 0;
  if (max === r) hue = ((g - b) / (max - min)) % 6;
  else if (max === g) hue = (b - r) / (max - min) + 2;
  else hue = (r - g) / (max - min) + 4;
  hue = (hue * 60 + 360) % 360;
  const names: [number, string][] = [
    [15, "red"],
    [40, "orange"],
    [65, "yellow"],
    [160, "green"],
    [200, "cyan"],
    [250, "blue"],
    [290, "violet"],
    [335, "magenta"],
    [360, "red"],
  ];
  const name = names.find(([limit]) => hue < limit)?.[1] ?? "red";
  return light > 0.75 ? `pale ${name}` : name;
}

const RULES =
  "Single centered object, minimal premium product render, generous negative space around it, soft cinematic studio lighting, high detail. No text, no letters, no numbers, no logos, no watermark, no people, no faces, no hands, no frame, no border.";

export function artPrompt(
  subject: string,
  options: { background: ArtBackground; accent: string; monochrome?: boolean },
): string {
  const background =
    options.background === "dark"
      ? "Plain pure black background (#000000) filling the whole image, nothing else behind the object."
      : "Plain pure white background (#ffffff) filling the whole image, nothing else behind the object.";
  const light = options.monochrome
    ? "Black and white only, no color at all."
    : `Accent light and highlights in ${colorName(options.accent)}.`;
  return [subject.trim().replace(/\s+/g, " "), RULES, light, background].join(" ");
}

// The prompt of a post's image (ADR 0016, 0025). The AI only describes the subject; the rules that
// make it usable are always added here, whatever it wrote: the photographic direction, the
// background the look needs (it is blended into the slide), the brand's accent as the dominant
// color, and nothing that could be read as text or a person (docs/DESIGN-SYSTEM.md §1).

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
    [245, "blue"],
    [290, "violet"],
    [335, "magenta"],
    [360, "red"],
  ];
  const name = names.find(([limit]) => hue < limit)?.[1] ?? "red";
  return light > 0.75 ? `pale ${name}` : name;
}

// An editorial still life (ADR 0025): the object big and real, with material detail, so it reads
// on a phone instead of a small cheap 3D render lost in the slide. The accent is the dominant
// color of the image, or the brand disappears from it.
const PHOTO =
  "Editorial still-life photograph, shot on a 100mm macro lens at f/8: the object large in frame (about two thirds of the image) but entirely visible with a clear margin on every side, centered, crisp focus on real material detail (surface texture, reflections, refraction, tiny imperfections).";

const RULES =
  "Restrained, premium, quiet mood like a luxury brand campaign. No text, no letters, no numbers, no logos, no watermark, no people, no faces, no hands, no frame, no border.";

export function artPrompt(
  subject: string,
  options: { background: ArtBackground; accent: string; monochrome?: boolean },
): string {
  const color = `${colorName(options.accent)} (${options.accent.trim().toUpperCase()})`;
  const palette = options.monochrome
    ? "Black and white only, no color at all: the object in shades of grey."
    : `Color palette: the object itself is tinted in saturated ${color} or glows ${colorName(options.accent)} from within; it is the dominant color of the image, everything else is neutral.`;
  const accentLight = options.monochrome ? "white" : colorName(options.accent);
  const background =
    options.background === "dark"
      ? `Low-key lighting: a single soft key light from above and a strong ${accentLight} rim light tracing the edges. Plain pure black background (#000000) filling the whole image, with no floor, no horizon, no smoke, nothing else behind the object.`
      : `High-key lighting: soft diffused daylight${options.monochrome ? "" : ` with ${accentLight} reflections on the object`}. Plain pure white background (#ffffff) filling the whole image, with no floor line, no props, nothing else behind the object; only a faint contact shadow.`;
  return [
    `Subject: ${subject.trim().replace(/\s+/g, " ")}`,
    PHOTO,
    palette,
    background,
    RULES,
  ].join(" ");
}

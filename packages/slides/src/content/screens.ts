import type { SlideAsset, SlideAssets } from "../frame/types";

// Screenshots on `screen` slides (ADR 0024): which device each one goes in and how a slide
// combines them. Screenshots are the post's files, resolved by id like the brand's assets.

/** A portrait screenshot goes in a phone; anything wider, in a laptop. */
export type ScreenDevice = "phone" | "laptop";

/** Taller than this (height / width) is a phone screenshot. */
const PHONE_RATIO = 1.15;

export function screenDevice(size: { width: number | null; height: number | null }): ScreenDevice {
  if (!size.width || !size.height) return "phone";
  return size.height / size.width > PHONE_RATIO ? "phone" : "laptop";
}

/** What a `screen` slide draws: one device, or the laptop with the phone in front. */
export type ScreenComposition =
  | { kind: "phone"; phone: SlideAsset }
  | { kind: "laptop"; laptop: SlideAsset }
  | { kind: "both"; laptop: SlideAsset; phone: SlideAsset };

/**
 * The composition of a slide's screenshots. Two go together only when they are one of each
 * (the AI is told so and checked); otherwise the first one is shown. A screenshot that is not
 * there any more draws the sample phone, so the slide still renders.
 */
export function screenComposition(ids: readonly string[], assets: SlideAssets): ScreenComposition {
  const shots = ids.map(
    (id) => assets[id] ?? SAMPLE_SCREEN_ASSETS[id] ?? SAMPLE_SCREEN_ASSETS[SAMPLE_SCREENS.phone],
  );
  const [first, second] = shots as [SlideAsset, SlideAsset | undefined];
  const firstDevice = screenDevice(first);
  if (second && screenDevice(second) !== firstDevice) {
    return firstDevice === "laptop"
      ? { kind: "both", laptop: first, phone: second }
      : { kind: "both", laptop: second, phone: first };
  }
  return firstDevice === "phone"
    ? { kind: "phone", phone: first }
    : { kind: "laptop", laptop: first };
}

/** Ids of the sample screenshots that examples and previews use (no real file behind them). */
export const SAMPLE_SCREENS = {
  phone: "00000000-0000-4000-8000-00000000a001",
  laptop: "00000000-0000-4000-8000-00000000a002",
} as const;

const svgUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** A made-up app screen, neutral grays, no text: a placeholder for the real screenshot. */
function sampleScreen(width: number, height: number, phone: boolean): string {
  const pad = phone ? 48 : 40;
  const rows = phone
    ? [180, 300, 420, 540, 700, 820, 940, 1060].map(
        (y, i) =>
          `<rect x="${pad}" y="${y}" width="${width - pad * 2}" height="${i % 3 === 0 ? 40 : 88}" rx="20" fill="${i % 3 === 0 ? "#2a2933" : "#1e1d25"}"/>`,
      )
    : [
        `<rect x="0" y="0" width="260" height="${height}" fill="#18171e"/>`,
        ...[120, 180, 240, 300].map(
          (y) => `<rect x="${pad}" y="${y}" width="180" height="28" rx="10" fill="#2a2933"/>`,
        ),
        ...[0, 1, 2].map(
          (i) =>
            `<rect x="${300 + i * 370}" y="120" width="340" height="200" rx="24" fill="#1e1d25"/>`,
        ),
        `<rect x="300" y="360" width="1080" height="460" rx="24" fill="#1e1d25"/>`,
      ];
  const button = phone
    ? `<rect x="${pad}" y="${height - 160}" width="${width - pad * 2}" height="100" rx="50" fill="#3a3946"/>`
    : "";
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#121117"/>${rows.join("")}${button}</svg>`,
  );
}

/** The sample screenshots, as assets (for examples, previews and the brand gallery). */
export const SAMPLE_SCREEN_ASSETS: SlideAssets = {
  [SAMPLE_SCREENS.phone]: { url: sampleScreen(738, 1600, true), width: 738, height: 1600 },
  [SAMPLE_SCREENS.laptop]: { url: sampleScreen(1440, 900, false), width: 1440, height: 900 },
};

/**
 * The editor's pick of a `screen` slide after tapping a screenshot: tapping a chosen one takes it
 * out (never the last), one of the same device replaces it, and one of the other device joins it.
 * Whatever the taps, the result stays valid: one screenshot, or a phone and a laptop.
 */
export function toggleScreen(
  selected: readonly string[],
  id: string,
  deviceOf: (id: string) => ScreenDevice,
): string[] {
  if (selected.includes(id)) {
    return selected.length > 1 ? selected.filter((other) => other !== id) : [...selected];
  }
  const device = deviceOf(id);
  return [...selected.filter((other) => deviceOf(other) !== device), id].slice(-2);
}

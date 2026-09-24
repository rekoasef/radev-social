import { EXCLUSION_ZONES, FORMAT, type Rect } from "@radev/slides";

// Real TikTok screenshot of a 4:5 carousel (docs/references/tiktok-4x5.jpeg, copied to
// public/render/). The phone screen is 738×1600 and the photo spans its full width, from
// y≈227: scaling by 1080/738 lines the photo up with the slide, so TikTok's UI lands where it
// would cover ours. Served under /render, which Caddy blocks in production.
const SCREEN = { width: 738, height: 1600, photoTop: 227 };
const SCALE = FORMAT.width / SCREEN.width;

// Only the parts of the screenshot where TikTok's UI sits: the post underneath belongs to
// another brand and would mix with the slide. The button column is the exclusion zone; the
// page counter pill is on top and the pagination dots at the bottom.
const UI_AREAS: readonly Rect[] = [
  ...EXCLUSION_ZONES,
  { x: FORMAT.width - 170, y: 0, width: 170, height: 50 },
  { x: 0, y: FORMAT.height - 70, width: FORMAT.width, height: 70 },
];

const mask = {
  image: UI_AREAS.map(() => "linear-gradient(#000, #000)").join(", "),
  size: UI_AREAS.map((r) => `${r.width}px ${r.height}px`).join(", "),
  position: UI_AREAS.map((r) => `${r.x}px ${r.y}px`).join(", "),
};

export function TikTokOverlay() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        // Only what is lighter than the slide shows: the white UI, not the post's dark background.
        mixBlendMode: "lighten",
        backgroundImage: "url(/render/tiktok-4x5.jpeg)",
        backgroundRepeat: "no-repeat",
        backgroundSize: `${FORMAT.width}px ${SCREEN.height * SCALE}px`,
        backgroundPosition: `0 ${-SCREEN.photoTop * SCALE}px`,
        maskImage: mask.image,
        maskSize: mask.size,
        maskPosition: mask.position,
        maskRepeat: "no-repeat",
      }}
    />
  );
}

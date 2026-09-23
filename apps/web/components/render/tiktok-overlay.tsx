import { FORMAT } from "@radev/slides";

// Real TikTok screenshot of a 4:5 carousel (docs/references/tiktok-4x5.jpeg, copied to
// public/render/). The phone screen is 738×1600 and the photo spans its full width, from
// y≈227: scaling by 1080/738 lines the photo up with the slide, so TikTok's UI lands where it
// would cover ours. Served under /render, which Caddy blocks in production.
const SCREEN = { width: 738, height: 1600, photoTop: 227 };
const SCALE = FORMAT.width / SCREEN.width;

export function TikTokOverlay() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity: 0.6,
        backgroundImage: "url(/render/tiktok-4x5.jpeg)",
        backgroundRepeat: "no-repeat",
        backgroundSize: `${FORMAT.width}px ${SCREEN.height * SCALE}px`,
        backgroundPosition: `0 ${-SCREEN.photoTop * SCALE}px`,
      }}
    />
  );
}

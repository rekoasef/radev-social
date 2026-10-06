import type { SlideAsset } from "../../frame/types";

// The devices of `screen` slides (ADR 0024): a phone and a laptop drawn in code around the
// operator's screenshot, the same in every look. Dark bodies read on dark and light surfaces;
// the glow under them takes the look's highlight.

const BODY = "#1A1920";
const EDGE = "0 0 0 2px rgba(255,255,255,.10)";
const glow = (strength: number) =>
  `drop-shadow(0 40px 80px color-mix(in srgb, var(--hl) ${strength}%, transparent))`;

const ratioOf = (shot: SlideAsset, fallback: number) =>
  shot.width && shot.height ? shot.height / shot.width : fallback;

/** The phone's outer size for a screenshot, within `max` (width and height). */
export function phoneSize(shot: SlideAsset, max: { width: number; height: number }) {
  const bezel = 12;
  const ratio = ratioOf(shot, 1600 / 738);
  let screenWidth = max.width - bezel * 2;
  let screenHeight = screenWidth * ratio;
  if (screenHeight > max.height - bezel * 2) {
    screenHeight = max.height - bezel * 2;
    screenWidth = screenHeight / ratio;
  }
  return {
    bezel,
    screenWidth: Math.round(screenWidth),
    screenHeight: Math.round(screenHeight),
    width: Math.round(screenWidth + bezel * 2),
    height: Math.round(screenHeight + bezel * 2),
  };
}

export function Phone({
  shot,
  max,
  shadow = true,
}: {
  shot: SlideAsset;
  max: { width: number; height: number };
  shadow?: boolean;
}) {
  const size = phoneSize(shot, max);
  const radius = Math.round(size.width * 0.14);
  return (
    <div
      style={{
        flexShrink: 0,
        padding: size.bezel,
        borderRadius: radius,
        background: BODY,
        boxShadow: EDGE,
        filter: shadow ? glow(55) : undefined,
      }}
    >
      <img
        src={shot.url}
        alt=""
        style={{
          display: "block",
          width: size.screenWidth,
          height: size.screenHeight,
          borderRadius: radius - size.bezel,
          objectFit: "cover",
        }}
      />
    </div>
  );
}

/** The laptop's outer size for a screenshot, within `max`; very tall screens get letterboxed. */
export function laptopSize(shot: SlideAsset, max: { width: number; height: number }) {
  // The base is wider than the lid: the lid is sized so the base fits `max.width`.
  const lidWidth = Math.round(max.width / 1.16);
  const bezel = Math.round(lidWidth * 0.025);
  const top = Math.round(bezel * 1.4);
  const base = Math.round(bezel * 1.3);
  const screenWidth = lidWidth - bezel * 2;
  // A screen between 16:10 and 4:3, whatever the screenshot: it is fitted inside.
  const screenRatio = Math.min(Math.max(ratioOf(shot, 10 / 16), 10 / 16), 3 / 4);
  let screenHeight = Math.round(screenWidth * screenRatio);
  const room = max.height - top - bezel - base;
  if (screenHeight > room) screenHeight = room;
  return {
    lidWidth,
    bezel,
    top,
    base,
    screenWidth,
    screenHeight,
    width: Math.round(lidWidth * 1.16),
    height: screenHeight + top + bezel + base,
  };
}

export function Laptop({
  shot,
  max,
}: {
  shot: SlideAsset;
  max: { width: number; height: number };
}) {
  const size = laptopSize(shot, max);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flexShrink: 0,
        width: size.width,
        filter: glow(45),
      }}
    >
      <div
        style={{
          position: "relative",
          padding: size.bezel,
          paddingTop: size.top,
          background: BODY,
          borderRadius: `${size.bezel * 1.6}px ${size.bezel * 1.6}px 6px 6px`,
          boxShadow: EDGE,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: size.top / 2 - 4,
            left: "50%",
            width: 8,
            height: 8,
            marginLeft: -4,
            borderRadius: 4,
            background: "#33323a",
          }}
        />
        <div
          style={{
            width: size.screenWidth,
            height: size.screenHeight,
            borderRadius: 4,
            overflow: "hidden",
            background: "#0d0c10",
          }}
        >
          <img
            src={shot.url}
            alt=""
            style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
      </div>
      <div
        style={{
          position: "relative",
          width: size.width,
          height: size.base,
          background: "linear-gradient(#2a2930, #141318)",
          borderRadius: `2px 2px ${size.bezel}px ${size.bezel}px`,
          boxShadow: "0 0 0 2px rgba(255,255,255,.08)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: size.width * 0.14,
            marginLeft: -size.width * 0.07,
            height: Math.round(size.base * 0.45),
            background: "#0d0c10",
            borderRadius: `0 0 ${size.bezel}px ${size.bezel}px`,
          }}
        />
      </div>
    </div>
  );
}

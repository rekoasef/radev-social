import "@fontsource-variable/inter-tight";
import { AbsoluteFill, Img, staticFile } from "remotion";
import type { View as DocuView } from "../script";

// Miniatura del video: imagen de archivo a sangre, texto grande y corto, con la paleta del documental.
export type ThumbFormat = "16x9" | "9x16";
export type ThumbProps = {
  format: ThumbFormat;
  image: string;
  aspect: number; // alto / ancho de la imagen
  view: DocuView;
  kicker: string;
  lines: string[];
  accent: string;
};
export const THUMB_SIZE = {
  "16x9": { width: 1280, height: 720 },
  "9x16": { width: 1080, height: 1920 },
} as const;

const C = { paper: "#F1E8D4", gold: "#F0B93A", brick: "#D2563A" };

export const Thumb = ({ format, image, aspect, view, kicker, lines, accent }: ThumbProps) => {
  const { width: W, height: H } = THUMB_SIZE[format];
  const dw = Math.max(W / view.vw, H / aspect);
  const dh = dw * aspect;
  const cx = Math.min(1 - W / 2 / dw, Math.max(W / 2 / dw, view.cx));
  const cy = Math.min(1 - H / 2 / dh, Math.max(H / 2 / dh, view.cy));
  const wide = format === "16x9";
  const size = wide ? 124 : 150;
  const clean = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const accentSet = new Set(accent.split(/\s+/).map(clean));
  return (
    <AbsoluteFill
      style={{
        background: "#0C0B0A",
        overflow: "hidden",
        fontFamily: "'Inter Tight Variable', sans-serif",
      }}
    >
      <Img
        src={staticFile(image)}
        style={{
          position: "absolute",
          width: dw,
          height: dh,
          left: W / 2 - cx * dw,
          top: H / 2 - cy * dh,
          filter: "sepia(0.12) contrast(1.12) saturate(1.05) brightness(0.95)",
        }}
      />
      <AbsoluteFill
        style={{
          background: wide
            ? "linear-gradient(to right, rgba(8,6,4,0.92) 0%, rgba(8,6,4,0.7) 42%, rgba(8,6,4,0) 72%), linear-gradient(to top, rgba(8,6,4,0.55), rgba(8,6,4,0) 40%)"
            : "linear-gradient(to top, rgba(8,6,4,0.95) 0%, rgba(8,6,4,0.78) 30%, rgba(8,6,4,0) 62%), linear-gradient(to bottom, rgba(8,6,4,0.55), rgba(8,6,4,0) 20%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: wide ? 64 : 70,
          top: wide ? 56 : 120,
          background: C.brick,
          color: C.paper,
          fontSize: wide ? 38 : 52,
          fontWeight: 900,
          letterSpacing: "0.08em",
          padding: wide ? "8px 22px" : "10px 28px",
          borderRadius: 10,
        }}
      >
        {kicker.toUpperCase()}
      </div>
      <div
        style={{
          position: "absolute",
          left: wide ? 64 : 70,
          right: wide ? 480 : 70,
          bottom: wide ? 64 : 200,
        }}
      >
        <div
          style={{
            width: wide ? 110 : 150,
            height: 10,
            background: C.gold,
            borderRadius: 5,
            marginBottom: wide ? 22 : 30,
          }}
        />
        {lines.map((line) => (
          <div
            key={line}
            style={{
              fontSize: size,
              fontWeight: 900,
              lineHeight: 0.96,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: C.paper,
              textShadow: "0 6px 24px rgba(0,0,0,0.65)",
            }}
          >
            {line.split(/(\s+)/).map((part, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: el orden de las palabras es fijo
              <span key={i} style={accentSet.has(clean(part)) ? { color: C.gold } : undefined}>
                {part}
              </span>
            ))}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

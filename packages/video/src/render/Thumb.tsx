import "@fontsource-variable/inter-tight";
import { AbsoluteFill, Img, staticFile } from "remotion";
import type { View as DocuView } from "../script";
import { thumbImageBox, thumbTextSize } from "./thumb-layout";

// Miniatura del video: tiene que frenar el dedo. Imagen de archivo con contraste fuerte, texto
// enorme que llena el ancho y la palabra clave sobre un bloque amarillo.
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

const C = { paper: "#FFF8E7", gold: "#FFC421", red: "#E0301E", ink: "#0B0A09" };

export const Thumb = ({ format, image, aspect, view, kicker, lines, accent }: ThumbProps) => {
  const { width: W, height: H } = THUMB_SIZE[format];
  const wide = format === "16x9";
  const box = thumbImageBox({ format, aspect, width: W, height: H });
  const dw = Math.max(box.width / view.vw, box.height / aspect);
  const dh = dw * aspect;
  const cx = Math.min(1 - box.width / 2 / dw, Math.max(box.width / 2 / dw, view.cx));
  const cy = Math.min(1 - box.height / 2 / dh, Math.max(box.height / 2 / dh, view.cy));
  const margin = wide ? 56 : 60;
  const size = thumbTextSize({ format, lines, width: W - margin * 2 });
  const clean = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const accentSet = new Set(accent.split(/\s+/).map(clean));
  return (
    <AbsoluteFill
      style={{
        background: C.ink,
        overflow: "hidden",
        fontFamily: "'Inter Tight Variable', sans-serif",
      }}
    >
      <div
        style={{ position: "absolute", width: box.width, height: box.height, overflow: "hidden" }}
      >
        <Img
          src={staticFile(image)}
          style={{
            position: "absolute",
            width: dw,
            height: dh,
            left: box.width / 2 - cx * dw,
            top: box.height / 2 - cy * dh,
            filter: "contrast(1.28) saturate(1.3) brightness(0.96)",
          }}
        />
        {/* Viñeta: la mirada va al centro y los cielos blancos no queman. */}
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse at 55% 45%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.62) 100%)",
          }}
        />
      </div>
      <AbsoluteFill
        style={{
          background: wide
            ? "linear-gradient(to top, rgba(11,10,9,0.96) 0%, rgba(11,10,9,0.78) 34%, rgba(11,10,9,0) 68%)"
            : box.height < H
              ? `linear-gradient(to bottom, rgba(11,10,9,0) ${((box.height - 380) / H) * 100}%, ${C.ink} ${(box.height / H) * 100}%)`
              : "linear-gradient(to top, rgba(11,10,9,0.97) 0%, rgba(11,10,9,0.82) 32%, rgba(11,10,9,0) 64%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: margin,
          top: wide ? 40 : 110,
          background: C.red,
          color: "#fff",
          fontSize: wide ? 46 : 60,
          fontWeight: 900,
          letterSpacing: "0.06em",
          padding: wide ? "10px 26px" : "14px 34px",
          borderRadius: 8,
          boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
        }}
      >
        {kicker.toUpperCase()}
      </div>
      <div
        style={{
          position: "absolute",
          left: margin,
          right: margin,
          bottom: wide ? 40 : 330,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: size * 0.06,
        }}
      >
        {lines.map((line) => (
          <div
            key={line}
            style={{
              fontSize: size,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              color: C.paper,
              textShadow: "0 8px 30px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.9)",
            }}
          >
            {line.split(/(\s+)/).map((part, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: el orden de las palabras es fijo
                key={i}
                style={
                  accentSet.has(clean(part))
                    ? {
                        background: C.gold,
                        color: C.ink,
                        textShadow: "none",
                        padding: `0 ${size * 0.1}px`,
                        borderRadius: size * 0.08,
                      }
                    : { whiteSpace: "pre" }
                }
              >
                {part}
              </span>
            ))}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

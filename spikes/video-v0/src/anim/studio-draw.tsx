import "@fontsource-variable/inter-tight";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { PALETTE, type Shape, type StudioPiece } from "./studio-format";

// Dibuja las piezas del Estudio (datos, no código) y la hoja para revisarlas.

type Group = NonNullable<StudioPiece["groups"]>[number];

/** El movimiento de un grupo en el segundo `t`, como atributos SVG. */
function motion(g: Group, t: number): { transform?: string; opacity?: number } {
  const s = Math.sin(t * g.speed * Math.PI * 2);
  const px = g.pivotX ?? 0;
  const py = g.pivotY ?? 0;
  switch (g.motion) {
    case "mecer":
      return { transform: `rotate(${g.amount * s} ${px} ${py})` };
    case "flotar":
      return { transform: `translate(0 ${g.amount * s})` };
    case "deslizar":
      return { transform: `translate(${g.amount * s} 0)` };
    case "girar":
      return { transform: `rotate(${(360 * g.speed * t) % 360} ${px} ${py})` };
    case "latir": {
      const k = 1 + Math.min(0.3, g.amount) * s;
      return { transform: `translate(${px} ${py}) scale(${k}) translate(${-px} ${-py})` };
    }
    default: {
      const low = Math.min(1, g.amount);
      return { opacity: low + (1 - low) * (0.5 + 0.5 * s) };
    }
  }
}

function ShapeView({ s }: { s: Shape }) {
  const paint = {
    fill: s.fill === "none" ? "none" : PALETTE[s.fill],
    stroke: s.stroke ? PALETTE[s.stroke] : undefined,
    strokeWidth: s.stroke ? (s.strokeWidth ?? 4) : undefined,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    opacity: s.opacity,
  };
  if (s.type === "rect")
    return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} {...paint} />;
  if (s.type === "circle") return <circle cx={s.cx} cy={s.cy} r={s.r} {...paint} />;
  if (s.type === "ellipse") return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...paint} />;
  return <path d={s.d} {...paint} />;
}

/** Una pieza del Estudio con la base en (0, 0). */
export function StudioShape({ piece, t }: { piece: StudioPiece; t: number }) {
  const groups = new Map((piece.groups ?? []).map((g) => [g.id, g]));
  return (
    <g>
      {piece.shapes.map((s, i) => {
        const g = s.group ? groups.get(s.group) : undefined;
        const body = <ShapeView s={s} />;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: el orden de las formas es fijo
          <g key={i} {...(g ? motion(g, t) : {})}>
            {body}
          </g>
        );
      })}
    </g>
  );
}

export type SheetItem = { piece: StudioPiece; status: string; note?: string };
export type StudioSheetProps = { items: SheetItem[] };

const TILE_W = 540;
const TILE_H = 700;
export const sheetHeight = (n: number) => Math.max(1, Math.ceil(n / 2)) * TILE_H;

const STATUS_COLOR: Record<string, string> = {
  pendiente: "#F2C14E",
  aprobada: "#4ADE80",
  rechazada: "#E5383B",
};

/** La hoja del Estudio: cada pieza en su cuadro, a escala, con nombre y estado. */
export function StudioSheet({ items }: StudioSheetProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{ background: "#0E1222" }}>
      <svg width={1080} height={sheetHeight(items.length)} role="img" aria-label="Estudio">
        {items.map((item, i) => {
          const x0 = (i % 2) * TILE_W;
          const y0 = Math.floor(i / 2) * TILE_H;
          const { w, h } = item.piece;
          const k = Math.min(420 / w, 460 / h, 1.6);
          const floor = y0 + 560;
          return (
            <g key={item.piece.kind}>
              <rect
                x={x0 + 12}
                y={y0 + 12}
                width={TILE_W - 24}
                height={TILE_H - 24}
                rx={20}
                fill="#2A3556"
              />
              <rect
                x={x0 + 12}
                y={floor}
                width={TILE_W - 24}
                height={TILE_H - 24 - (floor - y0) + 12}
                fill="#1A2136"
              />
              <g transform={`translate(${x0 + TILE_W / 2} ${floor}) scale(${k})`}>
                <StudioShape piece={item.piece} t={t} />
              </g>
              <text
                x={x0 + 36}
                y={y0 + 620}
                fontSize={34}
                fontWeight={800}
                fill="#E9EEF7"
                fontFamily="'Inter Tight Variable', sans-serif"
              >
                {item.piece.kind}
              </text>
              <text
                x={x0 + 36}
                y={y0 + 660}
                fontSize={24}
                fontWeight={700}
                fill={STATUS_COLOR[item.status] ?? "#9AA3BF"}
                fontFamily="'Inter Tight Variable', sans-serif"
              >
                {item.status.toUpperCase()} · {w}×{h} · {item.piece.where}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}

// Kit de piezas (ADR 0028): cada pieza se dibuja con la base en (0, 0) y hacia arriba en negativo;
// `CustomSet` la mueve, la escala y la espeja. Reglas de la biblioteca: sin textos fijos, siempre
// algo vivo, estilo plano. El tamaño de cada una está en kit-catalog.ts (PIECES).
import type { ReactNode } from "react";
import {
  FLOOR_Y,
  type PieceKind,
  type PlacedPiece,
  placePieces,
  type SetSpec,
  TONES,
  type Tone,
} from "./kit-catalog";
import { StudioShape } from "./studio-draw";
import type { StudioPiece } from "./studio-format";
import { wave } from "./timing";

type Light = SetSpec["light"];
type P = { p: PlacedPiece; t: number; light: Light };

/** Números pseudoaleatorios fijos: el mismo dibujo en cada cuadro y en cada render. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const tone = (p: PlacedPiece, fallback: Tone) => TONES[p.tone ?? fallback];
const night = (l: Light) => l === "noche";
const pick = <T,>(list: readonly T[], k: number): T =>
  list[Math.floor(k * list.length) % list.length] as T;

const SKY: Record<Light, [string, string]> = {
  dia: ["#4F93D8", "#BFE3FF"],
  atardecer: ["#1E1A3D", "#B0627A"],
  noche: ["#0B1230", "#27346A"],
};
const WINDOW_ON = "#F6D98A";
const LED = ["#4ADE80", "#4ADE80", "#4ADE80", "#8EC7FF", "#F2C14E"];
const NOTE = ["#F2C14E", "#7FD1B9", "#F4978E", "#8EC7FF", "#C3B8F0"];

// --- Base: pared o cielo, y piso ---------------------------------------------------------------

function Sky({
  light,
  t,
  x0,
  x1,
  y0,
  y1,
}: {
  light: Light;
  t: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}) {
  const r = random(7);
  const stars = Array.from({ length: 30 }, () => ({ x: r(), y: r(), hz: 0.2 + r() * 0.6 }));
  const [top, bottom] = SKY[light];
  const w = x1 - x0;
  const h = y1 - y0;
  return (
    <g>
      <defs>
        <linearGradient id={`kit-sky-${x0}-${y0}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect x={x0} y={y0} width={w} height={h} fill={`url(#kit-sky-${x0}-${y0})`} />
      {night(light) &&
        stars.map((s) => (
          <circle
            key={s.x}
            cx={x0 + s.x * w}
            cy={y0 + s.y * h * 0.7}
            r={2.2}
            fill="#FFFFFF"
            opacity={0.35 + 0.35 * wave(t, s.hz, s.x)}
          />
        ))}
      {night(light) && (
        <circle
          cx={x0 + w * 0.78}
          cy={y0 + h * 0.22}
          r={Math.min(40, h * 0.1)}
          fill="#EDE8FA"
          opacity={0.85}
        />
      )}
      {light === "dia" && (
        <circle cx={x0 + w * 0.8} cy={y0 + h * 0.2} r={Math.min(46, h * 0.11)} fill="#FFE08A" />
      )}
      {!night(light) &&
        [0, 1, 2].map((i) => {
          const cx = x0 + (((t * (10 + i * 5) + i * 0.37 * w) % (w + 300)) - 150);
          return (
            <g key={i} opacity={light === "dia" ? 0.85 : 0.2} fill="#FFFFFF">
              <ellipse
                cx={cx}
                cy={y0 + h * (0.25 + i * 0.12)}
                rx={Math.min(120, w * 0.2)}
                ry={26}
              />
              <ellipse
                cx={cx + 50}
                cy={y0 + h * (0.25 + i * 0.12) - 14}
                rx={Math.min(70, w * 0.12)}
                ry={24}
              />
            </g>
          );
        })}
    </g>
  );
}

function FloorView({ spec, t }: { spec: SetSpec; t: number }) {
  const y = FLOOR_Y;
  const h = 1920 - y;
  const line = <rect y={y} width={1080} height={6} fill="#FFFFFF" opacity={0.07} />;
  switch (spec.floor) {
    case "baldosas":
      return (
        <g>
          <defs>
            <pattern id="kit-tiles" width={120} height={120} patternUnits="userSpaceOnUse" y={y}>
              <rect width={120} height={120} fill="#2A2350" />
              <rect width={60} height={60} fill="#352C60" />
              <rect x={60} y={60} width={60} height={60} fill="#352C60" />
            </pattern>
          </defs>
          <rect y={y} width={1080} height={h} fill="url(#kit-tiles)" />
          {line}
        </g>
      );
    case "alfombra":
      return (
        <g>
          <rect y={y} width={1080} height={h} fill="#1A2136" />
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              y={y + 60 + i * 120}
              width={1080}
              height={3}
              fill="#FFFFFF"
              opacity={0.03}
            />
          ))}
          {line}
        </g>
      );
    case "madera":
      return (
        <g>
          <rect y={y} width={1080} height={h} fill="#4A3424" />
          {Array.from({ length: 9 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: tablas fijas
            <rect key={i} y={y + i * 66} width={1080} height={4} fill="#2E2016" opacity={0.6} />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: juntas fijas
              key={`j${i}`}
              x={((i * 337) % 1080) + 20}
              y={y + (i % 9) * 66}
              width={4}
              height={66}
              fill="#2E2016"
              opacity={0.5}
            />
          ))}
          {line}
        </g>
      );
    case "tecnico":
      return (
        <g>
          <defs>
            <pattern id="kit-raised" width={135} height={90} patternUnits="userSpaceOnUse" y={y}>
              <rect width={135} height={90} fill="#1A2540" />
              <rect width={135} height={90} fill="none" stroke="#2A3658" strokeWidth={4} />
              {[30, 52, 74, 96].map((cx) =>
                [28, 46, 64].map((cy) => (
                  <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3} fill="#121A30" />
                )),
              )}
            </pattern>
          </defs>
          <rect y={y} width={1080} height={h} fill="url(#kit-raised)" />
          <rect y={y} width={1080} height={6} fill="#BFE6FF" opacity={0.12} />
        </g>
      );
    case "cemento":
      return (
        <g>
          <rect y={y} width={1080} height={h} fill="#3A3D47" />
          <path
            d={`M 120 ${y + 80} l 60 40 l -20 60 M 760 ${y + 200} l 50 -30 l 40 50`}
            stroke="#2A2C34"
            strokeWidth={4}
            fill="none"
          />
          {line}
        </g>
      );
    case "pasto":
      return (
        <g>
          <rect y={y} width={1080} height={h} fill="#3F7A4E" />
          {Array.from({ length: 40 }, (_, i) => {
            const gx = (i * 211) % 1080;
            const gy = y + 30 + ((i * 97) % (h - 60));
            return (
              <path
                // biome-ignore lint/suspicious/noArrayIndexKey: matas fijas
                key={i}
                d={`M ${gx} ${gy} q ${3 + 3 * wave(t, 0.3, i * 0.1)} -14 6 -22`}
                stroke="#5FA06C"
                strokeWidth={4}
                fill="none"
                strokeLinecap="round"
              />
            );
          })}
        </g>
      );
    case "vereda":
      return (
        <g>
          <rect y={y} width={1080} height={180} fill="#8A8598" />
          {Array.from({ length: 9 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: baldosas fijas
            <rect key={i} x={i * 130} y={y} width={4} height={180} fill="#6E6A7D" />
          ))}
          <rect y={y + 180} width={1080} height={24} fill="#B3ABC0" />
          <rect y={y + 204} width={1080} height={h - 204} fill="#2B2838" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect
              key={i}
              x={40 + i * 240}
              y={y + 360}
              width={140}
              height={14}
              fill="#F2C14E"
              opacity={0.8}
            />
          ))}
        </g>
      );
    case "calle":
      return (
        <g>
          <rect y={y} width={1080} height={h} fill="#2B2838" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect
              key={i}
              x={40 + i * 240}
              y={y + 200}
              width={140}
              height={14}
              fill="#F2C14E"
              opacity={0.8}
            />
          ))}
          {line}
        </g>
      );
    default:
      return (
        <g>
          <rect y={y} width={1080} height={h} fill="#7A5A3E" />
          {Array.from({ length: 30 }, (_, i) => (
            <ellipse
              // biome-ignore lint/suspicious/noArrayIndexKey: piedras fijas
              key={i}
              cx={(i * 263) % 1080}
              cy={y + 20 + ((i * 89) % (h - 40))}
              rx={8}
              ry={5}
              fill="#5E4430"
            />
          ))}
        </g>
      );
  }
}

function Backdrop({ spec, t }: { spec: SetSpec; t: number }) {
  if (spec.kind === "exterior")
    return <Sky light={spec.light} t={t} x0={0} x1={1080} y0={0} y1={FLOOR_Y} />;
  const c = TONES[spec.wall];
  return (
    <g>
      <defs>
        <linearGradient id="kit-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.dark} />
          <stop offset="1" stopColor={c.base} />
        </linearGradient>
      </defs>
      <rect width={1080} height={FLOOR_Y} fill="url(#kit-wall)" />
      {night(spec.light) && <rect width={1080} height={FLOOR_Y} fill="#000010" opacity={0.25} />}
      <rect y={FLOOR_Y - 26} width={1080} height={26} fill={c.dark} />
    </g>
  );
}

// --- Techo ------------------------------------------------------------------------------------

function CeilingLight({ p, t }: P) {
  const hum = p.index % 2 === 1 && wave(t, 0.21) > 0.85 ? 0.8 + 0.2 * wave(t, 9) : 1;
  return (
    <g opacity={hum}>
      <rect x={-150} y={-30} width={300} height={22} rx={6} fill="#E9EEF7" opacity={0.85} />
      <ellipse cx={0} cy={0} rx={420} ry={700} fill="url(#kit-glow-cool)" />
    </g>
  );
}

function PendantLamp({ p, t }: P) {
  const swing = 2.5 * wave(t, 0.25, p.index * 0.3);
  const drop = (FLOOR_Y - p.y) / p.scale;
  return (
    <g transform={`rotate(${swing} 0 -2000)`}>
      <rect x={-2} y={-2000} width={4} height={1940} fill="#4A3F78" />
      <path d="M -60 0 L 60 0 L 32 -50 L -32 -50 Z" fill="#F2C14E" />
      <circle cx={0} cy={4} r={12} fill="#FFF3C4" />
      <path d={`M -60 0 L 60 0 L ${260} ${drop} L ${-260} ${drop} Z`} fill="url(#kit-cone)" />
    </g>
  );
}

// --- Pared y fondo ----------------------------------------------------------------------------

function City({
  seed,
  x0,
  x1,
  base,
  maxH,
  t,
  light,
  count,
}: {
  seed: number;
  x0: number;
  x1: number;
  base: number;
  maxH: number;
  t: number;
  light: Light;
  count: number;
}) {
  const r = random(seed);
  const step = (x1 - x0) / count;
  const fill = light === "dia" ? "#7C8FB8" : light === "atardecer" ? "#2A2350" : "#18224A";
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const w = step * (0.7 + r() * 0.4);
        const h = maxH * (0.35 + r() * 0.65);
        const bx = x0 + i * step + r() * step * 0.2;
        const lit = Array.from({ length: 8 }, () => ({
          on: r() > 0.45,
          hz: 0.04 + r() * 0.12,
          ph: r(),
        }));
        return (
          <g key={bx}>
            <rect x={bx} y={base - h} width={w} height={h} fill={fill} />
            {lit.map((l, j) => (
              <rect
                // biome-ignore lint/suspicious/noArrayIndexKey: ventanas fijas
                key={j}
                x={bx + w * 0.18 + (j % 2) * w * 0.38}
                y={base - h + 14 + Math.floor(j / 2) * 34}
                width={w * 0.18}
                height={14}
                fill={light === "dia" ? "#DDEBFF" : WINDOW_ON}
                opacity={
                  light === "dia"
                    ? 0.35
                    : l.on
                      ? 0.25 + 0.5 * (0.5 + 0.5 * wave(t, l.hz, l.ph))
                      : 0.06
                }
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}

function Hills({
  x0,
  x1,
  base,
  h,
  light,
}: {
  x0: number;
  x1: number;
  base: number;
  h: number;
  light: Light;
}) {
  const w = x1 - x0;
  const cols =
    light === "dia"
      ? ["#7FB685", "#5E9A6A", "#3F7A4E"]
      : light === "atardecer"
        ? ["#6C4F7A", "#563E66", "#3E2C4E"]
        : ["#2A3358", "#212A4A", "#18203A"];
  return (
    <g>
      {cols.map((c, i) => {
        const top = base - h * (1 - i * 0.28);
        return (
          <path
            key={c}
            d={`M ${x0} ${base} L ${x0} ${top + 40} Q ${x0 + w * 0.25} ${top - 30} ${x0 + w * 0.5} ${top + 30} T ${x1} ${top} L ${x1} ${base} Z`}
            fill={c}
          />
        );
      })}
    </g>
  );
}

function BigWindow({ p, t, light }: P) {
  const id = `kit-win-${p.index}`;
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <rect x={-350} y={-440} width={700} height={440} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <Sky light={light} t={t} x0={-350} x1={350} y0={-440} y1={0} />
        {p.variant === "campo" ? (
          <Hills x0={-350} x1={350} base={0} h={200} light={light} />
        ) : (
          <City
            seed={11 + p.index}
            x0={-340}
            x1={340}
            base={0}
            maxH={330}
            t={t}
            light={light}
            count={9}
          />
        )}
      </g>
      {[-350, -117, 117, 336].map((x) => (
        <rect key={x} x={x} y={-444} width={14} height={448} fill="#121A30" />
      ))}
      <rect x={-358} y={-454} width={716} height={14} fill="#121A30" />
      <rect x={-364} y={0} width={728} height={18} fill="#3A4670" />
    </g>
  );
}

function SmallWindow({ p, t, light }: P) {
  const id = `kit-win-${p.index}`;
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <rect x={-130} y={-320} width={260} height={320} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <Sky light={light} t={t} x0={-130} x1={130} y0={-320} y1={0} />
      </g>
      <rect
        x={-130}
        y={-320}
        width={260}
        height={320}
        fill="none"
        stroke="#121A30"
        strokeWidth={14}
      />
      <rect x={-6} y={-320} width={12} height={320} fill="#121A30" />
      <rect x={-130} y={-166} width={260} height={12} fill="#121A30" />
      <rect x={-144} y={0} width={288} height={16} fill="#3A4670" />
    </g>
  );
}

function Door({ p, t }: P) {
  const c = tone(p, "madera");
  return (
    <g>
      <rect x={-110} y={-400} width={220} height={400} fill={c.dark} />
      <rect x={-96} y={-388} width={192} height={388} fill={c.base} />
      <rect
        x={-76}
        y={-360}
        width={152}
        height={150}
        rx={6}
        fill="none"
        stroke={c.dark}
        strokeWidth={6}
      />
      <rect
        x={-76}
        y={-180}
        width={152}
        height={150}
        rx={6}
        fill="none"
        stroke={c.dark}
        strokeWidth={6}
      />
      <circle cx={70} cy={-200} r={10} fill="#F2C14E" />
      <rect
        x={-96}
        y={-6}
        width={192}
        height={6}
        fill="#FFE3A8"
        opacity={0.5 + 0.3 * wave(t, 0.4)}
      />
    </g>
  );
}

function Column({ p }: P) {
  const c = tone(p, "violeta");
  return (
    <g>
      <rect x={-45} y={-800} width={90} height={30} fill={c.light} />
      <rect x={-34} y={-770} width={68} height={740} fill={c.light} opacity={0.85} />
      {[-16, 0, 16].map((d) => (
        <rect key={d} x={d - 2} y={-760} width={4} height={720} fill={c.dark} opacity={0.35} />
      ))}
      <rect x={-45} y={-30} width={90} height={30} fill={c.light} />
    </g>
  );
}

function Painting({ p }: P) {
  const c = tone(p, "madera");
  return (
    <g>
      <rect x={-100} y={-150} width={200} height={150} fill={c.light} />
      <rect x={-86} y={-136} width={172} height={122} fill="#8EC7FF" />
      <path d="M -86 -14 L -86 -60 Q -30 -100 20 -60 T 86 -70 L 86 -14 Z" fill="#4E9F6E" />
      <circle cx={46} cy={-108} r={14} fill="#F2C14E" />
    </g>
  );
}

function Clock({ t }: P) {
  const sec = (t * 6) % 360;
  const min = 120 + t * 0.1;
  return (
    <g transform="translate(0 -90)">
      <circle r={90} fill="#4A3F78" />
      <circle r={78} fill="#EDE8FA" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: marcas fijas
          key={i}
          x={-3}
          y={-72}
          width={6}
          height={i % 3 === 0 ? 16 : 9}
          fill="#262049"
          transform={`rotate(${i * 30})`}
        />
      ))}
      <rect
        x={-4}
        y={-44}
        width={8}
        height={50}
        rx={4}
        fill="#262049"
        transform={`rotate(${min})`}
      />
      <rect
        x={-3}
        y={-62}
        width={6}
        height={68}
        rx={3}
        fill="#262049"
        transform={`rotate(${min * 12})`}
      />
      <rect x={-1.5} y={-68} width={3} height={80} fill="#E5383B" transform={`rotate(${sec})`} />
      <circle r={6} fill="#E5383B" />
    </g>
  );
}

function Whiteboard({ t }: P) {
  const notes = [
    { x: -120, y: -300, r: -4 },
    { x: -20, y: -290, r: 3 },
    { x: -100, y: -180, r: 2 },
    { x: 10, y: -150, r: -3 },
  ];
  return (
    <g>
      <rect x={-150} y={-340} width={300} height={330} rx={10} fill="#E3E7F2" />
      <rect
        x={-150}
        y={-340}
        width={300}
        height={330}
        rx={10}
        fill="none"
        stroke="#9AA3BF"
        strokeWidth={8}
      />
      {notes.map((n, i) => (
        <rect
          key={`${n.x}${n.y}`}
          x={n.x}
          y={n.y}
          width={64}
          height={64}
          fill={NOTE[i] ?? "#F2C14E"}
          transform={`rotate(${n.r + 1.5 * wave(t, 0.12, i * 0.25)} ${n.x + 32} ${n.y})`}
        />
      ))}
      <path
        d="M -50 -250 Q -20 -200 -40 -170 M 80 -80 Q 100 -40 60 -40"
        stroke="#5B6B8C"
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />
      <rect x={-140} y={-10} width={280} height={10} rx={4} fill="#9AA3BF" />
    </g>
  );
}

function WallScreen({ p, t }: P) {
  const down = p.variant === "baja";
  const pts = Array.from({ length: 9 }, (_, i) => {
    const k = i / 8;
    const trend = down ? 0.2 + 0.65 * k : 0.85 - 0.65 * k;
    const jitter = [0, 0.12, -0.08, 0.1, -0.05, 0.08, -0.1, 0.06, 0][i] ?? 0;
    return { x: -190 + k * 380, y: -250 + 210 * Math.min(0.95, Math.max(0.05, trend + jitter)) };
  });
  const shown = Math.min(pts.length, 2 + Math.floor((t * 1.6) % (pts.length + 3)));
  const vis = pts.slice(0, shown);
  const tip = vis.at(-1);
  const color = down ? "#E5383B" : "#4ADE80";
  return (
    <g>
      <rect x={-6} y={-30} width={12} height={30} fill="#262B39" />
      <rect x={-220} y={-270} width={440} height={250} rx={12} fill="#141A2C" />
      <rect x={-206} y={-256} width={412} height={222} rx={4} fill="#0F1E30" />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={-196}
          y={-230 + i * 52}
          width={392}
          height={2}
          fill="#FFFFFF"
          opacity={0.08}
        />
      ))}
      <polyline
        points={vis.map((q) => `${q.x},${q.y}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {tip && <circle cx={tip.x} cy={tip.y} r={9} fill={color} opacity={0.6 + 0.4 * wave(t, 2)} />}
    </g>
  );
}

function Shelf({ p }: P) {
  const c = tone(p, "madera");
  const r = random(40 + p.index);
  return (
    <g>
      <rect x={-180} y={-440} width={360} height={440} fill={c.dark} />
      {[0, 1, 2].map((row) => {
        const y = -440 + 20 + row * 140;
        let x = -165;
        const items: ReactNode[] = [];
        while (x < 140) {
          const w = 30 + r() * 50;
          const h = 60 + r() * 50;
          items.push(
            <rect
              key={x}
              x={x}
              y={y + 120 - h}
              width={w}
              height={h}
              fill={pick(NOTE, r())}
              opacity={0.85}
            />,
          );
          x += w + 8;
        }
        return (
          <g key={row}>
            {items}
            <rect x={-180} y={y + 120} width={360} height={14} fill={c.light} />
          </g>
        );
      })}
    </g>
  );
}

function NeonSign({ t }: P) {
  const on = wave(t, 0.33) > -0.9 ? 1 : 0.3;
  return (
    <g>
      <rect x={-160} y={-130} width={320} height={130} rx={16} fill="#141026" />
      <path
        d="M -110 -65 L 70 -65 M 30 -100 L 80 -65 L 30 -30"
        stroke="#FF5FA2"
        strokeWidth={12}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={on}
      />
      <path
        d="M -110 -65 L 70 -65 M 30 -100 L 80 -65 L 30 -30"
        stroke="#FF5FA2"
        strokeWidth={30}
        fill="none"
        strokeLinecap="round"
        opacity={0.18 * on}
      />
    </g>
  );
}

function CityBand({ p, t, light }: P) {
  return (
    <City
      seed={23 + p.index}
      x0={-540}
      x1={540}
      base={0}
      maxH={460}
      t={t}
      light={light}
      count={14}
    />
  );
}

function HillsBand({ light }: P) {
  return <Hills x0={-540} x1={540} base={0} h={420} light={light} />;
}

function Building({ p, t, light }: P) {
  const c = tone(p, "violeta");
  if (p.variant === "banco") {
    return (
      <g>
        <path d="M -200 -560 L 0 -700 L 200 -560 Z" fill={c.light} />
        <circle cx={0} cy={-605} r={26} fill="#F2C14E" />
        <rect x={-200} y={-560} width={400} height={40} fill={c.light} />
        <rect x={-180} y={-520} width={360} height={520} fill={c.base} />
        {[-140, -70, 70, 140].map((x) => (
          <rect key={x} x={x - 18} y={-510} width={36} height={500} fill={c.light} opacity={0.85} />
        ))}
        <rect
          x={-40}
          y={-260}
          width={80}
          height={260}
          rx={8}
          fill="#FFD58A"
          opacity={0.75 + 0.2 * wave(t, 0.5)}
        />
      </g>
    );
  }
  const r = random(60 + p.index);
  const lit = Array.from({ length: 40 }, () => ({ on: r() > 0.4, hz: 0.03 + r() * 0.1, ph: r() }));
  return (
    <g>
      <rect x={-190} y={-720} width={380} height={720} fill={c.base} />
      <rect x={-200} y={-740} width={400} height={24} fill={c.light} />
      {lit.map((l, i) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: ventanas fijas
          key={i}
          x={-160 + (i % 4) * 85}
          y={-690 + Math.floor(i / 4) * 64}
          width={54}
          height={40}
          fill={light === "dia" ? "#BFE3FF" : WINDOW_ON}
          opacity={
            light === "dia" ? 0.5 : l.on ? 0.3 + 0.5 * (0.5 + 0.5 * wave(t, l.hz, l.ph)) : 0.08
          }
        />
      ))}
      <rect x={-50} y={-90} width={100} height={90} fill={c.dark} />
    </g>
  );
}

// --- Exterior: árbol, farol, auto ---------------------------------------------------------------

function Tree({ p, t }: P) {
  return (
    <g>
      <rect x={-16} y={-160} width={32} height={160} fill="#5E4430" />
      <g transform={`rotate(${2 * wave(t, 0.2, p.index * 0.2)} 0 -150)`}>
        <circle cx={0} cy={-260} r={100} fill="#3F7A4E" />
        <circle cx={-60} cy={-210} r={70} fill="#4E9F6E" />
        <circle cx={60} cy={-220} r={74} fill="#4E9F6E" />
        <circle cx={10} cy={-310} r={60} fill="#5FB07A" />
      </g>
    </g>
  );
}

function StreetLamp({ t, light }: P) {
  const on = light !== "dia";
  return (
    <g>
      <rect x={-8} y={-440} width={16} height={440} fill="#3A3D47" />
      <path d="M -8 -440 Q 30 -470 60 -440" stroke="#3A3D47" strokeWidth={12} fill="none" />
      <rect x={40} y={-446} width={44} height={20} rx={6} fill={on ? "#FFE3A8" : "#9AA3BF"} />
      {on && (
        <ellipse
          cx={62}
          cy={-200}
          rx={180}
          ry={260}
          fill="url(#kit-glow-warm)"
          opacity={0.85 + 0.15 * wave(t, 0.3)}
        />
      )}
    </g>
  );
}

function Car({ p, light }: P) {
  const c = tone(p, "bordo");
  return (
    <g>
      <path
        d="M -190 -40 L -180 -90 L -100 -100 L -60 -150 L 80 -150 L 130 -100 L 190 -90 L 190 -40 Z"
        fill={c.light}
      />
      <path d="M -50 -140 L 70 -140 L 110 -100 L -80 -100 Z" fill="#BFE3FF" opacity={0.7} />
      <rect x={4} y={-140} width={8} height={40} fill={c.light} />
      <circle cx={-110} cy={-36} r={36} fill="#1A1A22" />
      <circle cx={110} cy={-36} r={36} fill="#1A1A22" />
      <circle cx={-110} cy={-36} r={14} fill="#9AA3BF" />
      <circle cx={110} cy={-36} r={14} fill="#9AA3BF" />
      <rect x={176} y={-84} width={16} height={14} fill={night(light) ? "#FFF3C4" : "#E9EEF7"} />
    </g>
  );
}

// --- Muebles --------------------------------------------------------------------------------------

function Desk({ p }: P) {
  const c = tone(p, "madera");
  return (
    <g>
      <rect x={-310} y={-270} width={620} height={28} rx={6} fill={c.light} />
      <rect x={-290} y={-242} width={200} height={242} fill={c.base} />
      <rect x={90} y={-242} width={200} height={242} fill={c.base} />
      {[-190, 190].map((x) => (
        <g key={x}>
          <rect
            x={x - 80}
            y={-220}
            width={160}
            height={90}
            rx={8}
            fill="none"
            stroke={c.dark}
            strokeWidth={6}
          />
          <rect x={x - 20} y={-182} width={40} height={10} rx={5} fill={c.dark} />
          <rect
            x={x - 80}
            y={-110}
            width={160}
            height={90}
            rx={8}
            fill="none"
            stroke={c.dark}
            strokeWidth={6}
          />
          <rect x={x - 20} y={-72} width={40} height={10} rx={5} fill={c.dark} />
        </g>
      ))}
    </g>
  );
}

function Table({ p }: P) {
  const c = tone(p, "madera");
  return (
    <g>
      <rect x={-220} y={-230} width={440} height={26} rx={6} fill={c.light} />
      <rect x={-200} y={-204} width={400} height={20} fill={c.base} />
      <rect x={-190} y={-204} width={22} height={204} fill={c.base} />
      <rect x={168} y={-204} width={22} height={204} fill={c.base} />
    </g>
  );
}

function Counter({ p }: P) {
  const c = tone(p, "violeta");
  return (
    <g>
      <rect x={-450} y={-330} width={900} height={30} rx={6} fill={c.light} />
      <rect x={-430} y={-300} width={860} height={300} fill={c.base} />
      {[-300, 0, 300].map((x) => (
        <rect
          key={x}
          x={x - 120}
          y={-260}
          width={240}
          height={220}
          rx={8}
          fill="none"
          stroke={c.dark}
          strokeWidth={6}
        />
      ))}
    </g>
  );
}

function FileCabinet({ p }: P) {
  const c = tone(p, "gris");
  return (
    <g>
      <rect x={-90} y={-300} width={180} height={300} rx={6} fill={c.light} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={-78} y={-288 + i * 96} width={156} height={86} rx={4} fill={c.base} />
          <rect x={-24} y={-256 + i * 96} width={48} height={10} rx={5} fill={c.dark} />
        </g>
      ))}
    </g>
  );
}

function Chair({ p }: P) {
  const c = tone(p, "gris");
  return (
    <g>
      <rect x={-50} y={-240} width={100} height={120} rx={20} fill={c.base} />
      <rect x={-70} y={-120} width={140} height={30} rx={12} fill={c.light} />
      <rect x={-6} y={-90} width={12} height={60} fill="#262B39" />
      <path
        d="M -60 -20 L 60 -20 M 0 -30 L 0 -20"
        stroke="#262B39"
        strokeWidth={10}
        strokeLinecap="round"
      />
      <circle cx={-60} cy={-8} r={8} fill="#1A1A22" />
      <circle cx={60} cy={-8} r={8} fill="#1A1A22" />
    </g>
  );
}

function Sofa({ p }: P) {
  const c = tone(p, "bordo");
  return (
    <g>
      <rect x={-170} y={-220} width={340} height={120} rx={30} fill={c.base} />
      <rect x={-190} y={-130} width={380} height={90} rx={24} fill={c.light} />
      <rect x={-190} y={-170} width={60} height={140} rx={24} fill={c.base} />
      <rect x={130} y={-170} width={60} height={140} rx={24} fill={c.base} />
      <rect x={-6} y={-200} width={12} height={70} fill={c.dark} opacity={0.4} />
      <rect x={-170} y={-40} width={20} height={40} fill={c.dark} />
      <rect x={150} y={-40} width={20} height={40} fill={c.dark} />
    </g>
  );
}

function Boxes() {
  const box = (x: number, y: number, w: number, h: number) => (
    <g key={`${x}${y}`}>
      <rect x={x} y={y} width={w} height={h} fill="#B08356" />
      <rect x={x + w / 2 - 12} y={y} width={24} height={h} fill="#D6B48A" opacity={0.7} />
      <rect x={x} y={y} width={w} height={6} fill="#8E6A44" />
    </g>
  );
  return (
    <g>
      {box(-130, -120, 140, 120)}
      {box(16, -110, 114, 110)}
      {box(-80, -250, 150, 130)}
    </g>
  );
}

function Safe({ p, t }: P) {
  const c = tone(p, "gris");
  return (
    <g>
      <rect x={-130} y={-300} width={260} height={290} rx={14} fill={c.dark} />
      <rect x={-110} y={-280} width={220} height={250} rx={10} fill={c.base} />
      <g transform={`translate(-10 -160) rotate(${(t * 40) % 360})`}>
        <circle r={44} fill={c.light} />
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: marcas fijas
            key={i}
            x={-2}
            y={-42}
            width={4}
            height={10}
            fill={c.dark}
            transform={`rotate(${i * 45})`}
          />
        ))}
      </g>
      <rect x={60} y={-200} width={16} height={80} rx={8} fill={c.light} />
      <rect x={-110} y={-10} width={30} height={10} fill={c.dark} />
      <rect x={80} y={-10} width={30} height={10} fill={c.dark} />
    </g>
  );
}

function Rack({ p, t }: P) {
  const r = random(500 + p.index * 13);
  const units = Array.from({ length: 12 }, () => ({
    empty: r() < 0.08,
    leds: Array.from({ length: 3 }, () => ({ hz: 0.4 + r() * 2.6, ph: r(), c: pick(LED, r()) })),
  }));
  return (
    <g>
      <rect x={-82} y={-780} width={164} height={780} rx={6} fill="#1E2840" />
      <rect x={-82} y={-780} width={164} height={30} rx={6} fill="#2B3550" />
      {units.map((u, j) => {
        const y = -740 + j * 60;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: unidades fijas
          <g key={j}>
            <rect
              x={-72}
              y={y}
              width={144}
              height={52}
              rx={4}
              fill={u.empty ? "#121A2E" : "#26324F"}
            />
            {!u.empty &&
              [0, 1, 2].map((g) => (
                <rect
                  key={g}
                  x={-62}
                  y={y + 12 + g * 12}
                  width={70}
                  height={4}
                  rx={2}
                  fill="#121A2E"
                />
              ))}
            {!u.empty &&
              u.leds.map((led, k) => (
                <circle
                  // biome-ignore lint/suspicious/noArrayIndexKey: luces fijas
                  key={k}
                  cx={26 + k * 16}
                  cy={y + 26}
                  r={5}
                  fill={led.c}
                  opacity={wave(t, led.hz, led.ph) > -0.2 ? 0.95 : 0.15}
                />
              ))}
          </g>
        );
      })}
    </g>
  );
}

function Plant({ p, t }: P) {
  return (
    <g>
      <g transform={`rotate(${1.5 * wave(t, 0.18, p.index * 0.3)} 0 -90)`}>
        {[-40, -15, 10, 35].map((a) => (
          <ellipse
            key={a}
            cx={0}
            cy={-170}
            rx={24}
            ry={86}
            fill="#4E9F6E"
            transform={`rotate(${a} 0 -90)`}
          />
        ))}
      </g>
      <path d="M -55 -100 L 55 -100 L 42 0 L -42 0 Z" fill="#B0627A" />
    </g>
  );
}

// --- Sobre los muebles ---------------------------------------------------------------------------

const CODE = (() => {
  const r = random(91);
  return Array.from({ length: 24 }, () => ({
    indent: Math.floor(r() * 4) * 22,
    w: 50 + r() * 160,
    c: pick(["#7FD1B9", "#8EC7FF", "#F2C14E", "#C3B8F0"], r()),
  }));
})();

function Monitor({ p, t }: P) {
  const pos = t * 16 + p.index * 140;
  const first = Math.floor(pos / 26);
  const shift = pos % 26;
  const clip = `kit-screen-${p.index}`;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={-146} y={-236} width={292} height={162} rx={4} />
        </clipPath>
      </defs>
      <ellipse cx={0} cy={-150} rx={260} ry={170} fill="url(#kit-glow-cool)" />
      <rect x={-12} y={-60} width={24} height={52} fill="#2B3550" />
      <rect x={-60} y={-10} width={120} height={10} rx={4} fill="#2B3550" />
      <rect x={-160} y={-250} width={320} height={190} rx={12} fill="#141A2C" />
      <rect x={-146} y={-236} width={292} height={162} rx={4} fill="#0F2233" />
      <g clipPath={`url(#${clip})`}>
        {Array.from({ length: 8 }, (_, k) => {
          const line = CODE[(first + k) % CODE.length];
          if (!line) return null;
          return (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: renglones que se reciclan al subir
              key={k}
              x={-130 + line.indent}
              y={-224 + k * 26 - shift}
              width={line.w}
              height={10}
              rx={5}
              fill={line.c}
              opacity={0.75}
            />
          );
        })}
      </g>
      <rect
        x={-130}
        y={-96}
        width={14}
        height={12}
        fill="#E9EEF7"
        opacity={wave(t, 1.1, p.index) > 0 ? 0.9 : 0}
      />
    </g>
  );
}

function Laptop({ p, t }: P) {
  return (
    <g>
      <ellipse cx={0} cy={-100} rx={200} ry={120} fill="url(#kit-glow-cool)" />
      <path d="M -110 -160 L 110 -160 L 120 -20 L -120 -20 Z" fill="#2B3550" />
      <path
        d="M -98 -148 L 98 -148 L 106 -32 L -106 -32 Z"
        fill="#163450"
        opacity={0.85 + 0.1 * wave(t, 0.5, p.index)}
      />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={-80}
          y={-134 + i * 24}
          width={60 + ((i * 47) % 90)}
          height={8}
          rx={4}
          fill="#8EC7FF"
          opacity={0.6}
        />
      ))}
      <path d="M -130 -20 L 130 -20 L 150 0 L -150 0 Z" fill="#3A4670" />
    </g>
  );
}

function DeskLamp({ t }: P) {
  return (
    <g>
      <ellipse cx={0} cy={-6} rx={50} ry={10} fill="#262B39" />
      <path
        d="M 0 -10 L -20 -120 L 50 -170"
        stroke="#262B39"
        strokeWidth={10}
        fill="none"
        strokeLinecap="round"
      />
      <path d="M 30 -190 L 90 -150 L 60 -130 Z" fill="#F2C14E" />
      <ellipse
        cx={80}
        cy={-60}
        rx={90}
        ry={110}
        fill="url(#kit-glow-warm)"
        opacity={0.85 + 0.1 * wave(t, 0.3)}
      />
    </g>
  );
}

function Mug({ t }: P) {
  return (
    <g>
      <rect x={-24} y={-48} width={44} height={48} rx={6} fill="#E3E7F2" />
      <path d="M 20 -38 Q 42 -30 20 -14" stroke="#E3E7F2" strokeWidth={6} fill="none" />
      {[0, 1].map((i) => {
        const k = (t * 0.5 + i * 0.5) % 1;
        return (
          <path
            key={i}
            d={`M ${-10 + i * 16} ${-54 - k * 90} q 10 -16 0 -32 q -10 -16 0 -32`}
            stroke="#E9EEF7"
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            opacity={0.35 * (1 - k)}
          />
        );
      })}
    </g>
  );
}

function Books() {
  const cols = ["#2E5BDA", "#E5383B", "#F2C14E", "#4E9F6E"];
  return (
    <g>
      {cols.map((c, i) => (
        <rect
          key={c}
          x={-80 + (i % 2) * 8}
          y={-22 - i * 22}
          width={160 - i * 10}
          height={20}
          rx={3}
          fill={c}
        />
      ))}
    </g>
  );
}

function SmallPlant({ t, p }: P) {
  return (
    <g>
      <g transform={`rotate(${2 * wave(t, 0.2, p.index * 0.4)} 0 -50)`}>
        {[-30, 0, 30].map((a) => (
          <ellipse
            key={a}
            cx={0}
            cy={-80}
            rx={12}
            ry={36}
            fill="#4E9F6E"
            transform={`rotate(${a} 0 -50)`}
          />
        ))}
      </g>
      <path d="M -30 -50 L 30 -50 L 24 0 L -24 0 Z" fill="#B0627A" />
    </g>
  );
}

function Phone({ t }: P) {
  return (
    <g>
      <path d="M -70 0 L 70 0 L 56 -50 L -56 -50 Z" fill="#262B39" />
      <path d="M -66 -48 Q 0 -90 66 -48 L 56 -64 Q 0 -100 -56 -64 Z" fill="#3A4052" />
      <circle cx={40} cy={-24} r={6} fill="#E5383B" opacity={wave(t, 1.2) > 0 ? 1 : 0.2} />
    </g>
  );
}

// --- Ambiente -------------------------------------------------------------------------------------

function LightBeam({ p, t }: P) {
  const r = random(70 + p.index);
  const dust = Array.from({ length: 18 }, () => ({ x: r(), y: r(), hz: 0.05 + r() * 0.1 }));
  const h = p.y;
  return (
    <g>
      <path d={`M -70 ${-h} L 70 ${-h} L 300 0 L -300 0 Z`} fill="url(#kit-beam)" />
      {dust.map((d) => {
        const yy = -((t * 40 * d.hz * 10 + d.y * h) % h);
        const k = 1 + yy / h;
        return (
          <circle
            key={d.x}
            cx={(d.x - 0.5) * 520 * (1 - k * 0.6)}
            cy={yy}
            r={2.5}
            fill="#FFFFFF"
            opacity={0.35}
          />
        );
      })}
    </g>
  );
}

function Dust({ t }: P) {
  const r = random(33);
  const dust = Array.from({ length: 40 }, () => ({ x: r(), y: r(), hz: 0.02 + r() * 0.05 }));
  return (
    <g>
      {dust.map((d) => (
        <circle
          key={d.x}
          cx={d.x * 1080 + 20 * wave(t, d.hz * 2, d.y)}
          cy={(((d.y * 1920 - t * 12 * d.hz * 20) % 1920) + 1920) % 1920}
          r={2.5}
          fill="#FFFFFF"
          opacity={0.18}
        />
      ))}
    </g>
  );
}

function Mist({ t }: P) {
  const r = random(44);
  const mist = Array.from({ length: 7 }, () => ({
    y: FLOOR_Y - 50 + r() * 110,
    speed: 18 + r() * 22,
    x: r(),
  }));
  return (
    <g>
      {mist.map((m) => (
        <ellipse
          key={m.x}
          cx={((t * m.speed + m.x * 1500) % 1500) - 250}
          cy={m.y}
          rx={240}
          ry={26}
          fill="#9FD8FF"
          opacity={0.08}
        />
      ))}
    </g>
  );
}

function Rain({ t }: P) {
  const r = random(55);
  const drops = Array.from({ length: 70 }, () => ({ x: r(), y: r(), v: 0.7 + r() * 0.5 }));
  return (
    <g>
      {drops.map((d) => {
        const y = (d.y * 1920 + t * 1400 * d.v) % 1920;
        return (
          <rect
            key={d.x}
            x={d.x * 1080 - (y - 960) * 0.08}
            y={y}
            width={3}
            height={40}
            fill="#BFD8FF"
            opacity={0.35}
            transform={`rotate(8 ${d.x * 1080} ${y})`}
          />
        );
      })}
    </g>
  );
}

// --- Escenario -------------------------------------------------------------------------------------

const DRAW: Record<PieceKind, (props: P) => ReactNode> = {
  "luz-techo": CeilingLight,
  lampara: PendantLamp,
  ventanal: BigWindow,
  ventana: SmallWindow,
  puerta: Door,
  columna: Column,
  cuadro: Painting,
  reloj: Clock,
  pizarra: Whiteboard,
  pantalla: WallScreen,
  estante: Shelf,
  cartel: NeonSign,
  ciudad: CityBand,
  cerros: HillsBand,
  edificio: Building,
  arbol: Tree,
  farol: StreetLamp,
  auto: Car,
  escritorio: Desk,
  mesa: Table,
  mostrador: Counter,
  archivero: FileCabinet,
  silla: Chair,
  sillon: Sofa,
  cajas: Boxes,
  "caja-fuerte": Safe,
  rack: Rack,
  planta: Plant,
  monitor: Monitor,
  notebook: Laptop,
  "lampara-escritorio": DeskLamp,
  taza: Mug,
  libros: Books,
  "planta-chica": SmallPlant,
  telefono: Phone,
  "haz-luz": LightBeam,
  polvo: Dust,
  niebla: Mist,
  lluvia: Rain,
};

/** Piezas que ocupan todo el cuadro: no se mueven ni se escalan (solo el haz usa `x`). */
const FULL = new Set(["polvo", "niebla", "lluvia"]);

/** Un escenario armado: fondo, piso y las piezas en orden de capa. */
export function CustomSet({
  spec,
  t,
  studio = {},
}: {
  spec: SetSpec;
  t: number;
  /** Las piezas del Estudio que usa este escenario. */
  studio?: Record<string, StudioPiece>;
}) {
  return (
    <g>
      <defs>
        <radialGradient id="kit-glow-cool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#8EC7FF" stopOpacity={0.2} />
          <stop offset="1" stopColor="#8EC7FF" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="kit-glow-warm" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFD58A" stopOpacity={0.45} />
          <stop offset="1" stopColor="#FFD58A" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="kit-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE3A8" stopOpacity={0.28} />
          <stop offset="1" stopColor="#FFE3A8" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="kit-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E9EEF7" stopOpacity={0.04} />
          <stop offset="1" stopColor="#E9EEF7" stopOpacity={0.2} />
        </linearGradient>
      </defs>
      <Backdrop spec={spec} t={t} />
      <FloorView spec={spec} t={t} />
      {placePieces(spec, studio).map((p) => {
        const Draw = (DRAW as Record<string, ((props: P) => ReactNode) | undefined>)[p.kind];
        if (!Draw) {
          const piece = studio[p.kind];
          if (!piece) return null;
          return (
            <g
              key={p.index}
              transform={`translate(${p.x} ${p.y}) scale(${p.flip ? -p.scale : p.scale} ${p.scale})`}
            >
              <StudioShape piece={piece} t={t} />
            </g>
          );
        }
        const body = <Draw p={p} t={t} light={spec.light} />;
        if (FULL.has(p.kind)) return <g key={p.index}>{body}</g>;
        const y = p.kind === "haz-luz" ? FLOOR_Y : p.y;
        const s = p.kind === "haz-luz" ? 1 : p.scale;
        const beam = p.kind === "haz-luz" ? { ...p, y: FLOOR_Y } : p;
        return (
          <g key={p.index} transform={`translate(${p.x} ${y}) scale(${p.flip ? -s : s} ${s})`}>
            {p.kind === "haz-luz" ? <LightBeam p={beam} t={t} light={spec.light} /> : body}
          </g>
        );
      })}
    </g>
  );
}

// The furniture and people of the floor plan (RAdev Studio's drawing, approved in T10; ported from
// docs/references/studio/maqueta/scene-top.js). Illustration colors live only inside this drawing.

export const C = {
  wall: "#3b414e",
  wallHi: "#4a5161",
  corridor: "#16191f",
  corridorLine: "#1e222a",
  wood: "#3d2d22",
  woodLine: "#47362a",
  carpet: "#1d3236",
  carpetDot: "#24403f",
  tile: "#1e232b",
  tileLine: "#272d37",
  foam: "#2c2540",
  foamDark: "#241e35",
  rug: "#3e1f27",
  rugEdge: "#5a2e38",
  deskTop: "#6b5140",
  deskEdge: "#2e2219",
  manila: "#d9b66f",
  paper: "#e8e2d4",
  metal: "#5d6676",
  metalHi: "#7a8496",
  skin: ["#e8b894", "#c98d64", "#8d5a3b", "#f1c9a5"],
  hair: ["#2b1d14", "#6b3d1f", "#141414", "#a8743f"],
} as const;

export const SANS = "var(--font-geist-sans), system-ui, sans-serif";
export const MONO = "var(--font-geist-mono), ui-monospace, monospace";

type At = { x: number; y: number };

/** Patterns and lights. `p` keeps the ids of the two drawings (computer and phone) apart. */
export function Defs({ p }: { p: string }) {
  const tile = (id: string, w: number, h: number, base: string, children: React.ReactNode) => (
    <pattern id={`${p}-${id}`} width={w} height={h} patternUnits="userSpaceOnUse">
      <rect width={w} height={h} fill={base} />
      {children}
    </pattern>
  );
  const light = (id: string, color: string, stops: [number, number][]) => (
    <radialGradient id={`${p}-${id}`}>
      {stops.map(([offset, opacity]) => (
        <stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
      ))}
    </radialGradient>
  );
  return (
    <defs>
      {tile("wood", 60, 14, C.wood, <path d="M0 13.5H60M22 0V14" stroke={C.woodLine} />)}
      {tile("wood2", 60, 14, C.wood, <path d="M0 13.5H60M44 0V14" stroke={C.woodLine} />)}
      {tile("carpet", 10, 10, C.carpet, <circle cx="5" cy="5" r="1" fill={C.carpetDot} />)}
      {tile("tile", 24, 24, C.tile, <path d="M0 .5H24M.5 0V24" stroke={C.tileLine} />)}
      {tile("foam", 12, 12, C.foam, <path d="M0 0 6 6 0 12M6 0 12 6 6 12" fill={C.foamDark} />)}
      {tile(
        "concrete",
        80,
        80,
        C.corridor,
        <path d="M0 79.5H80M79.5 0V80" stroke={C.corridorLine} />,
      )}
      {light("lamp", "#ffcf7a", [
        [0, 0.34],
        [0.55, 0.12],
        [1, 0],
      ])}
      {light("cool", "#7fb8ff", [
        [0, 0.28],
        [1, 0],
      ])}
      {light("alarm", "#f2555a", [
        [0, 0.42],
        [0.6, 0.12],
        [1, 0],
      ])}
      {light("wait", "#f2b53a", [
        [0, 0.45],
        [1, 0],
      ])}
      <filter id={`${p}-soft`} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.6" floodColor="#000" floodOpacity=".55" />
      </filter>
    </defs>
  );
}

export function Glow({ x, y, r, p, kind }: At & { r: number; p: string; kind: string }) {
  return (
    <circle cx={x} cy={y} r={r} fill={`url(#${p}-${kind})`} style={{ mixBlendMode: "screen" }} />
  );
}

export function Person({
  x,
  y,
  p,
  shirt,
  skin = 0,
  hair = 0,
  turn = 0,
  typing = false,
}: At & {
  p: string;
  shirt: string;
  skin?: number;
  hair?: number;
  turn?: number;
  typing?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn})`} filter={`url(#${p}-soft)`}>
      <ellipse cx="0" cy="2" rx="13" ry="8" fill={shirt} />
      <g className={typing ? "floor-typing" : undefined}>
        <ellipse cx="-10" cy="-4" rx="3.6" ry="6" fill={shirt} transform="rotate(18 -10 -4)" />
      </g>
      <g className={typing ? "floor-typing floor-typing-b" : undefined}>
        <ellipse cx="10" cy="-4" rx="3.6" ry="6" fill={shirt} transform="rotate(-18 10 -4)" />
      </g>
      <circle cx="0" cy="-1" r="6.6" fill={C.skin[skin]} />
      <path
        d="M-6.6 0a6.6 6.6 0 0 1 13.2 0c-2-3.4-11.2-3.4-13.2 0Z"
        fill={C.hair[hair]}
        transform="rotate(180 0 -1)"
      />
    </g>
  );
}

export function Robot({ x, y, p }: At & { p: string }) {
  return (
    <g transform={`translate(${x} ${y})`} filter={`url(#${p}-soft)`}>
      <rect x="-12" y="-9" width="24" height="18" rx="6" fill={C.metal} />
      <rect x="-9" y="-6" width="18" height="6" rx="3" fill="#11151b" />
      <rect x="-6" y="-4.5" width="12" height="2.4" rx="1.2" fill="#7fe0ff" />
      <circle cx="0" cy="6" r="1.6" fill={C.metalHi} />
      <line x1="0" y1="9" x2="0" y2="14" stroke={C.metalHi} strokeWidth="1.4" />
      <circle cx="0" cy="15" r="2" fill="#3dd68c" />
    </g>
  );
}

export function Chair({ x, y, empty = false }: At & { empty?: boolean }) {
  return (
    <>
      <circle
        cx={x}
        cy={y}
        r="12"
        fill={empty ? "#2b3140" : "#232832"}
        stroke={empty ? "#4a5161" : "none"}
        strokeWidth="1.5"
      />
      <rect
        x={x - 12}
        y={y + 8}
        width="24"
        height="5"
        rx="2.5"
        fill={empty ? "#353c4d" : "#1c2029"}
      />
    </>
  );
}

/** A desk with its monitor at the far edge; the seat is below. */
export function Desk({
  x,
  y,
  p,
  w = 70,
  h = 32,
  screen = "off",
}: At & { p: string; w?: number; h?: number; screen?: "off" | "on" | "alarm" }) {
  return (
    <>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx="3"
        fill={C.deskTop}
        stroke={C.deskEdge}
        strokeWidth="1.5"
        filter={`url(#${p}-soft)`}
      />
      <rect x={x - 17} y={y - h / 2 + 3} width="34" height="6" rx="1.5" fill="#11151b" />
      {screen !== "off" && (
        <rect
          x={x - 15}
          y={y - h / 2 + 8}
          width="30"
          height="2"
          fill={screen === "alarm" ? "#f2555a" : "#a8d4ff"}
          opacity=".9"
        />
      )}
    </>
  );
}

export function Papers({ x, y, n = 2 }: At & { n?: number }) {
  return Array.from({ length: n }, (_, i) => (
    <rect
      // biome-ignore lint/suspicious/noArrayIndexKey: identical sheets of a fixed pile
      key={i}
      x={x + i * 3}
      y={y - i * 2}
      width="13"
      height="16"
      fill={C.paper}
      opacity=".92"
      transform={`rotate(${i * 9 - 8} ${x} ${y})`}
    />
  ));
}

export function Plant({ x, y, r = 11 }: At & { r?: number }) {
  return (
    <>
      <circle cx={x} cy={y} r={r * 0.7} fill="#5b3b2a" />
      {Array.from({ length: 6 }, (_, i) => {
        const cx = x + Math.cos(i) * r * 0.5;
        const cy = y + Math.sin(i) * r * 0.5;
        return (
          <ellipse
            // biome-ignore lint/suspicious/noArrayIndexKey: six fixed leaves
            key={i}
            cx={cx}
            cy={cy}
            rx={r * 0.55}
            ry={r * 0.3}
            fill={i % 2 ? "#3f7a4f" : "#4f9161"}
            transform={`rotate(${i * 60} ${cx} ${cy})`}
          />
        );
      })}
    </>
  );
}

/** A manila folder with its colored tab and number, centred on the origin. */
export function FolderShape({ code, color, p }: { code: string; color: string; p: string }) {
  return (
    <g filter={`url(#${p}-soft)`}>
      <rect x="-15" y="-13" width="13" height="5" rx="1.5" fill={color} />
      <rect x="-15" y="-10" width="30" height="21" rx="2" fill={C.manila} />
      <path d="M-15 -4H15" stroke="#b8964f" />
      <text
        y="7"
        textAnchor="middle"
        fill="#3a2a12"
        fontSize="9"
        fontWeight="600"
        style={{ fontFamily: MONO }}
      >
        {code}
      </text>
    </g>
  );
}

const BUBBLE = {
  say: ["#e8eaed", "#16191f"],
  alarm: ["#f2555a", "#ffffff"],
  wait: ["#f2b53a", "#16191f"],
} as const;

export function Bubble({
  x,
  y,
  p,
  text,
  kind = "say",
}: At & { p: string; text: string; kind?: keyof typeof BUBBLE }) {
  const [fill, ink] = BUBBLE[kind];
  const width = text.length * 6.4 + 14;
  return (
    <g className={kind === "wait" ? "floor-breathe" : undefined}>
      <rect
        x={x - width / 2}
        y={y - 10}
        width={width}
        height="20"
        rx="10"
        fill={fill}
        filter={`url(#${p}-soft)`}
      />
      <path d={`M${x - 4} ${y + 9} l4 7 l4 -7Z`} fill={fill} />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fill={ink}
        fontSize="11"
        fontWeight="600"
        style={{ fontFamily: SANS }}
      >
        {text}
      </text>
    </g>
  );
}

export type SignState = "live" | "cued" | "ready" | "off" | "fail" | "timed" | "standby";

const SIGN: Record<SignState, { color: string; lamp: React.ReactNode }> = {
  live: { color: "#f2555a", lamp: <circle cx="5" cy="5" r="4" fill="currentColor" /> },
  cued: { color: "#f2b53a", lamp: <path d="M5 1 9.2 8.8H.8Z" fill="currentColor" /> },
  ready: {
    color: "#3dd68c",
    lamp: <rect x="1.2" y="1.2" width="7.6" height="7.6" fill="currentColor" />,
  },
  off: {
    color: "#818895",
    lamp: <rect x="1" y="4.2" width="8" height="1.6" fill="currentColor" />,
  },
  standby: {
    color: "#a3a9b4",
    lamp: <circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.4" />,
  },
  timed: { color: "#5bbcf5", lamp: <path d="M5 .6 9.4 5 5 9.4.6 5Z" fill="currentColor" /> },
  fail: {
    color: "#f2555a",
    lamp: (
      <path
        d="M1.6 1.6 8.4 8.4M8.4 1.6 1.6 8.4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    ),
  },
};

/** The door sign: number and name on a plate, and under it the lamp with its text. */
export function DoorSign({
  x,
  y,
  n,
  name,
  state,
  status,
}: At & { n?: number; name: string; state: SignState; status: string }) {
  const { color, lamp } = SIGN[state];
  const start = x + 9 + (n ? 14 : 0);
  const length = name.length * 9.2;
  return (
    <g style={{ fontFamily: SANS }}>
      <rect
        x={x}
        y={y}
        width={start - x + length + 8}
        height="24"
        rx="3"
        fill="#1a1e26"
        stroke="#343a47"
      />
      {n && (
        <text x={x + 9} y={y + 16} fill="#818895" fontSize="11" style={{ fontFamily: MONO }}>
          {n}
        </text>
      )}
      <text
        x={start}
        y={y + 16}
        fill="#e8eaed"
        fontSize="11"
        fontWeight="600"
        textLength={length}
        lengthAdjust="spacing"
      >
        {name.toUpperCase()}
      </text>
      <g transform={`translate(${x + 1} ${y + 33})`} color={color}>
        {lamp}
      </g>
      <text x={x + 17} y={y + 42} fill={color} fontSize="10" fontWeight="500" letterSpacing="1.2">
        {status.toUpperCase()}
      </text>
    </g>
  );
}

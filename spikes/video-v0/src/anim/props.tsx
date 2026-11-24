import type { PropItem } from "./guion";
import { MoneyBagShape } from "./person";
import { BoatShape, BookShape } from "./places";
import { cueTime, pop, ramp, type Word, wave } from "./timing";

// Objetos del escenario. Todos entran con rebote y después siguen moviéndose un poco.

const FONT = "'Inter Tight Variable', sans-serif";

function Calendar({ month, year }: { month: string; year: string }) {
  return (
    <g>
      <rect
        x={-150}
        y={-160}
        width={300}
        height={330}
        rx={26}
        fill="#000"
        opacity={0.3}
        transform="translate(10 14)"
      />
      <rect x={-150} y={-160} width={300} height={330} rx={26} fill="#F7F4EC" />
      <path
        d="M -150 -134 A 26 26 0 0 1 -124 -160 L 124 -160 A 26 26 0 0 1 150 -134 L 150 -70 L -150 -70 Z"
        fill="#E5383B"
      />
      <text
        x={0}
        y={-102}
        textAnchor="middle"
        fontSize={40}
        fontWeight={900}
        fill="#FFFFFF"
        fontFamily={FONT}
      >
        {month}
      </text>
      <text
        x={0}
        y={90}
        textAnchor="middle"
        fontSize={124}
        fontWeight={900}
        fill="#1B1B22"
        fontFamily={FONT}
      >
        {year}
      </text>
      <circle cx={-80} cy={-160} r={12} fill="#9AA0B4" />
      <circle cx={80} cy={-160} r={12} fill="#9AA0B4" />
    </g>
  );
}

function Stopwatch({ spin, settle, t }: { spin: number; settle: number; t: number }) {
  // `spin` 0..1: la aguja larga da 10 vueltas y la corta avanza 64 minutos (una vuelta + 4/60).
  const secondHand = spin * 360 * 10;
  const minuteHand = spin * 360 * (64 / 60);
  // Cuando frena, tiembla un instante (el "¡ding!").
  const shake = settle > 0 && settle < 1 ? 6 * Math.sin(settle * 40) * (1 - settle) : 0;
  return (
    <g transform={`rotate(${shake})`}>
      <rect x={-34} y={-300} width={68} height={50} rx={12} fill="#C7CCDA" />
      <rect x={-60} y={-322} width={120} height={34} rx={14} fill="#E5383B" />
      <circle cx={0} cy={0} r={250} fill="#000" opacity={0.3} transform="translate(12 16)" />
      <circle cx={0} cy={0} r={250} fill="#D9DDE8" />
      <circle cx={0} cy={0} r={222} fill="#FBFAF6" />
      {Array.from({ length: 60 }, (_, i) => (
        <rect
          key={i}
          x={-3}
          y={-212}
          width={6}
          height={i % 5 === 0 ? 30 : 14}
          rx={3}
          fill={i % 5 === 0 ? "#1B1B22" : "#9AA0B4"}
          transform={`rotate(${i * 6})`}
        />
      ))}
      <path d="M 0 0 L 0 -208 A 208 208 0 0 1 0 -208 Z" fill="#E5383B" opacity={0.12} />
      <g transform={`rotate(${minuteHand})`}>
        <rect x={-9} y={-130} width={18} height={140} rx={9} fill="#1B1B22" />
      </g>
      <g transform={`rotate(${secondHand})`}>
        <rect x={-3} y={-196} width={6} height={226} rx={3} fill="#E5383B" />
      </g>
      <circle cx={0} cy={0} r={16} fill="#E5383B" />
      <circle cx={0} cy={0} r={6} fill="#FBFAF6" />
      <circle
        cx={0}
        cy={0}
        r={250}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity={0.15 * (1 - ramp(t, 0, 0.6))}
        strokeWidth={30}
      />
    </g>
  );
}

function Question() {
  return (
    <g>
      <text
        x={6}
        y={10}
        textAnchor="middle"
        fontSize={260}
        fontWeight={900}
        fill="#000"
        opacity={0.3}
        fontFamily={FONT}
      >
        ?
      </text>
      <text
        x={0}
        y={0}
        textAnchor="middle"
        fontSize={260}
        fontWeight={900}
        fill="#F2C14E"
        fontFamily={FONT}
      >
        ?
      </text>
    </g>
  );
}

/** La ruta de la entrada a la bóveda, dibujándose (`progress` 0..1); después los guiones avanzan. */
const ROUTE: [number, number][] = [
  [275, 1150],
  [275, 920],
  [500, 920],
  [500, 760],
  [700, 760],
  [790, 740],
];
function Route({ progress, t }: { progress: number; t: number }) {
  if (progress <= 0) return null;
  const lengths = ROUTE.slice(1).map(([x, y], i) => {
    const [px, py] = ROUTE[i] ?? [x, y];
    return Math.hypot(x - px, y - py);
  });
  let left = progress * lengths.reduce((a, b) => a + b, 0);
  const points: [number, number][] = [ROUTE[0] ?? [0, 0]];
  let angle = 0;
  for (const [i, len] of lengths.entries()) {
    const [ax, ay] = ROUTE[i] ?? [0, 0];
    const [bx, by] = ROUTE[i + 1] ?? [0, 0];
    angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
    if (left >= len) {
      points.push([bx, by]);
      left -= len;
      continue;
    }
    const k = left / len;
    points.push([ax + (bx - ax) * k, ay + (by - ay) * k]);
    break;
  }
  const end = points[points.length - 1] ?? [0, 0];
  return (
    <g>
      <polyline
        points={points.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke="#FF4D4D"
        strokeWidth={10}
        strokeDasharray="22 14"
        strokeDashoffset={-t * 60}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={ROUTE[0]?.[0]} cy={ROUTE[0]?.[1]} r={14} fill="#FF4D4D" />
      <g transform={`translate(${end[0]} ${end[1]}) rotate(${angle})`}>
        <path d="M -6 -22 L 30 0 L -6 22 Z" fill="#FF4D4D" />
      </g>
      {progress >= 1 ? (
        <circle
          cx={end[0]}
          cy={end[1]}
          r={30 + 10 * wave(t, 1.5)}
          fill="none"
          stroke="#FF4D4D"
          strokeWidth={5}
        />
      ) : null}
    </g>
  );
}

/** Celular con una tienda; al pagar, la página queda cargando (rueda y barra que no termina). */
function Phone({ loading, since, t }: { loading: number; since: number; t: number }) {
  const bar = 0.72 * (1 - Math.exp(-since * 0.9));
  return (
    <g>
      <rect
        x={-188}
        y={-372}
        width={376}
        height={744}
        rx={56}
        fill="#000"
        opacity={0.35}
        transform="translate(14 18)"
      />
      <rect x={-188} y={-372} width={376} height={744} rx={56} fill="#15151C" />
      <rect x={-170} y={-352} width={340} height={704} rx={40} fill="#F6F4EF" />
      <rect x={-50} y={-344} width={100} height={22} rx={11} fill="#15151C" />
      {/* Tienda */}
      <g opacity={1 - loading}>
        <rect x={-170} y={-310} width={340} height={64} fill="#2E5BDA" />
        <text
          x={0}
          y={-268}
          textAnchor="middle"
          fontSize={30}
          fontWeight={900}
          fill="#FFFFFF"
          fontFamily={FONT}
        >
          MI TIENDA
        </text>
        <rect x={-140} y={-220} width={280} height={250} rx={20} fill="#FFE3C7" />
        <path
          d="M -70 -170 L -20 -190 Q 0 -170 20 -190 L 70 -170 L 90 -120 L 55 -110 L 55 0 L -55 0 L -55 -110 L -90 -120 Z"
          fill="#E07A5F"
          transform={`rotate(${3 * wave(t, 0.7)} 0 -95)`}
        />
        <rect x={-140} y={50} width={200} height={22} rx={8} fill="#1B1B22" opacity={0.85} />
        <rect x={-140} y={86} width={150} height={16} rx={8} fill="#9AA0B4" />
        <rect x={-140} y={112} width={110} height={30} rx={8} fill="#2E8B57" opacity={0.85} />
        <rect x={-140} y={190} width={280} height={74} rx={18} fill="#FF7A00" />
        <text
          x={0}
          y={238}
          textAnchor="middle"
          fontSize={32}
          fontWeight={900}
          fill="#FFFFFF"
          fontFamily={FONT}
        >
          COMPRAR
        </text>
      </g>
      {/* Pago cargando */}
      <g opacity={loading}>
        <rect x={-170} y={-310} width={340} height={64} fill="#1B1B22" />
        <text
          x={0}
          y={-268}
          textAnchor="middle"
          fontSize={30}
          fontWeight={900}
          fill="#FFFFFF"
          fontFamily={FONT}
        >
          PAGO
        </text>
        {[0, 1, 2].map((i) => (
          <rect key={i} x={-140} y={-210 + i * 70} width={280} height={46} rx={10} fill="#E3E1DA" />
        ))}
        <g transform={`translate(0 70) rotate(${since * 300})`}>
          <circle r={56} fill="none" stroke="#E3E1DA" strokeWidth={14} />
          <path
            d="M 0 -56 A 56 56 0 0 1 56 0"
            fill="none"
            stroke="#2E5BDA"
            strokeWidth={14}
            strokeLinecap="round"
          />
        </g>
        <rect x={-140} y={170} width={280} height={18} rx={9} fill="#E3E1DA" />
        <rect x={-140} y={170} width={280 * bar} height={18} rx={9} fill="#2E5BDA" />
        <text
          x={0}
          y={240}
          textAnchor="middle"
          fontSize={30}
          fontWeight={800}
          fill="#6B6F80"
          fontFamily={FONT}
        >
          {`Cargando${".".repeat(1 + (Math.floor(t * 3) % 3))}`}
        </text>
      </g>
    </g>
  );
}

export function PropView({
  prop,
  t,
  words,
  fps,
}: {
  prop: PropItem;
  t: number;
  words: Word[];
  fps: number;
}) {
  const at = cueTime(prop.at, words);
  const enter = pop(t, at, fps);
  if (enter <= 0) return null;
  if (prop.kind === "calendar") {
    const leave =
      prop.until === undefined
        ? 0
        : ramp(t, cueTime(prop.until, words), cueTime(prop.until, words) + 0.25);
    const s = enter * (1 - leave);
    if (s <= 0.001) return null;
    const tilt = -6 + 3 * wave(t, 0.5);
    return (
      <g transform={`translate(${prop.x} ${prop.y}) rotate(${tilt}) scale(${s})`}>
        <Calendar month={prop.month} year={prop.year} />
      </g>
    );
  }
  if (prop.kind === "moneyBag") {
    const sway = 4 * wave(t, 0.7, prop.x / 100);
    return (
      <g
        transform={`translate(${prop.x} ${prop.y}) rotate(${sway}) scale(${enter * (prop.scale ?? 1)})`}
      >
        <MoneyBagShape />
      </g>
    );
  }
  if (prop.kind === "stopwatch") {
    const end = cueTime(prop.spinUntil, words);
    const spin = ramp(t, at, end);
    const settle = t > end ? Math.min(1, (t - end) / 0.6) : 0;
    const breathe = 1 + 0.015 * wave(t, 0.8);
    return (
      <g transform={`translate(${prop.x} ${prop.y}) scale(${enter * breathe})`}>
        <Stopwatch spin={spin} settle={settle} t={t - at} />
      </g>
    );
  }
  if (prop.kind === "route") {
    return <Route progress={ramp(t, at, cueTime(prop.until, words))} t={t} />;
  }
  if (prop.kind === "marker") {
    const move = prop.moveTo
      ? ramp(t, cueTime(prop.moveTo.at, words), cueTime(prop.moveTo.at, words) + 0.9)
      : 0;
    const x = prop.x + ((prop.moveTo?.x ?? prop.x) - prop.x) * move;
    const y = prop.y + ((prop.moveTo?.y ?? prop.y) - prop.y) * move;
    const ring = (t * 1.2) % 1;
    return (
      <g transform={`translate(${x} ${y}) scale(${enter})`}>
        <circle
          r={26 + ring * 40}
          fill="none"
          stroke="#F2C14E"
          strokeWidth={4}
          opacity={1 - ring}
        />
        <circle r={26} fill="#F2C14E" stroke="#0B2F5C" strokeWidth={5} />
        <rect x={-74} y={36} width={148} height={38} rx={8} fill="#F2C14E" />
        <text
          x={0}
          y={64}
          textAnchor="middle"
          fontSize={24}
          fontWeight={900}
          fill="#0B2F5C"
          fontFamily={FONT}
        >
          {prop.label}
        </text>
      </g>
    );
  }
  if (prop.kind === "securityCam") {
    const off = cueTime(prop.off, words);
    const dead = pop(t, off, fps);
    const sweep = t < off ? 18 * wave(t, 0.45, prop.x / 500) : 18 * wave(off, 0.45, prop.x / 500);
    const rec = t < off && wave(t, 1.2) > 0 ? 1 : 0.15;
    return (
      <g transform={`translate(${prop.x} ${prop.y}) scale(${enter * (prop.scale ?? 1)})`}>
        <g transform={`rotate(${20 + sweep})`}>
          <path
            d="M 60 0 L 420 -120 L 420 120 Z"
            fill="#F2C14E"
            opacity={0.18 * (1 - Math.min(1, dead))}
          />
          <rect
            x={-50}
            y={-26}
            width={110}
            height={52}
            rx={12}
            fill={dead > 0.5 ? "#7C8699" : "#E9EEF7"}
          />
          <rect x={56} y={-18} width={22} height={36} rx={6} fill="#2A3150" />
          <circle cx={-26} cy={-6} r={7} fill="#FF3B30" opacity={rec} />
        </g>
        <rect x={-8} y={-60} width={16} height={44} rx={6} fill="#C7CCDA" />
        <g transform={`scale(${dead})`} stroke="#FF3B30" strokeWidth={14} strokeLinecap="round">
          <path d="M -60 -60 L 60 60 M 60 -60 L -60 60" />
        </g>
      </g>
    );
  }
  if (prop.kind === "book") {
    const tilt = -4 + 2 * wave(t, 0.4, prop.x / 300);
    return (
      <g
        transform={`translate(${prop.x} ${prop.y}) rotate(${tilt}) scale(${enter * (prop.scale ?? 1)})`}
      >
        <BookShape title={prop.title} />
      </g>
    );
  }
  if (prop.kind === "boat") {
    const go = prop.moveTo ? cueTime(prop.moveTo.at, words) : 0;
    // Arranca despacio y navega ~2,5 s hasta el destino.
    const move = prop.moveTo ? ramp(t, go, go + 2.5) : 0;
    const ease = move * move * (3 - 2 * move);
    const x = prop.x + ((prop.moveTo?.x ?? prop.x) - prop.x) * ease;
    const y = prop.y + ((prop.moveTo?.y ?? prop.y) - prop.y) * ease;
    const from = prop.scale ?? 1;
    const k = from + ((prop.moveTo?.scale ?? from) - from) * ease;
    const bob = 8 * wave(t, 0.6, prop.x / 400);
    const roll = 2.5 * wave(t, 0.45);
    return (
      <g transform={`translate(${x} ${y + bob}) rotate(${roll}) scale(${enter * k})`}>
        <BoatShape loaded={prop.loaded ?? false} t={t} />
      </g>
    );
  }
  if (prop.kind === "phone") {
    const loading =
      prop.loadingAt === undefined
        ? 0
        : ramp(t, cueTime(prop.loadingAt, words), cueTime(prop.loadingAt, words) + 0.25);
    const since =
      prop.loadingAt === undefined ? 0 : Math.max(0, t - cueTime(prop.loadingAt, words));
    const bob = 10 * wave(t, 0.5, 0.3);
    const tilt = 2.5 * wave(t, 0.33);
    return (
      <g
        transform={`translate(${prop.x} ${prop.y + bob}) rotate(${tilt}) scale(${enter * (prop.scale ?? 1)})`}
      >
        <Phone loading={loading} since={since} t={t} />
      </g>
    );
  }
  if (prop.kind !== "question") return null;
  const float = 14 * wave(t, 0.9, prop.x / 300);
  const tilt = 10 * wave(t, 0.6, prop.y / 300);
  return (
    <g
      transform={`translate(${prop.x} ${prop.y + float}) rotate(${tilt}) scale(${enter * (prop.scale ?? 1)})`}
    >
      <Question />
    </g>
  );
}

import type { PropItem } from "./guion";
import { MoneyBagShape } from "./person";
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

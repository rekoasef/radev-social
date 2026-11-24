import type { Setting } from "./guion";
import { wave } from "./timing";

// Escenarios en SVG (1080×1920). Siempre hay algo vivo: estrellas, ventanas, balizas, un reflector.

const FONT = "'Inter Tight Variable', sans-serif";

/** Números pseudoaleatorios fijos: el mismo escenario en cada cuadro y en cada render. */
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

const HORIZON = 1150;

const r = random(7);
const STARS = Array.from({ length: 70 }, () => ({
  x: r() * 1080,
  y: r() * 900,
  size: 1.5 + r() * 2.5,
  hz: 0.3 + r() * 0.8,
  phase: r(),
}));
const BUILDINGS = Array.from({ length: 16 }, (_, i) => {
  const w = 50 + r() * 70;
  const h = 70 + r() * 170;
  const windows = Array.from({ length: Math.floor((w / 18) * (h / 26)) }, (_, j) => ({
    col: j % Math.max(1, Math.floor(w / 18)),
    row: Math.floor(j / Math.max(1, Math.floor(w / 18))),
    on: r() > 0.55,
    hz: 0.05 + r() * 0.15,
    phase: r(),
  }));
  return { x: i * 70 - 30 + r() * 20, w, h, windows };
});

function Plane() {
  // Avión de carga estacionado, sin marca, de perfil.
  return (
    <g transform="translate(70 1000)">
      <ellipse cx={250} cy={148} rx={230} ry={10} fill="#000" opacity={0.35} />
      <path d="M 40 62 L 0 0 L 40 0 L 96 56 Z" fill="#46507A" />
      <rect x={20} y={56} width={420} height={62} rx={31} fill="#59648F" />
      <path d="M 420 56 Q 486 58 498 92 Q 486 118 430 118 Z" fill="#59648F" />
      <path d="M 452 70 Q 478 72 486 88 L 452 88 Z" fill="#9FB6E6" opacity={0.8} />
      <rect x={20} y={96} width={460} height={8} fill="#46507A" />
      {Array.from({ length: 11 }, (_, i) => (
        <circle key={i} cx={90 + i * 30} cy={78} r={5} fill="#F6D98A" opacity={0.9} />
      ))}
      <path d="M 180 104 L 300 104 L 250 136 L 150 136 Z" fill="#3B446B" />
      <rect x={196} y={118} width={64} height={22} rx={11} fill="#2E3657" />
      <rect x={120} y={118} width={6} height={26} fill="#2E3657" />
      <rect x={400} y={118} width={6} height={26} fill="#2E3657" />
      <circle cx={123} cy={146} r={9} fill="#15182A" />
      <circle cx={403} cy={146} r={9} fill="#15182A" />
    </g>
  );
}

function Tower({ t }: { t: number }) {
  const blink = wave(t, 1) > 0.4 ? 1 : 0.15;
  return (
    <g transform="translate(860 700)">
      <rect x={-14} y={60} width={28} height={HORIZON - 760} fill="#2A3150" />
      <path d="M -60 0 L 60 0 L 46 62 L -46 62 Z" fill="#323A5E" />
      <rect x={-50} y={12} width={100} height={30} fill="#8EC7FF" opacity={0.55} />
      <rect x={-6} y={-30} width={12} height={30} fill="#2A3150" />
      <circle cx={0} cy={-34} r={18} fill="#FF3B30" opacity={0.25 * blink} />
      <circle cx={0} cy={-34} r={7} fill="#FF3B30" opacity={blink} />
    </g>
  );
}

function Searchlight({ t }: { t: number }) {
  const angle = -28 + 22 * wave(t, 0.08, 0.2);
  return (
    <g transform={`translate(860 690) rotate(${angle})`} opacity={0.16}>
      <path d="M 0 0 L -1100 -170 L -1100 170 Z" fill="url(#beam)" />
    </g>
  );
}

function Depot({ t }: { t: number }) {
  // El depósito de carga, con la puerta entreabierta y luz que sale al piso.
  const flicker = 0.85 + 0.15 * wave(t, 2.3) * wave(t, 0.7);
  return (
    <g>
      <rect x={540} y={880} width={560} height={HORIZON - 880} fill="#2B3352" />
      <path d="M 520 880 L 1100 880 L 1100 852 L 540 852 Z" fill="#232A45" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={560 + i * 66} y={900} width={44} height={14} rx={3} fill="#1D2338" />
      ))}
      <rect x={622} y={928} width={236} height={48} rx={6} fill="#141A2E" />
      <text
        x={740}
        y={962}
        textAnchor="middle"
        fontSize={30}
        fontWeight={800}
        fill="#F2C14E"
        fontFamily={FONT}
      >
        CARGA 261
      </text>
      <rect x={640} y={1000} width={200} height={HORIZON - 1000} fill="#141A2E" />
      <rect
        x={640}
        y={1000}
        width={110}
        height={HORIZON - 1000}
        fill="#FFD58A"
        opacity={0.85 * flicker}
      />
      <path
        d={`M 640 ${HORIZON} L 750 ${HORIZON} L 860 1420 L 470 1420 Z`}
        fill="url(#spill)"
        opacity={0.55 * flicker}
      />
      <rect x={750} y={1000} width={90} height={HORIZON - 1000} fill="#3A4468" />
    </g>
  );
}

function RunwayLights({
  t,
  y,
  count,
  color,
}: {
  t: number;
  y: number;
  count: number;
  color: string;
}) {
  // Una "ola" de luz que recorre la fila, como las balizas de pista.
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const head = (t * 6) % (count + 4);
        const d = Math.abs(i - head);
        const on = Math.max(0.25, 1 - d / 3);
        const cx = 20 + (i * 1040) / (count - 1);
        return (
          <g key={i}>
            <circle cx={cx} cy={y} r={16} fill={color} opacity={0.18 * on} />
            <circle cx={cx} cy={y} r={6} fill={color} opacity={on} />
          </g>
        );
      })}
    </g>
  );
}

export function AirportNight({ t }: { t: number }) {
  return (
    <g>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#070B1E" />
          <stop offset="1" stopColor="#1E2750" />
        </linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1A2036" />
          <stop offset="1" stopColor="#0D1120" />
        </linearGradient>
        <linearGradient id="spill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD58A" />
          <stop offset="1" stopColor="#FFD58A" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
          <stop offset="1" stopColor="#FFFFFF" />
        </linearGradient>
        <radialGradient id="moonGlow">
          <stop offset="0" stopColor="#F6EFD6" stopOpacity={0.35} />
          <stop offset="1" stopColor="#F6EFD6" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={1080} height={HORIZON} fill="url(#sky)" />
      {STARS.map((s) => (
        <circle
          key={`${s.x}-${s.y}`}
          cx={s.x}
          cy={s.y}
          r={s.size}
          fill="#FFFFFF"
          opacity={0.35 + 0.65 * (0.5 + 0.5 * wave(t, s.hz, s.phase))}
        />
      ))}
      <circle cx={190} cy={360} r={150} fill="url(#moonGlow)" />
      <circle cx={190} cy={360} r={58} fill="#F3ECD2" />
      <circle cx={170} cy={345} r={12} fill="#E2D9BA" />
      <circle cx={212} cy={382} r={8} fill="#E2D9BA" />
      {BUILDINGS.map((b) => (
        <g key={b.x}>
          <rect x={b.x} y={HORIZON - b.h - 120} width={b.w} height={b.h + 120} fill="#141B36" />
          {b.windows.map((w) => (
            <rect
              key={`${w.col}-${w.row}`}
              x={b.x + 6 + w.col * 18}
              y={HORIZON - b.h - 110 + w.row * 26}
              width={8}
              height={12}
              fill="#F6D98A"
              opacity={w.on ? 0.35 + 0.5 * (0.5 + 0.5 * wave(t, w.hz, w.phase)) : 0.06}
            />
          ))}
        </g>
      ))}
      <Searchlight t={t} />
      <Tower t={t} />
      <rect y={HORIZON} width={1080} height={1920 - HORIZON} fill="url(#ground)" />
      <Plane />
      <Depot t={t} />
      {Array.from({ length: 9 }, (_, i) => (
        <rect
          key={i}
          x={i * 130 - 20}
          y={1555}
          width={80}
          height={10}
          rx={5}
          fill="#F4F1EA"
          opacity={0.25}
        />
      ))}
      <RunwayLights t={t} y={1185} count={14} color="#F2C14E" />
      <RunwayLights t={t + 0.7} y={1640} count={10} color="#6EA8FF" />
    </g>
  );
}

export function AlarmRoom({ t }: { t: number }) {
  // Fondo de "alarma": la luz alterna rojo y azul, como en la sala de control.
  const red = 0.5 + 0.5 * Math.tanh(4 * wave(t, 1.2));
  return (
    <g>
      <defs>
        <radialGradient id="alarm" cx="0.5" cy="0.4" r="0.8">
          <stop offset="0" stopColor="#2A2F4A" />
          <stop offset="1" stopColor="#0C0E1A" />
        </radialGradient>
      </defs>
      <rect width={1080} height={1920} fill="url(#alarm)" />
      <rect width={1080} height={1920} fill="#E5383B" opacity={0.22 * red} />
      <rect width={1080} height={1920} fill="#3A6FF2" opacity={0.2 * (1 - red)} />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={i * 96} y={0} width={2} height={1920} fill="#FFFFFF" opacity={0.035} />
      ))}
      <rect y={1420} width={1080} height={500} fill="#0A0C16" opacity={0.7} />
      <rect y={1420} width={1080} height={4} fill="#FFFFFF" opacity={0.08} />
    </g>
  );
}

/** Plano del depósito (estilo blueprint). Las rutas, marcas y cámaras son objetos del guion. */
export function Blueprint({ t }: { t: number }) {
  const line = "#DCEBFF";
  const scan = ((t * 260) % 2200) - 140;
  return (
    <g>
      <defs>
        <radialGradient id="paper" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" stopColor="#1C5DA8" />
          <stop offset="1" stopColor="#0B2F5C" />
        </radialGradient>
        <pattern
          id="vault"
          width={18}
          height={18}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={4} height={18} fill={line} opacity={0.25} />
        </pattern>
        <linearGradient id="scan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8EC7FF" stopOpacity={0} />
          <stop offset="1" stopColor="#8EC7FF" stopOpacity={0.18} />
        </linearGradient>
      </defs>
      <rect width={1080} height={1920} fill="url(#paper)" />
      {Array.from({ length: 28 }, (_, i) => (
        <rect
          key={`v${i}`}
          x={i * 40}
          y={0}
          width={1.5}
          height={1920}
          fill={line}
          opacity={i % 5 === 0 ? 0.16 : 0.06}
        />
      ))}
      {Array.from({ length: 48 }, (_, i) => (
        <rect
          key={`h${i}`}
          x={0}
          y={i * 40}
          width={1080}
          height={1.5}
          fill={line}
          opacity={i % 5 === 0 ? 0.16 : 0.06}
        />
      ))}
      {/* Una línea de escaneo que baja: el plano "se está leyendo". */}
      <rect x={0} y={scan} width={1080} height={140} fill="url(#scan)" />
      <g stroke={line} strokeWidth={7} fill="none" strokeLinejoin="round">
        <path d="M 330 1100 L 940 1100 L 940 560 L 140 560 L 140 1100 L 220 1100" />
        <path d="M 640 560 L 640 720 M 640 800 L 640 820 L 940 820" />
        <path d="M 140 840 L 420 840 L 420 880 M 420 960 L 420 1100" />
        <path d="M 420 700 L 640 700" strokeDasharray="18 14" strokeWidth={4} />
        <rect x={150} y={950} width={130} height={140} strokeWidth={5} />
      </g>
      <rect x={644} y={564} width={292} height={252} fill="url(#vault)" />
      <g fill={line} fontFamily={FONT} fontWeight={800} textAnchor="middle">
        <text x={540} y={530} fontSize={36} letterSpacing={4}>
          DEPÓSITO 261
        </text>
        <text x={790} y={700} fontSize={34}>
          BÓVEDA
        </text>
        <text x={275} y={1150} fontSize={26} opacity={0.8}>
          ENTRADA
        </text>
        <text x={280} y={720} fontSize={24} opacity={0.7}>
          OFICINAS
        </text>
        <text x={680} y={980} fontSize={24} opacity={0.7}>
          CARGA
        </text>
      </g>
      <g stroke={line} strokeWidth={3} opacity={0.5}>
        <path d="M 140 1180 L 940 1180" />
        <path d="M 140 1166 L 140 1194 M 940 1166 L 940 1194" />
      </g>
      <text
        x={540}
        y={1214}
        textAnchor="middle"
        fontSize={22}
        fill={line}
        opacity={0.6}
        fontFamily={FONT}
      >
        80 m
      </text>
    </g>
  );
}

/** La tienda de noche: pared, ventana con la ciudad, estantes con cajas y una lámpara que se mece. */
export function Shop({ t }: { t: number }) {
  const swing = 3 * wave(t, 0.35);
  return (
    <g>
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#221B3F" />
          <stop offset="1" stopColor="#332A58" />
        </linearGradient>
        <radialGradient id="lamp" cx="0.5" cy="0" r="1">
          <stop offset="0" stopColor="#FFD58A" stopOpacity={0.45} />
          <stop offset="1" stopColor="#FFD58A" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={1080} height={1920} fill="url(#wall)" />
      {/* Ventana con la ciudad. */}
      <rect x={90} y={420} width={400} height={420} rx={12} fill="#0B1026" />
      {BUILDINGS.slice(0, 7).map((b) => (
        <g key={b.x} transform="translate(90 420) scale(0.55)">
          <rect x={b.x + 20} y={760 - b.h} width={b.w} height={b.h + 40} fill="#18204A" />
          {b.windows.slice(0, 12).map((w) => (
            <rect
              key={`${w.col}-${w.row}`}
              x={b.x + 26 + w.col * 18}
              y={770 - b.h + w.row * 26}
              width={8}
              height={12}
              fill="#F6D98A"
              opacity={w.on ? 0.3 + 0.6 * (0.5 + 0.5 * wave(t, w.hz, w.phase)) : 0.08}
            />
          ))}
        </g>
      ))}
      <rect
        x={90}
        y={420}
        width={400}
        height={420}
        rx={12}
        fill="none"
        stroke="#4A3F78"
        strokeWidth={18}
      />
      <rect x={281} y={420} width={18} height={420} fill="#4A3F78" />
      {/* Estantes con cajas. */}
      {[560, 760].map((y) => (
        <g key={y}>
          <rect x={600} y={y} width={420} height={14} rx={4} fill="#4A3F78" />
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={620 + i * 100}
              y={y - 70 - (i % 2) * 24}
              width={80}
              height={70 + (i % 2) * 24}
              rx={6}
              fill={["#E07A5F", "#F2C14E", "#81B29A", "#6EA8FF"][(i + (y === 560 ? 0 : 2)) % 4]}
              opacity={0.85}
            />
          ))}
        </g>
      ))}
      {/* Lámpara del techo. */}
      <g transform={`rotate(${swing} 540 0)`}>
        <rect x={538} y={0} width={4} height={250} fill="#4A3F78" />
        <path d="M 480 250 L 600 250 L 570 210 L 510 210 Z" fill="#F2C14E" />
        <path d="M 480 250 L 600 250 L 860 1400 L 220 1400 Z" fill="url(#lamp)" />
      </g>
      <rect y={1360} width={1080} height={560} fill="#191433" />
      <rect y={1360} width={1080} height={6} fill="#FFFFFF" opacity={0.06} />
    </g>
  );
}

export function SetView({ setting, t }: { setting: Setting; t: number }) {
  if (setting === "aeropuerto-noche") return <AirportNight t={t} />;
  if (setting === "plano") return <Blueprint t={t} />;
  if (setting === "tienda") return <Shop t={t} />;
  return <AlarmRoom t={t} />;
}

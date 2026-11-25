import { wave } from "./timing";

// V0-10: lugares genéricos de la biblioteca (1080×1920). Reglas para sumar uno:
// - sin textos fijos (nada de "DEPÓSITO 261": el texto lo pone el guion con etiquetas y cajas);
// - genérico (un banco cualquiera, no el Banco Río), para que sirva a otras historias;
// - siempre algo vivo (luces, agua, nubes) y la línea del piso documentada en catalog.md.

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

const r = random(31);
const SKYLINE = Array.from({ length: 14 }, (_, i) => ({
  x: i * 82 - 20 + r() * 20,
  w: 60 + r() * 60,
  h: 160 + r() * 260,
  lit: Array.from({ length: 10 }, () => ({ on: r() > 0.5, hz: 0.05 + r() * 0.15, phase: r() })),
}));

// --- banco-fachada ---------------------------------------------------------------------------

/** Frente de un banco clásico al atardecer: columnas, escalinata, puerta iluminada. */
export function BankFacade({ t }: { t: number }) {
  const cols = [205, 335, 745, 875];
  const flicker = 0.75 + 0.25 * Math.max(0, wave(t, 2.3)) * (wave(t, 0.37) > 0.6 ? 0.2 : 1);
  return (
    <g>
      <defs>
        <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1E1A3D" />
          <stop offset="0.6" stopColor="#4B356F" />
          <stop offset="1" stopColor="#B0627A" />
        </linearGradient>
        <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8F86C4" />
          <stop offset="1" stopColor="#6C639F" />
        </linearGradient>
        <radialGradient id="streetlamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFD58A" stopOpacity={0.55} />
          <stop offset="1" stopColor="#FFD58A" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={1080} height={1920} fill="url(#dusk)" />
      {/* Nubes que pasan despacio. */}
      {[0, 1, 2].map((i) => {
        const x = ((t * (14 + i * 6) + i * 420) % 1500) - 300;
        return (
          <g key={i} opacity={0.18} fill="#FFFFFF">
            <ellipse cx={x} cy={220 + i * 90} rx={150} ry={34} />
            <ellipse cx={x + 80} cy={200 + i * 90} rx={90} ry={30} />
          </g>
        );
      })}
      {/* Ciudad detrás. */}
      {SKYLINE.map((b) => (
        <g key={b.x}>
          <rect x={b.x} y={1000 - b.h} width={b.w} height={b.h + 200} fill="#2A2350" />
          {b.lit.map((w, j) => (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: posiciones fijas
              key={j}
              x={b.x + 12 + (j % 2) * 26}
              y={1020 - b.h + Math.floor(j / 2) * 40}
              width={12}
              height={18}
              fill="#F6D98A"
              opacity={w.on ? 0.25 + 0.5 * (0.5 + 0.5 * wave(t, w.hz, w.phase)) : 0.06}
            />
          ))}
        </g>
      ))}
      {/* El edificio. */}
      <path d="M 120 640 L 540 470 L 960 640 Z" fill="#7D74B4" />
      <path d="M 200 615 L 540 500 L 880 615 Z" fill="#6C639F" />
      <circle cx={540} cy={575} r={34} fill="#F2C14E" opacity={0.9} />
      <path
        d="M 540 552 L 540 598 M 552 562 Q 528 556 530 570 Q 532 580 548 582 Q 556 592 528 590"
        stroke="#4B356F"
        strokeWidth={6}
        fill="none"
        strokeLinecap="round"
      />
      <rect x={110} y={640} width={860} height={56} fill="#A39AD6" />
      <rect x={140} y={696} width={800} height={480} fill="url(#stone)" />
      {cols.map((x) => (
        <g key={x}>
          <rect x={x - 32} y={696} width={64} height={24} fill="#B3ABE0" />
          <rect x={x - 24} y={720} width={48} height={430} fill="#A39AD6" />
          {[-12, 0, 12].map((d) => (
            <rect
              key={d}
              x={x + d - 2}
              y={730}
              width={3}
              height={410}
              fill="#6C639F"
              opacity={0.5}
            />
          ))}
          <rect x={x - 32} y={1150} width={64} height={26} fill="#B3ABE0" />
        </g>
      ))}
      {/* Ventanas con rejas entre columnas. */}
      {[270, 810].map((x) => (
        <g key={x}>
          <rect x={x - 40} y={780} width={80} height={150} rx={40} fill="#1B1638" />
          <rect
            x={x - 40}
            y={780}
            width={80}
            height={150}
            rx={40}
            fill="#FFD58A"
            opacity={0.25 + 0.15 * wave(t, 0.2, x / 1000)}
          />
          {[-20, 0, 20].map((d) => (
            <rect key={d} x={x + d - 2} y={786} width={4} height={142} fill="#4B356F" />
          ))}
        </g>
      ))}
      {/* Puerta grande con luz adentro. */}
      <rect x={430} y={820} width={220} height={356} rx={10} fill="#2A2350" />
      <rect x={448} y={838} width={184} height={338} rx={6} fill="#FFD58A" opacity={0.55} />
      <rect x={536} y={838} width={8} height={338} fill="#4B356F" />
      <rect x={430} y={790} width={220} height={22} fill="#B3ABE0" />
      {/* Escalinata. */}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={100 - i * 30}
          y={1176 + i * 28}
          width={880 + i * 60}
          height={28}
          fill={["#9C93CF", "#8A81BE", "#776EAA"][i]}
        />
      ))}
      {/* Vereda, cordón y calle. */}
      <rect y={1260} width={1080} height={170} fill="#2E2752" />
      {Array.from({ length: 9 }, (_, i) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: dibujo fijo, el orden nunca cambia
          key={i}
          x={i * 130}
          y={1260}
          width={3}
          height={170}
          fill="#FFFFFF"
          opacity={0.05}
        />
      ))}
      <rect y={1430} width={1080} height={18} fill="#4A3F78" />
      <rect y={1448} width={1080} height={480} fill="#17132C" />
      {Array.from({ length: 6 }, (_, i) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: dibujo fijo, el orden nunca cambia
          key={i}
          x={i * 200 + 30}
          y={1640}
          width={110}
          height={12}
          fill="#F2C14E"
          opacity={0.4}
        />
      ))}
      {/* Farol que titila un poco. */}
      <rect x={1000} y={900} width={10} height={530} fill="#3B3266" />
      <rect x={960} y={890} width={60} height={14} rx={6} fill="#3B3266" />
      <circle cx={966} cy={918} r={16} fill="#FFE3A8" opacity={flicker} />
      <circle cx={966} cy={918} r={160} fill="url(#streetlamp)" opacity={flicker} />
    </g>
  );
}

// --- banco-adentro ---------------------------------------------------------------------------

/** El salón de un banco: mostrador con ventanillas, reloj de pared, piso de baldosas. */
export function BankHall({ t }: { t: number }) {
  const sec = (t * 6) % 360;
  const min = 120 + t * 0.1;
  return (
    <g>
      <defs>
        <linearGradient id="hallwall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#262049" />
          <stop offset="1" stopColor="#3A3166" />
        </linearGradient>
        <radialGradient id="globe" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE3A8" stopOpacity={0.4} />
          <stop offset="1" stopColor="#FFE3A8" stopOpacity={0} />
        </radialGradient>
        <pattern id="tiles" width={120} height={120} patternUnits="userSpaceOnUse">
          <rect width={120} height={120} fill="#2A2350" />
          <rect width={60} height={60} fill="#352C60" />
          <rect x={60} y={60} width={60} height={60} fill="#352C60" />
        </pattern>
      </defs>
      <rect width={1080} height={1920} fill="url(#hallwall)" />
      {/* Molduras de la pared. */}
      {[120, 400, 680].map((x) => (
        <rect
          key={x}
          x={x}
          y={300}
          width={280}
          height={360}
          rx={8}
          fill="none"
          stroke="#4A3F78"
          strokeWidth={6}
        />
      ))}
      {/* Reloj de pared (debajo de y = 520: arriba van los subtítulos). */}
      <g transform="translate(540 612) scale(0.85)">
        <circle r={104} fill="#4A3F78" />
        <circle r={90} fill="#EDE8FA" />
        {Array.from({ length: 12 }, (_, i) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: dibujo fijo, el orden nunca cambia
            key={i}
            x={-3}
            y={-82}
            width={6}
            height={i % 3 === 0 ? 18 : 10}
            fill="#262049"
            transform={`rotate(${i * 30})`}
          />
        ))}
        <rect
          x={-4}
          y={-50}
          width={8}
          height={56}
          rx={4}
          fill="#262049"
          transform={`rotate(${min})`}
        />
        <rect
          x={-3}
          y={-70}
          width={6}
          height={76}
          rx={3}
          fill="#262049"
          transform={`rotate(${min * 12})`}
        />
        <rect x={-1.5} y={-78} width={3} height={90} fill="#E5383B" transform={`rotate(${sec})`} />
        <circle r={7} fill="#E5383B" />
      </g>
      {/* Lámparas de globo. */}
      {[200, 880].map((x, i) => (
        <g key={x}>
          <rect x={x - 2} y={0} width={4} height={170} fill="#4A3F78" />
          <circle cx={x} cy={200} r={34} fill="#FFE3A8" opacity={0.85 + 0.1 * wave(t, 0.3, i)} />
          <circle cx={x} cy={200} r={220} fill="url(#globe)" />
        </g>
      ))}
      {/* Ventanillas: vidrio, separadores y la luz de turno de cada una. */}
      {[0, 1, 2].map((i) => {
        const x = 90 + i * 310;
        const on = wave(t, 0.25, i * 0.33) > 0.3;
        return (
          <g key={i}>
            <rect x={x} y={760} width={280} height={250} fill="#8EC7FF" opacity={0.12} />
            <rect x={x + 30} y={780} width={40} height={220} fill="#FFFFFF" opacity={0.06} />
            <rect x={x + 80} y={780} width={14} height={220} fill="#FFFFFF" opacity={0.05} />
            <circle cx={x + 140} cy={730} r={14} fill={on ? "#81B29A" : "#4A3F78"} />
          </g>
        );
      })}
      {[80, 390, 700, 1010].map((x) => (
        <rect key={x} x={x - 10} y={740} width={20} height={280} fill="#4A3F78" />
      ))}
      {/* Mostrador. */}
      <rect x={40} y={1010} width={1000} height={30} rx={6} fill="#B3ABE0" />
      <rect x={60} y={1040} width={960} height={300} fill="#5B4E92" />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={110 + i * 310}
          y={1080}
          width={240}
          height={220}
          rx={8}
          fill="none"
          stroke="#4A3F78"
          strokeWidth={6}
        />
      ))}
      {/* Piso de baldosas. */}
      <rect y={1340} width={1080} height={580} fill="url(#tiles)" />
      <rect y={1340} width={1080} height={6} fill="#FFFFFF" opacity={0.06} />
    </g>
  );
}

// --- boveda ----------------------------------------------------------------------------------

const rv = random(77);
const BOXES = Array.from({ length: 6 * 9 }, (_, i) => ({
  col: i % 6,
  row: Math.floor(i / 6),
  open: rv() > 0.78,
}));

/** Bóveda: pared de cajas de seguridad (algunas abiertas) y la puerta redonda, abierta. */
export function Vault({ t }: { t: number }) {
  const sheen = ((t * 160) % 1600) - 300;
  const sway = 4 * wave(t, 0.3);
  return (
    <g>
      <defs>
        <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9AA3BD" />
          <stop offset="1" stopColor="#6C7590" />
        </linearGradient>
        <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.22} />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </linearGradient>
        <clipPath id="boxwall">
          <rect x={40} y={540} width={600} height={790} />
        </clipPath>
        <radialGradient id="bulb" cx="0.5" cy="0" r="1">
          <stop offset="0" stopColor="#FFE3A8" stopOpacity={0.35} />
          <stop offset="1" stopColor="#FFE3A8" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={1080} height={1920} fill="#171A2C" />
      <rect x={0} y={480} width={1080} height={880} fill="#20243A" />
      {/* Pared de cajas. */}
      <rect x={30} y={530} width={620} height={810} rx={8} fill="#3A4160" />
      {BOXES.map((b) => {
        const x = 46 + b.col * 99;
        const y = 548 + b.row * 87;
        return (
          <g key={`${b.col}-${b.row}`}>
            <rect
              x={x}
              y={y}
              width={91}
              height={79}
              rx={5}
              fill={b.open ? "#0D0F19" : "url(#steel)"}
            />
            {b.open ? (
              <path
                d={`M ${x} ${y} L ${x - 22} ${y + 10} L ${x - 22} ${y + 69} L ${x} ${y + 79} Z`}
                fill="#8A93AD"
              />
            ) : (
              <g>
                <circle cx={x + 70} cy={y + 40} r={7} fill="#3A4160" />
                <rect x={x + 68} y={y + 40} width={4} height={12} fill="#3A4160" />
                <rect
                  x={x + 14}
                  y={y + 32}
                  width={30}
                  height={14}
                  rx={3}
                  fill="#C7CCDA"
                  opacity={0.7}
                />
              </g>
            )}
          </g>
        );
      })}
      <rect
        x={sheen}
        y={540}
        width={180}
        height={790}
        fill="url(#sheen)"
        clipPath="url(#boxwall)"
      />
      {/* Puerta redonda de la bóveda, abierta hacia la derecha. */}
      <circle cx={870} cy={900} r={190} fill="#3A4160" />
      <circle cx={870} cy={900} r={150} fill="#0D0F19" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: dibujo fijo, el orden nunca cambia
            key={i}
            cx={870 + 170 * Math.cos(a)}
            cy={900 + 170 * Math.sin(a)}
            r={9}
            fill="#9AA3BD"
          />
        );
      })}
      <g transform="translate(1030 900)">
        <ellipse rx={60} ry={200} fill="url(#steel)" />
        <ellipse rx={40} ry={150} fill="#6C7590" />
        {[-90, -30, 30, 90].map((dy) => (
          <rect key={dy} x={-80} y={dy - 8} width={30} height={16} rx={6} fill="#C7CCDA" />
        ))}
      </g>
      {/* Lamparita colgando. */}
      <g transform={`rotate(${sway} 540 0)`}>
        <rect x={538} y={0} width={4} height={360} fill="#3A4160" />
        <circle cx={540} cy={380} r={22} fill="#FFE3A8" />
        <path d="M 540 380 L 980 1400 L 100 1400 Z" fill="url(#bulb)" />
      </g>
      {/* Piso. */}
      <rect y={1340} width={1080} height={580} fill="#10121E" />
      <rect y={1340} width={1080} height={6} fill="#FFFFFF" opacity={0.06} />
    </g>
  );
}

// --- tunel -----------------------------------------------------------------------------------

const VP = { x: 540, y: 860 };
const ARCHES = [1, 0.74, 0.54, 0.39, 0.28, 0.2, 0.14];

/** Arco de túnel centrado en el punto de fuga, a la escala `k` (1 = boca del túnel). */
function arch(k: number): string {
  const w = 620 * k;
  const top = VP.y - 640 * k;
  const bottom = VP.y + 640 * k;
  return `M ${VP.x - w} ${bottom} L ${VP.x - w} ${top + w * 0.6} Q ${VP.x - w} ${top} ${VP.x} ${top} Q ${VP.x + w} ${top} ${VP.x + w} ${top + w * 0.6} L ${VP.x + w} ${bottom}`;
}

const rd = random(5);
const DRIPS = Array.from({ length: 6 }, () => ({
  x: 160 + rd() * 760,
  hz: 0.4 + rd() * 0.5,
  ph: rd(),
}));

/** Desagüe o túnel en perspectiva: agua que corre, gotas, guirnalda de lamparitas. */
export function Tunnel({ t }: { t: number }) {
  return (
    <g>
      <defs>
        <radialGradient id="tunnelend" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#3B4A5E" />
          <stop offset="0.25" stopColor="#1A2230" />
          <stop offset="1" stopColor="#0B0F17" />
        </radialGradient>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1E3A4F" />
          <stop offset="1" stopColor="#2E5A70" />
        </linearGradient>
      </defs>
      <rect width={1080} height={1920} fill="url(#tunnelend)" />
      {/* Anillos del túnel: de afuera hacia el fondo. */}
      {ARCHES.map((k, i) => (
        <path
          key={k}
          d={arch(k)}
          fill="none"
          stroke="#5A4E3E"
          strokeWidth={34 * k}
          opacity={0.9 - i * 0.11}
        />
      ))}
      {/* Ladrillos sugeridos en las paredes. */}
      {Array.from({ length: 10 }, (_, i) => (
        <g
          // biome-ignore lint/suspicious/noArrayIndexKey: dibujo fijo, el orden nunca cambia
          key={i}
          opacity={0.18}
          fill="#C9A27A"
        >
          <rect x={0} y={420 + i * 110} width={70} height={36} />
          <rect x={1010} y={460 + i * 110} width={70} height={36} />
        </g>
      ))}
      {/* Agua: un canal que se angosta hacia el fondo, con ondas que vienen hacia la cámara. */}
      <path
        d={`M 260 1920 L ${VP.x - 40} ${VP.y + 90} L ${VP.x + 40} ${VP.y + 90} L 820 1920 Z`}
        fill="url(#water)"
      />
      {Array.from({ length: 9 }, (_, i) => {
        const p = (i / 9 + t * 0.18) % 1;
        const k = p * p;
        const y = VP.y + 90 + (1920 - VP.y - 90) * k;
        const half = 40 + 240 * k;
        return (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: dibujo fijo, el orden nunca cambia
            key={i}
            x={540 - half * 0.6}
            y={y}
            width={half * 1.2}
            height={2 + 6 * k}
            rx={3}
            fill="#9FD3E8"
            opacity={0.15 + 0.35 * k}
          />
        );
      })}
      {/* Veredas a los costados. */}
      <path d={`M 0 1920 L 0 1480 L ${VP.x - 60} ${VP.y + 80} L 260 1920 Z`} fill="#2B2A30" />
      <path d={`M 1080 1920 L 1080 1480 L ${VP.x + 60} ${VP.y + 80} L 820 1920 Z`} fill="#2B2A30" />
      <path d={`M 260 1920 L ${VP.x - 40} ${VP.y + 90}`} stroke="#4A4650" strokeWidth={8} />
      <path d={`M 820 1920 L ${VP.x + 40} ${VP.y + 90}`} stroke="#4A4650" strokeWidth={8} />
      {/* Guirnalda de lamparitas colgada del techo. */}
      {Array.from({ length: 7 }, (_, i) => {
        const k = ARCHES[i] ?? 0.1;
        const x = VP.x - 420 * k;
        const y = VP.y - 470 * k;
        const on = 0.6 + 0.4 * (0.5 + 0.5 * wave(t, 1.7 + i * 0.3, i * 0.17));
        return (
          <g key={k}>
            <circle cx={x} cy={y} r={60 * k} fill="#FFD58A" opacity={0.12 * on} />
            <circle cx={x} cy={y} r={12 * k + 3} fill="#FFE3A8" opacity={on} />
          </g>
        );
      })}
      <path
        d={ARCHES.map(
          (k, i) => `${i === 0 ? "M" : "L"} ${VP.x - 420 * k} ${VP.y - 470 * k - 12 * k}`,
        ).join(" ")}
        stroke="#1A1A1A"
        strokeWidth={3}
        fill="none"
      />
      {/* Gotas que caen. */}
      {DRIPS.map((d) => {
        const p = (t * d.hz + d.ph) % 1;
        return (
          <ellipse
            key={d.x}
            cx={d.x}
            cy={300 + p * 1200}
            rx={4}
            ry={9}
            fill="#9FD3E8"
            opacity={0.6 * (1 - p)}
          />
        );
      })}
    </g>
  );
}

// --- gomón -----------------------------------------------------------------------------------

/** Gomón con motor fuera de borda, centrado en (0, 0) con la línea del agua en y = 0 (~460 de ancho). */
export function BoatShape({ loaded, t }: { loaded: boolean; t: number }) {
  return (
    <g>
      {loaded && (
        <g>
          {[-120, -20, 80].map((x, i) => (
            <g key={x} transform={`translate(${x} ${-70 - (i % 2) * 14})`}>
              <ellipse rx={52} ry={44} fill="#C9A46A" />
              <path d="M -16 -42 L 16 -42 L 10 -56 L -10 -56 Z" fill="#A88550" />
              <text
                y={14}
                textAnchor="middle"
                fontSize={40}
                fontWeight={900}
                fill="#7A5A2C"
                fontFamily="'Inter Tight Variable', sans-serif"
              >
                $
              </text>
            </g>
          ))}
        </g>
      )}
      <rect x={-230} y={-50} width={440} height={70} rx={35} fill="#E07A5F" />
      <rect x={-230} y={-50} width={440} height={22} rx={11} fill="#F29B83" />
      <rect x={-200} y={-6} width={380} height={8} rx={4} fill="#B85A43" />
      {/* Motor. */}
      <rect x={196} y={-90} width={48} height={60} rx={10} fill="#2A2350" />
      <rect x={212} y={-34} width={14} height={60} fill="#3B3266" />
      <g transform={`translate(219 26) rotate(${(t * 900) % 360})`}>
        <rect x={-18} y={-3} width={36} height={6} rx={3} fill="#9FD3E8" opacity={0.6} />
      </g>
    </g>
  );
}

// --- campo-sierras ---------------------------------------------------------------------------

const rs = random(91);
const TREES = Array.from({ length: 9 }, (_, i) => ({
  x: 40 + i * 125 + rs() * 40,
  y: 1210 + rs() * 60,
  h: 90 + rs() * 70,
}));

/** Campo y sierras de día: cerros en capas, camino de tierra, una casita (escondite) y pájaros. */
export function Hills({ t }: { t: number }) {
  return (
    <g>
      <defs>
        <linearGradient id="daysky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3D5C9E" />
          <stop offset="0.7" stopColor="#8FB4E3" />
          <stop offset="1" stopColor="#F2D9A6" />
        </linearGradient>
      </defs>
      <rect width={1080} height={1920} fill="url(#daysky)" />
      <circle cx={820} cy={640} r={70} fill="#FFE3A8" opacity={0.9} />
      <circle cx={820} cy={640} r={120} fill="#FFE3A8" opacity={0.18} />
      {[0, 1].map((i) => {
        const x = ((t * (10 + i * 7) + i * 600) % 1500) - 300;
        return (
          <g key={i} fill="#FFFFFF" opacity={0.55}>
            <ellipse cx={x} cy={560 + i * 110} rx={130} ry={30} />
            <ellipse cx={x + 70} cy={540 + i * 110} rx={80} ry={28} />
          </g>
        );
      })}
      {/* Pájaros que cruzan. */}
      {[0, 1, 2].map((i) => {
        const x = ((t * 60 + i * 70) % 1400) - 200;
        const flap = 8 * wave(t, 2.5, i * 0.3);
        return (
          <path
            key={i}
            d={`M ${x - 14} ${700 + i * 26 - flap} Q ${x - 6} ${700 + i * 26} ${x} ${704 + i * 26} Q ${x + 6} ${700 + i * 26} ${x + 14} ${700 + i * 26 - flap}`}
            stroke="#2A2350"
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
          />
        );
      })}
      {/* Cerros: de atrás (más claros) hacia adelante. */}
      <path
        d="M 0 980 L 160 820 L 300 900 L 470 760 L 640 880 L 820 790 L 1080 930 L 1080 1920 L 0 1920 Z"
        fill="#7C8FB8"
      />
      <path
        d="M 0 1060 Q 200 930 380 1010 Q 560 1080 760 960 Q 920 880 1080 990 L 1080 1920 L 0 1920 Z"
        fill="#5E7A6E"
      />
      <path
        d="M 0 1180 Q 260 1090 540 1160 Q 800 1220 1080 1130 L 1080 1920 L 0 1920 Z"
        fill="#4F6B4A"
      />
      {/* Casita con la ventana encendida. */}
      <g transform="translate(760 1020)">
        <rect x={0} y={0} width={170} height={110} fill="#C9A27A" />
        <path d="M -16 4 L 85 -70 L 186 4 Z" fill="#8C4A3A" />
        <rect
          x={24}
          y={34}
          width={46}
          height={40}
          fill="#FFD58A"
          opacity={0.6 + 0.3 * wave(t, 0.3)}
        />
        <rect x={104} y={46} width={40} height={64} fill="#5A3A2A" />
      </g>
      {/* Camino de tierra que baja hacia la cámara. */}
      <path
        d="M 520 1150 Q 470 1250 560 1330 Q 680 1440 560 1920 L 880 1920 Q 820 1440 650 1320 Q 560 1250 580 1150 Z"
        fill="#C9A27A"
        opacity={0.85}
      />
      {TREES.map((tr) => (
        <g key={tr.x} transform={`rotate(${1.5 * wave(t, 0.4, tr.x / 300)} ${tr.x} ${tr.y})`}>
          <rect x={tr.x - 6} y={tr.y - 30} width={12} height={34} fill="#5A3A2A" />
          <path
            d={`M ${tr.x - 38} ${tr.y - 24} L ${tr.x} ${tr.y - tr.h} L ${tr.x + 38} ${tr.y - 24} Z`}
            fill="#3E5A3A"
          />
        </g>
      ))}
      <rect y={1360} width={1080} height={560} fill="#435E3F" />
      <rect y={1360} width={1080} height={6} fill="#FFFFFF" opacity={0.08} />
    </g>
  );
}

// --- juzgado ---------------------------------------------------------------------------------

/** Sala de un tribunal: estrado del juez con la balanza, paneles de madera, ventilador de techo. */
export function Courtroom({ t }: { t: number }) {
  const fan = (t * 140) % 360;
  return (
    <g>
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5A3A2A" />
          <stop offset="1" stopColor="#3E281D" />
        </linearGradient>
        <radialGradient id="courtlight" cx="0.5" cy="0" r="1">
          <stop offset="0" stopColor="#FFE3A8" stopOpacity={0.28} />
          <stop offset="1" stopColor="#FFE3A8" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={1080} height={1920} fill="#2A2238" />
      {/* Paneles de madera en la pared. */}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={20 + i * 212}
          y={540}
          width={192}
          height={620}
          rx={8}
          fill="url(#wood)"
          opacity={0.75}
        />
      ))}
      {/* Ventilador de techo. */}
      <g transform="translate(540 200)">
        <rect x={-3} y={-200} width={6} height={200} fill="#1E1828" />
        <g transform={`scale(1 0.25) rotate(${fan})`}>
          {[0, 90, 180, 270].map((a) => (
            <rect
              key={a}
              x={-14}
              y={0}
              width={28}
              height={190}
              rx={10}
              fill="#4A3F58"
              transform={`rotate(${a})`}
            />
          ))}
        </g>
        <circle r={18} fill="#1E1828" />
      </g>
      <path d="M 540 220 L 980 1500 L 100 1500 Z" fill="url(#courtlight)" />
      {/* La balanza sobre el estrado. */}
      <g transform="translate(540 640)" fill="#F2C14E">
        <rect x={-4} y={-70} width={8} height={120} />
        <rect x={-70} y={-62} width={140} height={6} transform={`rotate(${3 * wave(t, 0.3)})`} />
        <path d="M -70 -56 L -96 -6 L -44 -6 Z" opacity={0.85} />
        <path d="M 70 -56 L 44 -6 L 96 -6 Z" opacity={0.85} />
        <rect x={-34} y={46} width={68} height={10} rx={4} />
      </g>
      {/* Estrado del juez. */}
      <rect x={250} y={760} width={580} height={40} rx={6} fill="#7A5038" />
      <rect x={270} y={800} width={540} height={360} fill="url(#wood)" />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={300 + i * 170}
          y={840}
          width={140}
          height={280}
          rx={6}
          fill="none"
          stroke="#7A5038"
          strokeWidth={6}
        />
      ))}
      {/* Baranda de madera delante. */}
      <rect x={0} y={1180} width={1080} height={20} fill="#7A5038" />
      {Array.from({ length: 14 }, (_, i) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: dibujo fijo, el orden nunca cambia
          key={`b${i * 80}`}
          x={20 + i * 78}
          y={1200}
          width={14}
          height={140}
          fill="#5A3A2A"
        />
      ))}
      <rect y={1340} width={1080} height={580} fill="#2E2230" />
      <rect y={1340} width={1080} height={6} fill="#FFFFFF" opacity={0.06} />
    </g>
  );
}

// --- cine ------------------------------------------------------------------------------------

const rc = random(17);
const DUST = Array.from({ length: 26 }, () => ({ x: rc(), y: rc(), hz: 0.05 + rc() * 0.1 }));

/** Sala de cine: pantalla encendida que titila, haz del proyector con polvo y butacas. */
export function Cinema({ t }: { t: number }) {
  const flick = 0.82 + 0.12 * wave(t, 7.3) * wave(t, 2.1, 0.4);
  return (
    <g>
      <defs>
        <linearGradient id="screenlight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E9EEF7" />
          <stop offset="1" stopColor="#B7C4E0" />
        </linearGradient>
        <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#E9EEF7" stopOpacity={0.22} />
          <stop offset="1" stopColor="#E9EEF7" stopOpacity={0.03} />
        </linearGradient>
      </defs>
      <rect width={1080} height={1920} fill="#120E1E" />
      {/* Telón y pantalla. */}
      <rect x={30} y={540} width={1020} height={540} fill="#6E1F2E" />
      {Array.from({ length: 17 }, (_, i) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: dibujo fijo, el orden nunca cambia
          key={`c${i * 60}`}
          x={30 + i * 60}
          y={540}
          width={22}
          height={540}
          fill="#541724"
        />
      ))}
      <rect
        x={110}
        y={580}
        width={860}
        height={460}
        rx={8}
        fill="url(#screenlight)"
        opacity={flick}
      />
      {/* Lo que se proyecta: manchas de luz que pasan (sin imagen concreta). */}
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={110 + ((t * 120 + i * 300) % 860)}
          y={600 + i * 130}
          width={160}
          height={90}
          rx={12}
          fill="#7C8FB8"
          opacity={0.25}
        />
      ))}
      {/* Haz del proyector, desde atrás y arriba, con polvo flotando. */}
      <path d="M 540 1920 L 110 600 L 970 600 Z" fill="url(#beam)" />
      {DUST.map((d) => {
        const y = 1900 - ((t * 40 * d.hz * 10 + d.y * 1300) % 1300);
        const k = (1900 - y) / 1300;
        const x = 540 + (d.x - 0.5) * 860 * k;
        return <circle key={`${d.x}`} cx={x} cy={y} r={2.5} fill="#FFFFFF" opacity={0.35 * k} />;
      })}
      {/* Butacas, tres filas que se oscurecen hacia adelante. */}
      {[0, 1, 2].map((row) => (
        <g key={row}>
          {Array.from({ length: 9 }, (_, i) => (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: dibujo fijo, el orden nunca cambia
              key={`s${i * 120}`}
              x={-20 + i * 124 + (row % 2) * 60}
              y={1180 + row * 110}
              width={104}
              height={120}
              rx={26}
              fill={["#8C2F45", "#7A2638", "#661E2E"][row]}
            />
          ))}
        </g>
      ))}
      <rect y={1500} width={1080} height={420} fill="#0E0A16" />
      {/* Luz verde de salida, sin texto. */}
      <rect x={950} y={470} width={90} height={40} rx={6} fill="#3FAF6A" opacity={0.85} />
    </g>
  );
}

// --- libro -----------------------------------------------------------------------------------

/** Libro parado con título (lo pone el guion), centrado en (0, 0). ~260 × 360. */
export function BookShape({ title }: { title: string }) {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  for (const w of words) {
    const last = lines.at(-1);
    if (last && `${last} ${w}`.length <= 11) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  return (
    <g>
      <rect x={-124} y={-170} width={260} height={360} rx={10} fill="#000" opacity={0.3} />
      <rect x={-130} y={-180} width={260} height={360} rx={10} fill="#2E5BDA" />
      <rect x={-130} y={-180} width={26} height={360} rx={6} fill="#1F3F9E" />
      <rect x={-90} y={-140} width={190} height={4} fill="#F2C14E" />
      {lines.slice(0, 4).map((l, i) => (
        <text
          key={l}
          x={14}
          y={-80 + i * 40}
          textAnchor="middle"
          fontSize={30}
          fontWeight={900}
          fill="#FFFFFF"
          fontFamily="'Inter Tight Variable', sans-serif"
        >
          {l.toUpperCase()}
        </text>
      ))}
      <rect x={-90} y={130} width={190} height={4} fill="#F2C14E" />
    </g>
  );
}

// --- oficina ---------------------------------------------------------------------------------

const ro = random(91);
/** Líneas de "código" de los monitores: sangría, ancho y color fijos (sin texto real). */
const CODE = Array.from({ length: 24 }, () => ({
  indent: Math.floor(ro() * 4) * 22,
  w: 50 + ro() * 160,
  c: ["#7FD1B9", "#8EC7FF", "#F2C14E", "#C3B8F0"][Math.floor(ro() * 4)] ?? "#8EC7FF",
}));
const OFFICE_CITY = Array.from({ length: 9 }, (_, i) => ({
  x: 80 + i * 72 + ro() * 12,
  w: 50 + ro() * 40,
  h: 110 + ro() * 220,
  lit: Array.from({ length: 8 }, () => ({ on: ro() > 0.45, hz: 0.04 + ro() * 0.12, phase: ro() })),
}));
const LINE = 26;

/** Monitor sobre el escritorio, con código que sube. (x, 850) es la esquina de arriba a la izquierda. */
function Monitor({ x, t, seed }: { x: number; t: number; seed: number }) {
  const pos = t * 16 + seed * 140;
  const first = Math.floor(pos / LINE);
  const shift = pos % LINE;
  const clip = `of-screen-${seed}`;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <rect x={x + 14} y={864} width={292} height={162} rx={4} />
        </clipPath>
      </defs>
      <ellipse cx={x + 160} cy={950} rx={260} ry={170} fill="url(#of-glow)" />
      <rect x={x + 148} y={1036} width={24} height={34} fill="#2B3550" />
      <rect x={x + 100} y={1064} width={120} height={10} rx={4} fill="#2B3550" />
      <rect x={x} y={850} width={320} height={190} rx={12} fill="#141A2C" />
      <rect x={x + 14} y={864} width={292} height={162} rx={4} fill="#0F2233" />
      <g clipPath={`url(#${clip})`}>
        {Array.from({ length: 8 }, (_, k) => {
          const line = CODE[(first + k) % CODE.length];
          if (!line) return null;
          return (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: renglones que se reciclan al subir
              key={k}
              x={x + 30 + line.indent}
              y={876 + k * LINE - shift}
              width={line.w}
              height={10}
              rx={5}
              fill={line.c}
              opacity={0.75}
            />
          );
        })}
      </g>
      {/* Cursor que titila. */}
      <rect
        x={x + 30}
        y={1004}
        width={14}
        height={12}
        fill="#E9EEF7"
        opacity={wave(t, 1.1, seed) > 0 ? 0.9 : 0}
      />
    </g>
  );
}

/** Oficina de noche: ventanal a la ciudad, escritorio con dos monitores, taza con vapor, planta. */
export function Office({ t }: { t: number }) {
  const hum = 0.9 + 0.1 * (wave(t, 0.21) > 0.85 ? wave(t, 9) : 1);
  return (
    <g>
      <defs>
        <linearGradient id="of-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1C2540" />
          <stop offset="1" stopColor="#2A3556" />
        </linearGradient>
        <linearGradient id="of-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0D1838" />
          <stop offset="1" stopColor="#2C3F72" />
        </linearGradient>
        <radialGradient id="of-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#8EC7FF" stopOpacity={0.22} />
          <stop offset="1" stopColor="#8EC7FF" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="of-panel" cx="0.5" cy="0" r="0.8">
          <stop offset="0" stopColor="#E9EEF7" stopOpacity={0.16} />
          <stop offset="1" stopColor="#E9EEF7" stopOpacity={0} />
        </radialGradient>
        <clipPath id="of-window">
          <rect x={70} y={560} width={650} height={440} />
        </clipPath>
      </defs>
      <rect width={1080} height={1920} fill="url(#of-wall)" />
      {/* Paneles de luz del techo (uno con el tubo que tiembla). */}
      {[270, 810].map((x, i) => (
        <g key={x} opacity={i === 1 ? hum : 1}>
          <rect x={x - 150} y={30} width={300} height={22} rx={6} fill="#E9EEF7" opacity={0.8} />
          <ellipse cx={x} cy={40} rx={420} ry={700} fill="url(#of-panel)" />
        </g>
      ))}
      {/* Ventanal con la ciudad de noche. */}
      <g clipPath="url(#of-window)">
        <rect x={70} y={560} width={650} height={440} fill="url(#of-sky)" />
        <circle cx={600} cy={650} r={34} fill="#EDE8FA" opacity={0.85} />
        {OFFICE_CITY.map((b) => (
          <g key={b.x}>
            <rect x={b.x} y={1000 - b.h} width={b.w} height={b.h} fill="#18224A" />
            {b.lit.map((w, j) => (
              <rect
                // biome-ignore lint/suspicious/noArrayIndexKey: posiciones fijas
                key={j}
                x={b.x + 10 + (j % 2) * 20}
                y={1014 - b.h + Math.floor(j / 2) * 34}
                width={10}
                height={14}
                fill="#F6D98A"
                opacity={w.on ? 0.25 + 0.5 * (0.5 + 0.5 * wave(t, w.hz, w.phase)) : 0.06}
              />
            ))}
          </g>
        ))}
      </g>
      {[70, 286, 502, 706].map((x) => (
        <rect key={x} x={x} y={556} width={14} height={448} fill="#121A30" />
      ))}
      <rect x={62} y={550} width={666} height={14} fill="#121A30" />
      <rect x={56} y={1000} width={678} height={18} fill="#3A4670" />
      {/* Pizarra con notas de colores y flechas (sin texto). */}
      <rect x={770} y={600} width={250} height={330} rx={10} fill="#E3E7F2" />
      <rect
        x={770}
        y={600}
        width={250}
        height={330}
        rx={10}
        fill="none"
        stroke="#9AA3BF"
        strokeWidth={8}
      />
      {[
        { x: 800, y: 640, c: "#F2C14E", r: -4 },
        { x: 900, y: 650, c: "#7FD1B9", r: 3 },
        { x: 820, y: 760, c: "#F4978E", r: 2 },
        { x: 930, y: 790, c: "#8EC7FF", r: -3 },
      ].map((n, i) => (
        <rect
          key={`${n.x}-${n.y}`}
          x={n.x}
          y={n.y}
          width={64}
          height={64}
          fill={n.c}
          transform={`rotate(${n.r + 1.5 * wave(t, 0.12, i * 0.25)} ${n.x + 32} ${n.y})`}
        />
      ))}
      <path
        d="M 870 690 Q 900 740 880 770 M 868 760 L 880 772 L 892 758 M 880 830 Q 905 870 945 860"
        stroke="#5B6B8C"
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />
      {/* Planta. */}
      <g transform={`rotate(${1.5 * wave(t, 0.18)} 110 1000)`}>
        {[-40, -15, 10, 35].map((a) => (
          <ellipse
            key={a}
            cx={110}
            cy={950}
            rx={16}
            ry={56}
            fill="#4E9F6E"
            transform={`rotate(${a} 110 1000)`}
          />
        ))}
      </g>
      <path d="M 75 1000 L 145 1000 L 135 1070 L 85 1070 Z" fill="#B0627A" />
      {/* Escritorio y monitores. */}
      <Monitor x={190} t={t} seed={1} />
      <Monitor x={600} t={t} seed={2} />
      <rect x={30} y={1070} width={1020} height={28} rx={6} fill="#9B7B58" />
      <rect x={50} y={1098} width={980} height={242} fill="#3D4A6B" />
      {[90, 790].map((x) => (
        <g key={x}>
          <rect
            x={x}
            y={1130}
            width={200}
            height={90}
            rx={8}
            fill="none"
            stroke="#2B3550"
            strokeWidth={6}
          />
          <rect x={x + 80} y={1170} width={40} height={10} rx={5} fill="#2B3550" />
        </g>
      ))}
      {/* Teclados y la taza con vapor. */}
      <rect x={260} y={1058} width={180} height={14} rx={4} fill="#202943" />
      <rect x={670} y={1058} width={180} height={14} rx={4} fill="#202943" />
      <rect x={500} y={1030} width={44} height={42} rx={6} fill="#E3E7F2" />
      <path d="M 544 1040 Q 566 1048 544 1062" stroke="#E3E7F2" strokeWidth={6} fill="none" />
      {[0, 1].map((i) => {
        const k = (t * 0.5 + i * 0.5) % 1;
        return (
          <path
            key={i}
            d={`M ${514 + i * 16} ${1024 - k * 90} q 10 -16 0 -32 q -10 -16 0 -32`}
            stroke="#E9EEF7"
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            opacity={0.35 * (1 - k)}
          />
        );
      })}
      {/* Piso alfombrado. */}
      <rect y={1340} width={1080} height={580} fill="#1A2136" />
      <rect y={1340} width={1080} height={6} fill="#FFFFFF" opacity={0.06} />
    </g>
  );
}

// --- sala-servidores -------------------------------------------------------------------------

const rsv = random(53);
const LED_COLORS = ["#4ADE80", "#4ADE80", "#4ADE80", "#8EC7FF", "#F2C14E"];
/** Seis racks de 12 unidades; cada unidad con 3 luces que titilan a su ritmo. */
const RACKS = Array.from({ length: 6 }, (_, i) => ({
  x: 24 + i * 174,
  units: Array.from({ length: 12 }, () => ({
    empty: rsv() < 0.08,
    leds: Array.from({ length: 3 }, () => ({
      hz: 0.4 + rsv() * 2.6,
      phase: rsv(),
      c: LED_COLORS[Math.floor(rsv() * LED_COLORS.length)] ?? "#4ADE80",
    })),
  })),
}));
const MIST = Array.from({ length: 7 }, () => ({
  y: 1290 + rsv() * 110,
  speed: 18 + rsv() * 22,
  x: rsv(),
}));

/** Centro de datos: fila de racks con luces que titilan, bandeja de cables, piso técnico y aire frío. */
export function ServerRoom({ t }: { t: number }) {
  return (
    <g>
      <defs>
        <linearGradient id="sv-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#070C1A" />
          <stop offset="1" stopColor="#13203A" />
        </linearGradient>
        <radialGradient id="sv-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#4FC3F7" stopOpacity={0.18} />
          <stop offset="1" stopColor="#4FC3F7" stopOpacity={0} />
        </radialGradient>
        <pattern id="sv-floor" width={135} height={90} patternUnits="userSpaceOnUse">
          <rect width={135} height={90} fill="#1A2540" />
          <rect width={135} height={90} fill="none" stroke="#2A3658" strokeWidth={4} />
          {[30, 52, 74, 96].map((x) =>
            [28, 46, 64].map((y) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={3} fill="#121A30" />
            )),
          )}
        </pattern>
      </defs>
      <rect width={1080} height={1920} fill="url(#sv-wall)" />
      <ellipse cx={540} cy={940} rx={760} ry={620} fill="url(#sv-glow)" />
      {/* Tiras de luz del techo. */}
      {[180, 540, 900].map((x) => (
        <rect
          key={x}
          x={x - 130}
          y={36}
          width={260}
          height={14}
          rx={7}
          fill="#BFE6FF"
          opacity={0.55}
        />
      ))}
      {/* Bandeja de cables, con cables de colores que cuelgan. */}
      <rect x={0} y={480} width={1080} height={26} fill="#2E3A5A" />
      {[
        { x: 110, c: "#F2C14E" },
        { x: 300, c: "#8EC7FF" },
        { x: 470, c: "#F4978E" },
        { x: 650, c: "#7FD1B9" },
        { x: 820, c: "#C3B8F0" },
        { x: 990, c: "#F2C14E" },
      ].map((w, i) => (
        <path
          key={w.x}
          d={`M ${w.x - 40} 506 Q ${w.x} ${560 + 6 * wave(t, 0.2, i * 0.3)} ${w.x + 40} 506`}
          stroke={w.c}
          strokeWidth={6}
          fill="none"
        />
      ))}
      {/* Racks. */}
      {RACKS.map((rack) => (
        <g key={rack.x}>
          <rect x={rack.x} y={560} width={164} height={780} rx={6} fill="#1E2840" />
          <rect x={rack.x} y={560} width={164} height={30} rx={6} fill="#2B3550" />
          {rack.units.map((u, j) => {
            const y = 600 + j * 60;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: unidades fijas del rack
              <g key={j}>
                <rect
                  x={rack.x + 10}
                  y={y}
                  width={144}
                  height={52}
                  rx={4}
                  fill={u.empty ? "#121A2E" : "#26324F"}
                />
                {!u.empty && (
                  <>
                    {[0, 1, 2].map((g) => (
                      <rect
                        key={g}
                        x={rack.x + 20}
                        y={y + 12 + g * 12}
                        width={70}
                        height={4}
                        rx={2}
                        fill="#121A2E"
                      />
                    ))}
                    {u.leds.map((led, k) => (
                      <circle
                        // biome-ignore lint/suspicious/noArrayIndexKey: luces fijas de la unidad
                        key={k}
                        cx={rack.x + 108 + k * 16}
                        cy={y + 26}
                        r={5}
                        fill={led.c}
                        opacity={wave(t, led.hz, led.phase) > -0.2 ? 0.95 : 0.15}
                      />
                    ))}
                  </>
                )}
              </g>
            );
          })}
        </g>
      ))}
      {/* Piso técnico y aire frío que corre abajo. */}
      <rect y={1340} width={1080} height={580} fill="url(#sv-floor)" />
      <rect y={1340} width={1080} height={6} fill="#BFE6FF" opacity={0.12} />
      {MIST.map((m) => {
        const x = ((t * m.speed + m.x * 1500) % 1500) - 250;
        return <ellipse key={m.x} cx={x} cy={m.y} rx={240} ry={26} fill="#9FD8FF" opacity={0.07} />;
      })}
    </g>
  );
}

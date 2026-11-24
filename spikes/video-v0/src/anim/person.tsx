import type { Actor, Outfit } from "./guion";
import { blink, cueTime, pop, ramp, type Word, wave } from "./timing";

// Una personita en SVG, plana, con las piezas separadas (piernas, brazos, cabeza) para que el
// código las mueva en cada cuadro. Los pies están en (0, 0); mira a la derecha y se espeja para
// mirar a la izquierda. Mide ~290 px a escala 1.

type Colors = { top: string; topDark: string; legs: string; shoes: string; skin: string };

const OUTFITS: Record<Outfit, Colors> = {
  ladron: {
    top: "#2B2D3A",
    topDark: "#1E1F29",
    legs: "#1A1B24",
    shoes: "#0E0E14",
    skin: "#E8B48F",
  },
  guardia: {
    top: "#2F4A8A",
    topDark: "#243A6E",
    legs: "#1F2D52",
    shoes: "#111522",
    skin: "#C98E68",
  },
  civil: { top: "#8FB4E3", topDark: "#7397C4", legs: "#3B4252", shoes: "#1C1F27", skin: "#F0C29E" },
};

type Pose = "idle" | "lookWatch" | "scratchHead" | "panic";

export type ActorState = {
  x: number;
  visible: boolean;
  appear: number;
  walking: boolean;
  phase: number;
  facing: 1 | -1;
  pose: Pose;
  /** 0..1: cuánto de la pose (para entrar y salir suave). */
  poseAmount: number;
  carrying: number;
};

/** Dónde está y qué hace un personaje en el segundo `t` de la escena, según el guion. */
export function actorState(actor: Actor, t: number, words: Word[], fps: number): ActorState {
  const enterAt = actor.enter === undefined ? -1 : cueTime(actor.enter, words);
  let x = actor.x;
  let walking = false;
  let traveled = 0;
  let facing: 1 | -1 = actor.facing === "left" ? -1 : 1;
  let pose: Pose = "idle";
  let poseAmount = 0;
  let carrying = 0;
  let popAt: number | undefined;
  for (const action of actor.actions ?? []) {
    const at = cueTime(action.at, words);
    if (action.do === "walk") {
      const speed = action.speed ?? 240;
      const distance = Math.abs(action.toX - x);
      const dur = distance / speed;
      if (t < at) break;
      const dir = action.toX >= x ? 1 : -1;
      if (t < at + dur) {
        traveled += (t - at) * speed;
        x += dir * (t - at) * speed;
        walking = true;
        facing = dir as 1 | -1;
        break;
      }
      traveled += distance;
      x = action.toX;
      continue;
    }
    if (action.do === "carry") {
      carrying = Math.max(carrying, pop(t, at, fps));
      continue;
    }
    if (action.do === "pop") {
      popAt = at;
      continue;
    }
    const end =
      action.until === undefined ? Number.POSITIVE_INFINITY : cueTime(action.until, words);
    if (t >= at - 0.3 && t < end + 0.3) {
      pose = action.do;
      const leave = Number.isFinite(end) ? ramp(t, end - 0.15, end + 0.15) : 0;
      poseAmount = Math.min(ramp(t, at - 0.15, at + 0.15), 1 - leave);
    }
  }
  return {
    x,
    visible: t >= enterAt,
    appear: popAt === undefined ? 1 : pop(t, popAt, fps),
    walking,
    phase: traveled / 150,
    facing,
    pose,
    poseAmount,
    carrying,
  };
}

function Arm({
  angle,
  sleeve,
  skin,
  watch,
}: {
  angle: number;
  sleeve: string;
  skin: string;
  watch?: boolean;
}) {
  return (
    <g transform={`rotate(${angle})`}>
      <rect x={-11} y={-6} width={22} height={88} rx={11} fill={sleeve} />
      {watch ? <rect x={-12} y={62} width={24} height={9} rx={3} fill="#F2C14E" /> : null}
      <circle cx={0} cy={86} r={12} fill={skin} />
    </g>
  );
}

function Leg({ angle, color, shoe }: { angle: number; color: string; shoe: string }) {
  return (
    <g transform={`rotate(${angle})`}>
      <rect x={-13} y={-4} width={26} height={100} rx={12} fill={color} />
      <ellipse cx={9} cy={98} rx={21} ry={10} fill={shoe} />
    </g>
  );
}

function Headwear({ outfit }: { outfit: Outfit }) {
  if (outfit === "ladron") {
    // Gorro de lana y antifaz.
    return (
      <g>
        <path d="M -40 -250 A 40 40 0 0 1 40 -250 L 40 -244 L -40 -244 Z" fill="#14151C" />
        <rect x={-42} y={-256} width={84} height={14} rx={7} fill="#2A2C38" />
        <circle cx={0} cy={-292} r={8} fill="#2A2C38" />
        <rect x={-8} y={-246} width={50} height={17} rx={8} fill="#0B0B10" />
      </g>
    );
  }
  if (outfit === "guardia") {
    return (
      <g>
        <path d="M -38 -258 Q -36 -296 4 -296 Q 40 -296 38 -258 Z" fill="#243A6E" />
        <rect x={-40} y={-262} width={80} height={12} rx={4} fill="#1A2B55" />
        <path d="M 10 -254 L 58 -250 Q 56 -242 12 -244 Z" fill="#111A33" />
        <circle cx={0} cy={-276} r={7} fill="#F2C14E" />
      </g>
    );
  }
  return (
    <path d="M -38 -252 Q -34 -294 2 -292 Q 36 -292 40 -256 Q 20 -268 -38 -252 Z" fill="#4A3426" />
  );
}

export function Person({
  actor,
  state,
  t,
  seed,
}: {
  actor: Actor;
  state: ActorState;
  t: number;
  seed: number;
}) {
  if (!state.visible) return null;
  const c = OUTFITS[actor.outfit];
  const s = (actor.scale ?? 1) * state.appear;
  const cycle = Math.sin(state.phase * Math.PI * 2);
  const legSwing = state.walking ? 28 * cycle : 0;
  const armSwing = state.walking ? 26 * cycle : 4 * wave(t, 0.4, seed);
  const bob = state.walking ? -Math.abs(cycle) * 8 : 0;
  // Respira y se balancea un poco aunque esté quieto: nunca queda congelado.
  const sway = state.walking ? 3 : 1.6 * wave(t, 0.35, seed * 0.13);
  const breathe = 1 + 0.012 * wave(t, 0.3, seed * 0.29);
  const a = state.poseAmount;
  let front = armSwing;
  let back = -armSwing;
  let headTilt = 0;
  let mouthOpen = 0;
  if (state.pose === "lookWatch") {
    front = armSwing * (1 - a) + -118 * a;
    headTilt = 14 * a;
  } else if (state.pose === "scratchHead") {
    back = back * (1 - a) + (-160 + 12 * wave(t, 3)) * a;
    headTilt = -8 * a;
    mouthOpen = 0.4 * a;
  } else if (state.pose === "panic") {
    front = front * (1 - a) + (-165 + 10 * wave(t, 4)) * a;
    back = back * (1 - a) + (-150 + 10 * wave(t, 4, 0.5)) * a;
    mouthOpen = a;
  }
  if (state.carrying > 0) front = front * (1 - state.carrying) + 8 * state.carrying;
  const eyes = blink(t, seed);
  return (
    <g transform={`translate(${state.x} ${actor.y}) scale(${s * state.facing} ${s})`}>
      <ellipse cx={0} cy={4} rx={50} ry={10} fill="#000" opacity={0.28} />
      <g transform={`translate(0 ${bob}) rotate(${sway})`}>
        {/* Atrás: brazo y pierna del fondo, más oscuros. */}
        <g transform="translate(-14 -104)">
          <Leg angle={-legSwing} color={c.legs} shoe={c.shoes} />
        </g>
        <g transform="translate(-26 -196)">
          <Arm angle={back} sleeve={c.topDark} skin={c.skin} />
        </g>
        <g transform="translate(14 -104)">
          <Leg angle={legSwing} color={c.legs} shoe={c.shoes} />
        </g>
        <g transform={`scale(1 ${breathe})`} style={{ transformOrigin: "0px -100px" }}>
          <rect x={-42} y={-212} width={84} height={120} rx={26} fill={c.top} />
          {actor.outfit === "guardia" ? (
            <>
              <rect x={-42} y={-112} width={84} height={12} fill="#16203D" />
              <path d="M 14 -184 l 9 -6 l 9 6 l -3 12 l -12 0 Z" fill="#F2C14E" />
            </>
          ) : null}
          {actor.outfit === "ladron" ? (
            <rect x={-4} y={-208} width={8} height={100} rx={4} fill="#1A1B24" />
          ) : null}
          <rect x={-10} y={-226} width={20} height={20} rx={6} fill={c.skin} />
        </g>
        <g transform={`rotate(${headTilt} 0 -224)`}>
          <circle cx={0} cy={-252} r={40} fill={c.skin} />
          <circle cx={-34} cy={-250} r={9} fill={c.skin} />
          {/* Ojos (con antifaz, se ven blancos) y boca, del lado al que mira. */}
          <ellipse
            cx={12}
            cy={-238}
            rx={5}
            ry={6 * eyes}
            fill={actor.outfit === "ladron" ? "#F4F1EA" : "#1B1B22"}
          />
          <ellipse
            cx={30}
            cy={-238}
            rx={4.5}
            ry={5.5 * eyes}
            fill={actor.outfit === "ladron" ? "#F4F1EA" : "#1B1B22"}
          />
          {mouthOpen > 0.2 ? (
            <ellipse cx={24} cy={-218} rx={6} ry={4 + 6 * mouthOpen} fill="#3A1A1A" />
          ) : (
            <path
              d="M 16 -220 Q 24 -215 32 -220"
              stroke="#3A1A1A"
              strokeWidth={3.5}
              fill="none"
              strokeLinecap="round"
            />
          )}
          <Headwear outfit={actor.outfit} />
        </g>
        <g transform="translate(26 -196)">
          <Arm angle={front} sleeve={c.top} skin={c.skin} watch={actor.outfit === "guardia"} />
          {state.carrying > 0 ? (
            <g transform={`rotate(${front}) translate(0 96) scale(${state.carrying})`}>
              <MoneyBagShape size={0.55} />
            </g>
          ) : null}
        </g>
      </g>
    </g>
  );
}

/** Bolsa de dinero (también la usa el escenario como objeto suelto). */
export function MoneyBagShape({ size = 1 }: { size?: number }) {
  return (
    <g transform={`scale(${size})`}>
      <path
        d="M -30 -8 Q -78 40 -64 92 Q -52 130 0 130 Q 52 130 64 92 Q 78 40 30 -8 Z"
        fill="#C9A26B"
      />
      <path d="M -30 -8 Q 0 6 30 -8 L 22 -24 Q 0 -14 -22 -24 Z" fill="#A5814F" />
      <path d="M -22 -24 Q -34 -46 -14 -42 Q 0 -54 14 -42 Q 34 -46 22 -24 Z" fill="#C9A26B" />
      <text
        x={0}
        y={92}
        textAnchor="middle"
        fontSize={72}
        fontWeight={900}
        fill="#6B5230"
        fontFamily="'Inter Tight Variable', sans-serif"
      >
        $
      </text>
    </g>
  );
}

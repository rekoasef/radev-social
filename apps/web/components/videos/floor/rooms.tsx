import type { WorkingStage } from "@radev/core";
import type { Floor, OfficeMode, OfficeRoom, RoomId } from "@/lib/video-floor";
import {
  Bubble,
  C,
  Chair,
  Desk,
  DoorSign,
  Glow,
  MONO,
  Papers,
  Person,
  Plant,
  Robot,
  SANS,
  type SignState,
} from "./props";

export type Box = { x: number; y: number; w: number; h: number };
export type Door = ["top" | "bottom" | "left" | "right", number];

export const OFFICE_NAME: Record<WorkingStage, { n: number; name: string }> = {
  researching: { n: 1, name: "Investigación" },
  checking_sources: { n: 2, name: "Fuentes" },
  finding_images: { n: 3, name: "Imágenes" },
  scripting: { n: 4, name: "Guion" },
  checking_facts: { n: 5, name: "Verificación" },
  voicing: { n: 6, name: "Locución" },
  rendering: { n: 7, name: "Render" },
  packaging: { n: 8, name: "Publicación" },
};

const SIGN_OF: Record<OfficeMode, SignState> = {
  idle: "off",
  queued: "standby",
  working: "live",
  paused: "timed",
  fail: "fail",
};

const FLOOR_OF: Record<RoomId | "lobby", string> = {
  lobby: "wood2",
  researching: "wood",
  checking_sources: "carpet",
  finding_images: "tile",
  scripting: "wood2",
  checking_facts: "carpet",
  desk: "concrete",
  voicing: "foam",
  rendering: "tile",
  packaging: "wood",
  archive: "carpet",
};

/** Where the folder of a room lies: on its desk. */
export function folderSpot(room: RoomId, b: Box, phone: boolean): { x: number; y: number } {
  const dx = b.x + b.w * 0.46;
  const dy = b.y + b.h * (room === "rendering" && phone ? 0.72 : 0.64);
  if (room === "desk") return { x: b.x + b.w / 2 + 49, y: b.y + b.h * 0.56 - 1 };
  if (room === "archive") return { x: b.x + b.w * 0.34 + (phone ? 6 : 0), y: b.y + b.h * 0.66 };
  if (room === "rendering") return { x: b.x + b.w * (phone ? 0.72 : 0.66) + 26, y: dy + 4 };
  return { x: dx - 30, y: dy };
}

/** Floor, walls, doors and the dark of a room whose light is off. */
function Shell({
  b,
  p,
  floor,
  lit,
  doors,
  glass = false,
  children,
}: {
  b: Box;
  p: string;
  floor: string;
  lit: boolean;
  doors: Door[];
  glass?: boolean;
  children: React.ReactNode;
}) {
  const { x, y, w, h } = b;
  const gap = 34;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${p}-${floor})`} />
      {children}
      {!lit && <rect x={x} y={y} width={w} height={h} fill="#05070a" opacity=".5" />}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke={glass ? "#5f7a92" : C.wall}
        strokeWidth={glass ? 3 : 6}
      />
      {doors.map(([side, at]) => (
        <rect
          key={`${side}-${at}`}
          fill={C.corridor}
          {...(side === "top" || side === "bottom"
            ? {
                x: x + w * at - gap / 2,
                y: side === "top" ? y - 4 : y + h - 4,
                width: gap,
                height: 8,
              }
            : {
                x: side === "left" ? x - 4 : x + w - 4,
                y: y + h * at - gap / 2,
                width: 8,
                height: gap,
              })}
        />
      ))}
    </>
  );
}

type OfficeProps = {
  stage: WorkingStage;
  room: OfficeRoom;
  b: Box;
  p: string;
  phone: boolean;
  /** Scale of the furniture. */
  k: number;
};

/** What is inside each office, apart from the walls and the sign. */
function Furniture({ stage, room, b, p, phone, k }: OfficeProps) {
  const working = room.mode === "working";
  const screen = room.mode === "fail" ? "alarm" : working ? "on" : "off";
  const dx = b.x + b.w * 0.46;
  const dy = b.y + b.h * 0.64;
  const station = (x: number, y: number) =>
    `translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})`;
  const seated = (shirt: string, skin: number, hair: number) => (
    <>
      <Chair x={dx} y={dy + 26} />
      <Person x={dx} y={dy + 24} p={p} shirt={shirt} skin={skin} hair={hair} typing={working} />
    </>
  );
  const light = (x: number, y: number) =>
    room.mode === "fail" ? (
      <Glow x={x} y={y} r={120} p={p} kind="alarm" />
    ) : working ? (
      <Glow x={x} y={y} r={125} p={p} kind={stage === "rendering" ? "cool" : "lamp"} />
    ) : null;
  const bubble = room.bubble && (
    <Bubble
      x={dx + 34}
      y={dy - 30}
      p={p}
      text={phone ? room.bubble.replace("intento ", "") : room.bubble}
      kind={room.mode === "fail" ? "alarm" : "say"}
    />
  );

  if (stage === "researching") {
    const colors = ["#8a4b3c", "#3f6b8a", "#c9a24b", "#5a7d4f", "#7a5a8f", "#b46b3c", "#4a5a7a"];
    return (
      <>
        <rect x={b.x + b.w - 26} y={b.y + 12} width="16" height={b.h - 24} fill="#2a1f17" />
        {Array.from({ length: Math.floor((b.h - 32) / 8) }, (_, i) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: books on a shelf, never reordered
            key={i}
            x={b.x + b.w - 23}
            y={b.y + 16 + i * 8}
            width="10"
            height="6"
            fill={colors[i % colors.length]}
          />
        ))}
        {light(dx, dy)}
        <g transform={station(dx, dy)}>
          <Desk x={dx} y={dy} p={p} w={72} screen={screen} />
          <Papers x={dx + 4} y={dy - 4} />
          <circle
            cx={dx + 27}
            cy={dy - 4}
            r="7"
            fill="#3f6b8a"
            stroke="#c9a24b"
            strokeWidth="1.5"
          />
          {seated("#6d5a8f", 0, 1)}
          {room.mode === "idle" && (
            <g fill="#a3a9b4" fontWeight="600" style={{ fontFamily: SANS }}>
              <text x={dx + 16} y={dy + 18} fontSize="10">
                z
              </text>
              <text x={dx + 23} y={dy + 10} fontSize="13">
                z
              </text>
              <text x={dx + 32} y={dy - 1} fontSize="16">
                Z
              </text>
            </g>
          )}
          {bubble}
        </g>
      </>
    );
  }
  if (stage === "checking_sources") {
    return (
      <>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect
              x={b.x + b.w - 44}
              y={b.y + 10 + i * 30}
              width="28"
              height="26"
              rx="2"
              fill={C.metal}
              stroke="#3a414e"
            />
            <rect
              x={b.x + b.w - 35}
              y={b.y + 30 + i * 30}
              width="10"
              height="2.4"
              fill={C.metalHi}
            />
          </g>
        ))}
        {light(dx, dy)}
        <g transform={station(dx, dy)}>
          <Desk x={dx} y={dy} p={p} w={66} h={30} screen={screen} />
          <Papers x={dx + 8} y={dy - 2} n={3} />
          <Robot x={dx} y={dy + 26} p={p} />
          {bubble}
        </g>
      </>
    );
  }
  if (stage === "finding_images") {
    const px = b.x + b.w - 90;
    const photos = ["#6d7f8f", "#b9a27f", "#4d5a66", "#8f7b5c", "#a3a9b4", "#5c4c3e"];
    return (
      <>
        <rect x={px} y={b.y + 10} width="78" height="50" rx="2" fill="#5a4632" />
        {photos.map((fill, i) => (
          <rect
            key={fill}
            x={px + 5 + (i % 3) * 25}
            y={b.y + 15 + Math.floor(i / 3) * 22}
            width="20"
            height="17"
            fill={fill}
            stroke="#eee"
            strokeWidth="1.5"
          />
        ))}
        {light(dx, dy)}
        <g transform={station(dx, dy)}>
          <Desk x={dx} y={dy} p={p} w={72} screen={screen} />
          {seated("#8f4f4f", 2, 2)}
          {bubble}
        </g>
      </>
    );
  }
  if (stage === "scripting") {
    return (
      <>
        {light(dx, dy)}
        <g transform={station(dx, dy)}>
          <Desk x={dx} y={dy} p={p} w={74} h={34} screen={screen} />
          {seated("#3f7a6a", 3, 0)}
          {bubble}
        </g>
        <circle cx={b.x + b.w - 34} cy={b.y + b.h - 30} r="10" fill="#2a2f38" stroke="#4a5161" />
        <circle cx={b.x + b.w - 52} cy={b.y + b.h - 22} r="5" fill={C.paper} />
      </>
    );
  }
  if (stage === "checking_facts") {
    return (
      <>
        <rect
          x={b.x + b.w - 70}
          y={b.y + 12}
          width="56"
          height="36"
          rx="2"
          fill={C.paper}
          opacity=".85"
        />
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M${b.x + b.w - 64} ${b.y + 20 + i * 7}h6l2 2 4-4M${b.x + b.w - 50} ${b.y + 20 + i * 7}h28`}
            stroke="#3f7a4f"
            strokeWidth="1.6"
            fill="none"
          />
        ))}
        {light(dx, dy)}
        <g transform={station(dx, dy)}>
          <Desk x={dx} y={dy} p={p} w={66} h={30} screen={screen} />
          <Papers x={dx - 2} y={dy - 3} />
          <circle cx={dx + 20} cy={dy} r="6" fill="none" stroke="#c9cdd4" strokeWidth="2" />
          <line
            x1={dx + 24}
            y1={dy + 4}
            x2={dx + 30}
            y2={dy + 10}
            stroke="#c9cdd4"
            strokeWidth="2.4"
          />
          {seated("#4f6d8f", 1, 3)}
          {bubble}
        </g>
      </>
    );
  }
  if (stage === "voicing") {
    const cx = b.x + b.w * 0.5;
    const cy = b.y + b.h * 0.6;
    return (
      <>
        {light(cx, cy)}
        <g transform={station(cx, cy)}>
          <rect
            x={cx - 50}
            y={cy - 34}
            width="100"
            height="68"
            rx="6"
            fill="#1b1626"
            stroke="#3d3354"
          />
          <line x1={cx} y1={cy - 6} x2={cx + 26} y2={cy - 22} stroke="#9aa3b2" strokeWidth="2.4" />
          <circle cx={cx + 28} cy={cy - 23} r="5" fill="#c9cdd4" />
          <Chair x={cx} y={cy + 18} />
          <Person x={cx} y={cy + 16} p={p} shirt="#8f7a4f" skin={1} />
        </g>
        {!phone && (
          <>
            <rect
              x={b.x + b.w - 74}
              y={b.y + 14}
              width="58"
              height="20"
              rx="3"
              fill="#1a0f12"
              stroke="#4a2a30"
            />
            <text
              x={b.x + b.w - 45}
              y={b.y + 28}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              letterSpacing="1.4"
              fill={working ? "#f2555a" : "#5a3138"}
              style={{ fontFamily: SANS }}
            >
              ON AIR
            </text>
          </>
        )}
      </>
    );
  }
  if (stage === "rendering") {
    const racks = phone ? 2 : 4;
    const sx = phone ? b.x + b.w - 92 : b.x + b.w - 200;
    const sy = phone ? b.y + 56 : b.y + 14;
    const sw = phone ? 80 : 180;
    const rx = b.x + b.w * (phone ? 0.72 : 0.66);
    const ry = phone ? b.y + b.h * 0.72 : dy;
    return (
      <>
        {Array.from({ length: racks }, (_, i) => {
          const x = b.x + 18 + i * 34;
          const y = b.y + 60;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed server racks
            <g key={i}>
              <rect
                x={x}
                y={y}
                width="24"
                height={b.h - 68}
                rx="2"
                fill="#1a1e26"
                stroke="#3a414e"
              />
              {Array.from({ length: 8 }, (_, j) => (
                <circle
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed LEDs
                  key={j}
                  cx={x + 6 + (j % 2) * 12}
                  cy={y + 10 + Math.floor(j / 2) * 16}
                  r="1.8"
                  fill={j % 3 ? "#3dd68c" : "#7fb4e8"}
                  className={working ? `floor-led floor-led-${(i + j) % 3}` : undefined}
                />
              ))}
            </g>
          );
        })}
        {room.percent !== null && (
          <g style={{ fontFamily: MONO }} fontSize="10">
            <rect x={sx} y={sy} width={sw} height="40" rx="3" fill="#0b0e13" stroke="#3a414e" />
            <text x={sx + 8} y={sy + 16} fill="#7fb4e8">
              {phone ? room.format : `RENDER ${room.format}`}
            </text>
            <text x={sx + sw - 8} y={sy + 16} textAnchor="end" fill="#e8eaed">
              {room.percent} %
            </text>
            <rect x={sx + 8} y={sy + 24} width={sw - 16} height="6" rx="3" fill="#1e232b" />
            <rect
              x={sx + 8}
              y={sy + 24}
              width={((sw - 16) * room.percent) / 100}
              height="6"
              rx="3"
              fill="#7fb4e8"
            />
          </g>
        )}
        {light(rx, ry - 10)}
        <g transform={station(rx, ry)}>
          <Desk x={rx} y={ry} p={p} h={30} screen={screen} />
          <Robot x={rx} y={ry + 26} p={p} />
        </g>
        {room.bubble && <Bubble x={rx} y={ry - 36} p={p} text={room.bubble} kind="alarm" />}
      </>
    );
  }
  const px = b.x + b.w - (phone ? 70 : 120);
  return (
    <>
      <rect x={px} y={b.y + 14} width={phone ? 58 : 104} height="40" rx="2" fill="#5a4632" />
      <rect
        x={px + 6}
        y={b.y + 20}
        width="36"
        height="22"
        fill="#3f6b8a"
        stroke="#eee"
        strokeWidth="1.5"
      />
      {light(dx, dy)}
      <g transform={station(dx, dy)}>
        <Desk x={dx} y={dy} p={p} h={30} screen={screen} />
        <Papers x={dx + 2} y={dy - 3} />
        <rect x={dx + 18} y={dy - 6} width="10" height="14" rx="2" fill="#8a4b3c" />
        {seated("#5a7d4f", 2, 1)}
        {bubble}
      </g>
    </>
  );
}

export function Office({
  doors,
  sign = true,
  ...props
}: OfficeProps & { doors: Door[]; sign?: boolean }) {
  const { stage, room, b, p, phone } = props;
  const { n, name } = OFFICE_NAME[stage];
  const lit = room.mode === "working" || room.mode === "fail";
  return (
    <>
      <Shell b={b} p={p} floor={FLOOR_OF[stage]} lit={lit} doors={doors}>
        <Furniture {...props} />
      </Shell>
      {sign && (
        <DoorSign
          x={b.x + 12}
          y={b.y + 12}
          n={n}
          name={name}
          state={SIGN_OF[room.mode]}
          status={phone ? room.short : room.status}
        />
      )}
    </>
  );
}

type Place = { b: Box; p: string; phone: boolean; k: number; doors: Door[] };

/** Your glass office: an empty chair, the two trays and the amber light when something waits. */
export function YourDesk({ desk, b, p, phone, k, doors }: Place & { desk: Floor["desk"] }) {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h * 0.56;
  const waiting = desk.scripts + desk.videos;
  const rugWidth = Math.min(b.w - 80, 400);
  const what = [desk.videos && "aprobar video", desk.scripts && "aprobar guion"]
    .filter(Boolean)
    .join(" y ");
  return (
    <>
      <Shell b={b} p={p} floor={FLOOR_OF.desk} lit={waiting > 0} doors={doors} glass>
        <rect
          x={cx - rugWidth / 2}
          y={cy - (b.h - 56) / 2}
          width={rugWidth}
          height={b.h - 56}
          rx="4"
          fill={C.rug}
          stroke={C.rugEdge}
          strokeWidth="3"
        />
        {waiting > 0 && <Glow x={cx} y={cy} r={150} p={p} kind="wait" />}
        <g transform={`translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`}>
          <rect
            x={cx - 70}
            y={cy - 22}
            width="140"
            height="40"
            rx="4"
            fill="#6e4a35"
            stroke={C.deskEdge}
            strokeWidth="2"
          />
          <rect x={cx - 22} y={cy - 19} width="44" height="7" rx="1.5" fill="#11151b" />
          <rect x={cx - 20} y={cy - 13} width="40" height="2" fill="#a8d4ff" />
          <rect
            x={cx - 64}
            y={cy - 14}
            width="30"
            height="26"
            rx="2"
            fill="#2b313c"
            stroke="#4a5161"
          />
          <rect
            x={cx + 34}
            y={cy - 14}
            width="30"
            height="26"
            rx="2"
            fill="#2b313c"
            stroke="#4a5161"
          />
          <Chair x={cx} y={cy + 34} empty />
          <text
            x={cx}
            y={cy + 38}
            textAnchor="middle"
            fontSize="8"
            fontWeight="600"
            letterSpacing="1.5"
            fill="#a3a9b4"
            style={{ fontFamily: SANS }}
          >
            VOS
          </text>
        </g>
        {!phone && (
          <>
            <Plant x={b.x + 30} y={b.y + b.h - 28} r={14} />
            <Plant x={b.x + b.w - 30} y={b.y + 30} r={14} />
            <rect
              x={b.x + b.w - 120}
              y={b.y + b.h - 40}
              width="84"
              height="26"
              rx="6"
              fill="#3a4556"
            />
            <rect
              x={b.x + b.w - 116}
              y={b.y + b.h - 36}
              width="36"
              height="18"
              rx="4"
              fill="#465368"
            />
            <rect
              x={b.x + b.w - 76}
              y={b.y + b.h - 36}
              width="36"
              height="18"
              rx="4"
              fill="#465368"
            />
          </>
        )}
        {waiting > 0 && <Bubble x={cx + 49 * k} y={cy - 46} p={p} text="¡te espera!" kind="wait" />}
      </Shell>
      <DoorSign
        x={b.x + 12}
        y={b.y + 12}
        name="Tu escritorio"
        state={waiting ? "cued" : "off"}
        status={
          waiting
            ? `${waiting} te espera${waiting > 1 ? "n" : ""}${phone ? "" : ` · ${what}`}`
            : "Nada pendiente"
        }
      />
    </>
  );
}

function archiveStatus(count: number, phone: boolean): string {
  if (!count) return "Vacío";
  const s = count > 1 ? "s" : "";
  return phone ? `${count} listo${s}` : `${count} paquete${s} listo${s}`;
}

export function Archive({ count, b, p, phone, k, doors }: Place & { count: number }) {
  const cx = b.x + b.w * 0.34 + (phone ? 6 : 0);
  const cy = b.y + b.h * 0.66;
  return (
    <>
      <Shell b={b} p={p} floor={FLOOR_OF.archive} lit={count > 0} doors={doors}>
        {Array.from({ length: phone ? 2 : 3 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed shelves
          <g key={i}>
            <rect
              x={b.x + b.w - 74}
              y={b.y + 56 + i * 34}
              width="60"
              height="22"
              fill="#2a1f17"
              stroke={C.deskEdge}
            />
            {[0, 1, 2, 3].map((j) => (
              <rect
                key={j}
                x={b.x + b.w - 70 + j * 14}
                y={b.y + 59 + i * 34}
                width="11"
                height="16"
                fill={C.manila}
              />
            ))}
          </g>
        ))}
        {count > 0 && <Glow x={cx} y={cy} r={80} p={p} kind="lamp" />}
        <g transform={`translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`}>
          <rect
            x={cx - 30}
            y={cy - 20}
            width="60"
            height="40"
            rx="3"
            fill={C.deskTop}
            stroke={C.deskEdge}
            strokeWidth="2"
          />
          <path d={`M${cx - 30} ${cy - 6}H${cx + 30}`} stroke={C.deskEdge} />
        </g>
      </Shell>
      <DoorSign
        x={b.x + 12}
        y={b.y + 12}
        name="Archivo"
        state={count ? "ready" : "off"}
        status={archiveStatus(count, phone)}
      />
    </>
  );
}

/** Where a new topic comes in (only on a computer). */
export function Lobby({ b, p, k, doors }: Omit<Place, "phone">) {
  const cx = b.x + b.w * 0.55;
  const cy = b.y + b.h * 0.6;
  return (
    <>
      <Shell b={b} p={p} floor={FLOOR_OF.lobby} lit={false} doors={doors}>
        <g transform={`translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`}>
          <path
            d={`M${cx - 40} ${cy - 22}h80v44h-16v-28h-48v28h-16Z`}
            fill={C.deskTop}
            stroke={C.deskEdge}
            strokeWidth="1.5"
          />
          <circle cx={cx + 22} cy={cy - 14} r="4" fill="#c9a24b" />
        </g>
        <Plant x={b.x + b.w - 24} y={b.y + b.h - 24} r={12} />
      </Shell>
      <text
        x={b.x + 14}
        y={b.y + b.h - 14}
        fontSize="9"
        letterSpacing="1.4"
        fill="#818895"
        style={{ fontFamily: SANS }}
      >
        ENTRADA ←
      </text>
      <DoorSign x={b.x + 12} y={b.y + 12} name="Recepción" state="off" status="Nuevo video" />
    </>
  );
}

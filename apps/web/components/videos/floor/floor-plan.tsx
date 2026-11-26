import { WORKING_STAGES } from "@radev/core";
import Link from "next/link";
import type { Floor, RoomId } from "@/lib/video-floor";
import { OFFICE_SLUG } from "@/lib/video-office";
import { C, Defs, FolderShape } from "./props";
import {
  Archive,
  type Box,
  type Door,
  folderSpot,
  Lobby,
  OFFICE_NAME,
  Office,
  YourDesk,
} from "./rooms";

type Layout = {
  width: number;
  height: number;
  /** Scale of the furniture. */
  k: number;
  boxes: Record<RoomId, Box> & { lobby?: Box };
  chevrons: { x: number; y: number; to: "right" | "down" | "up" }[];
};

function wide(): Layout {
  const width = 1336;
  const top = (width - 16) / 5;
  const bottom = (width - 16) / 3;
  const row = (i: number) => ({ x: 8 + i * top, y: 8, w: top, h: 232 });
  const low = (i: number) => ({ x: 8 + i * bottom, y: 516, w: bottom, h: 228 });
  const right = (x: number, y: number) => ({ x, y, to: "right" as const });
  return {
    width,
    height: 752,
    k: 1.45,
    boxes: {
      researching: row(0),
      checking_sources: row(1),
      finding_images: row(2),
      scripting: row(3),
      checking_facts: row(4),
      lobby: { x: 8, y: 284, w: 220, h: 188 },
      desk: { x: 286, y: 284, w: 764, h: 188 },
      archive: { x: 1108, y: 284, w: 220, h: 188 },
      voicing: low(0),
      rendering: low(1),
      packaging: low(2),
    },
    chevrons: [
      ...[160, 430, 700, 968, 1180].map((x) => right(x, 262)),
      ...[256, 700, 1150].map((x) => right(x, 494)),
      { x: 1194, y: 272, to: "down" },
      { x: 118, y: 270, to: "up" },
    ],
  };
}

/** The same plan stacked in two columns. */
function narrow(): Layout {
  const width = 358;
  const half = (width - 24) / 2;
  const left = (y: number, h: number) => ({ x: 8, y, w: half, h });
  const rightHalf = (y: number, h: number) => ({ x: 16 + half, y, w: half, h });
  const full = (y: number, h: number) => ({ x: 8, y, w: width - 16, h });
  return {
    width,
    height: 1148,
    k: 1,
    boxes: {
      researching: left(8, 176),
      checking_sources: rightHalf(8, 176),
      finding_images: left(216, 176),
      scripting: rightHalf(216, 176),
      checking_facts: full(424, 150),
      desk: full(606, 180),
      voicing: left(818, 150),
      rendering: rightHalf(818, 150),
      packaging: left(990, 150),
      archive: rightHalf(990, 150),
    },
    chevrons: [200, 408, 590, 802].map((y) => ({ x: width / 2, y, to: "down" as const })),
  };
}

const CHEVRON = {
  right: "m-4 -6 7 6-7 6",
  down: "m-6 -4 6 7 6-7",
  up: "m-6 4 6-7 6 7",
};

const TOP_ROW: Door[] = [["bottom", 0.5]];
const BOTTOM_ROW: Door[] = [["top", 0.5]];

function Plan({ floor, phone, p }: { floor: Floor; phone: boolean; p: string }) {
  const { width, height, k, boxes, chevrons } = phone ? narrow() : wide();
  const place = { p, phone, k };
  const open = (href: string, label: string, children: React.ReactNode) => (
    <Link href={href} aria-label={label} className="floor-room">
      {children}
    </Link>
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" aria-labelledby={`${p}-title`}>
      <title id={`${p}-title`}>Plano del estudio</title>
      <Defs p={p} />
      <rect width={width} height={height} rx="10" fill={`url(#${p}-concrete)`} />
      {chevrons.map((c) => (
        <path
          key={`${c.x}-${c.y}`}
          d={`M${c.x} ${c.y}${CHEVRON[c.to]}`}
          stroke={C.wallHi}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      ))}

      {WORKING_STAGES.map((stage) => {
        const room = floor.offices[stage];
        const bottomRow = stage === "voicing" || stage === "rendering" || stage === "packaging";
        const office = (
          <Office
            {...place}
            stage={stage}
            room={room}
            b={boxes[stage]}
            doors={bottomRow ? BOTTOM_ROW : TOP_ROW}
          />
        );
        const label = `Oficina ${OFFICE_NAME[stage].name}: ${room.status}`;
        return <g key={stage}>{open(`/videos/offices/${OFFICE_SLUG[stage]}`, label, office)}</g>;
      })}

      {(() => {
        const desk = (
          <YourDesk
            {...place}
            desk={floor.desk}
            b={boxes.desk}
            doors={
              phone
                ? [
                    ["top", 0.5],
                    ["bottom", 0.5],
                  ]
                : [
                    ["top", 0.87],
                    ["bottom", 0.1],
                    ["bottom", 0.87],
                    ["right", 0.5],
                  ]
            }
          />
        );
        return floor.desk.videoId
          ? open(`/videos/${floor.desk.videoId}`, "Ir a tu escritorio", desk)
          : desk;
      })()}

      {(() => {
        const archive = (
          <Archive
            {...place}
            count={floor.archive.count}
            b={boxes.archive}
            doors={[[phone ? "top" : "left", 0.5]]}
          />
        );
        return floor.archive.videoId
          ? open(`/videos/${floor.archive.videoId}`, "Abrir el último paquete", archive)
          : archive;
      })()}

      {boxes.lobby &&
        open(
          "/videos/new",
          "Recepción: nuevo video",
          <Lobby
            p={p}
            k={k}
            b={boxes.lobby}
            doors={[
              ["left", 0.5],
              ["top", 0.5],
            ]}
          />,
        )}

      {/* The folders, above everything: when a video changes rooms, its folder slides there. */}
      <g pointerEvents="none">
        {[...floor.folders]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((folder) => {
            const spot = folderSpot(folder.room, boxes[folder.room], phone);
            const x = spot.x - folder.pile * 7;
            const y = spot.y - folder.pile * 7;
            return (
              <g
                key={folder.id}
                className="floor-folder"
                style={{ transform: `translate(${x}px, ${y}px)` }}
              >
                <title>{folder.title}</title>
                <g transform={`rotate(${folder.pile ? 6 : -8}) scale(${phone ? 0.85 : 1.2})`}>
                  <FolderShape code={folder.code} color={`var(--folder-${folder.color})`} p={p} />
                </g>
              </g>
            );
          })}
      </g>

      <rect
        x="3"
        y="3"
        width={width - 6}
        height={height - 6}
        rx="9"
        fill="none"
        stroke={C.wallHi}
        strokeWidth="6"
      />
      {!phone && <rect x="0" y="358" width="8" height="40" fill={C.corridor} />}
    </svg>
  );
}

/** The studio seen from above (the approved plan of T10). The rundown below says the same in text. */
export function FloorPlan({ floor }: { floor: Floor }) {
  return (
    <div className="floor">
      <div className="hidden md:block">
        <Plan floor={floor} phone={false} p="wide" />
      </div>
      <div className="md:hidden">
        <Plan floor={floor} phone p="narrow" />
      </div>
    </div>
  );
}

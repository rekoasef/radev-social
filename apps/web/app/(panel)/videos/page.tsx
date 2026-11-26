import { listVideos, studioUsage } from "@radev/db";
import type { Metadata } from "next";
import Link from "next/link";
import { Plate } from "@/components/console/plate";
import { Tally } from "@/components/console/tally";
import { AutoRefresh } from "@/components/videos/auto-refresh";
import { FloorPlan } from "@/components/videos/floor/floor-plan";
import { FolderTab } from "@/components/videos/folder-tab";
import { db } from "@/lib/db";
import { describeVideo, folders } from "@/lib/video-display";
import { studioFloor } from "@/lib/video-floor";
import { STUDIO_TIME_ZONE, startOfDay, startOfMonth } from "@/lib/video-time";

export const metadata: Metadata = { title: "Estudio · RAdev Social" };

const number = new Intl.NumberFormat("es-AR");

// The studio: what waits for the operator, the floor plan, today's spending and every video. All brands at once
// (a video may have none), so the brand switcher does not filter here.
export default async function VideosPage() {
  const now = new Date();
  const [all, usage] = await Promise.all([
    listVideos(db),
    studioUsage(db, startOfDay(now, STUDIO_TIME_ZONE), startOfMonth(now, STUDIO_TIME_ZONE)),
  ]);
  const folder = folders(all);
  const videos = all
    .filter((video) => video.stage !== "archived")
    .map((video) => ({ video, view: describeVideo(video, now, STUDIO_TIME_ZONE) }));
  const working = videos.filter((v) => v.view.working).length;
  const waiting = videos.filter((v) => v.view.waiting);
  const first = waiting.at(-1);
  const clock = new Intl.DateTimeFormat("es-AR", {
    timeZone: STUDIO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const floor = studioFloor(
    videos.map(({ video }) => ({
      ...video,
      title: video.title ?? video.topic,
      folder: folder.get(video.id) ?? { code: "00", color: 1 },
    })),
    now,
    (at) => clock.format(at),
  );
  // While something is queued or working the page keeps itself up to date.
  const moving = videos.some((v) => v.view.working || v.view.tally === "standby");

  return (
    <section aria-labelledby="studio-heading" className="flex flex-col gap-8">
      {moving && <AutoRefresh seconds={5} />}
      <Plate
        as="h1"
        id="studio-heading"
        aside={
          <span className="flex items-center gap-4">
            <span className="hidden sm:inline">
              {videos.length} videos · {working} trabajando
            </span>
            <Link href="/videos/new" className="console-button">
              Nuevo video
            </Link>
          </span>
        }
      >
        Estudio
      </Plate>

      {first && (
        <div className="wait-sign">
          <Tally state="cued">Te espera{waiting.length > 1 ? ` · ${waiting.length}` : ""}</Tally>
          <p className="min-w-0 flex-1 text-sm text-ink-dim">
            <b className="text-base font-semibold text-ink">
              {first.video.title ?? first.video.topic}
            </b>{" "}
            · {first.video.stage === "script_review" ? "aprobar el guion" : "aprobar el video"} ·{" "}
            {first.view.time}
          </p>
          <Link
            href={`/videos/${first.video.id}`}
            className="console-button console-button-primary"
          >
            Ir a tu escritorio
          </Link>
        </div>
      )}

      <FloorPlan floor={floor} />

      <p className="timecode flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-ink-dim">
        <span>
          HOY · Claude <b className="font-normal text-ink">{number.format(usage.inputTokens)}</b>{" "}
          entrada / <b className="font-normal text-ink">{number.format(usage.outputTokens)}</b>{" "}
          salida
        </span>
        <span>
          Voz del mes <b className="font-normal text-ink">{number.format(usage.voiceCharacters)}</b>{" "}
          créditos
          {usage.quota &&
            ` · quedaban ${number.format(Math.max(0, usage.quota.limit - usage.quota.used))} en la última locución`}
        </span>
        <span>
          Render hoy{" "}
          <b className="font-normal text-ink">
            {Math.floor(usage.renderSeconds / 60)} min {usage.renderSeconds % 60} s
          </b>
        </span>
      </p>

      <section aria-labelledby="rundown-heading" className="flex flex-col gap-4">
        <Plate id="rundown-heading" aside={`${videos.length} videos`}>
          En el estudio
        </Plate>
        {videos.length === 0 ? (
          <div className="rounded-md border border-dashed border-bezel px-5 py-10">
            <p className="text-base text-ink">El estudio está vacío.</p>
            <p className="mt-1 text-sm text-ink-dim">
              Mandá el primer tema con{" "}
              <Link href="/videos/new" className="underline underline-offset-2">
                Nuevo video
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-bezel overflow-hidden rounded-md border border-bezel bg-panel">
            {videos.map(({ video, view }) => {
              const tab = folder.get(video.id);
              return (
                <li key={video.id}>
                  <Link href={`/videos/${video.id}`} className="video-row">
                    {tab && <FolderTab {...tab} />}
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-sm font-medium text-ink">
                        {video.title ?? video.topic}
                      </span>
                      {video.title && (
                        <span className="truncate text-xs text-ink-faint">{video.topic}</span>
                      )}
                    </span>
                    <span className="hidden text-sm text-ink md:block">{view.office}</span>
                    <Tally state={view.tally} className="video-row-status min-w-0">
                      <span className="line-clamp-2">{view.status}</span>
                    </Tally>
                    <span className="timecode hidden text-right text-sm text-ink-dim md:block">
                      {view.time}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}

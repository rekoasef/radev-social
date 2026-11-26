import { resolveAiRoute } from "@radev/core";
import { listAiRoutes, listVideos, officeHistory } from "@radev/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/videos/auto-refresh";
import { OfficeInside } from "@/components/videos/office-view";
import { RetryVideoForm } from "@/components/videos/video-controls";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { folders } from "@/lib/video-display";
import { studioFloor } from "@/lib/video-floor";
import { OFFICE_INFO, officeView, stageOfSlug } from "@/lib/video-office";
import { STUDIO_TIME_ZONE } from "@/lib/video-time";

export const metadata: Metadata = { title: "Oficina · RAdev Social" };

const WEEK_MS = 7 * 24 * 60 * 60_000;

export default async function OfficePage({ params }: PageProps<"/videos/offices/[office]">) {
  const stage = stageOfSlug((await params).office);
  if (!stage) notFound();
  const info = OFFICE_INFO[stage];
  const now = new Date();
  const [all, history, routes] = await Promise.all([
    listVideos(db),
    officeHistory(db, stage, info.task, new Date(now.getTime() - WEEK_MS)),
    listAiRoutes(db),
  ]);
  const view = officeView({ stage, videos: all, history, now, timeZone: STUDIO_TIME_ZONE });
  const folder = folders(all);
  const clock = new Intl.DateTimeFormat("es-AR", {
    timeZone: STUDIO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const room = studioFloor(
    all
      .filter((v) => v.stage === stage)
      .map((v) => ({
        ...v,
        title: v.title ?? v.topic,
        folder: folder.get(v.id) ?? { code: "00", color: 1 },
      })),
    now,
    (at) => clock.format(at),
  ).offices[stage];
  // The route a video without a brand would take.
  const model = info.task ? (resolveAiRoute(routes, info.task, "")?.primary.model ?? null) : null;
  const current = view.current?.video;
  const stopped =
    current && (current.failure || current.pausedAt) && current.pauseReason !== "provider_limit";

  return (
    <section className="flex flex-col gap-6">
      {(room.mode === "working" || room.mode === "queued") && <AutoRefresh seconds={5} />}
      <Link href="/videos" className="plate-text w-fit text-ink-faint hover:text-ink">
        ← Estudio
      </Link>
      <OfficeInside
        stage={stage}
        room={room}
        view={view}
        folder={current ? folder.get(current.id) : undefined}
        model={model}
        when={(at) => formatDateTime(at, STUDIO_TIME_ZONE)}
        action={
          stopped ? (
            <RetryVideoForm
              videoId={current.id}
              label={current.failure ? "Reintentar" : "Retomar"}
            />
          ) : undefined
        }
      />
    </section>
  );
}

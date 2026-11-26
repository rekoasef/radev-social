import { stageLabel } from "@radev/core";
import { getVideo, listVideos } from "@radev/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Plate } from "@/components/console/plate";
import { Tally } from "@/components/console/tally";
import { AutoRefresh } from "@/components/videos/auto-refresh";
import { FolderTab } from "@/components/videos/folder-tab";
import { DiscardVideoButton, RetryVideoForm } from "@/components/videos/video-controls";
import { db } from "@/lib/db";
import { describeVideo, folders } from "@/lib/video-display";
import { STUDIO_TIME_ZONE } from "@/lib/video-time";

export const metadata: Metadata = { title: "Video · RAdev Social" };

// A video's page: where it is and what can be done when it stopped. The two desks (approve the
// script, approve the video) are built on top of this one.
export default async function VideoPage({ params }: PageProps<"/videos/[id]">) {
  const id = z.uuid().safeParse((await params).id);
  const video = id.success ? await getVideo(db, id.data) : null;
  if (!video) notFound();
  const view = describeVideo(video, new Date(), STUDIO_TIME_ZONE);
  const tab = folders(await listVideos(db)).get(video.id);
  const stopped = video.failure !== null || video.pausedAt !== null;

  return (
    <section aria-labelledby="video-heading" className="flex flex-col gap-6">
      {(view.working || view.tally === "standby") && <AutoRefresh seconds={5} />}
      <Link href="/videos" className="plate-text w-fit text-ink-faint hover:text-ink">
        ← Estudio
      </Link>
      <Plate aside={view.time}>{view.office}</Plate>
      <div className="flex items-start gap-4">
        {tab && <FolderTab {...tab} />}
        <div className="min-w-0">
          <h1 id="video-heading" className="text-2xl font-semibold tracking-tight text-balance">
            {video.title ?? video.topic}
          </h1>
          {video.title && <p className="mt-1 text-sm text-ink-faint">{video.topic}</p>}
        </div>
      </div>
      <Tally state={view.tally}>{view.status}</Tally>
      {view.waiting && (
        <p className="max-w-[60ch] text-sm text-ink-dim">
          Esta pantalla para aprobar todavía no está hecha. Mientras tanto se contesta desde la
          terminal con <code className="timecode">--resume {video.id}</code>.
        </p>
      )}
      {video.stage === "approved" && (
        <a href={`/videos/${video.id}/download`} className="console-button w-fit">
          Descargar el paquete
        </a>
      )}
      {stopped && video.pauseReason !== "provider_limit" && video.stage !== "archived" && (
        <RetryVideoForm videoId={video.id} label={video.failure ? "Reintentar" : "Retomar"} />
      )}
      {video.stage !== "archived" ? (
        <DiscardVideoButton videoId={video.id} />
      ) : (
        <p className="text-sm text-ink-dim">Este video está {stageLabel(video.stage)}.</p>
      )}
    </section>
  );
}

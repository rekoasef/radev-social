import { stageLabel } from "@radev/core";
import { getVideo, listVideos, studioUsage } from "@radev/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Plate } from "@/components/console/plate";
import { Tally } from "@/components/console/tally";
import { AutoRefresh } from "@/components/videos/auto-refresh";
import { FolderTab } from "@/components/videos/folder-tab";
import { ScriptDesk } from "@/components/videos/script-desk";
import { DiscardVideoButton, RetryVideoForm } from "@/components/videos/video-controls";
import { VideoDesk } from "@/components/videos/video-desk";
import { db } from "@/lib/db";
import { framesQueued } from "@/lib/jobs";
import { loadDelivery } from "@/lib/video-delivery";
import { describeVideo, folders } from "@/lib/video-display";
import { loadScriptDocuments } from "@/lib/video-documents";
import { scriptDesk } from "@/lib/video-script";
import { STUDIO_TIME_ZONE, startOfDay, startOfMonth } from "@/lib/video-time";

export const metadata: Metadata = { title: "Video · RAdev Social" };

// A video's page: where it is, the desk where it waits (script or video) or what it left once
// approved, and what can be done when it stopped.
export default async function VideoPage({ params }: PageProps<"/videos/[id]">) {
  const id = z.uuid().safeParse((await params).id);
  const video = id.success ? await getVideo(db, id.data) : null;
  if (!video) notFound();
  const view = describeVideo(video, new Date(), STUDIO_TIME_ZONE);
  const tab = folders(await listVideos(db)).get(video.id);
  const stopped = video.failure !== null || video.pausedAt !== null;
  const documents = video.stage === "script_review" ? await loadScriptDocuments(video.id) : null;
  const finished = video.stage === "in_review" || video.stage === "approved";
  const delivery = finished ? await loadDelivery(video) : null;
  const desk = documents ? scriptDesk({ videoId: video.id, ...documents }) : null;
  // Only while a drawing is on its way: without the worker the page would refresh forever.
  const drawing =
    desk !== null && desk.framesPending > 0 && (await framesQueued(video.id).catch(() => false));
  const now = new Date();
  const quota = documents
    ? (
        await studioUsage(
          db,
          startOfDay(now, STUDIO_TIME_ZONE),
          startOfMonth(now, STUDIO_TIME_ZONE),
        )
      ).quota
    : null;

  return (
    <section aria-labelledby="video-heading" className="flex flex-col gap-6">
      {(view.working || view.tally === "standby" || drawing) && <AutoRefresh seconds={5} />}
      <Link href="/videos" className="back-link">
        ← Estudio
      </Link>
      <Plate aside={view.time}>
        {documents ? "Aprobar guion" : video.stage === "in_review" ? "Aprobar video" : view.office}
      </Plate>
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
      {documents && desk && (
        <ScriptDesk
          videoId={video.id}
          version={documents.version}
          desk={desk}
          drawing={drawing}
          paused={video.pausedAt !== null}
          voiceLeft={quota ? Math.max(0, quota.limit - quota.used) : null}
          voiceReused={documents.voiceReused}
        />
      )}
      {video.stage === "script_review" && !documents && (
        <p role="alert" className="text-sm text-ink">
          Faltan documentos de este video o no se pueden leer: no se puede mostrar el guion.
        </p>
      )}
      {delivery && (
        <VideoDesk
          videoId={video.id}
          delivery={delivery}
          approved={video.stage === "approved"}
          paused={video.pausedAt !== null}
        />
      )}
      {finished && !delivery && (
        <p role="alert" className="text-sm text-ink">
          Faltan documentos de este video o no se pueden leer: no se puede mostrar.
        </p>
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

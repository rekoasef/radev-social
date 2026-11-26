import { getVideo } from "@radev/db";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";
import { videoPackageResponse } from "@/lib/video-package";

// The package of a video to upload to YouTube and keep in Drive. Only for approved videos.

export async function GET(_request: Request, { params }: RouteContext<"/videos/[id]/download">) {
  await requireOperator();
  const id = z.uuid().safeParse((await params).id);
  const video = id.success ? await getVideo(db, id.data) : null;
  if (!video) return new Response("Ese video no existe.", { status: 404 });
  return videoPackageResponse(video);
}

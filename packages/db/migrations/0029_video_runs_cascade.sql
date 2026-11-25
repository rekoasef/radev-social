ALTER TABLE "generation_runs" DROP CONSTRAINT "generation_runs_video_id_videos_id_fk";
--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
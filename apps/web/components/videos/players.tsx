"use client";

import { useRef } from "react";

const megabytes = (bytes: number) => `${(bytes / 1e6).toFixed(1).replace(".", ",")} MB`;

type Format = {
  format: "9x16" | "16x9";
  src: string;
  poster: string;
  width: number;
  height: number;
  bytes: number;
};

/** Both formats, with the browser's own controls; the chapters jump the normal video. */
export function Players({
  formats,
  chapters,
}: {
  formats: Format[];
  chapters: { title: string; start: number; time: string }[];
}) {
  const normal = useRef<HTMLVideoElement>(null);

  function jump(start: number) {
    const video = normal.current;
    if (!video) return;
    video.currentTime = start;
    video.play().catch(() => {});
  }

  return (
    <div className="players">
      {formats.map((f) => (
        <figure key={f.format} className="flex min-w-0 flex-col gap-2.5">
          {/* biome-ignore lint/a11y/useMediaCaption: the subtitles are burned into the picture */}
          <video
            ref={f.format === "16x9" ? normal : undefined}
            src={f.src}
            poster={f.poster}
            controls
            playsInline
            preload="metadata"
            className={f.format === "9x16" ? "player-short" : "player-normal"}
          />
          <figcaption className="timecode flex flex-wrap gap-x-3 text-[11.5px] text-ink-faint">
            <span>{f.format === "9x16" ? "SHORT" : "NORMAL"}</span>
            <span>
              {f.width}×{f.height}
            </span>
            <span>{megabytes(f.bytes)}</span>
          </figcaption>
          {f.format === "16x9" && (
            <ul aria-label="Capítulos" className="flex flex-wrap gap-1.5">
              {chapters.map((chapter) => (
                <li key={chapter.start}>
                  <button
                    type="button"
                    className="console-chip"
                    onClick={() => jump(chapter.start)}
                  >
                    <span className="timecode text-ink-faint">{chapter.time}</span> {chapter.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </figure>
      ))}
    </div>
  );
}

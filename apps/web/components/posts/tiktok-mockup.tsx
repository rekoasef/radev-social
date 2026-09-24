"use client";

import {
  Bookmark,
  ChevronLeft,
  Ellipsis,
  Heart,
  MessageCircleMore,
  Music,
  Search,
} from "lucide-react";
import { type CSSProperties, useRef, useState } from "react";

// A TikTok phone showing the rendered carousel, to judge the slides as they will be seen. Every
// measure comes from the real screenshot (docs/references/tiktok-4x5.jpeg, a 738×1600 screen):
// the photo spans the full width from y=227, so the UI covers our slides where it really would.
// Sizes are in container units, so the whole phone scales with its width.

const SCREEN_WIDTH = 738;
const PHOTO_TOP = 227;
/** Screenshot pixels → container units. */
const u = (px: number) => `${(px / SCREEN_WIDTH) * 100}cqw`;

export type MockupSlide = { url: string; label: string };

export type MockupPost = {
  brandName: string;
  hook: string;
  caption: string;
  hashtags: readonly string[];
};

export function TikTokMockup({
  slides,
  index,
  onIndexChange,
  post,
}: {
  slides: readonly MockupSlide[];
  index: number;
  onIndexChange: (index: number) => void;
  post: MockupPost;
}) {
  const [expanded, setExpanded] = useState(false);
  const swipeStart = useRef<number | null>(null);
  const slide = slides[index];
  const go = (to: number) => onIndexChange(Math.min(slides.length - 1, Math.max(0, to)));
  const text = [post.caption, post.hashtags.map((tag) => `#${tag}`).join(" ")]
    .filter(Boolean)
    .join(" ");

  return (
    // The container is the wrapper: container units inside an element measure its ancestor.
    <div style={{ containerType: "inline-size" }}>
      <div
        className="relative select-none overflow-hidden bg-black text-white"
        style={{
          aspectRatio: `${SCREEN_WIDTH} / 1600`,
          borderRadius: u(56),
          fontFamily: '-apple-system, "Helvetica Neue", Arial, sans-serif',
          boxShadow: "0 0 0 8px #1a1a1a, 0 0 0 9px #333, 0 30px 80px rgba(0,0,0,.6)",
        }}
      >
        {/* Status bar */}
        <span className="absolute font-semibold" style={at(92, 30, { fontSize: u(32) })}>
          18:00
        </span>
        <span
          className="absolute flex items-center font-semibold"
          style={at(530, 36, { gap: u(10), fontSize: u(22) })}
        >
          <span style={{ letterSpacing: u(-2) }}>▂▄▆█</span>
          <span
            className="rounded-[0.3em] bg-white px-[0.3em] text-black"
            style={{ fontSize: u(22) }}
          >
            39
          </span>
        </span>

        {/* Search header */}
        <ChevronLeft className="absolute" style={box(22, 128, 44)} strokeWidth={2.5} />
        <div
          className="absolute flex items-center rounded-[0.4em] border-2 border-white/90"
          style={{ ...at(90, 118), width: u(617), height: u(68), fontSize: u(28), gap: u(14) }}
        >
          <Search style={{ width: u(34), height: u(34), marginLeft: u(22) }} strokeWidth={2.2} />
          <span className="flex-1 truncate text-white/60">{post.brandName}</span>
          <span className="border-l border-white/40 font-medium" style={{ padding: `0 ${u(22)}` }}>
            Buscar
          </span>
        </div>

        {/* The slide */}
        <div
          className="absolute inset-x-0 touch-pan-y"
          style={{ top: u(PHOTO_TOP), aspectRatio: "4 / 5" }}
          onPointerDown={(e) => {
            swipeStart.current = e.clientX;
          }}
          onPointerUp={(e) => {
            if (swipeStart.current === null) return;
            const dx = e.clientX - swipeStart.current;
            swipeStart.current = null;
            if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
          }}
        >
          {slide && (
            // biome-ignore lint/performance/noImgElement: the PNG as rendered; next/image would re-encode it.
            <img src={slide.url} alt={slide.label} draggable={false} className="block size-full" />
          )}
        </div>

        {/* Page counter */}
        <span
          className="absolute rounded-full bg-neutral-800/80 font-medium"
          style={{ ...at(641, 210), fontSize: u(24), padding: `${u(6)} ${u(16)}` }}
        >
          {index + 1} / {slides.length}
        </span>

        {/* Pagination dots */}
        <div
          className="absolute inset-x-0 flex justify-center"
          style={{ top: u(1108), gap: u(10) }}
        >
          {slides.map((s, i) => (
            <button
              key={s.url}
              type="button"
              aria-label={`Ir a la ${s.label.toLowerCase()}`}
              onClick={() => go(i)}
              className="rounded-full"
              style={{
                width: u(i === index ? 13 : 10),
                height: u(i === index ? 13 : 10),
                background: i === index ? "#fff" : "rgba(255,255,255,.45)",
              }}
            />
          ))}
        </div>

        {/* Right column */}
        <div
          className="absolute flex items-center justify-center rounded-full border-2 border-white/80 bg-neutral-900 font-bold"
          style={{ ...box(641, 727, 80), fontSize: u(22) }}
        >
          {initials(post.brandName)}
        </div>
        <Action icon={<Heart fill="currentColor" strokeWidth={0} />} top={870} count="2.345" />
        <Action
          icon={<MessageCircleMore fill="currentColor" stroke="#000" strokeWidth={1.4} />}
          top={995}
          count="14"
        />
        <Action icon={<Bookmark fill="currentColor" strokeWidth={0} />} top={1120} count="2.085" />
        <Ellipsis className="absolute" style={box(652, 1245, 58)} strokeWidth={3} />
        <div
          className="absolute flex items-center justify-center rounded-full bg-gradient-to-br from-neutral-600 to-neutral-900"
          style={box(643, 1343, 76)}
        >
          <Music style={{ width: u(30), height: u(30) }} />
        </div>

        {/* Post text */}
        <div className="absolute" style={{ left: u(24), top: u(1158), width: u(590) }}>
          <p className="flex items-center" style={{ gap: u(10), fontSize: u(31) }}>
            <span className="font-semibold">{post.brandName}</span>
            <span
              className="rounded-[0.3em] bg-neutral-800 font-medium"
              style={{ fontSize: u(21), padding: `${u(3)} ${u(10)}` }}
            >
              Photo
            </span>
            <span className="text-white/70">· Ahora</span>
          </p>
          <p className="font-bold" style={{ fontSize: u(28), marginTop: u(12), lineHeight: 1.2 }}>
            {post.hook}
          </p>
          <p
            className={expanded ? "overflow-y-auto" : "line-clamp-3"}
            style={{
              fontSize: u(28),
              lineHeight: 1.15,
              marginTop: u(4),
              maxHeight: expanded ? u(230) : undefined,
            }}
          >
            {text}
          </p>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="font-semibold text-white/80"
            style={{ fontSize: u(26) }}
          >
            {expanded ? "menos" : "más"}
          </button>
        </div>

        {/* Comment bar */}
        <div
          className="absolute inset-x-0 flex items-center border-t border-white/15 text-white/50"
          style={{ top: u(1445), height: u(100), paddingLeft: u(28), fontSize: u(27) }}
        >
          Agregá un comentario…
        </div>
      </div>
    </div>
  );
}

function Action({ icon, top, count }: { icon: React.ReactNode; top: number; count: string }) {
  return (
    <div
      className="absolute flex flex-col items-center font-semibold"
      style={{ left: u(630), top: u(top), width: u(100), fontSize: u(24), gap: u(4) }}
    >
      <span style={{ width: u(62), height: u(62) }} className="[&>svg]:size-full">
        {icon}
      </span>
      {count}
    </div>
  );
}

function at(left: number, top: number, extra?: CSSProperties): CSSProperties {
  return { left: u(left), top: u(top), ...extra };
}

function box(left: number, top: number, size: number): CSSProperties {
  return at(left, top, { width: u(size), height: u(size) });
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

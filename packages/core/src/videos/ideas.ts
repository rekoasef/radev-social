// Topic ideas for "Nuevo video" (docs/RADEV-STUDIO-REVISION.md §7): the operator asks, the
// video-worker answers. "generate" uses what the model knows; "research" searches the web first.

import type { AiTask } from "../ai/tasks";

export const VIDEO_IDEA_MODES = ["generate", "research"] as const;
export type VideoIdeaMode = (typeof VIDEO_IDEA_MODES)[number];

export const VIDEO_IDEA_TASK = {
  generate: "video.ideas",
  research: "video.ideas.research",
} as const satisfies Record<VideoIdeaMode, AiTask>;

/** How many ideas a request brings at most. */
export const VIDEO_IDEA_COUNT = 5;
/** What the operator can add to steer them ("historia argentina"). */
export const VIDEO_IDEA_FOCUS_MAX = 200;
/** A topic ready to be sent to Research: it fits the "Tema" field. */
export const VIDEO_IDEA_TOPIC_MIN = 15;
export const VIDEO_IDEA_TOPIC_MAX = 300;
export const VIDEO_IDEA_HOOK_MAX = 240;
export const VIDEO_IDEA_SOURCES_MAX = 3;

export type VideoIdea = {
  /** What gets copied into "Tema". */
  topic: string;
  /** Why it would keep someone watching. */
  hook: string;
  /** Pages the research read; empty without a search. */
  sources: { title: string; url: string }[];
};

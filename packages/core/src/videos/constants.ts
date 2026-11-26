// Values of the video tables (docs/RADEV-STUDIO-REVISION.md §7.2 and §7.3, ADR 0029). The database
// checks them; the state machine (./state-machine.ts) decides which stage can follow which.

/**
 * One stage per office of the assembly line, plus the operator's two desks (`script_review` and
 * `in_review`). `scheduled`, `publishing` and `published` are reserved for V6 (YouTube).
 */
export const VIDEO_STAGES = [
  "researching",
  "checking_sources",
  "finding_images",
  "scripting",
  "checking_facts",
  "script_review",
  "voicing",
  "rendering",
  "packaging",
  "in_review",
  "approved",
  "archived",
] as const;
export type VideoStage = (typeof VIDEO_STAGES)[number];

/** Stages where an office (a worker job) is doing the work. */
export const WORKING_STAGES = [
  "researching",
  "checking_sources",
  "finding_images",
  "scripting",
  "checking_facts",
  "voicing",
  "rendering",
  "packaging",
] as const satisfies readonly VideoStage[];
export type WorkingStage = (typeof WORKING_STAGES)[number];

/** Stages waiting for the operator. */
export const REVIEW_STAGES = [
  "script_review",
  "in_review",
] as const satisfies readonly VideoStage[];

/** The first stage of a new video. */
export const INITIAL_STAGE = "researching" as const satisfies VideoStage;

/** The two formats every video is rendered in (ADR 0029). */
export const VIDEO_FORMATS = ["9x16", "16x9"] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

/** What each format is for, in the panel and in the downloaded folder (`short/`, `normal/`). */
export const VIDEO_FORMAT_FOLDERS = { "9x16": "short", "16x9": "normal" } as const satisfies Record<
  VideoFormat,
  string
>;

/** The documents the offices leave in `video_documents`. */
export const VIDEO_DOCUMENT_KINDS = [
  "dossier",
  "sources",
  "images",
  "script",
  "review",
  "voice",
  "render",
  "package",
] as const;
export type VideoDocumentKind = (typeof VIDEO_DOCUMENT_KINDS)[number];

/** Who wrote a document: an office, or the operator editing at his desk. */
export const DOCUMENT_ORIGINS = ["office", "operator"] as const;
export type DocumentOrigin = (typeof DOCUMENT_ORIGINS)[number];

/** The document each working stage leaves when its office finishes. */
export const OFFICE_DOCUMENT = {
  researching: "dossier",
  checking_sources: "sources",
  finding_images: "images",
  scripting: "script",
  checking_facts: "review",
  voicing: "voice",
  rendering: "render",
  packaging: "package",
} as const satisfies Record<WorkingStage, VideoDocumentKind>;

/** Why a video is paused. `provider_limit` resumes by itself at `resume_at`. */
export const PAUSE_REASONS = ["operator", "provider_limit", "budget", "window"] as const;
export type PauseReason = (typeof PAUSE_REASONS)[number];

/** A rejection note tells the AI (or the operator's future self) what to fix. */
export const REJECTION_NOTE_MIN = 5;
export const REJECTION_NOTE_MAX = 500;

/** Where a voice comes from (ADR 0027: ElevenLabs; Kokoro stays a local backup). */
export const VOICE_PROVIDERS = ["elevenlabs", "kokoro"] as const;
export type VoiceProvider = (typeof VOICE_PROVIDERS)[number];

/** What a voice is for: stories (narrative) or ads (commercial). */
export const VOICE_USES = ["narrative", "commercial"] as const;
export type VoiceUse = (typeof VOICE_USES)[number];

/**
 * What `usage_events` counts: voice credits, render time, downloads and how long each run of an
 * office took (`office`). Cost is always 0 here.
 */
export const USAGE_KINDS = ["tts", "render", "download", "office"] as const;
export type UsageKind = (typeof USAGE_KINDS)[number];

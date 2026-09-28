// Telegram messages to the operator (docs/PRD.md RF-33, phase 4 T6). Plain text: Telegram turns the
// links into links by itself and nothing has to be escaped. Each message has a key: the same key
// is never sent twice (rule 8).

import { type GenerationWindow, isWithinWindow } from "../scheduling/fill";
import { parseLocalTime } from "../scheduling/slots";
import { wallClock, zonedToUtc } from "../scheduling/zoned";

export const NOTIFICATION_KINDS = ["review", "publish", "failure", "limit", "cap", "test"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  review: "Para revisar",
  publish: "Hora de publicar",
  failure: "Falla",
  limit: "Límite de IA",
  cap: "Tope de una marca",
  test: "Prueba",
};

export type Notice = { key: string; kind: NotificationKind; text: string };

/** Posts waiting for review are told together this long after the first one (more may follow). */
export const REVIEW_NOTICE_DELAY_MS = 5 * 60 * 1000;

/** A provider limit that retries later than this before a post's time puts it at risk. */
export const LIMIT_RISK_MARGIN_MS = 2 * 60 * 60 * 1000;

const MAX_ERROR_CHARS = 300;

const url = (base: string, path: string) => `${base.replace(/\/+$/, "")}${path}`;

/** "sáb 26/09 19:00" in a zone. */
export function shortDateTime(at: Date, timeZone: string): string {
  const w = wallClock(at, timeZone);
  const day = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][
    new Date(Date.UTC(w.year, w.month - 1, w.day, 12)).getUTCDay()
  ];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day} ${pad(w.day)}/${pad(w.month)} ${pad(w.hour)}:${pad(w.minute)}`;
}

export type ReviewItem = {
  code: string;
  brandName: string;
  hook: string;
  plannedFor: string | null;
};

/** One message for every post that got to review since the last one. */
export function reviewNotice(items: readonly ReviewItem[], appUrl: string, key: string): Notice {
  const lines = items.map(
    (item) =>
      `• ${item.code} (${item.brandName}): ${item.hook}${item.plannedFor ? ` · para ${item.plannedFor}` : ""}\n  ${url(appUrl, `/review?post=${item.code}`)}`,
  );
  const head =
    items.length === 1 ? "Hay 1 post para revisar:" : `Hay ${items.length} posts para revisar:`;
  return { key, kind: "review", text: `📝 ${head}\n\n${lines.join("\n")}` };
}

/** A scheduled post's time came: the operator posts it by hand (adapter `manual`). */
export function publishNotice(
  post: { id: string; code: string; brandName: string; hook: string; scheduledAt: Date },
  appUrl: string,
): Notice {
  return {
    key: `publish:${post.id}:${post.scheduledAt.toISOString()}`,
    kind: "publish",
    text: [
      `⏰ Es hora de publicar ${post.code} (${post.brandName}):`,
      post.hook,
      "",
      `Descargá el ZIP: ${url(appUrl, `/posts/${post.code}/download`)}`,
      `Después marcalo como publicado: ${url(appUrl, `/posts/${post.code}`)}`,
    ].join("\n"),
  };
}

export type FailureWhat = "generation" | "render" | "publish" | "ideas";

const FAILURE_LABELS: Record<FailureWhat, string> = {
  generation: "la generación de",
  render: "el render de",
  publish: "la publicación de",
  ideas: "el pedido de ideas de",
};

/** Something failed for good (after its retries). `id` makes it once per failure. */
export function failureNotice(input: {
  what: FailureWhat;
  id: string;
  subject: string;
  error: string;
  link: string | null;
  appUrl: string;
}): Notice {
  const error =
    input.error.length > MAX_ERROR_CHARS
      ? `${input.error.slice(0, MAX_ERROR_CHARS)}…`
      : input.error;
  return {
    key: `failure:${input.what}:${input.id}`,
    kind: "failure",
    text: [
      `❗ Falló ${FAILURE_LABELS[input.what]} ${input.subject}.`,
      error,
      ...(input.link ? ["", url(input.appUrl, input.link)] : []),
    ].join("\n"),
  };
}

/** A provider hit its limit; told at most once an hour (the key carries the hour, in UTC). */
export function limitNotice(input: { now: Date; retryAt: Date; timeZone: string }): Notice {
  return {
    key: `limit:${input.now.toISOString().slice(0, 13)}`,
    kind: "limit",
    text: `⏳ La IA llegó a su límite de uso. Las generaciones pendientes se reintentan solas (la próxima, ${shortDateTime(input.retryAt, input.timeZone)}).`,
  };
}

/** Whether a limit's retry leaves a post too little time before its planned publication. */
export function limitPutsAtRisk(retryAt: Date, plannedAt: Date | null): boolean {
  return plannedAt !== null && retryAt.getTime() > plannedAt.getTime() - LIMIT_RISK_MARGIN_MS;
}

export function limitRiskNotice(input: {
  post: { id: string; code: string; brandName: string; plannedAt: Date };
  retryAt: Date;
  timeZone: string;
  appUrl: string;
}): Notice {
  const { post } = input;
  return {
    key: `limit-risk:${post.id}:${post.plannedAt.toISOString()}`,
    kind: "limit",
    text: [
      `⚠️ ${post.code} (${post.brandName}) está planeado para ${shortDateTime(post.plannedAt, input.timeZone)}, pero la IA recién puede escribirlo ${shortDateTime(input.retryAt, input.timeZone)}: quizás no llegue a revisarse a tiempo.`,
      url(input.appUrl, `/posts/${post.code}`),
    ].join("\n"),
  };
}

/** A brand reached its own generation cap during the automatic filling (once a day). */
export function capNotice(input: {
  brandSlug: string;
  brandName: string;
  localDate: string;
}): Notice {
  return {
    key: `cap:${input.brandSlug}:${input.localDate}`,
    kind: "cap",
    text: `🧮 ${input.brandName} llegó a su tope de generaciones: quedaron horarios sin post. Se cambia en Marcas → General → Topes de IA.`,
  };
}

/**
 * When a notice about the night's work (posts to review) goes out: after the generation window,
 * if it is running; otherwise a few minutes from now, so the posts rendering together go in one.
 */
export function reviewNoticeAt(now: Date, window: GenerationWindow): Date {
  const soon = new Date(now.getTime() + REVIEW_NOTICE_DELAY_MS);
  if (!isWithinWindow(now, window)) return soon;
  const end = parseLocalTime(window.end);
  if (!end) return soon;
  const w = wallClock(now, window.timeZone);
  let at = zonedToUtc({ year: w.year, month: w.month, day: w.day, ...end }, window.timeZone);
  // A window crossing midnight ends tomorrow when it is still before midnight.
  if (at <= now) {
    const next = new Date(Date.UTC(w.year, w.month - 1, w.day + 1, 12));
    at = zonedToUtc(
      {
        year: next.getUTCFullYear(),
        month: next.getUTCMonth() + 1,
        day: next.getUTCDate(),
        ...end,
      },
      window.timeZone,
    );
  }
  return at > soon ? at : soon;
}

/** Inside the generation window notices arrive without sound (the operator may be asleep). */
export function isQuietTime(now: Date, window: GenerationWindow): boolean {
  return isWithinWindow(now, window);
}

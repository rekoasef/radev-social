import {
  GENERATION_WINDOW_KEY,
  isQuietTime,
  JOBS,
  type NotifySendJob,
  parseGenerationWindow,
} from "@radev/core";
import {
  type Database,
  getNotification,
  getSetting,
  markNotificationFailed,
  markNotificationSent,
  takeReviewNotice,
} from "@radev/db";
import type { Logger } from "../logger";
import type { SendMessage } from "../notify/telegram";

// notify.send and review.notify (phase 4, T6). Sending is its own job with retries: a message is
// sent once (a sent one is skipped) and a failure is kept on the notification for Settings.

export type SendDeps = { db: Database; log: Logger; send: SendMessage | null };

export type SendOutcome = "sent" | "already-sent" | "missing" | "not-configured";

export async function sendNotification(deps: SendDeps, job: NotifySendJob): Promise<SendOutcome> {
  const notification = await getNotification(deps.db, job.notificationId);
  if (!notification) return "missing";
  if (notification.sentAt) return "already-sent";
  if (!deps.send) {
    // Kept (not failed for good): once Telegram is set up, "Enviar prueba" shows it works.
    await markNotificationFailed(deps.db, notification.id, "Telegram no está configurado.");
    return "not-configured";
  }
  try {
    await deps.send({ text: notification.text, silent: notification.silent });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markNotificationFailed(deps.db, notification.id, message);
    throw error;
  }
  await markNotificationSent(deps.db, notification.id);
  deps.log.info("notification sent", { kind: notification.kind, key: notification.key });
  return "sent";
}

export type ReviewDeps = {
  db: Database;
  appUrl: string;
  queueSend: (notificationId: string) => Promise<void>;
};

/** The posts waiting for review that were not told yet, in one message. */
export async function notifyReview(deps: ReviewDeps): Promise<boolean> {
  const window = parseGenerationWindow(await getSetting(deps.db, GENERATION_WINDOW_KEY));
  const stored = await takeReviewNotice(deps.db, {
    appUrl: deps.appUrl,
    silent: isQuietTime(new Date(), window),
  });
  if (!stored) return false;
  await deps.queueSend(stored.id);
  return true;
}

export const NOTIFY_JOBS = [JOBS.notifySend, JOBS.reviewNotify] as const;

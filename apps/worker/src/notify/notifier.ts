import {
  GENERATION_WINDOW_KEY,
  isQuietTime,
  JOBS,
  type Notice,
  type NotifySendJob,
  parseGenerationWindow,
  REVIEW_NOTIFY_KEY,
  reviewNoticeAt,
} from "@radev/core";
import { type Database, getSetting, storeNotification } from "@radev/db";
import type { PgBoss } from "pg-boss";

// Raising a notice from any job: stored with its key (the same key never twice) and handed to
// `notify.send`, so a Telegram hiccup never breaks the job that raised it (phase 4, T6).

export type Notifier = {
  /** The panel's public address, for the links in the messages. */
  appUrl: string;
  /** `urgent`: with sound even at night (the time to publish). */
  notify: (notice: Notice, options?: { urgent?: boolean }) => Promise<void>;
  /** Some post got to review: one notice for all of them, a bit later (or after the window). */
  reviewSoon: () => Promise<void>;
};

export function createNotifier(input: { db: Database; boss: PgBoss; appUrl: string }): Notifier {
  const { db, boss } = input;
  const window = async () => parseGenerationWindow(await getSetting(db, GENERATION_WINDOW_KEY));
  return {
    appUrl: input.appUrl,
    async notify(notice, options) {
      const silent = !options?.urgent && isQuietTime(new Date(), await window());
      const stored = await storeNotification(db, { ...notice, silent });
      if (!stored) return;
      const data: NotifySendJob = { notificationId: stored.id };
      await boss.send(JOBS.notifySend, data, { singletonKey: `notify:${stored.id}` });
    },
    async reviewSoon() {
      await boss.send(
        JOBS.reviewNotify,
        {},
        { singletonKey: REVIEW_NOTIFY_KEY, startAfter: reviewNoticeAt(new Date(), await window()) },
      );
    },
  };
}

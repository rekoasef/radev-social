import { describe, expect, it } from "vitest";
import {
  capNotice,
  failureNotice,
  limitNotice,
  limitPutsAtRisk,
  limitRiskNotice,
  publishNotice,
  REVIEW_NOTICE_DELAY_MS,
  reviewNotice,
  reviewNoticeAt,
  shortDateTime,
} from "./messages";

const BA = "America/Argentina/Buenos_Aires";
const APP = "https://app.gestorlumus.site/";

describe("messages", () => {
  it("writes dates the short way, in the brand's zone", () => {
    expect(shortDateTime(new Date("2026-09-26T22:00:00Z"), BA)).toBe("sáb 26/09 19:00");
  });

  it("groups the posts to review, with their links", () => {
    const notice = reviewNotice(
      [
        {
          code: "LU-0008",
          brandName: "Lumus",
          hook: "El dólar hoy",
          plannedFor: "sáb 26/09 19:00",
        },
        { code: "RA-0005", brandName: "RAdev", hook: "Tu WhatsApp", plannedFor: null },
      ],
      APP,
      "review:x",
    );
    expect(notice.text).toBe(
      "📝 Hay 2 posts para revisar:\n\n" +
        "• LU-0008 (Lumus): El dólar hoy · para sáb 26/09 19:00\n  https://app.gestorlumus.site/posts/LU-0008\n" +
        "• RA-0005 (RAdev): Tu WhatsApp\n  https://app.gestorlumus.site/posts/RA-0005",
    );
  });

  it("reminds to publish once per post and time", () => {
    const at = new Date("2026-09-26T22:00:00Z");
    const notice = publishNotice(
      { id: "p1", code: "LU-0007", brandName: "Lumus", hook: "Tu plata", scheduledAt: at },
      APP,
    );
    expect(notice.key).toBe("publish:p1:2026-09-26T22:00:00.000Z");
    expect(notice.text).toContain("https://app.gestorlumus.site/posts/LU-0007/download");
  });

  it("cuts long errors and keys failures by what failed", () => {
    const notice = failureNotice({
      what: "generation",
      id: "p1:3",
      subject: "RA-0005",
      error: "x".repeat(400),
      link: "/posts/RA-0005",
      appUrl: APP,
    });
    expect(notice.key).toBe("failure:generation:p1:3");
    expect(notice.text.startsWith("❗ Falló la generación de RA-0005.")).toBe(true);
    expect(notice.text).toContain(`${"x".repeat(300)}…`);
  });

  it("tells a limit once an hour, and when it risks a planned post", () => {
    const now = new Date("2026-09-26T13:20:00Z");
    const retryAt = new Date("2026-09-26T17:00:00Z");
    expect(limitNotice({ now, retryAt, timeZone: BA }).key).toBe("limit:2026-09-26T13");
    expect(limitPutsAtRisk(retryAt, new Date("2026-09-26T18:30:00Z"))).toBe(true);
    expect(limitPutsAtRisk(retryAt, new Date("2026-09-26T22:00:00Z"))).toBe(false);
    expect(limitPutsAtRisk(retryAt, null)).toBe(false);
    const risk = limitRiskNotice({
      post: {
        id: "p1",
        code: "RA-0005",
        brandName: "RAdev",
        plannedAt: new Date("2026-09-26T18:30:00Z"),
      },
      retryAt,
      timeZone: BA,
      appUrl: APP,
    });
    expect(risk.text).toContain("planeado para sáb 26/09 15:30");
    expect(capNotice({ brandSlug: "lumus", brandName: "Lumus", localDate: "2026-09-26" }).key).toBe(
      "cap:lumus:2026-09-26",
    );
  });
});

describe("reviewNoticeAt", () => {
  const window = { enabled: true, start: "02:00", end: "07:00", timeZone: BA };

  it("waits a few minutes outside the window", () => {
    const now = new Date("2026-09-26T15:00:00Z");
    expect(reviewNoticeAt(now, window).getTime()).toBe(now.getTime() + REVIEW_NOTICE_DELAY_MS);
    expect(reviewNoticeAt(now, { ...window, enabled: false }).getTime()).toBe(
      now.getTime() + REVIEW_NOTICE_DELAY_MS,
    );
  });

  it("waits for the end of the window during the night's work", () => {
    // 03:10 in Buenos Aires → 07:00 the same day.
    expect(reviewNoticeAt(new Date("2026-09-26T06:10:00Z"), window).toISOString()).toBe(
      "2026-09-26T10:00:00.000Z",
    );
    // A window crossing midnight, at 23:30 → 05:00 the next day.
    const night = { ...window, start: "23:00", end: "05:00" };
    expect(reviewNoticeAt(new Date("2026-09-27T02:30:00Z"), night).toISOString()).toBe(
      "2026-09-27T08:00:00.000Z",
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../logger";
import { telegramConfig, telegramSender } from "../notify/telegram";
import { sendNotification } from "./notify";

const store = vi.hoisted(() => ({
  row: undefined as
    | undefined
    | { id: string; kind: string; key: string; text: string; silent: boolean; sentAt: Date | null },
  sent: [] as string[],
  failed: [] as string[],
}));

vi.mock("@radev/db", () => ({
  getNotification: async () => store.row,
  markNotificationSent: async (_: unknown, id: string) => {
    store.sent.push(id);
  },
  markNotificationFailed: async (_: unknown, _id: string, error: string) => {
    store.failed.push(error);
  },
}));

const log = createLogger({}, "error");
const job = { notificationId: "n1" };

describe("notify.send", () => {
  beforeEach(() => {
    store.row = { id: "n1", kind: "test", key: "test:1", text: "Hola", silent: true, sentAt: null };
    store.sent = [];
    store.failed = [];
  });

  it("sends once, silent when the notice says so", async () => {
    const send = vi.fn(async () => {});
    expect(await sendNotification({ db: {} as never, log, send }, job)).toBe("sent");
    expect(send).toHaveBeenCalledWith({ text: "Hola", silent: true });
    expect(store.sent).toEqual(["n1"]);
    store.row = { ...(store.row as NonNullable<typeof store.row>), sentAt: new Date() };
    expect(await sendNotification({ db: {} as never, log, send }, job)).toBe("already-sent");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps the notice when Telegram is not set up", async () => {
    expect(await sendNotification({ db: {} as never, log, send: null }, job)).toBe(
      "not-configured",
    );
    expect(store.failed).toEqual(["Telegram no está configurado."]);
  });

  it("stores the error and fails the job so pg-boss retries", async () => {
    const send = vi.fn(async () => {
      throw new Error("Bad Gateway");
    });
    await expect(sendNotification({ db: {} as never, log, send }, job)).rejects.toThrow(
      "Bad Gateway",
    );
    expect(store.failed).toEqual(["Bad Gateway"]);
    expect(store.sent).toEqual([]);
  });
});

describe("telegram", () => {
  it("needs both the token and the chat", () => {
    expect(telegramConfig({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: " 1 " })).toEqual({
      token: "t",
      chatId: "1",
    });
    expect(telegramConfig({ TELEGRAM_BOT_TOKEN: "t" })).toBeNull();
  });

  it("never lets the token out in an error", async () => {
    const token = "123456:SECRET";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(
        new Error(`request to https://api.telegram.org/bot${token}/sendMessage failed`),
      );
    const send = telegramSender({ token, chatId: "1" });
    const error = await send({ text: "x", silent: false }).catch((e: Error) => e);
    expect(String(error)).not.toContain("SECRET");
    fetchSpy.mockRestore();
  });
});

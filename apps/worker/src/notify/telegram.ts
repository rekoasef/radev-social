import { Api } from "grammy";

// Sending to the operator's Telegram (docs/ARCHITECTURE.md §6, phase 4 T6). Only sending: the bot
// does not read messages. Nothing here logs the token.

export type TelegramConfig = { token: string; chatId: string };

/** The bot's settings from the environment, or null when Telegram is not set up. */
export function telegramConfig(env: NodeJS.ProcessEnv = process.env): TelegramConfig | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  return token && chatId ? { token, chatId } : null;
}

export type SendMessage = (input: { text: string; silent: boolean }) => Promise<void>;

export function telegramSender(config: TelegramConfig): SendMessage {
  const api = new Api(config.token);
  return async ({ text, silent }) => {
    try {
      await api.sendMessage(config.chatId, text, {
        disable_notification: silent,
        link_preview_options: { is_disabled: true },
      });
    } catch (error) {
      // An HTTP error can carry the URL, which has the token in it.
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(message.replaceAll(config.token, "<token>"));
    }
  };
}

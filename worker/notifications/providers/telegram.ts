import { sendOfficialTelegramMessage } from "../../telegramBot";
import type { NotificationMessage, NotificationResult, NotificationTarget } from "../types";

export type TelegramProviderEnv = {
  NAVIXA_TELEGRAM_BOT_TOKEN?: string;
};

export async function sendTelegramNotification(env: TelegramProviderEnv, target: NotificationTarget, message: NotificationMessage): Promise<NotificationResult> {
  const chatId = target.chatId?.trim() || "";
  const token = env.NAVIXA_TELEGRAM_BOT_TOKEN?.trim() || "";
  if (!chatId || !token) {
    return { channel: "telegram", ok: false, skipped: true, reason: "telegram_not_configured" };
  }

  try {
    const ok = await sendOfficialTelegramMessage({ chatId, token, text: message.text });
    return { channel: "telegram", ok, reason: ok ? undefined : "telegram_delivery_failed" };
  } catch {
    return { channel: "telegram", ok: false, reason: "telegram_delivery_failed" };
  }
}

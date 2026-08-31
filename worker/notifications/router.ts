import type { NotificationResult, NotificationSendInput } from "./types";
import type { EmailProviderEnv } from "./providers/email";
import type { SmsProviderEnv } from "./providers/sms";
import type { TelegramProviderEnv } from "./providers/telegram";
import type { WhatsAppProviderEnv } from "./providers/whatsapp";
import type { MessagingQuotaDb } from "./messagingQuota";

export type NotificationRouterEnv = EmailProviderEnv & SmsProviderEnv & TelegramProviderEnv & WhatsAppProviderEnv & { DB?: MessagingQuotaDb };

async function sendRestrictedPaidChannel(env: NotificationRouterEnv, input: NotificationSendInput): Promise<NotificationResult> {
  const channel = input.channel === "sms" ? "sms" : "whatsapp";
  const event = input.eventType;
  if (!event) return { channel, ok: false, skipped: true, reason: "restricted_channel" };

  const { isCriticalMessagingEvent, isPremiumMessagingEvent, reservePremiumMessage, commitPremiumMessage } = await import("./messagingQuota");
  if (!isPremiumMessagingEvent(event)) return { channel, ok: false, skipped: true, reason: "event_not_allowed" };

  if (!isCriticalMessagingEvent(event)) {
    if (!input.subscriberId || !env.DB) return { channel, ok: false, skipped: true, reason: "messaging_allowance_required" };
    const reservation = await reservePremiumMessage(env.DB, input.subscriberId, event);
    if (!reservation.allowed) return { channel, ok: false, skipped: true, reason: reservation.reason };
  }

  const result = channel === "sms"
    ? await (await import("./providers/sms")).sendSmsNotification(env, input.target, input.message)
    : await (await import("./providers/whatsapp")).sendWhatsAppNotification(env, input.target, input.message);

  if (result.ok && input.subscriberId && env.DB && !isCriticalMessagingEvent(event)) {
    await commitPremiumMessage(env.DB, input.subscriberId, event);
  }
  return result;
}

export async function sendNotification(env: NotificationRouterEnv, input: NotificationSendInput): Promise<NotificationResult> {
  switch (input.channel) {
    case "email": {
      const { sendEmailNotification } = await import("./providers/email");
      return sendEmailNotification(env, input.target, input.message);
    }
    case "telegram": {
      const { sendTelegramNotification } = await import("./providers/telegram");
      return sendTelegramNotification(env, input.target, input.message);
    }
    case "sms":
    case "whatsapp":
      return sendRestrictedPaidChannel(env, input);
  }
}

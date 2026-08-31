import type { NotificationResult, NotificationSendInput } from "./types";
import type { EmailProviderEnv } from "./providers/email";
import type { SmsProviderEnv } from "./providers/sms";
import type { TelegramProviderEnv } from "./providers/telegram";
import type { WhatsAppProviderEnv } from "./providers/whatsapp";

export type NotificationRouterEnv = EmailProviderEnv & SmsProviderEnv & TelegramProviderEnv & WhatsAppProviderEnv;

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
    case "sms": {
      const { sendSmsNotification } = await import("./providers/sms");
      return sendSmsNotification(env, input.target, input.message);
    }
    case "whatsapp": {
      const { sendWhatsAppNotification } = await import("./providers/whatsapp");
      return sendWhatsAppNotification(env, input.target, input.message);
    }
  }
}

import type { NotificationMessage, NotificationResult, NotificationTarget } from "../types";

export type SmsProviderEnv = {
  NAVIXA_SMS_ENDPOINT?: string;
  NAVIXA_SMS_API_KEY?: string;
  NAVIXA_SMS_SENDER?: string;
};

export async function sendSmsNotification(env: SmsProviderEnv, target: NotificationTarget, message: NotificationMessage): Promise<NotificationResult> {
  const phone = target.phone?.trim() || "";
  const endpoint = env.NAVIXA_SMS_ENDPOINT?.trim() || "";
  const apiKey = env.NAVIXA_SMS_API_KEY?.trim() || "";
  if (!phone || !endpoint || !apiKey) {
    return { channel: "sms", ok: false, skipped: true, reason: "sms_not_configured" };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: phone, from: env.NAVIXA_SMS_SENDER || "NAVIXA", text: message.text }),
    });
    return { channel: "sms", ok: response.ok, reason: response.ok ? undefined : "sms_delivery_failed" };
  } catch {
    return { channel: "sms", ok: false, reason: "sms_delivery_failed" };
  }
}

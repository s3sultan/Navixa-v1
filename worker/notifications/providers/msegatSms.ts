import type { NotificationMessage, NotificationResult, NotificationTarget } from "../types";
import { providerPhone } from "../phone";

export type MsegatSmsEnv = {
  NAVIXA_MSEGAT_USERNAME?: string;
  NAVIXA_MSEGAT_API_KEY?: string;
  NAVIXA_MSEGAT_SENDER?: string;
  NAVIXA_MSEGAT_SMS_ENDPOINT?: string;
};

export async function sendMsegatSms(env: MsegatSmsEnv, target: NotificationTarget, message: NotificationMessage): Promise<NotificationResult> {
  const phone = providerPhone(target.phone);
  const userName = env.NAVIXA_MSEGAT_USERNAME?.trim() || "";
  const apiKey = env.NAVIXA_MSEGAT_API_KEY?.trim() || "";
  const userSender = env.NAVIXA_MSEGAT_SENDER?.trim() || "";
  const endpoint = env.NAVIXA_MSEGAT_SMS_ENDPOINT?.trim() || "https://www.msegat.com/gw/sendsms.php";

  if (!phone) return { channel: "sms", ok: false, skipped: true, reason: "invalid_saudi_phone" };
  if (!userName || !apiKey || !userSender) {
    return { channel: "sms", ok: false, skipped: true, reason: "msegat_not_configured" };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName,
        apiKey,
        numbers: phone,
        userSender,
        msg: message.text,
      }),
    });

    if (!response.ok) return { channel: "sms", ok: false, reason: "msegat_http_error" };

    const body = await response.text();
    const normalized = body.trim().toLowerCase();
    const accepted = normalized === "1" || normalized.includes("success") || normalized.includes("sent") || normalized.includes("msgid");
    return { channel: "sms", ok: accepted, reason: accepted ? undefined : "msegat_rejected" };
  } catch {
    return { channel: "sms", ok: false, reason: "msegat_delivery_failed" };
  }
}

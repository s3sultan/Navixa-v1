import type { NotificationMessage, NotificationResult, NotificationTarget } from "../types";

export type EmailProviderEnv = {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  NAVIXA_AUTH_FROM?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendEmailNotification(env: EmailProviderEnv, target: NotificationTarget, message: NotificationMessage): Promise<NotificationResult> {
  const to = target.address?.trim() || "";
  const from = env.RESEND_FROM_EMAIL || env.NAVIXA_AUTH_FROM;
  if (!emailPattern.test(to) || !env.RESEND_API_KEY || !from) {
    return { channel: "email", ok: false, skipped: true, reason: "email_not_configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: message.subject || "NAVIXA", text: message.text }),
    });
    return { channel: "email", ok: response.ok, reason: response.ok ? undefined : "email_delivery_failed" };
  } catch {
    return { channel: "email", ok: false, reason: "email_delivery_failed" };
  }
}

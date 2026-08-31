import type { NotificationMessage, NotificationResult, NotificationTarget } from "../types";

export type WhatsAppProviderEnv = {
  NAVIXA_WHATSAPP_ENDPOINT?: string;
  NAVIXA_WHATSAPP_ACCESS_TOKEN?: string;
  NAVIXA_WHATSAPP_TEMPLATE?: string;
};

export async function sendWhatsAppNotification(env: WhatsAppProviderEnv, target: NotificationTarget, message: NotificationMessage): Promise<NotificationResult> {
  const phone = target.phone?.trim() || "";
  const endpoint = env.NAVIXA_WHATSAPP_ENDPOINT?.trim() || "";
  const token = env.NAVIXA_WHATSAPP_ACCESS_TOKEN?.trim() || "";
  if (!phone || !endpoint || !token) {
    return { channel: "whatsapp", ok: false, skipped: true, reason: "whatsapp_not_configured" };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: phone, text: message.text, template: env.NAVIXA_WHATSAPP_TEMPLATE || undefined }),
    });
    return { channel: "whatsapp", ok: response.ok, reason: response.ok ? undefined : "whatsapp_delivery_failed" };
  } catch {
    return { channel: "whatsapp", ok: false, reason: "whatsapp_delivery_failed" };
  }
}

const encoder = new TextEncoder();

export type SallaWebhookEvent = {
  eventId: string;
  eventType: string;
  orderId: string;
  payloadHash: string;
};

const scalar = (value: unknown, limit: number) => typeof value === "string" || typeof value === "number"
  ? String(value).trim().slice(0, limit)
  : "";

const safePart = (value: string, limit: number) => value.length > 0 && value.length <= limit && /^[a-zA-Z0-9_:.-]+$/.test(value);

export async function sha256Hex(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * لا نعتمد رقم الطلب وحده كمعرف حدث: قد تتغير حالة الطلب عدة مرات.
 * إذا لم يرسل سلة معرف حدث مستقلًا، تستخدم بصمة الجسم الخام لتكرار التسليم
 * المتطابق فقط، مع بقاء كل تغير حقيقي في حالة الطلب حدثًا مستقلًا.
 */
export async function parseSallaWebhookEvent(rawBody: string, payload: Record<string, unknown>): Promise<SallaWebhookEvent | null> {
  const eventType = scalar(payload.event, 80);
  const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : {};
  const order = data.order && typeof data.order === "object" ? data.order as Record<string, unknown> : {};
  const orderId = scalar(data.id ?? order.id ?? payload.order_id, 120);
  if (!safePart(eventType, 80) || !safePart(orderId, 120)) return null;

  const payloadHash = await sha256Hex(rawBody);
  const suppliedEventId = scalar(payload.id ?? payload.event_id ?? data.event_id, 160);
  const eventId = safePart(suppliedEventId, 160)
    ? suppliedEventId
    : `${eventType}:${orderId}:${payloadHash}`;

  return { eventId, eventType, orderId, payloadHash };
}

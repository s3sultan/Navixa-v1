import { NextResponse } from "next/server.js";
import { createMemoryRateLimiter, isTrustedSameOriginRequest } from "../../../worker/adminAuth.ts";

const TOKEN_PATTERN = /^\d+:[\w-]+$/;
const telegramLimiter = createMemoryRateLimiter();

function clientKey(request: Request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) {
    return NextResponse.json({ error: "مصدر الطلب غير موثوق" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const limit = telegramLimiter.consume(clientKey(request), 5, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "تجاوزت الحد المؤقت للطلبات" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(limit.retryAfterSeconds) } });
  }

  try {
    const body = await request.json();
    const custom = typeof body.message === "string" ? body.message : "";
    const text = custom.slice(0, 500);
    if (!text) return NextResponse.json({ error: "رسالة غير صالحة" }, { status: 400 });
    const token = typeof body.token === "string" ? body.token : "";
    const chatId = typeof body.chatId === "string" ? body.chatId : "";
    if (!TOKEN_PATTERN.test(token) || !chatId) return NextResponse.json({ error: "إعدادات تلقرام الشخصية غير مكتملة" }, { status: 400 });
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text }) });
    if (!response.ok) return NextResponse.json({ error: "تعذر إرسال التنبيه" }, { status: 502 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "تعذر معالجة التنبيه" }, { status: 500 });
  }
}

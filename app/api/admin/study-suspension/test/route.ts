import { NextResponse } from "next/server.js";
import {
  ADMIN_SESSION_COOKIE,
  isTrustedSameOriginRequest,
  readCookie,
  resolveAdminJwtSecret,
  verifyAdminSessionToken,
} from "../../../../../worker/adminAuth.ts";
import { resolveUserSession } from "../../../../../worker/userAuth.ts";
import { dispatchStudySuspensionEvent, type StudySuspensionEvent } from "../../../../../worker/studySuspension.ts";
import {
  createD1StudySuspensionLedger,
  enableStudySuspensionTestRecipient,
  loadStudySuspensionRecipient,
  type StudySuspensionD1Database,
} from "../../../../../worker/studySuspensionStore.ts";

type WorkerBinding = { env?: { DB?: StudySuspensionD1Database } };
async function db() { try { return (await import("cloudflare:workers") as WorkerBinding).env?.DB || null; } catch { return (globalThis as { DB?: StudySuspensionD1Database }).DB || null; } }
function reply(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } }); }

async function ownerSession(request: Request, database: StudySuspensionD1Database) {
  const secret = await resolveAdminJwtSecret();
  const admin = secret ? await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret) : null;
  const user = await resolveUserSession(request, database);
  if (!admin || !user) return null;
  if (admin.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) return null;
  return user;
}

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) return reply({ error: "مصدر الطلب غير موثوق" }, 403);
  const database = await db();
  if (!database) return reply({ error: "التخزين غير مهيأ" }, 503);
  const user = await ownerSession(request, database);
  if (!user) return reply({ error: "الاختبار يتطلب جلسة الإدارة وحساب NAVIXA نفسه" }, 401);

  await enableStudySuspensionTestRecipient(database, user.userId);
  const recipient = await loadStudySuspensionRecipient(database, user.userId, {
    educationType: "general",
    role: "student",
    regionId: "riyadh",
    cityId: "riyadh-city",
    educationAdminId: "riyadh-education",
  });

  const testId = `test-${Date.now()}`;
  const event: StudySuspensionEvent = {
    id: testId,
    sourcePostId: testId,
    source: {
      entityType: "education_admin",
      entityId: "riyadh-education",
      name: "إدارة تعليم الرياض",
      verified: true,
    },
    sourceUrl: "https://x.com/MOE_RYH",
    publishedAt: new Date().toISOString(),
    decisionType: "suspend",
    educationType: "general",
    scope: { type: "education_admin", ids: ["riyadh-education"] },
    audience: "all",
    verification: "official_primary",
    summary: "تنبيه تجريبي من NAVIXA فقط. هذا لا يمثل قرار تعليق دراسة حقيقيًا.",
  };

  const result = await dispatchStudySuspensionEvent(event, [recipient], {
    mode: "test",
    testRecipientIds: [user.userId],
    ledger: createD1StudySuspensionLedger(database),
  });

  return reply({
    ok: true,
    testOnly: true,
    recipientBound: user.userId,
    channels: {
      push: Boolean(recipient.pushSubscription),
      telegram: Boolean(recipient.telegramChatId),
    },
    result,
  });
}

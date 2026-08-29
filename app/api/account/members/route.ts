import { NextResponse } from "next/server.js";
import { isTrustedSameOriginRequest } from "../../../../worker/adminAuth.ts";
import { addMemberSeat, listMemberSeats, removeMemberSeat } from "../../../../worker/memberEntitlements.ts";
import { resolveUserSession, type D1Database } from "../../../../worker/userAuth.ts";
import type { NavixaMemberProject, NavixaMemberRole } from "../../../../worker/subscriptionMembers.ts";

type WorkerBinding = { env?: { DB?: D1Database } };
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };

async function database(): Promise<D1Database | null> {
  try { return (await import("cloudflare:workers") as WorkerBinding).env?.DB || null; }
  catch { return (globalThis as { DB?: D1Database }).DB || null; }
}

async function context(request: Request) {
  const db = await database();
  if (!db) return { error: NextResponse.json({ error: "الخدمة غير متاحة مؤقتًا" }, { status: 503, headers }) };
  const session = await resolveUserSession(request, db);
  if (!session || session.status !== "active") return { error: NextResponse.json({ error: "يلزم تسجيل الدخول" }, { status: 401, headers }) };
  return { db, session };
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "unknown";
  const errors: Record<string, [number, string]> = {
    invalid_email: [400, "البريد الإلكتروني غير صالح"],
    owner_email: [400, "لا يمكن إضافة بريد الحساب الأساسي كعضو"],
    plus_required: [403, "إدارة الأعضاء متاحة لمشترك Plus النشط فقط"],
    project_required: [400, "اختر مشروعًا واحدًا للحساب الإضافي المدفوع"],
    email_has_plus: [409, "هذا البريد لديه اشتراك Plus نشط بالفعل"],
    email_in_use: [409, "هذا البريد مرتبط بعضوية نشطة أخرى"],
    seat_limit: [409, "تم الوصول إلى الحد المسموح لهذا النوع من الحسابات"],
    seat_cooldown: [409, "المقعد ما زال في فترة التبريد"],
    member_not_found: [404, "العضو غير موجود"],
    member_locked: [409, "لا يمكن تغيير هذا العضو قبل انتهاء مدة الارتباط"],
  };
  const [status, message] = errors[code] || [500, "تعذر تنفيذ الطلب"];
  return NextResponse.json({ error: message, code }, { status, headers });
}

export async function GET(request: Request) {
  const ctx = await context(request);
  if ("error" in ctx) return ctx.error;
  return NextResponse.json({ members: await listMemberSeats(ctx.db, ctx.session.userId) }, { headers });
}

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) return NextResponse.json({ error: "طلب غير موثوق" }, { status: 403, headers });
  const ctx = await context(request);
  if ("error" in ctx) return ctx.error;
  try {
    const body = await request.json() as { email?: unknown; role?: unknown; project?: unknown };
    if (typeof body.email !== "string" || !["full_member", "project_member", "kid"].includes(String(body.role))) {
      return NextResponse.json({ error: "بيانات العضو غير مكتملة" }, { status: 400, headers });
    }
    const role = body.role as NavixaMemberRole;
    const project = typeof body.project === "string" && ["fitness", "learning", "kids"].includes(body.project) ? body.project as NavixaMemberProject : undefined;
    const member = await addMemberSeat(ctx.db, { ownerUserId: ctx.session.userId, ownerEmail: ctx.session.email, email: body.email, role, project });
    return NextResponse.json({ member }, { status: 201, headers });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  if (!isTrustedSameOriginRequest(request)) return NextResponse.json({ error: "طلب غير موثوق" }, { status: 403, headers });
  const ctx = await context(request);
  if ("error" in ctx) return ctx.error;
  try {
    const body = await request.json() as { id?: unknown };
    if (typeof body.id !== "string" || !body.id) return NextResponse.json({ error: "معرف العضو مطلوب" }, { status: 400, headers });
    return NextResponse.json({ member: await removeMemberSeat(ctx.db, ctx.session.userId, body.id) }, { headers });
  } catch (error) { return errorResponse(error); }
}

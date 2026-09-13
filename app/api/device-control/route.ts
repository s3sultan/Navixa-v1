import { NextResponse } from "next/server.js";
import { hashOpaqueValue, readUserSessionToken, resolveUserSession, trustedUserMutation, type D1Database, type UserDeviceClass } from "../../../worker/userAuth.ts";

type Database = D1Database;
type DeviceCommand = "prepare_name_listener" | "prepare_screen_watch" | "open_alerts" | "open_account_sync";
type ControlRow = {
  id: string;
  command: DeviceCommand;
  status: "pending" | "acknowledged" | "dismissed";
  source_device_class: UserDeviceClass;
  target_device_class: UserDeviceClass;
  created_at: string;
  expires_at: string;
  acknowledged_at: string;
};

const allowedCommands = new Set<DeviceCommand>(["prepare_name_listener","prepare_screen_watch","open_alerts","open_account_sync"]);
const REQUEST_TTL_MS = 5 * 60 * 1000;
const MAX_PENDING = 8;

async function database(): Promise<Database | null> {
  try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; }
  catch { return (globalThis as { DB?: Database }).DB || null; }
}

const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });

async function persistedDeviceClass(db: Database, request: Request, userId: string): Promise<UserDeviceClass | null> {
  const token = readUserSessionToken(request);
  if (!token || token.length < 30) return null;
  const rows = await db.prepare("SELECT device_class FROM navixa_user_sessions WHERE token_hash=? AND user_id=? AND revoked_at='' AND expires_at>? AND device_class IN ('computer','mobile') LIMIT 1").bind(await hashOpaqueValue(token), userId, new Date().toISOString()).all<{ device_class: UserDeviceClass }>();
  return rows.results[0]?.device_class || null;
}

async function computerSessionExists(db: Database, userId: string, now: string) {
  const rows = await db.prepare("SELECT id FROM navixa_user_sessions WHERE user_id=? AND device_class='computer' AND revoked_at='' AND expires_at>? LIMIT 1").bind(userId, now).all<{ id: string }>();
  return Boolean(rows.results[0]);
}

export async function GET(request: Request) {
  const db = await database();
  if (!db) return reply({ error: "التخزين غير مهيأ" }, 503);
  const session = await resolveUserSession(request, db);
  if (!session) return reply({ error: "سجّل الدخول أولًا" }, 401);
  const deviceClass = await persistedDeviceClass(db, request, session.userId);
  if (!deviceClass) return reply({ error: "جلسة الجهاز غير صالحة" }, 401);
  const now = new Date().toISOString();
  const computerSessionAvailable = await computerSessionExists(db, session.userId, now);
  const pending = deviceClass === "computer"
    ? (await db.prepare("SELECT id,command,status,source_device_class,target_device_class,created_at,expires_at,acknowledged_at FROM navixa_device_control_requests WHERE user_id=? AND target_device_class='computer' AND status='pending' AND expires_at>? ORDER BY created_at ASC LIMIT 8").bind(session.userId, now).all<ControlRow>()).results
    : [];
  const recent = deviceClass === "mobile"
    ? (await db.prepare("SELECT id,command,status,source_device_class,target_device_class,created_at,expires_at,acknowledged_at FROM navixa_device_control_requests WHERE user_id=? AND source_device_class='mobile' ORDER BY created_at DESC LIMIT 8").bind(session.userId).all<ControlRow>()).results
    : [];
  return reply({ deviceClass, computerSessionAvailable, pending, recent });
}

export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return reply({ error: "مصدر الطلب غير موثوق" }, 403);
  const db = await database();
  if (!db) return reply({ error: "التخزين غير مهيأ" }, 503);
  const session = await resolveUserSession(request, db);
  if (!session) return reply({ error: "سجّل الدخول أولًا" }, 401);
  const deviceClass = await persistedDeviceClass(db, request, session.userId);
  if (!deviceClass) return reply({ error: "جلسة الجهاز غير صالحة" }, 401);
  const body = await request.json().catch(() => ({})) as { action?: unknown; command?: unknown; requestId?: unknown; outcome?: unknown };
  const action = typeof body.action === "string" ? body.action : "";
  const now = new Date();
  const nowIso = now.toISOString();

  if (action === "create") {
    if (deviceClass !== "mobile") return reply({ error: "إنشاء طلبات التحكم متاح من الجوال فقط" }, 403);
    const command = typeof body.command === "string" && allowedCommands.has(body.command as DeviceCommand) ? body.command as DeviceCommand : null;
    if (!command) return reply({ error: "أمر غير مسموح" }, 400);
    const available = await computerSessionExists(db, session.userId, nowIso);
    if (!available) return reply({ error: "لا توجد جلسة كمبيوتر صالحة لهذا الحساب حاليًا" }, 409);
    const pendingRows = await db.prepare("SELECT id FROM navixa_device_control_requests WHERE user_id=? AND source_device_class='mobile' AND target_device_class='computer' AND status='pending' AND expires_at>? LIMIT ?").bind(session.userId, nowIso, MAX_PENDING).all<{ id: string }>();
    if (pendingRows.results.length >= MAX_PENDING) return reply({ error: "يوجد عدد كافٍ من الطلبات المعلقة. عالجها على الكمبيوتر أولًا" }, 429);
    const id = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() + REQUEST_TTL_MS).toISOString();
    await db.prepare("INSERT INTO navixa_device_control_requests(id,user_id,source_device_class,target_device_class,command,status,created_at,expires_at,acknowledged_at) VALUES (?,?, 'mobile','computer',?,'pending',?,?, '')").bind(id, session.userId, command, nowIso, expiresAt).run();
    return reply({ ok: true, request: { id, command, status: "pending", expiresAt } }, 201);
  }

  if (action === "acknowledge") {
    if (deviceClass !== "computer") return reply({ error: "تأكيد الطلب متاح من الكمبيوتر المستهدف فقط" }, 403);
    const requestId = typeof body.requestId === "string" ? body.requestId.slice(0, 80) : "";
    const outcome = body.outcome === "dismissed" ? "dismissed" : body.outcome === "acknowledged" ? "acknowledged" : null;
    if (!requestId || !outcome) return reply({ error: "بيانات التأكيد ناقصة" }, 400);
    const rows = await db.prepare("SELECT id FROM navixa_device_control_requests WHERE id=? AND user_id=? AND target_device_class='computer' AND status='pending' AND expires_at>? LIMIT 1").bind(requestId, session.userId, nowIso).all<{ id: string }>();
    if (!rows.results[0]) return reply({ error: "الطلب غير موجود أو انتهت صلاحيته" }, 404);
    await db.prepare("UPDATE navixa_device_control_requests SET status=?,acknowledged_at=? WHERE id=? AND user_id=? AND target_device_class='computer' AND status='pending'").bind(outcome, nowIso, requestId, session.userId).run();
    return reply({ ok: true, status: outcome });
  }

  return reply({ error: "إجراء غير مسموح" }, 400);
}

import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE, isTrustedSameOriginRequest, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../../worker/adminAuth.ts";
import { ensureSupportTicketSchema, parseSupportStatus, type D1Database } from "../../../../../worker/supportTickets.ts";

type Ticket = { id: string; user_id: string; product: string; category: string; subject: string; description: string; status: string; admin_reply: string; created_at: string; updated_at: string; closed_at: string };
async function db(): Promise<D1Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: D1Database } }).env?.DB || null; } catch { return (globalThis as { DB?: D1Database }).DB || null; } }
const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function allowed(request: Request) { const secret = await resolveAdminJwtSecret(); return Boolean(secret && await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret)); }
const cleanReply = (value: unknown) => typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, 1600) : "";

export async function GET(request: Request) {
  if (!await allowed(request)) return reply({ error: "غير مصرح" }, 401);
  const database = await db(); if (!database) return reply({ error: "خدمة الدعم غير متاحة الآن" }, 503);
  await ensureSupportTicketSchema(database);
  const status = new URL(request.url).searchParams.get("status") || "";
  const tickets = status ? await database.prepare("SELECT id,user_id,product,category,subject,description,status,admin_reply,created_at,updated_at,closed_at FROM navixa_support_tickets WHERE status=? ORDER BY updated_at DESC LIMIT 100").bind(status).all<Ticket>() : await database.prepare("SELECT id,user_id,product,category,subject,description,status,admin_reply,created_at,updated_at,closed_at FROM navixa_support_tickets ORDER BY updated_at DESC LIMIT 100").all<Ticket>();
  return reply({ tickets: tickets.results });
}

export async function PATCH(request: Request) {
  if (!isTrustedSameOriginRequest(request) || !await allowed(request)) return reply({ error: "غير مصرح" }, 401);
  const database = await db(); if (!database) return reply({ error: "خدمة الدعم غير متاحة الآن" }, 503);
  const body = await request.json().catch(() => ({})) as { id?: unknown; status?: unknown; reply?: unknown };
  const id = typeof body.id === "string" && /^[0-9a-f-]{20,}$/i.test(body.id) ? body.id : "";
  const status = parseSupportStatus(body.status); const adminReply = cleanReply(body.reply);
  if (!id || !status) return reply({ error: "بيانات التذكرة غير صالحة" }, 400);
  const now = new Date().toISOString(), closedAt = status === "closed" ? now : "";
  await ensureSupportTicketSchema(database);
  await database.prepare("UPDATE navixa_support_tickets SET status=?,admin_reply=?,updated_at=?,closed_at=? WHERE id=?").bind(status, adminReply, now, closedAt, id).run();
  return reply({ ok: true });
}

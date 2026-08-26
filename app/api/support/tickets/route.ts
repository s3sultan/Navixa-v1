import { NextResponse } from "next/server.js";
import { resolveUserSession, trustedUserMutation, type D1Database } from "../../../../worker/userAuth.ts";
import { ensureSupportTicketSchema, parseSupportTicketInput } from "../../../../worker/supportTickets.ts";

type Ticket = { id: string; product: string; category: string; subject: string; description: string; status: string; admin_reply: string; created_at: string; updated_at: string; closed_at: string };
async function db(): Promise<D1Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: D1Database } }).env?.DB || null; } catch { return (globalThis as { DB?: D1Database }).DB || null; } }
const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const database = await db(); if (!database) return reply({ error: "خدمة الدعم غير متاحة الآن" }, 503);
  const session = await resolveUserSession(request, database); if (!session) return reply({ error: "سجّل دخولك لعرض تذاكر الدعم" }, 401);
  await ensureSupportTicketSchema(database);
  const ticketId = new URL(request.url).searchParams.get("id") || "";
  if (ticketId) {
    const tickets = await database.prepare("SELECT id,product,category,subject,description,status,admin_reply,created_at,updated_at,closed_at FROM navixa_support_tickets WHERE id=? AND user_id=? LIMIT 1").bind(ticketId, session.userId).all<Ticket>();
    if (!tickets.results[0]) return reply({ error: "التذكرة غير موجودة" }, 404);
    return reply({ ticket: tickets.results[0] });
  }
  const tickets = await database.prepare("SELECT id,product,category,subject,status,admin_reply,created_at,updated_at,closed_at FROM navixa_support_tickets WHERE user_id=? ORDER BY updated_at DESC LIMIT 50").bind(session.userId).all<Ticket>();
  return reply({ tickets: tickets.results });
}

export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return reply({ error: "مصدر الطلب غير موثوق" }, 403);
  const database = await db(); if (!database) return reply({ error: "خدمة الدعم غير متاحة الآن" }, 503);
  const session = await resolveUserSession(request, database); if (!session) return reply({ error: "سجّل دخولك لفتح تذكرة" }, 401);
  const parsed = parseSupportTicketInput(await request.json().catch(() => ({}))); if (!parsed.ok) return reply({ error: parsed.error }, 400);
  await ensureSupportTicketSchema(database);
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
  const recent = await database.prepare("SELECT id FROM navixa_support_tickets WHERE user_id=? AND created_at>=? LIMIT 5").bind(session.userId, cutoff).all<{ id: string }>();
  if (recent.results.length >= 5) return reply({ error: "تم تجاوز الحد المؤقت للتذاكر. حاول بعد قليل." }, 429);
  const now = new Date().toISOString(), id = crypto.randomUUID(), input = parsed.value;
  await database.prepare("INSERT INTO navixa_support_tickets(id,user_id,product,category,subject,description,status,admin_reply,created_at,updated_at,closed_at) VALUES (?,?,?,?,?,?, 'new','',?,?, '')").bind(id, session.userId, input.product, input.category, input.subject, input.description, now, now).run();
  return reply({ ok: true, ticket: { id, product: input.product, category: input.category, subject: input.subject, status: "new", created_at: now } }, 201);
}

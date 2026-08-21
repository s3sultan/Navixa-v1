import { NextResponse } from "next/server.js";
import { clearUserSessionCookie, revokeUserSession, trustedUserMutation, type D1Database } from "../../../../worker/userAuth.ts";

type WorkerBinding = { env?: { DB?: D1Database } };

async function database(): Promise<D1Database | null> {
  try { return (await import("cloudflare:workers") as WorkerBinding).env?.DB || null; }
  catch { return (globalThis as { DB?: D1Database }).DB || null; }
}

export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const db = await database();
  if (db) await revokeUserSession(request, db).catch(() => undefined);
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": clearUserSessionCookie(), "Cache-Control": "no-store" } });
}

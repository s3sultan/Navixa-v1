import { NextResponse } from "next/server.js";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getUserAuthSettings, hashOpaqueValue, isValidUserEmail, normalizeUserEmail, trustedUserMutation, type D1Database } from "../../../../../../worker/userAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };

async function db(): Promise<Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; } catch { return (globalThis as { DB?: Database }).DB || null; } }

export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const database = await db();
  if (!database) return NextResponse.json({ error: "الدخول السريع غير متاح" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const settings = await getUserAuthSettings(database).catch(() => null);
  if (!settings?.userAuthEnabled || !settings.passkeysEnabled) return NextResponse.json({ error: "الدخول السريع غير مفعّل" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const body = await request.json().catch(() => ({})) as { email?: unknown }, email = normalizeUserEmail(body.email);
  if (!isValidUserEmail(email)) return NextResponse.json({ error: "أدخل بريدك أولًا" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const emailHash = await hashOpaqueValue(email);
  const users = await database.prepare("SELECT id FROM navixa_users WHERE email_hash=? AND status='active' LIMIT 1").bind(emailHash).all<{ id: string }>();
  const user = users.results[0];
  if (!user) return NextResponse.json({ error: "استخدم رمز البريد لإتمام الدخول" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const passkeys = await database.prepare("SELECT credential_id,transports_json FROM navixa_user_passkeys WHERE user_id=? AND revoked_at=''").bind(user.id).all<{ credential_id: string; transports_json: string }>();
  if (!passkeys.results.length) return NextResponse.json({ error: "لم يُفعّل دخول سريع لهذا الحساب بعد" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const options = await generateAuthenticationOptions({ rpID: new URL(request.url).hostname, timeout: 60_000, userVerification: "required", allowCredentials: passkeys.results.map(item => ({ id: item.credential_id, transports: JSON.parse(item.transports_json || "[]") as never[] })) });
  const now = new Date(), expiresAt = new Date(now.getTime() + 5 * 60_000).toISOString();
  await database.prepare("UPDATE navixa_user_webauthn_challenges SET consumed_at=? WHERE user_id=? AND purpose='authenticate' AND consumed_at=''").bind(now.toISOString(), user.id).run();
  await database.prepare("INSERT INTO navixa_user_webauthn_challenges(id,user_id,purpose,challenge,created_at,expires_at,consumed_at) VALUES (?,?,?,?,?,?, '')").bind(crypto.randomUUID(), user.id, "authenticate", options.challenge, now.toISOString(), expiresAt).run();
  return NextResponse.json({ options }, { headers: { "Cache-Control": "no-store" } });
}

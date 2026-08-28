import { NextResponse } from "next/server.js";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { createUserSession, getUserAuthSettings, hashOpaqueValue, isValidUserEmail, makeUserSessionCookie, normalizeUserEmail, trustedUserMutation, type D1Database } from "../../../../../../worker/userAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };

async function db(): Promise<Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; } catch { return (globalThis as { DB?: Database }).DB || null; } }
function decodeBase64Url(value: string) { const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4); const binary = atob(padded); return Uint8Array.from(binary, char => char.charCodeAt(0)); }

export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const database = await db();
  if (!database) return NextResponse.json({ error: "الدخول السريع غير متاح" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const settings = await getUserAuthSettings(database).catch(() => null);
  if (!settings?.userAuthEnabled || !settings.passkeysEnabled) return NextResponse.json({ error: "الدخول السريع غير مفعّل" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const body = await request.json().catch(() => ({})) as { email?: unknown; response?: unknown }, email = normalizeUserEmail(body.email);
  if (!isValidUserEmail(email) || !body.response || typeof body.response !== "object") return NextResponse.json({ error: "بيانات الدخول غير صالحة" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const users = await database.prepare("SELECT id FROM navixa_users WHERE email_hash=? AND status='active' LIMIT 1").bind(await hashOpaqueValue(email)).all<{ id: string }>();
  const user = users.results[0];
  if (!user) return NextResponse.json({ error: "تعذر التحقق من الدخول السريع" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const now = new Date().toISOString();
  const challenges = await database.prepare("SELECT id,challenge FROM navixa_user_webauthn_challenges WHERE user_id=? AND purpose='authenticate' AND consumed_at='' AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(user.id, now).all<{ id: string; challenge: string }>();
  const active = challenges.results[0], credentialId = typeof (body.response as { id?: unknown }).id === "string" ? (body.response as { id: string }).id : "";
  if (!active || !credentialId) return NextResponse.json({ error: "انتهت مهلة Passkey، ابدأ من جديد" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const passkeys = await database.prepare("SELECT id,credential_id,public_key,counter,transports_json FROM navixa_user_passkeys WHERE user_id=? AND credential_id=? AND revoked_at='' LIMIT 1").bind(user.id, credentialId).all<{ id: string; credential_id: string; public_key: string; counter: number; transports_json: string }>();
  const passkey = passkeys.results[0];
  if (!passkey) return NextResponse.json({ error: "تعذر التحقق من Passkey" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const verified = await verifyAuthenticationResponse({ response: body.response as never, expectedChallenge: active.challenge, expectedOrigin: new URL(request.url).origin, expectedRPID: new URL(request.url).hostname, requireUserVerification: true, credential: { id: passkey.credential_id, publicKey: decodeBase64Url(passkey.public_key), counter: passkey.counter, transports: JSON.parse(passkey.transports_json || "[]") as never[] } });
    if (!verified.verified) return NextResponse.json({ error: "تعذر التحقق من Passkey" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    await database.prepare("UPDATE navixa_user_webauthn_challenges SET consumed_at=? WHERE id=? AND consumed_at=''").bind(now, active.id).run();
    await database.prepare("UPDATE navixa_user_passkeys SET counter=?,last_used_at=? WHERE id=?").bind(verified.authenticationInfo.newCounter, now, passkey.id).run();
    await database.prepare("UPDATE navixa_users SET last_login_at=?,updated_at=? WHERE id=?").bind(now, now, user.id).run();
    const session = await createUserSession(database, user.id, request);
    return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": makeUserSessionCookie(session.token), "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "تعذر التحقق من Passkey. استخدم رمز البريد أو حاول من جهازك المعتاد." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
}

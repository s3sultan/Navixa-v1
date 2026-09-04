import { NextResponse } from "next/server.js";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { consumeAuthRateLimit } from "../../../../../../worker/authRateLimit.ts";
import { getUserAuthSettings, resolveUserSession, trustedUserMutation, type D1Database } from "../../../../../../worker/userAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };

async function db(): Promise<Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; } catch { return (globalThis as { DB?: Database }).DB || null; } }
function base64Url(bytes: Uint8Array) { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }

export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const database = await db();
  if (!database) return NextResponse.json({ error: "Passkeys غير متاحة الآن" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const settings = await getUserAuthSettings(database).catch(() => null), session = await resolveUserSession(request, database);
  if (!settings?.userAuthEnabled || !settings.passkeysEnabled) return NextResponse.json({ error: "Passkeys غير مفعلة" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!session) return NextResponse.json({ error: "سجّل الدخول أولًا" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const now = new Date().toISOString();
  const challenges = await database.prepare("SELECT id,challenge FROM navixa_user_webauthn_challenges WHERE user_id=? AND purpose='register' AND consumed_at='' AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(session.userId, now).all<{ id: string; challenge: string }>();
  const active = challenges.results[0];
  if (!active) return NextResponse.json({ error: "انتهت مهلة Passkey، ابدأ من جديد" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const response = await request.json().catch(() => null);
  if (!response || typeof response !== "object") return NextResponse.json({ error: "استجابة Passkey غير صالحة" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const origin = new URL(request.url).origin, rpID = new URL(request.url).hostname;
  try {
    const verified = await verifyRegistrationResponse({ response: response as never, expectedChallenge: active.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true, supportedAlgorithmIDs: [-7, -257] });
    if (!verified.verified) return NextResponse.json({ error: "تعذر التحقق من Passkey" }, { status: 400, headers: { "Cache-Control": "no-store" } });

    const consumeGate = await consumeAuthRateLimit(database, "passkey-register-challenge", active.id, active.challenge, 1, 5 * 60_000);
    if (!consumeGate.allowed) return NextResponse.json({ error: "انتهت مهلة Passkey، ابدأ من جديد" }, { status: 400, headers: { "Cache-Control": "no-store" } });

    const credential = verified.registrationInfo.credential;
    await database.prepare("INSERT INTO navixa_user_passkeys(id,user_id,credential_id,public_key,counter,transports_json,device_type,backed_up,created_at,last_used_at,revoked_at) VALUES (?,?,?,?,?,?,?,?,?, '', '')").bind(crypto.randomUUID(), session.userId, credential.id, base64Url(credential.publicKey), credential.counter, JSON.stringify(credential.transports || []), verified.registrationInfo.credentialDeviceType, verified.registrationInfo.credentialBackedUp ? 1 : 0, now).run();
    await database.prepare("UPDATE navixa_user_webauthn_challenges SET consumed_at=? WHERE id=? AND consumed_at=''").bind(now, active.id).run();
    return NextResponse.json({ ok: true, message: "تم تفعيل الدخول السريع لهذا الجهاز" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "تعذر التحقق من Passkey. تحقق من دعم جهازك ثم حاول مجددًا." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}

import { NextResponse } from "next/server.js";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getUserAuthSettings, resolveUserSession, trustedUserMutation, type D1Database } from "../../../../../../worker/userAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };

async function db(): Promise<Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; } catch { return (globalThis as { DB?: Database }).DB || null; } }
function bytes(value: string) { return new TextEncoder().encode(value); }

export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const database = await db();
  if (!database) return NextResponse.json({ error: "Passkeys غير متاحة الآن" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const settings = await getUserAuthSettings(database).catch(() => null), session = await resolveUserSession(request, database);
  if (!settings?.userAuthEnabled || !settings.passkeysEnabled) return NextResponse.json({ error: "Passkeys غير مفعلة" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!session) return NextResponse.json({ error: "سجّل الدخول أولًا" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const [userRows, passkeys] = await Promise.all([
    database.prepare("SELECT webauthn_user_id FROM navixa_users WHERE id=? LIMIT 1").bind(session.userId).all<{ webauthn_user_id: string }>(),
    database.prepare("SELECT credential_id,transports_json FROM navixa_user_passkeys WHERE user_id=? AND revoked_at=''").bind(session.userId).all<{ credential_id: string; transports_json: string }>(),
  ]);
  const webauthnUserId = userRows.results[0]?.webauthn_user_id;
  if (!webauthnUserId) return NextResponse.json({ error: "الحساب غير مكتمل" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  const host = new URL(request.url).hostname;
  const options = await generateRegistrationOptions({
    rpName: "NAVIXA",
    rpID: host,
    userName: session.email,
    userID: bytes(webauthnUserId),
    attestationType: "none",
    timeout: 60_000,
    excludeCredentials: passkeys.results.map(item => ({ id: item.credential_id, transports: JSON.parse(item.transports_json || "[]") as never[] })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
    supportedAlgorithmIDs: [-7, -257],
    preferredAuthenticatorType: "localDevice",
  });
  const now = new Date(), expiresAt = new Date(now.getTime() + 5 * 60_000).toISOString();
  await database.prepare("UPDATE navixa_user_webauthn_challenges SET consumed_at=? WHERE user_id=? AND purpose='register' AND consumed_at=''").bind(now.toISOString(), session.userId).run();
  await database.prepare("INSERT INTO navixa_user_webauthn_challenges(id,user_id,purpose,challenge,created_at,expires_at,consumed_at) VALUES (?,?,?,?,?,?, '')").bind(crypto.randomUUID(), session.userId, "register", options.challenge, now.toISOString(), expiresAt).run();
  return NextResponse.json({ options }, { headers: { "Cache-Control": "no-store" } });
}

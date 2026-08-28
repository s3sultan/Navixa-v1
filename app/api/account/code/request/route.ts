import { NextResponse } from "next/server.js";
import { clientIp, consumeAuthRateLimit } from "../../../../../worker/authRateLimit.ts";
import { getUserAuthSettings, hashOpaqueValue, isValidUserEmail, normalizeUserEmail, trustedUserMutation, type D1Database } from "../../../../../worker/userAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
type Env = Record<string, string | undefined>;
const generic = { ok: true, message: "إذا كان البريد صالحًا لاستقبال الرسائل، سيصلك رمز NAVIXA خلال دقائق. يدعم NAVIXA Gmail وiCloud وOutlook وYahoo وبريد العمل وغيرها." };

async function db(): Promise<Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; } catch { return (globalThis as { DB?: Database }).DB || null; } }
async function env(): Promise<Env> {
  let bindings: Env = {};
  try { bindings = (await import("cloudflare:workers") as { env?: Env }).env || {}; }
  catch { /* nodejs_compat and local tests use fallbacks below. */ }
  const processEnv = typeof process === "undefined" ? {} : process.env as Env;
  const globals = globalThis as Env;
  return { ...globals, ...processEnv, ...bindings };
}
function code() { return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0"); }

async function sendCode(apiKey: string, from: string, to: string, loginCode: string) {
  const request = () => fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject: "رمز دخول NAVIXA", text: `رمز دخولك إلى NAVIXA هو: ${loginCode}\n\nصالح لمدة 10 دقائق ويُستخدم مرة واحدة فقط. لا تشاركه مع أي شخص.` }) });
  const first = await request();
  if (first.ok) return true;
  if (first.status !== 429 && first.status < 500) return false;
  await new Promise(resolve => setTimeout(resolve, 300));
  return (await request()).ok;
}

export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const database = await db();
  if (!database) return NextResponse.json({ error: "خدمة الدخول غير متاحة مؤقتًا" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const settings = await getUserAuthSettings(database).catch(() => null);
  const secrets = await env();
  const authFrom = secrets.NAVIXA_AUTH_FROM || secrets.RESEND_FROM_EMAIL;
  const providerReady = Boolean(secrets.RESEND_API_KEY && authFrom && secrets.NAVIXA_AUTH_CODE_PEPPER);
  if (!settings?.userAuthEnabled || !providerReady) return NextResponse.json({ error: "إرسال رمز البريد غير متاح مؤقتًا. جرّب Google أو أعد المحاولة لاحقًا.", code: "EMAIL_OTP_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });

  // email_otp_enabled historically followed user_auth_enabled and has no independent public toggle.
  // Heal older/stale rows automatically once the provider prerequisites are present.
  if (!settings.emailOtpEnabled) {
    const now = new Date().toISOString();
    await database.prepare("INSERT INTO navixa_user_auth_settings(setting_key,setting_value,updated_at) VALUES ('email_otp_enabled','true',?) ON CONFLICT(setting_key) DO UPDATE SET setting_value='true',updated_at=excluded.updated_at").bind(now).run().catch(() => {});
  }

  const body = await request.json().catch(() => ({})) as { email?: unknown };
  const email = normalizeUserEmail(body.email);
  const ipLimit = await consumeAuthRateLimit(database, "otp-request-ip", clientIp(request), secrets.NAVIXA_AUTH_CODE_PEPPER!, 5, 10 * 60_000);
  const emailLimit = email ? await consumeAuthRateLimit(database, "otp-request-email", email, secrets.NAVIXA_AUTH_CODE_PEPPER!, 3, 10 * 60_000) : { allowed: true, retryAfterSeconds: 600 };
  if (!ipLimit.allowed || !emailLimit.allowed) {
    const retryAfter = Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds);
    return NextResponse.json({ error: "عدد محاولات كبير، حاول بعد 10 دقائق" }, { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } });
  }
  if (!isValidUserEmail(email)) return NextResponse.json(generic, { headers: { "Cache-Control": "no-store" } });
  const now = new Date(), emailHash = await hashOpaqueValue(email), loginCode = code();
  const codeHash = await hashOpaqueValue(`${email}:${loginCode}:${secrets.NAVIXA_AUTH_CODE_PEPPER}`);
  await database.prepare("UPDATE navixa_user_login_codes SET consumed_at=? WHERE email_hash=? AND purpose='login' AND consumed_at='' ").bind(now.toISOString(), emailHash).run();
  await database.prepare("INSERT INTO navixa_user_login_codes(id,email_hash,code_hash,purpose,created_at,expires_at,consumed_at,attempts) VALUES (?,?,?,?,?,?, '',0)").bind(crypto.randomUUID(), emailHash, codeHash, "login", now.toISOString(), new Date(now.getTime() + 10 * 60_000).toISOString()).run();
  const delivered = await sendCode(secrets.RESEND_API_KEY!, authFrom!, email, loginCode).catch(() => false);
  if (!delivered) {
    await database.prepare("UPDATE navixa_user_login_codes SET consumed_at=? WHERE email_hash=? AND purpose='login' AND consumed_at='' ").bind(new Date().toISOString(), emailHash).run();
    return NextResponse.json({ error: "تعذر إرسال الرمز إلى مزود البريد الآن. تحقق من العنوان أو حاول مرة أخرى بعد قليل.", code: "EMAIL_DELIVERY_FAILED" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(generic, { headers: { "Cache-Control": "no-store" } });
}

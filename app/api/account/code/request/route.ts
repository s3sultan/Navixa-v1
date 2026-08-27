import { NextResponse } from "next/server.js";
import { getUserAuthSettings, hashOpaqueValue, isValidUserEmail, normalizeUserEmail, trustedUserMutation, type D1Database } from "../../../../../worker/userAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
type Env = Record<string, string | undefined>;
const requests = new Map<string, { count: number; resetAt: number }>();
const generic = { ok: true, message: "إذا كان هذا البريد صالحًا لاستقبال الدخول، سيصلك رمز NAVIXA خلال دقائق." };

async function db(): Promise<Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; } catch { return (globalThis as { DB?: Database }).DB || null; } }
async function env(): Promise<Env> {
  let bindings: Env = {};
  try { bindings = (await import("cloudflare:workers") as { env?: Env }).env || {}; }
  catch { /* nodejs_compat and local tests use fallbacks below. */ }
  const processEnv = typeof process === "undefined" ? {} : process.env as Env;
  const globals = globalThis as Env;
  return { ...globals, ...processEnv, ...bindings };
}
function consume(key: string, limit: number, windowMs: number) { const now = Date.now(), existing = requests.get(key); const bucket = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + windowMs } : existing; bucket.count += 1; requests.set(key, bucket); return bucket.count <= limit; }
function code() { return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0"); }

async function sendCode(apiKey: string, from: string, to: string, loginCode: string) {
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject: "رمز دخول NAVIXA", text: `رمز دخولك إلى NAVIXA هو: ${loginCode}\n\nصالح لمدة 10 دقائق ويُستخدم مرة واحدة فقط. لا تشاركه مع أي شخص.` }) });
  return response.ok;
}

export async function POST(request: Request) {
  if (!trustedUserMutation(request)) return NextResponse.json({ error: "طلب غير مسموح" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const database = await db();
  if (!database) return NextResponse.json(generic, { headers: { "Cache-Control": "no-store" } });
  const settings = await getUserAuthSettings(database).catch(() => null);
  const secrets = await env();
  if (!settings?.userAuthEnabled || !settings.emailOtpEnabled || !secrets.RESEND_API_KEY || !secrets.NAVIXA_AUTH_FROM || !secrets.NAVIXA_AUTH_CODE_PEPPER) return NextResponse.json({ error: "دخول NAVIXA غير مفتوح بعد" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const body = await request.json().catch(() => ({})) as { email?: unknown };
  const email = normalizeUserEmail(body.email);
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "anonymous";
  if (!consume(`ip:${ip}`, 5, 10 * 60_000) || (email && !consume(`email:${email}`, 3, 10 * 60_000))) return NextResponse.json({ error: "عدد محاولات كبير، حاول بعد 10 دقائق" }, { status: 429, headers: { "Retry-After": "600", "Cache-Control": "no-store" } });
  if (!isValidUserEmail(email)) return NextResponse.json(generic, { headers: { "Cache-Control": "no-store" } });
  const now = new Date(), emailHash = await hashOpaqueValue(email), loginCode = code();
  const codeHash = await hashOpaqueValue(`${email}:${loginCode}:${secrets.NAVIXA_AUTH_CODE_PEPPER}`);
  await database.prepare("UPDATE navixa_user_login_codes SET consumed_at=? WHERE email_hash=? AND purpose='login' AND consumed_at='' ").bind(now.toISOString(), emailHash).run();
  await database.prepare("INSERT INTO navixa_user_login_codes(id,email_hash,code_hash,purpose,created_at,expires_at,consumed_at,attempts) VALUES (?,?,?,?,?,?, '',0)").bind(crypto.randomUUID(), emailHash, codeHash, "login", now.toISOString(), new Date(now.getTime() + 10 * 60_000).toISOString()).run();
  const delivered = await sendCode(secrets.RESEND_API_KEY, secrets.NAVIXA_AUTH_FROM, email, loginCode).catch(() => false);
  if (!delivered) return NextResponse.json({ error: "تعذر إرسال الرمز الآن، حاول لاحقًا" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(generic, { headers: { "Cache-Control": "no-store" } });
}

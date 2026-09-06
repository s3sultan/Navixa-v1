import { NextResponse } from "next/server.js";
import { clientIp, consumeAuthRateLimit } from "../../../../../worker/authRateLimit.ts";
import { getUserAuthSettings, hashOpaqueValue, isValidUserEmail, normalizeUserEmail, trustedUserMutation, type D1Database } from "../../../../../worker/userAuth.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
type Env = Record<string, string | undefined>;
const generic = { ok: true, message: "إذا كان البريد صالحًا لاستقبال الرسائل، سيصلك رمز NAVIXA خلال دقائق. يدعم NAVIXA Gmail وiCloud وOutlook وYahoo وبريد العمل وغيرها." };
const DEFAULT_AUTH_FROM = "NAVIXA SA <login@navixasa.com>";

async function db(): Promise<Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; } catch { return (globalThis as { DB?: Database }).DB || null; } }
async function env(): Promise<Env> {
  let bindings: Env = {};
  try { bindings = (await import("cloudflare:workers") as { env?: Env }).env || {}; }
  catch { /* nodejs_compat and local tests use fallbacks below. */ }
  const processEnv = typeof process === "undefined" ? {} : process.env as Env;
  const globals = globalThis as Env;
  const merged = { ...globals, ...processEnv, ...bindings };
  if (!merged.NAVIXA_AUTH_CODE_PEPPER && merged.ADMIN_JWT_SECRET) merged.NAVIXA_AUTH_CODE_PEPPER = await hashOpaqueValue(`navixa:auth-code:${merged.ADMIN_JWT_SECRET}`);
  if (!merged.NAVIXA_AUTH_FROM && !merged.RESEND_FROM_EMAIL) merged.NAVIXA_AUTH_FROM = DEFAULT_AUTH_FROM;
  return merged;
}
function code() { return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0"); }

function otpHtml(loginCode: string) {
  const digits = loginCode.split("");
  const cells = digits.map((digit, index) => `${index === 3 ? '<td width="10" style="width:10px;font-size:1px;line-height:1px">&nbsp;</td>' : ""}<td width="46" height="56" align="center" style="width:46px;height:56px;border:1px solid #d3e0e0;border-radius:12px;background:#ffffff;color:#11383b;font-family:Arial,Tahoma,sans-serif;font-size:27px;font-weight:700;line-height:56px">${digit}</td>${index < 5 && index !== 2 ? '<td width="6" style="width:6px;font-size:1px;line-height:1px">&nbsp;</td>' : ""}`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>رمز الدخول إلى NAVIXA</title></head>
<body style="margin:0;padding:0;background:#edf2f3;-webkit-text-size-adjust:100%;text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">رمز الدخول إلى NAVIXA صالح لمدة 10 دقائق ويستخدم مرة واحدة فقط.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#edf2f3"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #dce6e7;border-radius:24px;overflow:hidden">
<tr><td dir="rtl" style="padding:30px 28px 32px;background:#082c31;color:#ffffff;font-family:Arial,Tahoma,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td dir="ltr" align="left" style="font-family:Arial,Tahoma,sans-serif;color:#ffffff"><div style="font-size:24px;font-weight:700;letter-spacing:5px;line-height:28px">NAVIXA</div><div dir="rtl" style="margin-top:5px;font-size:10px;color:#b7cbcd">يفهم يومك</div></td><td align="right" valign="top"><span style="display:inline-block;padding:7px 10px;border:1px solid #31545a;border-radius:99px;color:#bdd3d3;font-size:10px">تسجيل دخول آمن</span></td></tr></table>
<div style="margin-top:34px;color:#9dc9c6;font-size:11px;font-weight:700">تأكيد الهوية</div><h1 style="margin:7px 0 7px;font-size:28px;line-height:1.4;font-weight:700;color:#ffffff">رمزك جاهز</h1><p style="margin:0;color:#c6d8d8;font-size:13px;line-height:1.9">استخدم الرمز أدناه لإكمال تسجيل الدخول إلى حسابك في NAVIXA.</p>
</td></tr>
<tr><td dir="rtl" style="padding:26px 24px 28px;font-family:Arial,Tahoma,sans-serif;color:#102126">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8fbfa;border:1px solid #dce7e7;border-radius:20px"><tr><td align="center" style="padding:20px 10px 18px"><div style="margin-bottom:12px;color:#78868b;font-size:10px;font-weight:700">رمز التحقق لمرة واحدة</div><table role="presentation" dir="ltr" cellspacing="0" cellpadding="0" border="0" align="center"><tr>${cells}</tr></table><div style="margin-top:14px;color:#718086;font-size:10px">ينتهي الرمز خلال <strong style="color:#245e5d">10 دقائق</strong> · استخدام واحد فقط</div></td></tr></table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;background:#f1f7f5;border-radius:16px"><tr><td width="42" valign="top" style="padding:15px 0 15px 14px"><div style="width:30px;height:30px;border-radius:10px;background:#deeeea;color:#245e5d;text-align:center;font-size:16px;line-height:30px">✓</div></td><td dir="rtl" valign="top" style="padding:14px 15px 14px 8px"><div style="color:#24393e;font-size:11px;font-weight:700;line-height:1.7">NAVIXA لن يطلب منك هذا الرمز</div><div style="margin-top:3px;color:#728086;font-size:10px;line-height:1.8">إذا لم تحاول تسجيل الدخول، تجاهل هذه الرسالة ولا تشارك الرمز مع أي شخص.</div></td></tr></table>
<div style="margin-top:20px;text-align:center;color:#98a1a5;font-size:9px;line-height:1.8">مرسلة تلقائيًا من <span dir="ltr" style="color:#53676b;font-weight:700">login@navixasa.com</span></div>
</td></tr>
<tr><td align="center" style="padding:18px 20px 21px;border-top:1px solid #edf1f2;background:#fafcfc;color:#9aa3a7;font-family:Arial,Tahoma,sans-serif;font-size:9px;line-height:1.9"><span style="color:#53666a;font-size:10px;font-weight:700;letter-spacing:2px">NAVIXA</span><br>يفهم يومك · <span dir="ltr">navixasa.com</span><br>© 2026 NAVIXA</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendCode(apiKey: string, from: string, to: string, loginCode: string) {
  const request = () => fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject: `رمز تسجيل الدخول إلى NAVIXA: ${loginCode}`, text: `رمز التحقق لتسجيل الدخول إلى NAVIXA هو: ${loginCode}\n\nأدخل هذا الرمز في NAVIXA. صالح لمدة 10 دقائق ويُستخدم مرة واحدة فقط. لا تشاركه مع أي شخص.`, html: otpHtml(loginCode) }) });
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
  const pepper = secrets.NAVIXA_AUTH_CODE_PEPPER;
  const providerReady = Boolean(secrets.RESEND_API_KEY && authFrom && pepper);
  if (!settings?.userAuthEnabled || !settings.emailOtpEnabled || !providerReady) return NextResponse.json({ error: "إرسال رمز البريد غير متاح مؤقتًا. جرّب Google أو أعد المحاولة لاحقًا.", code: "EMAIL_OTP_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });

  const body = await request.json().catch(() => ({})) as { email?: unknown };
  const email = normalizeUserEmail(body.email);
  const ipLimit = await consumeAuthRateLimit(database, "otp-request-ip", clientIp(request), pepper!, 5, 10 * 60_000);
  const emailLimit = email ? await consumeAuthRateLimit(database, "otp-request-email", email, pepper!, 3, 10 * 60_000) : { allowed: true, retryAfterSeconds: 600 };
  if (!ipLimit.allowed || !emailLimit.allowed) {
    const retryAfter = Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds);
    return NextResponse.json({ error: "عدد محاولات كبير، حاول بعد 10 دقائق" }, { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } });
  }
  if (!isValidUserEmail(email)) return NextResponse.json(generic, { headers: { "Cache-Control": "no-store" } });
  const now = new Date(), emailHash = await hashOpaqueValue(email), loginCode = code();
  const codeHash = await hashOpaqueValue(`${email}:${loginCode}:${pepper}`);
  await database.prepare("UPDATE navixa_user_login_codes SET consumed_at=? WHERE email_hash=? AND purpose='login' AND consumed_at='' ").bind(now.toISOString(), emailHash).run();
  await database.prepare("INSERT INTO navixa_user_login_codes(id,email_hash,code_hash,purpose,created_at,expires_at,consumed_at,attempts) VALUES (?,?,?,?,?,?, '',0)").bind(crypto.randomUUID(), emailHash, codeHash, "login", now.toISOString(), new Date(now.getTime() + 10 * 60_000).toISOString()).run();
  const delivered = await sendCode(secrets.RESEND_API_KEY!, authFrom!, email, loginCode).catch(() => false);
  if (!delivered) {
    await database.prepare("UPDATE navixa_user_login_codes SET consumed_at=? WHERE email_hash=? AND purpose='login' AND consumed_at='' ").bind(new Date().toISOString(), emailHash).run();
    return NextResponse.json({ error: "تعذر إرسال الرمز إلى مزود البريد الآن. تحقق من العنوان أو حاول مرة أخرى بعد قليل.", code: "EMAIL_DELIVERY_FAILED" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(generic, { headers: { "Cache-Control": "no-store" } });
}
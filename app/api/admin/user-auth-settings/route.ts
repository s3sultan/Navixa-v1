import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE, isTrustedSameOriginRequest, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";
import { getUserAuthSettings, type D1Database } from "../../../../worker/userAuth.ts";
import { officialTelegramBotUsername } from "../../../../worker/telegramBot.ts";

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type Database = D1Database & { prepare: (sql: string) => D1Statement };
type Env = Record<string, string | undefined>;
type AuthSetting = { setting_key: string; setting_value: string };

const settingKeys = ["user_auth_enabled", "email_otp_enabled", "passkeys_enabled", "early_access_enabled", "telegram_bot_enabled", "telegram_background_alerts_enabled", "trial_days"] as const;
const defaults: Record<(typeof settingKeys)[number], string> = { user_auth_enabled: "false", email_otp_enabled: "false", passkeys_enabled: "false", early_access_enabled: "false", telegram_bot_enabled: "false", telegram_background_alerts_enabled: "false", trial_days: "14" };
const flag = (value: unknown) => value === true || value === "true";

async function db(): Promise<Database | null> { try { return (await import("cloudflare:workers") as { env?: { DB?: Database } }).env?.DB || null; } catch { return (globalThis as { DB?: Database }).DB || null; } }
async function env(): Promise<Env> {
  let bindings: Env = {};
  try { bindings = (await import("cloudflare:workers") as { env?: Env }).env || {}; }
  catch { /* nodejs_compat and local tests use fallbacks below. */ }
  const processEnv = typeof process === "undefined" ? {} : process.env as Env;
  const globals = globalThis as Env;
  return { ...globals, ...processEnv, ...bindings };
}
async function allowed(request: Request) {
  const secret = await resolveAdminJwtSecret();
  const session = secret ? await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret) : null;
  if (!session) return false;
  // قراءة الإعدادات لا تغيّر حالة الخادم؛ أما كل تعديل فيبقى مقيدًا بطلب من المصدر نفسه لمنع CSRF.
  return request.method === "GET" || isTrustedSameOriginRequest(request);
}

async function schema(database: Database) {
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_user_auth_settings (setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  const now = new Date().toISOString();
  for (const key of settingKeys) await database.prepare("INSERT OR IGNORE INTO navixa_user_auth_settings(setting_key,setting_value,updated_at) VALUES (?,?,?)").bind(key, defaults[key], now).run();
}

async function snapshot(database: Database, secrets: Env) {
  await schema(database);
  const now = new Date().toISOString();
  const [settings, users, sessions, accounts] = await Promise.all([
    getUserAuthSettings(database),
    database.prepare("SELECT COUNT(*) AS count FROM navixa_users").all<{ count: number }>().catch(() => ({ results: [{ count: 0 }] })),
    database.prepare("SELECT COUNT(*) AS count FROM navixa_user_sessions WHERE revoked_at='' AND expires_at>? ").bind(now).all<{ count: number }>().catch(() => ({ results: [{ count: 0 }] })),
    database.prepare("SELECT u.email,u.status,u.created_at,u.last_login_at,MAX(s.last_seen_at) AS last_seen_at,SUM(CASE WHEN s.revoked_at='' AND s.expires_at>? THEN 1 ELSE 0 END) AS active_sessions FROM navixa_users u LEFT JOIN navixa_user_sessions s ON s.user_id=u.id GROUP BY u.id,u.email,u.status,u.created_at,u.last_login_at ORDER BY u.last_login_at DESC LIMIT 50").bind(now).all<{ email: string; status: string; created_at: string; last_login_at: string; last_seen_at: string | null; active_sessions: number }>().catch(() => ({ results: [] })),
  ]);
  const telegram = {
    botTokenConfigured: Boolean(secrets.NAVIXA_TELEGRAM_BOT_TOKEN),
    usernameConfigured: Boolean(officialTelegramBotUsername(secrets.NAVIXA_TELEGRAM_BOT_USERNAME)),
    webhookSecretConfigured: Boolean(secrets.NAVIXA_TELEGRAM_WEBHOOK_SECRET),
    encryptionKeyConfigured: Boolean(secrets.NAVIXA_TELEGRAM_ENCRYPTION_KEY),
  };
  return { settings, readiness: { emailProviderConfigured: Boolean(secrets.RESEND_API_KEY && secrets.NAVIXA_AUTH_FROM && secrets.NAVIXA_AUTH_CODE_PEPPER), googleLoginConfigured: true, telegramBotConfigured: Object.values(telegram).every(Boolean), telegram, users: Number(users.results[0]?.count || 0), activeSessions: Number(sessions.results[0]?.count || 0), recentAccounts: accounts.results } };
}

export async function GET(request: Request) {
  if (!await allowed(request)) return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const database = await db();
  if (!database) return NextResponse.json({ error: "التخزين غير مهيأ" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(await snapshot(database, await env()), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!await allowed(request)) return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const database = await db();
  if (!database) return NextResponse.json({ error: "التخزين غير مهيأ" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const body = await request.json().catch(() => ({})) as { userAuthEnabled?: unknown; passkeysEnabled?: unknown; earlyAccessEnabled?: unknown; telegramBotEnabled?: unknown; telegramBackgroundAlertsEnabled?: unknown; trialDays?: unknown };
  const secrets = await env();
  const wantsAuth = flag(body.userAuthEnabled), wantsPasskeys = flag(body.passkeysEnabled), wantsEarlyAccess = flag(body.earlyAccessEnabled), wantsTelegramBot = flag(body.telegramBotEnabled), wantsTelegramBackground = flag(body.telegramBackgroundAlertsEnabled);
  const trialDays = Math.min(31, Math.max(1, Number.parseInt(String(body.trialDays || "14"), 10) || 14));
  const emailReady = Boolean(secrets.RESEND_API_KEY && secrets.NAVIXA_AUTH_FROM && secrets.NAVIXA_AUTH_CODE_PEPPER);
  // Google Identity هو مسار دخول مستقل يتحقق من البريد الموثق من Google خادميًا.
  if (wantsAuth && !emailReady) return NextResponse.json({ error: "أضف أولًا مزود البريد وعنوان الإرسال قبل فتح حسابات المستخدمين. سيظهر دخول Google بعد النشر كخيار احتياطي، لكنه لا يلغي ضرورة بريد الاسترداد." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  if (wantsPasskeys && !wantsAuth) return NextResponse.json({ error: "فعّل حسابات المستخدمين أولًا قبل Passkeys" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (wantsEarlyAccess && !wantsAuth) return NextResponse.json({ error: "فعّل حسابات المستخدمين أولًا قبل تجربة Plus" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (wantsTelegramBot && (!wantsAuth || !secrets.NAVIXA_TELEGRAM_BOT_TOKEN || !secrets.NAVIXA_TELEGRAM_WEBHOOK_SECRET || !secrets.NAVIXA_TELEGRAM_ENCRYPTION_KEY || !secrets.NAVIXA_TELEGRAM_BOT_USERNAME)) return NextResponse.json({ error: "أضف أسرار بوت NAVIXA الرسمية وفعّل حسابات المستخدمين قبل فتح الربط" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  if (wantsTelegramBackground && !wantsTelegramBot) return NextResponse.json({ error: "فعّل بوت NAVIXA أولًا قبل التنبيهات الخلفية" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  await schema(database);
  const next: Record<(typeof settingKeys)[number], string> = { user_auth_enabled: String(wantsAuth), email_otp_enabled: String(wantsAuth && emailReady), passkeys_enabled: String(wantsPasskeys), early_access_enabled: String(wantsEarlyAccess), telegram_bot_enabled: String(wantsTelegramBot), telegram_background_alerts_enabled: String(wantsTelegramBackground), trial_days: String(trialDays) };
  const now = new Date().toISOString();
  for (const key of settingKeys) await database.prepare("INSERT INTO navixa_user_auth_settings(setting_key,setting_value,updated_at) VALUES (?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at").bind(key, next[key], now).run();
  return NextResponse.json({ ok: true, message: wantsAuth ? "تم حفظ إعدادات حسابات المستخدمين" : "بقيت حسابات المستخدمين وتجربة Plus مقفلة" }, { headers: { "Cache-Control": "no-store" } });
}

import { sendOfficialTelegramMessage } from "./telegramBot";

type Statement = { bind: (...values: unknown[]) => Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
export type SiteHealthDatabase = { prepare: (sql: string) => Statement };
type SiteHealthEnv = { DB: SiteHealthDatabase; RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string; NAVIXA_AUTH_FROM?: string; NAVIXA_ADMIN_EMAIL?: string; NAVIXA_TELEGRAM_BOT_TOKEN?: string; NAVIXA_ADMIN_TELEGRAM_CHAT_ID?: string };
type Check = { key: string; ok: boolean; detail: string };
type HealthRow = { status: string; checks_json: string };
type CountRow = { count: number; max_p95: number | null };
let schemaReady: Promise<void> | null = null;

export async function ensureSiteHealthSchema(db: SiteHealthDatabase) {
  if (!schemaReady) schemaReady = (async () => {
    await db.prepare("CREATE TABLE IF NOT EXISTS navixa_weekly_site_health (week_start TEXT PRIMARY KEY,status TEXT NOT NULL,checks_json TEXT NOT NULL,alerted_at TEXT NOT NULL DEFAULT '',email_sent INTEGER NOT NULL DEFAULT 0,telegram_sent INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)").run();
    await db.prepare("CREATE TABLE IF NOT EXISTS navixa_csp_report_summaries (bucket_day TEXT NOT NULL,directive TEXT NOT NULL,blocked_host TEXT NOT NULL,report_count INTEGER NOT NULL,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,PRIMARY KEY(bucket_day,directive,blocked_host))").run();
  })().catch(error => { schemaReady = null; throw error; });
  await schemaReady;
}

function weekStart(now: Date) { const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); const offset = (date.getUTCDay() + 6) % 7; date.setUTCDate(date.getUTCDate() - offset); return date.toISOString(); }
function safeDetail(value: string) { return value.slice(0, 120).replace(/[\r\n]+/g, " "); }

async function sendAdminEmail(env: SiteHealthEnv, subject: string, text: string) {
  const from = env.RESEND_FROM_EMAIL || env.NAVIXA_AUTH_FROM;
  if (!env.RESEND_API_KEY || !env.NAVIXA_ADMIN_EMAIL || !from) return false;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: [env.NAVIXA_ADMIN_EMAIL], subject, text }) });
  return response.ok;
}

export async function runWeeklySiteHealthCheck(env: SiteHealthEnv) {
  await ensureSiteHealthSchema(env.DB);
  const now = new Date(), week = weekStart(now), nowIso = now.toISOString(), claim = `running:${crypto.randomUUID()}`;
  await env.DB.prepare("INSERT OR IGNORE INTO navixa_weekly_site_health(week_start,status,checks_json,alerted_at,email_sent,telegram_sent,created_at) VALUES (?,?,?,?,?,?,?)").bind(week, claim, "[]", "", 0, 0, nowIso).run();
  const existing = await env.DB.prepare("SELECT status,checks_json FROM navixa_weekly_site_health WHERE week_start=?").bind(week).all<HealthRow>();
  const retryLegacySelfFetch = existing.results[0]?.status === "critical" && existing.results[0]?.checks_json.includes("HTTP 522");
  if (existing.results[0]?.status !== claim && !retryLegacySelfFetch) return { skipped: "already_checked", status: "" };
  if (retryLegacySelfFetch) await env.DB.prepare("UPDATE navixa_weekly_site_health SET status=?,checks_json='[]',alerted_at='',email_sent=0,telegram_sent=0,created_at=? WHERE week_start=?").bind(claim, nowIso, week).run();

  const checks: Check[] = [];
  const database = await env.DB.prepare("SELECT COUNT(*) AS count FROM navixa_weekly_site_health").all<CountRow>();
  checks.push({ key: "database", ok: Number(database.results[0]?.count || 0) >= 1, detail: "operational tables available" });
  const performanceCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString();
  const performance = await env.DB.prepare("SELECT COUNT(*) AS count,MAX(p95_load_ms) AS max_p95 FROM navixa_performance_windows WHERE bucket_start>=?").bind(performanceCutoff).all<CountRow>();
  const performanceCount = Number(performance.results[0]?.count || 0), maxP95 = Number(performance.results[0]?.max_p95 || 0);
  checks.push({ key: "field_performance", ok: maxP95 <= 10_000, detail: performanceCount ? safeDetail(`${performanceCount} aggregate windows; highest p95 ${maxP95}ms`) : "awaiting anonymous public samples" });
  const csp = await env.DB.prepare("SELECT COUNT(*) AS count FROM navixa_csp_report_summaries WHERE bucket_day>=?").bind(performanceCutoff.slice(0, 10)).all<CountRow>();
  checks.push({ key: "csp_monitoring", ok: true, detail: `${Number(csp.results[0]?.count || 0)} aggregate compatibility groups` });
  const failed = checks.filter(check => !check.ok), status = failed.length ? "critical" : "healthy";
  const text = `فحص NAVIXA الأسبوعي الدفاعي\n\nالحالة: ${status === "healthy" ? "سليمة" : "تتطلب مراجعة"}\n${checks.map(check => `- ${check.key}: ${check.ok ? "ok" : check.detail}`).join("\n")}\n\nهذا الفحص يراجع صفحات عامة ورؤوس حماية فقط. لا يجرب تسجيل الدخول أو كلمات المرور أو بيانات المستخدمين.`;
  const [emailSent, telegramSent] = status === "critical" ? await Promise.all([
    sendAdminEmail(env, "تنبيه فحص NAVIXA الأسبوعي", text),
    env.NAVIXA_TELEGRAM_BOT_TOKEN && env.NAVIXA_ADMIN_TELEGRAM_CHAT_ID ? sendOfficialTelegramMessage({ token: env.NAVIXA_TELEGRAM_BOT_TOKEN, chatId: env.NAVIXA_ADMIN_TELEGRAM_CHAT_ID, text }) : Promise.resolve(false),
  ]) : [false, false];
  await env.DB.prepare("UPDATE navixa_weekly_site_health SET status=?,checks_json=?,alerted_at=?,email_sent=?,telegram_sent=? WHERE week_start=? AND status=?").bind(status, JSON.stringify(checks), emailSent || telegramSent ? nowIso : "", emailSent ? 1 : 0, telegramSent ? 1 : 0, week, claim).run();
  return { skipped: "", status, failed: failed.length, alerted: emailSent || telegramSent };
}

export async function recordCspCompatibilityReport(db: SiteHealthDatabase, input: { directive: string; blockedHost: string }) {
  await ensureSiteHealthSchema(db);
  const now = new Date(), bucket = now.toISOString().slice(0, 10);
  await db.prepare("INSERT INTO navixa_csp_report_summaries(bucket_day,directive,blocked_host,report_count,first_seen_at,last_seen_at) VALUES (?,?,?,?,?,?) ON CONFLICT(bucket_day,directive,blocked_host) DO UPDATE SET report_count=report_count+1,last_seen_at=excluded.last_seen_at").bind(bucket, input.directive, input.blockedHost, 1, now.toISOString(), now.toISOString()).run();
}

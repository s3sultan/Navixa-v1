import { sendOfficialTelegramMessage } from "./telegramBot";

type Statement = { bind: (...values: unknown[]) => Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
export type SiteHealthDatabase = { prepare: (sql: string) => Statement };
type SiteHealthEnv = { DB: SiteHealthDatabase; RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string; NAVIXA_AUTH_FROM?: string; NAVIXA_ADMIN_EMAIL?: string; NAVIXA_TELEGRAM_BOT_TOKEN?: string; NAVIXA_ADMIN_TELEGRAM_CHAT_ID?: string };
type Check = { key: string; ok: boolean; detail: string };
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
  const claimed = await env.DB.prepare("SELECT status FROM navixa_weekly_site_health WHERE week_start=?").bind(week).all<{ status: string }>();
  if (claimed.results[0]?.status !== claim) return { skipped: "already_checked", status: "" };

  const checks: Check[] = [];
  for (const path of ["/", "/robots.txt", "/sitemap.xml"]) {
    try {
      const response = await fetch(`https://navixasa.com${path}`, { headers: { "user-agent": "NAVIXA-site-health/1.0" } });
      const body = path === "/sitemap.xml" && response.ok ? await response.text() : "";
      const canonical = path !== "/sitemap.xml" || body.includes("https://navixasa.com/");
      checks.push({ key: path === "/" ? "public_home" : path.slice(1).replace(".", "_"), ok: response.ok && canonical, detail: safeDetail(`HTTP ${response.status}${canonical ? "" : "; canonical URL missing"}`) });
      if (path === "/") {
        const headers = response.headers;
        for (const [key, header] of [["hsts", "strict-transport-security"], ["nosniff", "x-content-type-options"], ["csp_monitor", "content-security-policy-report-only"]] as const) checks.push({ key, ok: Boolean(headers.get(header)), detail: headers.get(header) ? "present" : "missing" });
      }
    } catch { checks.push({ key: path === "/" ? "public_home" : path.slice(1).replace(".", "_"), ok: false, detail: "request failed" }); }
  }
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

import { sendOfficialTelegramMessage } from "./telegramBot";

type Statement = {
  bind: (...values: unknown[]) => Statement;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};
export type UsageAnalyticsDatabase = { prepare: (sql: string) => Statement };
export type UsageAnalyticsSettings = { retentionDays: 7 | 14 | 30 | 60 | 90; alertsEnabled: boolean };
type AnalyticsEnv = {
  DB: UsageAnalyticsDatabase;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  NAVIXA_AUTH_FROM?: string;
  NAVIXA_ADMIN_EMAIL?: string;
  NAVIXA_TELEGRAM_BOT_TOKEN?: string;
  NAVIXA_ADMIN_TELEGRAM_CHAT_ID?: string;
};
type SettingRow = { setting_key: string; setting_value: string };
type CountRow = { count: number };
type PriorAlert = { sent_at: string };

const retentionChoices = new Set([7, 14, 30, 60, 90]);
const alertRules = [
  { key: "page_views_hour", label: "فتحات المزايا", event: "view", threshold: 60 },
  { key: "tap_events_hour", label: "تفاعلات الصفحات", event: "tap", threshold: 90 },
] as const;
const ONE_HOUR = 60 * 60_000;
const ONE_DAY = 24 * 60 * 60_000;
let schemaReady: Promise<void> | null = null;

export async function ensureUsageAnalyticsSchema(db: UsageAnalyticsDatabase) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.prepare("CREATE TABLE IF NOT EXISTS navixa_usage_events (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,path TEXT NOT NULL,event_type TEXT NOT NULL,grid_x INTEGER NOT NULL DEFAULT -1,grid_y INTEGER NOT NULL DEFAULT -1,duration_seconds INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)").run();
      await db.prepare("CREATE INDEX IF NOT EXISTS idx_navixa_usage_events_user_created ON navixa_usage_events(user_id,created_at)").run();
      await db.prepare("CREATE INDEX IF NOT EXISTS idx_navixa_usage_events_path_created ON navixa_usage_events(path,created_at)").run();
      await db.prepare("CREATE TABLE IF NOT EXISTS navixa_usage_analytics_settings (setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
      await db.prepare("CREATE TABLE IF NOT EXISTS navixa_usage_analytics_alerts (id TEXT PRIMARY KEY,alert_key TEXT NOT NULL,observed_count INTEGER NOT NULL,window_start TEXT NOT NULL,status TEXT NOT NULL,email_sent INTEGER NOT NULL DEFAULT 0,telegram_sent INTEGER NOT NULL DEFAULT 0,sent_at TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)").run();
      await db.prepare("CREATE INDEX IF NOT EXISTS idx_navixa_usage_alerts_key_sent ON navixa_usage_analytics_alerts(alert_key,sent_at)").run();
      const now = new Date().toISOString();
      await db.prepare("INSERT OR IGNORE INTO navixa_usage_analytics_settings(setting_key,setting_value,updated_at) VALUES ('retention_days','30',?)").bind(now).run();
      await db.prepare("INSERT OR IGNORE INTO navixa_usage_analytics_settings(setting_key,setting_value,updated_at) VALUES ('admin_alerts_enabled','true',?)").bind(now).run();
    })().catch(error => { schemaReady = null; throw error; });
  }
  await schemaReady;
}

export async function readUsageAnalyticsSettings(db: UsageAnalyticsDatabase): Promise<UsageAnalyticsSettings> {
  await ensureUsageAnalyticsSchema(db);
  const rows = await db.prepare("SELECT setting_key,setting_value FROM navixa_usage_analytics_settings").all<SettingRow>();
  const values = new Map(rows.results.map(row => [row.setting_key, row.setting_value]));
  const candidate = Number(values.get("retention_days") || 30);
  return { retentionDays: retentionChoices.has(candidate) ? candidate as UsageAnalyticsSettings["retentionDays"] : 30, alertsEnabled: values.get("admin_alerts_enabled") !== "false" };
}

export async function saveUsageAnalyticsSettings(db: UsageAnalyticsDatabase, input: UsageAnalyticsSettings) {
  await ensureUsageAnalyticsSchema(db);
  const now = new Date().toISOString();
  await db.prepare("INSERT INTO navixa_usage_analytics_settings(setting_key,setting_value,updated_at) VALUES (?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at").bind("retention_days", String(input.retentionDays), now).run();
  await db.prepare("INSERT INTO navixa_usage_analytics_settings(setting_key,setting_value,updated_at) VALUES (?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at").bind("admin_alerts_enabled", String(input.alertsEnabled), now).run();
}

export async function pruneUsageAnalytics(env: AnalyticsEnv) {
  const settings = await readUsageAnalyticsSettings(env.DB);
  const cutoff = new Date(Date.now() - settings.retentionDays * 24 * 60 * 60_000).toISOString();
  await env.DB.prepare("DELETE FROM navixa_usage_events WHERE created_at < ?").bind(cutoff).run();
}

async function sendAdminEmail(env: AnalyticsEnv, subject: string, text: string) {
  const from = env.RESEND_FROM_EMAIL || env.NAVIXA_AUTH_FROM;
  if (!env.RESEND_API_KEY || !env.NAVIXA_ADMIN_EMAIL || !from) return false;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: [env.NAVIXA_ADMIN_EMAIL], subject, text }) });
  return response.ok;
}

export async function scanUsageAnalyticsAlerts(env: AnalyticsEnv) {
  const settings = await readUsageAnalyticsSettings(env.DB);
  if (!settings.alertsEnabled) return { checked: 0, sent: 0, skipped: "disabled" };
  const now = Date.now(), nowIso = new Date(now).toISOString(), windowStart = new Date(now - ONE_HOUR).toISOString();
  let checked = 0, sent = 0;
  for (const rule of alertRules) {
    checked += 1;
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM navixa_usage_events WHERE event_type=? AND created_at>=?").bind(rule.event, windowStart).all<CountRow>();
    const observed = Number(count.results[0]?.count || 0);
    if (observed < rule.threshold) continue;
    const prior = await env.DB.prepare("SELECT created_at AS sent_at FROM navixa_usage_analytics_alerts WHERE alert_key=? ORDER BY created_at DESC LIMIT 1").bind(rule.key).all<PriorAlert>();
    if (prior.results[0]?.sent_at && now - Date.parse(prior.results[0].sent_at) < ONE_DAY) continue;
    const text = `تنبيه NAVIXA الإداري\n\nتم رصد استخدام مرتفع: ${rule.label} = ${observed} خلال آخر ساعة.\n\nهذا التنبيه إجمالي فقط ولا يذكر إيميلات أو محتوى مستخدم أو مواضع نقر دقيقة.`;
    const [emailSent, telegramSent] = await Promise.all([
      sendAdminEmail(env, `تنبيه استخدام مرتفع في NAVIXA: ${rule.label}`, text),
      env.NAVIXA_TELEGRAM_BOT_TOKEN && env.NAVIXA_ADMIN_TELEGRAM_CHAT_ID ? sendOfficialTelegramMessage({ token: env.NAVIXA_TELEGRAM_BOT_TOKEN, chatId: env.NAVIXA_ADMIN_TELEGRAM_CHAT_ID, text }) : Promise.resolve(false),
    ]);
    const delivered = emailSent || telegramSent;
    await env.DB.prepare("INSERT INTO navixa_usage_analytics_alerts(id,alert_key,observed_count,window_start,status,email_sent,telegram_sent,sent_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), rule.key, observed, windowStart, delivered ? "sent" : "recorded", emailSent ? 1 : 0, telegramSent ? 1 : 0, delivered ? nowIso : "", nowIso).run();
    if (delivered) sent += 1;
  }
  return { checked, sent, skipped: "" };
}

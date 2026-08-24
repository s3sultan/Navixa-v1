const DOMAIN = "navixasa.com";
const ALERT_WINDOW_DAYS = 40;
const ALERT_COOLDOWN_DAYS = 7;

type D1Statement = { bind: (...values: unknown[]) => D1Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type D1Database = { prepare: (sql: string) => D1Statement };
type DomainEnv = {
  DB?: D1Database;
  NAVIXA_TELEGRAM_BOT_TOKEN?: string;
  NAVIXA_ADMIN_TELEGRAM_CHAT_ID?: string;
  RESEND_API_KEY?: string;
  NAVIXA_ADMIN_EMAIL?: string;
  RESEND_FROM_EMAIL?: string;
};

type RdapEvent = { eventAction?: string; eventDate?: string };
type RdapDomain = { events?: RdapEvent[] };
type AlertState = { last_alert_at: string; last_days_remaining: number };
type CachedExpiryState = { last_checked_at: string; expires_at: string };
const RDAP_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function ensureSchema(db: D1Database) {
  await db.prepare("CREATE TABLE IF NOT EXISTS navixa_domain_expiry_alert_state (domain TEXT PRIMARY KEY, last_checked_at TEXT NOT NULL DEFAULT '', expires_at TEXT NOT NULL DEFAULT '', last_days_remaining INTEGER NOT NULL DEFAULT 0, last_alert_at TEXT NOT NULL DEFAULT '')").run();
}

async function cachedDomainExpiry(database: D1Database, now: Date) {
  try {
    const rows = await database.prepare("SELECT last_checked_at,expires_at FROM navixa_domain_expiry_alert_state WHERE domain = ?").bind(DOMAIN).all<CachedExpiryState>();
    const cached = rows.results[0];
    const checkedAt = cached?.last_checked_at ? Date.parse(cached.last_checked_at) : Number.NaN;
    const expiresAt = cached?.expires_at ? new Date(cached.expires_at) : null;
    if (!cached || Number.isNaN(checkedAt) || !expiresAt || Number.isNaN(expiresAt.getTime()) || now.getTime() - checkedAt > RDAP_CACHE_TTL_MS) return null;
    return { domain: DOMAIN, expiresAt: expiresAt.toISOString(), daysRemaining: Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000) };
  } catch {
    return null;
  }
}

export async function fetchDomainExpiry(now = new Date(), database?: D1Database) {
  if (database) {
    const cached = await cachedDomainExpiry(database, now);
    if (cached) return cached;
  }
  const response = await fetch(`https://rdap.verisign.com/com/v1/domain/${DOMAIN}`, { headers: { accept: "application/rdap+json, application/json" }, cf: { cacheTtl: 21_600, cacheEverything: true } as any });
  if (!response.ok) throw new Error(`RDAP returned ${response.status}`);
  const data = await response.json() as RdapDomain;
  const event = data.events?.find(item => item.eventAction?.toLowerCase() === "expiration");
  if (!event?.eventDate) throw new Error("RDAP expiration event missing");
  const expiresAt = new Date(event.eventDate);
  if (Number.isNaN(expiresAt.getTime())) throw new Error("RDAP expiration date invalid");
  const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000);
  return { domain: DOMAIN, expiresAt: expiresAt.toISOString(), daysRemaining };
}

function configured(env: DomainEnv) {
  return Boolean((env.NAVIXA_TELEGRAM_BOT_TOKEN && env.NAVIXA_ADMIN_TELEGRAM_CHAT_ID) || (env.RESEND_API_KEY && env.NAVIXA_ADMIN_EMAIL && env.RESEND_FROM_EMAIL));
}

async function sendTelegram(env: DomainEnv, text: string) {
  if (!env.NAVIXA_TELEGRAM_BOT_TOKEN || !env.NAVIXA_ADMIN_TELEGRAM_CHAT_ID) return false;
  const response = await fetch(`https://api.telegram.org/bot${env.NAVIXA_TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: env.NAVIXA_ADMIN_TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }) });
  return response.ok;
}

async function sendEmail(env: DomainEnv, subject: string, text: string) {
  if (!env.RESEND_API_KEY || !env.NAVIXA_ADMIN_EMAIL || !env.RESEND_FROM_EMAIL) return false;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [env.NAVIXA_ADMIN_EMAIL], subject, text }) });
  return response.ok;
}

function message(daysRemaining: number, expiresAt: string) {
  return `تنبيه NAVIXA الإداري\n\nتبقى ${Math.max(daysRemaining, 0)} يومًا على انتهاء الدومين ${DOMAIN}.\nتاريخ الانتهاء: ${expiresAt.slice(0, 10)}\n\nهذا التنبيه خاص بالمدير فقط.`;
}

export async function checkDomainExpiry(env: DomainEnv, now = new Date()) {
  const db = env.DB;
  if (db) await ensureSchema(db);
  const status = await fetchDomainExpiry(now, db);
  if (!db) return { ...status, alerted: false, reason: "database_unavailable" };
  const previous = await db.prepare("SELECT last_alert_at,last_days_remaining FROM navixa_domain_expiry_alert_state WHERE domain = ?").bind(DOMAIN).all<AlertState>();
  const prior = previous.results[0];
  const daysSinceAlert = prior?.last_alert_at ? (now.getTime() - Date.parse(prior.last_alert_at)) / 86_400_000 : Infinity;
  const shouldAlert = status.daysRemaining <= ALERT_WINDOW_DAYS && (!prior || daysSinceAlert >= ALERT_COOLDOWN_DAYS || prior.last_days_remaining > ALERT_WINDOW_DAYS);
  let alerted = false;
  if (shouldAlert && configured(env)) {
    const text = message(status.daysRemaining, status.expiresAt);
    const [telegram, email] = await Promise.all([sendTelegram(env, text), sendEmail(env, `تنبيه: قرب انتهاء ${DOMAIN}`, text)]);
    alerted = telegram || email;
    if (alerted) await db.prepare("INSERT INTO navixa_domain_expiry_alert_state (domain,last_checked_at,expires_at,last_days_remaining,last_alert_at) VALUES (?,?,?,?,?) ON CONFLICT(domain) DO UPDATE SET last_checked_at=excluded.last_checked_at,expires_at=excluded.expires_at,last_days_remaining=excluded.last_days_remaining,last_alert_at=excluded.last_alert_at").bind(DOMAIN, now.toISOString(), status.expiresAt, status.daysRemaining, now.toISOString()).run();
  } else {
    await db.prepare("INSERT INTO navixa_domain_expiry_alert_state (domain,last_checked_at,expires_at,last_days_remaining,last_alert_at) VALUES (?,?,?,?,?) ON CONFLICT(domain) DO UPDATE SET last_checked_at=excluded.last_checked_at,expires_at=excluded.expires_at,last_days_remaining=excluded.last_days_remaining").bind(DOMAIN, now.toISOString(), status.expiresAt, status.daysRemaining, prior?.last_alert_at || "").run();
  }
  console.log(JSON.stringify({ event: "domain_expiry_check", domain: DOMAIN, expires_at: status.expiresAt, days_remaining: status.daysRemaining, should_alert: shouldAlert, alerted }));
  return { ...status, alerted, shouldAlert };
}

export async function readDomainExpiryStatus(env: DomainEnv) {
  const db = env.DB;
  if (db) await ensureSchema(db);
  const status = await fetchDomainExpiry(new Date(), db);
  let lastAlertAt = "";
  if (db) { const rows = await db.prepare("SELECT last_alert_at FROM navixa_domain_expiry_alert_state WHERE domain = ?").bind(DOMAIN).all<Pick<AlertState, "last_alert_at">>(); lastAlertAt = rows.results[0]?.last_alert_at || ""; }
  return { ...status, lastAlertAt, warning: status.daysRemaining <= ALERT_WINDOW_DAYS, externalConfigured: configured(env) };
}

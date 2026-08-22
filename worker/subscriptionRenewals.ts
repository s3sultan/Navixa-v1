import { decryptTelegramIdentifier, sendOfficialTelegramMessage } from "./telegramBot";

type Statement = { bind: (...values: unknown[]) => Statement; all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
type Database = { prepare: (sql: string) => Statement };

type RenewalEnv = {
  DB: Database;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  NAVIXA_AUTH_FROM?: string;
  NAVIXA_TELEGRAM_BOT_TOKEN?: string;
  NAVIXA_TELEGRAM_ENCRYPTION_KEY?: string;
};

type DueSubscriber = {
  id: string;
  user_id: string;
  contact: string;
  display_name: string;
  plan: "trial" | "monthly" | "quarterly";
  status: "trial" | "active";
  ends_at: string;
};

type Delivery = { id: string; status: string; attempts: number; last_attempt_at: string };
const FOUR_DAYS = 4 * 24 * 60 * 60_000;
const ONE_DAY = 24 * 60 * 60_000;
const RETRY_AFTER = 60 * 60_000;

const changed = (value: unknown) => ((value as { meta?: { changes?: number } })?.meta?.changes || 0);
const shortDate = (value: string) => new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh" }).format(new Date(value));

export async function ensureRenewalReminderSchema(database: Database) {
  await database.prepare("ALTER TABLE navixa_subscribers ADD COLUMN user_id TEXT NOT NULL DEFAULT ''").run().catch(() => {});
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_subscription_reminders (id TEXT PRIMARY KEY,subscriber_id TEXT NOT NULL,subscription_end_at TEXT NOT NULL,reminder_type TEXT NOT NULL,channel TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,last_attempt_at TEXT NOT NULL DEFAULT '',sent_at TEXT NOT NULL DEFAULT '',error_message TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(subscriber_id,subscription_end_at,reminder_type,channel))").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_navixa_subscription_reminders_due ON navixa_subscription_reminders(status,last_attempt_at)").run();
}

function reminderType(endsAt: string, now: number) {
  return Date.parse(endsAt) - now <= ONE_DAY ? "one_day" : "four_days";
}

function renewalCopy(subscriber: DueSubscriber, type: "four_days" | "one_day") {
  const name = subscriber.display_name ? ` يا ${subscriber.display_name}` : "";
  const ending = shortDate(subscriber.ends_at);
  const isTrial = subscriber.status === "trial";
  const headline = type === "one_day" ? "يتبقى يوم واحد" : "يتبقى أقل من أربعة أيام";
  const detail = isTrial
    ? "تجربتك في NAVIXA Plus ستنتهي قريبًا. يمكنك الاستمرار في التجربة حتى موعدها أو اختيار الاشتراك مباشرة عندما تكون مستعدًا."
    : "اشتراكك في NAVIXA Plus يقترب من الانتهاء. جدده قبل الموعد للحفاظ على مزاياك المتقدمة دون انقطاع.";
  return {
    subject: `${headline} على ${isTrial ? "تجربة" : "اشتراك"} NAVIXA Plus`,
    text: `أهلًا${name}\n\n${detail}\n\nموعد الانتهاء: ${ending}\n\nإدارة Plus وتجديد الاشتراك: https://navixasa.com/plus\n\nNAVIXA SA`,
    telegram: `أهلًا${name}\n\n${headline} على ${isTrial ? "تجربة" : "اشتراك"} NAVIXA Plus.\n${detail}\n\nموعد الانتهاء: ${ending}\nإدارة Plus: https://navixasa.com/plus`,
  };
}

async function createOrClaimDelivery(database: Database, subscriber: DueSubscriber, type: "four_days" | "one_day", channel: "email" | "telegram", nowIso: string) {
  await database.prepare("INSERT OR IGNORE INTO navixa_subscription_reminders (id,subscriber_id,subscription_end_at,reminder_type,channel,status,attempts,last_attempt_at,sent_at,error_message,created_at,updated_at) VALUES (?,?,?,?,?,'pending',0,'','','',?,?)").bind(crypto.randomUUID(), subscriber.id, subscriber.ends_at, type, channel, nowIso, nowIso).run();
  const rows = await database.prepare("SELECT id,status,attempts,last_attempt_at FROM navixa_subscription_reminders WHERE subscriber_id=? AND subscription_end_at=? AND reminder_type=? AND channel=? LIMIT 1").bind(subscriber.id, subscriber.ends_at, type, channel).all<Delivery>();
  const row = rows.results[0];
  if (!row || row.status === "sent" || row.attempts >= 3) return null;
  if (row.last_attempt_at && Date.now() - Date.parse(row.last_attempt_at) < RETRY_AFTER) return null;
  const claim = await database.prepare("UPDATE navixa_subscription_reminders SET status='sending',attempts=attempts+1,last_attempt_at=?,updated_at=? WHERE id=? AND status IN ('pending','failed')").bind(nowIso, nowIso, row.id).run();
  return changed(claim) ? row.id : null;
}

async function finishDelivery(database: Database, id: string, ok: boolean, error: string, nowIso: string) {
  await database.prepare("UPDATE navixa_subscription_reminders SET status=?,sent_at=?,error_message=?,updated_at=? WHERE id=?").bind(ok ? "sent" : "failed", ok ? nowIso : "", error.slice(0, 220), nowIso, id).run();
}

async function sendEmail(env: RenewalEnv, to: string, subject: string, text: string) {
  const from = env.RESEND_FROM_EMAIL || env.NAVIXA_AUTH_FROM;
  if (!env.RESEND_API_KEY || !from) return { ok: false, error: "email_not_configured" };
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, text }) });
  return { ok: response.ok, error: response.ok ? "" : `resend_${response.status}` };
}

async function telegramTarget(database: Database, subscriber: DueSubscriber, env: RenewalEnv) {
  if (!subscriber.user_id || !env.NAVIXA_TELEGRAM_BOT_TOKEN || !env.NAVIXA_TELEGRAM_ENCRYPTION_KEY) return null;
  const rows = await database.prepare("SELECT link.chat_id_ciphertext FROM navixa_user_telegram_links link INNER JOIN navixa_user_telegram_preferences pref ON pref.user_id=link.user_id AND pref.notification_type='renewal' AND pref.enabled=1 WHERE link.user_id=? AND link.revoked_at='' LIMIT 1").bind(subscriber.user_id).all<{ chat_id_ciphertext: string }>();
  const target = rows.results[0];
  if (!target) return null;
  try { return await decryptTelegramIdentifier(target.chat_id_ciphertext, env.NAVIXA_TELEGRAM_ENCRYPTION_KEY); } catch { return null; }
}

/** Deterministic Worker Cron job. It never relies on a browser being open. */
export async function deliverDueSubscriptionRenewals(env: RenewalEnv) {
  await ensureRenewalReminderSchema(env.DB);
  const now = Date.now(), nowIso = new Date(now).toISOString(), fourDays = new Date(now + FOUR_DAYS).toISOString();
  const due = await env.DB.prepare("SELECT id,user_id,contact,display_name,plan,status,CASE WHEN status='trial' THEN trial_ends_at ELSE subscription_ends_at END AS ends_at FROM navixa_subscribers WHERE status IN ('trial','active') AND (CASE WHEN status='trial' THEN trial_ends_at ELSE subscription_ends_at END)<>'' AND (CASE WHEN status='trial' THEN trial_ends_at ELSE subscription_ends_at END)>? AND (CASE WHEN status='trial' THEN trial_ends_at ELSE subscription_ends_at END)<=?").bind(nowIso, fourDays).all<DueSubscriber>();
  let emailSent = 0, telegramSent = 0, skipped = 0;
  for (const subscriber of due.results) {
    const type = reminderType(subscriber.ends_at, now), copy = renewalCopy(subscriber, type);
    const emailDelivery = await createOrClaimDelivery(env.DB, subscriber, type, "email", nowIso);
    if (emailDelivery) {
      const result = await sendEmail(env, subscriber.contact, copy.subject, copy.text);
      await finishDelivery(env.DB, emailDelivery, result.ok, result.error, nowIso);
      if (result.ok) emailSent += 1;
    } else skipped += 1;
    const chatId = await telegramTarget(env.DB, subscriber, env);
    if (chatId && env.NAVIXA_TELEGRAM_BOT_TOKEN) {
      const telegramDelivery = await createOrClaimDelivery(env.DB, subscriber, type, "telegram", nowIso);
      if (telegramDelivery) {
        const ok = await sendOfficialTelegramMessage({ chatId, token: env.NAVIXA_TELEGRAM_BOT_TOKEN, text: copy.telegram });
        await finishDelivery(env.DB, telegramDelivery, ok, ok ? "" : "telegram_delivery_failed", nowIso);
        if (ok) telegramSent += 1;
      }
    }
  }
  return { checked: due.results.length, emailSent, telegramSent, skipped };
}

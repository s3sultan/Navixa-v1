import { type EmergencyDatabase, type EmergencyState } from "./emergencyMode";
import { decryptTelegramIdentifier, sendOfficialTelegramMessage } from "./telegramBot";

type Statement = {
  bind: (...values: unknown[]) => Statement;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};

type Database = EmergencyDatabase & { prepare: (sql: string) => Statement };

export type EmergencyNotificationEnv = {
  DB: Database;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  NAVIXA_AUTH_FROM?: string;
  NAVIXA_TELEGRAM_BOT_TOKEN?: string;
  NAVIXA_TELEGRAM_ENCRYPTION_KEY?: string;
};

type ActivePlusSubscriber = {
  id: string;
  user_id: string;
  contact: string;
  display_name: string;
};

type DeliveryChannel = "email" | "telegram";
type DeliveryKind = "start" | "recovery";

const PLAN_B_URL = "https://navixa.s2shug.chatgpt.site";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DELIVERY_LEASE_MS = 5 * 60 * 1000;
let deliverySchemaReady: Promise<void> | null = null;

async function ensureDeliverySchema(db: Database) {
  if (!deliverySchemaReady) {
    deliverySchemaReady = db.prepare("CREATE TABLE IF NOT EXISTS navixa_emergency_deliveries (id TEXT PRIMARY KEY,incident_id TEXT NOT NULL,subscriber_id TEXT NOT NULL,kind TEXT NOT NULL,channel TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,last_attempt_at TEXT NOT NULL DEFAULT '',sent_at TEXT NOT NULL DEFAULT '',error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)").run().then(() => undefined).catch(error => {
      deliverySchemaReady = null;
      throw error;
    });
  }
  await deliverySchemaReady;
}

function deliveryId(incidentId: string, subscriberId: string, kind: DeliveryKind, channel: DeliveryChannel) {
  return `${incidentId}:${subscriberId}:${kind}:${channel}`;
}

async function claimDelivery(db: Database, incidentId: string, subscriberId: string, kind: DeliveryKind, channel: DeliveryChannel) {
  await ensureDeliverySchema(db);
  const id = deliveryId(incidentId, subscriberId, kind, channel);
  const now = new Date();
  const nowIso = now.toISOString();
  const staleBefore = new Date(now.getTime() - DELIVERY_LEASE_MS).toISOString();
  await db.prepare("INSERT OR IGNORE INTO navixa_emergency_deliveries(id,incident_id,subscriber_id,kind,channel,status,attempts,last_attempt_at,sent_at,error,created_at) VALUES (?,?,?,?,?,'pending',0,'','','',?)")
    .bind(id, incidentId, subscriberId, kind, channel, nowIso).run();
  await db.prepare("UPDATE navixa_emergency_deliveries SET status='sending',attempts=attempts+1,last_attempt_at=?,error='' WHERE id=? AND status<>'sent' AND (status<>'sending' OR last_attempt_at<?)")
    .bind(nowIso, id, staleBefore).run();
  const rows = await db.prepare("SELECT status,last_attempt_at FROM navixa_emergency_deliveries WHERE id=?").bind(id).all<{ status: string; last_attempt_at: string }>();
  return rows.results[0]?.status === "sending" && rows.results[0]?.last_attempt_at === nowIso ? id : null;
}

async function finishDelivery(db: Database, id: string, ok: boolean, error = "") {
  const nowIso = new Date().toISOString();
  if (ok) {
    await db.prepare("UPDATE navixa_emergency_deliveries SET status='sent',sent_at=?,error='' WHERE id=?").bind(nowIso, id).run();
    return;
  }
  await db.prepare("UPDATE navixa_emergency_deliveries SET status='failed',error=? WHERE id=?").bind(error.slice(0, 300), id).run();
}

function copy(kind: DeliveryKind, name: string) {
  const greeting = name ? `أهلًا ${name}` : "أهلًا";
  if (kind === "start") {
    return {
      subject: "NAVIXA Plus: تم تفعيل المنصة الاحتياطية",
      email: `${greeting}\n\nرصدنا تعطلًا مؤكدًا في خدمة NAVIXA الأساسية، وتم تفعيل وضع الطوارئ لمشتركي Plus.\n\nيمكنك استخدام المنصة الاحتياطية مؤقتًا من هنا:\n${PLAN_B_URL}\n\nسنبلغك عند استقرار الخدمة الأساسية وعودتها.\n\nNAVIXA SA`,
      telegram: `${greeting}\n\nتم تفعيل وضع الطوارئ لمشتركي NAVIXA Plus بعد تعطل مؤكد في الخدمة الأساسية.\n\nالمنصة الاحتياطية:\n${PLAN_B_URL}\n\nسنبلغك عند عودة الخدمة الأساسية واستقرارها.`,
    };
  }
  return {
    subject: "NAVIXA Plus: عادت الخدمة الأساسية",
    email: `${greeting}\n\nعادت خدمة NAVIXA الأساسية واستقرت. يمكنك الرجوع الآن إلى الموقع الرسمي:\nhttps://navixasa.com\n\nشكرًا لصبرك.\n\nNAVIXA SA`,
    telegram: `${greeting}\n\nعادت خدمة NAVIXA الأساسية واستقرت ✅\nيمكنك الرجوع الآن إلى:\nhttps://navixasa.com`,
  };
}

async function activePlusSubscribers(db: Database) {
  const now = new Date().toISOString();
  const rows = await db.prepare("SELECT id,user_id,contact,display_name FROM navixa_subscribers WHERE status='active' AND subscription_ends_at<>'' AND subscription_ends_at>? ORDER BY created_at ASC").bind(now).all<ActivePlusSubscriber>();
  return rows.results;
}

async function sendEmail(env: EmergencyNotificationEnv, to: string, subject: string, text: string) {
  const from = env.RESEND_FROM_EMAIL || env.NAVIXA_AUTH_FROM;
  if (!emailPattern.test(to) || !env.RESEND_API_KEY || !from) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function telegramTarget(db: Database, subscriber: ActivePlusSubscriber, env: EmergencyNotificationEnv) {
  if (!subscriber.user_id || !env.NAVIXA_TELEGRAM_BOT_TOKEN || !env.NAVIXA_TELEGRAM_ENCRYPTION_KEY) return null;
  const rows = await db.prepare("SELECT link.chat_id_ciphertext FROM navixa_user_telegram_links link INNER JOIN navixa_user_telegram_preferences pref ON pref.user_id=link.user_id AND pref.notification_type='emergency' AND pref.enabled=1 WHERE link.user_id=? AND link.revoked_at='' LIMIT 1").bind(subscriber.user_id).all<{ chat_id_ciphertext: string }>();
  const row = rows.results[0];
  if (!row) return null;
  try { return await decryptTelegramIdentifier(row.chat_id_ciphertext, env.NAVIXA_TELEGRAM_ENCRYPTION_KEY); }
  catch { return null; }
}

export async function deliverEmergencyIncidentNotifications(env: EmergencyNotificationEnv, input: { incidentId: string; state: EmergencyState }) {
  const kind: DeliveryKind | null = input.state === "outage" ? "start" : input.state === "recovery" ? "recovery" : null;
  if (!kind || !input.incidentId) return { claimed: false, checked: 0, emailSent: 0, telegramSent: 0, failed: 0 };

  const subscribers = await activePlusSubscribers(env.DB);
  let emailSent = 0;
  let telegramSent = 0;
  let failed = 0;

  for (const subscriber of subscribers) {
    const message = copy(kind, subscriber.display_name);

    const emailDelivery = await claimDelivery(env.DB, input.incidentId, subscriber.id, kind, "email");
    if (emailDelivery) {
      const ok = await sendEmail(env, subscriber.contact, message.subject, message.email);
      await finishDelivery(env.DB, emailDelivery, ok, ok ? "" : "email_delivery_failed");
      if (ok) emailSent += 1;
      else failed += 1;
    }

    const chatId = await telegramTarget(env.DB, subscriber, env);
    if (chatId && env.NAVIXA_TELEGRAM_BOT_TOKEN) {
      const telegramDelivery = await claimDelivery(env.DB, input.incidentId, subscriber.id, kind, "telegram");
      if (telegramDelivery) {
        const ok = await sendOfficialTelegramMessage({ chatId, token: env.NAVIXA_TELEGRAM_BOT_TOKEN, text: message.telegram });
        await finishDelivery(env.DB, telegramDelivery, ok, ok ? "" : "telegram_delivery_failed");
        if (ok) telegramSent += 1;
        else failed += 1;
      }
    }
  }

  return { claimed: true, checked: subscribers.length, emailSent, telegramSent, failed };
}

export const EMERGENCY_PLAN_B_URL = PLAN_B_URL;

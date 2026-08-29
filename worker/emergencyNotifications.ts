import { claimIncidentNotification, type EmergencyDatabase, type EmergencyState } from "./emergencyMode";
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

const PLAN_B_URL = "https://navixa.s2shug.chatgpt.site";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function copy(kind: "start" | "recovery", name: string) {
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
  const kind = input.state === "outage" ? "start" : input.state === "recovery" ? "recovery" : null;
  if (!kind || !input.incidentId) return { claimed: false, checked: 0, emailSent: 0, telegramSent: 0 };

  // security-hold and degraded never reach this function as a sendable kind.
  const claimed = await claimIncidentNotification(env.DB, input.incidentId, kind);
  if (!claimed) return { claimed: false, checked: 0, emailSent: 0, telegramSent: 0 };

  const subscribers = await activePlusSubscribers(env.DB);
  let emailSent = 0;
  let telegramSent = 0;
  for (const subscriber of subscribers) {
    const message = copy(kind, subscriber.display_name);
    if (await sendEmail(env, subscriber.contact, message.subject, message.email)) emailSent += 1;
    const chatId = await telegramTarget(env.DB, subscriber, env);
    if (chatId && env.NAVIXA_TELEGRAM_BOT_TOKEN) {
      const ok = await sendOfficialTelegramMessage({ chatId, token: env.NAVIXA_TELEGRAM_BOT_TOKEN, text: message.telegram });
      if (ok) telegramSent += 1;
    }
  }
  return { claimed: true, checked: subscribers.length, emailSent, telegramSent };
}

export const EMERGENCY_PLAN_B_URL = PLAN_B_URL;

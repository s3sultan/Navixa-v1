import type {
  StudySuspensionChannel,
  StudySuspensionDeliveryLedger,
  StudySuspensionProfile,
  StudySuspensionRecipient,
} from "./studySuspension.ts";
import { decryptTelegramIdentifier, telegramRuntimeEnv } from "./telegramBot.ts";

export type StudySuspensionD1Statement = {
  bind: (...values: unknown[]) => StudySuspensionD1Statement;
  run: () => Promise<unknown>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
};
export type StudySuspensionD1Database = { prepare: (sql: string) => StudySuspensionD1Statement };

type PushRow = { endpoint: string; p256dh: string; auth: string };
type TelegramRow = { chat_id_ciphertext: string };
type ProfileRow = {
  user_id: string;
  education_type: "general" | "higher";
  role: "student" | "staff" | "";
  region_id: string;
  city_id: string;
  education_admin_id: string;
  university_id: string;
  school_id: string;
};

const RIYADH_SOURCE_ID = "education-admin:riyadh";

export async function ensureStudySuspensionSchema(database: StudySuspensionD1Database) {
  await database.prepare(
    "CREATE TABLE IF NOT EXISTS navixa_study_suspension_test_recipients (user_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)",
  ).run();
  await database.prepare(
    "CREATE TABLE IF NOT EXISTS navixa_study_suspension_profiles (user_id TEXT PRIMARY KEY, education_type TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', region_id TEXT NOT NULL DEFAULT '', city_id TEXT NOT NULL DEFAULT '', education_admin_id TEXT NOT NULL DEFAULT '', university_id TEXT NOT NULL DEFAULT '', school_id TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL)",
  ).run();
  await database.prepare(
    "CREATE TABLE IF NOT EXISTS navixa_study_suspension_delivery (recipient_id TEXT NOT NULL, channel TEXT NOT NULL, dedup_key TEXT NOT NULL, claim_id TEXT NOT NULL, claimed_at TEXT NOT NULL, PRIMARY KEY(recipient_id,channel,dedup_key))",
  ).run();
  await database.prepare(
    "CREATE TABLE IF NOT EXISTS navixa_study_suspension_sources (source_id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, name TEXT NOT NULL, x_username TEXT NOT NULL DEFAULT '', x_account_id TEXT NOT NULL DEFAULT '', official_site_url TEXT NOT NULL DEFAULT '', education_type TEXT NOT NULL, scope_type TEXT NOT NULL, scope_ids_json TEXT NOT NULL DEFAULT '[]', verified INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)",
  ).run();
  await database.prepare(
    "CREATE TABLE IF NOT EXISTS navixa_study_suspension_cursors (source_id TEXT PRIMARY KEY, since_post_id TEXT NOT NULL DEFAULT '', checked_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL)",
  ).run();
  try {
    await database.prepare("ALTER TABLE navixa_push_subscriptions ADD COLUMN user_id TEXT NOT NULL DEFAULT ''").run();
  } catch {
    // Existing deployments may already have the account-binding column.
  }

  const now = new Date().toISOString();
  await database.prepare(
    "INSERT OR IGNORE INTO navixa_study_suspension_sources(source_id,entity_type,entity_id,name,x_username,x_account_id,official_site_url,education_type,scope_type,scope_ids_json,verified,enabled,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
  ).bind(
    RIYADH_SOURCE_ID,
    "education_admin",
    "riyadh-education",
    "إدارة تعليم الرياض",
    "MOE_RYH",
    "",
    "https://sites.moe.gov.sa/Riyadh/",
    "general",
    "education_admin",
    JSON.stringify(["riyadh-education"]),
    1,
    1,
    now,
  ).run();
}

export async function enableStudySuspensionTestRecipient(database: StudySuspensionD1Database, userId: string) {
  await ensureStudySuspensionSchema(database);
  const now = new Date().toISOString();
  await database.prepare(
    "INSERT INTO navixa_study_suspension_test_recipients(user_id,enabled,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET enabled=1,updated_at=excluded.updated_at",
  ).bind(userId, 1, now).run();
}

export async function isStudySuspensionTestRecipient(database: StudySuspensionD1Database, userId: string) {
  await ensureStudySuspensionSchema(database);
  const rows = await database.prepare(
    "SELECT user_id FROM navixa_study_suspension_test_recipients WHERE user_id=? AND enabled=1 LIMIT 1",
  ).bind(userId).all<{ user_id: string }>();
  return Boolean(rows.results[0]);
}

export async function upsertStudySuspensionProfile(
  database: StudySuspensionD1Database,
  userId: string,
  profile: StudySuspensionProfile,
) {
  await ensureStudySuspensionSchema(database);
  await database.prepare(
    "INSERT INTO navixa_study_suspension_profiles(user_id,education_type,role,region_id,city_id,education_admin_id,university_id,school_id,enabled,updated_at) VALUES(?,?,?,?,?,?,?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET education_type=excluded.education_type,role=excluded.role,region_id=excluded.region_id,city_id=excluded.city_id,education_admin_id=excluded.education_admin_id,university_id=excluded.university_id,school_id=excluded.school_id,enabled=1,updated_at=excluded.updated_at",
  ).bind(
    userId,
    profile.educationType,
    profile.role || "",
    profile.regionId || "",
    profile.cityId || "",
    profile.educationAdminId || "",
    profile.universityId || "",
    profile.schoolId || "",
    new Date().toISOString(),
  ).run();
}

export async function loadStudySuspensionProfile(database: StudySuspensionD1Database, userId: string) {
  await ensureStudySuspensionSchema(database);
  const rows = await database.prepare(
    "SELECT user_id,education_type,role,region_id,city_id,education_admin_id,university_id,school_id FROM navixa_study_suspension_profiles WHERE user_id=? AND enabled=1 LIMIT 1",
  ).bind(userId).all<ProfileRow>();
  const row = rows.results[0];
  if (!row) return null;
  return {
    educationType: row.education_type,
    role: row.role || undefined,
    regionId: row.region_id || undefined,
    cityId: row.city_id || undefined,
    educationAdminId: row.education_admin_id || undefined,
    universityId: row.university_id || undefined,
    schoolId: row.school_id || undefined,
  } satisfies StudySuspensionProfile;
}

async function loadPush(database: StudySuspensionD1Database, userId: string) {
  const rows = await database.prepare(
    "SELECT endpoint,p256dh,auth FROM navixa_push_subscriptions WHERE user_id=? AND enabled=1 ORDER BY updated_at DESC LIMIT 1",
  ).bind(userId).all<PushRow>();
  return rows.results[0] || null;
}

async function loadTelegramChatId(database: StudySuspensionD1Database, userId: string) {
  const rows = await database.prepare(
    "SELECT chat_id_ciphertext FROM navixa_user_telegram_links WHERE user_id=? AND revoked_at='' LIMIT 1",
  ).bind(userId).all<TelegramRow>();
  const ciphertext = rows.results[0]?.chat_id_ciphertext;
  if (!ciphertext) return null;
  const env = await telegramRuntimeEnv();
  const secret = env.NAVIXA_TELEGRAM_ENCRYPTION_KEY?.trim();
  if (!secret) return null;
  try {
    return await decryptTelegramIdentifier(ciphertext, secret);
  } catch {
    return null;
  }
}

export async function loadStudySuspensionRecipient(
  database: StudySuspensionD1Database,
  userId: string,
  profile: StudySuspensionProfile,
): Promise<StudySuspensionRecipient> {
  await ensureStudySuspensionSchema(database);
  const [pushSubscription, telegramChatId] = await Promise.all([
    loadPush(database, userId),
    loadTelegramChatId(database, userId),
  ]);
  return {
    id: userId,
    profile,
    pushSubscription: pushSubscription || undefined,
    telegramChatId: telegramChatId || undefined,
  };
}

export function createD1StudySuspensionLedger(database: StudySuspensionD1Database): StudySuspensionDeliveryLedger {
  const claims = new Map<string, string>();
  const localKey = (input: { recipientId: string; channel: StudySuspensionChannel; dedupKey: string }) =>
    `${input.recipientId}|${input.channel}|${input.dedupKey}`;

  return {
    async claim(input) {
      await ensureStudySuspensionSchema(database);
      const claimId = crypto.randomUUID();
      await database.prepare(
        "INSERT OR IGNORE INTO navixa_study_suspension_delivery(recipient_id,channel,dedup_key,claim_id,claimed_at) VALUES(?,?,?,?,?)",
      ).bind(input.recipientId, input.channel, input.dedupKey, claimId, new Date().toISOString()).run();
      const rows = await database.prepare(
        "SELECT claim_id FROM navixa_study_suspension_delivery WHERE recipient_id=? AND channel=? AND dedup_key=? LIMIT 1",
      ).bind(input.recipientId, input.channel, input.dedupKey).all<{ claim_id: string }>();
      if (rows.results[0]?.claim_id !== claimId) return false;
      claims.set(localKey(input), claimId);
      return true;
    },
    async release(input) {
      const claimId = claims.get(localKey(input));
      if (!claimId) return;
      await database.prepare(
        "DELETE FROM navixa_study_suspension_delivery WHERE recipient_id=? AND channel=? AND dedup_key=? AND claim_id=?",
      ).bind(input.recipientId, input.channel, input.dedupKey, claimId).run();
      claims.delete(localKey(input));
    },
  };
}

export const NAVIXA_RIYADH_EDUCATION_SOURCE_ID = RIYADH_SOURCE_ID;

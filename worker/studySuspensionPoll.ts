import { dispatchStudySuspensionEvent, type StudySuspensionProfile, type StudySuspensionScopeType } from "./studySuspension.ts";
import {
  createD1StudySuspensionLedger,
  ensureStudySuspensionSchema,
  loadStudySuspensionRecipient,
  type StudySuspensionD1Database,
} from "./studySuspensionStore.ts";
import {
  fetchOfficialXPosts,
  normalizeOfficialXPost,
  resolveOfficialXAccountId,
  type StudySuspensionXSource,
} from "./studySuspensionX.ts";

type PollEnv = {
  DB: StudySuspensionD1Database;
  X_API_BEARER_TOKEN?: string;
  NAVIXA_TELEGRAM_BOT_TOKEN?: string;
  NAVIXA_TELEGRAM_ENCRYPTION_KEY?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

type SourceRow = {
  source_id: string;
  entity_type: "moe" | "education_admin" | "university";
  entity_id: string;
  name: string;
  x_username: string;
  x_account_id: string;
  education_type: "general" | "higher";
  scope_type: StudySuspensionScopeType;
  scope_ids_json: string;
  verified: number;
};

function scopeIds(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
  } catch {
    return [];
  }
}

function profileForSource(source: SourceRow, ids: string[]): StudySuspensionProfile {
  const first = ids[0] || "";
  if (source.education_type === "higher") {
    return {
      educationType: "higher",
      role: "student",
      universityId: source.scope_type === "university" ? first : undefined,
      regionId: source.scope_type === "region" ? first : undefined,
      cityId: source.scope_type === "city" ? first : undefined,
    };
  }
  return {
    educationType: "general",
    role: "student",
    educationAdminId: source.scope_type === "education_admin" ? first : undefined,
    schoolId: source.scope_type === "school" ? first : undefined,
    regionId: source.scope_type === "region" ? first : source.entity_id === "riyadh-education" ? "riyadh" : undefined,
    cityId: source.scope_type === "city" ? first : undefined,
  };
}

export async function pollStudySuspensionTestRecipients(env: PollEnv) {
  await ensureStudySuspensionSchema(env.DB);
  const testRows = await env.DB.prepare(
    "SELECT user_id FROM navixa_study_suspension_test_recipients WHERE enabled=1 ORDER BY updated_at DESC LIMIT 20",
  ).all<{ user_id: string }>();
  const testRecipientIds = testRows.results.map(row => row.user_id).filter(Boolean);
  if (!testRecipientIds.length) return { configured: Boolean(env.X_API_BEARER_TOKEN), recipients: 0, sources: 0, postsChecked: 0, matched: 0, delivered: 0 };

  const bearerToken = env.X_API_BEARER_TOKEN?.trim();
  if (!bearerToken) return { configured: false, recipients: testRecipientIds.length, sources: 0, postsChecked: 0, matched: 0, delivered: 0 };

  const sourceRows = await env.DB.prepare(
    "SELECT source_id,entity_type,entity_id,name,x_username,x_account_id,education_type,scope_type,scope_ids_json,verified FROM navixa_study_suspension_sources WHERE enabled=1 AND verified=1 AND x_username<>'' ORDER BY source_id ASC LIMIT 50",
  ).all<SourceRow>();
  let postsChecked = 0;
  let matched = 0;
  let delivered = 0;
  const ledger = createD1StudySuspensionLedger(env.DB);

  for (const row of sourceRows.results) {
    const ids = scopeIds(row.scope_ids_json);
    if (row.scope_type !== "national" && !ids.length) continue;
    let accountId = row.x_account_id.trim();
    if (!accountId) {
      accountId = await resolveOfficialXAccountId(row.x_username, bearerToken);
      await env.DB.prepare("UPDATE navixa_study_suspension_sources SET x_account_id=?,updated_at=? WHERE source_id=?")
        .bind(accountId, new Date().toISOString(), row.source_id).run();
    }

    const cursorRows = await env.DB.prepare("SELECT since_post_id FROM navixa_study_suspension_cursors WHERE source_id=? LIMIT 1")
      .bind(row.source_id).all<{ since_post_id: string }>();
    const timeline = await fetchOfficialXPosts({
      accountId,
      bearerToken,
      sinceId: cursorRows.results[0]?.since_post_id || "",
      maxResults: 10,
    });
    postsChecked += timeline.posts.length;

    const source: StudySuspensionXSource = {
      sourceId: row.source_id,
      source: {
        entityType: row.entity_type,
        entityId: row.entity_id,
        name: row.name,
        verified: row.verified === 1,
        officialAccountId: accountId,
      },
      username: row.x_username,
      accountId,
      educationType: row.education_type,
      scopeType: row.scope_type,
      scopeIds: ids,
    };
    const profile = profileForSource(row, ids);
    const recipients = await Promise.all(testRecipientIds.map(userId => loadStudySuspensionRecipient(env.DB, userId, profile)));

    for (const post of [...timeline.posts].reverse()) {
      const event = normalizeOfficialXPost(source, post);
      if (!event) continue;
      matched += 1;
      const result = await dispatchStudySuspensionEvent(event, recipients, {
        mode: "test",
        testRecipientIds,
        ledger,
      });
      delivered += result.delivered;
    }

    if (timeline.newestId) {
      const now = new Date().toISOString();
      await env.DB.prepare(
        "INSERT INTO navixa_study_suspension_cursors(source_id,since_post_id,checked_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET since_post_id=excluded.since_post_id,checked_at=excluded.checked_at,updated_at=excluded.updated_at",
      ).bind(row.source_id, timeline.newestId, now, now).run();
    }
  }

  return {
    configured: true,
    recipients: testRecipientIds.length,
    sources: sourceRows.results.length,
    postsChecked,
    matched,
    delivered,
  };
}

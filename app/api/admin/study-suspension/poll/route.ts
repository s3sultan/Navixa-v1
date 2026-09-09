import { NextResponse } from "next/server.js";
import {
  ADMIN_SESSION_COOKIE,
  isTrustedSameOriginRequest,
  readCookie,
  resolveAdminJwtSecret,
  verifyAdminSessionToken,
} from "../../../../../worker/adminAuth.ts";
import { resolveUserSession } from "../../../../../worker/userAuth.ts";
import { dispatchStudySuspensionEvent, type StudySuspensionScopeType } from "../../../../../worker/studySuspension.ts";
import {
  createD1StudySuspensionLedger,
  enableStudySuspensionTestRecipient,
  ensureStudySuspensionSchema,
  loadStudySuspensionRecipient,
  NAVIXA_RIYADH_EDUCATION_SOURCE_ID,
  type StudySuspensionD1Database,
} from "../../../../../worker/studySuspensionStore.ts";
import {
  fetchOfficialXPosts,
  normalizeOfficialXPost,
  resolveOfficialXAccountId,
  type StudySuspensionXSource,
} from "../../../../../worker/studySuspensionX.ts";

type WorkerBinding = { env?: { DB?: StudySuspensionD1Database; X_API_BEARER_TOKEN?: string } };
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

async function bindings() {
  try { return (await import("cloudflare:workers") as WorkerBinding).env || {}; }
  catch {
    const globalEnv = globalThis as { DB?: StudySuspensionD1Database; X_API_BEARER_TOKEN?: string };
    return {
      DB: globalEnv.DB,
      X_API_BEARER_TOKEN: globalEnv.X_API_BEARER_TOKEN || (typeof process !== "undefined" ? process.env.X_API_BEARER_TOKEN : undefined),
    };
  }
}
function reply(body: Record<string, unknown>, status = 200) { return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } }); }
async function ownerSession(request: Request, database: StudySuspensionD1Database) {
  const secret = await resolveAdminJwtSecret();
  const admin = secret ? await verifyAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE), secret) : null;
  const user = await resolveUserSession(request, database);
  if (!admin || !user) return null;
  if (admin.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) return null;
  return user;
}

export async function POST(request: Request) {
  if (!isTrustedSameOriginRequest(request)) return reply({ error: "مصدر الطلب غير موثوق" }, 403);
  const env = await bindings();
  const database = env.DB;
  if (!database) return reply({ error: "التخزين غير مهيأ" }, 503);
  const user = await ownerSession(request, database);
  if (!user) return reply({ error: "الفحص التجريبي يتطلب جلسة الإدارة وحساب NAVIXA نفسه" }, 401);
  const bearerToken = env.X_API_BEARER_TOKEN?.trim();
  if (!bearerToken) return reply({ error: "X_API_BEARER_TOKEN غير مهيأ على الخادم" }, 503);

  await ensureStudySuspensionSchema(database);
  await enableStudySuspensionTestRecipient(database, user.userId);
  const sourceRows = await database.prepare(
    "SELECT source_id,entity_type,entity_id,name,x_username,x_account_id,education_type,scope_type,scope_ids_json,verified FROM navixa_study_suspension_sources WHERE source_id=? AND enabled=1 AND verified=1 LIMIT 1",
  ).bind(NAVIXA_RIYADH_EDUCATION_SOURCE_ID).all<SourceRow>();
  const row = sourceRows.results[0];
  if (!row) return reply({ error: "المصدر الرسمي غير مفعّل" }, 409);

  let accountId = row.x_account_id.trim();
  if (!accountId) {
    accountId = await resolveOfficialXAccountId(row.x_username, bearerToken);
    await database.prepare("UPDATE navixa_study_suspension_sources SET x_account_id=?,updated_at=? WHERE source_id=?").bind(accountId, new Date().toISOString(), row.source_id).run();
  }

  const cursorRows = await database.prepare("SELECT since_post_id FROM navixa_study_suspension_cursors WHERE source_id=? LIMIT 1").bind(row.source_id).all<{ since_post_id: string }>();
  const sinceId = cursorRows.results[0]?.since_post_id || "";
  const timeline = await fetchOfficialXPosts({ accountId, bearerToken, sinceId, maxResults: 10 });
  const scopeIds = (() => { try { const parsed = JSON.parse(row.scope_ids_json); return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []; } catch { return []; } })();
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
    scopeIds,
  };
  const recipient = await loadStudySuspensionRecipient(database, user.userId, {
    educationType: "general",
    role: "student",
    regionId: "riyadh",
    cityId: "riyadh-city",
    educationAdminId: "riyadh-education",
  });
  const ledger = createD1StudySuspensionLedger(database);
  const processed: Array<{ postId: string; decision: string; delivered: number; duplicateSkipped: number }> = [];

  for (const post of [...timeline.posts].reverse()) {
    const event = normalizeOfficialXPost(source, post);
    if (!event) continue;
    const result = await dispatchStudySuspensionEvent(event, [recipient], {
      mode: "test",
      testRecipientIds: [user.userId],
      ledger,
    });
    processed.push({ postId: post.id, decision: event.decisionType, delivered: result.delivered, duplicateSkipped: result.duplicateSkipped });
  }

  if (timeline.newestId) {
    const now = new Date().toISOString();
    await database.prepare(
      "INSERT INTO navixa_study_suspension_cursors(source_id,since_post_id,checked_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET since_post_id=excluded.since_post_id,checked_at=excluded.checked_at,updated_at=excluded.updated_at",
    ).bind(row.source_id, timeline.newestId, now, now).run();
  }

  return reply({
    ok: true,
    testOnly: true,
    source: { name: row.name, username: row.x_username, accountId },
    postsChecked: timeline.posts.length,
    matchedDecisions: processed.length,
    processed,
    channels: { push: Boolean(recipient.pushSubscription), telegram: Boolean(recipient.telegramChatId) },
  });
}

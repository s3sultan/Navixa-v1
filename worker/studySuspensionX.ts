import type {
  StudySuspensionDecisionType,
  StudySuspensionEducationType,
  StudySuspensionEvent,
  StudySuspensionScopeType,
  StudySuspensionSource,
} from "./studySuspension.ts";

export type StudySuspensionXSource = {
  sourceId: string;
  source: StudySuspensionSource;
  username: string;
  accountId?: string;
  educationType: Exclude<StudySuspensionEducationType, "all">;
  scopeType: StudySuspensionScopeType;
  scopeIds: string[];
};

export type XPost = { id: string; text: string; created_at?: string };

type XUserLookupResponse = { data?: { id?: string; username?: string }; errors?: unknown[] };
type XTimelineResponse = { data?: XPost[]; meta?: { newest_id?: string }; errors?: unknown[] };

function cleanText(value: string) {
  return value.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 240);
}

export function classifyStudySuspensionDecision(text: string): StudySuspensionDecisionType | null {
  const normalized = text.replace(/[ـًٌٍَُِّْ]/g, "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (/(إلغاء|الغاء).{0,40}(تعليق|قرار)|استئناف.{0,40}(الدراسة|الدوام)/i.test(normalized)) return "cancel";
  if (/تعليق.{0,30}(الدراسة|الدراسة الحضورية|الدوام)|تقرر.{0,30}تعليق/i.test(normalized)) return "suspend";
  if (/(تحويل|تكون).{0,50}(عن بعد|عن بُعد|منصة مدرستي)|الدراسة.{0,30}(عن بعد|عن بُعد)/i.test(normalized)) return "remote";
  if (/(تأخير|تاخير).{0,40}(بداية|بدء|الدراسة|الدوام)/i.test(normalized)) return "delay";
  if (/استئناف.{0,40}(الدراسة|الدوام)/i.test(normalized)) return "resume";
  return null;
}

export function normalizeOfficialXPost(source: StudySuspensionXSource, post: XPost): StudySuspensionEvent | null {
  const decisionType = classifyStudySuspensionDecision(post.text);
  if (!decisionType || !source.source.verified) return null;
  const publishedAt = post.created_at && Number.isFinite(Date.parse(post.created_at)) ? post.created_at : new Date().toISOString();
  return {
    id: `${source.sourceId}:${post.id}`,
    sourcePostId: post.id,
    source: { ...source.source, officialAccountId: source.accountId || source.source.officialAccountId },
    sourceUrl: `https://x.com/${encodeURIComponent(source.username)}/status/${encodeURIComponent(post.id)}`,
    publishedAt,
    decisionType,
    educationType: source.educationType,
    scope: { type: source.scopeType, ids: [...source.scopeIds] },
    audience: "all",
    verification: "official_primary",
    summary: cleanText(post.text),
  };
}

async function xGet<T>(url: string, bearerToken: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${bearerToken}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`x_api_${response.status}`);
  return response.json() as Promise<T>;
}

export async function resolveOfficialXAccountId(username: string, bearerToken: string) {
  const safeUsername = username.replace(/^@/, "").trim();
  if (!/^[A-Za-z0-9_]{1,15}$/.test(safeUsername)) throw new Error("invalid_x_username");
  const response = await xGet<XUserLookupResponse>(
    `https://api.x.com/2/users/by/username/${encodeURIComponent(safeUsername)}`,
    bearerToken,
  );
  const id = response.data?.id?.trim();
  if (!id || !/^\d+$/.test(id)) throw new Error("x_account_not_resolved");
  return id;
}

export async function fetchOfficialXPosts(input: {
  accountId: string;
  bearerToken: string;
  sinceId?: string;
  maxResults?: number;
}) {
  if (!/^\d+$/.test(input.accountId)) throw new Error("invalid_x_account_id");
  const params = new URLSearchParams({
    "tweet.fields": "created_at",
    exclude: "replies,retweets",
    max_results: String(Math.max(5, Math.min(100, input.maxResults || 10))),
  });
  if (input.sinceId && /^\d+$/.test(input.sinceId)) params.set("since_id", input.sinceId);
  const response = await xGet<XTimelineResponse>(
    `https://api.x.com/2/users/${encodeURIComponent(input.accountId)}/tweets?${params.toString()}`,
    input.bearerToken,
  );
  const posts = Array.isArray(response.data) ? response.data.filter(post => /^\d+$/.test(post.id) && typeof post.text === "string") : [];
  return { posts, newestId: response.meta?.newest_id || posts[0]?.id || "" };
}

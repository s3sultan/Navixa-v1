import type { AiTier, NavixaProject } from "./router";
import { getAiBudgetPolicy } from "./budget";

export type NavixaDb = {
  prepare: (sql: string) => {
    bind: (...values: unknown[]) => {
      all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
    };
  };
};

type SubscriberRow = {
  plan: string;
  status: string;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
};

const ACTIVE_STATES = new Set(["active", "trialing", "trial"]);

function isFuture(value?: string | null) {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && time > Date.now();
}

export async function resolveAiAccess(
  db: NavixaDb,
  identity: { userId: string; email: string },
  project: NavixaProject,
): Promise<{ allowed: boolean; plan: string; allowedTiers: AiTier[]; reason: string }> {
  const row = (await db
    .prepare("SELECT plan,status,trial_ends_at,subscription_ends_at FROM navixa_subscribers WHERE user_id=? OR contact=? ORDER BY updated_at DESC LIMIT 1")
    .bind(identity.userId, identity.email)
    .all<SubscriberRow>()).results[0];

  if (!row) {
    const policy = getAiBudgetPolicy("free", project);
    return { allowed: true, plan: "free", allowedTiers: policy.allowedTiers, reason: "free-access" };
  }

  const status = String(row.status || "").toLowerCase();
  const hasTimeAccess = isFuture(row.trial_ends_at) || isFuture(row.subscription_ends_at);
  if (!ACTIVE_STATES.has(status) && !hasTimeAccess) {
    return { allowed: false, plan: row.plan || "free", allowedTiers: [], reason: "subscription-inactive" };
  }

  const plan = String(row.plan || "free").toLowerCase();
  const policy = getAiBudgetPolicy(plan, project);
  return { allowed: true, plan, allowedTiers: policy.allowedTiers, reason: "central-subscription-authority" };
}

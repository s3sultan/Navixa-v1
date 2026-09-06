import type { AiTier, NavixaProject } from "./router";

export interface AiBudgetPolicy {
  dailyRequestLimit: number;
  dailyTokenLimit: number;
  allowedTiers: AiTier[];
}

const DEFAULT_POLICY: AiBudgetPolicy = {
  dailyRequestLimit: 25,
  dailyTokenLimit: 30_000,
  allowedTiers: ["economy", "balanced"],
};

const PLAN_POLICIES: Record<string, AiBudgetPolicy> = {
  free: DEFAULT_POLICY,
  azm: { dailyRequestLimit: 100, dailyTokenLimit: 120_000, allowedTiers: ["economy", "balanced"] },
  himma: { dailyRequestLimit: 300, dailyTokenLimit: 400_000, allowedTiers: ["economy", "balanced", "advanced"] },
};

export interface AiUsageSnapshot {
  requestsToday: number;
  tokensToday: number;
}

export function getAiBudgetPolicy(plan: string, _project: NavixaProject): AiBudgetPolicy {
  return PLAN_POLICIES[plan.toLowerCase()] ?? DEFAULT_POLICY;
}

export function canUseAi(
  policy: AiBudgetPolicy,
  usage: AiUsageSnapshot,
  requestedTier: AiTier,
  estimatedTokens: number,
): { allowed: boolean; reason?: string } {
  if (!policy.allowedTiers.includes(requestedTier)) return { allowed: false, reason: "tier-not-allowed" };
  if (usage.requestsToday >= policy.dailyRequestLimit) return { allowed: false, reason: "request-limit" };
  if (usage.tokensToday + Math.max(0, estimatedTokens) > policy.dailyTokenLimit) return { allowed: false, reason: "token-limit" };
  return { allowed: true };
}

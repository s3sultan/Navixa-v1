import { canUseAi, getAiBudgetPolicy, type AiUsageSnapshot } from "./budget";
import { resolveAiAccess, type NavixaDb } from "./access";
import { routeAiRequest, type AiRouteRequest } from "./router";
import { validateAiInput } from "./security";

export async function authorizeAiRequest(input: {
  db: NavixaDb;
  identity: { userId: string; email: string };
  route: AiRouteRequest;
  text: string;
  usage: AiUsageSnapshot;
}) {
  const safe = validateAiInput(input.text);
  if (!safe.ok) return { allowed: false as const, reason: safe.reason || "invalid-input" };

  const access = await resolveAiAccess(input.db, input.identity, input.route.project);
  if (!access.allowed) return { allowed: false as const, reason: access.reason };

  // The plan comes from NAVIXA's server-side subscription authority, never from the client.
  const route = routeAiRequest({ ...input.route, userPlan: access.plan });
  const policy = getAiBudgetPolicy(access.plan, input.route.project);

  let tier = route.tier;
  if (!policy.allowedTiers.includes(tier) && route.allowFallback) {
    tier = policy.allowedTiers.includes("balanced") ? "balanced" : "economy";
  }

  const estimatedTokens = Math.max(1, input.route.estimatedInputTokens || Math.ceil(input.text.length / 4)) + route.maxOutputTokens;
  const budget = canUseAi(policy, input.usage, tier, estimatedTokens);
  if (!budget.allowed) return { allowed: false as const, reason: budget.reason || "budget-denied" };

  return {
    allowed: true as const,
    plan: access.plan,
    tier,
    maxOutputTokens: route.maxOutputTokens,
    estimatedTokens,
    routeReason: route.reason,
    accessReason: access.reason,
  };
}

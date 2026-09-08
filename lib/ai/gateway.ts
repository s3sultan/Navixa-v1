import { canUseAi, getAiBudgetPolicy, type AiUsageSnapshot } from "./budget";
import { resolveAiAccess, type NavixaDb } from "./access";
import { retrieveMemories } from "./memory/retrieval";
import type { MemoryStore, NavixaMemory } from "./memory/types";
import { routeAiRequest, type AiRouteRequest } from "./router";
import { validateAiInput } from "./security";

export async function authorizeAiRequest(input: {
  db: NavixaDb;
  identity: { userId: string; email: string };
  route: AiRouteRequest;
  text: string;
  usage: AiUsageSnapshot;
  memory?: {
    store: MemoryStore;
    includeCore?: boolean;
    limit?: number;
  };
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

  const baseEstimatedTokens = Math.max(
    1,
    input.route.estimatedInputTokens || Math.ceil(input.text.length / 4),
  ) + route.maxOutputTokens;
  const baseBudget = canUseAi(policy, input.usage, tier, baseEstimatedTokens);
  if (!baseBudget.allowed) {
    return { allowed: false as const, reason: baseBudget.reason || "budget-denied" };
  }

  let memories: NavixaMemory[] = [];
  let estimatedTokens = baseEstimatedTokens;

  if (input.memory) {
    try {
      const memoryQuery = {
        userId: input.identity.userId,
        project: input.route.project,
        text: input.text,
        includeCore: input.memory.includeCore ?? true,
        includeRestricted: false,
        limit: input.memory.limit ?? 8,
      } as const;
      const candidates = await input.memory.store.list(memoryQuery);
      const safeCandidates = retrieveMemories(candidates, memoryQuery);

      const memoryTokens = Math.ceil(
        safeCandidates.reduce((total, memory) => total + memory.content.length, 0) / 4,
      );
      const withMemoryTokens = baseEstimatedTokens + memoryTokens;
      const memoryBudget = canUseAi(policy, input.usage, tier, withMemoryTokens);

      // Memory is an enhancement, never a reason to block an otherwise valid request.
      if (memoryBudget.allowed) {
        memories = safeCandidates;
        estimatedTokens = withMemoryTokens;
      }
    } catch {
      // A memory-store failure must not break the core NAVIXA AI path.
      memories = [];
      estimatedTokens = baseEstimatedTokens;
    }
  }

  return {
    allowed: true as const,
    plan: access.plan,
    tier,
    maxOutputTokens: route.maxOutputTokens,
    estimatedTokens,
    memories,
    routeReason: route.reason,
    accessReason: access.reason,
  };
}

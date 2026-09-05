export type NavixaProject = "core" | "kids" | "learning" | "fitness" | "meetings";
export type AiTask = "chat" | "summarize" | "explain" | "classify" | "extract" | "coach" | "reason";
export type AiTier = "economy" | "balanced" | "advanced";

export interface AiRouteRequest {
  project: NavixaProject;
  task: AiTask;
  userPlan: string;
  estimatedInputTokens?: number;
  requiresAdvancedReasoning?: boolean;
  childMode?: boolean;
}

export interface AiRouteDecision {
  tier: AiTier;
  maxOutputTokens: number;
  allowFallback: boolean;
  reason: string;
}

const SIMPLE_TASKS = new Set<AiTask>(["classify", "extract"]);
const ADVANCED_TASKS = new Set<AiTask>(["reason"]);

export function routeAiRequest(request: AiRouteRequest): AiRouteDecision {
  if (request.childMode || request.project === "kids") {
    return { tier: "balanced", maxOutputTokens: 900, allowFallback: true, reason: "kids-safe-route" };
  }

  if (request.requiresAdvancedReasoning || ADVANCED_TASKS.has(request.task)) {
    return { tier: "advanced", maxOutputTokens: 2200, allowFallback: true, reason: "advanced-reasoning" };
  }

  if (SIMPLE_TASKS.has(request.task)) {
    return { tier: "economy", maxOutputTokens: 700, allowFallback: true, reason: "low-complexity-task" };
  }

  if (request.project === "learning" || request.task === "explain") {
    return { tier: "balanced", maxOutputTokens: 1600, allowFallback: true, reason: "learning-quality-route" };
  }

  return { tier: "balanced", maxOutputTokens: 1200, allowFallback: true, reason: "default-balanced-route" };
}

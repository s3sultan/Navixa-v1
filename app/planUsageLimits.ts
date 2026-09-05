export type NavixaUsageLimitKey = "trial_summarization_minutes" | "trial_ai_requests" | "himma_summarization_minutes" | "himma_ai_requests";

export const DEFAULT_PLAN_USAGE_LIMITS:Record<NavixaUsageLimitKey,number>={
  trial_summarization_minutes:30,
  trial_ai_requests:20,
  himma_summarization_minutes:600,
  himma_ai_requests:500,
};

export function normalizeUsageLimit(value:unknown,fallback:number){
  const parsed=typeof value==="number"?value:Number(value);
  if(!Number.isFinite(parsed)||parsed<0)return fallback;
  return Math.min(Math.floor(parsed),100000);
}

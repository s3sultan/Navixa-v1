import type {NavixaPlan} from "./planAccess";
import {DEFAULT_PLAN_USAGE_LIMITS,type NavixaUsageLimitKey} from "./planUsageLimits";

export type HeavyCapability="summarization"|"ai";
export function usageLimitKey(plan:NavixaPlan,trialActive:boolean,capability:HeavyCapability):NavixaUsageLimitKey|null{
  if(trialActive)return capability==="summarization"?"trial_summarization_minutes":"trial_ai_requests";
  if(plan==="himma")return capability==="summarization"?"himma_summarization_minutes":"himma_ai_requests";
  return null;
}
export function usageLimitFor(plan:NavixaPlan,trialActive:boolean,capability:HeavyCapability){const key=usageLimitKey(plan,trialActive,capability);return key?DEFAULT_PLAN_USAGE_LIMITS[key]:0;}

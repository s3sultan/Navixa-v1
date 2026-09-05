import {launchTrialPhase} from "./launchTrial";

export type NavixaPlan = "free" | "azm" | "himma";
export type NavixaCapability = "screen-monitoring" | "name-call" | "summarization" | "ai" | "english-learning" | "kids" | "fitness";

const AZM_CAPABILITIES = new Set<NavixaCapability>(["screen-monitoring","name-call"]);

export function hasPlanCapability(plan:NavixaPlan, capability:NavixaCapability, now=new Date()){
  const trial=launchTrialPhase(now);
  if(trial==="trial"||trial==="reminder") return true;
  if(plan==="himma") return true;
  if(plan==="azm") return AZM_CAPABILITIES.has(capability);
  return false;
}

export function planAccessSummary(plan:NavixaPlan, now=new Date()){
  const trial=launchTrialPhase(now);
  if(trial==="trial"||trial==="reminder") return "trial-full-limited" as const;
  if(plan==="himma") return "full" as const;
  if(plan==="azm") return "monitoring-and-name-call" as const;
  return "free" as const;
}

import {LAUNCH_TRIAL_CONFIG} from "./launchTrialConfig";
import {normalizeUsageLimit,type NavixaUsageLimitKey} from "./planUsageLimits";

export type LaunchTrialAdminInput={start?:string;reminderStart?:string;end?:string;limits?:Partial<Record<NavixaUsageLimitKey,unknown>>};

export function normalizeLaunchTrialAdminInput(input:LaunchTrialAdminInput){
  const start=validDate(input.start)?input.start!:LAUNCH_TRIAL_CONFIG.start;
  const reminderStart=validDate(input.reminderStart)?input.reminderStart!:LAUNCH_TRIAL_CONFIG.reminderStart;
  const end=validDate(input.end)?input.end!:LAUNCH_TRIAL_CONFIG.end;
  const limits={...LAUNCH_TRIAL_CONFIG.limits};
  for(const key of Object.keys(limits) as NavixaUsageLimitKey[])limits[key]=normalizeUsageLimit(input.limits?.[key],limits[key]);
  return {start,reminderStart,end,limits};
}

function validDate(value:unknown):value is string{return typeof value==="string"&&Number.isFinite(Date.parse(value));}

import {launchTrialPhase,launchTrialRemainingMs,LAUNCH_TRIAL_END,LAUNCH_TRIAL_REMINDER_START,LAUNCH_TRIAL_START} from "./launchTrial";

export function getLaunchTrialStatus(now=new Date()){
  const phase=launchTrialPhase(now);
  return {active:phase==="trial"||phase==="reminder",phase,start:LAUNCH_TRIAL_START,reminderStart:LAUNCH_TRIAL_REMINDER_START,end:LAUNCH_TRIAL_END,remainingMs:launchTrialRemainingMs(now)};
}

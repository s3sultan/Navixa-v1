import {NextResponse} from "next/server";
import {launchTrialPhase,launchTrialRemainingMs,LAUNCH_TRIAL_END,LAUNCH_TRIAL_REMINDER_START,LAUNCH_TRIAL_START} from "../../../launchTrial";

export const dynamic="force-dynamic";

export async function GET(){
  const now=new Date();
  const phase=launchTrialPhase(now);
  return NextResponse.json({active:phase==="trial"||phase==="reminder",phase,start:LAUNCH_TRIAL_START,reminderStart:LAUNCH_TRIAL_REMINDER_START,end:LAUNCH_TRIAL_END,remainingMs:launchTrialRemainingMs(now)},{headers:{"Cache-Control":"no-store"}});
}

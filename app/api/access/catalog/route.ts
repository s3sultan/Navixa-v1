import {NextResponse} from "next/server";
import {LAUNCH_TRIAL_END,LAUNCH_TRIAL_REMINDER_START,LAUNCH_TRIAL_START} from "../../../launchTrial";

export const dynamic="force-dynamic";

export async function GET(){
  return NextResponse.json({
    trial:{start:LAUNCH_TRIAL_START,reminderStart:LAUNCH_TRIAL_REMINDER_START,end:LAUNCH_TRIAL_END,scope:"full-limited"},
    plans:{free:{scope:"free"},azm:{scope:"free-plus",capabilities:["screen-monitoring","name-call"]},himma:{scope:"full"}}
  },{headers:{"Cache-Control":"no-store"}});
}

import {NextResponse} from "next/server";
import {LAUNCH_TRIAL_END,LAUNCH_TRIAL_REMINDER_START,LAUNCH_TRIAL_START} from "../../../launchTrial";
import {NAVIXA_ACCESS_MODEL} from "../../../accessModel";

export const dynamic="force-dynamic";

export async function GET(){
  return NextResponse.json({
    trial:{...NAVIXA_ACCESS_MODEL.trial,start:LAUNCH_TRIAL_START,reminderStart:LAUNCH_TRIAL_REMINDER_START,end:LAUNCH_TRIAL_END},
    plans:{free:NAVIXA_ACCESS_MODEL.free,azm:{...NAVIXA_ACCESS_MODEL.azm,capabilities:["screen-monitoring","name-call"]},himma:NAVIXA_ACCESS_MODEL.himma}
  },{headers:{"Cache-Control":"no-store"}});
}

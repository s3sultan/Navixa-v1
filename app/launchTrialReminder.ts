import {getLaunchTrialStatus} from "./launchTrialServer";
export function launchTrialReminderState(now=new Date()){const status=getLaunchTrialStatus(now);return {visible:status.phase==="reminder",remainingMs:status.remainingMs,end:status.end};}

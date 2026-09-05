import {NextResponse} from "next/server";
import {LAUNCH_TRIAL_CONFIG} from "../../../launchTrialConfig";

export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json(LAUNCH_TRIAL_CONFIG,{headers:{"Cache-Control":"no-store"}});}

import {NextResponse} from "next/server";
import {getLaunchTrialStatus} from "../../../launchTrialServer";

export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json(getLaunchTrialStatus(new Date()),{headers:{"Cache-Control":"no-store"}});}

import {NextResponse} from "next/server";
import {DEFAULT_PLAN_USAGE_LIMITS} from "../../../planUsageLimits";

export const dynamic="force-dynamic";

export async function GET(){
  return NextResponse.json({limits:DEFAULT_PLAN_USAGE_LIMITS},{headers:{"Cache-Control":"no-store"}});
}

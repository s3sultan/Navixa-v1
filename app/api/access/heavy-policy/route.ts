import {NextRequest,NextResponse} from "next/server";
import {usageLimitFor,type HeavyCapability} from "../../../accessUsagePolicy";
import type {NavixaPlan} from "../../../planAccess";
import {launchTrialPhase} from "../../../launchTrial";

export const dynamic="force-dynamic";
const plans=new Set<NavixaPlan>(["free","azm","himma"]);const caps=new Set<HeavyCapability>(["summarization","ai"]);
export async function GET(request:NextRequest){const plan=request.nextUrl.searchParams.get("plan") as NavixaPlan|null;const capability=request.nextUrl.searchParams.get("capability") as HeavyCapability|null;if(!plan||!plans.has(plan)||!capability||!caps.has(capability))return NextResponse.json({error:"invalid_request"},{status:400,headers:{"Cache-Control":"no-store"}});const phase=launchTrialPhase(new Date());const trialActive=phase==="trial"||phase==="reminder";const limit=usageLimitFor(plan,trialActive,capability);return NextResponse.json({allowed:limit>0,limit,trialActive},{headers:{"Cache-Control":"no-store"}});}

import {NextRequest,NextResponse} from "next/server";
import {hasPlanCapability,type NavixaCapability,type NavixaPlan} from "../../../planAccess";

export const dynamic="force-dynamic";
const plans=new Set<NavixaPlan>(["free","azm","himma"]);
const capabilities=new Set<NavixaCapability>(["screen-monitoring","name-call","summarization","ai","english-learning","kids","fitness"]);

export async function GET(request:NextRequest){
  const plan=request.nextUrl.searchParams.get("plan") as NavixaPlan|null;
  const capability=request.nextUrl.searchParams.get("capability") as NavixaCapability|null;
  if(!plan||!plans.has(plan)||!capability||!capabilities.has(capability))return NextResponse.json({error:"invalid_request"},{status:400,headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({plan,capability,allowed:hasPlanCapability(plan,capability,new Date())},{headers:{"Cache-Control":"no-store"}});
}

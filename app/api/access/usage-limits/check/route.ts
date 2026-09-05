import {NextRequest,NextResponse} from "next/server";
import {DEFAULT_PLAN_USAGE_LIMITS,type NavixaUsageLimitKey} from "../../../../planUsageLimits";

export const dynamic="force-dynamic";
const keys=new Set<NavixaUsageLimitKey>(Object.keys(DEFAULT_PLAN_USAGE_LIMITS) as NavixaUsageLimitKey[]);

export async function GET(request:NextRequest){
  const key=request.nextUrl.searchParams.get("key") as NavixaUsageLimitKey|null;
  const usedRaw=request.nextUrl.searchParams.get("used");
  const used=Number(usedRaw);
  if(!key||!keys.has(key)||!Number.isFinite(used)||used<0)return NextResponse.json({error:"invalid_request"},{status:400,headers:{"Cache-Control":"no-store"}});
  const limit=DEFAULT_PLAN_USAGE_LIMITS[key];
  return NextResponse.json({key,used,limit,allowed:used<limit,remaining:Math.max(0,limit-used)},{headers:{"Cache-Control":"no-store"}});
}

import {NextResponse} from "next/server.js";
import {ADMIN_SESSION_COOKIE,isTrustedSameOriginRequest,readCookie,resolveAdminJwtSecret,verifyAdminSessionToken} from "../../../../worker/adminAuth.ts";
import {ALERT_POLICY_TYPES,defaultAlertPolicy,isAlertPolicy,readAlertPolicy,writeAlertPolicy,type AlertPolicyDatabase,type AlertPolicyMap} from "../../../../worker/alertPolicy.ts";

async function db():Promise<AlertPolicyDatabase|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:AlertPolicyDatabase}}).env?.DB||null}catch{return (globalThis as {DB?:AlertPolicyDatabase}).DB||null}}
async function allowed(request:Request){const secret=await resolveAdminJwtSecret();return Boolean(secret&&isTrustedSameOriginRequest(request)&&await verifyAdminSessionToken(readCookie(request,ADMIN_SESSION_COOKIE),secret))}
const reply=(body:Record<string,unknown>,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});

export async function GET(request:Request){
  if(!await allowed(request))return reply({error:"غير مصرح"},401);
  const database=await db();if(!database)return reply({policy:defaultAlertPolicy(),configured:false},503);
  try{return reply({policy:await readAlertPolicy(database),configured:true})}catch{return reply({error:"تعذر قراءة سياسة التنبيهات"},500)}
}

export async function POST(request:Request){
  if(!await allowed(request))return reply({error:"غير مصرح"},401);
  const database=await db();if(!database)return reply({error:"التخزين غير مهيأ"},503);
  const body=await request.json().catch(()=>({})) as {policy?:unknown};
  if(!body.policy||typeof body.policy!=="object")return reply({error:"سياسة غير صالحة"},400);
  const incoming=body.policy as Record<string,{screen?:unknown;telegram?:unknown}>;
  const policy=defaultAlertPolicy();
  for(const type of ALERT_POLICY_TYPES){
    const row=incoming[type];
    if(!row||!isAlertPolicy(row.screen)||!isAlertPolicy(row.telegram))return reply({error:`سياسة ${type} غير صالحة`},400);
    policy[type]={screen:row.screen,telegram:row.telegram};
  }
  try{await writeAlertPolicy(database,policy as AlertPolicyMap);return reply({ok:true,policy})}catch{return reply({error:"تعذر حفظ سياسة التنبيهات"},500)}
}

import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE,isTrustedSameOriginRequest,readCookie,resolveAdminJwtSecret,verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";
import { DEFAULT_PLAN_PRICES,PLAN_PRICE_KEYS,normalizeHalalas } from "../../../billing/planPricing.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};

async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}
async function allowed(request:Request,requireSameOrigin=false){const secret=await resolveAdminJwtSecret();if(!secret)return false;if(requireSameOrigin&&!isTrustedSameOriginRequest(request))return false;return Boolean(await verifyAdminSessionToken(readCookie(request,ADMIN_SESSION_COOKIE),secret));}
async function schema(database:D1Database){await database.prepare("CREATE TABLE IF NOT EXISTS navixa_billing_settings (setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL,updated_at TEXT NOT NULL)").run()}
async function readPrices(database:D1Database){
  await schema(database);
  const rows=await database.prepare("SELECT setting_key,setting_value,updated_at FROM navixa_billing_settings WHERE setting_key IN (?,?)").bind(PLAN_PRICE_KEYS.monthly,PLAN_PRICE_KEYS.sprint).all<{setting_key:string;setting_value:string;updated_at:string}>();
  let monthly=DEFAULT_PLAN_PRICES.monthly,sprint=DEFAULT_PLAN_PRICES.sprint,updatedAt="";
  for(const row of rows.results){if(row.setting_key===PLAN_PRICE_KEYS.monthly)monthly=normalizeHalalas(row.setting_value,monthly);if(row.setting_key===PLAN_PRICE_KEYS.sprint)sprint=normalizeHalalas(row.setting_value,sprint);if(row.updated_at>updatedAt)updatedAt=row.updated_at}
  return {monthly,sprint,updatedAt};
}

export async function GET(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({prices:await readPrices(database)},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
  if(!await allowed(request,true))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as {monthlyRiyals?:unknown;sprintRiyals?:unknown};
  const monthlyRiyals=Number(body.monthlyRiyals),sprintRiyals=Number(body.sprintRiyals);
  if(!Number.isFinite(monthlyRiyals)||!Number.isFinite(sprintRiyals)||monthlyRiyals<1||sprintRiyals<1||monthlyRiyals>1000||sprintRiyals>1000)return NextResponse.json({error:"السعر يجب أن يكون بين 1 و1000 ريال"},{status:400,headers:{"Cache-Control":"no-store"}});
  const monthly=Math.round(monthlyRiyals*100),sprint=Math.round(sprintRiyals*100),now=new Date().toISOString();
  await schema(database);
  await database.prepare("INSERT INTO navixa_billing_settings (setting_key,setting_value,updated_at) VALUES (?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at").bind(PLAN_PRICE_KEYS.monthly,String(monthly),now).run();
  await database.prepare("INSERT INTO navixa_billing_settings (setting_key,setting_value,updated_at) VALUES (?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at").bind(PLAN_PRICE_KEYS.sprint,String(sprint),now).run();
  const verified=await readPrices(database);
  if(verified.monthly!==monthly||verified.sprint!==sprint)return NextResponse.json({error:"لم ينجح التحقق من الأسعار المحفوظة، لم يتم اعتماد التغيير"},{status:409,headers:{"Cache-Control":"no-store"}});
  return NextResponse.json({ok:true,prices:verified,verification:{status:"verified",message:"تمت إعادة قراءة السعر من قاعدة البيانات وسيستخدمه الدفع الخادمي تلقائيًا."}},{headers:{"Cache-Control":"no-store"}});
}

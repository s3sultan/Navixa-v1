import { NextResponse } from "next/server.js";
import {ADMIN_SESSION_COOKIE,isTrustedSameOriginRequest,readCookie,resolveAdminJwtSecret,verifyAdminSessionToken} from "../../../../worker/adminAuth.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};
type Subscriber={id:string;contact:string;display_name:string;plan:string;status:string;trial_started_at:string;trial_ends_at:string;subscription_ends_at:string;source:string;created_at:string;updated_at:string};
const clean=(value:unknown,limit:number)=>typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,limit):"";
const email=(value:unknown)=>clean(value,160).toLowerCase();
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validPlan=(value:string)=>["trial","monthly","quarterly"].includes(value)?value:"trial";
const validStatus=(value:string)=>["waitlist","trial","active","paused","cancelled","expired"].includes(value)?value:"waitlist";
async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}
async function schema(database:D1Database){await database.prepare("CREATE TABLE IF NOT EXISTS navixa_subscribers (id TEXT PRIMARY KEY,contact TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL DEFAULT '',plan TEXT NOT NULL DEFAULT 'trial',status TEXT NOT NULL DEFAULT 'waitlist',trial_started_at TEXT NOT NULL DEFAULT '',trial_ends_at TEXT NOT NULL DEFAULT '',subscription_ends_at TEXT NOT NULL DEFAULT '',source TEXT NOT NULL DEFAULT 'plus_page',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();await database.prepare("CREATE INDEX IF NOT EXISTS idx_navixa_subscribers_status ON navixa_subscribers(status, updated_at DESC)").run();}
async function allowed(request:Request){const secret=await resolveAdminJwtSecret();return Boolean(secret&&isTrustedSameOriginRequest(request)&&await verifyAdminSessionToken(readCookie(request,ADMIN_SESSION_COOKIE),secret));}
function afterDays(days:number){return new Date(Date.now()+days*86400000).toISOString();}

export async function GET(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({summary:{waitlist:0,trial:0,active:0,endingSoon:0},subscribers:[]},{headers:{"Cache-Control":"no-store"}});
  await schema(database);const now=new Date().toISOString(),soon=afterDays(3);
  const [rows,waitlist,trial,active,endingSoon]=await Promise.all([
    database.prepare("SELECT id,contact,display_name,plan,status,trial_started_at,trial_ends_at,subscription_ends_at,source,created_at,updated_at FROM navixa_subscribers ORDER BY updated_at DESC LIMIT 80").all<Subscriber>(),
    database.prepare("SELECT COUNT(*) AS count FROM navixa_subscribers WHERE status='waitlist'").all<{count:number}>(),
    database.prepare("SELECT COUNT(*) AS count FROM navixa_subscribers WHERE status='trial'").all<{count:number}>(),
    database.prepare("SELECT COUNT(*) AS count FROM navixa_subscribers WHERE status='active'").all<{count:number}>(),
    database.prepare("SELECT COUNT(*) AS count FROM navixa_subscribers WHERE status IN ('trial','active') AND ((trial_ends_at<>'' AND trial_ends_at>=? AND trial_ends_at<=?) OR (subscription_ends_at<>'' AND subscription_ends_at>=? AND subscription_ends_at<=?))").bind(now,soon,now,soon).all<{count:number}>(),
  ]);
  return NextResponse.json({summary:{waitlist:waitlist.results[0]?.count||0,trial:trial.results[0]?.count||0,active:active.results[0]?.count||0,endingSoon:endingSoon.results[0]?.count||0},subscribers:rows.results},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as {action?:unknown;id?:unknown;contact?:unknown;displayName?:unknown;plan?:unknown;status?:unknown};
  const action=clean(body.action,24),id=clean(body.id,80),now=new Date().toISOString();const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});await schema(database);
  if(action==="create_trial"){
    const contact=email(body.contact),displayName=clean(body.displayName,80);if(!validEmail(contact))return NextResponse.json({error:"أدخل بريدًا صحيحًا"},{status:400});
    const trialEnd=afterDays(14),subscriberId=crypto.randomUUID();
    await database.prepare("INSERT INTO navixa_subscribers (id,contact,display_name,plan,status,trial_started_at,trial_ends_at,subscription_ends_at,source,created_at,updated_at) VALUES (?,?,?,'trial','trial',?,?,?,'admin_trial',?,?) ON CONFLICT(contact) DO UPDATE SET display_name=excluded.display_name,plan='trial',status='trial',trial_started_at=excluded.trial_started_at,trial_ends_at=excluded.trial_ends_at,subscription_ends_at='',source='admin_trial',updated_at=excluded.updated_at").bind(subscriberId,contact,displayName,now,trialEnd,"",now,now).run();
    return NextResponse.json({ok:true,message:"تم منح تجربة Plus لمدة 14 يومًا"},{headers:{"Cache-Control":"no-store"}});
  }
  if(!id)return NextResponse.json({error:"معرف المشترك مطلوب"},{status:400});
  if(action==="extend_trial"){const trialEnd=afterDays(14);await database.prepare("UPDATE navixa_subscribers SET plan='trial',status='trial',trial_ends_at=?,subscription_ends_at='',updated_at=? WHERE id=?").bind(trialEnd,now,id).run();return NextResponse.json({ok:true,message:"تم تمديد التجربة 14 يومًا"},{headers:{"Cache-Control":"no-store"}});}
  if(action==="update_status"){const status=validStatus(clean(body.status,20)),plan=validPlan(clean(body.plan,20));await database.prepare("UPDATE navixa_subscribers SET status=?,plan=?,updated_at=? WHERE id=?").bind(status,plan,now,id).run();return NextResponse.json({ok:true,message:"تم تحديث حالة المشترك"},{headers:{"Cache-Control":"no-store"}});}
  return NextResponse.json({error:"إجراء غير صالح"},{status:400});
}

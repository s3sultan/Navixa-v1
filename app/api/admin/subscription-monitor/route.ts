import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE, isTrustedSameOriginRequest, readCookie, resolveAdminJwtSecret, verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";

type Statement={bind:(...values:unknown[])=>Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type Database={prepare:(sql:string)=>Statement};
type Ending={id:string;contact:string;display_name:string;plan:string;status:string;ends_at:string};
type Reminder={subscriber_id:string;reminder_type:string;channel:string;status:string;sent_at:string;error_message:string;updated_at:string};
type Founder={contact:string;unlock_at:string;badge_until:string;revealed_at:string;created_at:string};

async function db():Promise<Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:Database}}).env?.DB||null}catch{return (globalThis as {DB?:Database}).DB||null}}
async function allowed(request:Request){const secret=await resolveAdminJwtSecret();return Boolean(secret&&isTrustedSameOriginRequest(request)&&await verifyAdminSessionToken(readCookie(request,ADMIN_SESSION_COOKIE),secret));}

async function schema(database:Database){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_subscription_reminders (id TEXT PRIMARY KEY,subscriber_id TEXT NOT NULL,subscription_end_at TEXT NOT NULL,reminder_type TEXT NOT NULL,channel TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,last_attempt_at TEXT NOT NULL DEFAULT '',sent_at TEXT NOT NULL DEFAULT '',error_message TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(subscriber_id,subscription_end_at,reminder_type,channel))").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_founders_honors (id TEXT PRIMARY KEY,campaign_key TEXT NOT NULL,award_id TEXT NOT NULL UNIQUE,contact TEXT NOT NULL,user_id TEXT NOT NULL,honor_type TEXT NOT NULL,unlock_at TEXT NOT NULL,badge_until TEXT NOT NULL,revealed_at TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)").run();
}

export async function GET(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({summary:{endingSoon:0,remindersSent:0,foundersWaiting:0,foundersRevealed:0},ending:[],reminders:[],founders:[]},{headers:{"Cache-Control":"no-store"}});
  await schema(database);
  const now=new Date().toISOString(),fourDays=new Date(Date.now()+4*24*60*60_000).toISOString();
  const [ending,reminders,founders,sent,waiting,revealed]=await Promise.all([
    database.prepare("SELECT id,contact,display_name,plan,status,CASE WHEN status='trial' THEN trial_ends_at ELSE subscription_ends_at END AS ends_at FROM navixa_subscribers WHERE status IN ('trial','active') AND (CASE WHEN status='trial' THEN trial_ends_at ELSE subscription_ends_at END)<>'' AND (CASE WHEN status='trial' THEN trial_ends_at ELSE subscription_ends_at END)>? AND (CASE WHEN status='trial' THEN trial_ends_at ELSE subscription_ends_at END)<=? ORDER BY ends_at ASC LIMIT 80").bind(now,fourDays).all<Ending>(),
    database.prepare("SELECT subscriber_id,reminder_type,channel,status,sent_at,error_message,updated_at FROM navixa_subscription_reminders ORDER BY updated_at DESC LIMIT 60").all<Reminder>(),
    database.prepare("SELECT contact,unlock_at,badge_until,revealed_at,created_at FROM navixa_founders_honors WHERE honor_type='first_gold_founder' ORDER BY created_at DESC LIMIT 20").all<Founder>(),
    database.prepare("SELECT COUNT(*) AS count FROM navixa_subscription_reminders WHERE status='sent' AND sent_at>=?").bind(new Date(Date.now()-30*24*60*60_000).toISOString()).all<{count:number}>(),
    database.prepare("SELECT COUNT(*) AS count FROM navixa_founders_honors WHERE honor_type='first_gold_founder' AND unlock_at>? ").bind(now).all<{count:number}>(),
    database.prepare("SELECT COUNT(*) AS count FROM navixa_founders_honors WHERE honor_type='first_gold_founder' AND unlock_at<=?").bind(now).all<{count:number}>(),
  ]);
  return NextResponse.json({summary:{endingSoon:ending.results.length,remindersSent:sent.results[0]?.count||0,foundersWaiting:waiting.results[0]?.count||0,foundersRevealed:revealed.results[0]?.count||0},ending:ending.results,reminders:reminders.results,founders:founders.results},{headers:{"Cache-Control":"no-store"}});
}

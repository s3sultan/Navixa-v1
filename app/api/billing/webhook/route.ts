import { NextResponse } from "next/server.js";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};
const clean=(value:unknown,limit:number)=>typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,limit):"";
const email=(value:unknown)=>clean(value,160).toLowerCase();
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}
async function env(){try{return (await import("cloudflare:workers") as {env?:Record<string,string|undefined>}).env||{}}catch{return globalThis as Record<string,string|undefined>}}
async function schema(database:D1Database){await database.prepare("CREATE TABLE IF NOT EXISTS navixa_subscribers (id TEXT PRIMARY KEY,contact TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL DEFAULT '',plan TEXT NOT NULL DEFAULT 'trial',status TEXT NOT NULL DEFAULT 'waitlist',trial_started_at TEXT NOT NULL DEFAULT '',trial_ends_at TEXT NOT NULL DEFAULT '',subscription_ends_at TEXT NOT NULL DEFAULT '',source TEXT NOT NULL DEFAULT 'plus_page',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();await database.prepare("CREATE TABLE IF NOT EXISTS navixa_billing_events (id TEXT PRIMARY KEY,provider_event_id TEXT NOT NULL UNIQUE,subscriber_id TEXT NOT NULL DEFAULT '',event_type TEXT NOT NULL,mode TEXT NOT NULL DEFAULT 'test',payload_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL,processed_at TEXT NOT NULL DEFAULT '')").run();}

export async function GET(){return NextResponse.json({billing:"disabled",mode:"test",message:"بوابة الدفع غير مفعلة. لا يتم قبول أي دفعات أو بيانات بطاقات."},{headers:{"Cache-Control":"no-store"}})}

export async function POST(request:Request){
  const secrets=await env(),secret=secrets.BILLING_WEBHOOK_SECRET||"";
  if(!secret)return NextResponse.json({error:"بوابة الدفع غير مفعلة"},{status:503,headers:{"Cache-Control":"no-store"}});
  if(request.headers.get("x-navixa-webhook-secret")!==secret)return NextResponse.json({error:"توقيع غير صالح"},{status:401,headers:{"Cache-Control":"no-store"}});
  if(secrets.BILLING_LIVE!=="true")return NextResponse.json({error:"Webhook التجريبي جاهز، لكن التفعيل المالي الحي مقفل"},{status:409,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as {eventId?:unknown;eventType?:unknown;contact?:unknown;plan?:unknown};const eventId=clean(body.eventId,120),eventType=clean(body.eventType,40),contact=email(body.contact),plan=clean(body.plan,20);
  if(!eventId||!validEmail(contact)||!['payment_paid','subscription_renewed'].includes(eventType)||!['monthly','quarterly'].includes(plan))return NextResponse.json({error:"بيان Webhook غير صالح"},{status:400});
  const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503});await schema(database);const existing=await database.prepare("SELECT id FROM navixa_billing_events WHERE provider_event_id=? LIMIT 1").bind(eventId).all<{id:string}>();if(existing.results.length)return NextResponse.json({ok:true,duplicate:true});
  const now=new Date().toISOString(),days=plan==='quarterly'?120:30,end=new Date(Date.now()+days*86400000).toISOString(),subscriberId=crypto.randomUUID();await database.prepare("INSERT INTO navixa_subscribers (id,contact,display_name,plan,status,subscription_ends_at,source,created_at,updated_at) VALUES (?,?,'',?,'active',?,'webhook',?,?) ON CONFLICT(contact) DO UPDATE SET plan=excluded.plan,status='active',subscription_ends_at=excluded.subscription_ends_at,source='webhook',updated_at=excluded.updated_at").bind(subscriberId,contact,plan,end,now,now).run();await database.prepare("INSERT INTO navixa_billing_events (id,provider_event_id,subscriber_id,event_type,mode,payload_json,created_at,processed_at) VALUES (?,?,?,?, 'live', '{}',?,?)").bind(crypto.randomUUID(),eventId,subscriberId,eventType,now,now).run();return NextResponse.json({ok:true});
}

import { NextResponse } from "next/server.js";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};
type Env=Record<string,string|undefined>;
type Settings={provider:string;mode:string;public_checkout:string;test_webhook_enabled:string;live_payments_enabled:string};
const defaults:Settings={provider:"moyasar",mode:"test",public_checkout:"false",test_webhook_enabled:"false",live_payments_enabled:"false"};
const clean=(value:unknown,limit:number)=>typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,limit):"";
const email=(value:unknown)=>clean(value,160).toLowerCase();
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}
async function env():Promise<Env>{try{return (await import("cloudflare:workers") as {env?:Env}).env||{}}catch{return globalThis as Env}}
async function schema(database:D1Database){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_subscribers (id TEXT PRIMARY KEY,user_id TEXT NOT NULL DEFAULT '',contact TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL DEFAULT '',plan TEXT NOT NULL DEFAULT 'trial',status TEXT NOT NULL DEFAULT 'waitlist',trial_started_at TEXT NOT NULL DEFAULT '',trial_ends_at TEXT NOT NULL DEFAULT '',subscription_ends_at TEXT NOT NULL DEFAULT '',source TEXT NOT NULL DEFAULT 'plus_page',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_billing_events (id TEXT PRIMARY KEY,provider_event_id TEXT NOT NULL UNIQUE,subscriber_id TEXT NOT NULL DEFAULT '',event_type TEXT NOT NULL,mode TEXT NOT NULL DEFAULT 'test',payload_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL,processed_at TEXT NOT NULL DEFAULT '')").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_billing_settings (setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_discount_codes (id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,discount_type TEXT NOT NULL DEFAULT 'percent',discount_value INTEGER NOT NULL DEFAULT 0,plans TEXT NOT NULL DEFAULT 'all',max_redemptions INTEGER NOT NULL DEFAULT 0,redeemed_count INTEGER NOT NULL DEFAULT 0,reserved_count INTEGER NOT NULL DEFAULT 0,valid_from TEXT NOT NULL DEFAULT '',valid_until TEXT NOT NULL DEFAULT '',enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  await database.prepare("ALTER TABLE navixa_discount_codes ADD COLUMN reserved_count INTEGER NOT NULL DEFAULT 0").run().catch(()=>{});
  await database.prepare("ALTER TABLE navixa_billing_intents ADD COLUMN discount_code TEXT NOT NULL DEFAULT ''").run().catch(()=>{});
  const now=new Date().toISOString();for(const [key,value] of Object.entries(defaults))await database.prepare("INSERT OR IGNORE INTO navixa_billing_settings (setting_key,setting_value,updated_at) VALUES (?,?,?)").bind(key,value,now).run();
}
async function settings(database:D1Database){await schema(database);const rows=await database.prepare("SELECT setting_key,setting_value FROM navixa_billing_settings").all<{setting_key:string;setting_value:string}>();const next={...defaults};for(const row of rows.results)if(row.setting_key in next)next[row.setting_key as keyof Settings]=row.setting_value;return next;}
function webhookSecret(request:Request,body:Record<string,unknown>){return clean(request.headers.get("x-navixa-webhook-secret")||body.secret_token,180);}

export async function GET(){return NextResponse.json({billing:"disabled",mode:"test",message:"بوابة الدفع مخفية ومقفلة حتى يفعّلها المدير. لا يتم قبول أي دفعات أو بيانات بطاقات الآن."},{headers:{"Cache-Control":"no-store"}})}

export async function POST(request:Request){
  const database=await db();if(!database)return NextResponse.json({error:"بوابة الدفع غير مهيأة"},{status:503,headers:{"Cache-Control":"no-store"}});
  const current=await settings(database),secrets=await env();
  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  const requestedLive=body.live===true;
  const expectedSecret=requestedLive?secrets.MOYASAR_LIVE_WEBHOOK_SECRET:secrets.MOYASAR_TEST_WEBHOOK_SECRET;
  const enabled=requestedLive?current.live_payments_enabled==="true":current.test_webhook_enabled==="true";
  if(!expectedSecret||!enabled)return NextResponse.json({error:"بوابة الدفع مقفلة من الإدارة"},{status:503,headers:{"Cache-Control":"no-store"}});
  if(webhookSecret(request,body)!==expectedSecret)return NextResponse.json({error:"توقيع Webhook غير صالح"},{status:401,headers:{"Cache-Control":"no-store"}});
  if(requestedLive&&(current.mode!=="live"||current.public_checkout!=="true"))return NextResponse.json({error:"الدفع الحي غير مفعل للزوار"},{status:409,headers:{"Cache-Control":"no-store"}});
  const eventId=clean(body.id||body.eventId,120),eventType=clean(body.type||body.eventType,40);
  const data=(body.data&&typeof body.data==="object"?body.data:{}) as Record<string,unknown>;
  const metadata=(data.metadata&&typeof data.metadata==="object"?data.metadata:{}) as Record<string,unknown>;
  const intentId=clean(metadata.navixa_intent,100);
  const intents=await database.prepare("SELECT id,user_id,contact,plan,status,discount_code FROM navixa_billing_intents WHERE id=? AND mode='live' AND status='pending' AND expires_at>? LIMIT 1").bind(intentId,new Date().toISOString()).all<{id:string;user_id:string;contact:string;plan:string;status:string;discount_code:string}>();
  const intent=intents.results[0],contact=intent?.contact||"",plan=intent?.plan||"",userId=intent?.user_id||"";
  if(!eventId||!intentId||!userId||!validEmail(contact)||!['payment_paid','subscription_renewed'].includes(eventType)||!['monthly','quarterly'].includes(plan))return NextResponse.json({error:"حدث الدفع لا يحمل نية NAVIXA صالحة"},{status:400});
  const existing=await database.prepare("SELECT id FROM navixa_billing_events WHERE provider_event_id=? LIMIT 1").bind(eventId).all<{id:string}>();if(existing.results.length)return NextResponse.json({ok:true,duplicate:true});
  const now=new Date().toISOString(),days=plan==="quarterly"?120:30,end=new Date(Date.now()+days*86400000).toISOString(),subscriberId=crypto.randomUUID(),mode=requestedLive?"live":"test";
  if(requestedLive){
    await database.prepare("INSERT INTO navixa_subscribers (id,user_id,contact,display_name,plan,status,subscription_ends_at,source,created_at,updated_at) VALUES (?,?,?,'',?,'active',?,'moyasar_webhook',?,?) ON CONFLICT(contact) DO UPDATE SET user_id=excluded.user_id,plan=excluded.plan,status='active',subscription_ends_at=excluded.subscription_ends_at,source='moyasar_webhook',updated_at=excluded.updated_at").bind(subscriberId,userId,contact,plan,end,now,now).run();
    await database.prepare("UPDATE navixa_billing_intents SET status='paid',provider_payment_id=?,updated_at=? WHERE id=?").bind(eventId,now,intentId).run();
    if(intent.discount_code)await database.prepare("UPDATE navixa_discount_codes SET redeemed_count=redeemed_count+1,reserved_count=CASE WHEN reserved_count>0 THEN reserved_count-1 ELSE 0 END,updated_at=? WHERE code=?").bind(now,intent.discount_code).run();
  }
  await database.prepare("INSERT INTO navixa_billing_events (id,provider_event_id,subscriber_id,event_type,mode,payload_json,created_at,processed_at) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),eventId,requestedLive?subscriberId:"",eventType,mode,JSON.stringify({intentId,plan,provider:"moyasar"}),now,now).run();
  return NextResponse.json({ok:true,mode,activated:requestedLive});
}

import { NextResponse } from "next/server.js";
import {applyPendingCredits,rewardReferralAfterVerifiedPayment} from "../../../referrals.ts";
import {completeFoundersAward} from "../../../foundersCampaign.ts";
import { verifyMoyasarPayment } from "../../../billing/providers/index.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};
type Env=Record<string,string|undefined>;
type Settings={provider:string;mode:string;public_checkout:string;test_webhook_enabled:string;live_payments_enabled:string};
type Intent={id:string;contact:string;plan:"monthly"|"quarterly";amount:number;currency:string;status:string;expires_at:string;discount_code:string;founders_intent_id:string};
const defaults:Settings={provider:"moyasar",mode:"test",public_checkout:"false",test_webhook_enabled:"false",live_payments_enabled:"false"};
const clean=(value:unknown,limit:number)=>typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,limit):"";
const paymentId=(value:unknown)=>clean(value,160).replace(/[^a-zA-Z0-9_-]/g,"");
async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}
async function env():Promise<Env>{try{return (await import("cloudflare:workers") as {env?:Env}).env||{}}catch{return globalThis as Env}}
async function schema(database:D1Database){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_billing_settings (setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_billing_intents (id TEXT PRIMARY KEY,contact TEXT NOT NULL,plan TEXT NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL DEFAULT 'SAR',mode TEXT NOT NULL DEFAULT 'test',status TEXT NOT NULL DEFAULT 'pending',provider_payment_id TEXT NOT NULL DEFAULT '',discount_code TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,expires_at TEXT NOT NULL)").run();
  await database.prepare("ALTER TABLE navixa_billing_intents ADD COLUMN discount_code TEXT NOT NULL DEFAULT ''").run().catch(()=>{});
  await database.prepare("ALTER TABLE navixa_billing_intents ADD COLUMN founders_intent_id TEXT NOT NULL DEFAULT ''").run().catch(()=>{});
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_discount_codes (id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,discount_type TEXT NOT NULL DEFAULT 'percent',discount_value INTEGER NOT NULL DEFAULT 0,plans TEXT NOT NULL DEFAULT 'all',max_redemptions INTEGER NOT NULL DEFAULT 0,redeemed_count INTEGER NOT NULL DEFAULT 0,reserved_count INTEGER NOT NULL DEFAULT 0,valid_from TEXT NOT NULL DEFAULT '',valid_until TEXT NOT NULL DEFAULT '',enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  await database.prepare("ALTER TABLE navixa_discount_codes ADD COLUMN reserved_count INTEGER NOT NULL DEFAULT 0").run().catch(()=>{});
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_subscribers (id TEXT PRIMARY KEY,contact TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL DEFAULT '',plan TEXT NOT NULL DEFAULT 'trial',status TEXT NOT NULL DEFAULT 'waitlist',trial_started_at TEXT NOT NULL DEFAULT '',trial_ends_at TEXT NOT NULL DEFAULT '',subscription_ends_at TEXT NOT NULL DEFAULT '',source TEXT NOT NULL DEFAULT 'plus_page',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_billing_events (id TEXT PRIMARY KEY,provider_event_id TEXT NOT NULL UNIQUE,subscriber_id TEXT NOT NULL DEFAULT '',event_type TEXT NOT NULL,mode TEXT NOT NULL DEFAULT 'test',payload_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL,processed_at TEXT NOT NULL DEFAULT '')").run();
  const now=new Date().toISOString();for(const [key,value] of Object.entries(defaults))await database.prepare("INSERT OR IGNORE INTO navixa_billing_settings (setting_key,setting_value,updated_at) VALUES (?,?,?)").bind(key,value,now).run();
}
async function settings(database:D1Database){await schema(database);const rows=await database.prepare("SELECT setting_key,setting_value FROM navixa_billing_settings").all<{setting_key:string;setting_value:string}>();const next={...defaults};for(const row of rows.results)if(row.setting_key in next)next[row.setting_key as keyof Settings]=row.setting_value;return next;}

export async function POST(request:Request){
  if(request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({error:"طلب غير مسموح"},{status:403,headers:{"Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({error:"الدفع غير متاح حاليًا"},{status:503,headers:{"Cache-Control":"no-store"}});const current=await settings(database);
  if(current.public_checkout!=="true"||current.live_payments_enabled!=="true"||current.mode!=="live")return NextResponse.json({error:"الدفع غير متاح حاليًا"},{status:404,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as {intentId?:unknown;paymentId?:unknown};const intentId=clean(body.intentId,80),id=paymentId(body.paymentId);if(!intentId||!id)return NextResponse.json({error:"مرجع الدفع غير صالح"},{status:400,headers:{"Cache-Control":"no-store"}});
  const selected=await database.prepare("SELECT id,contact,plan,amount,currency,status,expires_at,discount_code,founders_intent_id FROM navixa_billing_intents WHERE id=? LIMIT 1").bind(intentId).all<Intent>();const intent=selected.results[0];if(!intent||intent.status!=="pending"||new Date(intent.expires_at).getTime()<Date.now())return NextResponse.json({error:"نية الشراء غير متاحة أو انتهت"},{status:400,headers:{"Cache-Control":"no-store"}});
  const secrets=await env(),secret=secrets.MOYASAR_LIVE_SECRET_KEY||"";if(!secret)return NextResponse.json({error:"إعداد الدفع غير مكتمل"},{status:503,headers:{"Cache-Control":"no-store"}});
  const payment=await verifyMoyasarPayment({secret,paymentId:id,expectedIntentId:intent.id,expectedAmount:intent.amount,expectedCurrency:intent.currency});
  if(!payment)return NextResponse.json({error:"تعذر التحقق من الدفع"},{status:502,headers:{"Cache-Control":"no-store"}});
  if(payment.status!=="paid")return NextResponse.json({error:"لم تتم مطابقة بيانات الدفع"},{status:400,headers:{"Cache-Control":"no-store"}});
  const verifiedPaymentId=payment.paymentId;
  const now=new Date().toISOString(),days=intent.plan==="quarterly"?120:30,end=new Date(Date.now()+days*86400000).toISOString(),subscriberId=crypto.randomUUID();
  await database.prepare("UPDATE navixa_billing_intents SET status='paid',provider_payment_id=?,updated_at=? WHERE id=?").bind(verifiedPaymentId,now,intent.id).run();
  if(intent.discount_code)await database.prepare("UPDATE navixa_discount_codes SET redeemed_count=redeemed_count+1,reserved_count=CASE WHEN reserved_count>0 THEN reserved_count-1 ELSE 0 END,updated_at=? WHERE code=?").bind(now,intent.discount_code).run();
  await database.prepare("INSERT INTO navixa_subscribers (id,contact,display_name,plan,status,subscription_ends_at,source,created_at,updated_at) VALUES (?,?,'',?,'active',?,'moyasar_verify',?,?) ON CONFLICT(contact) DO UPDATE SET plan=excluded.plan,status='active',subscription_ends_at=excluded.subscription_ends_at,source='moyasar_verify',updated_at=excluded.updated_at").bind(subscriberId,intent.contact,intent.plan,end,now,now).run();
  const foundersAwarded=intent.founders_intent_id?await completeFoundersAward(database,intent.founders_intent_id).catch(()=>false):false;
  const creditsApplied=await applyPendingCredits(database,intent.contact);const referral=await rewardReferralAfterVerifiedPayment(database,intent.id,verifiedPaymentId,intent.plan).catch(()=>({rewarded:false,reason:"review"}));
  await database.prepare("INSERT OR IGNORE INTO navixa_billing_events (id,provider_event_id,subscriber_id,event_type,mode,payload_json,created_at,processed_at) VALUES (?,?,?,?, 'live',?,?,?)").bind(crypto.randomUUID(),`verify:${verifiedPaymentId}`,subscriberId,"payment_verified",JSON.stringify({intentId:intent.id,plan:intent.plan,creditsApplied,referral,foundersAwarded}),now,now).run();
  return NextResponse.json({ok:true,plan:intent.plan,endsAt:end,creditsApplied,referral,foundersAwarded},{headers:{"Cache-Control":"no-store"}});
}

import { NextResponse } from "next/server.js";
import {clean as cleanReferral,createAttribution} from "../../../referrals.ts";
import { getUserAuthSettings, resolveUserSession } from "../../../../worker/userAuth.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};
type Env=Record<string,string|undefined>;
type Settings={provider:string;mode:string;public_checkout:string;test_webhook_enabled:string;live_payments_enabled:string};
const defaults:Settings={provider:"moyasar",mode:"test",public_checkout:"false",test_webhook_enabled:"false",live_payments_enabled:"false"};
const clean=(value:unknown,limit:number)=>typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,limit):"";
const email=(value:unknown)=>clean(value,160).toLowerCase();
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const planDetails={monthly:{amount:1900,label:"NAVIXA Plus · شهري"},quarterly:{amount:5700,label:"NAVIXA Plus · 3 أشهر + شهر مجانًا"}} as const;
type Plan=keyof typeof planDetails;
const windows=new Map<string,{count:number;resetAt:number}>();
function allowedRate(request:Request){const id=request.headers.get("cf-connecting-ip")||request.headers.get("x-forwarded-for")||"anonymous",now=Date.now(),current=windows.get(id);if(!current||current.resetAt<now){windows.set(id,{count:1,resetAt:now+10*60_000});return true}if(current.count>=5)return false;current.count+=1;return true;}
async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}
async function env():Promise<Env>{try{return (await import("cloudflare:workers") as {env?:Env}).env||{}}catch{return globalThis as Env}}
async function schema(database:D1Database){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_billing_settings (setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_billing_intents (id TEXT PRIMARY KEY,user_id TEXT NOT NULL DEFAULT '',contact TEXT NOT NULL,plan TEXT NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL DEFAULT 'SAR',mode TEXT NOT NULL DEFAULT 'test',status TEXT NOT NULL DEFAULT 'pending',provider_payment_id TEXT NOT NULL DEFAULT '',referral_code TEXT NOT NULL DEFAULT '',discount_code TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,expires_at TEXT NOT NULL)").run();
  await database.prepare("ALTER TABLE navixa_billing_intents ADD COLUMN discount_code TEXT NOT NULL DEFAULT ''").run().catch(()=>{});
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_discount_codes (id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,discount_type TEXT NOT NULL DEFAULT 'percent',discount_value INTEGER NOT NULL DEFAULT 0,plans TEXT NOT NULL DEFAULT 'all',max_redemptions INTEGER NOT NULL DEFAULT 0,redeemed_count INTEGER NOT NULL DEFAULT 0,valid_from TEXT NOT NULL DEFAULT '',valid_until TEXT NOT NULL DEFAULT '',enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  const now=new Date().toISOString();for(const [key,value] of Object.entries(defaults))await database.prepare("INSERT OR IGNORE INTO navixa_billing_settings (setting_key,setting_value,updated_at) VALUES (?,?,?)").bind(key,value,now).run();
}
async function settings(database:D1Database){await schema(database);const rows=await database.prepare("SELECT setting_key,setting_value FROM navixa_billing_settings").all<{setting_key:string;setting_value:string}>();const next={...defaults};for(const row of rows.results)if(row.setting_key in next)next[row.setting_key as keyof Settings]=row.setting_value;return next;}

export async function POST(request:Request){
  if(request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({error:"طلب غير مسموح"},{status:403,headers:{"Cache-Control":"no-store"}});
  if(!allowedRate(request))return NextResponse.json({error:"عدد محاولات كبير، حاول لاحقًا"},{status:429,headers:{"Retry-After":"600","Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({error:"الدفع غير متاح حاليًا"},{status:503,headers:{"Cache-Control":"no-store"}});
  const current=await settings(database);if(current.public_checkout!=="true"||current.live_payments_enabled!=="true"||current.mode!=="live")return NextResponse.json({error:"الدفع غير متاح حاليًا"},{status:404,headers:{"Cache-Control":"no-store"}});
  const authSettings=await getUserAuthSettings(database).catch(()=>null),session=await resolveUserSession(request,database);if(!authSettings?.userAuthEnabled||!session)return NextResponse.json({error:"سجّل الدخول بحساب NAVIXA قبل المتابعة إلى الدفع"},{status:401,headers:{"Cache-Control":"no-store"}});
  const secrets=await env(),publicKey=secrets.MOYASAR_LIVE_PUBLISHABLE_KEY||"";if(!publicKey)return NextResponse.json({error:"إعداد الدفع غير مكتمل"},{status:503,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as {plan?:unknown;referralCode?:unknown;discountCode?:unknown};const contact=session.email,plan=clean(body.plan,20) as Plan,referralCode=cleanReferral(body.referralCode,20).toUpperCase();if(!validEmail(contact)||!(plan in planDetails))return NextResponse.json({error:"بيانات الاشتراك غير صالحة"},{status:400,headers:{"Cache-Control":"no-store"}});
  const now=new Date(),intentId=crypto.randomUUID(),details=planDetails[plan],discountCode=clean(body.discountCode,32).toUpperCase();let amount=details.amount,discountApplied="";if(discountCode){const rows=await database.prepare("SELECT code,discount_type,discount_value,plans,max_redemptions,redeemed_count,valid_from,valid_until,enabled FROM navixa_discount_codes WHERE code=? LIMIT 1").bind(discountCode).all<{code:string;discount_type:string;discount_value:number;plans:string;max_redemptions:number;redeemed_count:number;valid_from:string;valid_until:string;enabled:number}>();const coupon=rows.results[0],nowMs=Date.now(),from=coupon?.valid_from?new Date(coupon.valid_from).getTime():0,until=coupon?.valid_until?new Date(coupon.valid_until+"T23:59:59Z").getTime():0,eligible=Boolean(coupon&&coupon.enabled&&(!from||nowMs>=from)&&(!until||nowMs<=until)&&(!coupon.max_redemptions||coupon.redeemed_count<coupon.max_redemptions)&&(coupon.plans==="all"||coupon.plans===plan));if(!eligible)return NextResponse.json({error:"كود الخصم غير صالح أو غير متاح لهذه الباقة"},{status:400});const reduction=coupon.discount_type==="fixed"?coupon.discount_value:Math.round(details.amount*coupon.discount_value/100);amount=Math.max(0,details.amount-reduction);discountApplied=coupon.code;}const expires=new Date(now.getTime()+30*60_000).toISOString();
  await database.prepare("INSERT INTO navixa_billing_intents (id,user_id,contact,plan,amount,currency,mode,status,provider_payment_id,referral_code,discount_code,created_at,updated_at,expires_at) VALUES (?,?,?,?,?, 'SAR','live','pending','',?,?,?, ?,?)").bind(intentId,session.userId,contact,plan,amount,referralCode,discountApplied,now.toISOString(),now.toISOString(),expires).run();
  const attribution=referralCode?await createAttribution(database,referralCode,contact,intentId).catch(()=>null):null;
  const origin=new URL(request.url).origin;
  return NextResponse.json({intentId,provider:"moyasar",publicKey,amount,currency:"SAR",description:details.label,callbackUrl:`${origin}/plus/complete?intent=${encodeURIComponent(intentId)}`,metadata:{navixa_intent:intentId,navixa_plan:plan},referralApplied:Boolean(attribution)},{headers:{"Cache-Control":"no-store"}});
}

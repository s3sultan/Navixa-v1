import { NextResponse } from "next/server.js";
import {ADMIN_SESSION_COOKIE,isTrustedSameOriginRequest,readCookie,resolveAdminJwtSecret,verifyAdminSessionToken} from "../../../../worker/adminAuth.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};
type BillingSetting={setting_key:string;setting_value:string};
type BillingEvent={id:string;provider_event_id:string;event_type:string;mode:string;created_at:string;processed_at:string};
type Env=Record<string,string|undefined>;

const settingKeys=["provider","mode","public_checkout","test_webhook_enabled","live_payments_enabled"] as const;
type SettingKey=(typeof settingKeys)[number];
const defaults:Record<SettingKey,string>={provider:"moyasar",mode:"test",public_checkout:"false",test_webhook_enabled:"false",live_payments_enabled:"false"};
const clean=(value:unknown,limit:number)=>typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,limit):"";
const flag=(value:unknown)=>value===true||value==="true";

async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}
async function env():Promise<Env>{try{return (await import("cloudflare:workers") as {env?:Env}).env||{}}catch{return globalThis as Env}}
async function allowed(request:Request){const secret=await resolveAdminJwtSecret();return Boolean(secret&&isTrustedSameOriginRequest(request)&&await verifyAdminSessionToken(readCookie(request,ADMIN_SESSION_COOKIE),secret));}
async function schema(database:D1Database){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_billing_settings (setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_billing_events (id TEXT PRIMARY KEY,provider_event_id TEXT NOT NULL UNIQUE,subscriber_id TEXT NOT NULL DEFAULT '',event_type TEXT NOT NULL,mode TEXT NOT NULL DEFAULT 'test',payload_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL,processed_at TEXT NOT NULL DEFAULT '')").run();
  const now=new Date().toISOString();
  for(const key of settingKeys)await database.prepare("INSERT OR IGNORE INTO navixa_billing_settings (setting_key,setting_value,updated_at) VALUES (?,?,?)").bind(key,defaults[key],now).run();
}
async function readSettings(database:D1Database){await schema(database);const rows=await database.prepare("SELECT setting_key,setting_value FROM navixa_billing_settings").all<BillingSetting>();const settings={...defaults};for(const row of rows.results)if(settingKeys.includes(row.setting_key as SettingKey))settings[row.setting_key as SettingKey]=row.setting_value;return settings;}
function safeStatus(secrets:Env){return {testKeyConfigured:Boolean(secrets.MOYASAR_TEST_SECRET_KEY),testWebhookSecretConfigured:Boolean(secrets.MOYASAR_TEST_WEBHOOK_SECRET),liveKeyConfigured:Boolean(secrets.MOYASAR_LIVE_SECRET_KEY),liveWebhookSecretConfigured:Boolean(secrets.MOYASAR_LIVE_WEBHOOK_SECRET)};}

export async function GET(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({settings:defaults,secrets:{testKeyConfigured:false,testWebhookSecretConfigured:false,liveKeyConfigured:false,liveWebhookSecretConfigured:false},events:[]},{headers:{"Cache-Control":"no-store"}});
  const [settings,secrets,lastEvents]=await Promise.all([readSettings(database),env(),database.prepare("SELECT id,provider_event_id,event_type,mode,created_at,processed_at FROM navixa_billing_events ORDER BY created_at DESC LIMIT 12").all<BillingEvent>()]);
  return NextResponse.json({settings,secrets:safeStatus(secrets),events:lastEvents.results},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as {provider?:unknown;mode?:unknown;publicCheckout?:unknown;testWebhookEnabled?:unknown;livePaymentsEnabled?:unknown};
  const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});
  const current=await readSettings(database),secrets=await env();
  const next={
    provider:clean(body.provider,24)||current.provider,
    mode:clean(body.mode,12)||current.mode,
    public_checkout:String(flag(body.publicCheckout)),
    test_webhook_enabled:String(flag(body.testWebhookEnabled)),
    live_payments_enabled:String(flag(body.livePaymentsEnabled)),
  };
  if(next.provider!=="moyasar"||!["test","live"].includes(next.mode))return NextResponse.json({error:"إعداد بوابة الدفع غير صالح"},{status:400});
  if(next.public_checkout==="true"&&next.live_payments_enabled!=="true")return NextResponse.json({error:"لا يمكن إظهار الدفع للزوار قبل تفعيل الوضع الحي من الإدارة"},{status:400});
  if(next.live_payments_enabled==="true"&&next.mode!=="live")return NextResponse.json({error:"فعّل وضع الحي أولًا قبل فتح الدفع الحي"},{status:400});
  if(next.live_payments_enabled==="true"&&(!secrets.MOYASAR_LIVE_SECRET_KEY||!secrets.MOYASAR_LIVE_WEBHOOK_SECRET))return NextResponse.json({error:"مفاتيح الدفع الحي غير مضافة بعد، لذلك بقي النظام مقفلًا"},{status:409});
  const now=new Date().toISOString();
  for(const key of settingKeys)await database.prepare("INSERT INTO navixa_billing_settings (setting_key,setting_value,updated_at) VALUES (?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at").bind(key,next[key],now).run();
  return NextResponse.json({ok:true,message:next.public_checkout==="true"?"تم تجهيز ظهور الدفع العام":next.mode==="test"?"تم حفظ إعدادات الاختبار مع إبقاء الدفع العام مخفيًا":"تم حفظ إعدادات الدفع"},{headers:{"Cache-Control":"no-store"}});
}

import { NextResponse } from "next/server.js";
import {ADMIN_SESSION_COOKIE,isTrustedSameOriginRequest,readCookie,resolveAdminJwtSecret,verifyAdminSessionToken} from "../../../../worker/adminAuth.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};
type BillingSetting={setting_key:string;setting_value:string};
type BillingEvent={id:string;provider_event_id:string;event_type:string;mode:string;created_at:string;processed_at:string};
type Env=Record<string,string|undefined>;

const settingKeys=["provider","mode","public_checkout","test_webhook_enabled","live_payments_enabled","card_mada_enabled","visa_enabled","mastercard_enabled","apple_pay_enabled","stc_pay_enabled","samsung_pay_enabled","tamara_enabled","tamara_sandbox_enabled","telr_enabled","telr_sandbox_enabled"] as const;
type SettingKey=(typeof settingKeys)[number];
const defaults:Record<SettingKey,string>={provider:"moyasar",mode:"test",public_checkout:"false",test_webhook_enabled:"false",live_payments_enabled:"false",card_mada_enabled:"true",visa_enabled:"true",mastercard_enabled:"true",apple_pay_enabled:"false",stc_pay_enabled:"false",samsung_pay_enabled:"false",tamara_enabled:"false",tamara_sandbox_enabled:"true",telr_enabled:"false",telr_sandbox_enabled:"true"};
const clean=(value:unknown,limit:number)=>typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,limit):"";
const flag=(value:unknown)=>value===true||value==="true";

async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}
async function env():Promise<Env>{try{return (await import("cloudflare:workers") as {env?:Env}).env||{}}catch{return globalThis as Env}}
async function allowed(request:Request,requireSameOrigin=false){const secret=await resolveAdminJwtSecret();if(!secret)return false;if(requireSameOrigin&&!isTrustedSameOriginRequest(request))return false;return Boolean(await verifyAdminSessionToken(readCookie(request,ADMIN_SESSION_COOKIE),secret));}
async function schema(database:D1Database){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_billing_settings (setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_billing_events (id TEXT PRIMARY KEY,provider_event_id TEXT NOT NULL UNIQUE,subscriber_id TEXT NOT NULL DEFAULT '',event_type TEXT NOT NULL,mode TEXT NOT NULL DEFAULT 'test',payload_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL,processed_at TEXT NOT NULL DEFAULT '')").run();
  const now=new Date().toISOString();
  for(const key of settingKeys)await database.prepare("INSERT OR IGNORE INTO navixa_billing_settings (setting_key,setting_value,updated_at) VALUES (?,?,?)").bind(key,defaults[key],now).run();
}
async function readSettings(database:D1Database){await schema(database);const rows=await database.prepare("SELECT setting_key,setting_value FROM navixa_billing_settings").all<BillingSetting>();const settings={...defaults};for(const row of rows.results)if(settingKeys.includes(row.setting_key as SettingKey))settings[row.setting_key as SettingKey]=row.setting_value;return settings;}
function safeStatus(secrets:Env){return {testPublishableKeyConfigured:Boolean(secrets.MOYASAR_TEST_PUBLISHABLE_KEY),testKeyConfigured:Boolean(secrets.MOYASAR_TEST_SECRET_KEY),testWebhookSecretConfigured:Boolean(secrets.MOYASAR_TEST_WEBHOOK_SECRET),livePublishableKeyConfigured:Boolean(secrets.MOYASAR_LIVE_PUBLISHABLE_KEY),liveKeyConfigured:Boolean(secrets.MOYASAR_LIVE_SECRET_KEY),liveWebhookSecretConfigured:Boolean(secrets.MOYASAR_LIVE_WEBHOOK_SECRET),tamaraApiUrlConfigured:Boolean(secrets.TAMARA_API_URL),tamaraTestKeyConfigured:Boolean(secrets.TAMARA_TEST_API_TOKEN),tamaraLiveKeyConfigured:Boolean(secrets.TAMARA_LIVE_API_TOKEN),tamaraWebhookSecretConfigured:Boolean(secrets.TAMARA_WEBHOOK_SECRET),telrStoreIdConfigured:Boolean(secrets.TELR_STORE_ID),telrTestKeyConfigured:Boolean(secrets.TELR_TEST_AUTH_KEY),telrLiveKeyConfigured:Boolean(secrets.TELR_LIVE_AUTH_KEY),telrWebhookSecretConfigured:Boolean(secrets.TELR_WEBHOOK_SECRET),telrAdminEnabled:secrets.NAVIXA_TELR_ENABLED==="true"};}

export async function GET(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({settings:defaults,secrets:{testPublishableKeyConfigured:false,testKeyConfigured:false,testWebhookSecretConfigured:false,livePublishableKeyConfigured:false,liveKeyConfigured:false,liveWebhookSecretConfigured:false},events:[]},{headers:{"Cache-Control":"no-store"}});
  const [settings,secrets,lastEvents]=await Promise.all([readSettings(database),env(),database.prepare("SELECT id,provider_event_id,event_type,mode,created_at,processed_at FROM navixa_billing_events ORDER BY created_at DESC LIMIT 12").all<BillingEvent>()]);
  return NextResponse.json({settings,secrets:safeStatus(secrets),events:lastEvents.results},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
  if(!await allowed(request,true))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as {provider?:unknown;mode?:unknown;publicCheckout?:unknown;testWebhookEnabled?:unknown;livePaymentsEnabled?:unknown;cardMadaEnabled?:unknown;visaEnabled?:unknown;mastercardEnabled?:unknown;applePayEnabled?:unknown;stcPayEnabled?:unknown;samsungPayEnabled?:unknown;tamaraEnabled?:unknown;tamaraSandboxEnabled?:unknown;telrEnabled?:unknown;telrSandboxEnabled?:unknown};
  const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});
  const current=await readSettings(database),secrets=await env();
  const next={
    provider:clean(body.provider,24)||current.provider,
    mode:clean(body.mode,12)||current.mode,
    public_checkout:String(flag(body.publicCheckout)),
    test_webhook_enabled:String(flag(body.testWebhookEnabled)),
    live_payments_enabled:String(flag(body.livePaymentsEnabled)),
    card_mada_enabled:String(flag(body.cardMadaEnabled)),
    visa_enabled:String(flag(body.visaEnabled)),
    mastercard_enabled:String(flag(body.mastercardEnabled)),
    apple_pay_enabled:String(flag(body.applePayEnabled)),
    stc_pay_enabled:String(flag(body.stcPayEnabled)),
    samsung_pay_enabled:String(flag(body.samsungPayEnabled)),
    tamara_enabled:String(flag(body.tamaraEnabled)),
    tamara_sandbox_enabled:String(flag(body.tamaraSandboxEnabled)),
    telr_enabled:String(flag(body.telrEnabled)),
    telr_sandbox_enabled:String(flag(body.telrSandboxEnabled)),
  };
  if(next.provider!=="moyasar"||!["test","live"].includes(next.mode))return NextResponse.json({error:"إعداد بوابة الدفع غير صالح"},{status:400});
  if(next.public_checkout==="true"&&next.live_payments_enabled!=="true")return NextResponse.json({error:"لا يمكن إظهار الدفع للزوار قبل تفعيل الوضع الحي من الإدارة"},{status:400});
  if(next.live_payments_enabled==="true"&&next.mode!=="live")return NextResponse.json({error:"فعّل وضع الحي أولًا قبل فتح الدفع الحي"},{status:400});
  if(next.live_payments_enabled==="true"&&(!secrets.MOYASAR_LIVE_PUBLISHABLE_KEY||!secrets.MOYASAR_LIVE_SECRET_KEY||!secrets.MOYASAR_LIVE_WEBHOOK_SECRET))return NextResponse.json({error:"مفتاح الدفع العام أو السري أو توقيع Webhook غير مضاف بعد، لذلك بقي النظام مقفلًا"},{status:409});
  if(next.card_mada_enabled!=="true"&&next.visa_enabled!=="true"&&next.mastercard_enabled!=="true"&&next.apple_pay_enabled!=="true"&&next.stc_pay_enabled!=="true"&&next.samsung_pay_enabled!=="true"&&next.tamara_enabled!=="true")return NextResponse.json({error:"فعّل وسيلة دفع واحدة على الأقل قبل حفظ الإعدادات"},{status:400});
  if((next.apple_pay_enabled==="true"||next.stc_pay_enabled==="true"||next.samsung_pay_enabled==="true")&&(next.mode!=="live"||next.live_payments_enabled!=="true"))return NextResponse.json({error:"فعّل وضع الحي ومعالجة الدفع الحي أولًا قبل تجهيز طرق الدفع الإضافية"},{status:400});
  const now=new Date().toISOString();
  for(const key of settingKeys)await database.prepare("INSERT INTO navixa_billing_settings (setting_key,setting_value,updated_at) VALUES (?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at").bind(key,next[key],now).run();
  return NextResponse.json({ok:true,message:next.public_checkout==="true"?"تم تجهيز ظهور الدفع العام":next.mode==="test"?"تم حفظ إعدادات الاختبار مع إبقاء الدفع العام مخفيًا":"تم حفظ إعدادات الدفع"},{headers:{"Cache-Control":"no-store"}});
}

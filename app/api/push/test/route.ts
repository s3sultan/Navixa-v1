import { NextResponse } from "next/server.js";
import webpush from "web-push";
import { isTrustedSameOriginRequest } from "../../../../worker/adminAuth.ts";
import { readRuntimeSecrets } from "../../../../worker/runtimeEnv.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;run:()=>Promise<unknown>;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>};
type D1Database={prepare:(sql:string)=>D1Statement};
type TestRequest={endpoint?:unknown};
type Subscription={endpoint:string;p256dh:string;auth:string};

async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}
async function schema(database:D1Database){await database.prepare("CREATE TABLE IF NOT EXISTS navixa_push_test_deliveries (endpoint TEXT PRIMARY KEY, sent_at TEXT NOT NULL)").run()}

export async function POST(request:Request){
  if(!isTrustedSameOriginRequest(request))return NextResponse.json({error:"مصدر الطلب غير موثوق"},{status:403,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as TestRequest;
  const endpoint=typeof body.endpoint==="string"?body.endpoint.trim():"";
  if(!/^https:\/\//i.test(endpoint))return NextResponse.json({error:"اشتراك Push غير صالح"},{status:400,headers:{"Cache-Control":"no-store"}});
  const secrets=await readRuntimeSecrets();
  if(!secrets.VAPID_PUBLIC_KEY||!secrets.VAPID_PRIVATE_KEY||!secrets.VAPID_SUBJECT)return NextResponse.json({error:"تنبيهات Push غير مفعلة"},{status:503,headers:{"Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});
  await schema(database);
  const existing=await database.prepare("SELECT sent_at FROM navixa_push_test_deliveries WHERE endpoint=? LIMIT 1").bind(endpoint).all<{sent_at:string}>();
  const previous=Date.parse(existing.results[0]?.sent_at||"");
  if(Number.isFinite(previous)&&Date.now()-previous<60_000)return NextResponse.json({error:"انتظر دقيقة قبل إعادة الاختبار"},{status:429,headers:{"Cache-Control":"no-store"}});
  const subscription=await database.prepare("SELECT endpoint,p256dh,auth FROM navixa_push_subscriptions WHERE endpoint=? AND enabled=1 LIMIT 1").bind(endpoint).all<Subscription>();
  const row=subscription.results[0];if(!row)return NextResponse.json({error:"فعّل Push لهذا الجهاز أولًا"},{status:400,headers:{"Cache-Control":"no-store"}});
  try{
    webpush.setVapidDetails(secrets.VAPID_SUBJECT,secrets.VAPID_PUBLIC_KEY,secrets.VAPID_PRIVATE_KEY);
    await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify({title:"NAVIXA · اختبار تنبيه",body:"تم تفعيل تنبيهات مبارياتك بنجاح.",tag:"navixa-push-test",data:{url:"/"}}),{TTL:120,urgency:"high",topic:"navixa-test"});
    await database.prepare("INSERT INTO navixa_push_test_deliveries (endpoint,sent_at) VALUES (?,?) ON CONFLICT(endpoint) DO UPDATE SET sent_at=excluded.sent_at").bind(endpoint,new Date().toISOString()).run();
    return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  }catch(error){const status=error instanceof webpush.WebPushError?error.statusCode:0;if(status===404||status===410)await database.prepare("DELETE FROM navixa_push_subscriptions WHERE endpoint=?").bind(endpoint).run();return NextResponse.json({error:"تعذر إرسال اختبار Push؛ فعّل الاشتراك من جديد"},{status:502,headers:{"Cache-Control":"no-store"}})}
}

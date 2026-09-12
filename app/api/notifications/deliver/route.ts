import { NextResponse } from "next/server.js";
import webpush from "web-push";
import { isTrustedSameOriginRequest } from "../../../../worker/adminAuth.ts";
import { readRuntimeSecrets } from "../../../../worker/runtimeEnv.ts";
import { resolveUserSession, type D1Database as UserD1Database } from "../../../../worker/userAuth.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;run:()=>Promise<unknown>;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>};
type D1Database=UserD1Database&{prepare:(sql:string)=>D1Statement};
type Subscription={endpoint:string;p256dh:string;auth:string};
type AlertType="name"|"screen"|"focus"|"task"|"water"|"break"|"eye"|"account"|"test";
type DeliveryPayload={type?:unknown;detail?:unknown;url?:unknown};
const allowedTypes=new Set<AlertType>(["name","screen","focus","task","water","break","eye","account","test"]);

async function db():Promise<D1Database|null>{
  try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}
  catch{return (globalThis as {DB?:D1Database}).DB||null}
}

async function schema(database:D1Database){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_notification_push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_navixa_notification_push_user ON navixa_notification_push_subscriptions(user_id,enabled)").run();
}

const messageFor=(type:AlertType,detail:string)=>{
  if(type==="name")return {title:"NAVIXA · سمعنا اسمك",body:detail?`تم سماع الاسم: ${detail}`:"تم سماع اسمك في المحاضرة أو الاجتماع."};
  if(type==="screen")return {title:"NAVIXA · تغيّر في الشاشة",body:detail||"تم رصد تغيّر مهم داخل المنطقة التي تتابعها."};
  if(type==="focus")return {title:"NAVIXA · انتهت جلسة التركيز",body:detail||"انتهى وقت التركيز الذي حددته."};
  if(type==="task")return {title:"NAVIXA · تنبيه مهمة",body:detail||"لديك تحديث متعلق بإحدى مهامك."};
  if(type==="water")return {title:"NAVIXA · تذكير ماء",body:detail||"خذ رشفة ماء إذا احتجت."};
  if(type==="break")return {title:"NAVIXA · وقت حركة",body:detail||"حان وقت استراحة قصيرة وتحريك الجسم."};
  if(type==="eye")return {title:"NAVIXA · راحة العين",body:detail||"أرح عينيك قليلًا عن الشاشة."};
  if(type==="account")return {title:"NAVIXA · حسابك",body:detail||"لديك تحديث مهم متعلق بحسابك."};
  return {title:"NAVIXA · اختبار تنبيه",body:"تنبيهات NAVIXA على هذا الجهاز تعمل بنجاح."};
};

export async function POST(request:Request){
  if(!isTrustedSameOriginRequest(request))return NextResponse.json({error:"مصدر الطلب غير موثوق"},{status:403,headers:{"Cache-Control":"no-store"}});
  const database=await db();
  if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});
  const session=await resolveUserSession(request,database).catch(()=>null);
  if(!session?.userId)return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as DeliveryPayload;
  const rawType=typeof body.type==="string"?body.type:"";
  if(!allowedTypes.has(rawType as AlertType))return NextResponse.json({error:"نوع التنبيه غير صالح"},{status:400,headers:{"Cache-Control":"no-store"}});
  const type=rawType as AlertType;
  const detail=typeof body.detail==="string"?body.detail.replace(/\s+/g," ").trim().slice(0,180):"";
  const url=typeof body.url==="string"&&body.url.startsWith("/")&&!body.url.startsWith("//")?body.url.slice(0,240):"/";
  const secrets=await readRuntimeSecrets();
  if(!secrets.VAPID_PUBLIC_KEY||!secrets.VAPID_PRIVATE_KEY||!secrets.VAPID_SUBJECT)return NextResponse.json({error:"تنبيهات Push غير مفعلة"},{status:503,headers:{"Cache-Control":"no-store"}});
  await schema(database);
  const subscriptions=await database.prepare("SELECT endpoint,p256dh,auth FROM navixa_notification_push_subscriptions WHERE user_id=? AND enabled=1").bind(session.userId).all<Subscription>();
  if(!subscriptions.results.length)return NextResponse.json({ok:true,delivered:0},{headers:{"Cache-Control":"no-store"}});
  webpush.setVapidDetails(secrets.VAPID_SUBJECT,secrets.VAPID_PUBLIC_KEY,secrets.VAPID_PRIVATE_KEY);
  const message=messageFor(type,detail);
  let delivered=0;
  for(const row of subscriptions.results){
    try{
      await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify({...message,url,type}),{TTL:type==="name"||type==="screen"?120:900,urgency:type==="name"||type==="screen"?"high":"normal",topic:`navixa-${type}`});
      delivered+=1;
    }catch(error){
      const status=error instanceof webpush.WebPushError?error.statusCode:0;
      if(status===404||status===410)await database.prepare("DELETE FROM navixa_notification_push_subscriptions WHERE endpoint=? AND user_id=?").bind(row.endpoint,session.userId).run();
    }
  }
  return NextResponse.json({ok:true,delivered},{headers:{"Cache-Control":"no-store"}});
}

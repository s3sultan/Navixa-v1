import { NextResponse } from "next/server.js";
import { isTrustedSameOriginRequest } from "../../../../worker/adminAuth.ts";
import { sendFeaturePush, type FeaturePushKind } from "../../../../worker/generalPush.ts";
import { resolveUserSession, type D1Database } from "../../../../worker/userAuth.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;run:()=>Promise<unknown>;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>};
type PushDatabase=D1Database&{prepare:(sql:string)=>D1Statement};
type PushSubscriptionRow={endpoint:string;p256dh:string;auth:string};
type EventPayload={kind?:unknown;name?:unknown;mode?:unknown;detail?:unknown};

type SupportedEventKind="name_heard"|"screen_watch";

const clean=(value:unknown,max:number)=>typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,max):"";

async function db():Promise<PushDatabase|null>{
  try{return (await import("cloudflare:workers") as {env?:{DB?:PushDatabase}}).env?.DB||null}
  catch{return (globalThis as {DB?:PushDatabase}).DB||null}
}

function buildNotification(body:EventPayload):{kind:FeaturePushKind;title:string;body:string;url:string;tag:string}|null{
  if(body.kind==="name_heard"){
    const name=clean(body.name,80);
    if(!name)return null;
    return {kind:"name_heard",title:"NAVIXA سمع اسمك",body:`تم سماع الاسم (${name})`,url:"/",tag:"navixa-name-heard"};
  }
  if(body.kind==="screen_watch"){
    const mode=body.mode==="ocr"?"ocr":"change";
    const detail=clean(body.detail,100);
    const message=mode==="ocr"
      ? `ظهر نص مهم في المنطقة التي تتابعها${detail?`: ${detail}`:""}`
      : `تم رصد تغيّر واضح في المنطقة التي تتابعها${detail?` (${detail})`:""}`;
    return {kind:"screen_watch",title:"تنبيه متابعة الشاشة",body:message,url:"/",tag:`navixa-screen-${mode}`};
  }
  return null;
}

export async function POST(request:Request){
  if(!isTrustedSameOriginRequest(request))return NextResponse.json({error:"مصدر الطلب غير موثوق"},{status:403,headers:{"Cache-Control":"no-store"}});
  const database=await db();
  if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});
  const session=await resolveUserSession(request,database).catch(()=>null);
  if(!session)return NextResponse.json({error:"سجّل الدخول لربط التنبيه بأجهزتك"},{status:401,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as EventPayload;
  const notification=buildNotification(body);
  if(!notification)return NextResponse.json({error:"حدث التنبيه غير صالح"},{status:400,headers:{"Cache-Control":"no-store"}});

  const rows=await database.prepare("SELECT endpoint,p256dh,auth FROM navixa_push_subscriptions WHERE user_id=? AND enabled=1 ORDER BY updated_at DESC LIMIT 8").bind(session.userId).all<PushSubscriptionRow>();
  let delivered=0;
  for(const subscription of rows.results){
    const result=await sendFeaturePush(subscription,{...notification,urgency:"high",ttl:300});
    if(result.ok){delivered+=1;continue}
    if(result.status===404||result.status===410){
      await database.prepare("DELETE FROM navixa_push_subscriptions WHERE endpoint=? AND user_id=?").bind(subscription.endpoint,session.userId).run();
    }
  }
  return NextResponse.json({ok:true,delivered},{headers:{"Cache-Control":"no-store"}});
}

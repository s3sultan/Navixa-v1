import { NextResponse } from "next/server.js";
import { isTrustedSameOriginRequest } from "../../../../../worker/adminAuth.ts";
import { resolveUserSession, type D1Database as UserD1Database } from "../../../../../worker/userAuth.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;run:()=>Promise<unknown>;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>};
type D1Database=UserD1Database&{prepare:(sql:string)=>D1Statement};
type SubscriptionPayload={endpoint?:unknown;keys?:{p256dh?:unknown;auth?:unknown}};

async function db():Promise<D1Database|null>{
  try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}
  catch{return (globalThis as {DB?:D1Database}).DB||null}
}

async function schema(database:D1Database){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_notification_push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_navixa_notification_push_user ON navixa_notification_push_subscriptions(user_id,enabled)").run();
}

export async function POST(request:Request){
  if(!isTrustedSameOriginRequest(request))return NextResponse.json({error:"مصدر الطلب غير موثوق"},{status:403,headers:{"Cache-Control":"no-store"}});
  const database=await db();
  if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});
  const session=await resolveUserSession(request,database).catch(()=>null);
  if(!session?.userId)return NextResponse.json({error:"سجّل الدخول لتفعيل تنبيهات الجهاز"},{status:401,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as SubscriptionPayload;
  const endpoint=typeof body.endpoint==="string"?body.endpoint.trim():"";
  const p256dh=typeof body.keys?.p256dh==="string"?body.keys.p256dh.trim():"";
  const auth=typeof body.keys?.auth==="string"?body.keys.auth.trim():"";
  if(!/^https:\/\//i.test(endpoint)||p256dh.length<16||auth.length<8)return NextResponse.json({error:"اشتراك Push غير صالح"},{status:400,headers:{"Cache-Control":"no-store"}});
  await schema(database);
  const now=new Date().toISOString();
  await database.prepare("INSERT INTO navixa_notification_push_subscriptions (id,user_id,endpoint,p256dh,auth,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,enabled=1,updated_at=excluded.updated_at").bind(crypto.randomUUID(),session.userId,endpoint,p256dh,auth,1,now,now).run();
  return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}

export async function DELETE(request:Request){
  if(!isTrustedSameOriginRequest(request))return NextResponse.json({error:"مصدر الطلب غير موثوق"},{status:403,headers:{"Cache-Control":"no-store"}});
  const database=await db();
  if(!database)return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  const session=await resolveUserSession(request,database).catch(()=>null);
  if(!session?.userId)return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as {endpoint?:unknown};
  const endpoint=typeof body.endpoint==="string"?body.endpoint.trim():"";
  if(!/^https:\/\//i.test(endpoint))return NextResponse.json({error:"اشتراك غير صالح"},{status:400,headers:{"Cache-Control":"no-store"}});
  await schema(database);
  await database.prepare("DELETE FROM navixa_notification_push_subscriptions WHERE user_id=? AND endpoint=?").bind(session.userId,endpoint).run();
  return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}

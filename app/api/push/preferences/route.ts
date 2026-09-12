import {NextResponse} from "next/server.js";
import {resolveUserSession,trustedUserMutation,type D1Database} from "../../../../worker/userAuth.ts";
import {ensureUserPushPreferenceSchema,readUserPushPreference,writeUserPushPreference,type PushPreferenceCategory} from "../../../../worker/userPushPreferences.ts";

type Db=D1Database;
const CATEGORIES:PushPreferenceCategory[]=["adhan","schedule"];
async function db():Promise<Db|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:Db}}).env?.DB||null}catch{return (globalThis as {DB?:Db}).DB||null}}
const reply=(body:Record<string,unknown>,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store",Vary:"Cookie"}});
const validCategory=(value:unknown):value is PushPreferenceCategory=>typeof value==="string"&&CATEGORIES.includes(value as PushPreferenceCategory);

export async function GET(request:Request){
  const database=await db();if(!database)return reply({error:"التخزين غير مهيأ"},503);
  const session=await resolveUserSession(request,database);if(!session)return reply({error:"سجّل الدخول أولًا"},401);
  await ensureUserPushPreferenceSchema(database);
  const preferences=await Promise.all(CATEGORIES.map(category=>readUserPushPreference(database,session.userId,category)));
  return reply({preferences});
}

export async function POST(request:Request){
  if(!trustedUserMutation(request))return reply({error:"مصدر الطلب غير موثوق"},403);
  const database=await db();if(!database)return reply({error:"التخزين غير مهيأ"},503);
  const session=await resolveUserSession(request,database);if(!session)return reply({error:"سجّل الدخول أولًا"},401);
  const body=await request.json().catch(()=>({})) as {category?:unknown;enabled?:unknown;snoozeMinutes?:unknown;resume?:unknown};
  if(!validCategory(body.category)||typeof body.enabled!=="boolean")return reply({error:"إعداد Push غير صالح"},400);
  let snoozedUntil="";
  if(body.resume!==true){
    const minutes=Number(body.snoozeMinutes||0);
    if(Number.isFinite(minutes)&&minutes>0){
      if(minutes>7*24*60)return reply({error:"مدة الغفوة طويلة جدًا"},400);
      snoozedUntil=new Date(Date.now()+Math.round(minutes)*60_000).toISOString();
    }
  }
  await writeUserPushPreference(database,session.userId,body.category,body.enabled,snoozedUntil);
  return reply({ok:true,preference:{category:body.category,enabled:body.enabled,snoozedUntil}});
}

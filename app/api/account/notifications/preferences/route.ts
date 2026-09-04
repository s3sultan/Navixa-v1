import {NextResponse} from "next/server.js";
import {resolveUserSession,trustedUserMutation,type D1Database} from "../../../../../worker/userAuth.ts";
import {ALERT_POLICY_TYPES,type AlertPolicyType} from "../../../../../worker/alertPolicy.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;run:()=>Promise<unknown>;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>};
type Database=D1Database&{prepare:(sql:string)=>D1Statement};
type Preference={screen:boolean;telegram:boolean;push:boolean};
type PreferenceMap=Record<AlertPolicyType,Preference>;

async function db():Promise<Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:Database}}).env?.DB||null}catch{return (globalThis as {DB?:Database}).DB||null}}
const reply=(body:Record<string,unknown>,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
const defaults=():PreferenceMap=>Object.fromEntries(ALERT_POLICY_TYPES.map(type=>[type,{screen:true,telegram:true,push:true}])) as PreferenceMap;
async function schema(database:Database){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_user_notification_preferences (user_id TEXT NOT NULL, notification_type TEXT NOT NULL, screen_enabled INTEGER NOT NULL DEFAULT 1, telegram_enabled INTEGER NOT NULL DEFAULT 1, push_enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,notification_type))").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_user_telegram_preferences (user_id TEXT NOT NULL, notification_type TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,notification_type))").run();
}
async function readPreferences(database:Database,userId:string){
  await schema(database);
  const rows=await database.prepare("SELECT notification_type,screen_enabled,telegram_enabled,push_enabled FROM navixa_user_notification_preferences WHERE user_id=?").bind(userId).all<{notification_type:string;screen_enabled:number;telegram_enabled:number;push_enabled:number}>();
  const result=defaults();
  for(const row of rows.results){if(!ALERT_POLICY_TYPES.includes(row.notification_type as AlertPolicyType))continue;result[row.notification_type as AlertPolicyType]={screen:row.screen_enabled===1,telegram:row.telegram_enabled===1,push:row.push_enabled===1}}
  return result;
}
async function writeOne(database:Database,userId:string,type:AlertPolicyType,value:Preference){
  const now=new Date().toISOString();
  await database.prepare("INSERT INTO navixa_user_notification_preferences(user_id,notification_type,screen_enabled,telegram_enabled,push_enabled,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,notification_type) DO UPDATE SET screen_enabled=excluded.screen_enabled,telegram_enabled=excluded.telegram_enabled,push_enabled=excluded.push_enabled,updated_at=excluded.updated_at").bind(userId,type,value.screen?1:0,value.telegram?1:0,value.push?1:0,now).run();
  await database.prepare("INSERT INTO navixa_user_telegram_preferences(user_id,notification_type,enabled,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,notification_type) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at").bind(userId,type,value.telegram?1:0,now).run();
}

export async function GET(request:Request){
  const database=await db();if(!database)return reply({enabled:false},503);
  const session=await resolveUserSession(request,database);if(!session)return reply({enabled:false},401);
  try{return reply({enabled:true,preferences:await readPreferences(database,session.userId)})}catch{return reply({error:"تعذر قراءة تفضيلات التنبيهات"},500)}
}

export async function POST(request:Request){
  if(!trustedUserMutation(request))return reply({error:"مصدر الطلب غير موثوق"},403);
  const database=await db();if(!database)return reply({error:"التخزين غير مهيأ"},503);
  const session=await resolveUserSession(request,database);if(!session)return reply({error:"سجّل الدخول أولًا"},401);
  await schema(database);
  const body=await request.json().catch(()=>({})) as {all?:unknown;enabled?:unknown;type?:unknown;screen?:unknown;telegram?:unknown;push?:unknown};
  try{
    if(body.all===true){
      if(typeof body.enabled!=="boolean")return reply({error:"قيمة التفعيل غير صالحة"},400);
      for(const type of ALERT_POLICY_TYPES)await writeOne(database,session.userId,type,{screen:body.enabled,telegram:body.enabled,push:body.enabled});
      return reply({ok:true,preferences:await readPreferences(database,session.userId)});
    }
    if(typeof body.type!=="string"||!ALERT_POLICY_TYPES.includes(body.type as AlertPolicyType))return reply({error:"نوع التنبيه غير صالح"},400);
    const current=(await readPreferences(database,session.userId))[body.type as AlertPolicyType];
    const value:Preference={screen:typeof body.screen==="boolean"?body.screen:current.screen,telegram:typeof body.telegram==="boolean"?body.telegram:current.telegram,push:typeof body.push==="boolean"?body.push:current.push};
    await writeOne(database,session.userId,body.type as AlertPolicyType,value);
    return reply({ok:true,preference:value});
  }catch{return reply({error:"تعذر حفظ تفضيلات التنبيهات"},500)}
}

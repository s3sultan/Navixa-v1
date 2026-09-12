import {NextResponse} from "next/server.js";
import {resolveUserSession,trustedUserMutation,type D1Database} from "../../../../worker/userAuth.ts";

type Stmt={bind:(...values:unknown[])=>Stmt;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type Db=D1Database&{prepare:(sql:string)=>Stmt};
async function db():Promise<Db|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:Db}}).env?.DB||null}catch{return (globalThis as {DB?:Db}).DB||null}}
const reply=(body:Record<string,unknown>,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store",Vary:"Cookie"}});
async function ensureSchema(database:Db){await database.prepare("CREATE TABLE IF NOT EXISTS navixa_prayer_alert_settings (user_id TEXT PRIMARY KEY,location_mode TEXT NOT NULL DEFAULT 'coords',city TEXT NOT NULL DEFAULT '',country TEXT NOT NULL DEFAULT '',latitude REAL,longitude REAL,label TEXT NOT NULL DEFAULT '',adjustments_json TEXT NOT NULL DEFAULT '{}',iqama_json TEXT NOT NULL DEFAULT '{}',updated_at TEXT NOT NULL)").run()}

export async function GET(request:Request){const database=await db();if(!database)return reply({error:"التخزين غير مهيأ"},503);const session=await resolveUserSession(request,database);if(!session)return reply({error:"سجّل الدخول أولًا"},401);await ensureSchema(database);const row=(await database.prepare("SELECT location_mode,city,country,latitude,longitude,label,adjustments_json,iqama_json FROM navixa_prayer_alert_settings WHERE user_id=? LIMIT 1").bind(session.userId).all()).results[0]||null;return reply({settings:row})}

export async function POST(request:Request){
  if(!trustedUserMutation(request))return reply({error:"مصدر الطلب غير موثوق"},403);
  const database=await db();if(!database)return reply({error:"التخزين غير مهيأ"},503);
  const session=await resolveUserSession(request,database);if(!session)return reply({error:"سجّل الدخول أولًا"},401);
  const body=await request.json().catch(()=>({})) as {mode?:unknown;city?:unknown;country?:unknown;lat?:unknown;lng?:unknown;label?:unknown;adjustments?:unknown};
  const mode=body.mode==="city"?"city":body.mode==="coords"?"coords":"";
  const city=typeof body.city==="string"?body.city.trim().slice(0,80):"";
  const country=typeof body.country==="string"?body.country.trim().slice(0,80):"";
  const lat=Number(body.lat),lng=Number(body.lng);
  const label=typeof body.label==="string"?body.label.trim().slice(0,120):"";
  const coordsValid=mode==="coords"&&Number.isFinite(lat)&&lat>=-90&&lat<=90&&Number.isFinite(lng)&&lng>=-180&&lng<=180;
  const cityValid=mode==="city"&&city.length>=2&&country.length>=2;
  if(!coordsValid&&!cityValid)return reply({error:"موقع الصلاة غير صالح"},400);
  const adjustments=body.adjustments&&typeof body.adjustments==="object"?body.adjustments:{};
  const safeAdjustments:Record<string,number>={};
  for(const key of ["Fajr","Dhuhr","Asr","Maghrib","Isha"]){const value=Number((adjustments as Record<string,unknown>)[key]);if(Number.isFinite(value)&&value>=-30&&value<=30)safeAdjustments[key]=Math.round(value)}
  await ensureSchema(database);const now=new Date().toISOString();
  await database.prepare("INSERT INTO navixa_prayer_alert_settings(user_id,location_mode,city,country,latitude,longitude,label,adjustments_json,iqama_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET location_mode=excluded.location_mode,city=excluded.city,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,label=excluded.label,adjustments_json=excluded.adjustments_json,updated_at=excluded.updated_at").bind(session.userId,mode,city,country,coordsValid?lat:null,coordsValid?lng:null,label,JSON.stringify(safeAdjustments),"{}",now).run();
  return reply({ok:true});
}

import { NextResponse } from "next/server.js";
import { resolveUserSession, trustedUserMutation, type D1Database } from "../../../../worker/userAuth.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type Database=D1Database&{prepare:(sql:string)=>D1Statement};
type WorkerBinding={env?:{DB?:Database}};
type Body={location?:unknown;adjustments?:unknown;iqama?:unknown};
type Location={mode:"coords"|"city";lat?:number;lng?:number;city?:string;country?:string;label?:string};
const prayers=new Set(["Fajr","Dhuhr","Asr","Maghrib","Isha"]);

async function database():Promise<Database|null>{try{return (await import("cloudflare:workers") as WorkerBinding).env?.DB||null}catch{return (globalThis as {DB?:Database}).DB||null}}
function reply(body:Record<string,unknown>,status=200){return NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","Vary":"Cookie"}})}
function locationOf(value:unknown):Location|null{
  if(!value||typeof value!=="object")return null;const input=value as Record<string,unknown>;
  if(input.mode==="coords"&&typeof input.lat==="number"&&Number.isFinite(input.lat)&&input.lat>=-90&&input.lat<=90&&typeof input.lng==="number"&&Number.isFinite(input.lng)&&input.lng>=-180&&input.lng<=180)return{mode:"coords",lat:input.lat,lng:input.lng,label:typeof input.label==="string"?input.label.slice(0,120):""};
  if(input.mode==="city"&&typeof input.city==="string"&&input.city.trim()&&typeof input.country==="string"&&input.country.trim())return{mode:"city",city:input.city.trim().slice(0,100),country:input.country.trim().slice(0,100),label:typeof input.label==="string"?input.label.slice(0,120):""};
  return null;
}
function numberMap(value:unknown,min:number,max:number){const out:Record<string,number>={};if(!value||typeof value!=="object")return out;for(const [key,raw] of Object.entries(value as Record<string,unknown>)){if(prayers.has(key)&&typeof raw==="number"&&Number.isFinite(raw))out[key]=Math.max(min,Math.min(max,Math.round(raw)))}return out}
function timeMap(value:unknown){const out:Record<string,string>={};if(!value||typeof value!=="object")return out;for(const [key,raw] of Object.entries(value as Record<string,unknown>)){if(prayers.has(key)&&typeof raw==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw))out[key]=raw}return out}

export async function GET(request:Request){const db=await database();if(!db)return reply({enabled:false},503);const session=await resolveUserSession(request,db);if(!session)return reply({enabled:false},401);const row=(await db.prepare("SELECT location_mode,city,country,latitude,longitude,label,adjustments_json,iqama_json,updated_at FROM navixa_prayer_alert_settings WHERE user_id=? LIMIT 1").bind(session.userId).all<Record<string,unknown>>()).results[0];return reply({enabled:true,settings:row||null})}

export async function POST(request:Request){if(!trustedUserMutation(request))return reply({error:"مصدر الطلب غير موثوق"},403);const db=await database();if(!db)return reply({error:"التخزين غير مهيأ"},503);const session=await resolveUserSession(request,db);if(!session)return reply({error:"سجّل الدخول أولًا"},401);const body=await request.json().catch(()=>({})) as Body;const location=locationOf(body.location);if(!location)return reply({error:"موقع الصلاة غير صالح"},400);const adjustments=numberMap(body.adjustments,-120,120),iqama=timeMap(body.iqama),now=new Date().toISOString();await db.prepare("INSERT INTO navixa_prayer_alert_settings(user_id,location_mode,city,country,latitude,longitude,label,adjustments_json,iqama_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET location_mode=excluded.location_mode,city=excluded.city,country=excluded.country,latitude=excluded.latitude,longitude=excluded.longitude,label=excluded.label,adjustments_json=excluded.adjustments_json,iqama_json=excluded.iqama_json,updated_at=excluded.updated_at").bind(session.userId,location.mode,location.city||"",location.country||"",location.lat??null,location.lng??null,location.label||"",JSON.stringify(adjustments),JSON.stringify(iqama),now).run();return reply({ok:true,updatedAt:now})}

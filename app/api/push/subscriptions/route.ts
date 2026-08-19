import { NextResponse } from "next/server.js";
import { isTrustedSameOriginRequest } from "../../../../worker/adminAuth.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};
type SubscriptionPayload={endpoint?:unknown;keys?:{p256dh?:unknown;auth?:unknown};competitions?:unknown;teams?:unknown;beforeMinutes?:unknown;beforeMinutesList?:unknown};
const allowedCompetitions=new Set(["rsl","kings-cup","gulf-cup","premier-league","la-liga","bundesliga","serie-a","ligue-1","champions-league"]);
const plainArray=(value:unknown,limit:number,maxLength:number)=>Array.isArray(value)?value.filter((item):item is string=>typeof item==="string").map(item=>item.trim()).filter(Boolean).slice(0,limit).map(item=>item.slice(0,maxLength)):[];
async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}
async function schema(database:D1Database){await database.prepare("CREATE TABLE IF NOT EXISTS navixa_push_subscriptions (id TEXT PRIMARY KEY, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, competitions_json TEXT NOT NULL DEFAULT '[]', teams_json TEXT NOT NULL DEFAULT '[]', before_minutes INTEGER NOT NULL DEFAULT 10, before_minutes_json TEXT NOT NULL DEFAULT '[]', enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)").run();try{await database.prepare("ALTER TABLE navixa_push_subscriptions ADD COLUMN before_minutes_json TEXT NOT NULL DEFAULT '[]'").run()}catch{/* Column already exists on established databases. */}}

export async function POST(request:Request){
  if(!isTrustedSameOriginRequest(request))return NextResponse.json({error:"مصدر الطلب غير موثوق"},{status:403,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as SubscriptionPayload;
  const endpoint=typeof body.endpoint==="string"?body.endpoint.trim():"";
  const p256dh=typeof body.keys?.p256dh==="string"?body.keys.p256dh.trim():"";
  const auth=typeof body.keys?.auth==="string"?body.keys.auth.trim():"";
  if(!/^https:\/\//i.test(endpoint)||p256dh.length<16||auth.length<8)return NextResponse.json({error:"اشتراك Push غير صالح"},{status:400,headers:{"Cache-Control":"no-store"}});
  const selected=Array.isArray(body.beforeMinutesList)?body.beforeMinutesList.map(Number):[Number(body.beforeMinutes)];const beforeMinutes=[...new Set(selected.filter(value=>[0,5,10,15,30].includes(value)))].sort((a,b)=>b-a);if(!beforeMinutes.length)return NextResponse.json({error:"وقت التنبيه غير صالح"},{status:400,headers:{"Cache-Control":"no-store"}});
  const competitions=plainArray(body.competitions,9,40).filter(value=>allowedCompetitions.has(value));const teams=plainArray(body.teams,12,80);const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});await schema(database);const now=new Date().toISOString();await database.prepare("INSERT INTO navixa_push_subscriptions (id,endpoint,p256dh,auth,competitions_json,teams_json,before_minutes,before_minutes_json,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,competitions_json=excluded.competitions_json,teams_json=excluded.teams_json,before_minutes=excluded.before_minutes,before_minutes_json=excluded.before_minutes_json,enabled=1,updated_at=excluded.updated_at").bind(crypto.randomUUID(),endpoint,p256dh,auth,JSON.stringify(competitions),JSON.stringify(teams),beforeMinutes[0],JSON.stringify(beforeMinutes),1,now,now).run();return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}

export async function DELETE(request:Request){
  if(!isTrustedSameOriginRequest(request))return NextResponse.json({error:"مصدر الطلب غير موثوق"},{status:403,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as {endpoint?:unknown};const endpoint=typeof body.endpoint==="string"?body.endpoint.trim():"";if(!/^https:\/\//i.test(endpoint))return NextResponse.json({error:"اشتراك غير صالح"},{status:400,headers:{"Cache-Control":"no-store"}});const database=await db();if(!database)return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});await schema(database);await database.prepare("DELETE FROM navixa_push_subscriptions WHERE endpoint=?").bind(endpoint).run();return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}

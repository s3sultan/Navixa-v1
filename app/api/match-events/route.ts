import { NextResponse } from "next/server.js";
import { isTrustedSameOriginRequest } from "../../../worker/adminAuth.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};
const allowed=new Set(["ribbon_view","fixture_open","alert_enabled"]);
const day=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh"}).format(new Date());
async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}
async function schema(database:D1Database){await database.prepare("CREATE TABLE IF NOT EXISTS navixa_match_analytics_daily (day TEXT NOT NULL, metric TEXT NOT NULL, fixture_id TEXT NOT NULL DEFAULT '', total INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,metric,fixture_id))").run()}

export async function POST(request:Request){
  if(!isTrustedSameOriginRequest(request))return NextResponse.json({error:"مصدر الطلب غير موثوق"},{status:403,headers:{"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as {event?:unknown;fixtureId?:unknown};const event=typeof body.event==="string"?body.event:"";const fixtureId=typeof body.fixtureId==="string"?body.fixtureId.trim().slice(0,120):"";if(!allowed.has(event))return NextResponse.json({error:"حدث غير صالح"},{status:400,headers:{"Cache-Control":"no-store"}});const database=await db();if(!database)return NextResponse.json({ok:true,stored:false},{headers:{"Cache-Control":"no-store"}});await schema(database);await database.prepare("INSERT INTO navixa_match_analytics_daily (day,metric,fixture_id,total) VALUES (?,?,?,1) ON CONFLICT(day,metric,fixture_id) DO UPDATE SET total=total+1").bind(day(),event,fixtureId).run();return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}

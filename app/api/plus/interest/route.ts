import { NextResponse } from "next/server.js";
import {isTrustedSameOriginRequest} from "../../../../worker/adminAuth.ts";

type D1Statement={bind:(...values:unknown[])=>D1Statement;run:()=>Promise<unknown>};
type D1Database={prepare:(sql:string)=>D1Statement};
const clean=(value:unknown,limit:number)=>typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,limit):"";
const email=(value:unknown)=>clean(value,160).toLowerCase();
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
async function db():Promise<D1Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:D1Database}}).env?.DB||null}catch{return (globalThis as {DB?:D1Database}).DB||null}}
async function schema(database:D1Database){await database.prepare("CREATE TABLE IF NOT EXISTS navixa_subscribers (id TEXT PRIMARY KEY,contact TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL DEFAULT '',plan TEXT NOT NULL DEFAULT 'trial',status TEXT NOT NULL DEFAULT 'waitlist',trial_started_at TEXT NOT NULL DEFAULT '',trial_ends_at TEXT NOT NULL DEFAULT '',subscription_ends_at TEXT NOT NULL DEFAULT '',source TEXT NOT NULL DEFAULT 'plus_page',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();}

export async function POST(request:Request){
  if(!isTrustedSameOriginRequest(request))return NextResponse.json({error:"طلب غير موثوق"},{status:403});
  const body=await request.json().catch(()=>({})) as {email?:unknown;name?:unknown};const contact=email(body.email),name=clean(body.name,80);if(!validEmail(contact))return NextResponse.json({error:"أدخل بريدًا إلكترونيًا صحيحًا"},{status:400});
  const database=await db();if(!database)return NextResponse.json({error:"خدمة قائمة الاهتمام غير متاحة الآن"},{status:503});await schema(database);const now=new Date().toISOString();
  await database.prepare("INSERT INTO navixa_subscribers (id,contact,display_name,plan,status,source,created_at,updated_at) VALUES (?, ?, ?, 'trial', 'waitlist', 'plus_page', ?, ?) ON CONFLICT(contact) DO UPDATE SET display_name=CASE WHEN excluded.display_name<>'' THEN excluded.display_name ELSE navixa_subscribers.display_name END,updated_at=excluded.updated_at").bind(crypto.randomUUID(),contact,name,now,now).run();
  return NextResponse.json({ok:true,message:"تم تسجيل اهتمامك. سنرسل لك دعوة التجربة عند فتحها."},{headers:{"Cache-Control":"no-store"}});
}

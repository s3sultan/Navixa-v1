import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE,isTrustedSameOriginRequest,readCookie,resolveAdminJwtSecret,verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";

type Statement={bind:(...values:unknown[])=>Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type Database={prepare:(sql:string)=>Statement};
const clean=(value:unknown,limit:number)=>typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,limit):"";
async function db():Promise<Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:Database}}).env?.DB||null}catch{return (globalThis as {DB?:Database}).DB||null}}
async function allowed(request:Request){const secret=await resolveAdminJwtSecret();return Boolean(secret&&isTrustedSameOriginRequest(request)&&await verifyAdminSessionToken(readCookie(request,ADMIN_SESSION_COOKIE),secret));}
async function schema(database:Database){await database.prepare("CREATE TABLE IF NOT EXISTS navixa_meeting_glossary_terms (id TEXT PRIMARY KEY,canonical_text TEXT NOT NULL,normalized_text TEXT NOT NULL UNIQUE,language TEXT NOT NULL DEFAULT 'mixed',active INTEGER NOT NULL DEFAULT 0,correction_count INTEGER NOT NULL DEFAULT 0,accepted_count INTEGER NOT NULL DEFAULT 0,occurrence_count INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();await database.prepare("CREATE TABLE IF NOT EXISTS navixa_meeting_glossary_aliases (id TEXT PRIMARY KEY,term_id TEXT NOT NULL,alias_text TEXT NOT NULL,normalized_alias TEXT NOT NULL,source TEXT NOT NULL,usage_count INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(term_id, normalized_alias))").run();}

export async function GET(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({terms:[]},{headers:{"Cache-Control":"no-store"}});await schema(database);
  const rows=await database.prepare("SELECT t.id,t.canonical_text,t.language,t.active,t.correction_count,t.accepted_count,t.occurrence_count,t.updated_at,a.alias_text FROM navixa_meeting_glossary_terms t LEFT JOIN navixa_meeting_glossary_aliases a ON a.term_id=t.id ORDER BY t.updated_at DESC LIMIT 100").all<{id:string;canonical_text:string;language:string;active:number;correction_count:number;accepted_count:number;occurrence_count:number;updated_at:string;alias_text:string|null}>();
  const grouped=new Map<string,{id:string;canonical:string;language:string;active:boolean;corrections:number;accepted:number;occurrences:number;updatedAt:string;aliases:string[]}>();
  for(const row of rows.results){const current=grouped.get(row.id)||{id:row.id,canonical:row.canonical_text,language:row.language,active:Boolean(row.active),corrections:Number(row.correction_count),accepted:Number(row.accepted_count),occurrences:Number(row.occurrence_count),updatedAt:row.updated_at,aliases:[]};if(row.alias_text)current.aliases.push(row.alias_text);grouped.set(row.id,current)}
  return NextResponse.json({terms:[...grouped.values()]},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});const body=await request.json().catch(()=>({})) as {id?:unknown;active?:unknown};const id=clean(body.id,80);if(!id)return NextResponse.json({error:"المعرف مطلوب"},{status:400,headers:{"Cache-Control":"no-store"}});const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});await schema(database);await database.prepare("UPDATE navixa_meeting_glossary_terms SET active=?,updated_at=? WHERE id=?").bind(body.active===true?1:0,new Date().toISOString(),id).run();return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}

export async function DELETE(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});const id=clean(new URL(request.url).searchParams.get("id"),80);if(!id)return NextResponse.json({error:"المعرف مطلوب"},{status:400,headers:{"Cache-Control":"no-store"}});const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});await schema(database);await database.prepare("DELETE FROM navixa_meeting_glossary_aliases WHERE term_id=?").bind(id).run();await database.prepare("DELETE FROM navixa_meeting_glossary_terms WHERE id=?").bind(id).run();return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}

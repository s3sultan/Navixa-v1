import { NextResponse } from "next/server.js";
import { ADMIN_SESSION_COOKIE,isTrustedSameOriginRequest,readCookie,resolveAdminJwtSecret,verifyAdminSessionToken } from "../../../../worker/adminAuth.ts";

type Statement={bind:(...values:unknown[])=>Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type Database={prepare:(sql:string)=>Statement};
type ProposalRow={id:string;canonical_text:string;aliases_json:string;language:string;source:string;source_count:number;created_at:string};
const secretPattern=/(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?966|0)?5\d{8}|https?:\/\/|www\.)/i;
const clean=(value:unknown,limit:number)=>typeof value==="string"?value.normalize("NFKC").replace(/\s+/g," ").trim().slice(0,limit):"";
const normal=(value:string)=>value.toLowerCase().replace(/[ًٌٍَُِّْـ]/g,"").replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/[^\p{L}\p{N}+#./ -]/gu," ").replace(/\s+/g," ").trim();
const safe=(value:string)=>value.length>=2&&value.length<=80&&!secretPattern.test(value);
const aliases=(value:unknown,canonical:string)=>Array.isArray(value)?[...new Set(value.map(item=>clean(item,80)).filter(item=>safe(item)&&normal(item)!==normal(canonical)))] .slice(0,10):[];
async function db():Promise<Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:Database}}).env?.DB||null}catch{return (globalThis as {DB?:Database}).DB||null}}
async function allowed(request:Request){const secret=await resolveAdminJwtSecret();return Boolean(secret&&isTrustedSameOriginRequest(request)&&await verifyAdminSessionToken(readCookie(request,ADMIN_SESSION_COOKIE),secret));}
async function schema(database:Database){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_meeting_glossary_terms (id TEXT PRIMARY KEY,canonical_text TEXT NOT NULL,normalized_text TEXT NOT NULL UNIQUE,language TEXT NOT NULL DEFAULT 'mixed',active INTEGER NOT NULL DEFAULT 0,correction_count INTEGER NOT NULL DEFAULT 0,accepted_count INTEGER NOT NULL DEFAULT 0,occurrence_count INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_meeting_glossary_aliases (id TEXT PRIMARY KEY,term_id TEXT NOT NULL,alias_text TEXT NOT NULL,normalized_alias TEXT NOT NULL,source TEXT NOT NULL,usage_count INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(term_id, normalized_alias))").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_meeting_glossary_proposals (id TEXT PRIMARY KEY,canonical_text TEXT NOT NULL,normalized_text TEXT NOT NULL,aliases_json TEXT NOT NULL DEFAULT '[]',language TEXT NOT NULL DEFAULT 'mixed',source TEXT NOT NULL,source_count INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL,reviewed_at TEXT NOT NULL DEFAULT '',reviewed_by TEXT NOT NULL DEFAULT '')").run();
}
function parseAliases(value:string){try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed.map(item=>clean(item,80)).filter(safe).slice(0,10):[]}catch{return[]}}

export async function GET(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});const database=await db();if(!database)return NextResponse.json({proposals:[],terms:[]},{headers:{"Cache-Control":"no-store"}});await schema(database);
  const [pending,rows]=await Promise.all([
    database.prepare("SELECT id,canonical_text,aliases_json,language,source,source_count,created_at FROM navixa_meeting_glossary_proposals WHERE status='pending' ORDER BY created_at DESC LIMIT 60").all<ProposalRow>(),
    database.prepare("SELECT t.id,t.canonical_text,t.language,t.active,t.correction_count,t.accepted_count,t.occurrence_count,t.updated_at,a.alias_text FROM navixa_meeting_glossary_terms t LEFT JOIN navixa_meeting_glossary_aliases a ON a.term_id=t.id AND a.active=1 ORDER BY t.updated_at DESC LIMIT 100").all<{id:string;canonical_text:string;language:string;active:number;correction_count:number;accepted_count:number;occurrence_count:number;updated_at:string;alias_text:string|null}>()
  ]);
  const terms=new Map<string,{id:string;canonical:string;language:string;active:boolean;corrections:number;accepted:number;occurrences:number;updatedAt:string;aliases:string[]}>();
  for(const row of rows.results){const current=terms.get(row.id)||{id:row.id,canonical:row.canonical_text,language:row.language,active:Boolean(row.active),corrections:Number(row.correction_count),accepted:Number(row.accepted_count),occurrences:Number(row.occurrence_count),updatedAt:row.updated_at,aliases:[]};if(row.alias_text)current.aliases.push(row.alias_text);terms.set(row.id,current)}
  return NextResponse.json({proposals:pending.results.map(row=>({id:row.id,canonical:row.canonical_text,aliases:parseAliases(row.aliases_json),language:row.language,source:row.source,count:row.source_count,createdAt:row.created_at})),terms:[...terms.values()]},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});const body=await request.json().catch(()=>({})) as {action?:unknown;id?:unknown;active?:unknown;canonical?:unknown;aliases?:unknown};const action=clean(body.action,20),id=clean(body.id,80);if(!id)return NextResponse.json({error:"المعرف مطلوب"},{status:400,headers:{"Cache-Control":"no-store"}});const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});await schema(database);const now=new Date().toISOString();
  if(action==="toggle"){await database.prepare("UPDATE navixa_meeting_glossary_terms SET active=?,updated_at=? WHERE id=?").bind(body.active===true?1:0,now,id).run();return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}})}
  const proposalRows=await database.prepare("SELECT id,canonical_text,aliases_json,language,source,source_count FROM navixa_meeting_glossary_proposals WHERE id=? AND status='pending' LIMIT 1").bind(id).all<Pick<ProposalRow,"id"|"canonical_text"|"aliases_json"|"language"|"source"|"source_count">>();const proposal=proposalRows.results[0];if(!proposal)return NextResponse.json({error:"المقترح غير موجود أو سبق التعامل معه"},{status:404,headers:{"Cache-Control":"no-store"}});
  if(action==="reject"){await database.prepare("UPDATE navixa_meeting_glossary_proposals SET status='rejected',reviewed_at=?,reviewed_by='admin' WHERE id=?").bind(now,id).run();return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}})}
  if(action!=="approve")return NextResponse.json({error:"إجراء غير صالح"},{status:400,headers:{"Cache-Control":"no-store"}});
  const canonical=clean(body.canonical,80)||proposal.canonical_text;if(!safe(canonical))return NextResponse.json({error:"صياغة المصطلح غير صالحة"},{status:400,headers:{"Cache-Control":"no-store"}});const nextAliases=aliases(body.aliases,canonical);const key=normal(canonical);
  const existingRows=await database.prepare("SELECT id FROM navixa_meeting_glossary_terms WHERE normalized_text=? LIMIT 1").bind(key).all<{id:string}>();const termId=existingRows.results[0]?.id||crypto.randomUUID();
  if(existingRows.results[0])await database.prepare("UPDATE navixa_meeting_glossary_terms SET canonical_text=?,language=?,active=1,correction_count=correction_count+?,accepted_count=accepted_count+?,occurrence_count=occurrence_count+?,updated_at=? WHERE id=?").bind(canonical,proposal.language,proposal.source==="correction"?proposal.source_count:0,proposal.source==="approved"?proposal.source_count:0,proposal.source_count,now,termId).run();
  else await database.prepare("INSERT INTO navixa_meeting_glossary_terms (id,canonical_text,normalized_text,language,active,correction_count,accepted_count,occurrence_count,created_at,updated_at) VALUES (?,?,?,?,1,?,?,?,?,?)").bind(termId,canonical,key,proposal.language,proposal.source==="correction"?proposal.source_count:0,proposal.source==="approved"?proposal.source_count:0,proposal.source_count,now,now).run();
  for(const alias of nextAliases)await database.prepare("INSERT INTO navixa_meeting_glossary_aliases (id,term_id,alias_text,normalized_alias,source,usage_count,active,created_at,updated_at) VALUES (?,?,?,?,?,1,1,?,?) ON CONFLICT(term_id,normalized_alias) DO UPDATE SET alias_text=excluded.alias_text,usage_count=navixa_meeting_glossary_aliases.usage_count+1,active=1,updated_at=excluded.updated_at").bind(crypto.randomUUID(),termId,alias,normal(alias),proposal.source,now,now).run();
  await database.prepare("UPDATE navixa_meeting_glossary_proposals SET status='approved',reviewed_at=?,reviewed_by='admin' WHERE id=?").bind(now,id).run();
  return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}

export async function DELETE(request:Request){
  if(!await allowed(request))return NextResponse.json({error:"غير مصرح"},{status:401,headers:{"Cache-Control":"no-store"}});const id=clean(new URL(request.url).searchParams.get("id"),80);if(!id)return NextResponse.json({error:"المعرف مطلوب"},{status:400,headers:{"Cache-Control":"no-store"}});const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});await schema(database);await database.prepare("DELETE FROM navixa_meeting_glossary_aliases WHERE term_id=?").bind(id).run();await database.prepare("DELETE FROM navixa_meeting_glossary_terms WHERE id=?").bind(id).run();return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}

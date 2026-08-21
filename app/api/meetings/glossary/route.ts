import { NextResponse } from "next/server.js";
import { createMemoryRateLimiter, isTrustedSameOriginRequest } from "../../../../worker/adminAuth.ts";

type Statement={bind:(...values:unknown[])=>Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type Database={prepare:(sql:string)=>Statement};
type InputTerm={canonical?:unknown;aliases?:unknown;language?:unknown;sourceCount?:unknown};
type ParsedTerm={canonical:string;aliases:string[];language:"ar"|"en"|"mixed";sourceCount:number};
const limiter=createMemoryRateLimiter();
const secretPattern=/(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?966|0)?5\d{8}|https?:\/\/|www\.)/i;
const clean=(value:unknown,limit:number)=>typeof value==="string"?value.normalize("NFKC").replace(/\s+/g," ").trim().slice(0,limit):"";
const normal=(value:string)=>value.toLowerCase().replace(/[ًٌٍَُِّْـ]/g,"").replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/[^\p{L}\p{N}+#./ -]/gu," ").replace(/\s+/g," ").trim();
const safe=(value:string)=>value.length>=2&&value.length<=80&&!secretPattern.test(value);
async function db():Promise<Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:Database}}).env?.DB||null}catch{return (globalThis as {DB?:Database}).DB||null}}
export async function schema(database:Database){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_meeting_glossary_terms (id TEXT PRIMARY KEY,canonical_text TEXT NOT NULL,normalized_text TEXT NOT NULL UNIQUE,language TEXT NOT NULL DEFAULT 'mixed',active INTEGER NOT NULL DEFAULT 0,correction_count INTEGER NOT NULL DEFAULT 0,accepted_count INTEGER NOT NULL DEFAULT 0,occurrence_count INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_meeting_glossary_aliases (id TEXT PRIMARY KEY,term_id TEXT NOT NULL,alias_text TEXT NOT NULL,normalized_alias TEXT NOT NULL,source TEXT NOT NULL,usage_count INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(term_id, normalized_alias))").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_meeting_glossary_proposals (id TEXT PRIMARY KEY,canonical_text TEXT NOT NULL,normalized_text TEXT NOT NULL,aliases_json TEXT NOT NULL DEFAULT '[]',language TEXT NOT NULL DEFAULT 'mixed',source TEXT NOT NULL,source_count INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL,reviewed_at TEXT NOT NULL DEFAULT '',reviewed_by TEXT NOT NULL DEFAULT '')").run();
}
function terms(input:unknown):ParsedTerm[]{
  if(!Array.isArray(input))return[];
  const output:ParsedTerm[]=[];
  for(const item of input.slice(0,30)){
    const value=item as InputTerm;const canonical=clean(value.canonical,80);if(!safe(canonical))continue;
    const aliases=Array.isArray(value.aliases)?value.aliases.map(alias=>clean(alias,80)).filter(alias=>safe(alias)&&normal(alias)!==normal(canonical)).slice(0,8):[];
    const language=value.language==="ar"||value.language==="en"||value.language==="mixed"?value.language:"mixed";
    output.push({canonical,aliases:[...new Set(aliases)],language,sourceCount:Math.min(20,Math.max(1,Number(value.sourceCount)||1))});
  }
  return output;
}

export async function GET(){
  const database=await db();if(!database)return NextResponse.json({terms:[]},{headers:{"Cache-Control":"public, max-age=60, s-maxage=120, stale-while-revalidate=300"}});await schema(database);
  const rows=await database.prepare("SELECT t.id,t.canonical_text,t.language,t.correction_count,t.accepted_count,t.occurrence_count,a.alias_text FROM navixa_meeting_glossary_terms t LEFT JOIN navixa_meeting_glossary_aliases a ON a.term_id=t.id AND a.active=1 WHERE t.active=1 ORDER BY t.updated_at DESC LIMIT 160").all<{id:string;canonical_text:string;language:"ar"|"en"|"mixed";correction_count:number;accepted_count:number;occurrence_count:number;alias_text:string|null}>();
  const grouped=new Map<string,{canonical:string;aliases:string[];language:"ar"|"en"|"mixed";sourceCount:number}>();
  for(const row of rows.results){const current=grouped.get(row.id)||{canonical:row.canonical_text,aliases:[],language:row.language,sourceCount:Number(row.correction_count||0)+Number(row.accepted_count||0)+Number(row.occurrence_count||0)};if(row.alias_text)current.aliases.push(row.alias_text);grouped.set(row.id,current)}
  return NextResponse.json({terms:[...grouped.values()].slice(0,60)},{headers:{"Cache-Control":"public, max-age=60, s-maxage=120, stale-while-revalidate=300"}});
}

export async function POST(request:Request){
  if(!isTrustedSameOriginRequest(request))return NextResponse.json({error:"مصدر الطلب غير موثوق"},{status:403,headers:{"Cache-Control":"no-store"}});
  const ip=request.headers.get("cf-connecting-ip")||"unknown";const gate=limiter.consume(`meeting-glossary:${ip}`,10,60*60_000);if(!gate.allowed)return NextResponse.json({error:"وصلت حد مساهمات القاموس لهذا الوقت"},{status:429,headers:{"Retry-After":String(gate.retryAfterSeconds),"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as {consent?:unknown;source?:unknown;terms?:unknown};
  if(body.consent!==true)return NextResponse.json({error:"يلزم تفعيل مشاركة المصطلحات المنقّحة قبل إرسالها للمراجعة"},{status:409,headers:{"Cache-Control":"no-store"}});
  const source=body.source==="correction"?"correction":"approved";const contribution=terms(body.terms);if(!contribution.length)return NextResponse.json({error:"لا توجد مصطلحات صالحة للمراجعة"},{status:400,headers:{"Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});await schema(database);const now=new Date().toISOString();
  for(const term of contribution){
    const key=normal(term.canonical);const found=await database.prepare("SELECT id,aliases_json,source_count FROM navixa_meeting_glossary_proposals WHERE normalized_text=? AND status='pending' LIMIT 1").bind(key).all<{id:string;aliases_json:string;source_count:number}>();const existing=found.results[0];
    if(existing){let aliases:string[]=[];try{aliases=JSON.parse(existing.aliases_json) as string[]}catch{};aliases=[...new Set([...aliases,...term.aliases])].filter(safe).slice(0,10);await database.prepare("UPDATE navixa_meeting_glossary_proposals SET aliases_json=?,source_count=source_count+? WHERE id=?").bind(JSON.stringify(aliases),term.sourceCount,existing.id).run()}
    else await database.prepare("INSERT INTO navixa_meeting_glossary_proposals (id,canonical_text,normalized_text,aliases_json,language,source,source_count,status,created_at,reviewed_at,reviewed_by) VALUES (?,?,?,?,?,?,?,'pending',?,'','')").bind(crypto.randomUUID(),term.canonical,key,JSON.stringify(term.aliases),term.language,source,term.sourceCount,now).run();
  }
  return NextResponse.json({ok:true,message:"أُرسلت المصطلحات المنقّحة إلى مراجعة مدير NAVIXA. لا يُرسل الصوت أو النص الكامل أو عنوان الجلسة."},{headers:{"Cache-Control":"no-store"}});
}

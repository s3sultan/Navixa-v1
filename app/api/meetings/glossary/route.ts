import { NextResponse } from "next/server.js";
import { createMemoryRateLimiter, isTrustedSameOriginRequest } from "../../../../worker/adminAuth.ts";

type Statement={bind:(...values:unknown[])=>Statement;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>};
type Database={prepare:(sql:string)=>Statement};
type InputTerm={canonical?:unknown;aliases?:unknown;language?:unknown;sourceCount?:unknown};
const limiter=createMemoryRateLimiter();
const secretPattern=/(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?966|0)?5\d{8}|https?:\/\/|www\.)/i;
const clean=(value:unknown,limit:number)=>typeof value==="string"?value.normalize("NFKC").replace(/\s+/g," ").trim().slice(0,limit):"";
const normal=(value:string)=>value.toLowerCase().replace(/[ًٌٍَُِّْـ]/g,"").replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/[^\p{L}\p{N}+#./ -]/gu," ").replace(/\s+/g," ").trim();
const safe=(value:string)=>value.length>=2&&value.length<=80&&!secretPattern.test(value);
async function db():Promise<Database|null>{try{return (await import("cloudflare:workers") as {env?:{DB?:Database}}).env?.DB||null}catch{return (globalThis as {DB?:Database}).DB||null}}
async function schema(database:Database){
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_meeting_glossary_terms (id TEXT PRIMARY KEY,canonical_text TEXT NOT NULL,normalized_text TEXT NOT NULL UNIQUE,language TEXT NOT NULL DEFAULT 'mixed',active INTEGER NOT NULL DEFAULT 0,correction_count INTEGER NOT NULL DEFAULT 0,accepted_count INTEGER NOT NULL DEFAULT 0,occurrence_count INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS navixa_meeting_glossary_aliases (id TEXT PRIMARY KEY,term_id TEXT NOT NULL,alias_text TEXT NOT NULL,normalized_alias TEXT NOT NULL,source TEXT NOT NULL,usage_count INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(term_id, normalized_alias))").run();
}
function terms(input:unknown){
  if(!Array.isArray(input))return[];
  const output:Required<InputTerm>[]=[];
  for(const item of input.slice(0,30)){
    const value=item as InputTerm;const canonical=clean(value.canonical,80);if(!safe(canonical))continue;
    const aliases=Array.isArray(value.aliases)?value.aliases.map(alias=>clean(alias,80)).filter(alias=>safe(alias)&&normal(alias)!==normal(canonical)).slice(0,8):[];
    const language=value.language==="ar"||value.language==="en"||value.language==="mixed"?value.language:"mixed";
    const sourceCount=Math.min(20,Math.max(1,Number(value.sourceCount)||1));
    output.push({canonical,aliases,language,sourceCount});
  }
  return output;
}

export async function GET(){
  const database=await db();if(!database)return NextResponse.json({terms:[]},{headers:{"Cache-Control":"public, max-age=60, s-maxage=120, stale-while-revalidate=300"}});
  await schema(database);
  const rows=await database.prepare("SELECT t.id,t.canonical_text,t.language,t.correction_count,t.accepted_count,t.occurrence_count,a.alias_text FROM navixa_meeting_glossary_terms t LEFT JOIN navixa_meeting_glossary_aliases a ON a.term_id=t.id AND a.active=1 WHERE t.active=1 ORDER BY t.updated_at DESC LIMIT 160").all<{id:string;canonical_text:string;language:"ar"|"en"|"mixed";correction_count:number;accepted_count:number;occurrence_count:number;alias_text:string|null}>();
  const grouped=new Map<string,{canonical:string;aliases:string[];language:"ar"|"en"|"mixed";sourceCount:number}>();
  for(const row of rows.results){const current=grouped.get(row.id)||{canonical:row.canonical_text,aliases:[],language:row.language,sourceCount:Number(row.correction_count||0)+Number(row.accepted_count||0)+Number(row.occurrence_count||0)};if(row.alias_text)current.aliases.push(row.alias_text);grouped.set(row.id,current)}
  return NextResponse.json({terms:[...grouped.values()].slice(0,60)},{headers:{"Cache-Control":"public, max-age=60, s-maxage=120, stale-while-revalidate=300"}});
}

export async function POST(request:Request){
  if(!isTrustedSameOriginRequest(request))return NextResponse.json({error:"مصدر الطلب غير موثوق"},{status:403,headers:{"Cache-Control":"no-store"}});
  const ip=request.headers.get("cf-connecting-ip")||"unknown";const gate=limiter.consume(`meeting-glossary:${ip}`,10,60*60_000);if(!gate.allowed)return NextResponse.json({error:"وصلت حد مساهمات القاموس لهذا الوقت"},{status:429,headers:{"Retry-After":String(gate.retryAfterSeconds),"Cache-Control":"no-store"}});
  const body=await request.json().catch(()=>({})) as {consent?:unknown;source?:unknown;terms?:unknown};
  if(body.consent!==true)return NextResponse.json({error:"يلزم تفعيل مشاركة المصطلحات المنقّحة قبل إرسالها للقاموس العام"},{status:409,headers:{"Cache-Control":"no-store"}});
  const source=body.source==="correction"?"correction":"approved";const contribution=terms(body.terms);if(!contribution.length)return NextResponse.json({error:"لا توجد مصطلحات صالحة للمشاركة"},{status:400,headers:{"Cache-Control":"no-store"}});
  const database=await db();if(!database)return NextResponse.json({error:"التخزين غير مهيأ"},{status:503,headers:{"Cache-Control":"no-store"}});await schema(database);const now=new Date().toISOString();
  for(const term of contribution){
    const key=normal(term.canonical);const found=await database.prepare("SELECT id,correction_count,accepted_count,occurrence_count FROM navixa_meeting_glossary_terms WHERE normalized_text=? LIMIT 1").bind(key).all<{id:string;correction_count:number;accepted_count:number;occurrence_count:number}>();
    const existing=found.results[0];let id=existing?.id||crypto.randomUUID();
    if(existing){await database.prepare("UPDATE navixa_meeting_glossary_terms SET canonical_text=?,language=?,active=1,correction_count=correction_count+?,accepted_count=accepted_count+?,occurrence_count=occurrence_count+?,updated_at=? WHERE id=?").bind(term.canonical,term.language,source==="correction"?1:0,source==="approved"?1:0,term.sourceCount,now,id).run()}
    else await database.prepare("INSERT INTO navixa_meeting_glossary_terms (id,canonical_text,normalized_text,language,active,correction_count,accepted_count,occurrence_count,created_at,updated_at) VALUES (?,?,?,?,1,?,?,?,?,?)").bind(id,term.canonical,key,term.language,source==="correction"?1:0,source==="approved"?1:0,term.sourceCount,now,now).run();
    for(const alias of term.aliases){await database.prepare("INSERT INTO navixa_meeting_glossary_aliases (id,term_id,alias_text,normalized_alias,source,usage_count,active,created_at,updated_at) VALUES (?,?,?,?,?,1,1,?,?) ON CONFLICT(term_id,normalized_alias) DO UPDATE SET alias_text=excluded.alias_text,usage_count=navixa_meeting_glossary_aliases.usage_count+1,active=1,updated_at=excluded.updated_at").bind(crypto.randomUUID(),id,alias,normal(alias),source,now,now).run()}
  }
  return NextResponse.json({ok:true,message:"تمت مشاركة مصطلحات منقّحة فقط. لا يُرسل الصوت أو النص الكامل أو عنوان الجلسة."},{headers:{"Cache-Control":"no-store"}});
}

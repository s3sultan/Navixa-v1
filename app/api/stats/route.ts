import {NextResponse} from "next/server";

type D1Result={meta?:{changes?:number}};
type D1Statement={bind:(...values:unknown[])=>D1Statement;run:()=>Promise<D1Result>;all:<T=Record<string,unknown>>()=>Promise<{results:T[]}>};
type D1Database={prepare:(sql:string)=>D1Statement};

const getDb=():D1Database|null=>{
  const runtime=(globalThis as any).DB;
  const processEnv=(typeof process!=="undefined"?(process as any).env?.DB:null);
  return runtime||processEnv||null;
};
const safeDay=()=>new Date().toISOString().slice(0,10);

async function ensureSchema(db:D1Database){
  await db.prepare("CREATE TABLE IF NOT EXISTS navixa_counters (key TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS navixa_counter_events (event_key TEXT PRIMARY KEY, event_name TEXT NOT NULL, visitor_key TEXT NOT NULL, event_day TEXT NOT NULL, created_at TEXT NOT NULL)").run();
  const now=new Date().toISOString();
  await db.prepare("INSERT OR IGNORE INTO navixa_counters (key,value,updated_at) VALUES ('site_visits',12840,?),('ehsan_clicks',1200,?)").bind(now,now).run();
}
async function readStats(db:D1Database){
  const result=await db.prepare("SELECT key,value FROM navixa_counters WHERE key IN ('site_visits','ehsan_clicks')").all<{key:string;value:number}>();
  const values=Object.fromEntries(result.results.map(row=>[row.key,Number(row.value)||0]));
  return {visits:values.site_visits||0,ehsan:values.ehsan_clicks||0};
}

export async function GET(){
  try{
    const db=getDb();
    if(!db)return NextResponse.json({ok:false,configured:false,stats:{visits:0,ehsan:0}});
    await ensureSchema(db);
    return NextResponse.json({ok:true,configured:true,stats:await readStats(db)});
  }catch{return NextResponse.json({ok:false,configured:false,stats:{visits:0,ehsan:0}},{status:200})}
}

export async function POST(request:Request){
  try{
    const db=getDb();
    if(!db)return NextResponse.json({ok:false,configured:false},{status:503});
    const body=await request.json().catch(()=>({}));
    const event=body?.event==="ehsan"?"ehsan":body?.event==="visit"?"visit":null;
    const visitorKey=typeof body?.visitorKey==="string"?body.visitorKey.slice(0,120):"";
    if(!event||visitorKey.length<12)return NextResponse.json({error:"طلب غير صالح"},{status:400});
    await ensureSchema(db);
    const day=safeDay();
    const eventKey=`${event}:${day}:${visitorKey}`;
    const inserted=await db.prepare("INSERT OR IGNORE INTO navixa_counter_events (event_key,event_name,visitor_key,event_day,created_at) VALUES (?,?,?,?,?)").bind(eventKey,event,visitorKey,day,new Date().toISOString()).run();
    if(Number(inserted.meta?.changes||0)>0){
      const counter=event==="visit"?"site_visits":"ehsan_clicks";
      await db.prepare("UPDATE navixa_counters SET value=value+1,updated_at=? WHERE key=?").bind(new Date().toISOString(),counter).run();
    }
    return NextResponse.json({ok:true,configured:true,stats:await readStats(db)});
  }catch{return NextResponse.json({error:"تعذر تحديث الإحصائية"},{status:500})}
}
